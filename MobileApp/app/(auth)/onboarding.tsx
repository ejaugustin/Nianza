import * as Notifications from "expo-notifications";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { configurePatriciaPlayback, fetchPatriciaSpeechAudio, pausePatriciaPlayer } from "@/audio/patricia-voice";
import { ChildProfile, useAuth } from "@/auth/auth-context";
import { AuthButton, AuthField } from "@/components/auth-ui";
import { BrandLogo } from "@/components/brand-logo";
import { CategoryChip, SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type NotificationCadence = NonNullable<ChildProfile["notificationCadence"]>;

const languageOptions = [
  { value: "en", title: "English", subtitle: "United States" },
  { value: "es", title: "Espanol", subtitle: "Spanish support next" },
  { value: "fr", title: "Francais", subtitle: "French support next" },
  { value: "ar", title: "Arabic", subtitle: "Coming soon", disabled: true }
] as const;

const notificationOptions: Array<{ value: NotificationCadence; title: string; subtitle: string }> = [
  { value: "daily", title: "Every day", subtitle: "A short note about what your child is up to this week" },
  { value: "few-times-week", title: "A few times a week", subtitle: "Regular check-ins without the daily commitment" },
  { value: "weekly", title: "Once a week", subtitle: "A weekly letter to read when you have a quiet moment" }
];

function monthsSince(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 0;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth());
}

function splitName(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ")
  };
}

function StepDots({ active }: { active: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 7, justifyContent: "center", paddingVertical: 4 }}>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <View
          key={index}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: index === active ? theme.colors.bluePrimary : theme.colors.border
          }}
        />
      ))}
    </View>
  );
}

function PatriciaCard({ children, spokenText, cacheKey }: { children: string; spokenText?: string; cacheKey: string }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const isPlaying = status.playing;
  const voiceText = spokenText || children;

  useEffect(() => {
    const timer = setTimeout(() => {
      playPatricia(true).catch(() => undefined);
    }, 350);

    return () => {
      clearTimeout(timer);
      pausePatriciaPlayer(player);
    };
  }, [cacheKey]);

  async function playPatricia(forceRestart = false) {
    if (isPlaying && !forceRestart) {
      pausePatriciaPlayer(player);
      return;
    }

    setNotice(null);
    setIsLoading(true);
    try {
      await configurePatriciaPlayback();
      let uri = audioUri;
      if (!uri) {
        uri = await fetchPatriciaSpeechAudio(voiceText, cacheKey);
        setAudioUri(uri);
      }
      player.replace({ uri });
      player.seekTo(0);
      player.play();
    } catch {
      setNotice("I could not play my voice just now. You can continue.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={{ backgroundColor: theme.colors.card, borderRadius: theme.radii.card, borderLeftWidth: 3, borderLeftColor: theme.colors.bluePrimary, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => playPatricia()} disabled={isLoading} accessibilityRole="button" accessibilityLabel={isPlaying ? "Pause Patricia" : "Replay Patricia"} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", opacity: isLoading ? 0.65 : 1 }}>
          {isPlaying ? (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: "white" }} />
              <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: "white" }} />
            </View>
          ) : (
            <SfIcon name="speaker.wave.2.fill" color="white" size={19} />
          )}
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "800" }}>Patricia</Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 16 }}>
            {isLoading ? "Getting my voice ready..." : isPlaying ? "I'm talking you through this." : "Tap to hear me again."}
          </Text>
        </View>
      </View>
      <Text selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 22, fontStyle: "italic" }}>
        {children}
      </Text>
      {isPlaying ? <View style={{ height: 2, borderRadius: 1, backgroundColor: theme.colors.bluePrimary }} /> : null}
      {notice ? <Text selectable style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 15 }}>{notice}</Text> : null}
    </View>
  );
}

function SelectCard({
  title,
  subtitle,
  active,
  disabled,
  onPress
}: {
  title: string;
  subtitle?: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 64,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: active ? theme.colors.bluePrimary : theme.colors.border,
        backgroundColor: disabled ? "#F3F4F4" : active ? theme.colors.blueLight : "white",
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: disabled ? 0.65 : 1
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>
          {title}
        </Text>
        {subtitle ? (
          <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {active ? <SfIcon name="checkmark" color={theme.colors.bluePrimary} size={20} /> : null}
    </Pressable>
  );
}

function ChoicePill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 54,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? theme.colors.blueLight : "white",
        borderWidth: 1.5,
        borderColor: active ? theme.colors.bluePrimary : theme.colors.border
      }}
    >
      <Text selectable style={{ color: active ? theme.colors.blueDeep : theme.colors.text, fontSize: 16, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Header({ title, subtitle, step }: { title: string; subtitle?: string; step?: number }) {
  return (
    <View style={{ gap: 14 }}>
      <BrandLogo width={150} height={42} />
      {typeof step === "number" ? <StepDots active={step} /> : null}
      <View style={{ gap: 7 }}>
        <Text selectable style={{ color: theme.colors.text, fontSize: 25, fontWeight: "800", lineHeight: 31 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text selectable style={{ color: theme.colors.muted, fontSize: 15, lineHeight: 22 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const savedName = splitName(auth.profile?.parentName);
  const [step, setStep] = useState<OnboardingStep>(0);
  const [language, setLanguage] = useState<ChildProfile["language"]>(auth.profile?.language || "en");
  const [parentFirstName, setParentFirstName] = useState(auth.profile?.parentFirstName || savedName.firstName);
  const [parentLastName, setParentLastName] = useState(auth.profile?.parentLastName || savedName.lastName);
  const [childName, setChildName] = useState(auth.profile?.childName || "");
  const [childBirthDate, setChildBirthDate] = useState(auth.profile?.childBirthDate || "");
  const [sexAtBirth, setSexAtBirth] = useState<ChildProfile["sexAtBirth"] | null>(auth.profile?.sexAtBirth || null);
  const [bornEarly, setBornEarly] = useState(auth.profile?.bornEarly || false);
  const [weeksEarly, setWeeksEarly] = useState(auth.profile?.weeksEarly ? String(auth.profile.weeksEarly) : "");
  const [photoSelected, setPhotoSelected] = useState(false);
  const [firstTimeParent, setFirstTimeParent] = useState<boolean | null>(auth.profile?.firstTimeParent ?? null);
  const [parentRole, setParentRole] = useState<ChildProfile["parentRole"]>(auth.profile?.parentRole ?? null);
  const [parentingSolo, setParentingSolo] = useState<boolean | null>(auth.profile?.parentingSolo ?? null);
  const [multilingualHome, setMultilingualHome] = useState<boolean | null>(auth.profile?.multilingualHome ?? null);
  const [notificationCadence, setNotificationCadence] = useState<NotificationCadence>(auth.profile?.notificationCadence || "daily");
  const [notificationsEnabled, setNotificationsEnabled] = useState(auth.profile?.notificationsEnabled ?? false);
  const [privacyAccepted, setPrivacyAccepted] = useState(Boolean(auth.profile?.privacyConsentAcceptedAt));

  useEffect(() => {
    if (step !== 7) return;
    const timer = setTimeout(() => router.replace("/(tabs)"), 2500);
    return () => clearTimeout(timer);
  }, [step]);

  if (auth.status === "loading") return null;
  if (!auth.session) return <Redirect href="/(auth)/login" />;

  function goBack() {
    if (step === 0) {
      auth.signOut();
      return;
    }
    setStep((current) => Math.max(0, current - 1) as OnboardingStep);
  }

  async function finish(allowNotifications: boolean) {
    let nextNotificationsEnabled = false;
    if (allowNotifications) {
      try {
        const result = await Notifications.requestPermissionsAsync();
        nextNotificationsEnabled = Boolean((result as { granted?: boolean }).granted);
      } catch {
        nextNotificationsEnabled = false;
      }
    }
    setNotificationsEnabled(nextNotificationsEnabled);

    const parentName = `${parentFirstName.trim()} ${parentLastName.trim()}`.trim();
    await auth.completeOnboarding({
      parentFirstName: parentFirstName.trim(),
      parentLastName: parentLastName.trim(),
      parentName,
      childName: childName.trim(),
      childBirthDate: childBirthDate.trim(),
      sexAtBirth: sexAtBirth || "girl",
      bornEarly,
      weeksEarly: bornEarly && weeksEarly ? Number(weeksEarly) : null,
      ageWindowMonths: monthsSince(childBirthDate),
      language,
      firstTimeParent,
      parentRole,
      parentingSolo,
      multilingualHome,
      notificationCadence,
      notificationsEnabled: nextNotificationsEnabled,
      privacyConsentAcceptedAt: new Date().toISOString(),
      onboardingCompletedAt: new Date().toISOString()
    });
    setStep(7);
  }

  const childProfileReady = Boolean(childName.trim() && childBirthDate.trim() && sexAtBirth);
  const parentReady = Boolean(parentFirstName.trim() && parentLastName.trim());

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        flexGrow: 1,
        padding: 24,
        paddingTop: step === 7 ? insets.top + 56 : insets.top + 24,
        paddingBottom: insets.bottom + 120,
        gap: 18,
        justifyContent: step === 7 ? "center" : "flex-start"
      }}
      style={{ backgroundColor: step === 7 ? theme.colors.bluePrimary : theme.colors.background }}
    >
      {step !== 7 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={{ width: 44, height: 36, justifyContent: "center" }}>
          <SfIcon name="chevron.left" color={theme.colors.muted} size={22} />
        </Pressable>
      ) : null}

      {step === 0 ? (
        <>
          <Header title="Before we begin" subtitle="Choose a language." step={0} />
          <PatriciaCard
            cacheKey="onboarding-language-intro"
            spokenText="Hello, I'm Patricia. I'm here to help you notice milestones, keep track of visits and vaccines, and talk through the moments that feel too big to hold alone. First, choose the language that feels easiest in your house. We can keep this simple."
          >
            Hello. I'm Patricia. I'll talk you through this.
          </PatriciaCard>
          <View style={{ gap: 10 }}>
            {languageOptions.map((option) => {
              const disabled = "disabled" in option && option.disabled;
              return (
              <SelectCard
                key={option.value}
                title={option.title}
                subtitle={option.subtitle}
                active={language === option.value}
                disabled={disabled}
                onPress={() => {
                  if (disabled) return;
                  setLanguage(option.value);
                }}
              />
            );
            })}
          </View>
          <AuthButton onPress={() => setStep(1)}>Continue</AuthButton>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Header title="You're in" subtitle="Now let's make this personal." step={1} />
          <PatriciaCard
            cacheKey="onboarding-account-ready"
            spokenText="Good. Your account is ready. Now I can get to know your family just enough to be useful. We will do this one small step at a time."
          >
            Your account is ready. One small step at a time.
          </PatriciaCard>
          <View style={{ borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, padding: 16, gap: 6 }}>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "700" }}>SIGNED IN AS</Text>
            <Text selectable style={{ color: theme.colors.text, fontSize: 16, fontWeight: "800" }}>{auth.session.email}</Text>
          </View>
          <AuthButton onPress={() => setStep(2)}>Continue</AuthButton>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Header title="Your family" subtitle="Names and birth date." step={2} />
          <PatriciaCard
            cacheKey="onboarding-child-profile"
            spokenText="Tell me a little about your little one, and your name too. Just enough so my notes can be personal and age-aware."
          >
            Tell me who I'm caring alongside.
          </PatriciaCard>
          <AuthField label="First name" value={parentFirstName} onChangeText={setParentFirstName} placeholder="Anna" />
          <AuthField label="Last name" value={parentLastName} onChangeText={setParentLastName} placeholder="Augustin" />
          <AuthField label="Child name or nickname" value={childName} onChangeText={setChildName} placeholder="Eric" />
          <AuthField label="Child birth date" value={childBirthDate} onChangeText={setChildBirthDate} placeholder="YYYY-MM-DD" />
          <View style={{ gap: 8 }}>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "700" }}>Sex at birth</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(["girl", "boy"] as const).map((option) => (
                <Pressable key={option} onPress={() => setSexAtBirth(option)} style={{ flex: 1, minHeight: 50, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: sexAtBirth === option ? theme.colors.blueLight : "white", borderWidth: 1.5, borderColor: sexAtBirth === option ? theme.colors.bluePrimary : theme.colors.border }}>
                  <Text selectable style={{ color: sexAtBirth === option ? theme.colors.blueDeep : theme.colors.text, fontSize: 15, fontWeight: "800" }}>{option === "girl" ? "Girl" : "Boy"}</Text>
                </Pressable>
              ))}
            </View>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>Used for growth chart references and so Patricia's notes use the right words for {childName || "your child"}.</Text>
          </View>
          <View style={{ gap: 8 }}>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "700" }}>Was your baby born early?</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ChoicePill label="No" active={!bornEarly} onPress={() => setBornEarly(false)} />
              <ChoicePill label="Yes" active={bornEarly} onPress={() => setBornEarly(true)} />
            </View>
            {bornEarly ? <AuthField label="How many weeks early?" value={weeksEarly} onChangeText={setWeeksEarly} keyboardType="number-pad" placeholder="4" /> : null}
          </View>
          <Pressable onPress={() => setPhotoSelected(!photoSelected)} style={{ alignItems: "center", borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 18, gap: 8 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: theme.colors.bluePrimary, backgroundColor: photoSelected ? theme.colors.bluePrimary : theme.colors.blueLight, alignItems: "center", justifyContent: "center" }}>
              <SfIcon name={photoSelected ? "checkmark" : "camera"} color={photoSelected ? "white" : theme.colors.bluePrimary} size={24} />
            </View>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 14 }}>{photoSelected ? "Photo placeholder selected" : `Add a photo of ${childName || "your child"} (optional)`}</Text>
          </Pressable>
          <AuthButton disabled={!parentReady || !childProfileReady} onPress={() => setStep(3)}>Continue</AuthButton>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Header title="About you" subtitle="Optional. Helpful." step={2} />
          <PatriciaCard
            cacheKey="onboarding-about-parent"
            spokenText="And tell me a little about you. You can skip anything. I only use this to speak more like I understand your house."
          >
            Skip anything. This only helps my wording.
          </PatriciaCard>
          <View style={{ gap: 14 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>Is {childName || "your child"} your first?</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <SelectCard title="My first" active={firstTimeParent === true} onPress={() => setFirstTimeParent(true)} />
              <SelectCard title="I've done this before" active={firstTimeParent === false} onPress={() => setFirstTimeParent(false)} />
            </View>
            <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>And you are {childName || "your child"}'s...</Text>
            <View style={{ gap: 8 }}>
              <SelectCard title="Mom" active={parentRole === "mother"} onPress={() => setParentRole("mother")} />
              <SelectCard title="Dad" active={parentRole === "father"} onPress={() => setParentRole("father")} />
              <SelectCard title="Another loving role" active={parentRole === "other"} onPress={() => setParentRole("other")} />
            </View>
            <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>Are you doing this with a partner, or on your own?</Text>
            <View style={{ gap: 8 }}>
              <SelectCard title="With a partner" active={parentingSolo === false} onPress={() => setParentingSolo(false)} />
              <SelectCard title="On my own" active={parentingSolo === true} onPress={() => setParentingSolo(true)} />
              <SelectCard title="Rather not say" active={parentingSolo === null} onPress={() => setParentingSolo(null)} />
            </View>
            <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>Does {childName || "your child"} hear more than one language at home?</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <SelectCard title="Yes" active={multilingualHome === true} onPress={() => setMultilingualHome(true)} />
              <SelectCard title="Just one" active={multilingualHome === false} onPress={() => setMultilingualHome(false)} />
            </View>
          </View>
          <AuthButton onPress={() => setStep(4)}>Continue</AuthButton>
          <AuthButton variant="text" onPress={() => setStep(4)}>Skip for now</AuthButton>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Header title="How often?" subtitle="You can change this later." step={3} />
          <PatriciaCard
            cacheKey="onboarding-notification-cadence"
            spokenText="How often would you like to hear from me? I will keep it useful, never noisy. Pick what feels gentle."
          >
            Pick what feels gentle.
          </PatriciaCard>
          <View style={{ gap: 10 }}>
            {notificationOptions.map((option) => (
              <SelectCard key={option.value} title={option.title} subtitle={option.subtitle} active={notificationCadence === option.value} onPress={() => setNotificationCadence(option.value)} />
            ))}
          </View>
          <AuthButton onPress={() => setStep(5)}>Continue</AuthButton>
        </>
      ) : null}

      {step === 5 ? (
        <>
          <Header title="Privacy" subtitle="Your data stays yours." step={4} />
          <PatriciaCard
            cacheKey="onboarding-privacy"
            spokenText="Before we begin, I want you to know what Nianza keeps and why. Your child's records help with milestones and vaccines. Your conversations help me remember context. You can delete everything in Settings."
          >
            I keep context so I can be useful. You stay in control.
          </PatriciaCard>
          <View style={{ borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: theme.colors.border, padding: 16, gap: 14 }}>
            {[
              "Your child's development records - to track milestones and vaccines",
              "Your conversations with Patricia - to give you continuity. Private to you.",
              "Delete everything, anytime - in Settings, instantly."
            ].map((row, index) => (
              <View key={row} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <SfIcon name={index === 0 ? "lock" : index === 1 ? "bubble.left" : "trash"} color={theme.colors.bluePrimary} size={18} />
                <Text selectable style={{ flex: 1, color: theme.colors.text, fontSize: 14, lineHeight: 20 }}>{row}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={() => setPrivacyAccepted((current) => !current)} style={{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "white", borderRadius: 16, borderWidth: 1, borderColor: privacyAccepted ? theme.colors.bluePrimary : theme.colors.border, padding: 14 }}>
            <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", backgroundColor: privacyAccepted ? theme.colors.bluePrimary : "white" }}>
              {privacyAccepted ? <SfIcon name="checkmark" color="white" size={15} /> : null}
            </View>
            <Text selectable style={{ flex: 1, color: theme.colors.text, fontSize: 14, lineHeight: 20 }}>I understand and agree to Nianza's privacy policy.</Text>
          </Pressable>
          <AuthButton disabled={!privacyAccepted} onPress={() => setStep(6)}>I agree - let's begin</AuthButton>
        </>
      ) : null}

      {step === 6 ? (
        <>
          <Header title="Reminders" subtitle="Optional." step={5} />
          <PatriciaCard
            cacheKey="onboarding-push-permission"
            spokenText="The best way for me to reach you is through notifications. I will keep them gentle, and you can turn them off later."
          >
            Gentle reminders, only if you want them.
          </PatriciaCard>
          <View style={{ alignItems: "center", justifyContent: "center", minHeight: 150 }}>
            <View style={{ width: 96, height: 120, borderRadius: 24, borderWidth: 3, borderColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center", backgroundColor: "white" }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.blueLight, alignItems: "center", justifyContent: "center" }}>
                <SfIcon name="bell" color={theme.colors.bluePrimary} size={25} />
              </View>
            </View>
          </View>
          <AuthButton onPress={() => finish(true)}>Allow notifications</AuthButton>
          <AuthButton variant="text" onPress={() => finish(false)}>Maybe later - I can set this up in Settings</AuthButton>
        </>
      ) : null}

      {step === 7 ? (
        <View style={{ alignItems: "center", gap: 24 }}>
          <BrandLogo variant="lockup" width={260} height={96} />
          <Text selectable style={{ color: "white", fontSize: 20, lineHeight: 29, fontStyle: "italic", textAlign: "center" }}>
            Welcome, {parentFirstName.trim() || "there"}. I have been waiting to meet you and {childName.trim() || "your child"}.
          </Text>
          <Pressable onPress={() => router.replace("/(tabs)")} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text selectable style={{ color: theme.colors.blueLight, fontSize: 14, fontWeight: "700" }}>Tap to continue</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}
