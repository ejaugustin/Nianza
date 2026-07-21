import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { listWeeklyLetters } from "@/api/weekly-letters";
import { useAuth } from "@/auth/auth-context";
import { Pill, ScreenTitle, SectionLabel, SfIcon, SpecCard } from "@/components/screen-spec";
import { TalkToPatriciaButton } from "@/components/talk-to-patricia-button";
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

function formatDateRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
  return `${formatter.format(new Date(startDate))} - ${formatter.format(new Date(endDate))}`;
}

export default function ReportsScreen() {
  const { profile } = useAuth();
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [weeklyLettersOpen, setWeeklyLettersOpen] = useState(false);
  const childName = profile?.childName || "your child";
  const parentFirstName = profile?.parentFirstName || profile?.parentName?.split(/\s+/)[0] || "there";
  const lettersQuery = useQuery({
    queryKey: ["weekly-letters", "primary-child", childName, parentFirstName],
    queryFn: () => listWeeklyLetters("primary-child", { childName, parentFirstName })
  });
  const weeklyLetters = lettersQuery.data || [];
  const latestLetter = weeklyLetters[0];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 32, gap: 16 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <ScreenTitle title="Reports" subtitle={`Generated for ${childName}`} />

      <SectionLabel>WEEKLY LETTERS</SectionLabel>
      <Pressable onPress={() => setWeeklyLettersOpen((open) => !open)}>
        <SpecCard style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 7 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <SfIcon name="doc.text" color={theme.colors.bluePrimary} size={24} />
                <Text selectable style={{ color: theme.colors.text, fontSize: 16, fontWeight: "800" }}>
                  Patricia's weekly letters
                </Text>
              </View>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
                {lettersQuery.isLoading
                  ? "Loading the archive..."
                  : latestLetter
                    ? `${weeklyLetters.length} letters archived. Latest: ${latestLetter.title}.`
                    : "Patricia's weekly emails will collect here by date."}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 10 }}>
              <Pill label={weeklyLettersOpen ? "Hide" : "Open archive"} />
              <SfIcon name={weeklyLettersOpen ? "chevron.down" : "chevron.right"} color={theme.colors.greyIcon} size={18} />
            </View>
          </View>
          {latestLetter && !weeklyLettersOpen ? (
            <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 12, gap: 6 }}>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 11, fontWeight: "700" }}>
                LATEST LETTER - {formatDateRange(latestLetter.weekStartDate, latestLetter.weekEndDate)}
              </Text>
              <Text selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>
                {latestLetter.preview}
              </Text>
            </View>
          ) : null}
        </SpecCard>
      </Pressable>

      {weeklyLettersOpen
        ? weeklyLetters.map((letter) => (
            <Link
              key={letter.letterId}
              href={{ pathname: "/weekly-letter/[letterId]", params: { letterId: letter.letterId } }}
              asChild
            >
              <Pressable>
                <SpecCard style={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {!letter.readAt ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.bluePrimary }} /> : null}
                        <Text selectable style={{ color: theme.colors.muted, fontSize: 11, fontWeight: "700" }}>
                          {formatDateRange(letter.weekStartDate, letter.weekEndDate)}
                        </Text>
                      </View>
                      <Text selectable style={{ color: theme.colors.text, fontSize: 16, fontWeight: "700", lineHeight: 21 }}>
                        {letter.title}
                      </Text>
                      <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
                        {letter.preview}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 10 }}>
                      <Pill label={letter.themeLabel} />
                      <SfIcon name="chevron.right" color={theme.colors.greyIcon} size={18} />
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <SfIcon name="speaker.wave.2.fill" color={theme.colors.bluePrimary} size={18} />
                    <Text selectable style={{ color: theme.colors.blueDeep, fontSize: 12, fontWeight: "700" }}>
                      Opens with Patricia's voice
                    </Text>
                  </View>
                </SpecCard>
              </Pressable>
            </Link>
          ))
        : null}

      <SectionLabel>GENERATED REPORTS</SectionLabel>

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
    <TalkToPatriciaButton source="H1-reports" eventType="reports" detail="Reports screen visible" entityId="reports" />
    </View>
  );
}
