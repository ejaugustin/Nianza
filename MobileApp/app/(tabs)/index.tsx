import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { getDailyNote } from "@/api/content";
import { getAnniversaryNote } from "@/api/memories";
import { confirmVisit } from "@/api/visits";
import { BrandLogo } from "@/components/brand-logo";
import { PatriciaNote } from "@/components/patricia-note";
import { SectionLabel, SfIcon, SpecCard } from "@/components/screen-spec";
import { TalkToPatriciaButton, openPatricia } from "@/components/talk-to-patricia-button";
import { mockHome } from "@/content/mock-home";
import { theme } from "@/theme/theme";

const weeklyCards = [
  { title: "Milestones", subtitle: "2 this month", icon: "checkmark", href: "/(tabs)/milestones" },
  { title: "Vaccines", subtitle: "Next: DTaP", icon: "shield", href: "/(tabs)/vaccines" },
  { title: "Vitals", subtitle: "Jul 12", icon: "doc.text", href: "/vitals" }
];

function normalizeChildNameInNote(note: string, childName: string) {
  return note.replace(/\bSofia\b/g, childName).replace(/\bSophia\b/g, childName);
}

// Live-computed from childBirthDate, matching Settings' "Your Children" row
// exactly -- profile.ageWindowMonths is a stored-at-onboarding snapshot that
// never updates, which is why this header was stuck reading "0 months"
// while Settings (computed live) correctly showed "2 months".
function monthsSince(dateValue?: string) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth());
}

function childAgeLabel(dateValue?: string) {
  const months = monthsSince(dateValue);
  if (months === null) return "";
  if (months < 1) return "Newborn";
  if (months === 1) return "1 month";
  return `${months} months`;
}

export default function HomeScreen() {
  const auth = useAuth();
  const profile = auth.profile!;
  const childId = profile.childId || "primary-child";
  const [visitPromptAnswered, setVisitPromptAnswered] = useState(false);
  const [showRescheduleNudge, setShowRescheduleNudge] = useState(false);

  // N5 (Parking-Lot Debrief), corrected trigger per Brief v2.16: nextVisitDate
  // being in the past does NOT mean a visit happened -- it's a single
  // unconfirmed field. This card asks first, and clears the date on either
  // branch so it can't silently re-fire on a stale date forever.
  const todayIso = new Date().toISOString().slice(0, 10);
  const nextVisitPassed = Boolean(profile.nextVisitDate && profile.nextVisitDate <= todayIso);
  const showPostVisitPrompt = nextVisitPassed && !visitPromptAnswered;

  // N7 (Birthday Letter): a quiet note on the day itself, never a forced
  // push notification. Client-computed month+day match rather than routed
  // through the content-library daily-note engine -- the letter is
  // generated on-demand server-side only once the parent actually opens it.
  const isBirthdayToday = useMemo(() => {
    if (!profile.childBirthDate) return false;
    const birth = new Date(profile.childBirthDate);
    if (Number.isNaN(birth.getTime())) return false;
    const now = new Date();
    const atLeastFirstBirthday = now.getFullYear() > birth.getFullYear();
    return atLeastFirstBirthday && now.getMonth() === birth.getMonth() && now.getDate() === birth.getDate();
  }, [profile.childBirthDate]);

  // N2 (Parent voice capsules): graduation age is 18 years, which lines up
  // exactly with GRADUATION_AGE_MONTHS server-side -- so the 18th birthday is
  // the one day this screen should point at the shelf ("open what's waiting")
  // instead of the ongoing "record one more" invite.
  const isGraduationDay = useMemo(() => {
    if (!isBirthdayToday || !profile.childBirthDate) return false;
    const birth = new Date(profile.childBirthDate);
    return new Date().getFullYear() - birth.getFullYear() === 18;
  }, [isBirthdayToday, profile.childBirthDate]);

  // Daily-tip rotation (fix for the "note never changes" bug, 2026-07-28):
  // the NZA-DAILYTIPS library is authored as a day-of-life-indexed sequence
  // (Day 1 = date of birth), so the only thing this screen needs to send the
  // backend is how many days old the child actually is today. The backend
  // picks whichever authored tip's startDay is the latest one <= this value.
  const dayOfLife = useMemo(() => {
    if (!profile.childBirthDate) return undefined;
    const birth = new Date(profile.childBirthDate);
    if (Number.isNaN(birth.getTime())) return undefined;
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor((Date.now() - birth.getTime()) / msPerDay);
    return Math.max(1, diffDays + 1);
  }, [profile.childBirthDate]);

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    []
  );

  async function handleSawDoctor(sawDoctor: boolean) {
    setVisitPromptAnswered(true);
    if (!sawDoctor) setShowRescheduleNudge(true);
    try {
      await confirmVisit(childId, sawDoctor);
    } catch {
      // Best-effort -- local profile update below still clears the stale
      // date so the card doesn't loop even if the network call failed.
    }
    await auth.updateProfile({ nextVisitDate: null }).catch(() => undefined);
    if (sawDoctor) {
      router.push("/visit-debrief");
    }
  }

  const dailyNoteQuery = useQuery({
    queryKey: ["daily-note", profile.language, profile.ageWindowMonths, dayOfLife],
    queryFn: () =>
      getDailyNote({
        language: profile.language,
        ageWindowMonths: profile.ageWindowMonths,
        dayOfLife
      }),
    staleTime: 1000 * 60 * 60 * 12,
    retry: 1
  });
  // N1 (Milestone anniversaries): folds into this same daily-note slot --
  // fetched alongside the regular daily note and, on the rare day it exists,
  // takes priority over it (see personalizedDailyNote below). No streak or
  // badge is tied to it; it just quietly appears on the day it's true.
  const anniversaryNoteQuery = useQuery({
    queryKey: ["anniversary-note", childId],
    queryFn: () => getAnniversaryNote(childId),
    staleTime: 1000 * 60 * 30,
    retry: 1
  });

  const dailyNote = dailyNoteQuery.data?.bodyText || mockHome.dailyNote;
  const parentFirstName = profile.parentFirstName || profile.parentName?.split(" ")[0];
  const parentName = parentFirstName || profile.parentName;
  const childName = profile.childName;
  const childAge = childAgeLabel(profile.childBirthDate);
  const personalizedDailyNote = useMemo(() => {
    const anniversaryText = anniversaryNoteQuery.data?.bodyText;
    if (anniversaryText) return anniversaryText;
    const pronouns = profile.sexAtBirth === "boy" ? { she: "he", her: "his", hers: "his" } : { she: "she", her: "her", hers: "hers" };
    return normalizeChildNameInNote(dailyNote, childName)
      .replaceAll("{childName}", childName)
      .replaceAll("{she}", pronouns.she)
      .replaceAll("{her}", pronouns.her)
      .replaceAll("{hers}", pronouns.hers);
  }, [anniversaryNoteQuery.data?.bodyText, childName, dailyNote, profile.sexAtBirth]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 28, paddingBottom: 32, gap: 16 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <BrandLogo width={124} height={44} />
        <SfIcon name="bell" color={theme.colors.muted} size={22} />
      </View>

      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 14 }}>Good morning, {parentName}.</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {profile.childPhotoUri ? (
              <Image source={{ uri: profile.childPhotoUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <Text selectable={false} style={{ color: "white", fontSize: 14, fontWeight: "800" }}>
                {(childName || "?").slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>
          <Text selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={{ flex: 1, color: theme.colors.text, fontSize: 22, fontWeight: "700" }}>
            {childName} - {childAge}
          </Text>
        </View>
      </View>

      <PatriciaNote
        actionLabel="Discuss with Patricia"
        onAction={() =>
          openPatricia({
            source: "C1-home-note",
            eventType: "home-note",
            childName,
            childId: profile.childId || "primary-child",
            parentFirstName,
            entityId: dailyNoteQuery.data?.contentId || "daily-note",
            title: "Today's Patricia note",
            detail: personalizedDailyNote,
            occurredAt: new Date().toISOString()
          })
        }
      >
        {personalizedDailyNote}
      </PatriciaNote>
      {dailyNoteQuery.isError || (dailyNoteQuery.isFetched && !dailyNoteQuery.data) ? (
        <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>Showing Patricia's saved note.</Text>
      ) : null}
      <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>{todayLabel}</Text>

      {isBirthdayToday ? (
        <Pressable onPress={() => router.push("/birthday-letter")}>
          <SpecCard style={{ padding: 16, gap: 6 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700", lineHeight: 20, fontStyle: "italic" }}>
              It's {childName}'s birthday. I wrote something for this year, whenever you want to see it.
            </Text>
            <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "700" }}>Read the letter</Text>
          </SpecCard>
        </Pressable>
      ) : null}

      {/* N2 (Parent voice capsules): the birthday is a natural, once-a-year
          moment to offer this -- not a recurring nudge. Easy to decline, and
          it won't ask again until next year (there's no streak or badge tied
          to it, per DO NOT 18). On the 18th birthday specifically, this
          points at the shelf instead, since that's the day the capsules
          actually unlock. */}
      {isGraduationDay ? (
        <Pressable onPress={() => router.push({ pathname: "/capsule-shelf", params: { childId } })}>
          <SpecCard style={{ padding: 16, gap: 6 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
              I've been keeping messages safe for {childName} over the years -- they're ready for you now.
            </Text>
            <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "700" }}>Open the capsule shelf</Text>
          </SpecCard>
        </Pressable>
      ) : isBirthdayToday ? (
        <Pressable onPress={() => router.push({ pathname: "/voice-memory-capture", params: { childId, type: "parent-capsule" } })}>
          <SpecCard style={{ padding: 16, gap: 6 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
              Want to leave {childName} a message for when they're older? I'll keep it safe until then.
            </Text>
            <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "700" }}>Record a voice capsule</Text>
          </SpecCard>
        </Pressable>
      ) : null}

      <SectionLabel>THIS WEEK</SectionLabel>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {weeklyCards.map((card) => (
          <Link key={card.title} href={card.href} asChild>
            <Pressable style={{ flex: 1 }}>
              <SpecCard style={{ minHeight: 88, padding: 14, gap: 8 }}>
                <SfIcon name={card.icon} size={22} />
                <Text selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: theme.colors.text, fontSize: 12, fontWeight: "600" }}>{card.title}</Text>
                <Text selectable numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: theme.colors.greyIcon, fontSize: 11 }}>{card.subtitle}</Text>
              </SpecCard>
            </Pressable>
          </Link>
        ))}
      </View>

      {/* Memory book: previously buried under a camera icon on the
          Milestones tab header, which meant a lot of parents never found it.
          A standing Home entry point makes it a first-class destination --
          Patricia-voiced, always here regardless of what else is happening
          today, using the same openMemoryBook route param the Settings
          "Memory book" row already relies on. */}
      <Pressable onPress={() => router.push({ pathname: "/(tabs)/milestones", params: { openMemoryBook: "1" } })}>
        <SpecCard style={{ padding: 16, gap: 6 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
            Want to look back? Everything you've saved for {childName} -- photos, voices, the little things -- lives in the memory book.
          </Text>
          <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "700" }}>Open the memory book</Text>
        </SpecCard>
      </Pressable>

      {showPostVisitPrompt ? (
        <SpecCard style={{ padding: 16, gap: 12 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "700", lineHeight: 21 }}>
            Did you see the doctor recently?
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => handleSawDoctor(true)}
              style={{ flex: 1, minHeight: 46, borderRadius: 23, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}
            >
              <Text selectable={false} style={{ color: "white", fontSize: 13, fontWeight: "800" }}>Yes, let's do that</Text>
            </Pressable>
            <Pressable
              onPress={() => handleSawDoctor(false)}
              style={{ flex: 1, minHeight: 46, borderRadius: 23, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" }}
            >
              <Text selectable={false} style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "700" }}>Not yet</Text>
            </Pressable>
          </View>
        </SpecCard>
      ) : null}

      {showRescheduleNudge ? (
        <SpecCard style={{ padding: 16, gap: 8 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>
            No rush -- want to update the date for your next visit?
          </Text>
          <Pressable onPress={() => router.push("/settings/pediatrician")}>
            <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "700" }}>Update visit date</Text>
          </Pressable>
        </SpecCard>
      ) : null}

      <SectionLabel>UPCOMING</SectionLabel>
      <SpecCard style={{ minHeight: 60, padding: 0, overflow: "hidden" }}>
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: 4, backgroundColor: theme.colors.bluePrimary }} />
          <View style={{ padding: 16, gap: 6, flex: 1 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 13, fontWeight: "600" }}>DTaP vaccine</Text>
            <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 12 }}>Due around 6 months</Text>
          </View>
        </View>
      </SpecCard>

      <SpecCard style={{ padding: 16, gap: 10 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700" }}>Four-month visit</Text>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 18 }}>A gentle place to gather questions before you walk in.</Text>
        <View style={{ gap: 8 }}>
          <Pressable onPress={() => router.push("/(tabs)/reports")}>
            <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "700" }}>Prepare visit pack</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/(tabs)/vaccines")}>
            <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "700" }}>Review vaccine notes</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              openPatricia({
                  source: "C1-home-visit-card",
                  eventType: "visit-upcoming",
                  childName,
                  childId: profile.childId || "primary-child",
                  parentFirstName,
                  entityId: "four-month-visit",
                  title: "Four-month visit",
                  detail: "Four-month visit this week",
                  occurredAt: new Date().toISOString()
              })
            }
          >
            <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "700" }}>Talk it through with Patricia</Text>
          </Pressable>
        </View>
      </SpecCard>
    </ScrollView>
    <TalkToPatriciaButton source="C1-home" />
    </View>
  );
}
