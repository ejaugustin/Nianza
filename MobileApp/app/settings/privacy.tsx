import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { SectionLabel, SettingsHeader } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

export default function PrivacySettingsScreen() {
  const { profile } = useAuth();
  const childName = profile?.childName || "your child";
  const [notice, setNotice] = useState<string | null>(null);

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(tabs)/settings");
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 40, gap: 26 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <SettingsHeader title="Privacy & data" onBack={goBack} />

      <View style={{ gap: 10 }}>
        <SectionLabel>YOUR CONVERSATIONS</SectionLabel>
        <Text selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>
          Conversations are private — never included in reports unless you choose.
        </Text>
        <Pressable onPress={() => setNotice("Conversation retention controls are coming soon. For now, Nianza keeps your conversations as long as your account is active.")}>
          <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 14, fontWeight: "600" }}>
            Change retention
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel>YOUR PHOTOS</SectionLabel>
        <Text selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>
          Child profile photos and milestone gallery photos are yours. They're never included in any report or emailed to anyone.
        </Text>
        <Text selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>
          Photos are deleted permanently when you delete your account.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel>DOWNLOAD YOUR DATA</SectionLabel>
        <Pressable
          onPress={() => setNotice("Data export is still being built. This will let you download a ZIP of all your reports.")}
          style={{ minHeight: 52, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}
        >
          <Text selectable={false} style={{ color: theme.colors.bluePrimary, fontSize: 16, fontWeight: "600" }}>
            Export all reports (ZIP)
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setNotice("Memory book export is still being built. This will let you download your photos and milestone captions as a ZIP.")}
          style={{ minHeight: 52, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}
        >
          <Text selectable={false} style={{ color: theme.colors.bluePrimary, fontSize: 16, fontWeight: "600" }}>
            Export memory book (ZIP)
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel>DELETE YOUR DATA</SectionLabel>
        <Pressable
          onPress={() => router.push({ pathname: "/settings/delete-account/offer", params: { scope: "child" } })}
          style={{ minHeight: 52, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.error, alignItems: "center", justifyContent: "center" }}
        >
          <Text selectable={false} style={{ color: theme.colors.error, fontSize: 16, fontWeight: "600" }}>
            Delete {childName}'s records
          </Text>
        </Pressable>
      </View>

      {notice ? (
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17, textAlign: "center" }}>
          {notice}
        </Text>
      ) : null}
    </ScrollView>
  );
}
