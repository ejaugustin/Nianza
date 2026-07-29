// NZA-POSTCARDS-v1.1-Seasonal Section 1: secular, evergreen, safe for every
// family. Date-gated by the registry (registry.ts), never auto-selected or
// defaulted -- these components are only ever reachable by a parent tapping
// into the picker's separate "Seasonal & Holiday" tab.
import { Text, View } from "react-native";
import { Circle, Ellipse, Path, Svg } from "react-native-svg";
import { theme } from "@/theme/theme";
import { PhotoOrPlaceholder, sans } from "./core-templates";
import { postcardPalette, serifFont, type PostcardSlotProps } from "./types";

function Footer({ headline, dateLine, light }: { headline: string; dateLine: string; light?: boolean }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={[sans, { color: light ? "white" : theme.colors.blueDeep, fontSize: 14, fontWeight: "800" }]} numberOfLines={2}>
        {headline}
      </Text>
      <Text style={{ color: light ? "rgba(255,255,255,0.65)" : theme.colors.muted, fontSize: 10, letterSpacing: 0.5 }}>{dateLine}</Text>
    </View>
  );
}

// Autumn Leaves: photo framed by a scattering of simple line-art leaves
// along one edge. Sep 15 - Nov 15.
export function AutumnLeavesTemplate({ photoUri, headline, messageText, dateLine }: PostcardSlotProps) {
  return (
    <View style={{ flex: 1, backgroundColor: "#F6ECDD", padding: "8%", gap: 12 }}>
      <View style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}>
        <PhotoOrPlaceholder uri={photoUri} style={{ width: "100%", height: "100%" }} />
      </View>
      <Svg width="100%" height="26" viewBox="0 0 300 26">
        {[18, 60, 104, 150, 196, 240, 282].map((x, index) => (
          <Path
            key={x}
            d={`M${x} 22 C ${x - 8} 10, ${x - 2} 2, ${x} 0 C ${x + 2} 2, ${x + 8} 10, ${x} 22 Z`}
            fill={index % 2 === 0 ? theme.colors.terracotta : "#C98A2C"}
            opacity={0.85}
          />
        ))}
      </Svg>
      <Text style={[serifFont, { color: postcardPalette.ink, fontSize: 13, lineHeight: 19 }]} numberOfLines={3}>{messageText}</Text>
      <Footer headline={headline} dateLine={dateLine} />
    </View>
  );
}

// Winter Snow: photo behind a light snowfall overlay, cool palette. Neutral
// December option for any family. Dec 1 - Feb 15.
export function WinterSnowTemplate({ photoUri, headline, messageText, dateLine }: PostcardSlotProps) {
  const flakes = [12, 40, 70, 95, 130, 160, 190, 220, 250, 275];
  return (
    <View style={{ flex: 1, backgroundColor: "#E7F1F4" }}>
      <PhotoOrPlaceholder uri={photoUri} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
      <Svg width="100%" height="100%" viewBox="0 0 300 400" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
        {flakes.map((x, index) => (
          <Circle key={x} cx={x} cy={20 + ((index * 47) % 360)} r={index % 3 === 0 ? 3 : 2} fill="white" opacity={0.85} />
        ))}
      </Svg>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "8%", backgroundColor: "rgba(19,45,58,0.55)", gap: 6 }}>
        <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 19 }} numberOfLines={3}>{messageText}</Text>
        <Footer headline={headline} dateLine={dateLine} light />
      </View>
    </View>
  );
}

// Spring Bloom: photo cropped into a soft flower-petal shape, floral line
// art border. Mar 1 - May 31.
export function SpringBloomTemplate({ photoUri, headline, messageText, dateLine }: PostcardSlotProps) {
  return (
    <View style={{ flex: 1, backgroundColor: "#F6F1E4", alignItems: "center", padding: "8%", gap: 12 }}>
      <View style={{ width: "72%", aspectRatio: 1 }}>
        <PhotoOrPlaceholder uri={photoUri} style={{ width: "100%", height: "100%", borderRadius: 999 }} />
        <Svg width="100%" height="100%" viewBox="0 0 200 200" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <Ellipse
              key={angle}
              cx={100}
              cy={16}
              rx={10}
              ry={16}
              fill="#E8A6B8"
              opacity={0.9}
              origin="100, 100"
              rotation={angle}
            />
          ))}
        </Svg>
      </View>
      <Text style={[serifFont, { textAlign: "center", color: postcardPalette.ink, fontSize: 13, lineHeight: 19, paddingHorizontal: 6 }]} numberOfLines={3}>
        {messageText}
      </Text>
      <View style={{ alignItems: "center" }}>
        <Footer headline={headline} dateLine={dateLine} />
      </View>
    </View>
  );
}

// Summer Sun: full-bleed photo with a simple sun/wave motif along the
// bottom edge. Jun 1 - Aug 31.
export function SummerSunTemplate({ photoUri, headline, messageText, dateLine }: PostcardSlotProps) {
  return (
    <View style={{ flex: 1, backgroundColor: "#FCEFC7" }}>
      <PhotoOrPlaceholder uri={photoUri} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: "22%" }} />
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "22%", backgroundColor: "#FCEFC7", padding: "6%", flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Svg width={40} height={40} viewBox="0 0 40 40">
          <Circle cx="20" cy="20" r="10" fill={theme.colors.terracotta} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <Path key={angle} d="M20 4 L20 0" stroke={theme.colors.terracotta} strokeWidth={2} strokeLinecap="round" origin="20, 20" rotation={angle} />
          ))}
        </Svg>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[sans, { color: "#7A4A1E", fontSize: 14, fontWeight: "800" }]} numberOfLines={1}>{headline}</Text>
          <Text style={{ color: "#7A4A1E", fontSize: 11, lineHeight: 15 }} numberOfLines={2}>{messageText}</Text>
        </View>
      </View>
      <Text style={{ position: "absolute", top: "4%", left: "6%", color: "white", fontSize: 10, letterSpacing: 0.5, opacity: 0.85 }}>{dateLine}</Text>
    </View>
  );
}
