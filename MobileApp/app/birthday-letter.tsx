import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getBirthdayLetter } from "@/api/memories";
import { ApiError } from "@/api/client";
import { RequireAuth, useAuth } from "@/auth/auth-context";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(value));
}

// N7 (Birthday Letter). Reuses the same rendered-view-to-image share pattern
// as the report screens (react-native-view-shot + expo-sharing) since the
// brief calls for a printable/saveable keepsake, not a PDF.
export default function BirthdayLetterScreen() {
  const insets = useSafeAreaInsets();
  const { activeChildId, profile } = useAuth();
  const childId = activeChildId || "primary-child";
  const parentFirstName = profile?.parentFirstName || profile?.parentName?.split(" ")[0];
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const captureTargetRef = useRef<View>(null);

  const letterQuery = useQuery({
    queryKey: ["birthday-letter", childId, parentFirstName],
    queryFn: () => getBirthdayLetter(childId, parentFirstName)
  });
  const letterLocked = letterQuery.error instanceof ApiError && letterQuery.error.code === "SUBSCRIPTION_REQUIRED";
  const letter = letterQuery.data;

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  async function shareLetter() {
    if (!letter || !captureTargetRef.current) return;
    setSharing(true);
    setNotice(null);
    try {
      const uri = await captureRef(captureTargetRef, { format: "png", quality: 0.92, result: "tmpfile" });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: letter.title, UTI: "public.png" });
      } else {
        await Share.share({ url: uri, title: letter.title });
      }
    } catch {
      setNotice("I could not create the keepsake image just now. Try again in a moment.");
    } finally {
      setSharing(false);
    }
  }

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
          <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>Birthday Letter</Text>
          <Pressable
            onPress={shareLetter}
            disabled={!letter || sharing}
            style={{ minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center", opacity: letter && !sharing ? 1 : 0.35 }}
          >
            <SfIcon name="square.and.arrow.up" color={theme.colors.bluePrimary} size={22} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, gap: 20, paddingBottom: insets.bottom + 34 }}>
          {letterQuery.isLoading ? <Text selectable style={{ color: theme.colors.muted, fontSize: 14 }}>Writing this year's letter...</Text> : null}

          {letterQuery.isError ? (
            <View
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: letterLocked ? theme.colors.bluePrimary : theme.colors.error,
                backgroundColor: letterLocked ? theme.colors.blueLight : "#FDEBEC",
                padding: 16,
                gap: 12
              }}
            >
              <Text selectable style={{ color: letterLocked ? theme.colors.blueDeep : theme.colors.error, fontSize: 14, fontWeight: "700" }}>
                {letterLocked
                  ? letterQuery.error instanceof ApiError && letterQuery.error.message
                    ? letterQuery.error.message
                    : "This one needs the full plan. I can put it together the moment you're ready."
                  : "This letter couldn't be opened yet -- it starts at the first birthday."}
              </Text>
              {letterLocked ? (
                <Pressable
                  onPress={() => router.push("/plan-picker")}
                  style={{ alignSelf: "flex-start", minHeight: 40, borderRadius: 20, backgroundColor: theme.colors.bluePrimary, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" }}
                >
                  <Text selectable={false} style={{ color: "white", fontSize: 13, fontWeight: "800" }}>See plans</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {letter ? (
            <>
              <View ref={captureTargetRef} collapsable={false} style={{ gap: 18, backgroundColor: theme.colors.background, padding: 4 }}>
                <View style={{ gap: 6 }}>
                  <Text selectable style={{ color: theme.colors.muted, fontSize: 12 }}>
                    {letter.childName} - {formatDate(letter.windowEnd)}
                  </Text>
                  <Text selectable style={{ color: theme.colors.text, fontSize: 24, fontWeight: "900" }}>{letter.title}</Text>
                </View>
                <View style={{ borderRadius: 20, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, padding: 20 }}>
                  <Text selectable style={{ color: theme.colors.text, fontSize: 16, lineHeight: 26, fontStyle: "italic" }}>
                    {letter.bodyText}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={shareLetter}
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
                <Text selectable={false} style={{ color: "white", fontSize: 15, fontWeight: "900" }}>{sharing ? "Preparing..." : "Save or share"}</Text>
              </Pressable>

              {notice ? <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center" }}>{notice}</Text> : null}
            </>
          ) : null}
        </ScrollView>
      </View>
    </RequireAuth>
  );
}
