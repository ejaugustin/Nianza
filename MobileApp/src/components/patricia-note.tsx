import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

export function PatriciaNote({ children, isPlaying, onTogglePlay }: { children: ReactNode; isPlaying?: boolean; onTogglePlay?: () => void }) {
  return (
    <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radii.card, padding: 18, borderLeftWidth: 3, borderLeftColor: theme.colors.bluePrimary, gap: 12 }}>
      <View style={{ position: "absolute", top: 14, right: 14, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bluePrimary }}>
        <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>P</Text>
      </View>
      <Text selectable style={{ color: theme.colors.text, fontSize: 16, lineHeight: 23, paddingRight: 30, fontStyle: "italic" }}>{children}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable onPress={onTogglePlay} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
          {isPlaying ? (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <View style={{ width: 4, height: 16, backgroundColor: "white", borderRadius: 2 }} />
              <View style={{ width: 4, height: 16, backgroundColor: "white", borderRadius: 2 }} />
            </View>
          ) : (
            <SfIcon name="play" color="white" size={18} />
          )}
        </Pressable>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12 }}>{isPlaying ? "Playing Patricia's note" : "Listen to Patricia's note"}</Text>
      </View>
      {isPlaying ? <View style={{ height: 2, borderRadius: 1, backgroundColor: theme.colors.bluePrimary }} /> : null}
    </View>
  );
}
