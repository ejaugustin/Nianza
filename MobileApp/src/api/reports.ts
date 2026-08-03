import { apiGet, apiPost } from "./client";

export type ReportType = "monthly" | "visit-pack";
export type ReportPeriod = "month" | "halfyear" | "year" | "visit";

export type VitalsLogRow = { recordedAt: string; title: string; label?: string; encounterName?: string | null };
export type HealthEventRow = {
  encounterId: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  durationDays: number | null;
  peakTemp: number | null;
  temps: Array<{ recordedAt: string; valueText: string }>;
  medications: Array<{ recordedAt: string; medName: string; doseText?: string | null }>;
  notes: Array<{ recordedAt: string; note: string; recordedBy?: string | null }>;
};
export type CaregiverNoteRow = { recordedAt: string; note: string; recordedBy?: string | null; entryType?: string };
export type GrowthByType = { weight: Array<{ recordedAt: string; value: string; unit: string }>; height: Array<{ recordedAt: string; value: string; unit: string }>; head_circumference: Array<{ recordedAt: string; value: string; unit: string }> };
export type MilestonesByDomain = Record<string, Array<{ milestoneId?: string; text: string; observedAt: string }>>;
export type VaccineListRow = { name: string; givenOn?: string };

export type MonthSection = {
  monthAtAGlance: string;
  milestones: Array<{ text: string; domain: string | null; observedAt: string }>;
  newInCurrentWindow: Array<{ text: string; domain: string }>;
  growth: GrowthByType;
  healthEvents: HealthEventRow[];
  vaccines: { given: VaccineListRow[]; upcoming: Array<{ name: string }> };
  caregiverNotes: CaregiverNoteRow[];
};

export type HalfYearSection = {
  halfYearNarrative: string;
  milestoneArc: MilestonesByDomain;
  growthTrend: GrowthByType;
  illnessPattern: { table: HealthEventRow[]; narrative: string };
  vaccineRecord: { inWindow: VaccineListRow[]; cumulative: VaccineListRow[] };
  highlights: CaregiverNoteRow[];
};

export type YearSection = {
  yearInReview: string;
  childSummaryCard: {
    childName: string;
    birthDate: string | null;
    allergies: string | null;
    recentMedications: Array<{ recordedAt: string; medName: string; doseText?: string | null }>;
    pediatricianName: string | null;
    pediatricianPhone: string | null;
  };
  growthTrajectory: GrowthByType;
  milestoneTrajectory: MilestonesByDomain;
  healthHistory: { table: HealthEventRow[]; narrative: string };
  vaccineRecordCumulative: VaccineListRow[];
  careTeamVisits: unknown[];
  careTeamVisitsNote: string;
  notableMoments: CaregiverNoteRow[];
};

export type VisitPackSection = {
  parentPages: {
    fromLastVisit: { text: string; visitDate: string; recordedAt: string } | null;
    sinceYourLastVisit: string;
    talkingPoints: Array<{ text: string; date?: string }>;
    questionsToAsk: Array<{ text: string; source?: string }>;
    tipsAndPrep: { whatToBring: string[]; dueVaccines: string[] };
  };
  doctorPages: {
    intervalSummaryTable: HealthEventRow[];
    vitalsLog: VitalsLogRow[];
    vaccineRecord: VaccineListRow[];
    caregiverNotesAppendix: CaregiverNoteRow[];
  };
};

export type MobileReport = {
  childId: string;
  reportId: string;
  reportType: ReportType;
  period: ReportPeriod;
  title: string;
  periodLabel: string;
  isFallbackWindow?: boolean;
  status: "queued" | "ready" | "failed";
  distribution: string[];
  pdfStatus: string;
  url: string | null;
  options?: CreateReportOptions;
  sections: {
    month?: MonthSection;
    halfyear?: HalfYearSection;
    year?: YearSection;
    visit?: VisitPackSection;
    // Legacy shape from before Addendum A -- kept so old report records
    // (already sitting in a parent's Past Reports list) still render.
    healthLog?: VitalsLogRow[];
  };
  generatedAt: string;
  updatedAt: string;
};

export type CreateReportOptions = {
  period?: ReportPeriod;
  periodMonth?: string;
  lastVisitDate?: string;
  parentConcerns?: string[];
  childSummary?: {
    allergies?: string | null;
    pediatricianName?: string | null;
    pediatricianPhone?: string | null;
  };
};

export function periodTagLabel(period: ReportPeriod) {
  if (period === "halfyear") return "6-Mo";
  if (period === "year") return "Yearly";
  if (period === "visit") return "Visit Pack";
  return "Monthly";
}

export async function listMobileReports(childId: string) {
  const response = await apiGet<{ reports: MobileReport[] }>(`/reports/${encodeURIComponent(childId)}`);
  return response.reports;
}

// parentFirstName is optional and only used to fill the Section 6.3
// "locked feature" copy's {Name} slot server-side if this account turns out
// to be free-tier for this report type -- see reports/handler.js's
// lockedFeatureText().
export async function createMobileReport(childId: string, reportType: ReportType, options: CreateReportOptions = {}, parentFirstName?: string) {
  const response = await apiPost<{ reportId: string; status: MobileReport["status"]; report: MobileReport }>(
    `/reports/${encodeURIComponent(childId)}`,
    { reportType, options, parentFirstName }
  );
  return response.report;
}

export async function getMobileReport(childId: string, reportId: string, parentFirstName?: string) {
  const response = await apiGet<{ report: MobileReport }>(
    `/reports/${encodeURIComponent(childId)}/${encodeURIComponent(reportId)}`,
    { parentFirstName }
  );
  return response.report;
}
