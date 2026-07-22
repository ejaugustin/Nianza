import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sendChatMessage } from "@/api/chat";
import { transcribeVoiceNote } from "@/api/voice";
import { configurePatriciaPlayback, fetchPatriciaSpeechAudio, pausePatriciaPlayer } from "@/audio/patricia-voice";
import { RequireAuth, useAuth } from "@/auth/auth-context";
import { ambientContextFromSeed, backendContextSeedFromSeed, mockTranscriptFromSeed, patriciaOpening, seedFromParams } from "@/chat/patricia-context";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

type ChatMessage = {
  id: string;
  sender: "patricia" | "parent";
  text: string;
  audioUri?: string;
  audioLoading?: boolean;
};

function formatDuration(durationMillis: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
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

function contentTypeFromUri(uri?: string | null) {
  if (!uri) return "audio/mp4";
  const lower = uri.toLowerCase();
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return "audio/mp4";
}

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const seed = useMemo(() => seedFromParams(params, profile?.childName || "your child"), [params, profile?.childName]);
  const childName = seed.childName || "your child";
  const sessionId = useMemo(() => `mobile-${Date.now()}-${Math.random().toString(16).slice(2)}`, []);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const patriciaPlayer = useAudioPlayer();
  const patriciaPlayerStatus = useAudioPlayerStatus(patriciaPlayer);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"idle" | "camera">("idle");
  const [voiceMode, setVoiceMode] = useState<"idle" | "recording" | "paused" | "transcribing">("idle");
  const opening = useMemo(() => patriciaOpening(seed), [seed]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [makeMessage("patricia", opening)]);
  const [notice, setNotice] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const isVoiceActive = voiceMode !== "idle";

  function stopPatriciaPlayback() {
    pausePatriciaPlayer(patriciaPlayer);
    setSpeakingMessageId(null);
  }

  async function playAudioUri(uri: string, messageId: string) {
    await configurePatriciaPlayback();
    patriciaPlayer.replace({ uri });
    patriciaPlayer.seekTo(0);
    patriciaPlayer.play();
    setSpeakingMessageId(messageId);
  }

  async function speakPatriciaMessage(message: ChatMessage) {
    if (message.sender !== "patricia") return;
    setNotice(null);

    if (message.audioUri) {
      await playAudioUri(message.audioUri, message.id);
      return;
    }

    setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, audioLoading: true } : item)));
    try {
      const audioUri = await fetchPatriciaSpeechAudio(message.text, `chat-${message.id}`);
      setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, audioUri, audioLoading: false } : item)));
      await playAudioUri(audioUri, message.id);
    } catch {
      setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, audioLoading: false } : item)));
      setNotice("Patricia could not play audio just now. You can tap replay to try again.");
    }
  }

  useEffect(() => {
    configurePatriciaPlayback().catch(() => {
      setNotice("Patricia could not prepare audio playback just now.");
    });
  }, []);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (latest?.sender === "patricia") {
      speakPatriciaMessage(latest);
    }
  }, [messages.length]);

  useEffect(() => {
    return () => {
      stopPatriciaPlayback();
    };
  }, []);

  useEffect(() => {
    if (speakingMessageId && !patriciaPlayerStatus.playing && patriciaPlayerStatus.currentTime > 0) {
      setSpeakingMessageId(null);
    }
  }, [patriciaPlayerStatus.currentTime, patriciaPlayerStatus.playing, speakingMessageId]);

  async function getPatriciaReply(parentMessage: string) {
    const response = await sendChatMessage({
      sessionId,
      message: parentMessage,
      childId: seed.childId || "primary-child",
      language: profile?.language || "en",
      ambientContext: ambientContextFromSeed(seed),
      contextSeed: backendContextSeedFromSeed(seed)
    });
    return response.message.text;
  }

  async function sendMessage() {
    const message = draft.trim();
    if (!message) return;
    setDraft("");
    setMessages((current) => [...current, makeMessage("parent", message)]);
    try {
      const reply = await getPatriciaReply(message);
      setMessages((current) => [...current, makeMessage("patricia", reply)]);
    } catch {
      setMessages((current) => [
        ...current,
        makeMessage("patricia", "I hear you. Start with the part that feels heaviest, and we can make it smaller together.")
      ]);
    }
  }

  async function startVoiceMessage() {
    setNotice(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setNotice("Microphone permission is needed to talk with Patricia by voice.");
      return;
    }

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false
      });
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
    await configurePatriciaPlayback();
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
      await configurePatriciaPlayback();
    } catch {
      setNotice("Voice captured locally, but Patricia had trouble ending the recording cleanly.");
    }

    const recordingUri = recorder.uri || recorderState.url;

    try {
      const audioBase64 = recordingUri
        ? await FileSystem.readAsStringAsync(recordingUri, { encoding: FileSystem.EncodingType.Base64 })
        : "";
      const response = audioBase64
        ? await transcribeVoiceNote({
            audioBase64,
            contentType: contentTypeFromUri(recordingUri),
            language: "en"
          })
        : null;
      const transcript = response?.transcript || mockTranscriptFromSeed(seed);
      setMessages((current) => [...current, makeMessage("parent", transcript)]);
      try {
        const reply = await getPatriciaReply(transcript);
        setMessages((current) => [...current, makeMessage("patricia", reply)]);
      } catch {
        setMessages((current) => [...current, makeMessage("patricia", patriciaReply())]);
      }
      setVoiceMode("idle");
    } catch {
      const transcript = mockTranscriptFromSeed(seed);
      setMessages((current) => [
        ...current,
        makeMessage("parent", transcript),
        makeMessage("patricia", "I had trouble hearing the recording clearly, so I saved a placeholder for now. Tell me the part you most want help sorting out.")
      ]);
      setVoiceMode("idle");
      setNotice("Patricia could not transcribe that voice note yet. Check the Deepgram backend configuration and try again.");
    }
  }

  return (
    <RequireAuth>
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ height: insets.top + 62, paddingTop: insets.top, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: theme.colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} style={{ minWidth: 44, minHeight: 44, alignItems: "flex-start", justifyContent: "center" }}>
          <SfIcon name="chevron.left" color={theme.colors.text} size={22} />
        </Pressable>
        <Text selectable style={{ color: theme.colors.text, fontSize: 17, fontWeight: "600" }}>Patricia</Text>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.6, borderColor: theme.colors.muted, alignItems: "center", justifyContent: "center" }}>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 11, fontStyle: "italic" }}>i</Text>
        </View>
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingTop: 24, paddingBottom: 138 + insets.bottom, gap: 14 }}>
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
                    <Text selectable style={{ color: theme.colors.blueDeep, fontSize: 12, fontWeight: "700" }}>{message.audioLoading ? "Loading" : isSpeaking ? "Playing" : "Replay"}</Text>
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

      <View style={{ position: "absolute", left: 16, right: 16, bottom: Math.max(insets.bottom, 12) + 10, gap: 9 }}>
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send voice message"
              disabled={voiceMode === "transcribing"}
              onPress={sendVoiceMessage}
              style={{
                minWidth: 82,
                height: 52,
                borderRadius: 26,
                backgroundColor: theme.colors.bluePrimary,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 7,
                paddingHorizontal: 14,
                opacity: voiceMode === "transcribing" ? 0.55 : 1
              }}
            >
              <SfIcon name="paperplane.fill" color="white" size={18} />
              <Text selectable={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={{ color: "white", fontSize: 14, fontWeight: "800" }}>
                {voiceMode === "transcribing" ? "Sending" : "Send"}
              </Text>
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
    </RequireAuth>
  );
}
