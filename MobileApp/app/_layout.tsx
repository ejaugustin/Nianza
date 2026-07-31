import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/auth/auth-context";
import { theme } from "@/theme/theme";
import { CrashScreen } from "@/debug/CrashScreen";

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
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </CrashScreen>
  );
}
