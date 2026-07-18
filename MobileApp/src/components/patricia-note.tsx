import { ReactNode } from "react";
import { Text, View } from "react-native";
import { theme } from "@/theme/theme";

export function PatriciaNote({ children }: { children: ReactNode }) {
  return (
    <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radii.card, padding: 18, borderLeftWidth: 3, borderLeftColor: theme.colors.bluePrimary, gap: 12 }}>
      <View style={{ position: "absolute", top: 14, right: 14, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bluePrimary }}>
        <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>P</Text>
      </View>
      <Text selectable style={{ color: theme.colors.text, fontSize: 16, lineHeight: 23, paddingRight: 30 }}>{children}</Text>
    </View>
  );
}
