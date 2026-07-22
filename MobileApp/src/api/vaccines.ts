import { apiDelete, apiGet, apiPost } from "@/api/client";
import type { VaccineProgressResponse } from "@/data/vaccines";

export async function getVaccineProgress(childId = "primary-child") {
  return apiGet<VaccineProgressResponse>(`/vaccines/${encodeURIComponent(childId)}`);
}

export async function recordVaccineDose({
  childId = "primary-child",
  doseId,
  givenOn,
  note,
  backfilled = false
}: {
  childId?: string;
  doseId: string;
  givenOn: string;
  note?: string;
  backfilled?: boolean;
}) {
  return apiPost<{ record: unknown }>(`/vaccines/${encodeURIComponent(childId)}/${encodeURIComponent(doseId)}`, {
    givenOn,
    note,
    backfilled
  });
}

export async function removeVaccineDose({ childId = "primary-child", doseId }: { childId?: string; doseId: string }) {
  return apiDelete<void>(`/vaccines/${encodeURIComponent(childId)}/${encodeURIComponent(doseId)}`);
}

export async function markVaccineBackfillOffered(childId = "primary-child") {
  return apiPost<{ child: unknown }>(`/vaccines/${encodeURIComponent(childId)}/backfill-offered`);
}
