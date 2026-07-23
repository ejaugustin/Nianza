import { Link, router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { getDailyNote } from "@/api/content";
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

export default function HomeScreen() {
  const auth = useAuth();
  const profile = auth.profile!;

  const dailyNoteQuery = useQuery({
    queryKey: ["daily-note", profile.language, profile.ageWindowMonths, mockHome.dailyNoteDomain],
    queryFn: () =>
      getDailyNote({
        language: profile.language,
        ageWindowMonths: profile.ageWindowMonths,
        domain: mockHome.dailyNoteDomain
      }),
    staleTime: 1000 * 60 * 30,
    retry: 1
  });
  const dailyNote = dailyNoteQuery.data?.bodyText || mockHome.dailyNote;
  const parentFirstName = profile.parentFirstName || profile.parentName?.split(" ")[0];
  const parentName = parentFirstName || profile.parentName;
  const childName = profile.childName;
  const childAge = `${profile.ageWindowMonths} months`;
  const personalizedDailyNote = useMemo(() => {
    const pronouns = profile.sexAtBirth === "boy" ? { she: "he", her: "his", hers: "his" } : { she: "she", her: "her", hers: "hers" };
    return normalizeChildNameInNote(dailyNote, childName)
      .replaceAll("{childName}", childName)
      .replaceAll("{she}", pronouns.she)
      .replaceAll("{her}", pronouns.her)
      .replaceAll("{hers}", pronouns.hers);
  }, [childName, dailyNote, profile.sexAtBirth]);

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
        <Text selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={{ color: theme.colors.text, fontSize: 22, fontWeight: "700" }}>
          {childName} - {childAge}
        </Text>
      </View>

      <PatriciaNote
        actionLabel="Discuss with Patricia"
        onAction={() =>
          openPatricia({
            source: "C1-home-note",
            eventType: "home-note",
            childName,
            childId: "primary-child",
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
      {dailyNoteQuery.isError ? <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>Showing Patricia's saved note.</Text> : null}
      <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>{mockHome.dateLabel}</Text>

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
                  childId: "primary-child",
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
