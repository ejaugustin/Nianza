import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

type ChatMessage = {
  id: string;
  sender: "patricia" | "parent";
  text: string;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function patriciaOpening(eventType?: string, childName = "Sofia", detail?: string) {
  if (eventType === "milestone-checked") {
    return `${childName} ${detail?.toLowerCase() || "did something new"}? Oh, I love hearing that. Tell me what you noticed first.`;
  }
  if (eventType === "visit-upcoming") {
    return `A visit coming up can make your mind feel crowded. Let's sort through what you want to ask about ${childName}, one thing at a time.`;
  }
  if (eventType === "sick-encounter-active") {
    return `I'm here with you. Tell me what's been happening with ${childName}, and we'll keep the notes clear while you decide what needs a clinician.`;
  }
  return "Hello. I'm Patricia. I've been with a lot of new parents over the years, and I'm glad you're here. What's on your mind?";
}

function formatDuration(durationMillis: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function mockTranscript(childName: string, eventType?: string, detail?: string) {
  if (eventType === "milestone-checked") {
    return `I noticed ${childName} ${detail?.toLowerCase() || "doing something new"}, and I want to understand what to watch for next.`;
  }
  if (eventType === "visit-upcoming") {
    return `I want to prepare a few clear questions for ${childName}'s visit.`;
  }
  if (eventType === "sick-encounter-active") {
    return `${childName} has been off today, and I want help organizing what I should pay attention to.`;
  }
  return `I want to talk through something I noticed with ${childName} today.`;
}

function patriciaReply() {
  return "Thank you for saying it out loud. I can work with that. What changed first, and what feels most important right now?";
}

function makeMessage(sender: ChatMessage["sender"], text: string): ChatMessage {
  return {
    id: `${sender}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sender,
    text
  };
}

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const { profile } = useAuth();
  const childName = one(params.childName) || profile?.childName || "Sofia";
  const eventType = one(params.eventType);
  const detail = one(params.detail);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"idle" | "camera">("idle");
  const [voiceMode, setVoiceMode] = useState<"idle" | "recording" | "paused" | "transcribing">("idle");
  const opening = useMemo(() => patriciaOpening(eventType, childName, detail), [childName, detail, eventType]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [makeMessage("patricia", opening)]);
  const [notice, setNotice] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const isVoiceActive = voiceMode !== "idle";

  function speakPatriciaMessage(message: ChatMessage) {
    if (message.sender !== "patricia") return;
    Speech.stop();
    setSpeakingMessageId(message.id);
    Speech.speak(message.text, {
      language: "en-US",
      pitch: 1.02,
      rate: 0.9,
      onDone: () => setSpeakingMessageId(null),
      onStopped: () => setSpeakingMessageId(null),
      onError: () => {
        setSpeakingMessageId(null);
        setNotice("Patricia could not play audio just now. You can tap replay to try again.");
      }
    });
  }

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (latest?.sender === "patricia") {
      speakPatriciaMessage(latest);
    }

    return () => {
      Speech.stop();
    };
  }, [messages]);

  function sendMessage() {
    const message = draft.trim();
    if (!message) return;
    setMessages((current) => [
      ...current,
      makeMessage("parent", message),
      makeMessage("patricia", "I hear you. Start with the part that feels heaviest, and we can make it smaller together.")
    ]);
    setDraft("");
  }

  async function startVoiceMessage() {
    setNotice(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setNotice("Microphone permission is needed to talk with Patricia by voice.");
      return;
    }

    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setVoiceMode("recording");
      setMode("idle");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Patricia could not start listening. Please try again.");
      setVoiceMode("idle");
    }
  }

  async function discardVoiceMessage() {
    try {
      if (voiceMode === "recording" || voiceMode === "paused") {
        await recorder.stop();
      }
    } catch {
      // The recorder may already be stopped by the native layer.
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    setVoiceMode("idle");
    setNotice("Voice note discarded.");
  }

  function toggleVoicePause() {
    if (voiceMode === "recording") {
      recorder.pause();
      setVoiceMode("paused");
      return;
    }
    if (voiceMode === "paused") {
      recorder.record();
      setVoiceMode("recording");
    }
  }

  async function sendVoiceMessage() {
    if (voiceMode === "transcribing") return;
    setVoiceMode("transcribing");
    setNotice(null);

    try {
      if (recorderState.isRecording || voiceMode === "recording" || voiceMode === "paused") {
        await recorder.stop();
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    } catch {
      setNotice("Voice captured locally, but Patricia had trouble ending the recording cleanly.");
    }

    const transcript = mockTranscript(childName, eventType, detail);
    setTimeout(() => {
      setMessages((current) => [
        ...current,
        makeMessage("parent", transcript),
        makeMessage("patricia", patriciaReply())
      ]);
      setVoiceMode("idle");
    }, 650);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ height: 66, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: theme.colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}>
        <SfIcon name="chevron.left" color={theme.colors.text} size={22} />
        <Text selectable style={{ color: theme.colors.text, fontSize: 17, fontWeight: "600" }}>Patricia</Text>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.6, borderColor: theme.colors.muted, alignItems: "center", justifyContent: "center" }}>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 11, fontStyle: "italic" }}>i</Text>
        </View>
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingTop: 24, paddingBottom: 128, gap: 14 }}>
        {messages.map((message, index) => {
          const fromParent = message.sender === "parent";
          const isSpeaking = speakingMessageId === message.id;
          return (
            <View key={message.id} style={{ flexDirection: "row", justifyContent: fromParent ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 8 }}>
              {!fromParent ? (
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>P</Text>
                </View>
              ) : null}
              <View style={{ maxWidth: 248, borderRadius: 16, backgroundColor: fromParent ? theme.colors.bluePrimary : theme.colors.card, paddingHorizontal: 14, paddingVertical: 15, gap: fromParent ? 0 : 10 }}>
                <Text selectable style={{ color: fromParent ? "white" : theme.colors.text, fontSize: 14, lineHeight: 20 }}>{message.text}</Text>
                {!fromParent ? (
                  <Pressable onPress={() => speakPatriciaMessage(message)} style={{ alignSelf: "flex-start", minHeight: 32, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, backgroundColor: isSpeaking ? theme.colors.blueLight : "white" }}>
                    <SfIcon name="speaker.wave.2.fill" color={theme.colors.bluePrimary} size={17} />
                    <Text selectable style={{ color: theme.colors.blueDeep, fontSize: 12, fontWeight: "700" }}>{isSpeaking ? "Playing" : "Replay"}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
        {notice ? (
          <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center" }}>
            {notice}
          </Text>
        ) : null}
        {mode !== "idle" ? (
          <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center" }}>
            Camera placeholder is ready for photo context.
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ position: "absolute", left: 16, right: 16, bottom: 22, gap: 9 }}>
        {isVoiceActive ? (
          <View style={{ minHeight: 74, borderRadius: 30, backgroundColor: theme.colors.voicePanel, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, boxShadow: "0 8px 24px rgba(10, 20, 28, 0.24)" }}>
            <Pressable disabled={voiceMode === "transcribing"} onPress={discardVoiceMessage} style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", opacity: voiceMode === "transcribing" ? 0.4 : 1 }}>
              <SfIcon name="trash" color="white" size={24} />
            </Pressable>
            <View style={{ flex: 1, gap: 7 }}>
              <Text selectable style={{ color: "white", fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                {voiceMode === "transcribing" ? "Sending" : formatDuration(recorderState.durationMillis)}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                {Array.from({ length: 32 }).map((_, index) => {
                  const height = 3 + ((index * 7 + Math.floor(recorderState.durationMillis / 180)) % 14);
                  const active = voiceMode === "recording" && index % 3 !== 0;
                  return <View key={index} style={{ flex: 1, height, borderRadius: 3, backgroundColor: active ? theme.colors.bluePrimary : "rgba(255, 255, 255, 0.42)" }} />;
                })}
              </View>
            </View>
            <Pressable disabled={voiceMode === "transcribing"} onPress={toggleVoicePause} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: voiceMode === "paused" ? "white" : "#F05A73", alignItems: "center", justifyContent: "center", opacity: voiceMode === "transcribing" ? 0.4 : 1 }}>
              <SfIcon name={voiceMode === "paused" ? "mic.fill" : "pause.fill"} color={voiceMode === "paused" ? theme.colors.bluePrimary : "white"} size={22} />
            </Pressable>
            <Pressable disabled={voiceMode === "transcribing"} onPress={sendVoiceMessage} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", opacity: voiceMode === "transcribing" ? 0.55 : 1 }}>
              <SfIcon name="paperplane.fill" color="white" size={24} />
            </Pressable>
          </View>
        ) : (
          <View style={{ minHeight: 58, borderRadius: 29, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12 }}>
            <Pressable onPress={() => setMode(mode === "camera" ? "idle" : "camera")} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: mode === "camera" ? theme.colors.blueLight : "transparent" }}>
              <SfIcon name="camera" color={theme.colors.bluePrimary} size={22} />
            </Pressable>
            <TextInput
              placeholder="Tap mic to talk with Patricia..."
              placeholderTextColor={theme.colors.greyIcon}
              value={draft}
              onChangeText={setDraft}
              style={{ flex: 1, minHeight: 44, color: theme.colors.text, fontSize: 14 }}
              onSubmitEditing={sendMessage}
            />
            <Pressable onPress={draft.trim() ? sendMessage : startVoiceMessage} style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bluePrimary }}>
              <SfIcon name={draft.trim() ? "paperplane.fill" : "mic.fill"} color="white" size={23} />
            </Pressable>
          </View>
        )}
        <Text selectable style={{ color: theme.colors.muted, fontSize: 11, textAlign: "center" }}>
          Patricia can help you think it through. For urgent symptoms, contact a clinician or emergency services.
        </Text>
      </View>
    </View>
  );
}
