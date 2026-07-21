import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { CategoryChip, EmptyCircle, ScreenTitle, SectionLabel, SfIcon } from "@/components/screen-spec";
import { TalkToPatriciaButton, openPatricia } from "@/components/talk-to-patricia-button";
import { theme } from "@/theme/theme";

const milestones = [
  "Rolls over front to back",
  "Pushes up on arms during tummy time",
  "Brings hands to mouth"
];

export default function MilestonesScreen() {
  const { profile } = useAuth();
  const childName = profile?.childName || "Sofia";
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState("");

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 32, gap: 24 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <ScreenTitle title="Milestones" subtitle={`${childName} - 4-6 Months`} />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <CategoryChip label="Movement" active />
        <CategoryChip label="Language" />
        <CategoryChip label="Social" />
        <CategoryChip label="Cognitive" />
      </View>

      <View>
        {milestones.map((milestone, index) => (
          <View key={milestone}>
            <Pressable
              onPress={() => {
                setChecked((current) => ({ ...current, [milestone]: !current[milestone] }));
                setNotice("");
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 9 }}
            >
              <EmptyCircle checked={checked[milestone]} />
              <Text selectable style={{ flex: 1, color: theme.colors.text, fontSize: 14, lineHeight: 20 }}>{milestone}</Text>
            </Pressable>
            {checked[milestone] ? (
              <View style={{ paddingLeft: 44, paddingBottom: 10, gap: 8 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable onPress={() => setNotice("A share card is ready for this milestone.")} style={{ borderRadius: 14, backgroundColor: theme.colors.blueLight, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Text selectable style={{ color: theme.colors.blueDeep, fontSize: 12, fontWeight: "700" }}>Share</Text>
                  </Pressable>
                  <Pressable onPress={() => setNotice("Photo attachment will open the camera/gallery next.")} style={{ borderRadius: 14, backgroundColor: theme.colors.terracottaLight, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Text selectable style={{ color: theme.colors.terracotta, fontSize: 12, fontWeight: "700" }}>Add photo</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() =>
                    openPatricia({
                        source: "D2-milestone-checked",
                        eventType: "milestone-checked",
                        childName,
                        childId: "primary-child",
                        entityId: `movement-${index}`,
                        title: "Milestone checked",
                        detail: milestone,
                        occurredAt: new Date().toISOString()
                    })
                  }
                >
                  <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "700" }}>Tell Patricia</Text>
                </Pressable>
              </View>
            ) : null}
            {index < milestones.length - 1 ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
          </View>
        ))}
      </View>
      {notice ? <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>{notice}</Text> : null}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12 }}>
        <SectionLabel>THINGS TO WATCH FOR</SectionLabel>
        <SfIcon name="chevron.down" color={theme.colors.greyIcon} size={20} />
      </View>
    </ScrollView>
    <TalkToPatriciaButton source="D1-milestones" eventType="general" detail={`${childName} milestone screen`} />
    </View>
  );
}
