import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/auth/auth-context";
import { getUserIdFromIdToken } from "@/auth/cognito";
import { configurePurchasesSDK, identifyPurchasesUser } from "@/api/purchases";
import { theme } from "@/theme/theme";
import { CrashScreen } from "@/debug/CrashScreen";

// Configures the RevenueCat SDK anonymously as early as possible (see
// src/api/purchases.ts for why this two-step configure-then-identify
// pattern matters). Rendered inside AuthProvider so it can log the real
// Cognito sub in the instant a session becomes available -- signed-out
// users just get the anonymous RevenueCat id, which is fine since none of
// the gated surfaces are reachable yet at that point.
function PurchasesBootstrap() {
  const { session } = useAuth();

  useEffect(() => {
    configurePurchasesSDK();
  }, []);

  useEffect(() => {
    if (!session?.idToken) return;
    const userId = getUserIdFromIdToken(session.idToken);
    if (userId) identifyPurchasesUser(userId);
  }, [session?.idToken]);

  return null;
}

// The expo-splash-screen config plugin/JS API was removed entirely (July
// 2026) after multiple TestFlight builds got stuck showing the launch
// image indefinitely, even in a build with zero SplashScreen calls
// anywhere in the JS. Without that plugin, Expo falls back to the plain
// OS-level launch image generated from app.json's "splash" key -- a
// static storyboard that UIKit dismisses itself the instant this app's
// first frame renders, with no JS control and therefore no way to get
// stuck on it.
const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <CrashScreen>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PurchasesBootstrap />
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </CrashScreen>
  );
}
