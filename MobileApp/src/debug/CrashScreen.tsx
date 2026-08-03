import { Component, ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

/**
 * Temporary diagnostic aid (July 2026): TestFlight builds were showing a
 * blank white screen with no way to see what actually failed, since release
 * builds don't show RN's dev red-box and there's no crash-reporting service
 * wired up yet. This renders the failure on-device instead of a blank
 * screen, and also catches JS errors that happen outside React's render
 * cycle (event handlers, unhandled promise rejections) via ErrorUtils,
 * which a React error boundary alone cannot catch.
 *
 * Remove once a real crash reporter (e.g. Sentry) is wired up and this
 * class of bug is no longer a live risk.
 */

type State = { error: Error | null; source: "render" | "global" | null };

let reportGlobalError: ((error: Error) => void) | null = null;

// @ts-expect-error - ErrorUtils is a React Native global, not in the DOM lib types
const originalHandler = global.ErrorUtils?.getGlobalHandler?.();
// @ts-expect-error - see above
global.ErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
  if (reportGlobalError) reportGlobalError(error);
  originalHandler?.(error, isFatal);
});

export class CrashScreen extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, source: null };

  static getDerivedStateFromError(error: Error) {
    return { error, source: "render" as const };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("Render error caught by CrashScreen:", error);
  }

  componentDidMount() {
    reportGlobalError = (error: Error) => {
      this.setState({ error, source: "global" });
    };
  }

  componentWillUnmount() {
    reportGlobalError = null;
  }

  render() {
    const { error, source } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Nianza hit an error ({source})</Text>
          <Text style={styles.message}>{error.message}</Text>
          <Text style={styles.stack}>{error.stack}</Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", paddingTop: 60, paddingHorizontal: 16 },
  scroll: { paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 12, color: "#B00020" },
  message: { fontSize: 14, marginBottom: 12, color: "#111111" },
  stack: { fontSize: 11, color: "#555555" }
});
