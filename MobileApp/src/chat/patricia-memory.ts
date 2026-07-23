import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ChatContextSeed } from "@/chat/patricia-context";

const PATRICIA_MEMORY_KEY = "nianza_patricia_last_conversation";

export type PatriciaConversationMemory = {
  sessionId: string;
  seed: ChatContextSeed;
  updatedAt: string;
};

export async function getLastPatriciaMemory(): Promise<PatriciaConversationMemory | null> {
  try {
    const raw = await AsyncStorage.getItem(PATRICIA_MEMORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PatriciaConversationMemory>;
    if (!parsed.sessionId || !parsed.seed?.source || !parsed.seed?.eventType) return null;
    return parsed as PatriciaConversationMemory;
  } catch {
    return null;
  }
}

export async function saveLastPatriciaMemory(memory: PatriciaConversationMemory) {
  try {
    await AsyncStorage.setItem(PATRICIA_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // Patricia can still talk if local continuity memory is unavailable.
  }
}
