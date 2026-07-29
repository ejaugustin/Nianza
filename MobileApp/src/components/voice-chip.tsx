import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Pressable, Text, View } from "react-native";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";
import type { VoiceMemory } from "@/api/voice-memories";

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return null;
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function formatRecordedDate(recordedAt: string) {
  const date = new Date(recordedAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

/** N3/N2: a single pill for one voice memory. Plays child-voice memories
 * directly; renders parent-capsule memories as a locked chip (no play
 * control at all, since the server never sends a playbackUrl pre-graduation
 * -- there's nothing to attempt to play). */
export function VoiceChip({ memory, onDelete }: { memory: VoiceMemory; onDelete?: (memory: VoiceMemory) => void }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;
  const durationLabel = formatDuration(memory.durationSeconds);

  function togglePlay() {
    if (!memory.playbackUrl) return;
    if (isPlaying) {
      player.pause();
      return;
    }
    player.replace({ uri: memory.playbackUrl });
    player.play();
  }

  if (memory.locked) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
          paddingVertical: 8,
          paddingHorizontal: 12
        }}
      >
        <SfIcon name="circle" color={theme.colors.muted} size={15} />
        <Text selectable numberOfLines={1} style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "700", maxWidth: 140 }}>
          {memory.label || "A message, saved for later"}
        </Text>
        {onDelete ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Delete voice memory" onPress={() => onDelete(memory)} style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
            <SfIcon name="trash" color={theme.colors.greyIcon} size={13} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: isPlaying ? theme.colors.bluePrimary : theme.colors.border,
        backgroundColor: isPlaying ? theme.colors.blueLight : "white",
        paddingVertical: 6,
        paddingHorizontal: 10
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pause voice memory" : "Play voice memory"}
        onPress={togglePlay}
        style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}
      >
        <SfIcon name={isPlaying ? "pause.fill" : "play"} color="white" size={13} />
      </Pressable>
      <View style={{ gap: 1 }}>
        <Text selectable numberOfLines={1} style={{ color: theme.colors.text, fontSize: 12, fontWeight: "700", maxWidth: 120 }}>
          {memory.label || formatRecordedDate(memory.recordedAt)}
        </Text>
        {durationLabel ? (
          <Text selectable style={{ color: theme.colors.muted, fontSize: 10 }}>{durationLabel}</Text>
        ) : null}
      </View>
      {onDelete ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Delete voice memory" onPress={() => onDelete(memory)} style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}>
          <SfIcon name="trash" color={theme.colors.greyIcon} size={14} />
        </Pressable>
      ) : null}
    </View>
  );
}
