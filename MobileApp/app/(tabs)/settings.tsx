import { Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { ScreenTitle, SectionLabel, SfIcon, SpecCard } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

const settingsRows = [
  { title: "Your profile", subtitle: "Name, email, and account basics" },
  { title: "Sofia's profile", subtitle: "Birth date, language, and child details" },
  { title: "Notifications", subtitle: "Daily notes and gentle reminders" },
  { title: "Language", subtitle: "English now, Spanish next" },
  { title: "Privacy & data", subtitle: "Export or delete your Nianza data" }
];

export default function SettingsScreen() {
  const { profile, signOut } = useAuth();
  const childName = profile?.childName || "Sofia";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 32, gap: 18 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <ScreenTitle title="Settings" subtitle="Keep Nianza calm, personal, and yours." />

      <SpecCard style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
            <Text selectable={false} style={{ color: "white", fontSize: 16, fontWeight: "800" }}>{(profile?.parentName || "M").slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "700" }}>{profile?.parentName || "Maria"}</Text>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 12 }}>{childName}'s Nianza account</Text>
          </View>
        </View>
      </SpecCard>

      <SectionLabel>YOUR FAMILY</SectionLabel>
      <SpecCard style={{ gap: 0, paddingVertical: 4 }}>
        {settingsRows.map((row, index) => (
          <Pressable key={row.title} style={{ minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "700" }}>{row.title.replace("Sofia", childName)}</Text>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 15 }}>{row.subtitle}</Text>
            </View>
            <SfIcon name="chevron.right" color={theme.colors.greyIcon} size={16} />
            {index < settingsRows.length - 1 ? <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, backgroundColor: theme.colors.border }} /> : null}
          </Pressable>
        ))}
      </SpecCard>

      <SectionLabel>ACCOUNT</SectionLabel>
      <Pressable onPress={signOut} style={{ minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
        <Text selectable={false} style={{ color: theme.colors.bluePrimary, fontSize: 15, fontWeight: "800" }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
