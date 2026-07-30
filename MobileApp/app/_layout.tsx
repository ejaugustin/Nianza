import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/auth/auth-context";
import { theme } from "@/theme/theme";
import { CrashScreen } from "@/debug/CrashScreen";

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
