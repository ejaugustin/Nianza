import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { SettingsHeader } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

export default function SubscriptionSettingsScreen() {
  const { profile } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(tabs)/settings");
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 40, gap: 22 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <SettingsHeader title="Your subscription" onBack={goBack} />

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "white", padding: 18, gap: 6 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 16, fontWeight: "700" }}>
          Subscription status coming soon
        </Text>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 19 }}>
          Nianza is not yet connected to a billing provider, so plan details and renewal dates aren't shown here yet.
          {profile?.childName ? ` You can keep using Nianza with ${profile.childName} in the meantime.` : ""}
        </Text>
      </View>

      <Pressable
        onPress={() => setNotice("Subscription management isn't available yet — there's nothing to manage until billing is connected.")}
        style={{ minHeight: 52, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}
      >
        <Text selectable={false} style={{ color: theme.colors.bluePrimary, fontSize: 16, fontWeight: "600" }}>
          Manage subscription
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setNotice("There's no purchase history to restore yet.")}
        style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
      >
        <Text selectable style={{ color: theme.colors.muted, fontSize: 14, fontWeight: "600" }}>
          Restore purchases
        </Text>
      </Pressable>

      {notice ? (
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center" }}>
          {notice}
        </Text>
      ) : null}
    </ScrollView>
  );
}
