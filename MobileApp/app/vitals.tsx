import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/auth/auth-context";
import { ScreenTitle, SectionLabel, SfIcon, SpecCard } from "@/components/screen-spec";
import { openPatricia } from "@/components/talk-to-patricia-button";
import { theme } from "@/theme/theme";

export default function VitalsScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const childName = profile?.childName || "your child";
  const encounterName = "Low fever and extra cuddles";

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 6 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to previous screen"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          style={{ alignSelf: "flex-start", minWidth: 44, minHeight: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}
        >
          <SfIcon name="chevron.left" color={theme.colors.text} size={24} />
        </Pressable>
      </View>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 32 + insets.bottom, gap: 18 }} style={{ backgroundColor: theme.colors.background }}>
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
              openPatricia({
                  source: "F2-active-sick-encounter",
                  eventType: "sick-encounter-active",
                  childName,
                  childId: "primary-child",
                  entityId: "active-sick-encounter",
                  title: "Active sick encounter",
                  detail: encounterName,
                  occurredAt: new Date().toISOString()
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
    </View>
  );
}
