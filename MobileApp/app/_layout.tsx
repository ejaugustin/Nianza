import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";

// BISECTION TEST BUILD, ROUND 2: the previous bare-screen build (no
// providers, no routing logic) still showed white with New Arch on, and
// crashed with New Arch off. The crash log's faulting thread is
// "com.facebook.react.ExceptionsManagerQueue" -- React Native's own path
// for escalating an uncaught JS exception to a native abort -- meaning JS
// starts fine and something throws early, before this file's own code runs
// any logic. Root cause: expo-router eagerly evaluates every file under
// app/ (including (auth)/_layout.tsx and (tabs)/_layout.tsx and everything
// they import) to build its route table, regardless of what THIS file
// renders. This build installs a global JS error handler that captures and
// displays the real error message via Alert instead of letting it abort
// silently, so we can finally read what's actually throwing.
export default function RootLayout() {
  const [caught, setCaught] = useState<string | null>(null);

  useEffect(() => {
    // @ts-expect-error - ErrorUtils is a React Native global
    const original = global.ErrorUtils?.getGlobalHandler?.();
    // @ts-expect-error - see above
    global.ErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
      const message = `${error.name}: ${error.message}\n\n${error.stack}`;
      setCaught(message);
      Alert.alert("Caught JS error", message.slice(0, 500));
      // Deliberately NOT calling original(error, isFatal) -- that's what
      // triggers the native abort. Swallowing it here keeps the app alive
      // long enough to read the message.
    });
    return () => {
      // @ts-expect-error - see above
      if (original) global.ErrorUtils?.setGlobalHandler?.(original);
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#2244AA", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF", textAlign: "center" }}>
        {caught ? caught : "BISECTION TEST ROUND 2\nWaiting for error (or none)..."}
      </Text>
    </View>
  );
}
