import { Image } from "expo-image";
import { Platform, Text, View } from "react-native";
import { Circle, Line, Svg } from "react-native-svg";
import { theme } from "@/theme/theme";
import { postcardPalette, serifFont, type PostcardSlotProps } from "./types";

export const sans = { fontFamily: Platform.OS === "ios" ? "Avenir Next" : "sans-serif" };

export function PhotoOrPlaceholder({ uri, style }: { uri: string | null; style: object }) {
  if (!uri) {
    return (
      <View style={[style, { backgroundColor: "rgba(0,0,0,0.08)", alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: postcardPalette.ink, opacity: 0.4, fontSize: 12 }}>No photo</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={style} contentFit="cover" />;
}

// --- The Polaroid: tilted photo in a white frame, washi-tape corners, a
// handwritten-style caption underneath. General updates, casual moments.
export function PolaroidTemplate({ photoUri, headline, messageText, dateLine }: PostcardSlotProps) {
  return (
    <View style={{ flex: 1, backgroundColor: postcardPalette.cream, alignItems: "center", justifyContent: "center", padding: "8%" }}>
      <View
        style={{
          backgroundColor: "white",
          padding: 14,
          paddingBottom: 22,
          borderRadius: 3,
          transform: [{ rotate: "-2.5deg" }],
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
          width: "88%"
        }}
      >
        <View style={{ position: "absolute", top: -10, left: "18%", width: 46, height: 20, backgroundColor: "rgba(196,113,74,0.55)", transform: [{ rotate: "-8deg" }] }} />
        <View style={{ position: "absolute", top: -10, right: "18%", width: 46, height: 20, backgroundColor: "rgba(52,171,196,0.5)", transform: [{ rotate: "7deg" }] }} />
        <PhotoOrPlaceholder uri={photoUri} style={{ width: "100%", aspectRatio: 1 }} />
        <Text style={[serifFont, { marginTop: 14, textAlign: "center", color: postcardPalette.ink, fontSize: 15, fontStyle: "italic" }]} numberOfLines={3}>
          {headline}
        </Text>
      </View>
      <Text style={[serifFont, { marginTop: 16, textAlign: "center", color: postcardPalette.ink, fontSize: 13, lineHeight: 19, paddingHorizontal: 6 }]} numberOfLines={4}>
        {messageText}
      </Text>
      <Text style={{ marginTop: 10, color: theme.colors.muted, fontSize: 10, letterSpacing: 0.5 }}>{dateLine}</Text>
    </View>
  );
}

// --- The Arch: photo cropped into a tall arch, headline above, serif
// message below. Minimal and elegant -- quieter milestones, portraits.
export function ArchTemplate({ photoUri, headline, messageText, dateLine }: PostcardSlotProps) {
  return (
    <View style={{ flex: 1, backgroundColor: postcardPalette.cream, alignItems: "center", padding: "9%", gap: 14 }}>
      <Text style={[sans, { textAlign: "center", color: theme.colors.blueDeep, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }]} numberOfLines={1}>
        {headline}
      </Text>
      <PhotoOrPlaceholder
        uri={photoUri}
        style={{ width: "78%", aspectRatio: 0.72, borderTopLeftRadius: 999, borderTopRightRadius: 999, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}
      />
      <Text style={[serifFont, { textAlign: "center", color: postcardPalette.ink, fontSize: 14, lineHeight: 21, paddingHorizontal: 8 }]} numberOfLines={4}>
        {messageText}
      </Text>
      <Text style={{ marginTop: "auto", color: theme.colors.muted, fontSize: 10, letterSpacing: 0.5 }}>{dateLine}</Text>
    </View>
  );
}

// --- Full-Bleed Banner: photo edge-to-edge, dark scrim, bold headline
// overlaid on the bottom third. Photo-forward, high-impact moments.
export function FullBleedBannerTemplate({ photoUri, headline, messageText, dateLine }: PostcardSlotProps) {
  return (
    <View style={{ flex: 1, backgroundColor: postcardPalette.filmDark }}>
      <PhotoOrPlaceholder uri={photoUri} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "42%", backgroundColor: "rgba(15,20,20,0.62)" }} />
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "8%", gap: 6 }}>
        <Text style={[sans, { color: "white", fontSize: 21, fontWeight: "900", lineHeight: 26 }]} numberOfLines={2}>
          {headline}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 13, lineHeight: 19 }} numberOfLines={3}>
          {messageText}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 4, letterSpacing: 0.5 }}>{dateLine}</Text>
      </View>
    </View>
  );
}

// --- The Notecard: circular photo inset like a wax seal on cream letter
// stationery. "The most grandmother template" -- reads as an actual letter.
export function NotecardTemplate({ photoUri, childName, messageText, dateLine }: PostcardSlotProps) {
  return (
    <View style={{ flex: 1, backgroundColor: postcardPalette.cream, padding: "9%" }}>
      {Array.from({ length: 7 }).map((_, index) => (
        <View key={index} style={{ position: "absolute", left: "9%", right: "9%", top: `${28 + index * 8}%`, height: 1, backgroundColor: "rgba(42,42,40,0.08)" }} />
      ))}
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <View style={{ width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: theme.colors.terracotta, padding: 4, backgroundColor: "white" }}>
          <PhotoOrPlaceholder uri={photoUri} style={{ width: "100%", height: "100%", borderRadius: 42 }} />
        </View>
      </View>
      <Text style={[serifFont, { color: postcardPalette.ink, fontSize: 14, lineHeight: 22 }]} numberOfLines={6}>
        {messageText}
      </Text>
      <View style={{ marginTop: "auto", alignItems: "flex-end", gap: 2 }}>
        <Text style={[serifFont, { color: theme.colors.terracotta, fontSize: 15, fontStyle: "italic" }]}>{childName}</Text>
        <Text style={{ color: theme.colors.muted, fontSize: 10, letterSpacing: 0.5 }}>{dateLine}</Text>
      </View>
    </View>
  );
}

// --- The Filmstrip: a strip of small sequential photos along one edge, one
// larger hero photo. Updates with more than one photo. Degrades gracefully
// to a single repeated thumbnail when only one photo was picked -- the
// compose flow doesn't offer multi-photo selection yet.
export function FilmstripTemplate({ photoUri, photoUris, headline, messageText, dateLine }: PostcardSlotProps) {
  const strip = (photoUris.length ? photoUris : photoUri ? [photoUri] : []).slice(0, 4);
  const filled = strip.length ? [strip[0], strip[Math.min(1, strip.length - 1)], strip[Math.min(2, strip.length - 1)]] : [null, null, null];

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: postcardPalette.filmDark }}>
      <View style={{ width: "24%", paddingVertical: "6%", justifyContent: "space-between", alignItems: "center" }}>
        {filled.map((uri, index) => (
          <View key={index} style={{ width: "100%", gap: 4, alignItems: "center" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", width: "70%" }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)" }} />
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)" }} />
            </View>
            <PhotoOrPlaceholder uri={uri} style={{ width: "82%", aspectRatio: 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }} />
          </View>
        ))}
      </View>
      <View style={{ flex: 1, padding: "6%", justifyContent: "flex-end", gap: 6 }}>
        <PhotoOrPlaceholder uri={photoUri} style={{ position: "absolute", left: "6%", right: "6%", top: "6%", bottom: "6%", borderRadius: 4 }} />
        <View style={{ backgroundColor: "rgba(15,20,20,0.6)", borderRadius: 10, padding: 12, gap: 4 }}>
          <Text style={[sans, { color: "white", fontSize: 14, fontWeight: "800" }]} numberOfLines={1}>{headline}</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, lineHeight: 16 }} numberOfLines={2}>{messageText}</Text>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 9 }}>{dateLine}</Text>
        </View>
      </View>
    </View>
  );
}

// --- The Growth Line: a thin dotted developmental path with milestone
// markers under the photo. Milestone-specific postcards.
export function GrowthLineTemplate({ photoUri, headline, messageText, dateLine }: PostcardSlotProps) {
  return (
    <View style={{ flex: 1, backgroundColor: postcardPalette.cream, padding: "8%", gap: 14 }}>
      <PhotoOrPlaceholder uri={photoUri} style={{ width: "100%", aspectRatio: 1.05, borderRadius: 14 }} />
      <View style={{ height: 34, alignItems: "center", justifyContent: "center" }}>
        <Svg width="100%" height="34" viewBox="0 0 300 34">
          <Line x1="6" y1="17" x2="294" y2="17" stroke={theme.colors.bluePrimary} strokeWidth={2} strokeDasharray="1 10" strokeLinecap="round" />
          <Circle cx="30" cy="17" r="5" fill={theme.colors.blueDeep} />
          <Circle cx="110" cy="17" r="5" fill={theme.colors.bluePrimary} />
          <Circle cx="190" cy="17" r="7" fill={theme.colors.terracotta} />
          <Circle cx="270" cy="17" r="5" fill={theme.colors.bluePrimary} opacity={0.4} />
        </Svg>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={[sans, { color: theme.colors.blueDeep, fontSize: 15, fontWeight: "800" }]} numberOfLines={2}>{headline}</Text>
        <Text style={[serifFont, { color: postcardPalette.ink, fontSize: 13, lineHeight: 19 }]} numberOfLines={3}>{messageText}</Text>
      </View>
      <Text style={{ marginTop: "auto", color: theme.colors.muted, fontSize: 10, letterSpacing: 0.5 }}>{dateLine}</Text>
    </View>
  );
}
