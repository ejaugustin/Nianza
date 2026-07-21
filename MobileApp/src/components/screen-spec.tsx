import { Image } from "expo-image";
import { ReactNode } from "react";
import { Text, View } from "react-native";
import { theme } from "@/theme/theme";

export function ScreenTitle({ title, subtitle, note }: { title: string; subtitle?: string; note?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: theme.colors.text, fontSize: 22, fontWeight: "600" }}>{title}</Text>
      {subtitle ? <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 18 }}>{subtitle}</Text> : null}
      {note ? <Text selectable style={{ color: theme.colors.muted, fontSize: 11, fontStyle: "italic", lineHeight: 15 }}>{note}</Text> : null}
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11, letterSpacing: 1 }}>{children}</Text>;
}

export function SpecCard({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <View
      style={[
        {
          backgroundColor: "white",
          borderRadius: 16,
          padding: 16,
          shadowColor: "#142832",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2
        },
        style
      ]}
    >
      {children}
    </View>
  );
}

export function Pill({ label, tone = "blue" }: { label: string; tone?: "blue" | "terracotta" }) {
  const isBlue = tone === "blue";
  return (
    <View style={{ alignSelf: "flex-start", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 6, backgroundColor: isBlue ? theme.colors.blueLight : theme.colors.terracottaLight }}>
      <Text selectable style={{ color: isBlue ? theme.colors.blueDeep : theme.colors.terracotta, fontSize: 11, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function CategoryChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <View style={{ borderRadius: 15, paddingHorizontal: active ? 16 : 4, paddingVertical: 8, backgroundColor: active ? theme.colors.blueLight : "transparent" }}>
      <Text selectable style={{ color: active ? theme.colors.blueDeep : theme.colors.greyIcon, fontSize: 12, fontWeight: active ? "600" : "400" }}>{label}</Text>
    </View>
  );
}

export function SfIcon({ name, color = theme.colors.bluePrimary, size = 22 }: { name: string; color?: string; size?: number }) {
  return <Image source={{ uri: `sf:${name}` }} style={{ width: size, height: size, tintColor: color }} contentFit="contain" />;
}

export function EmptyCircle({ checked }: { checked?: boolean }) {
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: checked ? theme.colors.bluePrimary : "transparent",
        borderWidth: checked ? 0 : 2,
        borderColor: theme.colors.border
      }}
    >
      {checked ? <SfIcon name="checkmark" color="white" size={15} /> : null}
    </View>
  );
}
