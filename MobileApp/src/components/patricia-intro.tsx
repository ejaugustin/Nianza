import { useEffect, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Pressable, Text, View } from "react-native";
import { configurePatriciaPlayback, fetchPatriciaSpeechAudio, pausePatriciaPlayer } from "@/audio/patricia-voice";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

const introText =
  "Hello, Maria. I'm Patricia. I'm here to help you notice Sofia's milestones, keep track of visits and vaccines, and think through the moments that feel too big to hold alone. We will take this journey one day at a time.";

export function PatriciaIntro() {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const isPlaying = status.playing;

  useEffect(() => {
    return () => {
      pausePatriciaPlayer(player);
    };
  }, []);

  async function toggleIntro() {
    if (isPlaying) {
      pausePatriciaPlayer(player);
      return;
    }

    setNotice(null);
    setIsLoading(true);
    try {
      await configurePatriciaPlayback();
      let uri = audioUri;
      if (!uri) {
        uri = await fetchPatriciaSpeechAudio(introText, "onboarding-intro");
        setAudioUri(uri);
      }
      player.replace({ uri });
      player.seekTo(0);
      player.play();
    } catch {
      setNotice("Patricia could not play her introduction just now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radii.card, borderLeftWidth: 3, borderLeftColor: theme.colors.bluePrimary, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Pressable onPress={toggleIntro} disabled={isLoading} accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause Patricia introduction" : "Play Patricia introduction"} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", opacity: isLoading ? 0.65 : 1 }}>
          {isPlaying ? (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: "white" }} />
              <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: "white" }} />
            </View>
          ) : (
            <SfIcon name="play" color="white" size={18} />
          )}
        </Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700" }}>Hear Patricia first</Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>{isLoading ? "Preparing Patricia's voice..." : "A quick welcome before the details."}</Text>
        </View>
      </View>
      <Text selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 22, fontStyle: "italic" }}>{introText}</Text>
      {isPlaying ? <View style={{ height: 2, borderRadius: 1, backgroundColor: theme.colors.bluePrimary }} /> : null}
      {notice ? <Text selectable style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 15 }}>{notice}</Text> : null}
    </View>
  );
}
