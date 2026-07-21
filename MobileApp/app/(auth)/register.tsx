import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { friendlyAuthError } from "@/auth/errors";
import { useAuth } from "@/auth/auth-context";
import { AuthButton, AuthError, AuthField } from "@/components/auth-ui";
import { BrandLogo } from "@/components/brand-logo";
import { theme } from "@/theme/theme";

export default function RegisterScreen() {
  const auth = useAuth();
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await auth.signUp(email, password, parentName, "en");
      router.push({ pathname: "/(auth)/confirm", params: { email } });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingTop: 72, paddingBottom: 140, gap: 18 }} style={{ backgroundColor: theme.colors.background }}>
      <BrandLogo width={150} height={42} />
      <View style={{ gap: 7 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 24, fontWeight: "700" }}>Create your account</Text>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 15, lineHeight: 21 }}>A few basics so Patricia knows who she is talking with.</Text>
      </View>
      <AuthError message={error} />
      <AuthField label="Your name" value={parentName} onChangeText={setParentName} placeholder="Maria" />
      <AuthField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
      <AuthField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="10+ characters" />
      <AuthButton loading={loading} disabled={!parentName || !email || password.length < 10} onPress={submit}>Create account</AuthButton>
      <AuthButton variant="text" onPress={() => router.back()}>Back</AuthButton>
    </ScrollView>
  );
}
