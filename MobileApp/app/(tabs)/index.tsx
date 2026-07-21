import { ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getDailyNote } from "@/api/content";
import { PatriciaNote } from "@/components/patricia-note";
import { SectionLabel, SfIcon, SpecCard } from "@/components/screen-spec";
import { mockHome } from "@/content/mock-home";
import { theme } from "@/theme/theme";

const weeklyCards = [
  { title: "Milestones", subtitle: "2 this month", icon: "checkmark" },
  { title: "Vaccines", subtitle: "Next: DTaP", icon: "shield" },
  { title: "Vitals", subtitle: "Jul 12", icon: "doc.text" }
];

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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 28, paddingBottom: 32, gap: 16 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 22, height: 22, borderRadius: 12, backgroundColor: theme.colors.blueDeep }} />
          <Text selectable style={{ color: theme.colors.blueDeep, fontSize: 18, fontWeight: "700", letterSpacing: 0.5 }}>Nianza</Text>
        </View>
        <SfIcon name="bell" color={theme.colors.muted} size={22} />
      </View>

      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 14 }}>Good morning, {mockHome.parentName}.</Text>
        <Text selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={{ color: theme.colors.text, fontSize: 22, fontWeight: "700" }}>
          {mockHome.childName} - {mockHome.childAge}
        </Text>
      </View>

      <PatriciaNote>{dailyNote}</PatriciaNote>
      {dailyNoteQuery.isError ? <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>Showing Patricia's saved note.</Text> : null}
      <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>{mockHome.dateLabel}</Text>

      <SectionLabel>THIS WEEK</SectionLabel>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {weeklyCards.map((card) => (
          <SpecCard key={card.title} style={{ flex: 1, minHeight: 88, padding: 14, gap: 8 }}>
            <SfIcon name={card.icon} size={22} />
            <Text selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: theme.colors.text, fontSize: 12, fontWeight: "600" }}>{card.title}</Text>
            <Text selectable numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: theme.colors.greyIcon, fontSize: 11 }}>{card.subtitle}</Text>
          </SpecCard>
        ))}
      </View>

      <SectionLabel>UPCOMING</SectionLabel>
      <SpecCard style={{ minHeight: 60, padding: 0, overflow: "hidden" }}>
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: 4, backgroundColor: theme.colors.bluePrimary }} />
          <View style={{ padding: 16, gap: 6, flex: 1 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 13, fontWeight: "600" }}>DTaP vaccine</Text>
            <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 12 }}>Due around 6 months</Text>
          </View>
        </View>
      </SpecCard>
    </ScrollView>
  );
}
