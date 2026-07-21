import { Image } from "expo-image";
import { View } from "react-native";

const lockup = require("../../assets/brand/lockup-with-tagline.png");
const leafMark = require("../../assets/brand/leaf-mark.png");

export function BrandLogo({ variant = "lockup", width = 210, height = 76 }: { variant?: "lockup" | "mark"; width?: number; height?: number }) {
  const source = variant === "mark" ? leafMark : lockup;
  return (
    <View style={{ width, height, overflow: "hidden", alignItems: "flex-start", justifyContent: "center" }}>
      <Image source={source} contentFit="contain" style={{ width, height }} />
    </View>
  );
}
