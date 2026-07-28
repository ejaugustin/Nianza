import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { theme } from "@/theme/theme";

export default function DeleteAccountOfferScreen() {
  const { profile } = useAuth();
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const [notice, setNotice] = useState<string | null>(null);
  const isChildScope = scope === "child";
  const childName = profile?.childName || "your child";

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(tabs)/settings");
  }

  function proceed() {
    router.push({ pathname: "/settings/delete-account/confirm", params: { scope: scope || "account" } });
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60, gap: 24, justifyContent: "center" }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <Text selectable style={{ color: theme.colors.text, fontSize: 24, fontWeight: "700", textAlign: "center" }}>
        Before you go
      </Text>
      <Text selectable style={{ color: theme.colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" }}>
        {isChildScope ? `${childName}'s records belong to you.` : "Your records belong to you."} Download them before
        they're gone.
      </Text>

      <Pressable
        onPress={() => setNotice("Data export is still being built. This will let you download a ZIP of all your reports before deleting.")}
        style={{ minHeight: 52, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}
      >
        <Text selectable={false} style={{ color: theme.colors.bluePrimary, fontSize: 16, fontWeight: "600" }}>
          Export all reports (ZIP)
        </Text>
      </Pressable>

      {notice ? (
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center" }}>
          {notice}
        </Text>
      ) : null}

      <Pressable onPress={proceed} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
        <Text selectable style={{ color: theme.colors.error, fontSize: 15, fontWeight: "600" }}>
          Skip export and delete
        </Text>
      </Pressable>

      <Pressable onPress={goBack} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 15 }}>
          Actually, keep my account
        </Text>
      </Pressable>
    </ScrollView>
  );
}
