import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { PatriciaNoteCard, SettingsField, SettingsHeader } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

export default function PediatricianContactScreen() {
  const { profile, updateProfile } = useAuth();
  const childName = profile?.childName || "Your child";
  const [name, setName] = useState(profile?.pediatricianName || "");
  const [email, setEmail] = useState(profile?.pediatricianEmail || "");
  const [phone, setPhone] = useState(profile?.pediatricianPhone || "");
  const [nextVisitDate, setNextVisitDate] = useState(profile?.nextVisitDate || "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(tabs)/settings");
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      await updateProfile({
        pediatricianName: name.trim(),
        pediatricianEmail: email.trim(),
        pediatricianPhone: phone.trim(),
        nextVisitDate: nextVisitDate.trim() || null
      });
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
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 40, gap: 20 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <SettingsHeader title={`${childName}'s pediatrician`} onBack={goBack} />

      <PatriciaNoteCard text="When your visit is coming up, I can prepare a report to send to the office for you." />

      <SettingsField label="Doctor's name" value={name} onChangeText={setName} placeholder="Optional" autoCapitalize="words" />
      <SettingsField label="Office email" value={email} onChangeText={setEmail} placeholder="Optional" keyboardType="email-address" autoCapitalize="none" />
      <SettingsField label="Office phone (optional)" value={phone} onChangeText={setPhone} placeholder="Optional" keyboardType="phone-pad" />
      <SettingsField label="Next scheduled visit (optional)" value={nextVisitDate} onChangeText={setNextVisitDate} placeholder="YYYY-MM-DD" />

      <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 18 }}>
        Nianza will show visit quick actions on your home screen 7 days before.
      </Text>

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
          {saving ? "Saving..." : "Save"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
