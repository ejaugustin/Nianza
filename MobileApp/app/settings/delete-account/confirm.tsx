import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { theme } from "@/theme/theme";

export default function DeleteAccountConfirmScreen() {
  const { deleteLocalAccountData } = useAuth();
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canConfirm = typed.trim().toUpperCase() === "DELETE";

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(tabs)/settings");
  }

  async function confirmDelete() {
    if (!canConfirm || deleting) return;
    setDeleting(true);
    try {
      await deleteLocalAccountData();
      router.replace({ pathname: "/settings/delete-account/complete", params: { scope: scope || "account" } });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60, gap: 20, justifyContent: "center" }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <Text selectable style={{ color: theme.colors.text, fontSize: 24, fontWeight: "700", textAlign: "center" }}>
        Delete your account?
      </Text>
      <Text selectable style={{ color: theme.colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" }}>
        This removes your session and profile from this device — conversations with Patricia and reports stored on this
        phone go with it. This cannot be undone.
      </Text>
      <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17, textAlign: "center" }}>
        Nianza doesn't yet support deleting records from our servers automatically. If you'd like your account fully
        removed from Nianza's systems, email us and we'll take care of it by hand.
      </Text>

      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>
          Type DELETE to confirm
        </Text>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="DELETE"
          placeholderTextColor={theme.colors.muted}
          style={{
            minHeight: 52,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: theme.colors.border,
            paddingHorizontal: 16,
            fontSize: 16,
            color: theme.colors.text,
            backgroundColor: "white"
          }}
        />
      </View>

      <Pressable
        disabled={!canConfirm || deleting}
        onPress={confirmDelete}
        style={{
          minHeight: 52,
          borderRadius: 12,
          backgroundColor: theme.colors.error,
          alignItems: "center",
          justifyContent: "center",
          opacity: !canConfirm || deleting ? 0.5 : 1
        }}
      >
        <Text selectable={false} style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
          {deleting ? "Deleting..." : "Permanently delete my account"}
        </Text>
      </Pressable>

      <Pressable onPress={goBack} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 15 }}>
          Cancel
        </Text>
      </Pressable>
    </ScrollView>
  );
}
