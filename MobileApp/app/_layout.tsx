import { Text, View } from "react-native";

// TEMPORARY DIAGNOSTIC BUILD (July 2026): TestFlight has been showing a
// blank white screen with no visible error, even with an on-screen crash
// boundary wired up (src/debug/CrashScreen.tsx) and every known env var
// fixed. This strips the root layout down to the bare minimum -- no
// providers, no navigation, no expo-router Stack, just a static View/Text --
// to determine whether the failure is inside app logic (providers, auth,
// routing) or at a level below that (native bundle, Hermes, expo-router
// itself). If THIS still shows white, the bug isn't in our code at all.
//
// Revert this file to the real RootLayout (git: `git checkout HEAD~1 --
// app/_layout.tsx` before this commit, or ask Claude) once the bisection
// build has been tested.
export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: "700", color: "#111111", textAlign: "center" }}>
        Nianza diagnostic build{"\n"}If you can read this, the bundle loaded fine.
      </Text>
    </View>
  );
}
