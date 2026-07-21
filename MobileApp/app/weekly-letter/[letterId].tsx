import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getWeeklyLetter, markWeeklyLetterRead, type WeeklyLetter } from "@/api/weekly-letters";
import { configurePatriciaPlayback, fetchPatriciaSpeechAudio, pausePatriciaPlayer } from "@/audio/patricia-voice";
import { RequireAuth, useAuth } from "@/auth/auth-context";
import { openPatricia } from "@/components/talk-to-patricia-button";
import { Pill, SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatLetterDate(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat("en", { month: "long", day: "numeric" });
  return `${formatter.format(new Date(startDate))} - ${formatter.format(new Date(endDate))}`;
}

function letterSpeechText(letter: WeeklyLetter) {
  return `${letter.greeting}\n\n${letter.bodyText}\n\n${letter.closing}`;
}

export default function WeeklyLetterScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const letterId = firstParam(params.letterId) || "";
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [autoPlayedLetterId, setAutoPlayedLetterId] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const childName = profile?.childName || "Sofia";

  const letterQuery = useQuery({
    queryKey: ["weekly-letter", letterId],
    queryFn: () => getWeeklyLetter(letterId),
    enabled: Boolean(letterId)
  });

  const letter = letterQuery.data;
  const speechText = useMemo(() => (letter ? letterSpeechText(letter) : ""), [letter]);
  const isPlaying = status.playing;

  async function playLetter(nextLetter = letter, forceRestart = false) {
    if (!nextLetter) return;
    setNotice(null);

    if (isPlaying && !forceRestart) {
      pausePatriciaPlayer(player);
      return;
    }

    setAudioLoading(true);
    try {
      await configurePatriciaPlayback();
      const uri = audioUri || (await fetchPatriciaSpeechAudio(letterSpeechText(nextLetter), `weekly-${nextLetter.letterId}`));
      setAudioUri(uri);
      player.replace({ uri });
      player.seekTo(0);
      player.play();
    } catch {
      setNotice("Patricia could not play this letter just now. Tap replay to try again.");
    } finally {
      setAudioLoading(false);
    }
  }

  useEffect(() => {
    if (!letter || autoPlayedLetterId === letter.letterId) return;
    setAutoPlayedLetterId(letter.letterId);
    markWeeklyLetterRead(letter.letterId).catch(() => undefined);
    playLetter(letter, true).catch(() => undefined);
  }, [autoPlayedLetterId, letter?.letterId]);

  useEffect(() => {
    return () => {
      pausePatriciaPlayer(player);
    };
  }, []);

  function goBack() {
    pausePatriciaPlayer(player);
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/reports");
  }

  async function shareLetter() {
    if (!letter) return;
    await Share.share({
      message: `${letter.title}\n${formatLetterDate(letter.weekStartDate, letter.weekEndDate)}\n\n${speechText}`
    });
  }

  return (
    <RequireAuth>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View
          style={{
            height: insets.top + 66,
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
          <Text selectable style={{ color: theme.colors.text, fontSize: 16, fontWeight: "800" }}>Weekly Letter</Text>
          <Pressable onPress={shareLetter} disabled={!letter} style={{ minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center", opacity: letter ? 1 : 0.35 }}>
            <SfIcon name="doc.text" color={theme.colors.greyIcon} size={22} />
          </Pressable>
        </View>

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 20, paddingTop: 24, paddingBottom: insets.bottom + 34, gap: 18 }}
          style={{ backgroundColor: theme.colors.background }}
        >
          {letterQuery.isLoading ? (
            <Text selectable style={{ color: theme.colors.muted, fontSize: 14 }}>Opening Patricia's letter...</Text>
          ) : null}

          {letterQuery.isError ? (
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: theme.colors.error, backgroundColor: "#FDEBEC", padding: 16 }}>
              <Text selectable style={{ color: theme.colors.error, fontSize: 14, fontWeight: "700" }}>This weekly letter could not be opened.</Text>
            </View>
          ) : null}

          {letter ? (
            <>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Pill label={letter.themeLabel} />
                  <Text selectable style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "700" }}>
                    {formatLetterDate(letter.weekStartDate, letter.weekEndDate)}
                  </Text>
                </View>
                <Text selectable style={{ color: theme.colors.text, fontSize: 28, fontWeight: "900", lineHeight: 34 }}>
                  {letter.title}
                </Text>
                <Text selectable style={{ color: theme.colors.muted, fontSize: 14, lineHeight: 20 }}>
                  Patricia reads each letter in the same voice you hear throughout Nianza.
                </Text>
              </View>

              <View style={{ borderRadius: 22, backgroundColor: theme.colors.card, padding: 18, gap: 14, borderLeftWidth: 4, borderLeftColor: theme.colors.bluePrimary }}>
                <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "700" }}>{letter.greeting}</Text>
                {letter.bodyText.split("\n\n").map((paragraph) => (
                  <Text key={paragraph} selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 23 }}>
                    {paragraph}
                  </Text>
                ))}
                <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "700" }}>{letter.closing}</Text>
              </View>

              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={() => playLetter(letter)}
                  style={{
                    minHeight: 58,
                    borderRadius: 29,
                    backgroundColor: theme.colors.bluePrimary,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10
                  }}
                >
                  <SfIcon name={isPlaying ? "pause.fill" : "speaker.wave.2.fill"} color="white" size={22} />
                  <Text selectable={false} style={{ color: "white", fontSize: 15, fontWeight: "900" }}>
                    {audioLoading ? "Preparing Patricia..." : isPlaying ? "Pause Patricia" : "Replay Patricia's letter"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    pausePatriciaPlayer(player);
                    openPatricia({
                      source: "weekly-letter",
                      eventType: "weekly-letter",
                      childName,
                      childId: letter.childId,
                      entityId: letter.letterId,
                      title: letter.title,
                      detail: letter.preview,
                      occurredAt: letter.weekEndDate
                    });
                  }}
                  style={{
                    minHeight: 58,
                    borderRadius: 29,
                    borderWidth: 1,
                    borderColor: theme.colors.bluePrimary,
                    backgroundColor: "white",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10
                  }}
                >
                  <SfIcon name="mic.fill" color={theme.colors.bluePrimary} size={22} />
                  <Text selectable={false} style={{ color: theme.colors.blueDeep, fontSize: 15, fontWeight: "900" }}>
                    Talk to Patricia about this
                  </Text>
                </Pressable>
              </View>

              {notice ? (
                <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center", lineHeight: 17 }}>
                  {notice}
                </Text>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </View>
    </RequireAuth>
  );
}
