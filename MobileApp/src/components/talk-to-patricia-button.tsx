import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/auth/auth-context";
import { seedToParams, type ChatContextSeed, type PatriciaContextEvent } from "@/chat/patricia-context";
import { getLastPatriciaMemory } from "@/chat/patricia-memory";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

export function openPatricia(seed: ChatContextSeed, sessionId?: string) {
  router.push({
    pathname: "/chat",
    params: {
      ...seedToParams(seed),
      ...(sessionId ? { sessionId } : {})
    }
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
  const insets = useSafeAreaInsets();
  const childName = profile?.childName || "your child";
  const parentFirstName = profile?.parentFirstName || profile?.parentName?.split(" ")[0];

  async function handleOpenPatricia() {
    const baseSeed: ChatContextSeed = {
      source,
      eventType,
      childName,
      childId: "primary-child",
      parentFirstName,
      entityId,
      detail,
      occurredAt: new Date().toISOString()
    };

    const shouldResume = eventType === "general" && !detail && !entityId;
    if (shouldResume) {
      const memory = await getLastPatriciaMemory();
      if (memory) {
        openPatricia(
          {
            ...memory.seed,
            childName: memory.seed.childName || childName,
            childId: memory.seed.childId || "primary-child",
            parentFirstName: memory.seed.parentFirstName || parentFirstName,
            resumeConversation: "true",
            occurredAt: new Date().toISOString()
          },
          memory.sessionId
        );
        return;
      }
    }

    openPatricia(baseSeed);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Talk to Patricia"
      onPress={handleOpenPatricia}
      style={{
        position: "absolute",
        top: Math.max(insets.top + 8, 18),
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
