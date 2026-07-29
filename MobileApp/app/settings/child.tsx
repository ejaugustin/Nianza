import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "@/auth/auth-context";
import { SettingsField, SettingsHeader } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

function ChoicePill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 50,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? theme.colors.blueLight : "white",
        borderWidth: 1.5,
        borderColor: active ? theme.colors.bluePrimary : theme.colors.border
      }}
    >
      <Text selectable style={{ color: active ? theme.colors.blueDeep : theme.colors.text, fontSize: 15, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ChildProfileEditScreen() {
  const { profile, updateProfile, addChild, removeChild } = useAuth();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isCreateMode = mode === "create";
  const seed = isCreateMode ? null : profile;
  const [childName, setChildName] = useState(seed?.childName || "");
  const [childBirthDate, setChildBirthDate] = useState(seed?.childBirthDate || "");
  const [sexAtBirth, setSexAtBirth] = useState<"girl" | "boy" | null>(seed?.sexAtBirth || null);
  const [bornEarly, setBornEarly] = useState(seed?.bornEarly || false);
  const [weeksEarly, setWeeksEarly] = useState(seed?.weeksEarly ? String(seed.weeksEarly) : "");
  const [allergies, setAllergies] = useState(seed?.allergies || "");
  const [childPhotoUri, setChildPhotoUri] = useState(seed?.childPhotoUri || "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(tabs)/settings");
  }

  async function choosePhoto() {
    setNotice(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice("Photo access is needed to add a picture.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setChildPhotoUri(result.assets[0].uri);
      }
    } catch {
      setNotice("I could not open photos just now. Please try again.");
    }
  }

  async function save() {
    if (!childName.trim() || !childBirthDate.trim() || !sexAtBirth) {
      setNotice("Name, date of birth, and sex are needed before saving.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const patch = {
        childName: childName.trim(),
        childBirthDate: childBirthDate.trim(),
        sexAtBirth,
        bornEarly,
        weeksEarly: bornEarly && weeksEarly ? Number(weeksEarly) : null,
        allergies: allergies.trim(),
        childPhotoUri: childPhotoUri || null
      };
      if (isCreateMode) {
        await addChild(patch);
        router.replace("/(tabs)/settings");
      } else {
        await updateProfile(patch);
        goBack();
      }
    } catch {
      setNotice("Could not save right now. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!profile?.childId) return;
    setRemoving(true);
    setNotice(null);
    try {
      await removeChild(profile.childId);
      router.replace("/(tabs)/settings");
    } catch (err) {
      setConfirmingRemove(false);
      if (err instanceof Error && err.message === "LAST_CHILD") {
        setNotice("Nianza needs at least one child on your account. Add another child before removing this one.");
      } else {
        setNotice("Could not remove right now. Please try again.");
      }
    } finally {
      setRemoving(false);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingTop: 52, paddingBottom: 40, gap: 20 }}
      style={{ backgroundColor: theme.colors.background }}
    >
      <SettingsHeader title={isCreateMode ? "Add a child" : `${childName || "Your child"}'s profile`} onBack={goBack} />

      <View style={{ alignItems: "center", gap: 10 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {childPhotoUri ? (
            <Image source={{ uri: childPhotoUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <Text selectable={false} style={{ color: "white", fontSize: 30, fontWeight: "700" }}>
              {(childName || "?").slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
        <Pressable onPress={choosePhoto}>
          <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "600" }}>
            Change
          </Text>
        </Pressable>
        {childPhotoUri ? (
          <Pressable onPress={() => setChildPhotoUri("")}>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 12 }}>
              Remove photo
            </Text>
          </Pressable>
        ) : null}
      </View>

      <SettingsField label="Name or nickname" value={childName} onChangeText={setChildName} placeholder="Sofia" autoCapitalize="words" />
      <SettingsField label="Date of birth" value={childBirthDate} onChangeText={setChildBirthDate} placeholder="YYYY-MM-DD" />

      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>
          Sex at birth
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <ChoicePill label="Girl" active={sexAtBirth === "girl"} onPress={() => setSexAtBirth("girl")} />
          <ChoicePill label="Boy" active={sexAtBirth === "boy"} onPress={() => setSexAtBirth("boy")} />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>
          Born early?
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <ChoicePill label="No" active={!bornEarly} onPress={() => setBornEarly(false)} />
          <ChoicePill label="Yes" active={bornEarly} onPress={() => setBornEarly(true)} />
        </View>
      </View>
      {bornEarly ? <SettingsField label="How many weeks early?" value={weeksEarly} onChangeText={setWeeksEarly} keyboardType="number-pad" placeholder="4" /> : null}

      <SettingsField
        label="Known allergies — as you'd tell a nurse"
        value={allergies}
        onChangeText={setAllergies}
        placeholder="e.g. penicillin"
        multiline
      />

      {notice ? (
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12, textAlign: "center" }}>
          {notice}
        </Text>
      ) : null}

      <Pressable
        disabled={saving}
        onPress={save}
        style={{ minHeight: 52, borderRadius: 12, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", opacity: saving ? 0.6 : 1 }}
      >
        <Text selectable={false} style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
          {saving ? "Saving..." : isCreateMode ? "Add child" : "Save changes"}
        </Text>
      </Pressable>

      {isCreateMode ? null : confirmingRemove ? (
        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: theme.colors.error, backgroundColor: "white", padding: 16, gap: 12 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>
            This removes {childName || "this child"} and hides their vitals, milestones, and vaccine history from the
            app. It can't be undone from here.
          </Text>
          <Pressable
            disabled={removing}
            onPress={confirmRemove}
            style={{ minHeight: 48, borderRadius: 12, backgroundColor: theme.colors.error, alignItems: "center", justifyContent: "center", opacity: removing ? 0.6 : 1 }}
          >
            <Text selectable={false} style={{ color: "white", fontSize: 15, fontWeight: "600" }}>
              {removing ? "Removing..." : `Yes, remove ${childName || "this child"}`}
            </Text>
          </Pressable>
          <Pressable disabled={removing} onPress={() => setConfirmingRemove(false)} style={{ alignSelf: "center", paddingVertical: 4 }}>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>
              Cancel
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setConfirmingRemove(true)} style={{ alignSelf: "center", paddingVertical: 8 }}>
          <Text selectable style={{ color: theme.colors.error, fontSize: 13 }}>
            Remove {childName || "this child"} from my account
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
