import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { upsertChild } from "@/api/children";
import { getVaccineProgress, markVaccineBackfillOffered, recordVaccineDose, removeVaccineDose } from "@/api/vaccines";
import { ApiError, apiUrl } from "@/api/client";
import { usePatriciaChunkedSpeech } from "@/audio/use-patricia-chunked-speech";
import { useAuth } from "@/auth/auth-context";
import { openPatricia, TalkToPatriciaButton } from "@/components/talk-to-patricia-button";
import { EmptyCircle, ScreenTitle, SectionLabel, SfIcon, SpecCard } from "@/components/screen-spec";
import { possessivePronoun } from "@/text/patricia-text";
import { theme } from "@/theme/theme";
import { VaccineDose, vaccineStatusLabel, vaccineStatusTone, vaccineWindowLabel } from "@/data/vaccines";

const SAFETY_NOTE_KEY = "vaccines-safety-note";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDoseSubtitle(dose: VaccineDose) {
  const parts = [`Window: ${vaccineWindowLabel(dose)}`];
  if (dose.givenOn) parts.push(`Given ${dose.givenOn}`);
  if (dose.backfilled) parts.push("from vaccination card");
  return parts.join(" - ");
}

function StatusChip({ status }: { status: VaccineDose["status"] }) {
  const label = vaccineStatusLabel(status);
  if (!label) return null;
  const isDue = vaccineStatusTone(status) === "terracotta";
  const isNeutral = status === "unrecorded";
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: isDue ? theme.colors.terracottaLight : isNeutral ? "#F1F3F4" : theme.colors.blueLight
      }}
    >
      <Text
        selectable
        style={{
          color: isDue ? theme.colors.terracotta : isNeutral ? theme.colors.greyIcon : theme.colors.blueDeep,
          fontSize: 11,
          fontWeight: "700"
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function VaccineRecordPanel({
  dose,
  onClose,
  onSaved
}: {
  dose: VaccineDose;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [givenOn, setGivenOn] = useState(dose.givenOn || (dose.status === "unrecorded" ? "" : todayIsoDate()));
  const [note, setNote] = useState(dose.parentNote || "");
  const [backfilled, setBackfilled] = useState(dose.backfilled || dose.status === "unrecorded");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!givenOn.trim()) {
      onSaved("Add the date from the vaccination card first.");
      return;
    }
    setSaving(true);
    try {
      await recordVaccineDose({
        doseId: dose.doseId,
        givenOn: givenOn.trim(),
        note: note.trim(),
        backfilled
      });
      onSaved(`${dose.name} recorded.`);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await removeVaccineDose({ doseId: dose.doseId });
      onSaved(`${dose.name} record removed.`);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 12, gap: 10 }}>
      <Text selectable style={{ color: theme.colors.text, fontSize: 13, fontWeight: "800" }}>
        Record {dose.name}
      </Text>
      <TextInput
        accessibilityLabel="Given on date"
        value={givenOn}
        onChangeText={setGivenOn}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 13,
          paddingHorizontal: 14,
          paddingVertical: 11,
          color: theme.colors.text,
          backgroundColor: "white",
          fontSize: 15
        }}
      />
      <TextInput
        accessibilityLabel="Vaccine note"
        value={note}
        onChangeText={setNote}
        placeholder="Optional note"
        multiline
        style={{
          minHeight: 74,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 13,
          paddingHorizontal: 14,
          paddingVertical: 11,
          color: theme.colors.text,
          backgroundColor: "white",
          fontSize: 14,
          textAlignVertical: "top"
        }}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: backfilled }}
        onPress={() => setBackfilled((current) => !current)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        <EmptyCircle checked={backfilled} />
        <Text selectable style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "700" }}>
          This came from the vaccination card
        </Text>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          disabled={saving}
          onPress={save}
          style={{ flex: 1, borderRadius: 16, backgroundColor: theme.colors.bluePrimary, alignItems: "center", paddingVertical: 13 }}
        >
          <Text selectable={false} style={{ color: "white", fontSize: 14, fontWeight: "800" }}>
            Save
          </Text>
        </Pressable>
        {dose.status === "recorded" ? (
          <Pressable
            disabled={saving}
            onPress={remove}
            style={{ borderRadius: 16, backgroundColor: theme.colors.terracottaLight, alignItems: "center", paddingHorizontal: 16, paddingVertical: 13 }}
          >
            <Text selectable={false} style={{ color: theme.colors.terracotta, fontSize: 14, fontWeight: "800" }}>
              Remove
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function applyPatriciaTemplate(template: string | null | undefined, parentFirstName: string, childName: string, sexAtBirth?: "girl" | "boy" | null) {
  if (!template) return "";
  const greeting = parentFirstName ? `Hi ${parentFirstName}, ` : "";
  return template
    .replace(/\{greeting\}/g, greeting)
    .replace(/\{childName\}/g, childName)
    .replace(/\{pronoun\}/g, possessivePronoun(sexAtBirth));
}

/** Normalizes safetyNote to the current {title, text} shape whether the API
 * response is already in that shape or (briefly, until the backend is
 * redeployed) still the older plain-string shape. Without this, a
 * not-yet-deployed backend crashes the screen instead of just showing
 * slightly-less-personalized copy. */
function normalizeSafetyNote(raw: unknown): { title: string | null; text: string } | null {
  if (!raw) return null;
  if (typeof raw === "string") return { title: null, text: raw };
  if (typeof raw === "object" && "text" in raw) {
    const note = raw as { title?: string | null; text?: string };
    return note.text ? { title: note.title ?? null, text: note.text } : null;
  }
  return null;
}

function SafetyNoteCard({
  title,
  text,
  parentFirstName,
  childName,
  sexAtBirth
}: {
  title: string | null;
  text: string;
  parentFirstName: string;
  childName: string;
  sexAtBirth?: "girl" | "boy" | null;
}) {
  const patriciaSpeech = usePatriciaChunkedSpeech();
  const [notice, setNotice] = useState<string | null>(null);
  const autoPlayedRef = useRef(false);
  const resolvedTitle = applyPatriciaTemplate(title || "Before we look at the schedule", parentFirstName, childName, sexAtBirth);
  const resolvedText = applyPatriciaTemplate(text, parentFirstName, childName, sexAtBirth);
  const isSpeaking = patriciaSpeech.isSpeaking(SAFETY_NOTE_KEY);
  const isLoading = patriciaSpeech.isLoading(SAFETY_NOTE_KEY);

  async function speak() {
    setNotice(null);
    try {
      await patriciaSpeech.play(SAFETY_NOTE_KEY, resolvedText);
    } catch {
      setNotice("Patricia could not play this just now. Tap Replay to try again.");
    }
  }

  useEffect(() => {
    if (autoPlayedRef.current) return;
    autoPlayedRef.current = true;
    speak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedText]);

  return (
    <SpecCard style={{ gap: 10, backgroundColor: theme.colors.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
          <Text selectable={false} style={{ color: "white", fontSize: 13, fontWeight: "700" }}>
            P
          </Text>
        </View>
        <Text selectable style={{ flex: 1, color: theme.colors.text, fontSize: 13, fontWeight: "800" }}>
          {resolvedTitle}
        </Text>
      </View>
      <Text selectable style={{ color: theme.colors.text, fontSize: 13, lineHeight: 19 }}>
        {resolvedText}
      </Text>
      <Pressable
        onPress={speak}
        style={{
          alignSelf: "flex-start",
          minHeight: 32,
          borderRadius: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          paddingHorizontal: 10,
          backgroundColor: isSpeaking ? theme.colors.blueLight : "white"
        }}
      >
        <SfIcon name="speaker.wave.2.fill" color={theme.colors.bluePrimary} size={17} />
        <Text selectable style={{ color: theme.colors.blueDeep, fontSize: 12, fontWeight: "700" }}>
          {isLoading ? "Loading" : isSpeaking ? "Playing" : "Replay"}
        </Text>
      </Pressable>
      {notice ? (
        <Text selectable style={{ color: theme.colors.muted, fontSize: 11 }}>
          {notice}
        </Text>
      ) : null}
    </SpecCard>
  );
}

export default function VaccinesScreen() {
  const { profile, activeChildId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDoseId, setSelectedDoseId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const childName = profile?.childName || "your child";
  const parentFirstName = profile?.parentFirstName || profile?.parentName?.split(/\s+/)[0] || "";
  const childId = activeChildId || "primary-child";

  const vaccinesQuery = useQuery({
    queryKey: ["vaccine-progress", childId],
    enabled: Boolean(profile),
    queryFn: async () => {
      if (profile) await upsertChild(childId, profile);
      return getVaccineProgress(childId);
    }
  });

  const groups = vaccinesQuery.data?.groups || [];
  const vaccineError = vaccinesQuery.error instanceof ApiError ? vaccinesQuery.error : null;
  const visibleGroups = useMemo(
    () => groups.map((group) => ({ ...group, doses: group.doses.filter((dose) => dose.status !== "future") })).filter((group) => group.doses.length),
    [groups]
  );

  async function refreshWith(message: string) {
    setNotice(message);
    await queryClient.invalidateQueries({ queryKey: ["vaccine-progress", childId] });
  }

  async function retryVaccines() {
    setNotice(`Syncing ${childName}'s profile with Nianza...`);
    try {
      if (profile) await upsertChild(childId, profile);
      await vaccinesQuery.refetch();
    } catch {
      await vaccinesQuery.refetch();
    }
  }

  const vaccineErrorCopy = useMemo(() => {
    const details = vaccineError ? ` (${vaccineError.status || "network"}${vaccineError.code ? `/${vaccineError.code}` : ""})` : "";
    if (vaccineError?.status === 401 || vaccineError?.status === 403) {
      return {
        title: "Please sign in again.",
        body: `Your secure session needs a refresh before Nianza can load vaccine notes.${details}`
      };
    }
    if (vaccineError?.code === "CHILD_NOT_FOUND") {
      return {
        title: `${childName}'s profile needs to sync.`,
        body: `Tap Try again so Nianza can create the child record, then load vaccine notes.${details}`
      };
    }
    if (vaccineError?.code === "NETWORK_ERROR") {
      return {
        title: "Nianza could not be reached.",
        body: `The app could not reach ${apiUrl}. Check that the app bundle has the deployed API URL, then try again.${details}`
      };
    }
    return {
      title: "Vaccine notes need a connection.",
      body: `${vaccineError?.message || "Try again when the app can reach Nianza."}${details}`
    };
  }, [childName, vaccineError?.code, vaccineError?.status]);

  async function dismissBackfill() {
    await markVaccineBackfillOffered(childId);
    await refreshWith("You can still mark earlier vaccines from the card anytime.");
  }

  function selectFirstBackfillDose() {
    const firstUnrecordedDose = visibleGroups.flatMap((group) => group.doses).find((dose) => dose.status === "unrecorded");
    if (firstUnrecordedDose) {
      setSelectedDoseId(firstUnrecordedDose.doseId);
      setNotice("Copy the date from the vaccination card, then save. Skip anything you are not sure about.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, paddingTop: 72, paddingBottom: 36, gap: 18 }}
        style={{ backgroundColor: theme.colors.background }}
      >
        <ScreenTitle
          title="Vaccines"
          subtitle={`${childName}'s immunization notes`}
          note={"Parent-recorded information only. Your doctor's plan and your child's official card win."}
        />

        {(() => {
          const safetyNote = normalizeSafetyNote(vaccinesQuery.data?.safetyNote);
          if (!safetyNote) return null;
          return (
            <SafetyNoteCard
              title={safetyNote.title}
              text={safetyNote.text}
              parentFirstName={parentFirstName}
              childName={childName}
              sexAtBirth={profile?.sexAtBirth}
            />
          );
        })()}

        {notice ? (
          <View style={{ borderRadius: 14, backgroundColor: theme.colors.blueLight, padding: 12 }}>
            <Text selectable style={{ color: theme.colors.blueDeep, fontSize: 12, fontWeight: "700", lineHeight: 17 }}>
              {notice}
            </Text>
          </View>
        ) : null}

        {vaccinesQuery.isLoading ? (
          <SpecCard>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>
              Loading {childName}'s vaccine notes...
            </Text>
          </SpecCard>
        ) : null}

        {vaccinesQuery.error ? (
          <SpecCard style={{ gap: 8 }}>
            <Text selectable style={{ color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>
              {vaccineErrorCopy.title}
            </Text>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 17 }}>
              {vaccineErrorCopy.body}
            </Text>
            <Pressable
              onPress={retryVaccines}
              style={{ alignSelf: "flex-start", borderRadius: 14, backgroundColor: theme.colors.bluePrimary, paddingHorizontal: 14, paddingVertical: 10 }}
            >
              <Text selectable={false} style={{ color: "white", fontSize: 13, fontWeight: "800" }}>
                Try again
              </Text>
            </Pressable>
          </SpecCard>
        ) : null}

        {vaccinesQuery.data?.shouldOfferBackfill ? (
          <SpecCard style={{ gap: 12, backgroundColor: theme.colors.card }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.bluePrimary, alignItems: "center", justifyContent: "center" }}>
                <Text selectable={false} style={{ color: "white", fontSize: 18, fontWeight: "900" }}>
                  P
                </Text>
              </View>
              <Text selectable style={{ flex: 1, color: theme.colors.text, fontSize: 15, fontWeight: "800" }}>
                Patricia
              </Text>
            </View>
            <Text selectable style={{ color: theme.colors.text, fontSize: 15, lineHeight: 23, fontStyle: "italic", fontWeight: "600" }}>
              If you have {childName}'s vaccination card handy, you can mark what is already there. Anything you are not sure about, the doctor can read right off the card.
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={selectFirstBackfillDose} style={{ borderRadius: 16, backgroundColor: theme.colors.bluePrimary, paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text selectable={false} style={{ color: "white", fontSize: 13, fontWeight: "800" }}>
                  Mark from card
                </Text>
              </Pressable>
              <Pressable onPress={dismissBackfill} style={{ borderRadius: 16, backgroundColor: "white", paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text selectable={false} style={{ color: theme.colors.blueDeep, fontSize: 13, fontWeight: "800" }}>
                  Skip
                </Text>
              </Pressable>
            </View>
          </SpecCard>
        ) : null}

        {visibleGroups.map((group) => (
          <View key={group.displayGroup} style={{ gap: 10 }}>
            <SectionLabel>{group.displayGroup.toUpperCase()}</SectionLabel>
            <SpecCard style={{ gap: 14 }}>
              {group.doses.map((dose, index) => {
                const selected = selectedDoseId === dose.doseId;
                return (
                  <View key={dose.doseId} style={{ gap: 12 }}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setSelectedDoseId(selected ? null : dose.doseId)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 13 }}
                    >
                      <EmptyCircle checked={dose.status === "recorded"} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text selectable numberOfLines={2} style={{ color: theme.colors.text, fontSize: 14, fontWeight: "800", lineHeight: 19 }}>
                          {dose.name} - dose {dose.doseNum}
                        </Text>
                        <Text selectable style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 16 }}>
                          {formatDoseSubtitle(dose)}
                        </Text>
                        {dose.description ? (
                          <Text selectable style={{ color: theme.colors.text, fontSize: 12, lineHeight: 17 }}>
                            {dose.description}
                          </Text>
                        ) : null}
                        {dose.note ? (
                          <Text selectable style={{ color: theme.colors.muted, fontSize: 11, lineHeight: 16 }}>
                            {dose.note}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 8 }}>
                        <StatusChip status={dose.status} />
                        <SfIcon name={selected ? "chevron.down" : "chevron.right"} color={theme.colors.greyIcon} size={16} />
                      </View>
                    </Pressable>

                    {dose.status === "due" || dose.status === "upcoming" ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          openPatricia({
                            source: "E1-vaccines",
                            eventType: "vaccines",
                            childId,
                            childName,
                            entityId: dose.doseId,
                            title: `${dose.name} vaccine`,
                            detail: `${dose.fullName}, ${vaccineStatusLabel(dose.status).toLowerCase()}, window ${vaccineWindowLabel(dose)}`,
                            occurredAt: new Date().toISOString()
                          })
                        }
                        style={{ alignSelf: "flex-start", paddingLeft: 43 }}
                      >
                        <Text selectable={false} style={{ color: theme.colors.bluePrimary, fontSize: 13, fontWeight: "900" }}>
                          Talk it through with Patricia
                        </Text>
                      </Pressable>
                    ) : null}

                    {selected ? <VaccineRecordPanel dose={dose} onClose={() => setSelectedDoseId(null)} onSaved={refreshWith} /> : null}

                    {index < group.doses.length - 1 ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
                  </View>
                );
              })}
            </SpecCard>
          </View>
        ))}

        {vaccinesQuery.data?.informationalRows?.length ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>ASK YOUR PEDIATRICIAN</SectionLabel>
            <SpecCard style={{ gap: 12 }}>
              {vaccinesQuery.data.informationalRows.map((row, index) => (
                <View key={row.infoId || index} style={{ gap: 4 }}>
                  <Text selectable style={{ color: theme.colors.text, fontSize: 13, fontWeight: "800" }}>
                    {row.title || row.name || row.row || "Current guidance"}
                  </Text>
                  {row.text ? (
                    <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 18 }}>
                      {row.text}
                    </Text>
                  ) : null}
                </View>
              ))}
            </SpecCard>
          </View>
        ) : null}
      </ScrollView>
      <TalkToPatriciaButton source="E1-vaccines" eventType="vaccines" detail="Vaccine schedule visible" entityId="vaccines-schedule" />
    </View>
  );
}
