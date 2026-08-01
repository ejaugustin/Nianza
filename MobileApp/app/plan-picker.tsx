import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PurchasesNotConfiguredError, purchasePlan, type PlanId } from "@/api/purchases";
import { RequireAuth } from "@/auth/auth-context";
import { AuthButton } from "@/components/auth-ui";
import { Pill, SettingsHeader, SpecCard } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

// NZA-SUB-v1.0 Section 4: plan picker. Two options -- monthly and yearly --
// with the yearly discount surfaced explicitly as "2 months free" (spec is
// explicit that parents shouldn't have to do the arithmetic themselves).
// purchasePlan() is the seam from src/api/purchases.ts: it throws
// PurchasesNotConfiguredError until react-native-purchases is reinstalled
// and wired up, so this screen is shippable now and needs no changes once
// the real SDK lands -- only purchasePlan()'s internals change.
const PLANS: Array<{
  id: PlanId;
  title: string;
  price: string;
  cadence: string;
  badge?: string;
}> = [
  { id: "monthly", title: "Monthly", price: "$9.99", cadence: "per month" },
  { id: "yearly", title: "Yearly", price: "$99.99", cadence: "per year", badge: "2 months free" }
];

export default function PlanPickerScreen() {
  const insets = useSafeAreaInsets();
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  async function handlePurchase(planId: PlanId) {
    setNotice(null);
    setPendingPlan(planId);
    try {
      await purchasePlan(planId);
      // On a real purchase, RevenueCat's webhook updates entitlements
      // server-side; the client just needs to leave this screen once the
      // SDK confirms the transaction.
      goBack();
    } catch (err) {
      if (err instanceof PurchasesNotConfiguredError) {
        setNotice("Subscriptions aren't available in this build yet -- check back soon.");
      } else {
        setNotice(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setPendingPlan(null);
    }
  }

  return (
    <RequireAuth>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, gap: 20, paddingBottom: 40 }}>
          <SettingsHeader title="Choose your plan" onBack={goBack} />

          <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 19 }}>
            Keep full access to Patricia, the Doctor Visit Pack, progress reports, and everything else Nianza has been keeping for you.
          </Text>

          <View style={{ gap: 14 }}>
            {PLANS.map((plan) => (
              <SpecCard key={plan.id}>
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ gap: 4 }}>
                      <Text selectable style={{ color: theme.colors.text, fontSize: 17, fontWeight: "700" }}>{plan.title}</Text>
                      <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>
                        {plan.price} {plan.cadence}
                      </Text>
                    </View>
                    {plan.badge ? <Pill label={plan.badge} tone="terracotta" /> : null}
                  </View>
                  <AuthButton loading={pendingPlan === plan.id} disabled={pendingPlan !== null} onPress={() => handlePurchase(plan.id)}>
                    Choose {plan.title}
                  </AuthButton>
                </View>
              </SpecCard>
            ))}
          </View>

          {notice ? <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center" }}>{notice}</Text> : null}

          <AuthButton variant="text" onPress={goBack}>Not right now</AuthButton>
        </ScrollView>
      </View>
    </RequireAuth>
  );
}
