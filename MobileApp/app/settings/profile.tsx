import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { SettingsField, SettingsHeader } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

export default function ProfileSettingsScreen() {
  const { profile, session, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.parentFirstName || profile?.parentName?.split(" ")[0] || "");
  const [lastName, setLastName] = useState(profile?.parentLastName || "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const initial = (firstName || profile?.parentName || "M").slice(0, 1).toUpperCase();

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(tabs)/settings");
  }

  async function save() {
    if (!firstName.trim()) {
      setNotice("Add a first name before saving.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const parentName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      await updateProfile({ parentFirstName: firstName.trim(), parentLastName: lastName.trim(), parentName });
      goBack();
    } catch {
      setNotice("Could not save right now. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 40, gap: 24 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <SettingsHeader title="Your profile" onBack={goBack} />

      <View style={{ alignItems: "center", gap: 10 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
          <Text selectable={false} style={{ color: "white", fontSize: 30, fontWeight: "700" }}>
            {initial}
          </Text>
        </View>
      </View>

      <SettingsField label="First name" value={firstName} onChangeText={setFirstName} placeholder="Your first name" autoCapitalize="words" />
      <SettingsField label="Last name" value={lastName} onChangeText={setLastName} placeholder="Your last name" autoCapitalize="words" />
      <SettingsField label="Email" value={session?.email || ""} editable={false} />

      {notice ? (
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center" }}>
          {notice}
        </Text>
      ) : null}

      <Pressable
        disabled={saving}
        onPress={save}
        style={{ minHeight: 52, borderRadius: 12, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", opacity: saving ? 0.6 : 1 }}
      >
        <Text selectable={false} style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
          {saving ? "Saving..." : "Save changes"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
