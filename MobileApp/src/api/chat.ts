import { apiPost } from "@/api/client";
import type { AmbientContext, BackendContextSeed } from "@/chat/patricia-context";

export type ChatRequest = {
  sessionId: string;
  message: string;
  childId?: string;
  language: string;
  ambientContext?: AmbientContext;
  contextSeed?: BackendContextSeed;
};

export type ChatResponse = {
  sessionId: string;
  message: {
    sender: "patricia";
    text: string;
  };
  context: {
    usedAmbientContext: boolean;
    usedContextSeed: boolean;
    enrichment: {
      childSnapshot: boolean;
      parentContext: boolean;
      todaysNote: boolean;
      activeEncounter: boolean;
      recentMilestones: boolean;
    };
  };
};

export async function sendChatMessage(input: ChatRequest) {
  return apiPost<ChatResponse>("/chat", input);
}
