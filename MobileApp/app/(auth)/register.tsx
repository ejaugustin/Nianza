import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { friendlyAuthError } from "@/auth/errors";
import { useAuth } from "@/auth/auth-context";
import { AuthButton, AuthError, AuthField } from "@/components/auth-ui";
import { BrandLogo } from "@/components/brand-logo";
import { theme } from "@/theme/theme";

function passwordChecks(password: string, confirmPassword: string) {
  return [
    { label: "At least 10 characters", valid: password.length >= 10 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "One lowercase letter", valid: /[a-z]/.test(password) },
    { label: "One number", valid: /\d/.test(password) },
    { label: "One symbol", valid: /[^A-Za-z0-9]/.test(password) },
    { label: "Passwords match", valid: password.length > 0 && password === confirmPassword }
  ];
}

export default function RegisterScreen() {
  const auth = useAuth();
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const checks = passwordChecks(password, confirmPassword);
  const passwordValid = checks.every((check) => check.valid);

  async function submit() {
    setError("");
    if (!parentName.trim()) {
      setError("Add your first name before creating the account.");
      return;
    }
    if (!email.trim()) {
      setError("Add the email you want to use for this account.");
      return;
    }
    if (!passwordValid) {
      setError("Finish the password checklist before creating the account.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords do not match yet.");
      return;
    }
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
      <AuthField label="First name" value={parentName} onChangeText={setParentName} placeholder="Anna" />
      <AuthField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
      <AuthField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="10+ characters" />
      <AuthField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Type it again" />
      <View style={{ borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, padding: 14, gap: 8 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 13, fontWeight: "800" }}>Password needs</Text>
        {checks.map((check) => (
          <View key={check.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: check.valid ? theme.colors.bluePrimary : theme.colors.border }} />
            <Text selectable style={{ color: check.valid ? theme.colors.blueDeep : theme.colors.muted, fontSize: 12, lineHeight: 16 }}>
              {check.label}
            </Text>
          </View>
        ))}
      </View>
      <AuthButton loading={loading} disabled={!parentName.trim() || !email.trim() || !passwordValid} onPress={submit}>Create account</AuthButton>
      <AuthButton variant="text" onPress={() => router.replace("/(auth)/welcome")}>Back</AuthButton>
    </ScrollView>
  );
}
