import { apiDelete, apiGet, apiPost } from "@/api/client";

export type VoiceMemoryType = "child-voice" | "parent-capsule";

export type VoiceMemory = {
  memoryId: string;
  childId: string;
  type: VoiceMemoryType;
  label: string | null;
  durationSeconds: number | null;
  recordedAt: string;
  playbackUrl: string | null;
  locked: boolean;
};

export type VoiceMemoryListResponse = {
  memories: VoiceMemory[];
  childAgeMonths: number;
  graduationAgeMonths: number;
};

/** N3 (child voice) / N2 (parent capsule): one table, one Lambda, split by
 * `type`. Capsule playbackUrl is withheld server-side (locked: true) until
 * the child reaches the graduation age -- there is no client-side gate to
 * bypass, the server simply never sends the URL early. */
export async function listVoiceMemories(childId: string, type?: VoiceMemoryType) {
  const query = type ? `?type=${encodeURIComponent(type)}` : "";
  return apiGet<VoiceMemoryListResponse>(`/memories/${encodeURIComponent(childId)}/voice${query}`);
}

export async function recordVoiceMemory({
  childId,
  type,
  audioBase64,
  contentType,
  durationSeconds,
  label,
  recordedBy
}: {
  childId: string;
  type: VoiceMemoryType;
  audioBase64: string;
  contentType: string;
  durationSeconds?: number;
  label?: string;
  recordedBy?: string;
}) {
  return apiPost<{ memory: VoiceMemory }>(`/memories/${encodeURIComponent(childId)}/voice`, {
    type,
    audioBase64,
    contentType,
    ...(durationSeconds ? { durationSeconds } : {}),
    ...(label ? { label } : {}),
    ...(recordedBy ? { recordedBy } : {})
  });
}

export async function deleteVoiceMemory(childId: string, memoryId: string) {
  return apiDelete<void>(`/memories/${encodeURIComponent(childId)}/voice/${encodeURIComponent(memoryId)}`);
}
