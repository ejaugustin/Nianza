import { apiGet, apiPost } from "@/api/client";
import type { BackendChild } from "@/api/children";

export type VisitDebrief = {
  childId: string;
  debriefId: string;
  visitDate: string;
  debriefText: string;
  recordedBy: string;
  createdAt: string;
};

/** N5 (Parking-Lot Debrief), corrected trigger per Brief v2.16: confirms a
 * visit actually happened before assuming it did from an unconfirmed
 * nextVisitDate. Clears nextVisitDate server-side on either branch so the
 * post-visit card can't re-fire on a stale date. sawDoctor=true is what
 * unlocks the debrief-recording offer; sawDoctor=false is the "not yet"
 * branch (reschedule nudge, no debrief offered). */
export async function confirmVisit(childId: string, sawDoctor: boolean) {
  return apiPost<{ child: BackendChild; offerDebrief: boolean }>(
    `/visits/${encodeURIComponent(childId)}/confirm`,
    { sawDoctor }
  );
}

/** Stores the parent's recalled transcript of what the doctor said --
 * already transcribed client-side via the same Deepgram STT used for chat
 * input. Pure record-keeping; never routed through the chat model. */
export async function createVisitDebrief(childId: string, debriefText: string) {
  const result = await apiPost<{ debrief: VisitDebrief }>(
    `/visits/${encodeURIComponent(childId)}/debrief`,
    { debriefText }
  );
  return result.debrief;
}

export async function getLatestVisitDebrief(childId: string) {
  const result = await apiGet<{ debrief: VisitDebrief | null }>(`/visits/${encodeURIComponent(childId)}/debrief/latest`);
  return result.debrief;
}
