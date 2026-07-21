import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { ScreenTitle, SectionLabel, SpecCard } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

export default function VitalsScreen() {
  const { profile } = useAuth();
  const childName = profile?.childName || "Sofia";
  const encounterName = "Low fever and extra cuddles";

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 32, gap: 18 }} style={{ backgroundColor: theme.colors.background }}>
      <ScreenTitle title="Vitals" subtitle={`${childName}'s parent-recorded notes`} note="Nianza helps you organize what you observed. It does not diagnose or replace medical care." />

      <View style={{ borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.terracotta, backgroundColor: theme.colors.terracottaLight, padding: 14, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.terracotta }} />
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700" }}>{encounterName}</Text>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 12 }}>New entries are added to this encounter</Text>
          </View>
          <Text selectable style={{ color: theme.colors.terracotta, fontSize: 12, fontWeight: "700" }}>End</Text>
        </View>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(tabs)/chat",
              params: {
                sourceScreen: "F2",
                eventType: "sick-encounter-active",
                childName,
                detail: encounterName,
                occurredAt: new Date().toISOString()
              }
            })
          }
        >
          <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "700" }}>Ask Patricia about it</Text>
        </Pressable>
      </View>

      <SectionLabel>RECENT ENTRIES</SectionLabel>
      <SpecCard style={{ gap: 8 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "700" }}>Temperature</Text>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>99.8 F - Jul 12, bedtime</Text>
      </SpecCard>
      <SpecCard style={{ gap: 8 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "700" }}>Feeding</Text>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>Fed a little less than usual, still making wet diapers.</Text>
      </SpecCard>
    </ScrollView>
  );
}
