import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getPostcardFrames, type PostcardFrame } from "@/api/content";
import { RequireAuth } from "@/auth/auth-context";
import { SfIcon } from "@/components/screen-spec";
import { CORE_TEMPLATE_KEYS, DEFAULT_CORE_TEMPLATE_KEY, TEMPLATE_COMPONENTS, isWithinDateWindow } from "@/components/postcards/registry";
import type { PostcardSlotProps } from "@/components/postcards/types";
import { theme } from "@/theme/theme";

// Postcard export size, per NZA-POSTCARDS-v1.0 Section 2: "standard postcard
// 4x6 ... at minimum 1200px on the short edge." Fixed regardless of the
// device's on-screen render size, since captureRef rasterizes to whatever
// pixel dimensions we ask for.
const EXPORT_WIDTH = 1200;
const EXPORT_HEIGHT = 1800;
const POSTCARD_ASPECT_RATIO = EXPORT_WIDTH / EXPORT_HEIGHT;

// Thumbnail scaling trick: render each template at a fixed "base" size, then
// shrink it to thumb size with a centered transform scale. Because both
// boxes share the postcard's 2:3 aspect ratio, the scaled base box lands
// exactly flush with the thumb-sized, overflow-hidden wrapper.
const THUMB_BASE_WIDTH = 180;
const THUMB_BASE_HEIGHT = 270;
const THUMB_WIDTH = 64;
const THUMB_HEIGHT = 96;
const THUMB_SCALE = THUMB_WIDTH / THUMB_BASE_WIDTH;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function lowerFirst(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function formatDateLine(now: Date) {
  return now.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function templateLabel(key: string) {
  return key
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Fallback deck if the content-library fetch is slow, offline, or fails --
// compose stays fully on-device and usable either way (v1.0 Section 3).
const FALLBACK_CORE_FRAMES: PostcardFrame[] = CORE_TEMPLATE_KEYS.map((templateKey) => ({
  contentId: `local#${templateKey}`,
  version: "local",
  contentType: "postcard-frame",
  language: "en",
  templateKey,
  category: "core",
  composition: null,
  bestFor: null,
  palette: null,
  dateRange: null,
  ttsEnabled: false,
  status: "approved"
}));

type DeckTab = "classic" | "seasonal";

function TemplateThumb({
  frame,
  slots,
  selected,
  onPress
}: {
  frame: PostcardFrame;
  slots: PostcardSlotProps;
  selected: boolean;
  onPress: () => void;
}) {
  const Component = TEMPLATE_COMPONENTS[frame.templateKey];
  if (!Component) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={templateLabel(frame.templateKey)}
      onPress={onPress}
      style={{
        width: THUMB_WIDTH,
        height: THUMB_HEIGHT,
        borderRadius: 8,
        overflow: "hidden",
        borderWidth: selected ? 2.5 : 1,
        borderColor: selected ? theme.colors.bluePrimary : theme.colors.border
      }}
    >
      <View
        style={{
          position: "absolute",
          width: THUMB_BASE_WIDTH,
          height: THUMB_BASE_HEIGHT,
          left: -(THUMB_BASE_WIDTH - THUMB_WIDTH) / 2,
          top: -(THUMB_BASE_HEIGHT - THUMB_HEIGHT) / 2,
          transform: [{ scale: THUMB_SCALE }]
        }}
        pointerEvents="none"
      >
        <Component {...slots} />
      </View>
    </Pressable>
  );
}

// M16 (Family postcards), rebuilt per NZA-POSTCARDS-v1.0 + v1.1-Seasonal:
// the deck is six structurally distinct, deterministically-assembled
// templates (never generated per send) plus a date-gated, opt-in-only
// Seasonal & Holiday tab. A parent picks a template, edits the words if they
// like, and exports a flat PNG via the share sheet -- no send tracking, no
// server round trip for the image itself.
export default function PostcardComposeScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const childName = firstParam(params.childName) || "your child";
  const milestoneText = firstParam(params.milestoneText) || "had a moment worth sharing";
  const photoUri = firstParam(params.photoUri) || null;

  const [activeTab, setActiveTab] = useState<DeckTab>("classic");
  const [templateKey, setTemplateKey] = useState<string>(DEFAULT_CORE_TEMPLATE_KEY);
  const [headline, setHeadline] = useState("");
  const [messageText, setMessageText] = useState("");
  const [headlineEdited, setHeadlineEdited] = useState(false);
  const [messageEdited, setMessageEdited] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const captureTargetRef = useRef<View>(null);

  const dateLine = useMemo(() => formatDateLine(new Date()), []);

  const framesQuery = useQuery({
    queryKey: ["postcard-frames"],
    queryFn: () => getPostcardFrames(),
    staleTime: 1000 * 60 * 60
  });

  const allFrames = framesQuery.data && framesQuery.data.length ? framesQuery.data : FALLBACK_CORE_FRAMES;

  const coreFrames = useMemo(() => {
    const byKey = new Map(allFrames.filter((f) => f.category === "core").map((f) => [f.templateKey, f]));
    // Always render in the spec's fixed order, falling back to a bare frame
    // for any core key the content library hasn't returned yet.
    return CORE_TEMPLATE_KEYS.map(
      (key) => byKey.get(key) || { ...FALLBACK_CORE_FRAMES.find((f) => f.templateKey === key)! }
    );
  }, [allFrames]);

  // Never backfilled outside its window (v1.1 Section 3/4) -- an empty list
  // here is correct, not a loading state.
  const seasonalHolidayFrames = useMemo(() => {
    const now = new Date();
    return allFrames.filter((f) => (f.category === "seasonal" || f.category === "holiday") && isWithinDateWindow(f.dateRange, now));
  }, [allFrames]);

  // Default template is always one of the core six, regardless of date or
  // fetch timing (v1.1 Section 4 acceptance gate).
  useEffect(() => {
    if (!coreFrames.some((f) => f.templateKey === templateKey)) setTemplateKey(DEFAULT_CORE_TEMPLATE_KEY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreFrames.length]);

  useEffect(() => {
    if (!headlineEdited) setHeadline(`${childName}'s update`);
  }, [childName, headlineEdited]);

  useEffect(() => {
    if (!messageEdited) {
      const sentence = lowerFirst(milestoneText);
      setMessageText(`${childName} ${sentence}${sentence.endsWith(".") ? "" : "."}`);
    }
  }, [childName, milestoneText, messageEdited]);

  const slots: PostcardSlotProps = {
    photoUri,
    photoUris: photoUri ? [photoUri] : [],
    childName,
    headline,
    messageText,
    dateLine
  };

  const ActiveTemplate = TEMPLATE_COMPONENTS[templateKey] || TEMPLATE_COMPONENTS[DEFAULT_CORE_TEMPLATE_KEY];

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  async function sharePostcard() {
    if (!captureTargetRef.current) return;
    setSharing(true);
    setNotice(null);
    try {
      const uri = await captureRef(captureTargetRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        width: EXPORT_WIDTH,
        height: EXPORT_HEIGHT
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share postcard", UTI: "public.png" });
      } else {
        await Share.share({ url: uri, message: messageText });
      }
    } catch {
      setNotice("I could not create the postcard image just now. Try again in a moment.");
    } finally {
      setSharing(false);
    }
  }

  const visibleFrames = activeTab === "classic" ? coreFrames : seasonalHolidayFrames;

  return (
    <RequireAuth>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
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
          <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>Postcard</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingTop: 24, gap: 18, paddingBottom: insets.bottom + 34 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            ref={captureTargetRef}
            collapsable={false}
            style={{
              width: "100%",
              aspectRatio: POSTCARD_ASPECT_RATIO,
              borderRadius: 10,
              overflow: "hidden",
              alignSelf: "center",
              shadowColor: "#000",
              shadowOpacity: 0.14,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
              elevation: 3
            }}
          >
            <ActiveTemplate {...slots} />
          </View>

          <View style={{ gap: 8 }}>
            <Text selectable={false} style={{ color: theme.colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Headline
            </Text>
            <TextInput
              value={headline}
              onChangeText={(text) => {
                setHeadline(text);
                setHeadlineEdited(true);
              }}
              placeholder="A short headline"
              placeholderTextColor={theme.colors.muted}
              style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 12, color: theme.colors.text, fontSize: 14, fontWeight: "700" }}
            />
            <Text selectable={false} style={{ color: theme.colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
              Message
            </Text>
            <TextInput
              value={messageText}
              onChangeText={(text) => {
                setMessageText(text);
                setMessageEdited(true);
              }}
              multiline
              placeholder="Write the message..."
              placeholderTextColor={theme.colors.muted}
              style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 12, color: theme.colors.text, fontSize: 14, lineHeight: 20, minHeight: 70, textAlignVertical: "top" }}
            />
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveTab("classic")}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 18,
                  backgroundColor: activeTab === "classic" ? theme.colors.bluePrimary : "transparent",
                  borderWidth: 1,
                  borderColor: theme.colors.bluePrimary
                }}
              >
                <Text selectable={false} style={{ color: activeTab === "classic" ? "white" : theme.colors.bluePrimary, fontSize: 13, fontWeight: "800" }}>
                  Classic
                </Text>
              </Pressable>
              {seasonalHolidayFrames.length ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveTab("seasonal")}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 18,
                    backgroundColor: activeTab === "seasonal" ? theme.colors.bluePrimary : "transparent",
                    borderWidth: 1,
                    borderColor: theme.colors.bluePrimary
                  }}
                >
                  <Text selectable={false} style={{ color: activeTab === "seasonal" ? "white" : theme.colors.bluePrimary, fontSize: 13, fontWeight: "800" }}>
                    Seasonal &amp; Holiday
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
              {visibleFrames.map((frame) => (
                <TemplateThumb
                  key={frame.templateKey}
                  frame={frame}
                  slots={slots}
                  selected={frame.templateKey === templateKey}
                  onPress={() => setTemplateKey(frame.templateKey)}
                />
              ))}
            </ScrollView>
          </View>

          <Pressable
            onPress={sharePostcard}
            disabled={sharing}
            style={{
              minHeight: 56,
              borderRadius: 28,
              backgroundColor: theme.colors.bluePrimary,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              opacity: sharing ? 0.7 : 1
            }}
          >
            <SfIcon name="square.and.arrow.up" color="white" size={20} />
            <Text selectable={false} style={{ color: "white", fontSize: 15, fontWeight: "900" }}>{sharing ? "Preparing..." : "Share with family"}</Text>
          </Pressable>

          {notice ? <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center" }}>{notice}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </RequireAuth>
  );
}
