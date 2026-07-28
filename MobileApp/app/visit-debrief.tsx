import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createVisitDebrief } from "@/api/visits";
import { transcribeVoiceNote } from "@/api/voice";
import { RequireAuth, useAuth } from "@/auth/auth-context";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

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

type Stage = "idle" | "recording" | "paused" | "transcribing" | "review" | "saving" | "saved";

// N5 (Parking-Lot Debrief) capture flow. Reuses the M14 recording panel
// pattern from chat.tsx (same dark navy panel, same record/pause/discard
// controls, same Deepgram STT endpoint) but this is deliberately NOT the
// chat screen: the transcript never goes through the chat model. The parent
// gets one review step to fix obvious STT errors, then a fixed confirmation
// -- Patricia does not summarize or react to the content, per the brief.
export default function VisitDebriefScreen() {
  const insets = useSafeAreaInsets();
  const { activeChildId } = useAuth();
  const childId = activeChildId || "primary-child";
  const [stage, setStage] = useState<Stage>("idle");
  const [transcript, setTranscript] = useState("");
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
      setNotice("Microphone permission is needed to record a debrief.");
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldRouteThroughEarpiece: false });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStage("recording");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not start listening. Please try again.");
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
    setTranscript("");
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
    setStage("transcribing");
    setNotice(null);
    try {
      if (recorderState.isRecording || stage === "recording" || stage === "paused") {
        await recorder.stop();
      }
    } catch {
      // continue -- we still try to read whatever was captured
    }

    const recordingUri = recorder.uri || recorderState.url;
    try {
      const audioBase64 = recordingUri
        ? await FileSystem.readAsStringAsync(recordingUri, { encoding: FileSystem.EncodingType.Base64 })
        : "";
      const response = audioBase64
        ? await transcribeVoiceNote({ audioBase64, contentType: contentTypeFromUri(recordingUri), language: "en" })
        : null;
      setTranscript(response?.transcript || "");
      setStage("review");
      if (!response?.transcript) {
        setNotice("I couldn't make out the recording clearly. Feel free to type it instead.");
      }
    } catch {
      setTranscript("");
      setStage("review");
      setNotice("I couldn't transcribe that recording. You can type it in below instead.");
    }
  }

  async function saveDebrief() {
    if (!transcript.trim()) {
      setNotice("Add a note before saving.");
      return;
    }
    setStage("saving");
    setNotice(null);
    try {
      await createVisitDebrief(childId, transcript.trim());
      setStage("saved");
    } catch {
      setNotice("I couldn't save that just now. Try again in a moment.");
      setStage("review");
    }
  }

  const isVoiceActive = stage === "recording" || stage === "paused" || stage === "transcribing";

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
          <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>While it's fresh</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, gap: 20, paddingBottom: 40 }}>
          {stage === "saved" ? (
            <View style={{ gap: 16 }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 20, fontWeight: "700", lineHeight: 27 }}>
                Got it. I'll have it ready for the next one.
              </Text>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 19 }}>
                It'll show up under "From last visit" in your next Doctor Visit Pack.
              </Text>
              <Pressable
                onPress={goBack}
                style={{ minHeight: 52, borderRadius: 26, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}
              >
                <Text selectable={false} style={{ color: "white", fontSize: 15, fontWeight: "800" }}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text selectable style={{ color: theme.colors.text, fontSize: 20, fontWeight: "700", lineHeight: 27, fontStyle: "italic" }}>
                While it's fresh -- want to tell me what the doctor said? I'll keep it with the visit.
              </Text>

              {stage === "review" || stage === "saving" ? (
                <View style={{ gap: 12 }}>
                  <TextInput
                    multiline
                    value={transcript}
                    onChangeText={setTranscript}
                    editable={stage !== "saving"}
                    placeholder="What did the doctor say?"
                    placeholderTextColor={theme.colors.greyIcon}
                    style={{
                      minHeight: 140,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: "white",
                      padding: 14,
                      color: theme.colors.text,
                      fontSize: 15,
                      lineHeight: 21,
                      textAlignVertical: "top"
                    }}
                  />
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      disabled={stage === "saving"}
                      onPress={discardRecording}
                      style={{ flex: 1, minHeight: 50, borderRadius: 25, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center", opacity: stage === "saving" ? 0.5 : 1 }}
                    >
                      <Text selectable={false} style={{ color: theme.colors.muted, fontSize: 14, fontWeight: "700" }}>Discard</Text>
                    </Pressable>
                    <Pressable
                      disabled={stage === "saving"}
                      onPress={saveDebrief}
                      style={{ flex: 1, minHeight: 50, borderRadius: 25, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", opacity: stage === "saving" ? 0.6 : 1 }}
                    >
                      <Text selectable={false} style={{ color: "white", fontSize: 14, fontWeight: "800" }}>
                        {stage === "saving" ? "Saving..." : "Save"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : isVoiceActive ? (
                <View style={{ minHeight: 66, borderRadius: 28, backgroundColor: theme.colors.voicePanel, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, paddingVertical: 9 }}>
                  <Pressable disabled={stage === "transcribing"} onPress={discardRecording} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", opacity: stage === "transcribing" ? 0.4 : 1 }}>
                    <SfIcon name="trash" color="white" size={22} />
                  </Pressable>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text selectable={false} style={{ color: "white", fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                      {stage === "transcribing" ? "Working" : formatDuration(recorderState.durationMillis)}
                    </Text>
                  </View>
                  <Pressable disabled={stage === "transcribing"} onPress={togglePause} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: stage === "paused" ? "white" : "#F05A73", alignItems: "center", justifyContent: "center", opacity: stage === "transcribing" ? 0.4 : 1 }}>
                    <SfIcon name={stage === "paused" ? "mic.fill" : "pause.fill"} color={stage === "paused" ? theme.colors.bluePrimary : "white"} size={20} />
                  </Pressable>
                  <Pressable disabled={stage === "transcribing"} onPress={finishRecording} style={{ minWidth: 72, height: 44, borderRadius: 22, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, opacity: stage === "transcribing" ? 0.55 : 1 }}>
                    <Text selectable={false} style={{ color: "white", fontSize: 13, fontWeight: "800" }}>
                      {stage === "transcribing" ? "Working" : "Done"}
                    </Text>
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
