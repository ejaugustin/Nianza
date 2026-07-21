import { Link, router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { friendlyAuthError } from "@/auth/errors";
import { useAuth } from "@/auth/auth-context";
import { AuthButton, AuthError, AuthField } from "@/components/auth-ui";
import { BrandLogo } from "@/components/brand-logo";
import { theme } from "@/theme/theme";

export default function LoginScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await auth.signIn(email, password);
      router.replace(auth.profile ? "/(tabs)" : "/(auth)/onboarding");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingTop: 72, paddingBottom: 140, gap: 22 }} style={{ backgroundColor: theme.colors.background }}>
      <BrandLogo width={150} height={42} />
      <View style={{ gap: 7 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 24, fontWeight: "700" }}>Welcome back</Text>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 15 }}>Sign in to continue to Nianza.</Text>
      </View>
      <AuthError message={error} />
      <AuthField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
      <AuthField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Link href={{ pathname: "/(auth)/forgot-password", params: { email } }} asChild>
        <AuthButton variant="text">Forgot password?</AuthButton>
      </Link>
      <AuthButton loading={loading} disabled={!email || !password} onPress={submit}>Sign in</AuthButton>
      <View style={{ alignItems: "center", gap: 8, paddingTop: 12 }}>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>Do not have an account?</Text>
        <Link href="/(auth)/register" asChild>
          <AuthButton variant="text">Create one</AuthButton>
        </Link>
      </View>
    </ScrollView>
  );
}
