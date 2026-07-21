import { ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getDailyNote } from "@/api/content";
import { PatriciaNote } from "@/components/patricia-note";
import { mockHome } from "@/content/mock-home";
import { theme } from "@/theme/theme";

export default function HomeScreen() {
  const dailyNoteQuery = useQuery({
    queryKey: ["daily-note", mockHome.language, mockHome.ageWindowMonths, mockHome.dailyNoteDomain],
    queryFn: () =>
      getDailyNote({
        language: mockHome.language,
        ageWindowMonths: mockHome.ageWindowMonths,
        domain: mockHome.dailyNoteDomain
      }),
    staleTime: 1000 * 60 * 30,
    retry: 1
  });
  const dailyNote = dailyNoteQuery.data?.bodyText || mockHome.dailyNote;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingTop: 28, gap: 16 }} style={{ backgroundColor: theme.colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 22, height: 22, borderRadius: 12, backgroundColor: theme.colors.blueDeep }} />
        <Text selectable style={{ color: theme.colors.blueDeep, fontSize: 18, fontWeight: "700", letterSpacing: 0.5 }}>Nianza</Text>
      </View>

      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 14 }}>Good morning, {mockHome.parentName}.</Text>
        <Text selectable style={{ color: theme.colors.text, fontSize: 22, fontWeight: "700" }}>{mockHome.childName} · {mockHome.childAge}</Text>
      </View>

      <PatriciaNote>{dailyNote}</PatriciaNote>
      {dailyNoteQuery.isError ? <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>Showing Patricia's saved note.</Text> : null}
      <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>{mockHome.dateLabel}</Text>

      <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11, letterSpacing: 1, marginTop: 10 }}>THIS WEEK</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {["Milestones\n2 this month", "Vaccines\nNext: DTaP", "Vitals\nJul 12"].map((label) => {
          const [title, subtitle] = label.split("\n");
          return (
            <View key={title} style={{ flex: 1, backgroundColor: "white", borderRadius: theme.radii.card, padding: 14, gap: 8, minHeight: 88, boxShadow: "0 2px 8px rgba(20, 40, 50, 0.08)" }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 12, fontWeight: "700" }}>{title}</Text>
              <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>{subtitle}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
