import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAuth, type ChildProfile } from "@/auth/auth-context";
import { SettingsChoiceCard, SettingsHeader } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

const languageOptions: Array<{ value: ChildProfile["language"]; label: string }> = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" }
];

export default function LanguageSettingsScreen() {
  const { profile, updateProfile } = useAuth();
  const [selected, setSelected] = useState<ChildProfile["language"]>(profile?.language || "en");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedLabel = languageOptions.find((option) => option.value === selected)?.label || "English";

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(tabs)/settings");
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      await updateProfile({ language: selected });
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
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 40, gap: 22 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <SettingsHeader title="Language" onBack={goBack} />

      <View style={{ gap: 12 }}>
        {languageOptions.map((option) => (
          <SettingsChoiceCard key={option.value} label={option.label} selected={selected === option.value} onPress={() => setSelected(option.value)} />
        ))}
      </View>

      {selected !== "en" ? (
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
          Patricia speaks English today. {selectedLabel} conversations and content are coming soon — this sets your preference for when they're ready.
        </Text>
      ) : null}

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
          {saving ? "Saving..." : `Switch to ${selectedLabel}`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
