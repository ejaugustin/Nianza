import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { theme } from "@/theme/theme";

export default function Index() {
  const auth = useAuth();

  if (auth.status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.bluePrimary} />
      </View>
    );
  }
  if (auth.status === "unauthenticated") return <Redirect href="/(auth)/welcome" />;
  if (!auth.profile) return <Redirect href="/(auth)/onboarding" />;

  return <Redirect href="/(tabs)" />;
}
