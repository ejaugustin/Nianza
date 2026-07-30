import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "@/auth/auth-context";
import { theme } from "@/theme/theme";
import { CrashScreen } from "@/debug/CrashScreen";

const queryClient = new QueryClient();

// Explicit splash-screen control (July 2026): TestFlight builds were
// showing what looked like a persistent white/blank screen after a brief
// "logo flash" -- app.json's splash background (#F7F9FA) is a near-white
// off-white, easy to mistake for a blank crash. Nothing in this codebase
// ever called SplashScreen.hideAsync(), relying entirely on
// expo-splash-screen's implicit auto-hide behavior, which is not reliable
// across every SDK/release-build combination. preventAutoHideAsync() here
// takes explicit control, and the useEffect below guarantees hideAsync()
// actually fires once the root layout has mounted, regardless of what the
// implicit auto-hide would have done.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <CrashScreen>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </CrashScreen>
  );
}
