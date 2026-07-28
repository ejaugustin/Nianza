import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { ScreenTitle, SectionLabel, SfIcon, SpecCard } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

function monthsSince(dateValue?: string) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth());
}

function childAgeLabel(dateValue?: string) {
  const months = monthsSince(dateValue);
  if (months === null) return "";
  if (months < 1) return "Newborn";
  if (months === 1) return "1 month";
  return `${months} months`;
}

function cadenceLabel(cadence?: string) {
  if (cadence === "daily") return "Daily";
  if (cadence === "few-times-week") return "A few times a week";
  if (cadence === "weekly") return "Once a week";
  return "Daily";
}

function languageLabel(language?: string) {
  if (language === "es") return "Español";
  if (language === "fr") return "Français";
  if (language === "ar") return "العربية";
  return "English";
}

function SettingsRow({
  title,
  value,
  onPress,
  tinted,
  isLast
}: {
  title: string;
  value?: string;
  onPress: () => void;
  tinted?: boolean;
  isLast?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: 54,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: tinted ? 12 : 0,
        marginHorizontal: tinted ? -12 : 0,
        borderRadius: tinted ? 12 : 0,
        backgroundColor: tinted ? theme.colors.blueLight : "transparent"
      }}
    >
      <Text selectable style={{ flex: 1, color: theme.colors.text, fontSize: 14, fontWeight: "400" }}>
        {title}
      </Text>
      {value ? (
        <Text selectable numberOfLines={1} style={{ color: theme.colors.muted, fontSize: 13, maxWidth: 150, textAlign: "right" }}>
          {value}
        </Text>
      ) : null}
      <SfIcon name="chevron.right" color={theme.colors.greyIcon} size={14} />
      {!isLast ? <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, backgroundColor: theme.colors.border }} /> : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { profile, session, signOut, updateProfile, children, activeChildId, switchActiveChild } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const childName = profile?.childName || "your child";
  const parentInitial = (profile?.parentFirstName || profile?.parentName || "M").slice(0, 1).toUpperCase();

  async function togglePushNotifications(next: boolean) {
    setNotice(null);
    try {
      await updateProfile({ notificationsEnabled: next });
    } catch {
      setNotice("Could not save that just now. Please try again.");
    }
  }

  async function onChildRowPress(childId: string) {
    if (childId === activeChildId) {
      router.push("/settings/child");
      return;
    }
    setNotice(null);
    setSwitching(childId);
    try {
      await switchActiveChild(childId);
    } catch {
      setNotice("Could not switch children just now. Please try again.");
    } finally {
      setSwitching(null);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 40, gap: 18 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <ScreenTitle title="Settings" />

      <Pressable onPress={() => router.push("/settings/profile")}>
        <SpecCard style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
              <Text selectable={false} style={{ color: "white", fontSize: 15, fontWeight: "800" }}>
                {parentInitial}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "600" }}>
                {profile?.parentName || "Your name"}
              </Text>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 12 }}>
                {session?.email || ""}
              </Text>
            </View>
            <SfIcon name="chevron.right" color={theme.colors.greyIcon} size={16} />
          </View>
        </SpecCard>
      </Pressable>

      <View style={{ gap: 10 }}>
        <SectionLabel>YOUR CHILDREN</SectionLabel>
        <SpecCard style={{ gap: 0, paddingVertical: 4 }}>
          {children.map((child) => {
            const isActive = child.childId === activeChildId;
            return (
              <Pressable
                key={child.childId}
                accessibilityRole="button"
                onPress={() => onChildRowPress(child.childId)}
                disabled={switching === child.childId}
                style={{
                  minHeight: 62,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                  paddingHorizontal: isActive ? 12 : 0,
                  marginHorizontal: isActive ? -12 : 0,
                  borderRadius: isActive ? 12 : 0,
                  backgroundColor: isActive ? theme.colors.blueLight : "transparent",
                  opacity: switching === child.childId ? 0.6 : 1
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {child.childPhotoUri ? (
                    <Image source={{ uri: child.childPhotoUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <Text selectable={false} style={{ color: "white", fontSize: 15, fontWeight: "800" }}>
                      {(child.childName || "?").slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text selectable style={{ flex: 1, color: theme.colors.text, fontSize: 14 }}>
                  {child.childName} · {childAgeLabel(child.childBirthDate)}
                </Text>
                {isActive ? (
                  <SfIcon name="checkmark" color={theme.colors.bluePrimary} size={16} />
                ) : (
                  <Text selectable={false} style={{ color: theme.colors.muted, fontSize: 12 }}>
                    Switch
                  </Text>
                )}
                <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, backgroundColor: theme.colors.border }} />
              </Pressable>
            );
          })}

          <SettingsRow
            title={`${childName}'s pediatrician`}
            value={profile?.pediatricianName || "Add doctor info"}
            onPress={() => router.push("/settings/pediatrician")}
            tinted
          />

          <SettingsRow title="Add another child" onPress={() => router.push({ pathname: "/settings/child", params: { mode: "create" } })} isLast />
        </SpecCard>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 15 }}>
          Tap a child to switch — the rest of the app follows whichever child is checked. Patricia remembers your
          conversations across all of them.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel>NOTIFICATIONS</SectionLabel>
        <SpecCard style={{ gap: 0, paddingVertical: 4 }}>
          <SettingsRow title="Hear from Patricia" value={cadenceLabel(profile?.notificationCadence)} onPress={() => router.push("/settings/notifications")} />
          <View style={{ minHeight: 54, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
            <Text selectable style={{ flex: 1, color: theme.colors.text, fontSize: 14 }}>
              Push notifications
            </Text>
            <Switch
              value={profile?.notificationsEnabled ?? true}
              onValueChange={togglePushNotifications}
              trackColor={{ true: theme.colors.bluePrimary, false: theme.colors.border }}
              thumbColor="white"
            />
          </View>
        </SpecCard>
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel>APP</SectionLabel>
        <SpecCard style={{ gap: 0, paddingVertical: 4 }}>
          <SettingsRow title="Language" value={languageLabel(profile?.language)} onPress={() => router.push("/settings/language")} />
          <SettingsRow title="Privacy & data" onPress={() => router.push("/settings/privacy")} />
          <SettingsRow title="Subscription" onPress={() => router.push("/settings/subscription")} isLast />
        </SpecCard>
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel>SUPPORT</SectionLabel>
        <SpecCard style={{ gap: 0, paddingVertical: 4 }}>
          <SettingsRow
            title="Memory book"
            value="View"
            onPress={() => router.push({ pathname: "/(tabs)/milestones", params: { openMemoryBook: "1" } })}
            isLast
          />
        </SpecCard>
      </View>

      {notice ? (
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17, textAlign: "center" }}>
          {notice}
        </Text>
      ) : null}

      <SectionLabel>ACCOUNT</SectionLabel>
      <Pressable onPress={signOut} style={{ minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
        <Text selectable={false} style={{ color: theme.colors.bluePrimary, fontSize: 15, fontWeight: "800" }}>
          Sign out
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: "/settings/delete-account/offer", params: { scope: "account" } })}
        style={{ alignSelf: "center", paddingVertical: 8 }}
      >
        <Text selectable style={{ color: theme.colors.error, fontSize: 13 }}>
          Delete my account and all data
        </Text>
      </Pressable>
    </ScrollView>
  );
}
