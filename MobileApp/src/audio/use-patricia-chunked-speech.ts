import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { configurePatriciaPlayback, fetchPatriciaSpeechChunkAudio, pausePatriciaPlayer, splitIntoSpeechChunks } from "@/audio/patricia-voice";

type ChunkQueue = {
  key: string;
  chunkPromises: Promise<string>[];
  nextIndex: number;
};

// Shared chunked-playback primitive: splits text into short, sentence-bounded
// TTS requests, starts playing as soon as the first chunk is ready, and
// auto-advances through the rest as each one finishes. Same approach used in
// the Patricia chat screen -- pulled out here so any other screen that wants
// "Patricia speaks this out loud, with a replay control" doesn't have to
// reimplement the queue.
export function usePatriciaChunkedSpeech() {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const chunkCacheRef = useRef<Map<string, Promise<string>[]>>(new Map());
  const activeQueueRef = useRef<ChunkQueue | null>(null);
  // Guards against a chunk transition being kicked off twice in a row (e.g. a
  // stray extra status update while the previous transition is still
  // awaiting configurePatriciaPlayback/seekTo) -- without this, two
  // concurrent calls can each increment nextIndex, causing one of them to
  // see the queue as "already finished" and clear it out from under the
  // other, silently stopping playback partway through a reply.
  const isAdvancingRef = useRef(false);

  const stop = useCallback(() => {
    activeQueueRef.current = null;
    pausePatriciaPlayer(player);
    setSpeakingKey(null);
  }, [player]);

  const advance = useCallback(async () => {
    if (isAdvancingRef.current) return;
    const queue = activeQueueRef.current;
    if (!queue) return;
    if (queue.nextIndex >= queue.chunkPromises.length) {
      activeQueueRef.current = null;
      setSpeakingKey(null);
      return;
    }
    isAdvancingRef.current = true;
    const index = queue.nextIndex;
    queue.nextIndex += 1;
    let shouldRetry = false;
    try {
      const uri = await queue.chunkPromises[index];
      if (activeQueueRef.current !== queue) return; // superseded by a newer play/replay
      await configurePatriciaPlayback();
      player.replace({ uri });
      await player.seekTo(0);
      player.play();
      setSpeakingKey(queue.key);
    } catch {
      shouldRetry = activeQueueRef.current === queue;
    } finally {
      isAdvancingRef.current = false;
    }
    if (shouldRetry) advance();
  }, [player]);

  // expo-audio's status object carries a real "just finished" edge signal --
  // far more reliable than inferring completion from `!playing && currentTime
  // > 0`, which can misfire during the brief window a new source is loading.
  useEffect(() => {
    if (status.didJustFinish && activeQueueRef.current?.key === speakingKey) {
      advance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish, speakingKey]);

  const play = useCallback(
    async (key: string, text: string) => {
      let cached = chunkCacheRef.current.get(key);
      if (!cached) {
        const chunks = splitIntoSpeechChunks(text);
        cached = chunks.map((chunkText, index) => fetchPatriciaSpeechChunkAudio(chunkText, `${key}-${index}`));
        chunkCacheRef.current.set(key, cached);
      }
      if (!cached.length) return;

      setLoadingKey(key);
      try {
        await cached[0];
      } catch {
        setLoadingKey(null);
        throw new Error("Patricia could not prepare audio just now.");
      }
      setLoadingKey(null);
      activeQueueRef.current = { key, chunkPromises: cached, nextIndex: 0 };
      await advance();
    },
    [advance]
  );

  useEffect(() => stop, [stop]);

  return {
    play,
    stop,
    isSpeaking: (key: string) => speakingKey === key,
    isLoading: (key: string) => loadingKey === key
  };
}
