import { useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { CategoryChip, EmptyCircle, ScreenTitle, SectionLabel, SfIcon } from "@/components/screen-spec";
import { TalkToPatriciaButton, openPatricia } from "@/components/talk-to-patricia-button";
import { theme } from "@/theme/theme";

type MilestoneDomain = "Movement" | "Language" | "Social" | "Cognitive" | "Self-Care";

type MilestoneSeed = {
  id: string;
  domain: MilestoneDomain;
  title: string;
  windowLabel: string;
  description: string;
  encourage: string[];
  watchFor: string;
  patriciaNote: string;
  sourceRef: string;
};

const domains: MilestoneDomain[] = ["Movement", "Language", "Social", "Cognitive", "Self-Care"];

const milestoneSeeds: MilestoneSeed[] = [
  {
    id: "movement-roll-front-back",
    domain: "Movement",
    title: "Rolls over front to back",
    windowLabel: "4-6 months",
    description: "A first body-control milestone: your baby discovers they can turn themselves over.",
    encourage: ["Offer short tummy-time moments when your baby is alert.", "Place a toy slightly to one side so turning feels natural."],
    watchFor: "If rolling is not showing up over the next window, bring it up at the next visit. It is a note, not an alarm.",
    patriciaNote: "I've seen this happen in the middle of a quiet floor moment. Keep tummy time gentle and steady.",
    sourceRef: "CDC LTSAE / Bright Futures"
  },
  {
    id: "movement-pushes-up",
    domain: "Movement",
    title: "Pushes up on arms during tummy time",
    windowLabel: "4-6 months",
    description: "Those little push-ups build the shoulder and neck strength that supports rolling and sitting later.",
    encourage: ["Try tummy time after a diaper change.", "Get low and let your face be the best toy in the room."],
    watchFor: "If tummy time always feels unusually hard or stiff, make a note for the pediatrician.",
    patriciaNote: "A few calm minutes count. This is not a gym routine; it is practice with love nearby.",
    sourceRef: "CDC LTSAE / Bright Futures"
  },
  {
    id: "movement-hands-mouth",
    domain: "Movement",
    title: "Brings hands to mouth",
    windowLabel: "4-6 months",
    description: "Hands-to-mouth is part comfort, part discovery, and part early coordination.",
    encourage: ["Offer safe, easy-to-grip toys.", "Let your baby explore clean hands during calm moments."],
    watchFor: "If one side seems much less active than the other, mention it at the next visit.",
    patriciaNote: "This one is small but meaningful. Hands are becoming tools, comfort, and company.",
    sourceRef: "CDC LTSAE / Bright Futures"
  },
  {
    id: "language-coos",
    domain: "Language",
    title: "Coos and makes vowel sounds",
    windowLabel: "4-6 months",
    description: "Early sounds are the beginning of back-and-forth conversation.",
    encourage: ["Pause after your baby coos, then answer like it was a sentence.", "Copy one sound back and smile."],
    watchFor: "If your baby is mostly silent or does not react to familiar voices, bring it up gently.",
    patriciaNote: "Answer the little sounds. You are teaching that voices can find each other.",
    sourceRef: "CDC LTSAE / Bright Futures"
  },
  {
    id: "language-turns-voice",
    domain: "Language",
    title: "Turns toward a familiar voice",
    windowLabel: "4-6 months",
    description: "Your voice is becoming a landmark in the room.",
    encourage: ["Talk before you enter the baby's view.", "Use the same little greeting during daily care."],
    watchFor: "If your baby does not startle or turn toward sound, ask about hearing at the next visit.",
    patriciaNote: "Your voice is not background noise. It is one of the first places your baby feels found.",
    sourceRef: "CDC LTSAE / Bright Futures"
  },
  {
    id: "social-smiles",
    domain: "Social",
    title: "Smiles to get your attention",
    windowLabel: "4-6 months",
    description: "A smile can become an invitation: look at me, stay with me, do that again.",
    encourage: ["Smile back and wait a beat.", "Make simple face games part of diaper changes."],
    watchFor: "If smiles or eye contact feel rare, keep a note and share it with your clinician.",
    patriciaNote: "This is connection getting stronger. The ordinary smiles matter.",
    sourceRef: "CDC LTSAE / Bright Futures"
  },
  {
    id: "cognitive-watches-toy",
    domain: "Cognitive",
    title: "Watches a toy move side to side",
    windowLabel: "4-6 months",
    description: "Tracking a toy helps vision, attention, and curiosity work together.",
    encourage: ["Move a toy slowly from side to side.", "Stop before your baby gets tired of the game."],
    watchFor: "If your baby rarely follows faces or objects, mention it at the next visit.",
    patriciaNote: "Slow is better here. Give the eyes time to find and follow.",
    sourceRef: "CDC LTSAE / Bright Futures"
  },
  {
    id: "self-care-settles",
    domain: "Self-Care",
    title: "Settles with a familiar routine",
    windowLabel: "4-6 months",
    description: "Routines begin to help babies understand what comes next.",
    encourage: ["Use the same short song before sleep.", "Keep the routine simple enough to do when you are tired."],
    watchFor: "If nothing helps your baby settle and you feel stretched thin, ask for support. You do not have to carry it alone.",
    patriciaNote: "A routine is not a performance. It is a little promise repeated.",
    sourceRef: "Bright Futures / Nianza parent-support register"
  }
];

function ageWindowLabel(ageWindowMonths?: number | null) {
  if (typeof ageWindowMonths !== "number") return "4-6 months";
  if (ageWindowMonths <= 3) return "2-4 months";
  if (ageWindowMonths <= 6) return "4-6 months";
  if (ageWindowMonths <= 9) return "6-9 months";
  if (ageWindowMonths <= 12) return "9-12 months";
  return `${ageWindowMonths} months`;
}

export default function MilestonesScreen() {
  const { profile } = useAuth();
  const childName = profile?.childName || "your child";
  const [activeDomain, setActiveDomain] = useState<MilestoneDomain>("Movement");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [watchOpen, setWatchOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<MilestoneSeed | null>(null);
  const [notice, setNotice] = useState("");

  const visibleMilestones = useMemo(() => milestoneSeeds.filter((milestone) => milestone.domain === activeDomain), [activeDomain]);
  const observedThisMonth = Object.values(checked).filter(Boolean).length;
  const activeWatchText =
    visibleMilestones.map((milestone) => milestone.watchFor).join(" ") ||
    "If something worries you, make a note for the next visit. Patricia can help you organize the question.";

  async function shareMilestone(milestone: MilestoneSeed) {
    await Share.share({
      message: `${childName} ${milestone.title.toLowerCase()}. Patricia says: "${milestone.patriciaNote}"`
    });
  }

  async function addMilestonePhoto(milestone: MilestoneSeed) {
    setNotice("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice("Photo access is needed to add a milestone picture. You can keep going without one.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setPhotos((current) => ({
          ...current,
          [milestone.id]: [...(current[milestone.id] || []), result.assets[0].uri].slice(0, 5)
        }));
        setNotice(`Photo added to ${milestone.title.toLowerCase()}.`);
      }
    } catch {
      setNotice("I could not open photos just now. Try again in a moment.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 132, gap: 22 }}
        style={{ backgroundColor: theme.colors.background }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <ScreenTitle title="Milestones" subtitle={`${childName} - ${ageWindowLabel(profile?.ageWindowMonths)}`} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open memory book"
            onPress={() => setNotice("Memory book gallery is next. Photos you add here are already being collected.")}
            style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border }}
          >
            <SfIcon name="camera" color={theme.colors.bluePrimary} size={21} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
          {domains.map((domain) => (
            <Pressable key={domain} accessibilityRole="tab" accessibilityState={{ selected: activeDomain === domain }} onPress={() => setActiveDomain(domain)}>
              <CategoryChip label={domain} active={activeDomain === domain} />
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden" }}>
          {visibleMilestones.map((milestone, index) => {
            const isChecked = Boolean(checked[milestone.id]);
            const milestonePhotos = photos[milestone.id] || [];
            return (
              <View key={milestone.id}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  onPress={() => {
                    setChecked((current) => ({ ...current, [milestone.id]: !current[milestone.id] }));
                    setNotice(isChecked ? "Milestone unchecked." : "Milestone marked as observed.");
                  }}
                  onLongPress={() => setSelectedDetail(milestone)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, backgroundColor: isChecked ? theme.colors.blueLight : "white" }}
                >
                  <EmptyCircle checked={isChecked} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 20, fontWeight: "600" }}>{milestone.title}</Text>
                    <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>{milestone.windowLabel} - {milestone.sourceRef}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open details for ${milestone.title}`} onPress={() => setSelectedDetail(milestone)} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
                    <SfIcon name="chevron.right" color={theme.colors.greyIcon} size={18} />
                  </Pressable>
                </Pressable>

                {isChecked ? (
                  <View style={{ paddingLeft: 58, paddingRight: 14, paddingBottom: 14, gap: 10, backgroundColor: theme.colors.blueLight }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Pressable onPress={() => shareMilestone(milestone)} style={{ borderRadius: 14, backgroundColor: theme.colors.terracottaLight, paddingHorizontal: 12, paddingVertical: 7 }}>
                        <Text selectable style={{ color: theme.colors.terracotta, fontSize: 12, fontWeight: "700" }}>Share</Text>
                      </Pressable>
                      <Pressable onPress={() => addMilestonePhoto(milestone)} style={{ borderRadius: 14, backgroundColor: "white", paddingHorizontal: 12, paddingVertical: 7 }}>
                        <Text selectable style={{ color: theme.colors.blueDeep, fontSize: 12, fontWeight: "700" }}>Add photo</Text>
                      </Pressable>
                    </View>
                    {milestonePhotos.length ? (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {milestonePhotos.map((uri) => (
                          <Image key={uri} source={{ uri }} style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: "white" }} contentFit="cover" />
                        ))}
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() =>
                        openPatricia({
                          source: "D2-milestone-checked",
                          eventType: "milestone-checked",
                          childName,
                          childId: "primary-child",
                          entityId: milestone.id,
                          title: "Milestone checked",
                          detail: milestone.title,
                          occurredAt: new Date().toISOString()
                        })
                      }
                    >
                      <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "700" }}>Tell Patricia</Text>
                    </Pressable>
                  </View>
                ) : null}
                {index < visibleMilestones.length - 1 ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
              </View>
            );
          })}
        </View>

        {notice ? <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>{notice}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: watchOpen }}
          onPress={() => setWatchOpen((current) => !current)}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}
        >
          <SectionLabel>THINGS TO WATCH FOR</SectionLabel>
          <SfIcon name="chevron.down" color={theme.colors.greyIcon} size={20} />
        </Pressable>
        {watchOpen ? (
          <View style={{ borderRadius: 16, backgroundColor: theme.colors.card, padding: 16, borderLeftWidth: 3, borderLeftColor: theme.colors.bluePrimary, gap: 8 }}>
            <View style={{ alignSelf: "flex-end", width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
              <Text selectable={false} style={{ color: "white", fontSize: 13, fontWeight: "800" }}>P</Text>
            </View>
            <Text selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 23, fontStyle: "italic" }}>
              {activeWatchText}
            </Text>
          </View>
        ) : null}

        <View style={{ borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, padding: 14, gap: 6 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700" }}>This month</Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 18 }}>
            {observedThisMonth ? `${observedThisMonth} milestone${observedThisMonth === 1 ? "" : "s"} observed. These are notes for you and your clinician, not a score.` : "No milestones checked yet. Start with anything you have noticed."}
          </Text>
        </View>
      </ScrollView>

      {selectedDetail ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.34)", justifyContent: "flex-end", zIndex: 30 }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSelectedDetail(null)} />
          <View style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "white", padding: 20, paddingBottom: 34, gap: 14 }}>
            <View style={{ alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: theme.colors.border }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text selectable style={{ color: theme.colors.text, fontSize: 21, fontWeight: "800", lineHeight: 26 }}>{selectedDetail.title}</Text>
                <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>Typically seen: {selectedDetail.windowLabel}</Text>
              </View>
              <Pressable onPress={() => setSelectedDetail(null)} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                <Text selectable={false} style={{ color: theme.colors.greyIcon, fontSize: 24 }}>x</Text>
              </Pressable>
            </View>
            <Text selectable style={{ color: theme.colors.text, fontSize: 14, lineHeight: 21 }}>{selectedDetail.description}</Text>
            <View style={{ borderRadius: 16, backgroundColor: theme.colors.card, padding: 15, borderLeftWidth: 3, borderLeftColor: theme.colors.bluePrimary }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 23, fontStyle: "italic" }}>{selectedDetail.patriciaNote}</Text>
            </View>
            <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700" }}>How to encourage this</Text>
            {selectedDetail.encourage.map((tip) => (
              <Text key={tip} selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>- {tip}</Text>
            ))}
            <Pressable
              onPress={() => {
                setChecked((current) => ({ ...current, [selectedDetail.id]: true }));
                setSelectedDetail(null);
                setNotice("Milestone marked as observed.");
              }}
              style={{ minHeight: 52, borderRadius: 14, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}
            >
              <Text selectable={false} style={{ color: "white", fontSize: 16, fontWeight: "800" }}>Mark as observed</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <TalkToPatriciaButton source="D1-milestones" eventType="general" detail={`${childName} milestone screen: ${activeDomain}`} />
    </View>
  );
}
