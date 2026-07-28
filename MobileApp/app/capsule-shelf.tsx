import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { deleteVoiceMemory, listVoiceMemories } from "@/api/voice-memories";
import { RequireAuth, useAuth } from "@/auth/auth-context";
import { SfIcon } from "@/components/screen-spec";
import { VoiceChip } from "@/components/voice-chip";
import { theme } from "@/theme/theme";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// N2 (Parent voice capsules): the "shelf" is the dedicated moment for when
// these actually unlock -- separate from the parent-facing memory book
// because by the time this screen matters, it's the grown child (or the
// parent showing them) doing the opening, not day-to-day parenting. Server
// still enforces the lock (GET /voice never returns a playbackUrl pre-
// graduation) so this screen shows exactly what the API allows, nothing
// simulated client-side.
export default function CapsuleShelfScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { activeChildId, profile } = useAuth();
  const childId = firstParam(params.childId) || activeChildId || "primary-child";
  const childName = profile?.childName || "your child";

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }

  const capsulesQuery = useQuery({
    queryKey: ["voice-memories", childId, "parent-capsule", "shelf"],
    queryFn: () => listVoiceMemories(childId, "parent-capsule"),
    staleTime: 1000 * 30,
    retry: 1
  });

  const capsules = capsulesQuery.data?.memories || [];
  const graduated = (capsulesQuery.data?.childAgeMonths ?? 0) >= (capsulesQuery.data?.graduationAgeMonths ?? Infinity);
  const unlockedCount = useMemo(() => capsules.filter((c) => !c.locked).length, [capsules]);
  const lockedCount = capsules.length - unlockedCount;

  async function removeCapsule(memoryId: string) {
    try {
      await deleteVoiceMemory(childId, memoryId);
      capsulesQuery.refetch();
    } catch {
      // Silent -- this is a low-stakes list action, no need for a banner here.
    }
  }

  return (
    <RequireAuth>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View
          style={{
            height: insets.top + 62,
            paddingTop: insets.top,
            backgroundColor: "white",
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20
          }}
        >
          <Pressable onPress={goBack} style={{ minWidth: 44, minHeight: 44, alignItems: "flex-start", justifyContent: "center" }}>
            <SfIcon name="chevron.left" color={theme.colors.text} size={22} />
          </Pressable>
          <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>Capsule shelf</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, gap: 20, paddingBottom: 40 }}>
          <View style={{ gap: 8 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 20, fontWeight: "700", lineHeight: 27 }}>
              {graduated ? `Messages for ${childName}` : `${childName}'s capsule shelf`}
            </Text>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 19 }}>
              {graduated
                ? unlockedCount
                  ? "I kept these safe for exactly this moment. Take your time."
                  : "Nothing's here yet."
                : lockedCount
                  ? `I'm holding onto ${lockedCount} message${lockedCount === 1 ? "" : "s"} for ${childName} until they're grown.`
                  : `Nothing recorded yet. You can leave ${childName} a message anytime from the memory book -- I'll keep it safe.`}
            </Text>
          </View>

          {capsules.length ? (
            <View style={{ gap: 10 }}>
              {capsules.map((memory) => (
                <View
                  key={memory.memoryId}
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    backgroundColor: "white",
                    padding: 14
                  }}
                >
                  <VoiceChip memory={memory} onDelete={(m) => removeCapsule(m.memoryId)} />
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </RequireAuth>
  );
}
