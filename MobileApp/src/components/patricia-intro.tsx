import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Pressable, Text, View } from "react-native";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

const introAudio = require("../../assets/audio/patricia-onboarding-intro.wav");

const introText =
  "Hello, Maria. I'm Patricia. I'm here to help you notice Sofia's milestones, keep track of visits and vaccines, and think through the moments that feel too big to hold alone. We will take this journey one day at a time.";

export function PatriciaIntro() {
  const player = useAudioPlayer(introAudio);
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;

  function toggleIntro() {
    if (isPlaying) {
      player.pause();
      return;
    }

    if (status.didJustFinish) player.seekTo(0);
    player.play();
  }

  return (
    <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radii.card, borderLeftWidth: 3, borderLeftColor: theme.colors.bluePrimary, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Pressable onPress={toggleIntro} accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause Patricia introduction" : "Play Patricia introduction"} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
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
          <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>A quick welcome before the details.</Text>
        </View>
      </View>
      <Text selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 22, fontStyle: "italic" }}>{introText}</Text>
      {isPlaying ? <View style={{ height: 2, borderRadius: 1, backgroundColor: theme.colors.bluePrimary }} /> : null}
    </View>
  );
}
