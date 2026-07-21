import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { friendlyAuthError } from "@/auth/errors";
import { useAuth } from "@/auth/auth-context";
import { AuthButton, AuthError, AuthField } from "@/components/auth-ui";
import { theme } from "@/theme/theme";

export default function ForgotPasswordScreen() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await auth.requestReset(email);
      router.push({ pathname: "/(auth)/reset-password", params: { email } });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingTop: 72, paddingBottom: 140, gap: 18 }} style={{ backgroundColor: theme.colors.background }}>
      <View style={{ gap: 7 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 24, fontWeight: "700" }}>Reset your password</Text>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 15, lineHeight: 21 }}>We will send a reset code to your email.</Text>
      </View>
      <AuthError message={error} />
      <AuthField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <AuthButton loading={loading} disabled={!email} onPress={submit}>Send reset code</AuthButton>
      <AuthButton variant="text" onPress={() => router.back()}>Back</AuthButton>
    </ScrollView>
  );
}
