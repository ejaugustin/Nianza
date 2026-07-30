import { useCallback } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "@/auth/auth-context";
import { theme } from "@/theme/theme";
import { CrashScreen } from "@/debug/CrashScreen";

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  // A useEffect(() => hideAsync(), []) fires on first render, which can
  // race ahead of the native view actually completing its layout pass --
  // the splash then gets told to hide before there's anything painted to
  // reveal, and on some SDK/device combinations it just stays put. Wiring
  // hideAsync() to the root view's own onLayout (the pattern Expo's docs
  // recommend) guarantees it only fires once real content has actually
  // laid out underneath it.
  const onLayoutRootView = useCallback(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
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
    </View>
  );
}
