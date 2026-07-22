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
          boxShadow: "0 2px 8px rgba(20, 40, 50, 0.08)"
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

function IconLine({ color, style }: { color: string; style: object }) {
  return <View style={[{ position: "absolute", height: 2, borderRadius: 1, backgroundColor: color }, style]} />;
}

export function SfIcon({ name, color = theme.colors.bluePrimary, size = 22 }: { name: string; color?: string; size?: number }) {
  const box = { width: size, height: size };

  if (name === "home" || name === "house.fill") {
    return (
      <View style={box}>
        <IconLine color={color} style={{ width: size * 0.58, left: size * 0.21, top: size * 0.36, transform: [{ rotate: "-38deg" }] }} />
        <IconLine color={color} style={{ width: size * 0.58, right: size * 0.21, top: size * 0.36, transform: [{ rotate: "38deg" }] }} />
        <View style={{ position: "absolute", left: size * 0.22, top: size * 0.48, width: size * 0.56, height: size * 0.38, borderWidth: 2, borderTopWidth: 0, borderColor: color, borderRadius: 2 }} />
      </View>
    );
  }

  if (name === "checkmark") {
    return (
      <View style={box}>
        <IconLine color={color} style={{ width: size * 0.28, left: size * 0.2, top: size * 0.54, transform: [{ rotate: "42deg" }] }} />
        <IconLine color={color} style={{ width: size * 0.58, left: size * 0.36, top: size * 0.46, transform: [{ rotate: "-48deg" }] }} />
      </View>
    );
  }

  if (name === "shield") {
    return <View style={[box, { borderWidth: 2, borderColor: color, borderRadius: size * 0.22, transform: [{ scaleX: 0.76 }], opacity: 0.95 }]} />;
  }

  if (name === "chat" || name === "message.fill") {
    return (
      <View style={box}>
        <View style={{ position: "absolute", left: size * 0.1, top: size * 0.2, width: size * 0.8, height: size * 0.52, borderWidth: 2, borderColor: color, borderRadius: size * 0.2 }} />
        <View style={{ position: "absolute", left: size * 0.26, top: size * 0.67, width: size * 0.18, height: size * 0.18, backgroundColor: color, transform: [{ rotate: "45deg" }] }} />
      </View>
    );
  }

  if (name === "doc.text") {
    return (
      <View style={box}>
        <View style={{ position: "absolute", left: size * 0.22, top: size * 0.08, width: size * 0.56, height: size * 0.82, borderWidth: 2, borderColor: color, borderRadius: 2 }} />
        <IconLine color={color} style={{ width: size * 0.34, left: size * 0.33, top: size * 0.34 }} />
        <IconLine color={color} style={{ width: size * 0.34, left: size * 0.33, top: size * 0.5 }} />
        <IconLine color={color} style={{ width: size * 0.22, left: size * 0.33, top: size * 0.66 }} />
      </View>
    );
  }

  if (name === "bell") {
    return (
      <View style={box}>
        <View style={{ position: "absolute", left: size * 0.22, top: size * 0.18, width: size * 0.56, height: size * 0.56, borderWidth: 2, borderColor: color, borderRadius: size * 0.28, borderBottomWidth: 0 }} />
        <IconLine color={color} style={{ width: size * 0.66, left: size * 0.17, top: size * 0.72 }} />
        <View style={{ position: "absolute", left: size * 0.44, top: size * 0.82, width: size * 0.12, height: size * 0.12, borderRadius: size * 0.06, backgroundColor: color }} />
      </View>
    );
  }

  if (name === "camera") {
    return (
      <View style={box}>
        <View style={{ position: "absolute", left: size * 0.12, top: size * 0.28, width: size * 0.76, height: size * 0.5, borderWidth: 2, borderColor: color, borderRadius: size * 0.12 }} />
        <View style={{ position: "absolute", left: size * 0.32, top: size * 0.42, width: size * 0.36, height: size * 0.24, borderWidth: 2, borderColor: color, borderRadius: size * 0.18 }} />
        <IconLine color={color} style={{ width: size * 0.2, left: size * 0.26, top: size * 0.22 }} />
      </View>
    );
  }

  if (name === "eye" || name === "eye.slash") {
    return (
      <View style={box}>
        <View style={{ position: "absolute", left: size * 0.1, top: size * 0.28, width: size * 0.8, height: size * 0.44, borderWidth: 2, borderColor: color, borderRadius: size * 0.3, transform: [{ scaleY: 0.82 }] }} />
        <View style={{ position: "absolute", left: size * 0.39, top: size * 0.39, width: size * 0.22, height: size * 0.22, borderRadius: size * 0.11, backgroundColor: color }} />
        {name === "eye.slash" ? <IconLine color={color} style={{ width: size * 0.9, left: size * 0.06, top: size * 0.5, transform: [{ rotate: "-35deg" }] }} /> : null}
      </View>
    );
  }

  if (name === "play") {
    return (
      <View style={box}>
        <View
          style={{
            position: "absolute",
            left: size * 0.34,
            top: size * 0.18,
            width: 0,
            height: 0,
            borderTopWidth: size * 0.32,
            borderBottomWidth: size * 0.32,
            borderLeftWidth: size * 0.46,
            borderTopColor: "transparent",
            borderBottomColor: "transparent",
            borderLeftColor: color
          }}
        />
      </View>
    );
  }

  if (name === "gear") {
    return (
      <View style={box}>
        <View style={{ position: "absolute", left: size * 0.2, top: size * 0.2, width: size * 0.6, height: size * 0.6, borderWidth: 2, borderColor: color, borderRadius: size * 0.3 }} />
        <View style={{ position: "absolute", left: size * 0.42, top: size * 0.42, width: size * 0.16, height: size * 0.16, borderRadius: size * 0.08, backgroundColor: color }} />
        {Array.from({ length: 8 }).map((_, index) => {
          const rotate = `${index * 45}deg`;
          return <IconLine key={index} color={color} style={{ width: size * 0.18, left: size * 0.41, top: size * 0.49, transform: [{ rotate }, { translateX: size * 0.35 }] }} />;
        })}
      </View>
    );
  }

  if (name === "speaker.wave.2.fill") {
    return (
      <View style={box}>
        <View style={{ position: "absolute", left: size * 0.12, top: size * 0.36, width: size * 0.18, height: size * 0.28, borderRadius: size * 0.04, backgroundColor: color }} />
        <View style={{ position: "absolute", left: size * 0.26, top: size * 0.24, width: size * 0.26, height: size * 0.52, backgroundColor: color, borderRadius: size * 0.04, transform: [{ skewY: "-18deg" }] }} />
        <View style={{ position: "absolute", left: size * 0.58, top: size * 0.34, width: size * 0.24, height: size * 0.32, borderRightWidth: 2, borderColor: color, borderRadius: size * 0.18 }} />
        <View style={{ position: "absolute", left: size * 0.54, top: size * 0.22, width: size * 0.34, height: size * 0.56, borderRightWidth: 2, borderColor: color, borderRadius: size * 0.26 }} />
      </View>
    );
  }

  if (name === "mic.fill") {
    return (
      <View style={box}>
        <View style={{ position: "absolute", left: size * 0.36, top: size * 0.08, width: size * 0.28, height: size * 0.5, borderRadius: size * 0.14, backgroundColor: color }} />
        <View style={{ position: "absolute", left: size * 0.22, top: size * 0.42, width: size * 0.56, height: size * 0.28, borderBottomWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, borderColor: color, borderBottomLeftRadius: size * 0.28, borderBottomRightRadius: size * 0.28 }} />
        <IconLine color={color} style={{ width: 2, height: size * 0.2, left: size * 0.46, top: size * 0.68 }} />
        <IconLine color={color} style={{ width: size * 0.3, left: size * 0.35, top: size * 0.9 }} />
      </View>
    );
  }

  if (name === "pause.fill") {
    return (
      <View style={box}>
        <View style={{ position: "absolute", left: size * 0.26, top: size * 0.18, width: size * 0.16, height: size * 0.64, borderRadius: size * 0.04, backgroundColor: color }} />
        <View style={{ position: "absolute", right: size * 0.26, top: size * 0.18, width: size * 0.16, height: size * 0.64, borderRadius: size * 0.04, backgroundColor: color }} />
      </View>
    );
  }

  if (name === "paperplane.fill") {
    return (
      <View style={box}>
        <View style={{ position: "absolute", left: size * 0.1, top: size * 0.18, width: size * 0.76, height: size * 0.44, backgroundColor: color, transform: [{ rotate: "18deg" }], borderTopLeftRadius: size * 0.08, borderBottomLeftRadius: size * 0.08 }} />
        <View style={{ position: "absolute", left: size * 0.46, top: size * 0.44, width: size * 0.28, height: size * 0.28, backgroundColor: color, transform: [{ rotate: "45deg" }], borderRadius: size * 0.03 }} />
      </View>
    );
  }

  if (name === "trash") {
    return (
      <View style={box}>
        <IconLine color={color} style={{ width: size * 0.52, left: size * 0.24, top: size * 0.24 }} />
        <IconLine color={color} style={{ width: size * 0.3, left: size * 0.35, top: size * 0.12 }} />
        <View style={{ position: "absolute", left: size * 0.26, top: size * 0.32, width: size * 0.48, height: size * 0.56, borderWidth: 2, borderColor: color, borderTopWidth: 0, borderBottomLeftRadius: size * 0.08, borderBottomRightRadius: size * 0.08 }} />
        <IconLine color={color} style={{ width: 2, height: size * 0.36, left: size * 0.4, top: size * 0.42 }} />
        <IconLine color={color} style={{ width: 2, height: size * 0.36, left: size * 0.58, top: size * 0.42 }} />
      </View>
    );
  }

  if (name === "chevron.left" || name === "chevron.right" || name === "chevron.down") {
    const down = name === "chevron.down";
    const right = name === "chevron.right";
    return (
      <View style={box}>
        <IconLine color={color} style={{ width: size * 0.45, left: down ? size * 0.18 : right ? size * 0.34 : size * 0.2, top: down ? size * 0.42 : size * 0.34, transform: [{ rotate: down ? "40deg" : right ? "45deg" : "-45deg" }] }} />
        <IconLine color={color} style={{ width: size * 0.45, left: down ? size * 0.47 : right ? size * 0.34 : size * 0.2, top: down ? size * 0.42 : size * 0.64, transform: [{ rotate: down ? "-40deg" : right ? "-45deg" : "45deg" }] }} />
      </View>
    );
  }

  return <View style={[box, { borderRadius: size / 2, backgroundColor: color }]} />;
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
