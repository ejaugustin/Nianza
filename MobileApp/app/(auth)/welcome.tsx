import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { AuthButton } from "@/components/auth-ui";
import { BrandLogo } from "@/components/brand-logo";
import { theme } from "@/theme/theme";

export default function WelcomeScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 56, paddingBottom: 34, justifyContent: "space-between", gap: 34 }} style={{ backgroundColor: theme.colors.background }}>
      <View style={{ alignItems: "center", gap: 56 }}>
        <BrandLogo width={250} height={92} />
        <View style={{ gap: 14, alignItems: "center" }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 28, fontWeight: "700", textAlign: "center", lineHeight: 34 }}>
            A companion for the whole journey.
          </Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 17, fontStyle: "italic", textAlign: "center", lineHeight: 25 }}>
            From the first nights home to the first day of school. Patricia is with you.
          </Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Link href="/(auth)/register" asChild>
          <AuthButton>Create your account</AuthButton>
        </Link>
        <Link href="/(auth)/login" asChild>
          <AuthButton variant="secondary">Sign in</AuthButton>
        </Link>
        <AuthButton variant="text">Learn more about Nianza</AuthButton>
      </View>
    </ScrollView>
  );
}
