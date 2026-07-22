import rawVaccines from "./vaccines-en.json";

export type VaccineTone = "blue" | "terracotta";
export type VaccineDoseStatus = "recorded" | "due" | "upcoming" | "unrecorded" | "future";

export type VaccineDose = {
  doseId: string;
  vaccineId: string;
  name: string;
  fullName: string;
  doseNum: number;
  dosePosition: string;
  displayGroup: string;
  windowStartMonths: number;
  windowEndMonths: number;
  note?: string | null;
  status: VaccineDoseStatus;
  givenOn?: string | null;
  backfilled?: boolean;
  parentNote?: string | null;
  seasonYear?: number | null;
};

export type VaccineGroup = {
  displayGroup: string;
  doses: VaccineDose[];
};

export type VaccineProgressResponse = {
  childId: string;
  scheduleVersion: string;
  sourceVerifiedBy?: string | null;
  ageBasis: "chronological";
  ageMonths: number;
  vaccineStatus: "due" | "up-to-date";
  dueCount: number;
  shouldOfferBackfill: boolean;
  groups: VaccineGroup[];
  informationalRows: Array<{ infoId: string; name?: string; title?: string; text?: string; row?: string }>;
};

export const vaccineLibrary = rawVaccines as {
  version: string;
  scheduleSource: string;
  sourceVerifiedBy?: string | null;
  language: string;
};

export function vaccineStatusLabel(status: VaccineDoseStatus) {
  if (status === "recorded") return "Recorded";
  if (status === "due") return "Due";
  if (status === "upcoming") return "Upcoming";
  if (status === "unrecorded") return "No record yet";
  return "";
}

export function vaccineStatusTone(status: VaccineDoseStatus): VaccineTone {
  return status === "due" ? "terracotta" : "blue";
}

export function vaccineWindowLabel(dose: Pick<VaccineDose, "windowStartMonths" | "windowEndMonths">) {
  if (dose.windowStartMonths === dose.windowEndMonths) return `${dose.windowStartMonths} months`;
  return `${dose.windowStartMonths}-${dose.windowEndMonths} months`;
}
