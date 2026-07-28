import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import * as Sharing from "expo-sharing";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  getMobileReport,
  periodTagLabel,
  type CaregiverNoteRow,
  type GrowthByType,
  type HealthEventRow,
  type MilestonesByDomain,
  type VaccineListRow
} from "@/api/reports";
import { RequireAuth, useAuth } from "@/auth/auth-context";
import { Pill, SectionLabel, SfIcon, SpecCard } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <SectionLabel>{label}</SectionLabel>
      <SpecCard style={{ gap: 10 }}>{children}</SpecCard>
    </View>
  );
}

function Narrative({ text }: { text: string }) {
  return <Text selectable style={{ color: theme.colors.text, fontSize: 14, lineHeight: 21 }}>{text}</Text>;
}

function GrowthTable({ growth }: { growth: GrowthByType }) {
  const rows = (["weight", "height", "head_circumference"] as const).flatMap((type) =>
    (growth[type] || []).map((entry) => ({ type, ...entry }))
  );
  if (!rows.length) return <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>No growth measurements logged.</Text>;
  return (
    <>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 14, flex: 1, textTransform: "capitalize" }}>{row.type.replace("_", " ")}: {row.value} {row.unit}</Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 11 }}>{formatDate(row.recordedAt)}</Text>
        </View>
      ))}
    </>
  );
}

function MilestonesByDomainList({ byDomain }: { byDomain: MilestonesByDomain }) {
  const domains = Object.keys(byDomain);
  if (!domains.length) return <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>No milestones logged.</Text>;
  return (
    <>
      {domains.map((domain) => (
        <View key={domain} style={{ gap: 6 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 12, fontWeight: "700" }}>{domain}</Text>
          {byDomain[domain].map((m, i) => (
            <Text key={i} selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>- {m.text} ({formatDate(m.observedAt)})</Text>
          ))}
        </View>
      ))}
    </>
  );
}

function HealthEventsList({ events }: { events: HealthEventRow[] }) {
  if (!events.length) return <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>No illness episodes logged.</Text>;
  return (
    <>
      {events.map((e) => (
        <View key={e.encounterId} style={{ gap: 3 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "600" }}>{e.name}</Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 11 }}>
            {formatDate(e.startedAt)}{e.endedAt ? ` - ${formatDate(e.endedAt)}` : " (ongoing)"}{e.peakTemp ? ` - peak temp ${e.peakTemp}` : ""}{e.durationDays ? ` - ${e.durationDays}d` : ""}
          </Text>
        </View>
      ))}
    </>
  );
}

function VaccineList({ doses, emptyText }: { doses: VaccineListRow[]; emptyText: string }) {
  if (!doses.length) return <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>{emptyText}</Text>;
  return (
    <>
      {doses.map((d, i) => (
        <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 14, flex: 1 }}>{d.name}</Text>
          {d.givenOn ? <Text selectable style={{ color: theme.colors.muted, fontSize: 11 }}>{formatDate(d.givenOn)}</Text> : null}
        </View>
      ))}
    </>
  );
}

function NotesList({ notes, emptyText }: { notes: CaregiverNoteRow[]; emptyText: string }) {
  if (!notes.length) return <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>{emptyText}</Text>;
  return (
    <>
      {notes.map((n, i) => (
        <View key={i} style={{ gap: 2 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 14, lineHeight: 20, fontStyle: "italic" }}>"{n.note}"</Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 11 }}>{n.recordedBy || "caregiver"} - {formatDate(n.recordedAt)}</Text>
        </View>
      ))}
    </>
  );
}

export default function ReportViewScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { profile, activeChildId } = useAuth();
  const reportId = firstParam(params.reportId) || "";
  const autoShare = firstParam(params.autoShare) === "1";
  const childId = activeChildId || "primary-child";
  const childName = profile?.childName || "your child";
  const parentFirstName = profile?.parentFirstName || profile?.parentName?.split(/\s+/)[0] || "parent";
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const captureTargetRef = useRef<View>(null);
  const autoSharedRef = useRef(false);

  const reportQuery = useQuery({
    queryKey: ["mobile-report", childId, reportId],
    queryFn: () => getMobileReport(childId, reportId),
    enabled: Boolean(reportId)
  });

  const report = reportQuery.data;

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/reports");
  }

  // Addendum A v2, section 1: sharing exports the rendered view itself as an
  // image (a screenshot capture), not a PDF and not plain text -- the parent
  // sends it through Messages, WhatsApp, email, AirDrop, or saves it to
  // Photos, the same way they'd share any photo on their phone.
  async function shareReport() {
    if (!report || !captureTargetRef.current) return;
    setSharing(true);
    setNotice(null);
    try {
      const uri = await captureRef(captureTargetRef, { format: "png", quality: 0.92, result: "tmpfile" });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: report.title, UTI: "public.png" });
      } else {
        await Share.share({ url: uri, title: report.title });
      }
    } catch {
      setNotice("I could not create the share image just now. Try again in a moment.");
    } finally {
      setSharing(false);
    }
  }

  // Reached via the H1 Share pill, which can't capture anything itself since
  // the rendered report only exists on this screen. Wait a beat after the
  // content mounts so layout has actually settled before we try to capture
  // it -- captureRef on the very first frame can grab a blank/partial view.
  useEffect(() => {
    if (!autoShare || !report || autoSharedRef.current) return;
    autoSharedRef.current = true;
    const timer = setTimeout(() => {
      shareReport();
    }, 400);
    return () => clearTimeout(timer);
  }, [autoShare, report]);

  return (
    <RequireAuth>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View
          style={{
            height: insets.top + 66,
            paddingTop: insets.top,
            backgroundColor: "white",
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20
          }}
        >
          <Pressable onPress={goBack} style={{ minWidth: 44, minHeight: 44, alignItems: "flex-start", justifyContent: "center" }}>
            <SfIcon name="chevron.left" color={theme.colors.text} size={22} />
          </Pressable>
          <Text selectable numberOfLines={1} style={{ flex: 1, textAlign: "center", marginHorizontal: 8, color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>
            {report ? `${report.title} - ${childName}` : "Report"}
          </Text>
          <Pressable
            onPress={shareReport}
            disabled={!report || sharing}
            style={{ minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center", opacity: report && !sharing ? 1 : 0.35 }}
          >
            <SfIcon name="square.and.arrow.up" color={theme.colors.bluePrimary} size={22} />
          </Pressable>
        </View>

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 20, paddingTop: 24, paddingBottom: insets.bottom + 34, gap: 16 }}
          style={{ backgroundColor: theme.colors.background }}
        >
          {reportQuery.isLoading ? <Text selectable style={{ color: theme.colors.muted, fontSize: 14 }}>Opening the report...</Text> : null}

          {reportQuery.isError ? (
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: theme.colors.error, backgroundColor: "#FDEBEC", padding: 16 }}>
              <Text selectable style={{ color: theme.colors.error, fontSize: 14, fontWeight: "700" }}>This report could not be opened.</Text>
            </View>
          ) : null}

          {report ? (
            <>
              {/* Everything inside this View is what gets captured for Share -- the
                  nav bar and the disclaimer/Share row below stay out of the image.
                  collapsable={false} keeps Android from flattening it out of the
                  native view tree, which would make captureRef find nothing. */}
              <View ref={captureTargetRef} collapsable={false} style={{ gap: 16, backgroundColor: theme.colors.background }}>
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Pill label={periodTagLabel(report.period)} />
                  {report.isFallbackWindow ? <Pill label="90-day fallback" tone="terracotta" /> : null}
                </View>
                <Text selectable style={{ color: theme.colors.text, fontSize: 26, fontWeight: "900", lineHeight: 32 }}>{report.title}</Text>
                <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>
                  {childName} - {report.periodLabel} - generated {formatDate(report.generatedAt)}
                </Text>
              </View>

              {report.sections.month ? (
                <>
                  <Card label="MONTH AT A GLANCE"><Narrative text={report.sections.month.monthAtAGlance} /></Card>
                  <Card label="MILESTONES">
                    <MilestonesByDomainList
                      byDomain={report.sections.month.milestones.reduce<Record<string, typeof report.sections.month.milestones>>((acc, m) => {
                        const key = m.domain || "General";
                        acc[key] = [...(acc[key] || []), m];
                        return acc;
                      }, {})}
                    />
                  </Card>
                  <Card label="GROWTH & VITALS"><GrowthTable growth={report.sections.month.growth} /></Card>
                  <Card label="HEALTH EVENTS"><HealthEventsList events={report.sections.month.healthEvents} /></Card>
                  <Card label="VACCINES">
                    <Text selectable style={{ color: theme.colors.text, fontSize: 12, fontWeight: "700" }}>Given</Text>
                    <VaccineList doses={report.sections.month.vaccines.given} emptyText="No doses given this month." />
                    <Text selectable style={{ color: theme.colors.text, fontSize: 12, fontWeight: "700" }}>Upcoming</Text>
                    <VaccineList doses={report.sections.month.vaccines.upcoming.map((d) => ({ name: d.name }))} emptyText="Nothing due right now." />
                  </Card>
                  <Card label="CAREGIVER NOTES"><NotesList notes={report.sections.month.caregiverNotes} emptyText="No caregiver notes this month." /></Card>
                </>
              ) : null}

              {report.sections.halfyear ? (
                <>
                  <Card label="HALF-YEAR NARRATIVE"><Narrative text={report.sections.halfyear.halfYearNarrative} /></Card>
                  <Card label="MILESTONE ARC"><MilestonesByDomainList byDomain={report.sections.halfyear.milestoneArc} /></Card>
                  <Card label="GROWTH TREND"><GrowthTable growth={report.sections.halfyear.growthTrend} /></Card>
                  <Card label="ILLNESS PATTERN">
                    <Narrative text={report.sections.halfyear.illnessPattern.narrative} />
                    <HealthEventsList events={report.sections.halfyear.illnessPattern.table} />
                  </Card>
                  <Card label="VACCINE RECORD">
                    <Text selectable style={{ color: theme.colors.text, fontSize: 12, fontWeight: "700" }}>In this window</Text>
                    <VaccineList doses={report.sections.halfyear.vaccineRecord.inWindow} emptyText="None given in this window." />
                    <Text selectable style={{ color: theme.colors.text, fontSize: 12, fontWeight: "700" }}>Cumulative to date</Text>
                    <VaccineList doses={report.sections.halfyear.vaccineRecord.cumulative} emptyText="No vaccines on record." />
                  </Card>
                  <Card label="HIGHLIGHTS FROM CAREGIVERS"><NotesList notes={report.sections.halfyear.highlights} emptyText="No caregiver notes in this window." /></Card>
                </>
              ) : null}

              {report.sections.year ? (
                <>
                  <Card label="YEAR IN REVIEW"><Narrative text={report.sections.year.yearInReview} /></Card>
                  <Card label="CHILD SUMMARY CARD">
                    <Text selectable style={{ color: theme.colors.text, fontSize: 14 }}>Name: {report.sections.year.childSummaryCard.childName}</Text>
                    <Text selectable style={{ color: theme.colors.text, fontSize: 14 }}>Birth date: {report.sections.year.childSummaryCard.birthDate ? formatDate(report.sections.year.childSummaryCard.birthDate) : "-"}</Text>
                    <Text selectable style={{ color: theme.colors.text, fontSize: 14 }}>Allergies: {report.sections.year.childSummaryCard.allergies || "None on file"}</Text>
                    <Text selectable style={{ color: theme.colors.text, fontSize: 14 }}>
                      Pediatrician: {report.sections.year.childSummaryCard.pediatricianName || "Not on file"}
                    </Text>
                  </Card>
                  <Card label="GROWTH TRAJECTORY"><GrowthTable growth={report.sections.year.growthTrajectory} /></Card>
                  <Card label="MILESTONE TRAJECTORY"><MilestonesByDomainList byDomain={report.sections.year.milestoneTrajectory} /></Card>
                  <Card label="HEALTH HISTORY">
                    <Narrative text={report.sections.year.healthHistory.narrative} />
                    <HealthEventsList events={report.sections.year.healthHistory.table} />
                  </Card>
                  <Card label="COMPLETE VACCINE RECORD"><VaccineList doses={report.sections.year.vaccineRecordCumulative} emptyText="No vaccines on record." /></Card>
                  <Card label="CARE TEAM & VISITS">
                    <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 19 }}>{report.sections.year.careTeamVisitsNote}</Text>
                  </Card>
                  <Card label="NOTABLE MOMENTS"><NotesList notes={report.sections.year.notableMoments} emptyText="No caregiver notes this year." /></Card>
                </>
              ) : null}

              {report.sections.visit ? (
                <>
                  <SectionLabel>FOR YOU</SectionLabel>
                  {report.sections.visit.parentPages.fromLastVisit ? (
                    <Card label="FROM LAST VISIT">
                      <Text selectable style={{ color: theme.colors.muted, fontSize: 12 }}>
                        {formatDate(report.sections.visit.parentPages.fromLastVisit.visitDate)}
                      </Text>
                      <Narrative text={report.sections.visit.parentPages.fromLastVisit.text} />
                      <Text selectable style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 15, fontStyle: "italic" }}>
                        As recalled by {parentFirstName}, not a clinical record.
                      </Text>
                    </Card>
                  ) : null}
                  <Card label="SINCE YOUR LAST VISIT"><Narrative text={report.sections.visit.parentPages.sinceYourLastVisit} /></Card>
                  <Card label="TALKING POINTS">
                    {report.sections.visit.parentPages.talkingPoints.length ? (
                      report.sections.visit.parentPages.talkingPoints.map((t, i) => (
                        <Text key={i} selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>
                          - {t.text}{t.date ? ` (${formatDate(t.date)})` : ""}
                        </Text>
                      ))
                    ) : (
                      <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>Nothing notable to flag.</Text>
                    )}
                  </Card>
                  <Card label="QUESTIONS TO ASK">
                    {report.sections.visit.parentPages.questionsToAsk.length ? (
                      report.sections.visit.parentPages.questionsToAsk.map((q, i) => (
                        <Text key={i} selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>- {q.text}</Text>
                      ))
                    ) : (
                      <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>No questions generated yet -- add your own before you share.</Text>
                    )}
                  </Card>
                  <Card label="TIPS & PREP">
                    <Text selectable style={{ color: theme.colors.text, fontSize: 12, fontWeight: "700" }}>What to bring</Text>
                    {report.sections.visit.parentPages.tipsAndPrep.whatToBring.map((item, i) => (
                      <Text key={i} selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>- {item}</Text>
                    ))}
                    {report.sections.visit.parentPages.tipsAndPrep.dueVaccines.length ? (
                      <>
                        <Text selectable style={{ color: theme.colors.text, fontSize: 12, fontWeight: "700" }}>Due vaccines to discuss</Text>
                        {report.sections.visit.parentPages.tipsAndPrep.dueVaccines.map((item, i) => (
                          <Text key={i} selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>- {item}</Text>
                        ))}
                      </>
                    ) : null}
                  </Card>

                  <SectionLabel>FOR YOUR PEDIATRICIAN</SectionLabel>
                  <Card label="INTERVAL SUMMARY"><HealthEventsList events={report.sections.visit.doctorPages.intervalSummaryTable} /></Card>
                  <Card label="VACCINE RECORD"><VaccineList doses={report.sections.visit.doctorPages.vaccineRecord} emptyText="No vaccines on record." /></Card>
                  <Card label="CAREGIVER NOTES APPENDIX"><NotesList notes={report.sections.visit.doctorPages.caregiverNotesAppendix} emptyText="No caregiver notes in this window." /></Card>
                </>
              ) : null}

              {!report.sections.month && !report.sections.halfyear && !report.sections.year && !report.sections.visit ? (
                <Card label="VITALS & NOTES">
                  <VaccineList doses={[]} emptyText="This is an older report generated before Nianza's report periods were added -- tap Share to send it as an image." />
                </Card>
              ) : null}

              <Text selectable style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 16, textAlign: "center" }}>
                Parent-recorded information only. This is not a substitute for your child's official medical record.
              </Text>
              </View>

              <Pressable
                onPress={shareReport}
                disabled={sharing}
                style={{
                  minHeight: 56,
                  borderRadius: 28,
                  backgroundColor: theme.colors.bluePrimary,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  opacity: sharing ? 0.7 : 1
                }}
              >
                <SfIcon name="square.and.arrow.up" color="white" size={20} />
                <Text selectable={false} style={{ color: "white", fontSize: 15, fontWeight: "900" }}>{sharing ? "Preparing..." : "Share"}</Text>
              </Pressable>

              {notice ? <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center", lineHeight: 17 }}>{notice}</Text> : null}
            </>
          ) : null}
        </ScrollView>
      </View>
    </RequireAuth>
  );
}
