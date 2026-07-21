import { ScrollView, Text, View } from "react-native";
import { CategoryChip, EmptyCircle, ScreenTitle, SectionLabel, SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

const milestones = [
  "Rolls over front to back",
  "Pushes up on arms during tummy time",
  "Brings hands to mouth"
];

export default function MilestonesScreen() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 32, gap: 24 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <ScreenTitle title="Milestones" subtitle="Sofia - 4-6 Months" />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <CategoryChip label="Movement" active />
        <CategoryChip label="Language" />
        <CategoryChip label="Social" />
        <CategoryChip label="Cognitive" />
      </View>

      <View>
        {milestones.map((milestone, index) => (
          <View key={milestone}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 9 }}>
              <EmptyCircle />
              <Text selectable style={{ flex: 1, color: theme.colors.text, fontSize: 14, lineHeight: 20 }}>{milestone}</Text>
            </View>
            {index < milestones.length - 1 ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12 }}>
        <SectionLabel>THINGS TO WATCH FOR</SectionLabel>
        <SfIcon name="chevron.down" color={theme.colors.greyIcon} size={20} />
      </View>
    </ScrollView>
  );
}
