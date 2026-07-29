import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "@/theme/theme";

export default function DeleteAccountCompleteScreen() {
  function done() {
    router.replace("/(auth)/onboarding");
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 20, alignItems: "center", justifyContent: "center" }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <Text selectable={false} style={{ color: theme.colors.bluePrimary, fontSize: 18, fontWeight: "700" }}>
        Nianza
      </Text>
      <Text selectable style={{ color: theme.colors.text, fontSize: 22, fontWeight: "700", textAlign: "center" }}>
        Your session has ended.
      </Text>
      <Text selectable style={{ color: theme.colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 320 }}>
        Your profile and conversations have been removed from this device. We hope the time you had with Patricia was
        worth something. Take care of yourselves.
      </Text>

      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "white", padding: 16, maxWidth: 340 }}>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17, textAlign: "center" }}>
          If you'd also like your data fully removed from Nianza's servers, email us and we'll confirm once it's done.
        </Text>
      </View>

      <Pressable
        onPress={done}
        style={{ minHeight: 52, borderRadius: 12, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}
      >
        <Text selectable={false} style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
          Done
        </Text>
      </Pressable>
    </ScrollView>
  );
}
