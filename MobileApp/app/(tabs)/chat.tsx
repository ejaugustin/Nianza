import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function patriciaOpening(eventType?: string, childName = "Sofia", detail?: string) {
  if (eventType === "milestone-checked") {
    return `${childName} ${detail?.toLowerCase() || "did something new"}? Oh, I love hearing that. Tell me what you noticed first.`;
  }
  if (eventType === "visit-upcoming") {
    return `A visit coming up can make your mind feel crowded. Let's sort through what you want to ask about ${childName}, one thing at a time.`;
  }
  if (eventType === "sick-encounter-active") {
    return `I'm here with you. Tell me what's been happening with ${childName}, and we'll keep the notes clear while you decide what needs a clinician.`;
  }
  return "Hello. I'm Patricia. I've been with a lot of new parents over the years, and I'm glad you're here. What's on your mind?";
}

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const { profile } = useAuth();
  const childName = one(params.childName) || profile?.childName || "Sofia";
  const eventType = one(params.eventType);
  const detail = one(params.detail);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"idle" | "listening" | "camera">("idle");
  const opening = useMemo(() => patriciaOpening(eventType, childName, detail), [childName, detail, eventType]);
  const [messages, setMessages] = useState([opening]);

  function sendMessage() {
    const message = draft.trim();
    if (!message) return;
    setMessages((current) => [...current, message, "I hear you. Start with the part that feels heaviest, and we can make it smaller together."]);
    setDraft("");
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ height: 66, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: theme.colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}>
        <SfIcon name="chevron.left" color={theme.colors.text} size={22} />
        <Text selectable style={{ color: theme.colors.text, fontSize: 17, fontWeight: "600" }}>Patricia</Text>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.6, borderColor: theme.colors.muted, alignItems: "center", justifyContent: "center" }}>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 11, fontStyle: "italic" }}>i</Text>
        </View>
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingTop: 24, paddingBottom: 128, gap: 14 }}>
        {messages.map((message, index) => {
          const fromParent = index % 2 === 1;
          return (
            <View key={`${message}-${index}`} style={{ flexDirection: "row", justifyContent: fromParent ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 8 }}>
              {!fromParent ? (
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>P</Text>
                </View>
              ) : null}
              <View style={{ maxWidth: 248, borderRadius: 16, backgroundColor: fromParent ? theme.colors.bluePrimary : theme.colors.card, paddingHorizontal: 14, paddingVertical: 15 }}>
                <Text selectable style={{ color: fromParent ? "white" : theme.colors.text, fontSize: 14, lineHeight: 20 }}>{message}</Text>
              </View>
            </View>
          );
        })}
        {mode !== "idle" ? (
          <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center" }}>
            {mode === "listening" ? "Listening placeholder is on. Voice capture wires into the next backend slice." : "Camera placeholder is ready for photo context."}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ position: "absolute", left: 16, right: 16, bottom: 22, gap: 9 }}>
        <View style={{ minHeight: 58, borderRadius: 29, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12 }}>
          <Pressable onPress={() => setMode(mode === "camera" ? "idle" : "camera")} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: mode === "camera" ? theme.colors.blueLight : "transparent" }}>
            <SfIcon name="camera" color={theme.colors.bluePrimary} size={22} />
          </Pressable>
          <TextInput
            placeholder="Tell Patricia..."
            placeholderTextColor={theme.colors.greyIcon}
            value={draft}
            onChangeText={setDraft}
            style={{ flex: 1, minHeight: 44, color: theme.colors.text, fontSize: 14 }}
            onSubmitEditing={sendMessage}
          />
          <Pressable onPress={draft.trim() ? sendMessage : () => setMode(mode === "listening" ? "idle" : "listening")} style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bluePrimary }}>
            <SfIcon name="mic.fill" color="white" size={23} />
          </Pressable>
        </View>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 11, textAlign: "center" }}>
          Patricia can help you think it through. For urgent symptoms, contact a clinician or emergency services.
        </Text>
      </View>
    </View>
  );
}
