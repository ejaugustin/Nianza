import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { recordVoiceMemory, type VoiceMemoryType } from "@/api/voice-memories";
import { RequireAuth, useAuth } from "@/auth/auth-context";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

const MAX_CAPSULE_SECONDS = 90;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDuration(durationMillis: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function contentTypeFromUri(uri: string | null) {
  if (!uri) return "audio/mp4";
  if (uri.endsWith(".wav")) return "audio/wav";
  if (uri.endsWith(".caf")) return "audio/x-caf";
  return "audio/mp4";
}

type Stage = "idle" | "recording" | "paused" | "review" | "saving" | "saved";

// N3 (child voice) / N2 (parent capsule) capture flow -- shares one screen
// per the brief's "build together" instruction. No transcription step: the
// audio itself IS the memory, nothing gets converted to text. Deliberately
// lighter chrome than the M14/N5 recording panel (no dark navy full-bleed
// takeover) since this is meant to feel like a quiet, personal moment, not a
// clinical capture flow.
export default function VoiceMemoryCaptureScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { activeChildId, profile } = useAuth();
  const childId = firstParam(params.childId) || activeChildId || "primary-child";
  const type = (firstParam(params.type) as VoiceMemoryType) || "child-voice";
  const isCapsule = type === "parent-capsule";
  const childName = profile?.childName || "your child";

  const [stage, setStage] = useState<Stage>("idle");
  const [label, setLabel] = useState("");
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  async function startRecording() {
    setNotice(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setNotice("Microphone permission is needed to record.");
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldRouteThroughEarpiece: false });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStage("recording");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not start recording. Please try again.");
      setStage("idle");
    }
  }

  async function discardRecording() {
    try {
      if (stage === "recording" || stage === "paused") await recorder.stop();
    } catch {
      // Recorder may already be stopped by the native layer.
    }
    setStage("idle");
    setRecordingUri(null);
    setRecordingDurationSeconds(0);
    setLabel("");
  }

  function togglePause() {
    if (stage === "recording") {
      recorder.pause();
      setStage("paused");
      return;
    }
    if (stage === "paused") {
      recorder.record();
      setStage("recording");
    }
  }

  async function finishRecording() {
    setNotice(null);
    try {
      if (recorderState.isRecording || stage === "recording" || stage === "paused") {
        await recorder.stop();
      }
    } catch {
      // continue -- we still try to read whatever was captured
    }
    const uri = recorder.uri || recorderState.url;
    const durationSeconds = Math.round(recorderState.durationMillis / 1000);
    setRecordingUri(uri);
    setRecordingDurationSeconds(durationSeconds);
    setStage("review");
    if (isCapsule && durationSeconds > MAX_CAPSULE_SECONDS) {
      setNotice(`Capsules are kept short -- under ${MAX_CAPSULE_SECONDS} seconds. This one runs a little long; you can re-record or save it anyway.`);
    }
  }

  async function saveMemory() {
    if (!recordingUri) {
      setNotice("Record something first.");
      return;
    }
    setStage("saving");
    setNotice(null);
    try {
      const audioBase64 = await FileSystem.readAsStringAsync(recordingUri, { encoding: FileSystem.EncodingType.Base64 });
      await recordVoiceMemory({
        childId,
        type,
        audioBase64,
        contentType: contentTypeFromUri(recordingUri),
        durationSeconds: recordingDurationSeconds || undefined,
        label: label.trim() || undefined
      });
      // The Milestones screen (and its memory book sheet) stays mounted
      // underneath this one in the nav stack rather than remounting on
      // router.back() -- without this, its voice-memories query would keep
      // serving up to 30s of stale cached data and the parent would go back
      // to an empty-looking memory book right after recording something.
      queryClient.invalidateQueries({ queryKey: ["voice-memories", childId] });
      setStage("saved");
    } catch (err) {
      console.error("voice memory save failed", err);
      setNotice("I couldn't save that just now. Try again in a moment.");
      setStage("review");
    }
  }

  const isVoiceActive = stage === "recording" || stage === "paused";
  const heading = isCapsule ? `A message for ${childName}, for later` : `Let's keep ${childName}'s voice`;
  const prompt = isCapsule
    ? `Say whatever you want ${childName} to have someday. I'll keep it safe until they're grown -- not even you'll be able to hear it back once it's saved.`
    : `I'd love to hear ${childName} -- talking, laughing, singing, whatever's happening right now. I'll have it ready for you to listen back to anytime.`;

  return (
    <RequireAuth>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View
          style={{
            height: insets.top + 62,
            paddingTop: insets.top,
            backgroundColor: "white",
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20
          }}
        >
          <Pressable onPress={goBack} style={{ minWidth: 44, minHeight: 44, alignItems: "flex-start", justifyContent: "center" }}>
            <SfIcon name="chevron.left" color={theme.colors.text} size={22} />
          </Pressable>
          <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>
            {isCapsule ? "Voice capsule" : "Voice memory"}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, gap: 20, paddingBottom: 40 }}>
          {stage === "saved" ? (
            <View style={{ gap: 16 }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 20, fontWeight: "700", lineHeight: 27 }}>
                {isCapsule ? "Got it. I'll keep this safe for them." : `Got it -- tucked into ${childName}'s memory book.`}
              </Text>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 19 }}>
                {isCapsule
                  ? "It stays locked until they're grown -- no reminders, no streaks, just there when the time comes."
                  : "Listen back anytime, whenever you'd like."}
              </Text>
              <Pressable onPress={goBack} style={{ minHeight: 52, borderRadius: 26, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
                <Text selectable={false} style={{ color: "white", fontSize: 15, fontWeight: "800" }}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={{ gap: 8 }}>
                <Text selectable style={{ color: theme.colors.text, fontSize: 19, fontWeight: "700", lineHeight: 25 }}>
                  {heading}
                </Text>
                <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 19 }}>
                  {prompt}
                </Text>
              </View>

              {stage === "review" || stage === "saving" ? (
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "white", padding: 14 }}>
                    <SfIcon name="mic.fill" color={theme.colors.bluePrimary} size={20} />
                    <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700" }}>
                      {formatDuration(recordingDurationSeconds * 1000)} recorded
                    </Text>
                  </View>
                  <TextInput
                    value={label}
                    onChangeText={setLabel}
                    editable={stage !== "saving"}
                    placeholder={isCapsule ? "A short label (optional) -- \"For your 18th birthday\"" : "Give it a name (optional) -- \"First time saying dada\""}
                    placeholderTextColor={theme.colors.greyIcon}
                    style={{
                      minHeight: 50,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: "white",
                      paddingHorizontal: 14,
                      color: theme.colors.text,
                      fontSize: 14
                    }}
                  />
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      disabled={stage === "saving"}
                      onPress={discardRecording}
                      style={{ flex: 1, minHeight: 50, borderRadius: 25, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center", opacity: stage === "saving" ? 0.5 : 1 }}
                    >
                      <Text selectable={false} style={{ color: theme.colors.muted, fontSize: 14, fontWeight: "700" }}>Re-record</Text>
                    </Pressable>
                    <Pressable
                      disabled={stage === "saving"}
                      onPress={saveMemory}
                      style={{ flex: 1, minHeight: 50, borderRadius: 25, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", opacity: stage === "saving" ? 0.6 : 1 }}
                    >
                      <Text selectable={false} style={{ color: "white", fontSize: 14, fontWeight: "800" }}>
                        {stage === "saving" ? "Saving..." : isCapsule ? "Keep this one for later" : "Save"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : isVoiceActive ? (
                <View style={{ minHeight: 66, borderRadius: 28, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, paddingVertical: 9 }}>
                  <Pressable onPress={discardRecording} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }}>
                    <SfIcon name="trash" color={theme.colors.muted} size={20} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text selectable={false} style={{ color: theme.colors.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                      {formatDuration(recorderState.durationMillis)}
                    </Text>
                  </View>
                  <Pressable onPress={togglePause} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: stage === "paused" ? theme.colors.bluePrimary : "#F05A73", alignItems: "center", justifyContent: "center" }}>
                    <SfIcon name={stage === "paused" ? "mic.fill" : "pause.fill"} color="white" size={20} />
                  </Pressable>
                  <Pressable onPress={finishRecording} style={{ minWidth: 72, height: 44, borderRadius: 22, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }}>
                    <Text selectable={false} style={{ color: "white", fontSize: 13, fontWeight: "800" }}>Done</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={startRecording}
                  style={{ minHeight: 58, borderRadius: 29, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}
                >
                  <SfIcon name="mic.fill" color={theme.colors.bluePrimary} size={20} />
                  <Text selectable={false} style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700" }}>Tap to record</Text>
                </Pressable>
              )}

              {notice ? <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center" }}>{notice}</Text> : null}
            </>
          )}
        </ScrollView>
      </View>
    </RequireAuth>
  );
}
