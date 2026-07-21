import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { friendlyAuthError } from "@/auth/errors";
import { useAuth } from "@/auth/auth-context";
import { AuthButton, AuthError, AuthField } from "@/components/auth-ui";
import { theme } from "@/theme/theme";

export default function ConfirmScreen() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await auth.confirmEmail(email, code);
      router.replace({ pathname: "/(auth)/login", params: { email } });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingTop: 72, paddingBottom: 140, gap: 18 }} style={{ backgroundColor: theme.colors.background }}>
      <View style={{ gap: 7 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 24, fontWeight: "700" }}>Confirm your email</Text>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 15, lineHeight: 21 }}>Enter the code Cognito sent to your inbox.</Text>
      </View>
      <AuthError message={error} />
      <AuthField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <AuthField label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" />
      <AuthButton loading={loading} disabled={!email || !code} onPress={submit}>Confirm email</AuthButton>
      <AuthButton variant="text" onPress={() => router.back()}>Back</AuthButton>
    </ScrollView>
  );
}
