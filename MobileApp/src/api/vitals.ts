import { apiDelete, apiGet, apiPost } from "@/api/client";

export type VitalsEntryType =
  | "temperature"
  | "medication"
  | "symptom"
  | "weight"
  | "height"
  | "head_circumference"
  | "feeding"
  | "diaper"
  | "sleep"
  | "note";

export type VitalsEntry = {
  childId: string;
  entryId: string;
  entryType: VitalsEntryType;
  title: string;
  label: string;
  recordedAt: string;
  recordedBy?: string;
  note?: string | null;
  encounterId?: string | null;
  encounterName?: string | null;
  valueText?: string;
  medName?: string;
  doseText?: string | null;
  symptomType?: string;
  otherText?: string | null;
  value?: string;
  unit?: string;
  percentile?: number | null;
  percentileLabel?: string | null;
  percentileStatus?: string | null;
  feedingType?: string;
  amount?: string | null;
  diaperType?: string;
};

export type SickEncounter = {
  childId: string;
  encounterId: string;
  name: string;
  status: "active" | "ended";
  startedAt: string;
  endedAt?: string | null;
  updatedAt: string;
};

export type VitalsResponse = {
  entries: VitalsEntry[];
  encounters: SickEncounter[];
  activeEncounter: SickEncounter | null;
  growth: {
    percentilesAvailable: boolean;
    status: string;
    message: string;
  };
};

export type VitalsEntryInput = {
  entryType: VitalsEntryType;
  recordedAt?: string;
  note?: string;
  valueText?: string;
  medName?: string;
  doseText?: string;
  symptomType?: string;
  otherText?: string;
  value?: string;
  unit?: string;
  feedingType?: string;
  amount?: string;
  diaperType?: string;
  encounterId?: string | null;
};

export async function listVitals(childId = "primary-child") {
  return apiGet<VitalsResponse>(`/vitals/${encodeURIComponent(childId)}`);
}

export async function createVitalsEntry(childId: string, input: VitalsEntryInput) {
  return apiPost<{ entry: VitalsEntry }>(`/vitals/${encodeURIComponent(childId)}`, input);
}

export async function deleteVitalsEntry(childId: string, entryId: string) {
  return apiDelete<void>(`/vitals/${encodeURIComponent(childId)}/${encodeURIComponent(entryId)}`);
}

export async function createSickEncounter(childId: string, name: string) {
  return apiPost<{ encounter: SickEncounter }>(`/vitals/${encodeURIComponent(childId)}/encounters`, { name });
}

export async function endSickEncounter(childId: string, encounterId: string) {
  return apiPost<{ encounter: SickEncounter }>(`/vitals/${encodeURIComponent(childId)}/encounters/${encodeURIComponent(encounterId)}/end`);
}
