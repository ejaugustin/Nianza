import { Text, View } from "react-native";

// BISECTION TEST, ROUND 3: dependency versions have changed completely
// since the last time we ran this test (expo install --fix rewrote nearly
// a dozen packages from wildly wrong "latest" versions to SDK-54-correct
// ones, and that fixed a real native-module crash). The old bisection
// result is no longer valid. This re-checks the same thing: bare view, no
// providers, no splash-screen calls at all -- just to see whether the
// splash-stuck symptom is coming from something in our app code/splash
// handling, or from app.json/config-plugin level, independent of anything
// in this file.
export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#2244AA", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: "#FFFFFF", textAlign: "center" }}>
        BISECTION ROUND 3{"\n"}If you see this, JS mounted fine.
      </Text>
    </View>
  );
}
