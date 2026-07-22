import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createSickEncounter,
  createVitalsEntry,
  deleteVitalsEntry,
  endSickEncounter,
  listVitals,
  type VitalsEntry,
  type VitalsEntryInput,
  type VitalsEntryType
} from "@/api/vitals";
import { useAuth } from "@/auth/auth-context";
import { ScreenTitle, SectionLabel, SfIcon, SpecCard } from "@/components/screen-spec";
import { openPatricia } from "@/components/talk-to-patricia-button";
import { theme } from "@/theme/theme";

const entryTypes: Array<{ type: VitalsEntryType; title: string; subtitle: string; icon: string }> = [
  { type: "temperature", title: "Temperature", subtitle: "A number you measured", icon: "thermometer" },
  { type: "medication", title: "Medication", subtitle: "What you gave, as written", icon: "pills" },
  { type: "symptom", title: "Symptom", subtitle: "What you noticed", icon: "cross.case" },
  { type: "weight", title: "Weight", subtitle: "Growth entry", icon: "scalemass" },
  { type: "height", title: "Length", subtitle: "Growth entry", icon: "ruler" },
  { type: "head_circumference", title: "Head", subtitle: "Growth entry", icon: "circle" },
  { type: "feeding", title: "Feeding", subtitle: "How feeding went", icon: "drop" },
  { type: "diaper", title: "Diaper", subtitle: "Wet or stool", icon: "square.stack" },
  { type: "sleep", title: "Sleep", subtitle: "A quick sleep note", icon: "moon" },
  { type: "note", title: "Note", subtitle: "Anything else", icon: "doc.text" }
];

const quickMeds = ["Acetaminophen", "Ibuprofen", "Antibiotic", "Other"];
const symptomTypes = ["vomiting", "diarrhea", "cough", "rash", "ear-pulling", "other"];
const feedingTypes = ["Bottle", "Breastfeeding", "Solids", "Other"];
const diaperTypes = ["Wet", "Stool", "Wet and stool", "Dry"];

function BackButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to previous screen"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
      style={{ minWidth: 44, minHeight: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}
    >
      <SfIcon name="chevron.left" color={theme.colors.text} size={24} />
    </Pressable>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: active ? theme.colors.bluePrimary : theme.colors.border,
        backgroundColor: active ? theme.colors.blueLight : "white",
        paddingHorizontal: 12,
        paddingVertical: 10
      }}
    >
      <Text selectable style={{ color: active ? theme.colors.blueDeep : theme.colors.text, fontSize: 12, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text selectable style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "800" }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.greyIcon}
        multiline={multiline}
        style={{
          minHeight: multiline ? 86 : 48,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          backgroundColor: "white",
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: theme.colors.text,
          fontSize: 14,
          textAlignVertical: multiline ? "top" : "center"
        }}
      />
    </View>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function EntryCard({ entry, onDelete }: { entry: VitalsEntry; onDelete: () => void }) {
  const dotColor = entry.entryType === "medication" ? "#6FA88E" : entry.entryType === "symptom" ? "#C79A5B" : theme.colors.bluePrimary;
  return (
    <SpecCard style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dotColor, marginTop: 4 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>
            {entry.title}
          </Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 18 }}>
            {entry.label}
          </Text>
          {entry.encounterName ? (
            <Text selectable style={{ color: theme.colors.terracotta, fontSize: 11, fontWeight: "700" }}>
              {entry.encounterName}
            </Text>
          ) : null}
          {entry.percentileStatus === "unverified-lms-seed" ? (
            <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11, lineHeight: 16 }}>
              Saved. Percentile lookup waits for verified growth references.
            </Text>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${entry.title}`} onPress={onDelete}>
          <SfIcon name="trash" color={theme.colors.greyIcon} size={20} />
        </Pressable>
      </View>
      <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11 }}>
        {formatTime(entry.recordedAt)}
      </Text>
    </SpecCard>
  );
}

export default function VitalsScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const childId = "primary-child";
  const childName = profile?.childName || "your child";
  const [selectedType, setSelectedType] = useState<VitalsEntryType>("temperature");
  const [notice, setNotice] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("lb");
  const [note, setNote] = useState("");
  const [medName, setMedName] = useState("Acetaminophen");
  const [doseText, setDoseText] = useState("");
  const [symptomType, setSymptomType] = useState("cough");
  const [feedingType, setFeedingType] = useState("Bottle");
  const [diaperType, setDiaperType] = useState("Wet");

  const vitalsQuery = useQuery({
    queryKey: ["vitals", childId],
    queryFn: () => listVitals(childId),
    retry: 1
  });
  const entries = vitalsQuery.data?.entries || [];
  const activeEncounter = vitalsQuery.data?.activeEncounter || null;

  const createEntryMutation = useMutation({
    mutationFn: (input: VitalsEntryInput) => createVitalsEntry(childId, input),
    onSuccess: (result) => {
      setNotice(`${result.entry.title} saved.`);
      setValue("");
      setNote("");
      setDoseText("");
      queryClient.invalidateQueries({ queryKey: ["vitals", childId] });
    },
    onError: (err) => setNotice(err instanceof Error ? err.message : "I could not save that yet.")
  });
  const startEncounterMutation = useMutation({
    mutationFn: () => createSickEncounter(childId, "Sick-day notes"),
    onSuccess: () => {
      setNotice("Sick-day notes started.");
      queryClient.invalidateQueries({ queryKey: ["vitals", childId] });
    }
  });
  const endEncounterMutation = useMutation({
    mutationFn: (encounterId: string) => endSickEncounter(childId, encounterId),
    onSuccess: () => {
      setNotice("Sick-day notes ended.");
      queryClient.invalidateQueries({ queryKey: ["vitals", childId] });
    }
  });
  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: string) => deleteVitalsEntry(childId, entryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vitals", childId] })
  });

  const saveDisabled = useMemo(() => {
    if (selectedType === "temperature") return !value.trim();
    if (selectedType === "medication") return !medName.trim();
    if (selectedType === "symptom") return symptomType === "other" && !note.trim();
    if (selectedType === "weight" || selectedType === "height" || selectedType === "head_circumference") return !value.trim();
    if (selectedType === "diaper") return !diaperType.trim();
    if (selectedType === "sleep" || selectedType === "note") return !note.trim();
    return false;
  }, [diaperType, medName, note, selectedType, symptomType, value]);

  function buildInput(): VitalsEntryInput {
    if (selectedType === "temperature") return { entryType: selectedType, valueText: value, note };
    if (selectedType === "medication") return { entryType: selectedType, medName, doseText, note };
    if (selectedType === "symptom") return { entryType: selectedType, symptomType, otherText: symptomType === "other" ? note : undefined, note: symptomType === "other" ? undefined : note };
    if (selectedType === "weight" || selectedType === "height" || selectedType === "head_circumference") return { entryType: selectedType, value, unit, note };
    if (selectedType === "feeding") return { entryType: selectedType, feedingType, amount: value, note };
    if (selectedType === "diaper") return { entryType: selectedType, diaperType, note };
    return { entryType: selectedType, note };
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 6 }}>
        <BackButton />
      </View>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 32 + insets.bottom, gap: 18 }}>
        <ScreenTitle
          title="Vitals"
          subtitle={`${childName}'s parent-recorded notes`}
          note="Nianza helps organize what you observed. It does not diagnose or replace medical care."
        />

        <View style={{ borderRadius: 18, borderWidth: 1.5, borderColor: activeEncounter ? theme.colors.terracotta : theme.colors.border, backgroundColor: activeEncounter ? theme.colors.terracottaLight : "white", padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: activeEncounter ? theme.colors.terracotta : theme.colors.bluePrimary }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 14, fontWeight: "800" }}>
                {activeEncounter ? activeEncounter.name : "No sick-day log open"}
              </Text>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 12 }}>
                {activeEncounter ? "New entries are added here." : "Start one if today needs a little closer tracking."}
              </Text>
            </View>
            {activeEncounter ? (
              <Pressable onPress={() => endEncounterMutation.mutate(activeEncounter.encounterId)}>
                <Text selectable style={{ color: theme.colors.terracotta, fontSize: 12, fontWeight: "800" }}>End</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => startEncounterMutation.mutate()}>
                <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 12, fontWeight: "800" }}>Start</Text>
              </Pressable>
            )}
          </View>
          {activeEncounter ? (
            <Pressable
              onPress={() =>
                openPatricia({
                  source: "F2-active-sick-encounter",
                  eventType: "sick-encounter-active",
                  childName,
                  childId,
                  entityId: activeEncounter.encounterId,
                  title: "Active sick encounter",
                  detail: activeEncounter.name,
                  occurredAt: activeEncounter.updatedAt
                })
              }
            >
              <Text selectable style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "800" }}>Ask Patricia about it</Text>
            </Pressable>
          ) : null}
        </View>

        <SectionLabel>ADD AN ENTRY</SectionLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {entryTypes.map((item) => {
            const active = selectedType === item.type;
            return (
              <Pressable
                key={item.type}
                onPress={() => setSelectedType(item.type)}
                style={{
                  width: "48%",
                  minHeight: 92,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: active ? theme.colors.bluePrimary : theme.colors.border,
                  backgroundColor: active ? theme.colors.blueLight : "white",
                  padding: 12,
                  gap: 8
                }}
              >
                <SfIcon name={item.icon} color={active ? theme.colors.bluePrimary : theme.colors.greyIcon} size={22} />
                <Text selectable style={{ color: theme.colors.text, fontSize: 13, fontWeight: "800" }}>{item.title}</Text>
                <Text selectable style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 15 }}>{item.subtitle}</Text>
              </Pressable>
            );
          })}
        </View>

        <SpecCard style={{ gap: 14 }}>
          <Text selectable style={{ color: theme.colors.text, fontSize: 16, fontWeight: "800" }}>
            {entryTypes.find((item) => item.type === selectedType)?.title}
          </Text>

          {selectedType === "medication" ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {quickMeds.map((label) => <Choice key={label} label={label} active={medName === label} onPress={() => setMedName(label)} />)}
              </View>
              <Field label="Dose, exactly as written or remembered" value={doseText} onChangeText={setDoseText} placeholder="Example: 2.5 ml" />
            </View>
          ) : null}

          {selectedType === "symptom" ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {symptomTypes.map((label) => <Choice key={label} label={label} active={symptomType === label} onPress={() => setSymptomType(label)} />)}
              </View>
              <Field label={symptomType === "other" ? "What did you notice?" : "Note"} value={note} onChangeText={setNote} placeholder="A few words is enough" multiline />
            </View>
          ) : null}

          {selectedType === "feeding" ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {feedingTypes.map((label) => <Choice key={label} label={label} active={feedingType === label} onPress={() => setFeedingType(label)} />)}
              </View>
              <Field label="Amount or detail" value={value} onChangeText={setValue} placeholder="Example: 4 oz, shorter than usual" />
              <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" multiline />
            </View>
          ) : null}

          {selectedType === "diaper" ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {diaperTypes.map((label) => <Choice key={label} label={label} active={diaperType === label} onPress={() => setDiaperType(label)} />)}
              </View>
              <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" multiline />
            </View>
          ) : null}

          {selectedType === "temperature" ? (
            <>
              <Field label="Temperature" value={value} onChangeText={setValue} placeholder="Example: 99.8 F" />
              <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" multiline />
            </>
          ) : null}

          {selectedType === "weight" || selectedType === "height" || selectedType === "head_circumference" ? (
            <>
              <Field label="Measurement" value={value} onChangeText={setValue} placeholder={selectedType === "weight" ? "Example: 12.5" : "Example: 24.2"} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["lb", "kg", "in", "cm"].map((label) => <Choice key={label} label={label} active={unit === label} onPress={() => setUnit(label)} />)}
              </View>
              <Text selectable style={{ color: theme.colors.greyIcon, fontSize: 11, lineHeight: 16 }}>
                Percentile lookup will appear after the growth references are clinically verified.
              </Text>
            </>
          ) : null}

          {selectedType === "sleep" || selectedType === "note" ? (
            <Field label="Note" value={note} onChangeText={setNote} placeholder="A few words is enough" multiline />
          ) : null}

          <Pressable
            disabled={saveDisabled || createEntryMutation.isPending}
            onPress={() => createEntryMutation.mutate(buildInput())}
            style={{ minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: saveDisabled ? theme.colors.border : theme.colors.bluePrimary }}
          >
            <Text selectable style={{ color: "white", fontSize: 15, fontWeight: "800" }}>
              {createEntryMutation.isPending ? "Saving..." : "Save entry"}
            </Text>
          </Pressable>
          {notice ? <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>{notice}</Text> : null}
        </SpecCard>

        <Pressable onPress={() => router.push("/growth")}>
          <SpecCard style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>Growth chart</Text>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
                Weight, length, and head circumference entries collect here.
              </Text>
            </View>
            <SfIcon name="chevron.right" color={theme.colors.greyIcon} size={18} />
          </SpecCard>
        </Pressable>

        <SectionLabel>RECENT ENTRIES</SectionLabel>
        {vitalsQuery.isLoading ? (
          <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>Loading Vitals...</Text>
        ) : entries.length ? (
          entries.map((entry) => <EntryCard key={entry.entryId} entry={entry} onDelete={() => deleteEntryMutation.mutate(entry.entryId)} />)
        ) : (
          <SpecCard>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 18 }}>
              No entries yet. Start with the one thing you noticed.
            </Text>
          </SpecCard>
        )}
      </ScrollView>
    </View>
  );
}
