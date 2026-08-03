import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ApiError } from "@/api/client";
import { createMobileReport, listMobileReports, periodTagLabel, type MobileReport, type ReportPeriod } from "@/api/reports";
import { listWeeklyLetters } from "@/api/weekly-letters";
import { useAuth } from "@/auth/auth-context";
import { Pill, ScreenTitle, SectionLabel, SfIcon, SpecCard } from "@/components/screen-spec";
import { TalkToPatriciaButton } from "@/components/talk-to-patricia-button";
import { theme } from "@/theme/theme";

const PERIOD_PILLS: Array<{ period: ReportPeriod; label: string }> = [
  { period: "month", label: "This month" },
  { period: "halfyear", label: "Last 6 months" },
  { period: "year", label: "Past year" }
];

function formatDateRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
  return `${formatter.format(new Date(startDate))} - ${formatter.format(new Date(endDate))}`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

// report.period is missing on some older/legacy report records, which would
// silently default to "month" -- reportType is the one field that's always
// set correctly at creation, so it's the reliable signal for both which
// bucket a report belongs in and what tag to show on it.
function isVisitPack(report: MobileReport) {
  return report.reportType === "visit-pack";
}

function reportPeriodTag(report: MobileReport) {
  if (isVisitPack(report)) return "Visit Pack";
  return periodTagLabel(report.period || "month");
}

// A single row in a category's past-reports list. Kept separate from the
// header card so tapping a row goes straight to that report while tapping
// the header just expands/collapses the whole category.
function PastReportRow({ report, onOpen, onShare }: { report: MobileReport; onOpen: () => void; onShare: () => void }) {
  return (
    <Pressable onPress={() => report.status === "ready" && onOpen()}>
      <SpecCard style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pill label={reportPeriodTag(report)} />
            </View>
            <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "700" }}>{report.title}</Text>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
              {report.periodLabel} - {formatShortDate(report.generatedAt)}
            </Text>
          </View>
          <Pill label={report.status === "ready" ? "Ready" : report.status} />
        </View>
        {report.status === "ready" ? (
          <View style={{ flexDirection: "row" }}>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onShare();
              }}
            >
              <Pill label="Share" />
            </Pressable>
          </View>
        ) : (
          <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
            This report is still being put together.
          </Text>
        )}
      </SpecCard>
    </Pressable>
  );
}

export default function ReportsScreen() {
  const { profile, activeChildId } = useAuth();
  const queryClient = useQueryClient();
  const [progressOpen, setProgressOpen] = useState(false);
  const [visitPackOpen, setVisitPackOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("month");
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [reportNoticeLocked, setReportNoticeLocked] = useState(false);
  const [weeklyLettersOpen, setWeeklyLettersOpen] = useState(false);
  const childName = profile?.childName || "your child";
  const parentFirstName = profile?.parentFirstName || profile?.parentName?.split(/\s+/)[0] || "there";
  const childId = activeChildId || "primary-child";
  const lettersQuery = useQuery({
    queryKey: ["weekly-letters", childId],
    queryFn: () => listWeeklyLetters(childId)
  });
  const mobileReportsQuery = useQuery({
    queryKey: ["mobile-reports", childId],
    queryFn: () => listMobileReports(childId)
  });

  // The rendered report -- and therefore the image capture used for Share --
  // only exists on the report/[reportId] screen, so both View and Share route
  // there. We prime the query cache first so the view opens instantly from
  // what we already have instead of refetching, matching Addendum A v2's
  // "re-opens the same rendered view from cache" behavior. Share adds
  // autoShare=1 so that screen triggers the capture-and-share flow itself
  // once the content has actually rendered.
  function openReport(report: MobileReport, options?: { autoShare?: boolean }) {
    queryClient.setQueryData(["mobile-report", childId, report.reportId], report);
    router.push({
      pathname: "/report/[reportId]",
      params: options?.autoShare ? { reportId: report.reportId, autoShare: "1" } : { reportId: report.reportId }
    });
  }

  const progressMutation = useMutation({
    mutationFn: (period: ReportPeriod) => createMobileReport(childId, "monthly", { period }, profile?.parentFirstName || profile?.parentName?.split(/\s+/)[0]),
    onSuccess: (report) => {
      setReportNoticeLocked(false);
      setReportNotice(`${report.title} is ready. Tap View to see it or Share to send it.`);
      queryClient.invalidateQueries({ queryKey: ["mobile-reports", childId] });
    },
    onError: (err) => {
      setReportNoticeLocked(err instanceof ApiError && err.code === "SUBSCRIPTION_REQUIRED");
      setReportNotice(err instanceof Error ? err.message : "I could not create that report yet.");
    }
  });

  const visitPackMutation = useMutation({
    mutationFn: () => createMobileReport(childId, "visit-pack", {}, profile?.parentFirstName || profile?.parentName?.split(/\s+/)[0]),
    onSuccess: (report) => {
      setReportNoticeLocked(false);
      setReportNotice(`${report.title} is ready. Tap View to see it or Share to send it.`);
      queryClient.invalidateQueries({ queryKey: ["mobile-reports", childId] });
    },
    onError: (err) => {
      setReportNoticeLocked(err instanceof ApiError && err.code === "SUBSCRIPTION_REQUIRED");
      setReportNotice(err instanceof Error ? err.message : "I could not create that report yet.");
    }
  });

  const weeklyLetters = lettersQuery.data || [];
  const latestLetter = weeklyLetters[0];
  const generatedReports = mobileReportsQuery.data || [];

  // Two report families, kept fully separate everywhere on this screen --
  // Progress Reports (monthly/6-month/yearly, all one continuum of the same
  // report type) and Doctor Visit Packs (a different document entirely).
  // Grouping past reports the same way avoids the confusing look of a visit
  // pack sitting "inside" a monthly report card.
  const progressReports = generatedReports.filter((report) => !isVisitPack(report));
  const visitPackReports = generatedReports.filter((report) => isVisitPack(report));
  const latestProgressReport = progressReports[0];
  const latestVisitPackReport = visitPackReports[0];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 32, gap: 16 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <ScreenTitle title="Reports" subtitle={`Generated for ${childName}`} />
      {reportNotice ? (
        <View style={{ borderWidth: 1, borderColor: theme.colors.bluePrimary, backgroundColor: theme.colors.blueLight, borderRadius: 18, padding: 14, gap: 10 }}>
          <Text selectable style={{ color: theme.colors.blueDeep, fontSize: 13, fontWeight: "700", lineHeight: 18 }}>
            {reportNotice}
          </Text>
          {reportNoticeLocked ? (
            <Pressable
              onPress={() => router.push("/plan-picker")}
              style={{ alignSelf: "flex-start", minHeight: 36, borderRadius: 18, backgroundColor: theme.colors.bluePrimary, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }}
            >
              <Text selectable={false} style={{ color: "white", fontSize: 13, fontWeight: "800" }}>See plans</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

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

      {/* PROGRESS REPORTS -- one collapsible category. Collapsed shows a
          one-line summary; expanded reveals the generate controls plus every
          past monthly/6-month/yearly report, all in one bounded block. */}
      <Pressable onPress={() => setProgressOpen((open) => !open)}>
        <SpecCard style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 7 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <SfIcon name="doc.text" color={theme.colors.bluePrimary} size={24} />
                <Text selectable style={{ color: theme.colors.text, fontSize: 16, fontWeight: "800" }}>
                  Progress Reports
                </Text>
              </View>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
                {progressReports.length
                  ? `${progressReports.length} report${progressReports.length === 1 ? "" : "s"} - latest ${formatShortDate(latestProgressReport.generatedAt)}.`
                  : "Monthly, 6-month, or yearly - milestones, vaccines, and vitals."}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 10 }}>
              <Pill label={progressOpen ? "Hide" : "Open"} />
              <SfIcon name={progressOpen ? "chevron.down" : "chevron.right"} color={theme.colors.greyIcon} size={18} />
            </View>
          </View>
        </SpecCard>
      </Pressable>

      {progressOpen ? (
        <View style={{ gap: 10 }}>
          <SpecCard style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 12, fontWeight: "700" }}>Generate a new report</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {PERIOD_PILLS.map((option) => (
                <Pressable key={option.period} onPress={() => setSelectedPeriod(option.period)}>
                  <Pill label={option.label} tone={selectedPeriod === option.period ? "blue" : "terracotta"} />
                </Pressable>
              ))}
            </View>
            <Pressable
              disabled={progressMutation.isPending}
              onPress={() => progressMutation.mutate(selectedPeriod)}
              style={{ minHeight: 48, borderRadius: 14, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", opacity: progressMutation.isPending ? 0.6 : 1 }}
            >
              <Text selectable={false} style={{ color: "white", fontSize: 14, fontWeight: "800" }}>
                {progressMutation.isPending ? "Generating..." : "Generate report"}
              </Text>
            </Pressable>
            {progressMutation.data ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={() => progressMutation.data && openReport(progressMutation.data)}>
                  <Pill label="View" />
                </Pressable>
                <Pressable onPress={() => progressMutation.data && openReport(progressMutation.data, { autoShare: true })}>
                  <Pill label="Share" />
                </Pressable>
              </View>
            ) : null}
          </SpecCard>

          {progressReports.length ? (
            <>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
                PAST PROGRESS REPORTS
              </Text>
              {progressReports.map((report) => (
                <PastReportRow
                  key={report.reportId}
                  report={report}
                  onOpen={() => openReport(report)}
                  onShare={() => openReport(report, { autoShare: true })}
                />
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      {/* A visible divider between the two report families -- addresses the
          look of one category sitting "inside" the other. */}
      <View style={{ height: 1, backgroundColor: theme.colors.border }} />

      {/* DOCTOR VISIT PACK -- its own fully separate collapsible category. */}
      <Pressable onPress={() => setVisitPackOpen((open) => !open)}>
        <SpecCard style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 7 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <SfIcon name="doc.text" color={theme.colors.bluePrimary} size={24} />
                <Text selectable style={{ color: theme.colors.text, fontSize: 16, fontWeight: "800" }}>
                  Doctor Visit Pack
                </Text>
              </View>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
                {visitPackReports.length
                  ? `${visitPackReports.length} pack${visitPackReports.length === 1 ? "" : "s"} - latest ${formatShortDate(latestVisitPackReport.generatedAt)}.`
                  : "Questions and records for your next visit."}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 10 }}>
              <Pill label={visitPackOpen ? "Hide" : "Open"} />
              <SfIcon name={visitPackOpen ? "chevron.down" : "chevron.right"} color={theme.colors.greyIcon} size={18} />
            </View>
          </View>
        </SpecCard>
      </Pressable>

      {visitPackOpen ? (
        <View style={{ gap: 10 }}>
          <SpecCard style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 12, fontWeight: "700" }}>Prepare a new pack</Text>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
              {visitPackMutation.data
                ? `Covering everything since your ${visitPackMutation.data.periodLabel.toLowerCase()}.`
                : "Covers everything logged since your last visit (or the last 90 days, if none is on file)."}
            </Text>
            <Pressable
              disabled={visitPackMutation.isPending}
              onPress={() => visitPackMutation.mutate()}
              style={{ minHeight: 48, borderRadius: 14, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", opacity: visitPackMutation.isPending ? 0.6 : 1 }}
            >
              <Text selectable={false} style={{ color: "white", fontSize: 14, fontWeight: "800" }}>
                {visitPackMutation.isPending ? "Preparing..." : "Prepare pack"}
              </Text>
            </Pressable>
            {visitPackMutation.data ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={() => visitPackMutation.data && openReport(visitPackMutation.data)}>
                  <Pill label="View" />
                </Pressable>
                <Pressable onPress={() => visitPackMutation.data && openReport(visitPackMutation.data, { autoShare: true })}>
                  <Pill label="Share" />
                </Pressable>
              </View>
            ) : null}
          </SpecCard>

          {visitPackReports.length ? (
            <>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
                PAST VISIT PACKS
              </Text>
              {visitPackReports.map((report) => (
                <PastReportRow
                  key={report.reportId}
                  report={report}
                  onOpen={() => openReport(report)}
                  onShare={() => openReport(report, { autoShare: true })}
                />
              ))}
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
    <TalkToPatriciaButton source="H1-reports" eventType="reports" detail="Reports screen visible" entityId="reports" />
    </View>
  );
}
