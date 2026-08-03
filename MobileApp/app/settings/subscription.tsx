import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getEntitlements } from "@/api/entitlements";
import { PurchasesNotConfiguredError, restorePurchases } from "@/api/purchases";
import { useAuth } from "@/auth/auth-context";
import { SettingsHeader } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(value));
}

// NZA-SUB-v1.0: this screen used to be a fully static "not connected to a
// billing provider yet" placeholder, written before the entitlement service
// (Backend/shared/entitlements.js) existed. That backend is live now -- this
// reads real tier/trial/Patricia-usage data from it -- but real purchases
// are still stubbed (see src/api/purchases.ts), so "Manage subscription" and
// "Restore purchases" stay honest about that rather than pretending to work.
export default function SubscriptionSettingsScreen() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const entitlementsQuery = useQuery({
    queryKey: ["entitlements", "settings"],
    queryFn: () =>
      getEntitlements({
        parentFirstName: profile?.parentFirstName || profile?.parentName?.split(" ")[0],
        childName: profile?.childName
      }),
    staleTime: 1000 * 60 * 5,
    retry: 1
  });
  const entitlements = entitlementsQuery.data;

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(tabs)/settings");
  }

  async function handleRestore() {
    setNotice(null);
    setRestoring(true);
    try {
      await restorePurchases();
      queryClient.invalidateQueries({ queryKey: ["entitlements"] });
      setNotice("Purchases restored.");
    } catch (err) {
      setNotice(err instanceof PurchasesNotConfiguredError ? "There's no purchase history to restore yet." : "I couldn't restore purchases just now. Try again in a moment.");
    } finally {
      setRestoring(false);
    }
  }

  function handleManage() {
    if (entitlements?.tier === "subscribed") {
      setNotice("Subscription management through the App Store isn't wired up yet -- check back soon.");
      return;
    }
    router.push("/plan-picker");
  }

  const statusCard = (() => {
    if (entitlementsQuery.isLoading) {
      return { title: "Loading your plan...", body: "" };
    }
    if (!entitlements) {
      return {
        title: "Couldn't load your plan",
        body: "Check your connection and try again -- you can keep using Nianza in the meantime."
      };
    }
    if (entitlements.tier === "subscribed") {
      return {
        title: "You're subscribed",
        body: "Full access to Patricia, reports, and everything else Nianza keeps for you."
      };
    }
    if (entitlements.tier === "trial") {
      return {
        title: "Free trial",
        body: entitlements.trialEndsAt
          ? `Your trial runs through ${formatDate(entitlements.trialEndsAt)}. Full access until then.`
          : "You're in your free trial with full access."
      };
    }
    const usedToday = entitlements.patricia.usedToday;
    const limit = entitlements.patricia.limitPerDay;
    return {
      title: "Free plan",
      body: `Your notes, timeline, and history are always yours${limit != null ? `. Patricia chats: ${usedToday}/${limit} used today` : ""}.${profile?.childName ? ` Keep using Nianza with ${profile.childName} anytime.` : ""}`
    };
  })();

  const showChoosePlanCta = entitlements && entitlements.tier !== "subscribed";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 40, gap: 22 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <SettingsHeader title="Your subscription" onBack={goBack} />

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "white", padding: 18, gap: 6 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 16, fontWeight: "700" }}>
          {statusCard.title}
        </Text>
        {statusCard.body ? (
          <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 19 }}>
            {statusCard.body}
          </Text>
        ) : null}
      </View>

      {showChoosePlanCta ? (
        <Pressable
          onPress={() => router.push("/plan-picker")}
          style={{ minHeight: 52, borderRadius: 12, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}
        >
          <Text selectable={false} style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
            Choose a plan
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={handleManage}
        style={{ minHeight: 52, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}
      >
        <Text selectable={false} style={{ color: theme.colors.bluePrimary, fontSize: 16, fontWeight: "600" }}>
          Manage subscription
        </Text>
      </Pressable>

      <Pressable
        disabled={restoring}
        onPress={handleRestore}
        style={{ minHeight: 44, alignItems: "center", justifyContent: "center", opacity: restoring ? 0.6 : 1 }}
      >
        <Text selectable style={{ color: theme.colors.muted, fontSize: 14, fontWeight: "600" }}>
          {restoring ? "Restoring..." : "Restore purchases"}
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
