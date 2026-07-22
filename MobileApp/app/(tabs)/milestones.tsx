import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getMilestoneProgress, recordMilestoneObservation, type WatchForProgressItem } from "@/api/milestones";
import { useAuth } from "@/auth/auth-context";
import { CategoryChip, EmptyCircle, ScreenTitle, SectionLabel, SfIcon } from "@/components/screen-spec";
import { TalkToPatriciaButton, openPatricia } from "@/components/talk-to-patricia-button";
import {
  ActEarlyItem,
  MilestoneDefinition,
  MilestoneTab,
  getCurrentMilestoneWindow,
  getMilestonesForTab,
  getSourceLabel,
  milestoneDomains,
  milestoneLibrary
} from "@/data/milestones";
import { theme } from "@/theme/theme";

function normalizePatriciaText(text: string, childName: string) {
  return text
    .replace(/\bhis or her\b/gi, `${childName}'s`)
    .replace(/\bhe or she\b/gi, childName)
    .replace(/\bhim or her\b/gi, childName)
    .replace(/\bhimself or herself\b/gi, "themself");
}

function milestoneDescription(milestone: MilestoneDefinition, childName: string) {
  const text = normalizePatriciaText(milestone.text, childName).replace(/\.$/, "");
  return `This is one of the ${milestone.domain.toLowerCase()} signs Patricia is watching for around this age: ${text}.`;
}

function patriciaMilestoneNote(milestone: MilestoneDefinition, childName: string) {
  const text = normalizePatriciaText(milestone.text, childName).toLowerCase();
  if (milestone.tab === "Movement") return `When you notice ${childName} ${text}, mark it here. Small body skills often arrive during ordinary floor time.`;
  if (milestone.tab === "Language") return `When you hear this, answer back. Patricia treats these little sounds as the beginning of conversation.`;
  if (milestone.tab === "Social") return `This is connection. If you notice it, pause and enjoy it before you check the box.`;
  if (milestone.tab === "Cognitive") return `This is ${childName} making sense of the world. Slow repetition is enough.`;
  return `This is a care rhythm, not a test. Mark it when it feels true in real life.`;
}

function encouragementFor(milestone: MilestoneDefinition) {
  if (milestone.selfCare) {
    return ["Let the routine stay calm and repeatable.", "Bring it up at visits if care tasks feel unusually hard."];
  }
  if (milestone.tab === "Movement") {
    return ["Offer short, calm floor moments when your baby is alert.", "Keep your face or a simple toy nearby so practice feels playful."];
  }
  if (milestone.tab === "Language") {
    return ["Talk in short, warm phrases during care moments.", "Pause after sounds so your baby gets a turn."];
  }
  if (milestone.tab === "Social") {
    return ["Follow your baby's gaze and facial expressions.", "Repeat the simple games that make your baby light up."];
  }
  return ["Move slowly and give your baby time to look, reach, or respond.", "Use ordinary routines as tiny practice moments."];
}

function watchText(items: ActEarlyItem[], childName: string) {
  if (!items.length) {
    return "If something feels off, make a note for the next visit. Patricia can help you put the question into words.";
  }

  const sample = items.slice(0, 4).map((item) => normalizePatriciaText(item.text, childName).replace(/\.$/, "").toLowerCase());
  return `If you are not seeing things like ${sample.join("; ")}, keep a note and bring it to your child's doctor. This is not an alarm; it is a way to organize what you are noticing.`;
}

export default function MilestonesScreen() {
  const { profile } = useAuth();
  const childName = profile?.childName || "your child";
  const [activeDomain, setActiveDomain] = useState<MilestoneTab>("Movement");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [watchChecked, setWatchChecked] = useState<Record<string, boolean>>({});
  const [watchOpen, setWatchOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<MilestoneDefinition | null>(null);
  const [notice, setNotice] = useState("");

  const currentWindow = useMemo(
    () => getCurrentMilestoneWindow(profile?.ageWindowMonths, profile?.bornEarly, profile?.weeksEarly),
    [profile?.ageWindowMonths, profile?.bornEarly, profile?.weeksEarly]
  );
  const visibleMilestones = useMemo(() => getMilestonesForTab(currentWindow, activeDomain), [activeDomain, currentWindow]);
  const observedThisMonth = Object.values(checked).filter(Boolean).length;
  const activeWatchText = watchText(currentWindow.actEarly, childName);
  const milestoneProgressQuery = useQuery({
    queryKey: ["milestone-progress", "primary-child"],
    queryFn: () => getMilestoneProgress("primary-child"),
    staleTime: 1000 * 30,
    retry: 1
  });
  const watchForItems = useMemo<WatchForProgressItem[]>(() => {
    if (milestoneProgressQuery.data?.watchFor?.length) return milestoneProgressQuery.data.watchFor;
    return currentWindow.actEarly.map((item) => ({
      ...item,
      status: watchChecked[item.actEarlyId] ? "checked" : "unchecked",
      originWindow: currentWindow.ageKey,
      originLabel: currentWindow.label
    }));
  }, [currentWindow, milestoneProgressQuery.data?.watchFor, watchChecked]);

  useEffect(() => {
    const nextChecked: Record<string, boolean> = {};
    milestoneProgressQuery.data?.watchFor?.forEach((item) => {
      nextChecked[item.actEarlyId] = item.status === "checked";
    });
    if (Object.keys(nextChecked).length) setWatchChecked(nextChecked);
  }, [milestoneProgressQuery.data?.watchFor]);

  async function shareMilestone(milestone: MilestoneDefinition) {
    await Share.share({
      message: `${childName}: ${normalizePatriciaText(milestone.text, childName)}. Source: ${getSourceLabel()} milestone checklist.`
    });
  }

  async function addMilestonePhoto(milestone: MilestoneDefinition) {
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
          [milestone.milestoneId]: [...(current[milestone.milestoneId] || []), result.assets[0].uri].slice(0, 5)
        }));
        setNotice(`Photo added to ${normalizePatriciaText(milestone.text, childName).toLowerCase()}.`);
      }
    } catch {
      setNotice("I could not open photos just now. Try again in a moment.");
    }
  }

  async function toggleWatchFor(item: WatchForProgressItem) {
    const nextChecked = !watchChecked[item.actEarlyId];
    setWatchChecked((current) => ({ ...current, [item.actEarlyId]: nextChecked }));
    setNotice(nextChecked ? "Added to your visit discussion list." : "Removed from your visit discussion list.");

    try {
      await recordMilestoneObservation({
        childId: "primary-child",
        milestoneId: item.actEarlyId,
        checked: nextChecked
      });
      milestoneProgressQuery.refetch();
    } catch {
      setNotice(nextChecked ? "Saved here for now. Patricia will sync this when the connection is ready." : "Updated here for now. Patricia will sync this when the connection is ready.");
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
          <ScreenTitle title="Milestones" subtitle={`${childName} - ${currentWindow.label}`} note={`${milestoneLibrary.windows.length} age windows in the Nianza milestone library`} />
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
          {milestoneDomains.map((domain) => (
            <Pressable key={domain} accessibilityRole="tab" accessibilityState={{ selected: activeDomain === domain }} onPress={() => setActiveDomain(domain)}>
              <CategoryChip label={domain} active={activeDomain === domain} />
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden" }}>
          {visibleMilestones.length ? (
            visibleMilestones.map((milestone, index) => {
              const isChecked = Boolean(checked[milestone.milestoneId]);
              const milestonePhotos = photos[milestone.milestoneId] || [];
              const text = normalizePatriciaText(milestone.text, childName);
              return (
                <View key={milestone.milestoneId}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                    onPress={() => {
                      setChecked((current) => ({ ...current, [milestone.milestoneId]: !current[milestone.milestoneId] }));
                      setNotice(isChecked ? "Milestone unchecked." : "Milestone marked as observed.");
                    }}
                    onLongPress={() => setSelectedDetail(milestone)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, backgroundColor: isChecked ? theme.colors.blueLight : "white" }}
                  >
                    <EmptyCircle checked={isChecked} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 20, fontWeight: "600" }}>{text}</Text>
                      <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>{currentWindow.label} - {getSourceLabel()}</Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Open details for ${text}`} onPress={() => setSelectedDetail(milestone)} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
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
                            entityId: milestone.milestoneId,
                            title: "Milestone checked",
                            detail: text,
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
            })
          ) : (
            <View style={{ padding: 18, gap: 8 }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "700" }}>Nothing to track here yet.</Text>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 19 }}>
                Self-care milestones start appearing in later Nianza windows. Patricia will bring them forward when they fit {childName}'s age.
              </Text>
            </View>
          )}
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
          <View style={{ gap: 10 }}>
            <View style={{ borderRadius: 16, backgroundColor: theme.colors.card, padding: 16, borderLeftWidth: 3, borderLeftColor: theme.colors.bluePrimary, gap: 8 }}>
              <View style={{ alignSelf: "flex-end", width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
                <Text selectable={false} style={{ color: "white", fontSize: 13, fontWeight: "800" }}>P</Text>
              </View>
              <Text selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 23, fontStyle: "italic" }}>
                {activeWatchText}
              </Text>
            </View>
            <View style={{ borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden" }}>
              {watchForItems.map((item, index) => {
                const isChecked = Object.prototype.hasOwnProperty.call(watchChecked, item.actEarlyId)
                  ? Boolean(watchChecked[item.actEarlyId])
                  : item.status === "checked";
                const text = normalizePatriciaText(item.text, childName);
                return (
                  <View key={item.actEarlyId}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isChecked }}
                      onPress={() => toggleWatchFor(item)}
                      style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, backgroundColor: isChecked ? "#F4F7F8" : "white" }}
                    >
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          borderWidth: 2,
                          borderColor: isChecked ? theme.colors.blueDeep : theme.colors.border,
                          backgroundColor: isChecked ? theme.colors.blueLight : "white",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 1
                        }}
                      >
                        {isChecked ? <SfIcon name="checkmark" color={theme.colors.blueDeep} size={17} /> : null}
                      </View>
                      <View style={{ flex: 1, gap: 8 }}>
                        <Text selectable style={{ color: theme.colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600" }}>{text}</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                          <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>{item.originLabel || currentWindow.label}</Text>
                          {isChecked ? (
                            <View style={{ borderRadius: 12, backgroundColor: "#ECEFF1", paddingHorizontal: 9, paddingVertical: 4 }}>
                              <Text selectable={false} style={{ color: theme.colors.muted, fontSize: 10, fontWeight: "800" }}>For the visit</Text>
                            </View>
                          ) : null}
                        </View>
                        {isChecked ? (
                          <Pressable
                            onPress={() =>
                              openPatricia({
                                source: "D1-watch-for",
                                eventType: "watch-for-noticed",
                                childName,
                                childId: "primary-child",
                                entityId: item.actEarlyId,
                                title: "Watch-for item noticed",
                                detail: text,
                                occurredAt: new Date().toISOString()
                              })
                            }
                          >
                            <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "800" }}>Tell Patricia</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </Pressable>
                    {index < watchForItems.length - 1 ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
                  </View>
                );
              })}
            </View>
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
                <Text selectable style={{ color: theme.colors.text, fontSize: 21, fontWeight: "800", lineHeight: 26 }}>{normalizePatriciaText(selectedDetail.text, childName)}</Text>
                <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>Usually tracked around: {currentWindow.label}</Text>
              </View>
              <Pressable onPress={() => setSelectedDetail(null)} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                <Text selectable={false} style={{ color: theme.colors.greyIcon, fontSize: 24 }}>x</Text>
              </Pressable>
            </View>
            <Text selectable style={{ color: theme.colors.text, fontSize: 14, lineHeight: 21 }}>{milestoneDescription(selectedDetail, childName)}</Text>
            <View style={{ borderRadius: 16, backgroundColor: theme.colors.card, padding: 15, borderLeftWidth: 3, borderLeftColor: theme.colors.bluePrimary }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 23, fontStyle: "italic" }}>{patriciaMilestoneNote(selectedDetail, childName)}</Text>
            </View>
            <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700" }}>How to encourage this</Text>
            {encouragementFor(selectedDetail).map((tip) => (
              <Text key={tip} selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>- {tip}</Text>
            ))}
            <Pressable
              onPress={() => {
                setChecked((current) => ({ ...current, [selectedDetail.milestoneId]: true }));
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

      <TalkToPatriciaButton source="D1-milestones" eventType="general" detail={`${childName} milestone screen: ${currentWindow.label}, ${activeDomain}`} />
    </View>
  );
}
