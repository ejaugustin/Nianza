import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { seedToParams, type ChatContextSeed, type PatriciaContextEvent } from "@/chat/patricia-context";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

export function openPatricia(seed: ChatContextSeed) {
  router.push({
    pathname: "/chat",
    params: seedToParams(seed)
  });
}

export function TalkToPatriciaButton({
  source,
  eventType = "general",
  detail,
  entityId
}: {
  source: string;
  eventType?: PatriciaContextEvent;
  detail?: string;
  entityId?: string;
}) {
  const { profile } = useAuth();
  const childName = profile?.childName || "Sofia";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Talk to Patricia"
      onPress={() =>
        openPatricia({
          source,
          eventType,
          childName,
          childId: "primary-child",
          entityId,
          detail,
          occurredAt: new Date().toISOString()
        })
      }
      style={{
        position: "absolute",
        top: 18,
        right: 18,
        zIndex: 20,
        borderRadius: 24,
        backgroundColor: theme.colors.bluePrimary,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingHorizontal: 13,
        paddingVertical: 10,
        boxShadow: "0 8px 22px rgba(29, 122, 145, 0.28)"
      }}
    >
      <SfIcon name="mic.fill" color="white" size={18} />
      <View>
        <Text selectable={false} style={{ color: "white", fontSize: 11, fontWeight: "800" }}>Talk to</Text>
        <Text selectable={false} style={{ color: "white", fontSize: 11, fontWeight: "800" }}>Patricia</Text>
      </View>
    </Pressable>
  );
}
