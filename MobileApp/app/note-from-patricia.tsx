import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RequireAuth } from "@/auth/auth-context";
import { SfIcon } from "@/components/screen-spec";
import { buildGrandparentNoteDraft } from "@/content/grandparent-note-templates";
import { theme } from "@/theme/theme";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// N4 (Village Translator), "Note from Patricia" -- same D12 Tier-1 pattern as
// M16 postcards: deterministic template draft, parent edits, native share
// sheet only. No send tracking, no recipient management, no in-app delivery.
export default function NoteFromPatriciaScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const topic = firstParam(params.topic) || "";
  const bodyText = firstParam(params.bodyText) || "";
  const childName = firstParam(params.childName) || "your child";

  const [draft, setDraft] = useState(() => buildGrandparentNoteDraft({ topic, bodyText, childName }));
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  async function shareNote() {
    setSharing(true);
    setNotice(null);
    try {
      await Share.share({ message: draft });
    } catch {
      setNotice("I couldn't open the share sheet just now. Try again in a moment.");
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
          <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>Note from Patricia</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24, gap: 16, paddingBottom: 40 }}>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
            A short note for a grandparent -- drafted for you, yours to edit before you send it.
          </Text>

          <TextInput
            multiline
            value={draft}
            onChangeText={setDraft}
            style={{
              minHeight: 180,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: "white",
              padding: 16,
              color: theme.colors.text,
              fontSize: 15,
              lineHeight: 22,
              fontStyle: "italic",
              textAlignVertical: "top"
            }}
          />

          <Pressable
            onPress={shareNote}
            disabled={sharing || !draft.trim()}
            style={{
              minHeight: 54,
              borderRadius: 27,
              backgroundColor: theme.colors.bluePrimary,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              opacity: sharing || !draft.trim() ? 0.6 : 1
            }}
          >
            <SfIcon name="square.and.arrow.up" color="white" size={19} />
            <Text selectable={false} style={{ color: "white", fontSize: 15, fontWeight: "800" }}>
              {sharing ? "Opening..." : "Share"}
            </Text>
          </Pressable>

          {notice ? <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center" }}>{notice}</Text> : null}
        </ScrollView>
      </View>
    </RequireAuth>
  );
}
