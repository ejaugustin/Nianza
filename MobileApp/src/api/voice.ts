import { apiPost } from "@/api/client";

export type TranscribeVoiceResponse = {
  transcript: string;
  confidence: number | null;
  empty: boolean;
  model: string;
};

export type SpeakVoiceResponse = {
  audioBase64: string;
  contentType: string;
  model: string;
  chars: number;
};

export async function transcribeVoiceNote(input: { audioBase64: string; contentType?: string; language?: string }) {
  return apiPost<TranscribeVoiceResponse>("/voice/transcribe", {
    audioBase64: input.audioBase64,
    contentType: input.contentType || "audio/mp4",
    language: input.language || "en"
  });
}

export async function speakPatriciaText(text: string) {
  return apiPost<SpeakVoiceResponse>("/voice/speak", { text });
}
