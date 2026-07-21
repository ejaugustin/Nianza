import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Pill, ScreenTitle, SectionLabel, SfIcon, SpecCard } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

const reports = [
  {
    title: "Monthly Progress Report",
    subtitle: "Milestones, vaccines, and vitals for this month",
    action: "Generate"
  },
  {
    title: "Doctor Visit Pack",
    subtitle: "Questions and records for your next visit",
    action: "Prepare pack"
  }
];

export default function ReportsScreen() {
  const [activeReport, setActiveReport] = useState<string | null>(null);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 32, gap: 16 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <ScreenTitle title="Reports" subtitle="Generated for Sofia" />

      {reports.map((report) => (
        <SpecCard key={report.title} style={{ minHeight: 110, gap: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <SfIcon name="doc.text" size={28} />
            <Pressable onPress={() => setActiveReport(activeReport === report.title ? null : report.title)}>
              <Pill label={report.action} />
            </Pressable>
          </View>
          <View style={{ gap: 7 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "600" }}>{report.title}</Text>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 16 }}>{report.subtitle}</Text>
          </View>
          {activeReport === report.title ? (
            <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 12, gap: 8 }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 13, fontWeight: "700" }}>Options</Text>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
                {report.title === "Doctor Visit Pack"
                  ? "Include recent milestones, vaccine questions, and parent notes for the next pediatric visit."
                  : "Include this month's milestone progress, upcoming vaccines, and parent-recorded vitals."}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pill label="PDF" />
                <Pill label="Email copy" />
              </View>
            </View>
          ) : null}
        </SpecCard>
      ))}

      <SectionLabel>PAST REPORTS</SectionLabel>
    </ScrollView>
  );
}
