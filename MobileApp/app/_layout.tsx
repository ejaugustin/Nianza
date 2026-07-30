import { Text, View } from "react-native";

// BISECTION TEST BUILD -- do not skip testing this one before moving on.
// Every fix so far (API URL, Cognito env vars, error boundary, loading
// spinner, hard timeout, explicit splash-screen hide) has made zero visible
// difference across three separate TestFlight builds, which is the real
// signal here: none of those layers are even being reached. This build
// strips the root layout to nothing but a plain, hardcoded View/Text -- no
// providers, no navigation, no splash-screen calls, no auth, no network.
//
// If THIS build still shows white/blank: the bug is not in app code at
// all. It's something lower -- native bundle failing to load, a linked
// native module crashing on init before any JS runs, or a provisioning/
// entitlement issue with this exact TestFlight build. That changes the
// whole investigation (means: pull the crash log from App Store Connect ->
// TestFlight -> Crashes, since native-level failures show up there even
// without a Mac).
//
// If THIS build shows the text below: the bundle and Hermes runtime are
// fine, and the bug is somewhere in the providers/routing we stripped out
// -- add them back one at a time from here.
export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#2244AA", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: "#FFFFFF", textAlign: "center" }}>
        BISECTION TEST{"\n"}If you see this blue screen, JS is running fine.
      </Text>
    </View>
  );
}
