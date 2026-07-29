// NZA-POSTCARDS-v1.1-Seasonal Section 2: opt-in, parent-browsed only. Never
// auto-selected, never a default, never proactively notified (DO NOT 22) --
// these only render because a parent chose to open the picker's "Seasonal &
// Holiday" tab and tap one. Original simple line art only, no licensed IP.
import { Text, View } from "react-native";
import { Circle, Ellipse, Line, Path, Svg } from "react-native-svg";
import { theme } from "@/theme/theme";
import { PhotoOrPlaceholder, sans } from "./core-templates";
import { postcardPalette, serifFont, type PostcardSlotProps } from "./types";

function Caption({ headline, messageText, dateLine, tint }: { headline: string; messageText: string; dateLine: string; tint: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={[sans, { color: tint, fontSize: 14, fontWeight: "800" }]} numberOfLines={2}>{headline}</Text>
      <Text style={[serifFont, { color: postcardPalette.ink, fontSize: 12, lineHeight: 17 }]} numberOfLines={2}>{messageText}</Text>
      <Text style={{ color: theme.colors.muted, fontSize: 9, letterSpacing: 0.5 }}>{dateLine}</Text>
    </View>
  );
}

// Halloween: photo cropped into a simple pumpkin silhouette; gentle, not
// spooky. Oct 1 - Oct 31.
export function HalloweenTemplate({ photoUri, headline, messageText, dateLine }: PostcardSlotProps) {
  return (
    <View style={{ flex: 1, backgroundColor: "#FBEEDB", alignItems: "center", padding: "8%", gap: 12 }}>
      <View style={{ width: "74%", aspectRatio: 0.95 }}>
        <View style={{ position: "absolute", left: "50%", top: -6, width: 8, height: 16, backgroundColor: "#6B8E4E", marginLeft: -4, borderRadius: 3 }} />
        <PhotoOrPlaceholder uri={photoUri} style={{ width: "100%", height: "100%", borderRadius: 999 }} />
        <Svg width="100%" height="100%" viewBox="0 0 200 200" style={{ position: "absolute" }}>
          <Line x1="70" y1="6" x2="70" y2="194" stroke="#D97B3C" strokeWidth={3} opacity={0.5} />
          <Line x1="130" y1="6" x2="130" y2="194" stroke="#D97B3C" strokeWidth={3} opacity={0.5} />
        </Svg>
      </View>
      <Caption headline={headline} messageText={messageText} dateLine={dateLine} tint="#B5591F" />
    </View>
  );
}

// Christmas: photo framed with a simple ornament/string-light line-art
// border. Dec 1 - Dec 26.
export function ChristmasTemplate({ photoUri, headline, messageText, dateLine }: PostcardSlotProps) {
  const bulbs = [20, 55, 90, 125, 160, 195, 230, 265];
  return (
    <View style={{ flex: 1, backgroundColor: "#EFF4EC", padding: "8%", gap: 10 }}>
      <Svg width="100%" height="24" viewBox="0 0 300 24">
        <Path d="M0 4 Q150 30 300 4" stroke="#5B7A5C" strokeWidth={1.5} fill="none" />
        {bulbs.map((x, index) => (
          <Circle key={x} cx={x} cy={8 + Math.sin(x / 40) * 6} r={4} fill={["#C4453F", "#D9A441", "#34ABC4"][index % 3]} />
        ))}
      </Svg>
      <View style={{ flex: 1, borderRadius: 10, overflow: "hidden" }}>
        <PhotoOrPlaceholder uri={photoUri} style={{ width: "100%", height: "100%" }} />
      </View>
      <Caption headline={headline} messageText={messageText} dateLine={dateLine} tint="#5B7A5C" />
    </View>
  );
}

// Hanukkah: photo beside a simple menorah line-art motif, blue/white/gold.
// Admin-set yearly, lunar-calendar dates.
export function HanukkahTemplate({ photoUri, headline, messageText, dateLine }: PostcardSlotProps) {
  return (
    <View style={{ flex: 1, backgroundColor: "#F4F7F8", flexDirection: "row" }}>
      <View style={{ flex: 1 }}>
        <PhotoOrPlaceholder uri={photoUri} style={{ width: "100%", height: "100%" }} />
      </View>
      <View style={{ width: "34%", backgroundColor: theme.colors.blueDeep, padding: "6%", justifyContent: "center", alignItems: "center", gap: 10 }}>
        <Svg width="80%" height={90} viewBox="0 0 90 90">
          <Line x1="45" y1="20" x2="45" y2="80" stroke="#E3C567" strokeWidth={3} />
          {[10, 24, 38, 52, 66, 80].map((x, index) => (
            <Line key={x} x1={x} y1={20 + Math.abs(index - 2.5) * 4} x2={x} y2="80" stroke="#E3C567" strokeWidth={2.5} />
          ))}
          <Line x1="10" y1="80" x2="80" y2="80" stroke="#E3C567" strokeWidth={3} />
          {[10, 24, 38, 45, 52, 66, 80].map((x) => (
            <Circle key={`f${x}`} cx={x} cy={x === 45 ? 16 : 20 + Math.abs([10, 24, 38, 52, 66, 80].indexOf(x) - 2.5) * 4} r={2.6} fill="#F4C95D" />
          ))}
        </Svg>
        <Text style={[sans, { color: "white", fontSize: 12, fontWeight: "800", textAlign: "center" }]} numberOfLines={2}>{headline}</Text>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 10, lineHeight: 14, textAlign: "center" }} numberOfLines={3}>{messageText}</Text>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9 }}>{dateLine}</Text>
      </View>
    </View>
  );
}

// Lunar New Year: photo framed with a simple lantern-string motif, red/gold.
// Admin-set yearly, lunar-calendar dates.
export function LunarNewYearTemplate({ photoUri, headline, messageText, dateLine }: PostcardSlotProps) {
  const lanterns = [30, 90, 150, 210, 270];
  return (
    <View style={{ flex: 1, backgroundColor: "#B23A32", padding: "8%", gap: 12 }}>
      <Svg width="100%" height="46" viewBox="0 0 300 46">
        <Path d="M0 0 Q150 24 300 0" stroke="#E3C567" strokeWidth={1.5} fill="none" />
        {lanterns.map((x) => (
          <Ellipse key={x} cx={x} cy={30} rx={12} ry={15} fill="#E3C567" opacity={0.95} />
        ))}
        {lanterns.map((x) => (
          <Line key={`s${x}`} x1={x} y1="6" x2={x} y2="16" stroke="#E3C567" strokeWidth={1.5} />
        ))}
      </Svg>
      <View style={{ flex: 1, borderRadius: 10, overflow: "hidden", borderWidth: 3, borderColor: "#E3C567" }}>
        <PhotoOrPlaceholder uri={photoUri} style={{ width: "100%", height: "100%" }} />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={[sans, { color: "#F6E3A1", fontSize: 14, fontWeight: "800" }]} numberOfLines={2}>{headline}</Text>
        <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 12, lineHeight: 17 }} numberOfLines={2}>{messageText}</Text>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9 }}>{dateLine}</Text>
      </View>
    </View>
  );
}

// Diwali: photo framed with a simple diya (oil lamp) line-art motif, warm
// gold. Admin-set yearly, lunar-calendar dates.
export function DiwaliTemplate({ photoUri, headline, messageText, dateLine }: PostcardSlotProps) {
  return (
    <View style={{ flex: 1, backgroundColor: "#3A2440", padding: "8%", gap: 12 }}>
      <View style={{ flex: 1, borderRadius: 10, overflow: "hidden" }}>
        <PhotoOrPlaceholder uri={photoUri} style={{ width: "100%", height: "100%" }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 18 }}>
        {[0, 1, 2].map((index) => (
          <Svg key={index} width={index === 1 ? 46 : 34} height={index === 1 ? 46 : 34} viewBox="0 0 46 46">
            <Path d="M6 30 Q23 42 40 30 Q34 22 23 22 Q12 22 6 30 Z" fill="#D9A441" />
            <Path d="M23 20 C20 14, 24 8, 23 4 C26 9, 27 15, 23 20 Z" fill="#F4C95D" />
          </Svg>
        ))}
      </View>
      <View style={{ gap: 4, alignItems: "center" }}>
        <Text style={[sans, { color: "#F4C95D", fontSize: 14, fontWeight: "800", textAlign: "center" }]} numberOfLines={2}>{headline}</Text>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 17, textAlign: "center" }} numberOfLines={2}>{messageText}</Text>
        <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 9 }}>{dateLine}</Text>
      </View>
    </View>
  );
}
