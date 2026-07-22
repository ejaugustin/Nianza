import { ScrollView, Text, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { EmptyCircle, Pill, ScreenTitle, SectionLabel } from "@/components/screen-spec";
import { TalkToPatriciaButton } from "@/components/talk-to-patricia-button";
import { theme } from "@/theme/theme";

const vaccines = [
  { name: "DTaP (Diphtheria, Tetanus, Pertussis)", due: "Due at 2 months", status: "Recorded", checked: true, tone: "blue" as const },
  { name: "RV (Rotavirus)", due: "Due at 2 months", status: "Due", checked: false, tone: "terracotta" as const }
];

export default function VaccinesScreen() {
  const { profile } = useAuth();
  const childName = profile?.childName || "Your child";

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 32, gap: 18 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <ScreenTitle
        title="Vaccines"
        subtitle={`${childName}'s immunization schedule`}
        note={"Parent-recorded information only. Bring your child's official card to all visits."}
      />

      <SectionLabel>2 MONTHS</SectionLabel>
      <View style={{ gap: 22 }}>
        {vaccines.map((vaccine) => (
          <View key={vaccine.name} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <EmptyCircle checked={vaccine.checked} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text selectable numberOfLines={2} style={{ color: theme.colors.text, fontSize: 13, fontWeight: "500", lineHeight: 18 }}>{vaccine.name}</Text>
              <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>{vaccine.due}</Text>
            </View>
            <Pill label={vaccine.status} tone={vaccine.tone} />
          </View>
        ))}
      </View>
    </ScrollView>
    <TalkToPatriciaButton source="E1-vaccines" eventType="vaccines" detail="Vaccine schedule visible" entityId="vaccines-schedule" />
    </View>
  );
}
