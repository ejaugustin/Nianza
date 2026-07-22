import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listVitals, type VitalsEntry } from "@/api/vitals";
import { useAuth } from "@/auth/auth-context";
import { ScreenTitle, SectionLabel, SfIcon, SpecCard } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

type GrowthKind = "weight" | "height" | "head_circumference";

const tabs: Array<{ kind: GrowthKind; label: string }> = [
  { kind: "weight", label: "Weight" },
  { kind: "height", label: "Length" },
  { kind: "head_circumference", label: "Head" }
];

function BackButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to Vitals"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/vitals"))}
      style={{ minWidth: 44, minHeight: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}
    >
      <SfIcon name="chevron.left" color={theme.colors.text} size={24} />
    </Pressable>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function GrowthEntryRow({ entry }: { entry: VitalsEntry }) {
  return (
    <SpecCard style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 16, fontWeight: "800" }}>
          {entry.label}
        </Text>
        <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 12 }}>
          {formatDate(entry.recordedAt)}
        </Text>
      </View>
      <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
        Percentile lookup waits for verified growth references.
      </Text>
    </SpecCard>
  );
}

export default function GrowthScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const childName = profile?.childName || "your child";
  const [activeKind, setActiveKind] = useState<GrowthKind>("weight");
  const vitalsQuery = useQuery({
    queryKey: ["vitals", "primary-child"],
    queryFn: () => listVitals("primary-child"),
    retry: 1
  });

  const growthEntries = useMemo(() => {
    const entries = vitalsQuery.data?.entries || [];
    return entries.filter((entry) => entry.entryType === activeKind);
  }, [activeKind, vitalsQuery.data?.entries]);
  const latest = growthEntries[0];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 6 }}>
        <BackButton />
      </View>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 32 + insets.bottom, gap: 18 }}>
        <ScreenTitle
          title="Growth"
          subtitle={`${childName}'s measurements`}
          note="Growth entries are for organizing measurements and preparing questions for care visits."
        />

        <View style={{ flexDirection: "row", gap: 8 }}>
          {tabs.map((tab) => {
            const active = activeKind === tab.kind;
            return (
              <Pressable
                key={tab.kind}
                onPress={() => setActiveKind(tab.kind)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? theme.colors.bluePrimary : "white",
                  borderWidth: 1.5,
                  borderColor: active ? theme.colors.bluePrimary : theme.colors.border
                }}
              >
                <Text selectable style={{ color: active ? "white" : theme.colors.text, fontSize: 12, fontWeight: "800" }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <SpecCard style={{ minHeight: 180, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 16, fontWeight: "800" }}>
                {tabs.find((tab) => tab.kind === activeKind)?.label}
              </Text>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
                {latest ? `Latest entry: ${latest.label} on ${formatDate(latest.recordedAt)}.` : "No entries yet."}
              </Text>
            </View>
            <SfIcon name="doc.text" color={theme.colors.bluePrimary} size={28} />
          </View>
          <View style={{ minHeight: 86, borderRadius: 18, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: 16 }}>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" }}>
              Chart bands will appear after the growth reference tables are clinically verified. Your entries are still saved.
            </Text>
          </View>
        </SpecCard>

        <SectionLabel>MEASUREMENTS</SectionLabel>
        {vitalsQuery.isLoading ? (
          <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>Loading growth entries...</Text>
        ) : growthEntries.length ? (
          growthEntries.map((entry) => <GrowthEntryRow key={entry.entryId} entry={entry} />)
        ) : (
          <SpecCard>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 18 }}>
              Add a measurement from Vitals to start this timeline.
            </Text>
          </SpecCard>
        )}
      </ScrollView>
    </View>
  );
}
