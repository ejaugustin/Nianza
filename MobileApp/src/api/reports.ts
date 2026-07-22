import { apiGet, apiPost } from "./client";

export type ReportType = "monthly" | "visit-pack";

export type MobileReport = {
  childId: string;
  reportId: string;
  reportType: ReportType;
  title: string;
  periodLabel: string;
  status: "queued" | "ready" | "failed";
  distribution: string[];
  pdfStatus: string;
  url: string | null;
  generatedAt: string;
  updatedAt: string;
};

export type CreateReportOptions = {
  periodMonth?: string;
  nextVisitDate?: string;
  includeVitals?: boolean;
  includeMilestones?: boolean;
  includeVaccines?: boolean;
};

export async function listMobileReports(childId: string) {
  const response = await apiGet<{ reports: MobileReport[] }>(`/reports/${encodeURIComponent(childId)}`);
  return response.reports;
}

export async function createMobileReport(childId: string, reportType: ReportType, options: CreateReportOptions = {}) {
  const response = await apiPost<{ reportId: string; status: MobileReport["status"]; report: MobileReport }>(
    `/reports/${encodeURIComponent(childId)}`,
    { reportType, options }
  );
  return response.report;
}

export async function getMobileReport(childId: string, reportId: string) {
  const response = await apiGet<{ report: MobileReport }>(
    `/reports/${encodeURIComponent(childId)}/${encodeURIComponent(reportId)}`
  );
  return response.report;
}
