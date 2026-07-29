import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { useAuth, type ChildProfile } from "@/auth/auth-context";
import { PatriciaNoteCard, SettingsChoiceCard, SettingsHeader } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

const cadenceOptions: Array<{ value: NonNullable<ChildProfile["notificationCadence"]>; label: string }> = [
  { value: "daily", label: "Every day" },
  { value: "few-times-week", label: "A few times a week" },
  { value: "weekly", label: "Once a week" }
];

export default function NotificationSettingsScreen() {
  const { profile, updateProfile } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(tabs)/settings");
  }

  async function setCadence(value: ChildProfile["notificationCadence"]) {
    setNotice(null);
    try {
      await updateProfile({ notificationCadence: value });
    } catch {
      setNotice("Could not save that just now. Please try again.");
    }
  }

  async function setVaccineReminders(next: boolean) {
    setNotice(null);
    try {
      await updateProfile({ vaccineRemindersEnabled: next });
    } catch {
      setNotice("Could not save that just now. Please try again.");
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 40, gap: 22 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <SettingsHeader title="Notifications" onBack={goBack} />

      <PatriciaNoteCard text="I'll keep it to one message a day — never more. You choose how often." />

      <View style={{ gap: 12 }}>
        {cadenceOptions.map((option) => (
          <SettingsChoiceCard
            key={option.value}
            label={option.label}
            selected={(profile?.notificationCadence || "daily") === option.value}
            onPress={() => setCadence(option.value)}
          />
        ))}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 4 }}>
        <Text selectable style={{ flex: 1, color: theme.colors.text, fontSize: 14 }}>
          Vaccine reminders
        </Text>
        <Switch
          value={profile?.vaccineRemindersEnabled ?? true}
          onValueChange={setVaccineReminders}
          trackColor={{ true: theme.colors.bluePrimary, false: theme.colors.border }}
          thumbColor="white"
        />
      </View>
      <View style={{ height: 1, backgroundColor: theme.colors.border }} />

      {notice ? (
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center" }}>
          {notice}
        </Text>
      ) : null}
    </ScrollView>
  );
}
