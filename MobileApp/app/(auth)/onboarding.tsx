import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { ChildProfile, useAuth } from "@/auth/auth-context";
import { AuthButton, AuthField } from "@/components/auth-ui";
import { BrandLogo } from "@/components/brand-logo";
import { PatriciaIntro } from "@/components/patricia-intro";
import { CategoryChip, SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

function monthsSince(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 4;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth());
}

export default function OnboardingScreen() {
  const auth = useAuth();
  const [parentName, setParentName] = useState(auth.profile?.parentName || "Maria");
  const [childName, setChildName] = useState(auth.profile?.childName || "Sofia");
  const [childBirthDate, setChildBirthDate] = useState(auth.profile?.childBirthDate || "2026-03-03");
  const [sexAtBirth, setSexAtBirth] = useState<ChildProfile["sexAtBirth"]>(auth.profile?.sexAtBirth || "girl");
  const [language, setLanguage] = useState<ChildProfile["language"]>(auth.profile?.language || "en");
  const [notificationsEnabled, setNotificationsEnabled] = useState(auth.profile?.notificationsEnabled ?? true);
  const [photoSelected, setPhotoSelected] = useState(false);

  async function submit() {
    await auth.completeOnboarding({
      parentName,
      childName,
      childBirthDate,
      sexAtBirth,
      language,
      notificationsEnabled,
      ageWindowMonths: monthsSince(childBirthDate)
    });
    router.replace("/(tabs)");
  }

  return (
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingTop: 52, paddingBottom: 140, gap: 18 }} style={{ backgroundColor: theme.colors.background }}>
      <BrandLogo width={150} height={42} />
      <View style={{ gap: 7 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 24, fontWeight: "700" }}>Let Patricia meet your family</Text>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 15, lineHeight: 21 }}>These details help Nianza keep advice age-aware and personal.</Text>
      </View>
      <PatriciaIntro />
      <AuthField label="Your name" value={parentName} onChangeText={setParentName} />
      <AuthField label="Child name" value={childName} onChangeText={setChildName} />
      <AuthField label="Child birth date" value={childBirthDate} onChangeText={setChildBirthDate} placeholder="YYYY-MM-DD" />
      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "600" }}>Sex at birth</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {(["girl", "boy"] as const).map((option) => (
            <Pressable key={option} onPress={() => setSexAtBirth(option)} style={{ flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: sexAtBirth === option ? theme.colors.blueLight : "white", borderWidth: 1.5, borderColor: sexAtBirth === option ? theme.colors.bluePrimary : theme.colors.border }}>
              <Text selectable style={{ color: sexAtBirth === option ? theme.colors.blueDeep : theme.colors.text, fontSize: 14, fontWeight: "700" }}>{option === "girl" ? "Girl" : "Boy"}</Text>
            </Pressable>
          ))}
        </View>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>Used for growth chart references and so Patricia's notes use the right words for {childName || "your child"}.</Text>
      </View>
      <Pressable onPress={() => setPhotoSelected(!photoSelected)} style={{ alignItems: "center", borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 18, gap: 8 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: theme.colors.bluePrimary, backgroundColor: photoSelected ? theme.colors.bluePrimary : theme.colors.blueLight, alignItems: "center", justifyContent: "center" }}>
          <SfIcon name={photoSelected ? "checkmark" : "camera"} color={photoSelected ? "white" : theme.colors.bluePrimary} size={24} />
        </View>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 14 }}>{photoSelected ? "Photo placeholder selected" : `Add a photo of ${childName || "your child"} (optional)`}</Text>
      </Pressable>
      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "600" }}>Language</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["en", "es", "fr", "ar"] as const).map((option) => (
            <AuthButton key={option} variant="text" onPress={() => setLanguage(option)}>
              {option.toUpperCase()}
            </AuthButton>
          ))}
        </View>
        <CategoryChip label={`Selected: ${language.toUpperCase()}`} active />
      </View>
      <View style={{ minHeight: 58, borderRadius: 14, backgroundColor: "white", paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "700" }}>Gentle reminders</Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 12 }}>Notification scheduling will be wired next.</Text>
        </View>
        <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ true: theme.colors.blueLight, false: theme.colors.border }} thumbColor={notificationsEnabled ? theme.colors.bluePrimary : "white"} />
      </View>
      <AuthButton disabled={!parentName || !childName || !childBirthDate} onPress={submit}>Continue</AuthButton>
      <AuthButton variant="text" onPress={auth.signOut}>Sign out</AuthButton>
    </ScrollView>
  );
}
