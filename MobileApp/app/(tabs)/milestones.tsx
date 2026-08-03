import { useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getMilestoneProgress, listCustomFirsts, recordCustomFirst, recordMilestoneObservation, type WatchForProgressItem } from "@/api/milestones";
import { getGenerationalShiftTopic } from "@/api/content";
import { markPostcardOffered } from "@/api/children";
import { deleteVoiceMemory, listVoiceMemories } from "@/api/voice-memories";
import { usePatriciaChunkedSpeech } from "@/audio/use-patricia-chunked-speech";
import { useAuth } from "@/auth/auth-context";
import { CategoryChip, EmptyCircle, ScreenTitle, SectionLabel, SfIcon, SpecCard } from "@/components/screen-spec";
import { TalkToPatriciaButton, openPatricia } from "@/components/talk-to-patricia-button";
import { VoiceChip } from "@/components/voice-chip";
import {
  ActEarlyItem,
  MilestoneDefinition,
  MilestoneTab,
  getCurrentMilestoneWindow,
  getMilestonesForTab,
  getSourceLabel,
  milestoneDomains,
  milestoneLibrary
} from "@/data/milestones";
import { possessivePronoun } from "@/text/patricia-text";
import { theme } from "@/theme/theme";

const MILESTONES_INTRO_KEY = "milestones-intro";

// N4 (Village Translator): one generational-shift topic per age window,
// picked for genuine family friction at that stage -- not every window gets
// one (the emotional-weight test from G.0 applies), and this screen only
// ever shows a single "Ask Patricia" link regardless of window per DO NOT 16.
const AGE_WINDOW_GENERATIONAL_TOPIC: Record<string, string> = {
  "2_months": "back-sleeping",
  "4_months": "rice-cereal-in-bottles",
  "6_months": "peanut-introduction",
  "9_months": "baby-walkers",
  "12_months": "no-honey-before-one",
  "18_months": "screen-time-under-two",
  "24_months": "car-seat-direction"
};

// M16 (Family postcards): the offer shows at most once every two weeks
// (server-side lastPostcardOfferAt is the source of truth; this mirrors the
// same check client-side so the banner doesn't flash before the profile
// value has loaded). "Offer" fires on showing the banner, not on the parent
// actually making a postcard -- declining still starts the cooldown, per DO
// NOT 18 (no nagging).
const POSTCARD_OFFER_COOLDOWN_DAYS = 14;

function canOfferPostcard(lastPostcardOfferAt: string | null | undefined) {
  if (!lastPostcardOfferAt) return true;
  const last = new Date(lastPostcardOfferAt).getTime();
  if (Number.isNaN(last)) return true;
  const cooldownMs = POSTCARD_OFFER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - last >= cooldownMs;
}

// A synthetic bucket key for photos added straight from the memory book,
// not tied to any specific milestone or first. Reuses the same
// Record<milestoneId, uris[]> shape/SecureStore persistence the milestone
// photos already use -- this is just one more bucket in that same map.
const MEMORY_BOOK_LOOSE_KEY = "memory-book-loose";

function milestonePhotosKey(childId: string) {
  return `milestone-photos-${childId}`;
}

function milestonesIntroText(parentFirstName: string, childName: string, sexAtBirth?: "girl" | "boy" | null) {
  const greeting = parentFirstName ? `Hi ${parentFirstName}, ` : "";
  const pronoun = possessivePronoun(sexAtBirth);
  return (
    `${greeting}I love watching how ${childName} plays, learns, talks, and moves — it tells us so much about how ` +
    `${pronoun === "their" ? "they're" : `${childName} is`} growing. These milestones are simply things many children reach around a certain age, not a race to win, ` +
    `so there's no need to worry if ${childName} takes ${pronoun} own time with any of them. Check off what you notice as it ` +
    `happens, and bring anything you're wondering about to ${childName}'s doctor at your next visit. I'm right here with you.`
  );
}

function MilestonesIntroCard({
  parentFirstName,
  childName,
  sexAtBirth
}: {
  parentFirstName: string;
  childName: string;
  sexAtBirth?: "girl" | "boy" | null;
}) {
  const patriciaSpeech = usePatriciaChunkedSpeech();
  const [notice, setNotice] = useState<string | null>(null);
  const autoPlayedRef = useRef(false);
  const introText = milestonesIntroText(parentFirstName, childName, sexAtBirth);
  const isSpeaking = patriciaSpeech.isSpeaking(MILESTONES_INTRO_KEY);
  const isLoading = patriciaSpeech.isLoading(MILESTONES_INTRO_KEY);

  async function speak() {
    setNotice(null);
    try {
      await patriciaSpeech.play(MILESTONES_INTRO_KEY, introText);
    } catch {
      setNotice("Patricia could not play this just now. Tap Replay to try again.");
    }
  }

  // Previously autoplay had no way to be interrupted once started -- this
  // toggle lets a parent stop mid-sentence instead of waiting it out.
  function handlePress() {
    if (isSpeaking || isLoading) {
      patriciaSpeech.stop();
    } else {
      speak();
    }
  }

  useEffect(() => {
    if (autoPlayedRef.current) return;
    autoPlayedRef.current = true;
    speak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SpecCard style={{ gap: 10, backgroundColor: theme.colors.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
          <Text selectable={false} style={{ color: "white", fontSize: 13, fontWeight: "700" }}>
            P
          </Text>
        </View>
        <Text selectable style={{ flex: 1, color: theme.colors.text, fontSize: 13, fontWeight: "800" }}>
          Let's talk about how {childName} is growing
        </Text>
      </View>
      <Text selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>
        {introText}
      </Text>
      <Pressable
        onPress={handlePress}
        style={{
          alignSelf: "flex-start",
          minHeight: 32,
          borderRadius: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          paddingHorizontal: 10,
          backgroundColor: isSpeaking ? theme.colors.blueLight : "white"
        }}
      >
        <SfIcon name={isSpeaking ? "stop.fill" : "speaker.wave.2.fill"} color={theme.colors.bluePrimary} size={17} />
        <Text selectable style={{ color: theme.colors.blueDeep, fontSize: 12, fontWeight: "700" }}>
          {isLoading ? "Loading" : isSpeaking ? "Stop" : "Replay"}
        </Text>
      </Pressable>
      {notice ? (
        <Text selectable style={{ color: theme.colors.muted, fontSize: 11 }}>
          {notice}
        </Text>
      ) : null}
    </SpecCard>
  );
}

function normalizePatriciaText(text: string, childName: string) {
  return text
    .replace(/\bhis or her\b/gi, `${childName}'s`)
    .replace(/\bhe or she\b/gi, childName)
    .replace(/\bhim or her\b/gi, childName)
    .replace(/\bhimself or herself\b/gi, "themself");
}

function milestoneDescription(milestone: MilestoneDefinition, childName: string) {
  const text = normalizePatriciaText(milestone.text, childName).replace(/\.$/, "");
  return `This is one of the ${milestone.domain.toLowerCase()} signs Patricia is watching for around this age: ${text}.`;
}

function patriciaMilestoneNote(milestone: MilestoneDefinition, childName: string) {
  const text = normalizePatriciaText(milestone.text, childName).toLowerCase();
  if (milestone.tab === "Movement") return `When you notice ${childName} ${text}, mark it here. Small body skills often arrive during ordinary floor time.`;
  if (milestone.tab === "Language") return `When you hear this from ${childName}, answer back. I treat these little sounds as the beginning of conversation.`;
  if (milestone.tab === "Social") return `This is ${childName} connecting with you. If you notice it, pause and enjoy it before you check the box.`;
  if (milestone.tab === "Cognitive") return `This is ${childName} making sense of the world. Slow repetition is enough.`;
  return `This is a care rhythm for ${childName}, not a test. Mark it when it feels true in real life.`;
}

function encouragementFor(milestone: MilestoneDefinition, childName: string) {
  if (milestone.selfCare) {
    return ["Let the routine stay calm and repeatable.", `Bring it up at visits if care tasks feel unusually hard for ${childName}.`];
  }
  if (milestone.tab === "Movement") {
    return [`Offer short, calm floor moments when ${childName} is alert.`, "Keep your face or a simple toy nearby so practice feels playful."];
  }
  if (milestone.tab === "Language") {
    return ["Talk in short, warm phrases during care moments.", `Pause after sounds so ${childName} gets a turn.`];
  }
  if (milestone.tab === "Social") {
    return [`Follow ${childName}'s gaze and facial expressions.`, `Repeat the simple games that make ${childName} light up.`];
  }
  return [`Move slowly and give ${childName} time to look, reach, or respond.`, "Use ordinary routines as tiny practice moments."];
}

function watchText(items: ActEarlyItem[], childName: string, parentFirstName: string) {
  const parentAside = parentFirstName ? `, ${parentFirstName}` : "";
  if (!items.length) {
    return `If something about ${childName} feels off, make a note for the next visit${parentAside} — I can help you put the question into words.`;
  }

  const sample = items.slice(0, 4).map((item) => normalizePatriciaText(item.text, childName).replace(/\.$/, "").toLowerCase());
  return `If ${childName} isn't yet doing things like ${sample.join("; ")}, just keep a note and bring it to ${childName}'s doctor. This isn't an alarm${parentAside} — it's simply a way to organize what you're noticing.`;
}

export default function MilestonesScreen() {
  const { profile, activeChildId, updateProfile } = useAuth();
  const { openMemoryBook: openMemoryBookParam, openAddFirst: openAddFirstParam } = useLocalSearchParams<{ openMemoryBook?: string; openAddFirst?: string }>();
  const insets = useSafeAreaInsets();
  const childId = activeChildId || "primary-child";
  const childName = profile?.childName || "your child";
  const parentFirstName = profile?.parentFirstName || profile?.parentName?.split(/\s+/)[0] || "";
  const [activeDomain, setActiveDomain] = useState<MilestoneTab>("Movement");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const [watchChecked, setWatchChecked] = useState<Record<string, boolean>>({});
  const [watchOpen, setWatchOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<MilestoneDefinition | null>(null);
  const [notice, setNotice] = useState("");
  // D7 (Custom "firsts"): pure memory, zero clinical surface -- terracotta
  // register throughout to signal "not a milestone" at a glance.
  const [addFirstOpen, setAddFirstOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [firstDate, setFirstDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [firstPhotoUri, setFirstPhotoUri] = useState<string | null>(null);
  const [firstSaving, setFirstSaving] = useState(false);
  const [memoryBookOpen, setMemoryBookOpen] = useState(false);
  const [postcardOffer, setPostcardOffer] = useState<{ milestoneText: string; photoUri: string | null } | null>(null);
  // Tapping a memory book photo previously did nothing at all -- the only
  // pressable surface on each tile was the small "Postcard" pill. This gives
  // the photo itself a real response: a full-screen look, with the postcard
  // action still reachable from there too.
  const [viewingPhoto, setViewingPhoto] = useState<{ uri: string; label: string } | null>(null);

  useEffect(() => {
    if (openMemoryBookParam) {
      setMemoryBookOpen(true);
      router.setParams({ openMemoryBook: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMemoryBookParam]);

  // Home's "Baby's Firsts" card deep-links here when there's nothing logged
  // yet, mirroring the openMemoryBook pattern above.
  useEffect(() => {
    if (openAddFirstParam) {
      setAddFirstOpen(true);
      router.setParams({ openAddFirst: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAddFirstParam]);

  const milestoneTextById = useMemo(() => {
    const map: Record<string, string> = {};
    milestoneLibrary.windows.forEach((window) => {
      window.milestones.forEach((milestone) => {
        map[milestone.milestoneId] = normalizePatriciaText(milestone.text, childName);
      });
    });
    return map;
  }, [childName]);

  useEffect(() => {
    let cancelled = false;
    setPhotosLoaded(false);
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(milestonePhotosKey(childId));
        if (!cancelled) setPhotos(raw ? JSON.parse(raw) : {});
      } catch {
        if (!cancelled) setPhotos({});
      } finally {
        if (!cancelled) setPhotosLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId]);

  useEffect(() => {
    if (!photosLoaded) return;
    SecureStore.setItemAsync(milestonePhotosKey(childId), JSON.stringify(photos)).catch(() => {});
  }, [photos, photosLoaded, childId]);

  const currentWindow = useMemo(
    () => getCurrentMilestoneWindow(profile?.ageWindowMonths, profile?.bornEarly, profile?.weeksEarly),
    [profile?.ageWindowMonths, profile?.bornEarly, profile?.weeksEarly]
  );
  const visibleMilestones = useMemo(() => getMilestonesForTab(currentWindow, activeDomain), [activeDomain, currentWindow]);
  const observedThisMonth = Object.values(checked).filter(Boolean).length;
  const generationalShiftTopic = AGE_WINDOW_GENERATIONAL_TOPIC[currentWindow.ageKey];
  const generationalShiftQuery = useQuery({
    queryKey: ["generational-shift", generationalShiftTopic],
    queryFn: () => getGenerationalShiftTopic(generationalShiftTopic!),
    enabled: Boolean(generationalShiftTopic),
    staleTime: 1000 * 60 * 60
  });
  const generationalShiftItem = generationalShiftQuery.data;
  const activeWatchText = watchText(currentWindow.actEarly, childName, parentFirstName);
  const milestoneProgressQuery = useQuery({
    queryKey: ["milestone-progress", childId],
    queryFn: () => getMilestoneProgress(childId),
    staleTime: 1000 * 30,
    retry: 1
  });
  const customFirstsQuery = useQuery({
    queryKey: ["custom-firsts", childId],
    queryFn: () => listCustomFirsts(childId),
    staleTime: 1000 * 30,
    retry: 1
  });
  const customFirsts = customFirstsQuery.data || [];

  // D6 memory book: photos come from three places -- CDC milestone photos
  // (local-device SecureStore, tied to a milestoneId), D7 custom firsts'
  // photos (fetched from the backend, tied to a customFirst), and loose
  // photos added straight from the memory book itself (also local-device
  // SecureStore, under MEMORY_BOOK_LOOSE_KEY). All three need to show up
  // here -- this was previously missing the firsts' photos entirely.
  const allPhotoEntries = useMemo(() => {
    const milestoneEntries = Object.entries(photos)
      .filter(([milestoneId]) => milestoneId !== MEMORY_BOOK_LOOSE_KEY)
      .flatMap(([milestoneId, uris]) => uris.map((uri) => ({ uri, label: milestoneTextById[milestoneId] || "Milestone photo" })));
    const loosePhotoEntries = (photos[MEMORY_BOOK_LOOSE_KEY] || []).map((uri) => ({ uri, label: "A moment worth keeping" }));
    const firstPhotoEntries = customFirsts.flatMap((first) =>
      (first.photoUrls || []).map((uri) => ({ uri, label: first.customName }))
    );
    return [...firstPhotoEntries, ...loosePhotoEntries, ...milestoneEntries];
  }, [photos, milestoneTextById, customFirsts]);

  // N3 (Child voice recordings): browsable strip in the memory book, only
  // fetched once the sheet is opened (no reason to hit the endpoint on every
  // milestones-screen load).
  const voiceMemoriesQuery = useQuery({
    queryKey: ["voice-memories", childId, "child-voice"],
    queryFn: () => listVoiceMemories(childId, "child-voice"),
    enabled: memoryBookOpen,
    staleTime: 1000 * 30,
    retry: 1
  });
  const voiceMemories = voiceMemoriesQuery.data?.memories || [];

  // N2 (Parent voice capsules): same list endpoint, filtered server-side to
  // type=parent-capsule. Locked entries carry no playbackUrl at all -- the
  // memory book can show "this exists" without ever being able to play it
  // before the child reaches the graduation age.
  const capsulesQuery = useQuery({
    queryKey: ["voice-memories", childId, "parent-capsule"],
    queryFn: () => listVoiceMemories(childId, "parent-capsule"),
    enabled: memoryBookOpen,
    staleTime: 1000 * 30,
    retry: 1
  });
  const capsules = capsulesQuery.data?.memories || [];

  async function removeVoiceMemory(memoryId: string) {
    try {
      await deleteVoiceMemory(childId, memoryId);
      voiceMemoriesQuery.refetch();
      capsulesQuery.refetch();
    } catch {
      setNotice("I couldn't remove that voice memory just now. Try again in a moment.");
    }
  }

  function saveLoosePhoto(uri: string) {
    setPhotos((current) => ({
      ...current,
      [MEMORY_BOOK_LOOSE_KEY]: [...(current[MEMORY_BOOK_LOOSE_KEY] || []), uri].slice(0, 60)
    }));
    setNotice(`Photo added to ${childName}'s memory book.`);
  }

  async function addMemoryBookPhotoFromCamera() {
    setNotice("");
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setNotice("Camera access is needed to take a picture. You can add one from your library instead.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]?.uri) saveLoosePhoto(result.assets[0].uri);
    } catch {
      setNotice("I could not open the camera just now. Try again in a moment.");
    }
  }

  async function addMemoryBookPhotoFromLibrary() {
    setNotice("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice("Photo access is needed to add a picture. You can keep going without one.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]?.uri) saveLoosePhoto(result.assets[0].uri);
    } catch {
      setNotice("I could not open photos just now. Try again in a moment.");
    }
  }

  // A photo doesn't have to come from checking off a milestone or logging a
  // first -- the parent should be able to drop a picture into the memory
  // book any time something's worth keeping.
  function promptAddMemoryBookPhoto() {
    Alert.alert("Add a photo", undefined, [
      { text: "Take a photo", onPress: addMemoryBookPhotoFromCamera },
      { text: "Choose from library", onPress: addMemoryBookPhotoFromLibrary },
      { text: "Cancel", style: "cancel" }
    ]);
  }
  const watchForItems = useMemo<WatchForProgressItem[]>(() => {
    if (milestoneProgressQuery.data?.watchFor?.length) return milestoneProgressQuery.data.watchFor;
    return currentWindow.actEarly.map((item) => ({
      ...item,
      status: watchChecked[item.actEarlyId] ? "checked" : "unchecked",
      originWindow: currentWindow.ageKey,
      originLabel: currentWindow.label
    }));
  }, [currentWindow, milestoneProgressQuery.data?.watchFor, watchChecked]);

  useEffect(() => {
    const nextChecked: Record<string, boolean> = {};
    milestoneProgressQuery.data?.watchFor?.forEach((item) => {
      nextChecked[item.actEarlyId] = item.status === "checked";
    });
    if (Object.keys(nextChecked).length) setWatchChecked(nextChecked);
  }, [milestoneProgressQuery.data?.watchFor]);

  async function shareMilestone(milestone: MilestoneDefinition) {
    await Share.share({
      message: `${childName}: ${normalizePatriciaText(milestone.text, childName)}. Source: ${getSourceLabel()} milestone checklist.`
    });
  }

  async function addMilestonePhoto(milestone: MilestoneDefinition) {
    setNotice("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice("Photo access is needed to add a milestone picture. You can keep going without one.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const photoUri = result.assets[0].uri;
        setPhotos((current) => ({
          ...current,
          [milestone.milestoneId]: [...(current[milestone.milestoneId] || []), photoUri].slice(0, 5)
        }));
        setNotice(`Photo added to ${normalizePatriciaText(milestone.text, childName).toLowerCase()}.`);
        maybeOfferPostcard(normalizePatriciaText(milestone.text, childName), photoUri);
      }
    } catch {
      setNotice("I could not open photos just now. Try again in a moment.");
    }
  }

  async function pickFirstPhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice("Photo access is needed to add a picture. You can keep going without one.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]?.uri) {
        setFirstPhotoUri(result.assets[0].uri);
      }
    } catch {
      setNotice("I could not open photos just now. Try again in a moment.");
    }
  }

  function closeAddFirst() {
    setAddFirstOpen(false);
    setFirstName("");
    setFirstDate(new Date().toISOString().slice(0, 10));
    setFirstPhotoUri(null);
  }

  async function saveFirst() {
    const trimmedName = firstName.trim();
    if (!trimmedName) {
      setNotice("Give this first a name before saving.");
      return;
    }
    setFirstSaving(true);
    try {
      await recordCustomFirst({
        childId,
        name: trimmedName,
        observedAt: new Date(firstDate).toISOString(),
        photoUrls: firstPhotoUri ? [firstPhotoUri] : []
      });
      customFirstsQuery.refetch();
      setNotice(`"${trimmedName}" saved to ${childName}'s firsts.`);
      maybeOfferPostcard(trimmedName, firstPhotoUri);
      closeAddFirst();
    } catch {
      setNotice("I could not save that first just now. Try again in a moment.");
    } finally {
      setFirstSaving(false);
    }
  }

  function maybeOfferPostcard(milestoneText: string, photoUri: string | null) {
    if (!canOfferPostcard(profile?.lastPostcardOfferAt)) return;
    const offeredAt = new Date().toISOString();
    setPostcardOffer({ milestoneText, photoUri });
    updateProfile({ lastPostcardOfferAt: offeredAt });
    markPostcardOffered(childId).catch(() => {});
  }

  function openPostcardCompose() {
    if (!postcardOffer) return;
    router.push({
      pathname: "/postcard-compose",
      params: { childId, childName, milestoneText: postcardOffer.milestoneText, ...(postcardOffer.photoUri ? { photoUri: postcardOffer.photoUri } : {}) }
    });
    setPostcardOffer(null);
  }

  async function toggleWatchFor(item: WatchForProgressItem) {
    const nextChecked = !watchChecked[item.actEarlyId];
    setWatchChecked((current) => ({ ...current, [item.actEarlyId]: nextChecked }));
    setNotice(nextChecked ? "Added to your visit discussion list." : "Removed from your visit discussion list.");

    try {
      await recordMilestoneObservation({
        childId,
        milestoneId: item.actEarlyId,
        checked: nextChecked
      });
      milestoneProgressQuery.refetch();
    } catch {
      setNotice(nextChecked ? "Saved here for now. Patricia will sync this when the connection is ready." : "Updated here for now. Patricia will sync this when the connection is ready.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 132, gap: 22 }}
        style={{ backgroundColor: theme.colors.background }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <ScreenTitle title="Milestones" subtitle={`${childName} - ${currentWindow.label}`} note={`${milestoneLibrary.windows.length} age windows in the Nianza milestone library`} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open memory book"
            onPress={() => setMemoryBookOpen(true)}
            style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: allPhotoEntries.length ? theme.colors.blueLight : "white", borderWidth: 1, borderColor: allPhotoEntries.length ? theme.colors.bluePrimary : theme.colors.border }}
          >
            <SfIcon name="camera" color={theme.colors.bluePrimary} size={21} />
          </Pressable>
        </View>

        <MilestonesIntroCard parentFirstName={parentFirstName} childName={childName} sexAtBirth={profile?.sexAtBirth} />

        {postcardOffer ? (
          <SpecCard style={{ padding: 16, gap: 10 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
              That's a good one -- want me to help you send it to family?
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setPostcardOffer(null)}
                style={{ flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" }}
              >
                <Text selectable={false} style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "700" }}>Not now</Text>
              </Pressable>
              <Pressable
                onPress={openPostcardCompose}
                style={{ flex: 1, minHeight: 44, borderRadius: 22, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}
              >
                <Text selectable={false} style={{ color: "white", fontSize: 13, fontWeight: "800" }}>Make a postcard</Text>
              </Pressable>
            </View>
          </SpecCard>
        ) : null}

        {generationalShiftItem ? (
          <SpecCard style={{ gap: 12, padding: 14 }}>
            <Pressable
              onPress={() =>
                openPatricia({
                  source: "D1-generational-shift",
                  eventType: "generational-shift",
                  childName,
                  childId,
                  parentFirstName,
                  entityId: generationalShiftItem.topic || generationalShiftTopic,
                  title: "Guidance changed since you raised yours",
                  detail: generationalShiftItem.bodyText,
                  occurredAt: new Date().toISOString()
                })
              }
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <SfIcon name="bubble.left" color={theme.colors.terracotta} size={20} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text selectable style={{ color: theme.colors.text, fontSize: 13, fontWeight: "700" }}>
                  Guidance changed since you raised yours
                </Text>
                <Text selectable numberOfLines={2} style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 15 }}>
                  {generationalShiftItem.bodyText}
                </Text>
              </View>
              <SfIcon name="chevron.right" color={theme.colors.greyIcon} size={16} />
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/note-from-patricia",
                  params: {
                    topic: generationalShiftItem.topic || generationalShiftTopic || "",
                    bodyText: generationalShiftItem.bodyText,
                    childName
                  }
                })
              }
              style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 10 }}
            >
              <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 12, fontWeight: "700" }}>
                Send a note about this to a grandparent
              </Text>
            </Pressable>
          </SpecCard>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
          {milestoneDomains.map((domain) => (
            <Pressable key={domain} accessibilityRole="tab" accessibilityState={{ selected: activeDomain === domain }} onPress={() => setActiveDomain(domain)}>
              <CategoryChip label={domain} active={activeDomain === domain} />
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden" }}>
          {visibleMilestones.length ? (
            visibleMilestones.map((milestone, index) => {
              const isChecked = Boolean(checked[milestone.milestoneId]);
              const milestonePhotos = photos[milestone.milestoneId] || [];
              const text = normalizePatriciaText(milestone.text, childName);
              return (
                <View key={milestone.milestoneId}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                    onPress={() => {
                      setChecked((current) => ({ ...current, [milestone.milestoneId]: !current[milestone.milestoneId] }));
                      setNotice(isChecked ? "Milestone unchecked." : "Milestone marked as observed.");
                    }}
                    onLongPress={() => setSelectedDetail(milestone)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, backgroundColor: isChecked ? theme.colors.blueLight : "white" }}
                  >
                    <EmptyCircle checked={isChecked} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 20, fontWeight: "600" }}>{text}</Text>
                      <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>{currentWindow.label} - {getSourceLabel()}</Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Open details for ${text}`} onPress={() => setSelectedDetail(milestone)} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
                      <SfIcon name="chevron.right" color={theme.colors.greyIcon} size={18} />
                    </Pressable>
                  </Pressable>

                  {isChecked ? (
                    <View style={{ paddingLeft: 58, paddingRight: 14, paddingBottom: 14, gap: 10, backgroundColor: theme.colors.blueLight }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <Pressable onPress={() => shareMilestone(milestone)} style={{ borderRadius: 14, backgroundColor: theme.colors.terracottaLight, paddingHorizontal: 12, paddingVertical: 7 }}>
                          <Text selectable style={{ color: theme.colors.terracotta, fontSize: 12, fontWeight: "700" }}>Share</Text>
                        </Pressable>
                        <Pressable onPress={() => addMilestonePhoto(milestone)} style={{ borderRadius: 14, backgroundColor: "white", paddingHorizontal: 12, paddingVertical: 7 }}>
                          <Text selectable style={{ color: theme.colors.blueDeep, fontSize: 12, fontWeight: "700" }}>Add photo</Text>
                        </Pressable>
                      </View>
                      {milestonePhotos.length ? (
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {milestonePhotos.map((uri) => (
                            <Image key={uri} source={{ uri }} style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: "white" }} contentFit="cover" />
                          ))}
                        </View>
                      ) : null}
                      <Pressable
                        onPress={() =>
                          openPatricia({
                            source: "D2-milestone-checked",
                            eventType: "milestone-checked",
                            childName,
                            childId,
                            entityId: milestone.milestoneId,
                            title: "Milestone checked",
                            detail: text,
                            occurredAt: new Date().toISOString()
                          })
                        }
                      >
                        <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "700" }}>Tell Patricia</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {index < visibleMilestones.length - 1 ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
                </View>
              );
            })
          ) : (
            <View style={{ padding: 18, gap: 8 }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "700" }}>Nothing to track here yet.</Text>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 19 }}>
                Self-care milestones start appearing in later Nianza windows. Patricia will bring them forward when they fit {childName}'s age.
              </Text>
            </View>
          )}
        </View>

        {notice ? <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>{notice}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: watchOpen }}
          onPress={() => setWatchOpen((current) => !current)}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}
        >
          <SectionLabel>THINGS TO WATCH FOR</SectionLabel>
          <SfIcon name={watchOpen ? "chevron.down" : "chevron.right"} color={theme.colors.greyIcon} size={20} />
        </Pressable>
        {watchOpen ? (
          <View style={{ gap: 10 }}>
            <View style={{ borderRadius: 16, backgroundColor: theme.colors.card, padding: 16, borderLeftWidth: 3, borderLeftColor: theme.colors.bluePrimary, gap: 8 }}>
              <View style={{ alignSelf: "flex-end", width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
                <Text selectable={false} style={{ color: "white", fontSize: 13, fontWeight: "800" }}>P</Text>
              </View>
              <Text selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 23, fontStyle: "italic" }}>
                {activeWatchText}
              </Text>
            </View>
            <View style={{ borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden" }}>
              {watchForItems.map((item, index) => {
                const isChecked = Object.prototype.hasOwnProperty.call(watchChecked, item.actEarlyId)
                  ? Boolean(watchChecked[item.actEarlyId])
                  : item.status === "checked";
                const text = normalizePatriciaText(item.text, childName);
                return (
                  <View key={item.actEarlyId}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isChecked }}
                      onPress={() => toggleWatchFor(item)}
                      style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, backgroundColor: isChecked ? "#F4F7F8" : "white" }}
                    >
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          borderWidth: 2,
                          borderColor: isChecked ? theme.colors.blueDeep : theme.colors.border,
                          backgroundColor: isChecked ? theme.colors.blueLight : "white",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 1
                        }}
                      >
                        {isChecked ? <SfIcon name="checkmark" color={theme.colors.blueDeep} size={17} /> : null}
                      </View>
                      <View style={{ flex: 1, gap: 8 }}>
                        <Text selectable style={{ color: theme.colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600" }}>{text}</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                          <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>{item.originLabel || currentWindow.label}</Text>
                          {isChecked ? (
                            <View style={{ borderRadius: 12, backgroundColor: "#ECEFF1", paddingHorizontal: 9, paddingVertical: 4 }}>
                              <Text selectable={false} style={{ color: theme.colors.muted, fontSize: 10, fontWeight: "800" }}>For the visit</Text>
                            </View>
                          ) : null}
                        </View>
                        {isChecked ? (
                          <Pressable
                            onPress={() =>
                              openPatricia({
                                source: "D1-watch-for",
                                eventType: "watch-for-noticed",
                                childName,
                                childId,
                                entityId: item.actEarlyId,
                                title: "Watch-for item noticed",
                                detail: text,
                                occurredAt: new Date().toISOString()
                              })
                            }
                          >
                            <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "800" }}>Tell Patricia</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </Pressable>
                    {index < watchForItems.length - 1 ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text selectable style={{ color: theme.colors.terracotta, fontSize: 13, fontWeight: "800", letterSpacing: 0.4 }}>FIRSTS</Text>
            <Pressable onPress={() => setAddFirstOpen(true)}>
              <View style={{ borderRadius: 14, backgroundColor: theme.colors.terracottaLight, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text selectable={false} style={{ color: theme.colors.terracotta, fontSize: 12, fontWeight: "700" }}>+ Add a first</Text>
              </View>
            </Pressable>
          </View>
          {customFirsts.length ? (
            <View style={{ borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.terracottaLight, overflow: "hidden" }}>
              {customFirsts.map((first, index) => (
                <View key={first.milestoneId}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.terracottaLight, alignItems: "center", justifyContent: "center" }}>
                      <SfIcon name="checkmark" color={theme.colors.terracotta} size={14} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "600" }}>{first.customName}</Text>
                      <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>
                        {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(first.observedAt))}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Make a postcard from ${first.customName}`}
                      onPress={() =>
                        router.push({
                          pathname: "/postcard-compose",
                          params: { childId, childName, milestoneText: first.customName, ...(first.photoUrls[0] ? { photoUri: first.photoUrls[0] } : {}) }
                        })
                      }
                      style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.terracottaLight }}
                    >
                      <SfIcon name="square.and.arrow.up" color={theme.colors.terracotta} size={16} />
                    </Pressable>
                  </View>
                  {index < customFirsts.length - 1 ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
                </View>
              ))}
            </View>
          ) : (
            <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
              First beach day, first laugh at the dog, first pancake -- the ones that aren't on any clinical list.
            </Text>
          )}
        </View>

        <View style={{ borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, padding: 14, gap: 6 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700" }}>This month</Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 18 }}>
            {observedThisMonth ? `${observedThisMonth} milestone${observedThisMonth === 1 ? "" : "s"} observed. These are notes for you and your clinician, not a score.` : "No milestones checked yet. Start with anything you have noticed."}
          </Text>
        </View>
      </ScrollView>

      {selectedDetail ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.34)", justifyContent: "flex-end", zIndex: 30 }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSelectedDetail(null)} />
          <View style={{ maxHeight: "82%", borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "white", paddingBottom: Math.max(insets.bottom, 20) }}>
            <View style={{ alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: theme.colors.border, marginTop: 12 }} />
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 14, gap: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text selectable style={{ color: theme.colors.text, fontSize: 21, fontWeight: "800", lineHeight: 26 }}>{normalizePatriciaText(selectedDetail.text, childName)}</Text>
                  <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>Usually tracked around: {currentWindow.label}</Text>
                </View>
                <Pressable onPress={() => setSelectedDetail(null)} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                  <Text selectable={false} style={{ color: theme.colors.greyIcon, fontSize: 24 }}>x</Text>
                </Pressable>
              </View>
              <Text selectable style={{ color: theme.colors.text, fontSize: 14, lineHeight: 21 }}>{milestoneDescription(selectedDetail, childName)}</Text>
              <View style={{ borderRadius: 16, backgroundColor: theme.colors.card, padding: 15, borderLeftWidth: 3, borderLeftColor: theme.colors.bluePrimary }}>
                <Text selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 23, fontStyle: "italic" }}>{patriciaMilestoneNote(selectedDetail, childName)}</Text>
              </View>
              <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700" }}>How to encourage this</Text>
              {encouragementFor(selectedDetail, childName).map((tip) => (
                <Text key={tip} selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>- {tip}</Text>
              ))}
              <Pressable
                onPress={() => {
                  setChecked((current) => ({ ...current, [selectedDetail.milestoneId]: true }));
                  setSelectedDetail(null);
                  setNotice("Milestone marked as observed.");
                }}
                style={{ minHeight: 52, borderRadius: 14, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}
              >
                <Text selectable={false} style={{ color: "white", fontSize: 16, fontWeight: "800" }}>Mark as observed</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      ) : null}

      {addFirstOpen ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.34)", justifyContent: "flex-end", zIndex: 30 }}
        >
          <Pressable style={{ flex: 1 }} onPress={closeAddFirst} />
          <View style={{ maxHeight: "82%", borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "white", paddingBottom: Math.max(insets.bottom, 20) }}>
            <View style={{ alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: theme.colors.border, marginTop: 12 }} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 14, gap: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <Text selectable style={{ color: theme.colors.terracotta, fontSize: 20, fontWeight: "800" }}>Add a first</Text>
                <Pressable onPress={closeAddFirst} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                  <Text selectable={false} style={{ color: theme.colors.greyIcon, fontSize: 24 }}>x</Text>
                </Pressable>
              </View>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 19 }}>
                This one's just for you and {childName} -- not a milestone, just a memory. First beach day, first laugh at the dog, first pancake, whatever it was.
              </Text>

              <View style={{ gap: 6 }}>
                <Text selectable style={{ color: theme.colors.text, fontSize: 12, fontWeight: "700" }}>What happened</Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First beach day"
                  placeholderTextColor={theme.colors.greyIcon}
                  style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, color: theme.colors.text, fontSize: 15 }}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text selectable style={{ color: theme.colors.text, fontSize: 12, fontWeight: "700" }}>When</Text>
                <TextInput
                  value={firstDate}
                  onChangeText={setFirstDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.greyIcon}
                  style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, color: theme.colors.text, fontSize: 15 }}
                />
              </View>

              <Pressable onPress={pickFirstPhoto} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: theme.colors.terracottaLight, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {firstPhotoUri ? (
                    <Image source={{ uri: firstPhotoUri }} style={{ width: 42, height: 42 }} contentFit="cover" />
                  ) : (
                    <SfIcon name="camera" color={theme.colors.terracotta} size={20} />
                  )}
                </View>
                <Text selectable style={{ color: theme.colors.terracotta, fontSize: 13, fontWeight: "700" }}>
                  {firstPhotoUri ? "Change photo" : "Add a photo (optional)"}
                </Text>
              </Pressable>

              <Pressable
                disabled={firstSaving}
                onPress={saveFirst}
                style={{ minHeight: 52, borderRadius: 14, backgroundColor: theme.colors.terracotta, alignItems: "center", justifyContent: "center", opacity: firstSaving ? 0.6 : 1 }}
              >
                <Text selectable={false} style={{ color: "white", fontSize: 16, fontWeight: "800" }}>
                  {firstSaving ? "Saving..." : "Save this first"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      ) : null}

      {memoryBookOpen ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.34)", justifyContent: "flex-end", zIndex: 30 }}>
          <Pressable style={{ flex: 1 }} onPress={() => setMemoryBookOpen(false)} />
          <View style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "white", padding: 20, paddingBottom: 34, maxHeight: "78%", gap: 14 }}>
            <View style={{ alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: theme.colors.border }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 19, fontWeight: "800" }}>{childName}'s memory book</Text>
              <Pressable onPress={() => setMemoryBookOpen(false)} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                <Text selectable={false} style={{ color: theme.colors.greyIcon, fontSize: 24 }}>x</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 4 }}>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <SectionLabel>VOICES</SectionLabel>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: "/voice-memory-capture", params: { childId, type: "child-voice" } })}
                    style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                  >
                    <Text selectable={false} style={{ color: theme.colors.bluePrimary, fontSize: 12, fontWeight: "800" }}>+ Add a voice</Text>
                  </Pressable>
                </View>
                {voiceMemories.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {voiceMemories.map((memory) => (
                      <VoiceChip key={memory.memoryId} memory={memory} onDelete={(m) => removeVoiceMemory(m.memoryId)} />
                    ))}
                  </View>
                ) : (
                  <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
                    I'd love to hear {childName} -- talking, laughing, singing, whatever's happening right now. Whenever you're ready.
                  </Text>
                )}
              </View>

              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <SectionLabel>CAPSULES FOR LATER</SectionLabel>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    {capsules.length ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setMemoryBookOpen(false);
                          router.push({ pathname: "/capsule-shelf", params: { childId } });
                        }}
                      >
                        <Text selectable={false} style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "700" }}>See all</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: "/voice-memory-capture", params: { childId, type: "parent-capsule" } })}
                      style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                    >
                      <Text selectable={false} style={{ color: theme.colors.bluePrimary, fontSize: 12, fontWeight: "800" }}>+ Record a message</Text>
                    </Pressable>
                  </View>
                </View>
                {capsules.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {capsules.map((memory) => (
                      <VoiceChip key={memory.memoryId} memory={memory} onDelete={(m) => removeVoiceMemory(m.memoryId)} />
                    ))}
                  </View>
                ) : (
                  <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
                    Want to leave {childName} a message for later? I'll keep it safe until they're grown -- I won't let anyone hear it back before then, not even you.
                  </Text>
                )}
              </View>

              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <SectionLabel>PHOTOS</SectionLabel>
                  <Pressable accessibilityRole="button" onPress={promptAddMemoryBookPhoto} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Text selectable={false} style={{ color: theme.colors.bluePrimary, fontSize: 12, fontWeight: "800" }}>+ Add a photo</Text>
                  </Pressable>
                </View>
                {allPhotoEntries.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {allPhotoEntries.map((entry) => (
                      <View key={entry.uri} style={{ width: "31%", gap: 5 }}>
                        <View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`View photo: ${entry.label}`}
                            onPress={() => setViewingPhoto({ uri: entry.uri, label: entry.label })}
                          >
                            <Image source={{ uri: entry.uri }} style={{ width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: theme.colors.card }} contentFit="cover" />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Make a postcard from ${entry.label}`}
                            onPress={() =>
                              router.push({
                                pathname: "/postcard-compose",
                                params: { childId, childName, milestoneText: entry.label, photoUri: entry.uri }
                              })
                            }
                            style={{
                              position: "absolute",
                              right: 5,
                              bottom: 5,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 3,
                              paddingHorizontal: 7,
                              height: 22,
                              borderRadius: 11,
                              backgroundColor: "rgba(0,0,0,0.6)"
                            }}
                          >
                            <SfIcon name="square.and.arrow.up" color="white" size={11} />
                            <Text selectable={false} style={{ color: "white", fontSize: 10, fontWeight: "800" }}>Postcard</Text>
                          </Pressable>
                        </View>
                        <Text selectable numberOfLines={2} style={{ color: theme.colors.muted, fontSize: 10, lineHeight: 13 }}>{entry.label}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 19 }}>
                    No photos yet. Tap "+ Add a photo" above, or add one to any milestone or first, to start {childName}'s memory book.
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}

      {viewingPhoto ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", zIndex: 40 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={() => setViewingPhoto(null)}
            style={{ position: "absolute", top: insets.top + 12, right: 20, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)", zIndex: 1 }}
          >
            <Text selectable={false} style={{ color: "white", fontSize: 22 }}>x</Text>
          </Pressable>
          <Image source={{ uri: viewingPhoto.uri }} style={{ width: "100%", aspectRatio: 1 }} contentFit="contain" />
          <View style={{ padding: 20, gap: 14 }}>
            <Text selectable style={{ color: "white", fontSize: 14, lineHeight: 20, textAlign: "center" }}>{viewingPhoto.label}</Text>
            <Pressable
              onPress={() => {
                const photo = viewingPhoto;
                setViewingPhoto(null);
                router.push({ pathname: "/postcard-compose", params: { childId, childName, milestoneText: photo.label, photoUri: photo.uri } });
              }}
              style={{ minHeight: 50, borderRadius: 25, backgroundColor: theme.colors.bluePrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <SfIcon name="square.and.arrow.up" color="white" size={16} />
              <Text selectable={false} style={{ color: "white", fontSize: 14, fontWeight: "800" }}>Make a postcard</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <TalkToPatriciaButton source="D1-milestones" eventType="general" detail={`${childName} milestone screen: ${currentWindow.label}, ${activeDomain}`} />
    </View>
  );
}
