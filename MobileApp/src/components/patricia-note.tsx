import { ReactNode, useEffect, useMemo, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Pressable, Text, View } from "react-native";
import { configurePatriciaPlayback, fetchPatriciaSpeechAudio, pausePatriciaPlayer } from "@/audio/patricia-voice";
import { SfIcon } from "@/components/screen-spec";
import { normalizePatriciaDisplayText } from "@/text/patricia-text";
import { theme } from "@/theme/theme";

type PatriciaNoteProps = {
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export function PatriciaNote({ children, actionLabel, onAction }: PatriciaNoteProps) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noteText = useMemo(() => (typeof children === "string" ? normalizePatriciaDisplayText(children) : ""), [children]);
  const isPlaying = status.playing;

  useEffect(() => {
    return () => {
      pausePatriciaPlayer(player);
    };
  }, []);

  useEffect(() => {
    setAudioUri(null);
  }, [noteText]);

  async function togglePlay() {
    if (isPlaying) {
      try {
        player.pause();
      } catch {
        setNotice("Patricia could not pause audio just now.");
      }
      return;
    }

    setNotice(null);
    setIsLoading(true);
    try {
      await configurePatriciaPlayback();
      let uri = audioUri;
      if (!uri) {
        uri = await fetchPatriciaSpeechAudio(noteText, "home-note");
        setAudioUri(uri);
      }
      player.replace({ uri });
      player.seekTo(0);
      player.play();
    } catch {
      setNotice("Patricia could not play this note just now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radii.card, padding: 18, borderLeftWidth: 3, borderLeftColor: theme.colors.bluePrimary, gap: 12 }}>
      <View style={{ position: "absolute", top: 14, right: 14, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bluePrimary }}>
        <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>P</Text>
      </View>
      <Text selectable style={{ color: theme.colors.text, fontSize: 16, lineHeight: 23, paddingRight: 30, fontStyle: "italic" }}>{noteText || children}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable onPress={togglePlay} disabled={isLoading || !noteText} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", opacity: isLoading || !noteText ? 0.65 : 1 }}>
          {isPlaying ? (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <View style={{ width: 4, height: 16, backgroundColor: "white", borderRadius: 2 }} />
              <View style={{ width: 4, height: 16, backgroundColor: "white", borderRadius: 2 }} />
            </View>
          ) : (
            <SfIcon name="play" color="white" size={18} />
          )}
        </Pressable>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12 }}>{isLoading ? "Preparing Patricia's note" : isPlaying ? "Playing Patricia's note" : "Listen to Patricia's note"}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={{
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderRadius: 18,
            backgroundColor: "white",
            paddingHorizontal: 13,
            paddingVertical: 9
          }}
        >
          <SfIcon name="bubble.left.and.bubble.right.fill" size={16} color={theme.colors.bluePrimary} />
          <Text selectable={false} style={{ color: theme.colors.blueDeep, fontSize: 12, fontWeight: "900" }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
      {isPlaying ? <View style={{ height: 2, borderRadius: 1, backgroundColor: theme.colors.bluePrimary }} /> : null}
      {notice ? <Text selectable style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 15 }}>{notice}</Text> : null}
    </View>
  );
}
