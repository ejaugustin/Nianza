import { Redirect } from "expo-router";
import { useAuth } from "@/auth/auth-context";

export default function Index() {
  const auth = useAuth();

  if (auth.status === "loading") return null;
  if (auth.status === "unauthenticated") return <Redirect href="/(auth)/welcome" />;
  if (!auth.profile) return <Redirect href="/(auth)/onboarding" />;

  return <Redirect href="/(tabs)" />;
}
