import { ScrollView, Text } from "react-native";
import { theme } from "@/theme/theme";

export default function ReportsScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingTop: 28, gap: 16 }} style={{ backgroundColor: theme.colors.background }}>
      <Text selectable style={{ color: theme.colors.text, fontSize: 24, fontWeight: "700" }}>Reports</Text>
      <Text selectable style={{ color: theme.colors.muted, fontSize: 15 }}>Foundation screen. Implementation will follow the Nianza v3 SVG and API contracts.</Text>
    </ScrollView>
  );
}
