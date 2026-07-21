import { ScrollView, Text, View } from "react-native";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

export default function ChatScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ height: 66, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: theme.colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}>
        <SfIcon name="chevron.left" color={theme.colors.text} size={22} />
        <Text selectable style={{ color: theme.colors.text, fontSize: 17, fontWeight: "600" }}>Patricia</Text>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.6, borderColor: theme.colors.muted, alignItems: "center", justifyContent: "center" }}>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 11, fontStyle: "italic" }}>i</Text>
        </View>
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingTop: 24, paddingBottom: 120 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>P</Text>
          </View>
          <View style={{ maxWidth: 220, borderRadius: 16, backgroundColor: theme.colors.card, paddingHorizontal: 14, paddingVertical: 15 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 14, lineHeight: 20 }}>
              Hello, Maria. I'm Patricia. I've been with a lot of new parents over the years, and I'm glad you're here. What's on your mind?
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={{ position: "absolute", left: 20, right: 20, bottom: 24, alignItems: "center", gap: 10 }}>
        <View style={{ height: 56, borderRadius: 28, backgroundColor: theme.colors.bluePrimary, alignSelf: "stretch", alignItems: "center", justifyContent: "center" }}>
          <SfIcon name="mic.fill" color="white" size={28} />
        </View>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12 }}>or type instead</Text>
      </View>
    </View>
  );
}
