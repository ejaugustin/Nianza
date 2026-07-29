import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sendChatMessage } from "@/api/chat";
import { transcribeVoiceNote } from "@/api/voice";
import { configurePatriciaPlayback, fetchPatriciaSpeechChunkAudio, pausePatriciaPlayer, splitIntoSpeechChunks } from "@/audio/patricia-voice";
import { RequireAuth, useAuth } from "@/auth/auth-context";
import { ambientContextFromSeed, backendContextSeedFromSeed, mockTranscriptFromSeed, one, patriciaOpening, seedFromParams } from "@/chat/patricia-context";
import { saveLastPatriciaMemory } from "@/chat/patricia-memory";
import { SfIcon } from "@/components/screen-spec";
import { normalizePatriciaDisplayText } from "@/text/patricia-text";
import { theme } from "@/theme/theme";

type ChatMessage = {
  id: string;
  sender: "patricia" | "parent";
  text: string;
  imageUri?: string;
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

function isExplicitEmergencyOrDistress(message: string) {
  const text = message.toLowerCase();
  return [
    /not breathing/,
    /stopped breathing/,
    /can't breathe/,
    /cannot breathe/,
    /unresponsive/,
    /won't wake/,
    /will not wake/,
    /turning blue/,
    /\bblue\b.*\b(lips|face|baby|skin|child)\b/,
    /\bseizure\b/,
    /\bconvulsion\b/,
    /hurt myself/,
    /hurt my baby/,
    /hurt my child/,
    /harm myself/,
    /harm my baby/,
    /harm my child/,
    /can't go on/,
    /cannot go on/,
    /i want to die/,
    /kill myself/
  ].some((pattern) => pattern.test(text));
}

function isCrisisTemplate(reply: string) {
  return /hurt yourself or your baby|put the baby somewhere safe|call emergency services now|i need help right now/i.test(reply);
}

function developmentReply(childName: string) {
  return `For ${childName}, I would watch ordinary everyday patterns: how they move, look toward voices and faces, use their hands, and respond to you. You do not have to grade every moment. If something feels missing or worrying, write down what you saw and when, and bring that to the pediatrician.`;
}

function vaccineReply(childName: string) {
  return `For ${childName}, it is reasonable to want plain words. Ask the pediatrician what the vaccine protects against, what reactions are normal that day, and what would make them want a call. I can help you turn your questions into a short list before the visit.`;
}

function makeMessage(sender: ChatMessage["sender"], text: string, imageUri?: string): ChatMessage {
  return {
    id: `${sender}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sender,
    text: sender === "patricia" ? normalizePatriciaDisplayText(text) : text,
    imageUri
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const { profile, activeChildId } = useAuth();
  const insets = useSafeAreaInsets();
  const parentFirstName = profile?.parentFirstName || profile?.parentName?.split(" ")[0];
  const seed = useMemo(
    () => seedFromParams(params, profile?.childName || "your child", parentFirstName),
    [params, profile?.childName, parentFirstName]
  );
  const childName = seed.childName || "your child";
  const routeSessionId = one(params.sessionId);
  const sessionId = useMemo(() => routeSessionId || `mobile-${Date.now()}-${Math.random().toString(16).slice(2)}`, [routeSessionId]);
  const seedKey = useMemo(() => JSON.stringify(seed), [seed]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const patriciaPlayer = useAudioPlayer();
  const patriciaPlayerStatus = useAudioPlayerStatus(patriciaPlayer);
  const [draft, setDraft] = useState("");
  const [voiceMode, setVoiceMode] = useState<"idle" | "recording" | "paused" | "transcribing">("idle");
  const opening = useMemo(() => patriciaOpening(seed), [seed]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [makeMessage("patricia", opening)]);
  const [notice, setNotice] = useState<string | null>(null);
  const [patriciaThinking, setPatriciaThinking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const autoPlayedMessageIds = useRef<Set<string>>(new Set());
  const seedKeyRef = useRef(seedKey);
  // Chunk audio-file promises per message, keyed by message id, so a manual
  // "Replay" tap reuses whatever was already synthesized rather than
  // re-fetching from Deepgram.
  const chunkCacheRef = useRef<Map<string, Promise<string>[]>>(new Map());
  // The queue currently driving playback -- lets the "chunk finished" effect
  // below know whether to advance to the next chunk of the same reply.
  const activeQueueRef = useRef<{ messageId: string; chunkPromises: Promise<string>[]; nextIndex: number } | null>(null);
  // Guards against a chunk transition being kicked off twice in a row (see
  // advanceChunkQueue) so playback never silently stalls partway through a
  // multi-chunk reply.
  const isAdvancingChunkRef = useRef(false);
  const isVoiceActive = voiceMode !== "idle";
  const composerBottom = Math.max(insets.bottom, 12) + 10 + keyboardHeight;

  function stopPatriciaPlayback() {
    activeQueueRef.current = null;
    pausePatriciaPlayer(patriciaPlayer);
    setSpeakingMessageId(null);
  }

  useEffect(() => {
    saveLastPatriciaMemory({ sessionId, seed, updatedAt: new Date().toISOString() });
  }, [sessionId, seed, seedKey]);

  useEffect(() => {
    if (seedKeyRef.current === seedKey) return;
    seedKeyRef.current = seedKey;
    stopPatriciaPlayback();
    autoPlayedMessageIds.current.clear();
    chunkCacheRef.current.clear();
    setMessages([makeMessage("patricia", opening)]);
  }, [seedKey, opening]);

  async function playAudioUri(uri: string, messageId: string) {
    await configurePatriciaPlayback();
    patriciaPlayer.replace({ uri });
    await patriciaPlayer.seekTo(0);
    patriciaPlayer.play();
    setSpeakingMessageId(messageId);
  }

  // Splits a reply into short, sentence-bounded pieces and kicks off a TTS
  // fetch for each one in parallel, caching the promises per message so
  // replay/auto-advance never re-synthesizes the same chunk twice.
  function getOrCreateChunkPromises(messageId: string, text: string) {
    let cached = chunkCacheRef.current.get(messageId);
    if (!cached) {
      const chunks = splitIntoSpeechChunks(text);
      cached = chunks.map((chunkText, index) => fetchPatriciaSpeechChunkAudio(chunkText, `chat-${messageId}-${index}`));
      chunkCacheRef.current.set(messageId, cached);
    }
    return cached;
  }

  // Plays the next not-yet-played chunk in the active queue, then relies on
  // the playback-status effect below to call this again once that chunk
  // finishes -- so a long reply plays as a continuous stream of short clips
  // instead of one long wait for a single giant audio file.
  async function advanceChunkQueue() {
    if (isAdvancingChunkRef.current) return;
    const queue = activeQueueRef.current;
    if (!queue) return;
    if (queue.nextIndex >= queue.chunkPromises.length) {
      activeQueueRef.current = null;
      setSpeakingMessageId(null);
      return;
    }
    isAdvancingChunkRef.current = true;
    const index = queue.nextIndex;
    queue.nextIndex += 1;
    let shouldRetry = false;
    try {
      const uri = await queue.chunkPromises[index];
      if (activeQueueRef.current !== queue) return; // superseded by a newer play/replay
      await playAudioUri(uri, queue.messageId);
    } catch {
      shouldRetry = activeQueueRef.current === queue;
    } finally {
      isAdvancingChunkRef.current = false;
    }
    if (shouldRetry) advanceChunkQueue();
  }

  async function playChunkQueue(messageId: string, chunkPromises: Promise<string>[]) {
    activeQueueRef.current = { messageId, chunkPromises, nextIndex: 0 };
    await advanceChunkQueue();
  }

  async function speakPatriciaMessage(message: ChatMessage) {
    if (message.sender !== "patricia" || message.audioLoading) return;
    setNotice(null);
    try {
      const chunkPromises = getOrCreateChunkPromises(message.id, message.text);
      await playChunkQueue(message.id, chunkPromises);
    } catch {
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
    if (latest?.sender === "patricia" && !latest.audioLoading && !autoPlayedMessageIds.current.has(latest.id)) {
      autoPlayedMessageIds.current.add(latest.id);
      speakPatriciaMessage(latest);
    }
  }, [messages.length]);

  useEffect(() => {
    return () => {
      stopPatriciaPlayback();
    };
  }, []);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardWillShow", (event) => {
      setKeyboardHeight(Math.max(0, event.endCoordinates.height - insets.bottom));
      requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: true }));
    });
    const changeSubscription = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
      setKeyboardHeight(Math.max(0, event.endCoordinates.height - insets.bottom));
      requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: true }));
    });
    const hideSubscription = Keyboard.addListener("keyboardWillHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      changeSubscription.remove();
      hideSubscription.remove();
    };
  }, [insets.bottom]);

  useEffect(() => {
    // expo-audio's status carries a real "just finished" edge signal --
    // far more reliable than inferring completion from `!playing &&
    // currentTime > 0`, which can misfire during the brief window a new
    // chunk's source is still loading and silently stall a multi-chunk reply.
    if (patriciaPlayerStatus.didJustFinish && activeQueueRef.current?.messageId === speakingMessageId) {
      advanceChunkQueue();
    }
  }, [patriciaPlayerStatus.didJustFinish, speakingMessageId]);

  async function getPatriciaReply(parentMessage: string) {
    const response = await sendChatMessage({
      sessionId,
      message: parentMessage,
      childId: seed.childId || activeChildId || "primary-child",
      language: profile?.language || "en",
      ambientContext: ambientContextFromSeed(seed),
      contextSeed: backendContextSeedFromSeed(seed)
    });
    const reply = response.message.text;
    if (isCrisisTemplate(reply) && !isExplicitEmergencyOrDistress(parentMessage)) {
      const normalized = parentMessage.toLowerCase();
      if (/\b(developing|development|milestone|right way|normal|on track|look for)\b/.test(normalized)) {
        return developmentReply(childName);
      }
      if (/\b(vaccine|shot|immunization|dtap|hepatitis|hib|pcv|polio|rotavirus)\b/.test(normalized)) {
        return vaccineReply(childName);
      }
      return "I hear the question. Let's stay with what you are actually asking. Tell me what you noticed, when it happened, and what feels most unclear right now.";
    }
    return reply;
  }

  async function appendPatriciaReply(reply: string) {
    const message = makeMessage("patricia", reply);
    // Kick off TTS for every chunk in parallel immediately. Only the first
    // chunk -- usually one short sentence -- gates how soon voice can start,
    // instead of the whole reply having to finish synthesizing first.
    const chunkPromises = getOrCreateChunkPromises(message.id, message.text);
    const firstChunkReady = chunkPromises[0];

    // Race a short window so that on the common case (fast first chunk), text
    // and voice land on screen in the same render instead of text appearing
    // first and audio trickling in seconds later. "Patricia is thinking..."
    // stays up for this whole race, so there is never a gap where nothing is
    // visible.
    const prepared = firstChunkReady
      ? await Promise.race([firstChunkReady.then(() => true), wait(1800).then(() => false)])
      : true;

    if (prepared) {
      autoPlayedMessageIds.current.add(message.id);
      // Clear "thinking" and reveal the message + voice together in one update.
      setPatriciaThinking(false);
      setMessages((current) => [...current, message]);
      await playChunkQueue(message.id, chunkPromises);
      return;
    }

    // First chunk is taking longer than the window — reveal text now (still
    // exactly when "thinking" clears, so there's no blank gap) and let voice
    // catch up as soon as it's ready.
    setPatriciaThinking(false);
    setMessages((current) => [...current, { ...message, audioLoading: true }]);
    firstChunkReady
      .then(async () => {
        setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, audioLoading: false } : item)));
        autoPlayedMessageIds.current.add(message.id);
        await playChunkQueue(message.id, chunkPromises);
      })
      .catch(() => {
        setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, audioLoading: false } : item)));
        setNotice("Patricia could not play audio just now. You can tap replay to try again.");
      });
  }

  async function sendMessage() {
    const message = draft.trim();
    if (!message) return;
    setDraft("");
    setMessages((current) => [...current, makeMessage("parent", message)]);
    setPatriciaThinking(true);
    try {
      const reply = await getPatriciaReply(message);
      // Do not clear "thinking" here — appendPatriciaReply clears it at the exact
      // moment the reply (text + voice, or text with voice catching up) is ready
      // to show, so the indicator never disappears before there's something to see.
      await appendPatriciaReply(reply);
    } catch {
      await appendPatriciaReply("I hear you. Start with the part that feels heaviest, and we can make it smaller together.");
    }
  }

  async function attachPhoto() {
    setNotice(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice("Photo access is needed to share a picture with Patricia.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8
      });
      if (result.canceled || !result.assets[0]?.uri) return;

      const uri = result.assets[0].uri;
      setMessages((current) => [...current, makeMessage("parent", "Shared a photo", uri)]);
      setPatriciaThinking(true);
      try {
        const reply = await getPatriciaReply("I just shared a photo with you.");
        await appendPatriciaReply(reply);
      } catch {
        await appendPatriciaReply(
          `Thank you for showing me. I cannot see photos yet, but tell me what you want me to know about it, and I will help you think it through.`
        );
      }
    } catch {
      setNotice("I could not open photos just now. Try again in a moment.");
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

  async function toggleVoicePause() {
    try {
      if (voiceMode === "recording") {
        recorder.pause();
        setVoiceMode("paused");
        return;
      }
      if (voiceMode === "paused") {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          shouldRouteThroughEarpiece: false
        });
        recorder.record();
        setVoiceMode("recording");
      }
    } catch {
      setNotice("Patricia could not resume listening. Try starting a fresh voice note.");
      setVoiceMode("paused");
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
      setPatriciaThinking(true);
      try {
        const reply = await getPatriciaReply(transcript);
        // appendPatriciaReply clears "thinking" once the reply is actually ready to show.
        await appendPatriciaReply(reply);
      } catch {
        await appendPatriciaReply(patriciaReply());
      }
      setVoiceMode("idle");
    } catch {
      const transcript = mockTranscriptFromSeed(seed);
      setMessages((current) => [...current, makeMessage("parent", transcript)]);
      await appendPatriciaReply("I had trouble hearing the recording clearly, so I saved a placeholder for now. Tell me the part you most want help sorting out.");
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

      <ScrollView
        ref={scrollViewRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingTop: 24, paddingBottom: 138 + insets.bottom + keyboardHeight, gap: 14 }}
      >
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
              <View style={{ maxWidth: 248, borderRadius: 16, backgroundColor: fromParent ? theme.colors.bluePrimary : theme.colors.card, paddingHorizontal: 14, paddingVertical: 15, gap: message.imageUri ? 8 : fromParent ? 0 : 10 }}>
                {message.imageUri ? (
                  <Image source={{ uri: message.imageUri }} style={{ width: 200, height: 200, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)" }} contentFit="cover" />
                ) : null}
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
        {patriciaThinking ? (
          <View style={{ flexDirection: "row", justifyContent: "flex-start", alignItems: "flex-start", gap: 8 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>P</Text>
            </View>
            <View style={{ maxWidth: 248, borderRadius: 16, backgroundColor: theme.colors.card, paddingHorizontal: 14, paddingVertical: 15 }}>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 14, lineHeight: 20, fontStyle: "italic" }}>Patricia is thinking...</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ position: "absolute", left: 16, right: 16, bottom: composerBottom, gap: 9 }}>
        {isVoiceActive ? (
          <View style={{ minHeight: 66, borderRadius: 28, backgroundColor: theme.colors.voicePanel, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, paddingVertical: 9, boxShadow: "0 8px 24px rgba(10, 20, 28, 0.24)" }}>
            <Pressable disabled={voiceMode === "transcribing"} onPress={discardVoiceMessage} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", opacity: voiceMode === "transcribing" ? 0.4 : 1 }}>
              <SfIcon name="trash" color="white" size={22} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 72, gap: 6 }}>
              <Text selectable numberOfLines={1} style={{ color: "white", fontSize: 15, lineHeight: 18, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                {voiceMode === "transcribing" ? "Sending" : formatDuration(recorderState.durationMillis)}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                {Array.from({ length: 18 }).map((_, index) => {
                  const height = 3 + ((index * 7 + Math.floor(recorderState.durationMillis / 180)) % 14);
                  const active = voiceMode === "recording" && index % 3 !== 0;
                  return <View key={index} style={{ flex: 1, height, borderRadius: 3, backgroundColor: active ? theme.colors.bluePrimary : "rgba(255, 255, 255, 0.42)" }} />;
                })}
              </View>
            </View>
            <Pressable disabled={voiceMode === "transcribing"} onPress={toggleVoicePause} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: voiceMode === "paused" ? "white" : "#F05A73", alignItems: "center", justifyContent: "center", opacity: voiceMode === "transcribing" ? 0.4 : 1 }}>
              <SfIcon name={voiceMode === "paused" ? "mic.fill" : "pause.fill"} color={voiceMode === "paused" ? theme.colors.bluePrimary : "white"} size={20} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send voice message"
              disabled={voiceMode === "transcribing"}
              onPress={sendVoiceMessage}
              style={{
                minWidth: 72,
                height: 44,
                borderRadius: 22,
                backgroundColor: theme.colors.bluePrimary,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 5,
                paddingHorizontal: 11,
                opacity: voiceMode === "transcribing" ? 0.55 : 1
              }}
            >
              <SfIcon name="paperplane.fill" color="white" size={15} />
              <Text selectable={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={{ color: "white", fontSize: 13, fontWeight: "800" }}>
                {voiceMode === "transcribing" ? "Sending" : "Send"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ minHeight: 58, borderRadius: 29, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Share a photo with Patricia" onPress={attachPhoto} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }}>
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
