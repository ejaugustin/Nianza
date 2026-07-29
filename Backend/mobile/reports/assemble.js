const milestonesLibrary = require("../milestones/library");
const vaccinesLibrary = require("../vaccines/library");
const vitalsLibrary = require("../vitals/library");
const narrative = require("./narrative");
const reportData = require("./data");
const { formatShort, formatLong } = require("./periods");

function displayName(dose) {
  return dose.fullName || dose.vaccineName || dose.name;
}

function domainLabel(tab) {
  return tab || "General";
}

function groupMilestonesByDomain(observations) {
  const groups = {};
  for (const obs of observations) {
    const found = reportData.milestoneDomain(obs.milestoneId);
    const domain = domainLabel(found?.tab);
    if (!groups[domain]) groups[domain] = [];
    groups[domain].push({
      milestoneId: obs.milestoneId,
      text: found?.text || obs.milestoneName,
      observedAt: obs.observedAt
    });
  }
  return groups;
}

function growthByType(entries) {
  const byType = { weight: [], height: [], head_circumference: [] };
  for (const entry of entries) {
    if (!vitalsLibrary.GROWTH_TYPES.has(entry.entryType)) continue;
    byType[entry.entryType].push({ recordedAt: entry.recordedAt, value: entry.value, unit: entry.unit });
  }
  return byType;
}

function encounterSummary(encounter, entries) {
  const own = entries.filter((entry) => entry.encounterId === encounter.encounterId);
  const temps = own.filter((entry) => entry.entryType === "temperature");
  const meds = own.filter((entry) => entry.entryType === "medication");
  const notes = own.filter((entry) => entry.entryType === "note" || entry.note);
  const peakTemp = temps.reduce((max, entry) => {
    const value = parseFloat(entry.valueText);
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);
  const durationDays = encounter.endedAt
    ? Math.max(1, Math.round((new Date(encounter.endedAt) - new Date(encounter.startedAt)) / 86400000))
    : null;
  return {
    encounterId: encounter.encounterId,
    name: encounter.name,
    startedAt: encounter.startedAt,
    endedAt: encounter.endedAt,
    durationDays,
    peakTemp: peakTemp || null,
    temps: temps.map((t) => ({ recordedAt: t.recordedAt, valueText: t.valueText })),
    medications: meds.map((m) => ({ recordedAt: m.recordedAt, medName: m.medName, doseText: m.doseText })),
    notes: notes.map((n) => ({ recordedAt: n.recordedAt, note: n.note, recordedBy: n.recordedBy }))
  };
}

function caregiverNoteEntries(entries) {
  return entries
    .filter(reportData.isCaregiverNote)
    .map((entry) => ({ recordedAt: entry.recordedAt, note: entry.note, recordedBy: entry.recordedBy, entryType: entry.entryType }))
    .sort((a, b) => String(a.recordedAt).localeCompare(String(b.recordedAt)));
}

function plainVaccineList(doses) {
  return doses.map((dose) => ({ name: displayName(dose), givenOn: dose.givenOn }));
}

// ---- Monthly Progress Report --------------------------------------------

async function buildMonthSection({ child, childName, window, vitalsEntries, milestoneObservations, encounters, doses, vaccineProgress }) {
  const monthEncounters = encounters.filter((e) => reportData.encounterOverlapsRange(e, window.startDate, window.endDate));
  const healthEvents = monthEncounters.map((e) => encounterSummary(e, vitalsEntries));
  const growthEntries = vitalsEntries.filter(reportData.isGrowthEntry);
  const dosesGiven = doses.filter((d) => d.givenOn >= window.startDate.slice(0, 10) && d.givenOn <= window.endDate.slice(0, 10));
  const dosesUpcoming = (vaccineProgress?.groups || []).flatMap((g) => g.doses.filter((d) => d.status === "due"));
  const milestonesReached = milestoneObservations.map((obs) => {
    const found = reportData.milestoneDomain(obs.milestoneId);
    return { text: found?.text || obs.milestoneName, domain: found?.tab || null, observedAt: obs.observedAt };
  });
  const reachedIds = new Set(milestoneObservations.map((obs) => obs.milestoneId));
  const ageMonths = milestonesLibrary.effectiveAgeMonths(child, new Date());
  const currentWindow = milestonesLibrary.currentWindowForAge(ageMonths);
  const newInCurrentWindow = currentWindow.milestones
    .filter((m) => !reachedIds.has(m.milestoneId))
    .map((m) => ({ text: m.text, domain: m.domain }));
  const caregiverNotes = caregiverNoteEntries(vitalsEntries);

  const fallback = {
    monthAtAGlance: [
      milestonesReached.length ? `${milestonesReached.length} milestone${milestonesReached.length === 1 ? "" : "s"} logged.` : null,
      healthEvents.length ? `${healthEvents.length} sick-day episode${healthEvents.length === 1 ? "" : "s"} noted.` : null,
      dosesGiven.length ? `${dosesGiven.length} vaccine dose${dosesGiven.length === 1 ? "" : "s"} given.` : null,
      !milestonesReached.length && !healthEvents.length && !dosesGiven.length ? "A quieter month in the log -- nothing new marked yet." : null
    ].filter(Boolean).join(" ") || `No entries logged for ${childName} this month yet.`
  };

  const generated = await narrative.generateStructured({
    system: `You are writing the "Month at a Glance" section of a parent's monthly progress report for their child, ${childName}. Write 60-100 words in plain, warm language. Mention milestones reached, illnesses, vaccines given, and notable firsts, using only the data given. If the data is sparse, say so briefly rather than padding. Return JSON: {"monthAtAGlance": "..."}`,
    data: { childName, milestonesReached, healthEvents, dosesGiven },
    fallback
  });

  return {
    monthAtAGlance: generated.monthAtAGlance,
    milestones: milestonesReached,
    newInCurrentWindow,
    growth: growthByType(growthEntries),
    healthEvents,
    vaccines: { given: plainVaccineList(dosesGiven), upcoming: dosesUpcoming.map((d) => ({ name: displayName(d) })) },
    caregiverNotes
  };
}

// ---- 6-Month Digest -------------------------------------------------------

async function buildHalfYearSection({ childName, window, vitalsEntries, milestoneObservations, encounters, doses, allDoses }) {
  const windowEncounters = encounters.filter((e) => reportData.encounterOverlapsRange(e, window.startDate, window.endDate));
  const illnessTable = windowEncounters.map((e) => encounterSummary(e, vitalsEntries));
  const growthEntries = vitalsEntries.filter(reportData.isGrowthEntry);
  const caregiverNotes = caregiverNoteEntries(vitalsEntries);
  const milestoneArc = groupMilestonesByDomain(milestoneObservations);

  const illnessFallback = {
    illnessPattern: illnessTable.length
      ? `${illnessTable.length} sick-day episode${illnessTable.length === 1 ? "" : "s"} logged in this window, averaging ${Math.round(illnessTable.reduce((sum, e) => sum + (e.durationDays || 1), 0) / illnessTable.length)} day(s) each.`
      : "No sick-day episodes logged in this window."
  };
  const halfYearFallback = {
    halfYearNarrative: [
      Object.keys(milestoneArc).length ? `Milestones logged across ${Object.keys(milestoneArc).length} developmental area(s).` : null,
      illnessTable.length ? `${illnessTable.length} illness episode(s) this half-year.` : null,
      doses.length ? `${doses.length} vaccine dose(s) given in this window.` : null
    ].filter(Boolean).join(" ") || `A quiet six months in the log for ${childName}.`
  };

  const [halfYear, illness] = await Promise.all([
    narrative.generateStructured({
      system: `You are writing the "Half-Year Narrative" of a parent's 6-month digest for their child, ${childName}. Write 150-220 words covering developmental leaps, the overall illness picture, growth direction, and vaccine progress, using only the data given. Return JSON: {"halfYearNarrative": "..."}`,
      data: { childName, milestoneArc, illnessTable, dosesGiven: doses, growthEntries },
      fallback: halfYearFallback
    }),
    narrative.generateStructured({
      system: `Write a one-paragraph pattern summary (frequency, seasonality, recovery times) of this child's illness episodes over the last six months, using only the data given. Return JSON: {"illnessPattern": "..."}`,
      data: { illnessTable },
      fallback: illnessFallback
    })
  ]);

  const highlightsFallback = { highlights: caregiverNotes.slice(-8).reverse() };
  const highlights = await narrative.generateStructured({
    system: `From this list of caregiver notes, select the 5-8 most significant (firsts, changes, recurring observations). Return JSON: {"highlights": [{"recordedAt": "...", "note": "...", "recordedBy": "..."}]} using only notes that appear in the input, verbatim.`,
    data: { caregiverNotes },
    fallback: highlightsFallback
  });

  return {
    halfYearNarrative: halfYear.halfYearNarrative,
    milestoneArc,
    growthTrend: growthByType(growthEntries),
    illnessPattern: { table: illnessTable, narrative: illness.illnessPattern },
    vaccineRecord: { inWindow: plainVaccineList(doses), cumulative: plainVaccineList(allDoses) },
    highlights: highlights.highlights || highlightsFallback.highlights
  };
}

// ---- Yearly Report ---------------------------------------------------------

async function buildYearSection({ child, childName, window, vitalsEntries, milestoneObservations, encounters, allDoses, childSummary }) {
  const growthEntries = vitalsEntries.filter(reportData.isGrowthEntry);
  const caregiverNotes = caregiverNoteEntries(vitalsEntries);
  const milestoneTrajectory = groupMilestonesByDomain(milestoneObservations);
  const healthHistoryTable = encounters
    .filter((e) => reportData.encounterOverlapsRange(e, window.startDate, window.endDate))
    .map((e) => encounterSummary(e, vitalsEntries));
  const recentMedications = vitalsEntries
    .filter((e) => e.entryType === "medication")
    .slice(0, 10)
    .map((e) => ({ recordedAt: e.recordedAt, medName: e.medName, doseText: e.doseText }));

  const yearFallback = {
    yearInReview: `${childName} had ${Object.values(milestoneTrajectory).flat().length} milestone(s) logged, ${healthHistoryTable.length} illness episode(s), and ${allDoses.length} vaccine dose(s) recorded over the last year.`
  };
  const healthFallback = {
    healthHistory: healthHistoryTable.length
      ? `${healthHistoryTable.length} illness episode(s) logged this year.`
      : "No illness episodes logged this year."
  };
  const momentsFallback = { notableMoments: caregiverNotes.slice(-8).reverse() };

  const [yearReview, health, moments] = await Promise.all([
    narrative.generateStructured({
      system: `Write the "Year in Review" narrative for a child's yearly report, for a reader (a new pediatrician, school, or daycare) who has never met the child, ${childName}. Write 250-350 words describing who this child was at the start of the year and who they are now, using only the data given. Return JSON: {"yearInReview": "..."}`,
      data: { childName, milestoneTrajectory, healthHistoryTable, allDoses, growthEntries },
      fallback: yearFallback
    }),
    narrative.generateStructured({
      system: "Write a one-paragraph seasonality and pattern summary of this child's illness episodes over the last year, using only the data given. Return JSON: {\"healthHistory\": \"...\"}",
      data: { healthHistoryTable },
      fallback: healthFallback
    }),
    narrative.generateStructured({
      system: "From this list of caregiver notes, select the most notable moments of the year. Return JSON: {\"notableMoments\": [{\"recordedAt\": \"...\", \"note\": \"...\", \"recordedBy\": \"...\"}]} using only notes that appear in the input, verbatim.",
      data: { caregiverNotes },
      fallback: momentsFallback
    })
  ]);

  return {
    yearInReview: yearReview.yearInReview,
    childSummaryCard: {
      childName,
      birthDate: child.childBirthDate || child.birthDate || null,
      allergies: childSummary?.allergies || null,
      recentMedications,
      pediatricianName: childSummary?.pediatricianName || null,
      pediatricianPhone: childSummary?.pediatricianPhone || null
    },
    growthTrajectory: growthByType(growthEntries),
    milestoneTrajectory,
    healthHistory: { table: healthHistoryTable, narrative: health.healthHistory },
    vaccineRecordCumulative: plainVaccineList(allDoses),
    careTeamVisits: [],
    careTeamVisitsNote: "Nianza doesn't have a visit log yet, so this section is empty rather than guessed at.",
    notableMoments: moments.notableMoments || momentsFallback.notableMoments
  };
}

// ---- Doctor Visit Pack ------------------------------------------------------

async function buildVisitPackSection({ childName, window, vitalsEntries, milestoneObservations, encounters, doses, allDoses, vaccineProgress, parentConcerns, latestDebrief }) {
  const windowEncounters = encounters.filter((e) => reportData.encounterOverlapsRange(e, window.startDate, window.endDate));
  const encounterSummaries = windowEncounters.map((e) => encounterSummary(e, vitalsEntries));
  const milestonesInWindow = milestoneObservations.map((obs) => {
    const found = reportData.milestoneDomain(obs.milestoneId);
    return { text: found?.text || obs.milestoneName, observedAt: obs.observedAt };
  });
  const caregiverNotes = caregiverNoteEntries(vitalsEntries);
  const dueDoses = (vaccineProgress?.groups || []).flatMap((g) => g.doses.filter((d) => d.status === "due"));

  const recapFallback = {
    sinceYourLastVisit: [
      encounterSummaries.length ? `${encounterSummaries.length} illness episode(s) logged.` : null,
      milestonesInWindow.length ? `${milestonesInWindow.length} milestone(s) reached.` : null,
      caregiverNotes.length ? `${caregiverNotes.length} caregiver note(s) recorded.` : null
    ].filter(Boolean).join(" ") || `Nothing notable logged for ${childName} since the window began.`
  };
  const talkingPointsFallback = {
    talkingPoints: [
      ...encounterSummaries.map((e) => ({ text: `${e.name}${e.peakTemp ? `, peak temp ${e.peakTemp}` : ""}`, date: e.startedAt })),
      ...milestonesInWindow.map((m) => ({ text: m.text, date: m.observedAt }))
    ].slice(0, 8)
  };
  const questionsFallback = {
    questionsToAsk: [
      ...(parentConcerns || []).map((c) => ({ text: c, source: "parent" })),
      ...dueDoses.map((d) => ({ text: `Is ${displayName(d)} still on track for this visit?`, source: "due-vaccine" }))
    ].slice(0, 6)
  };

  const [recap, talkingPoints, questions] = await Promise.all([
    narrative.generateStructured({
      system: `Write the "Since Your Last Visit" recap for a parent preparing for ${childName}'s pediatrician visit. Write 120-180 words, chronological and concrete, dated where possible, using only the data given. Return JSON: {"sinceYourLastVisit": "..."}`,
      data: { childName, encounterSummaries, milestonesInWindow, caregiverNotes },
      fallback: recapFallback
    }),
    narrative.generateStructured({
      system: "List 5-8 short talking points the parent should mention to the doctor, each tied to a logged event with its date, ordered by likely clinical relevance then recency. Use only the data given. Return JSON: {\"talkingPoints\": [{\"text\": \"...\", \"date\": \"...\"}]}",
      data: { encounterSummaries, milestonesInWindow },
      fallback: talkingPointsFallback
    }),
    narrative.generateStructured({
      system: "Generate 4-6 questions the parent could ask the pediatrician, derived from patterns in the log, due vaccines, and any concerns the parent flagged. List parent-flagged concerns first. Return JSON: {\"questionsToAsk\": [{\"text\": \"...\", \"source\": \"parent|log|due-vaccine\"}]}",
      data: { parentConcerns: parentConcerns || [], dueDoses, encounterSummaries },
      fallback: questionsFallback
    })
  ]);

  return {
    parentPages: {
      // N5 (Parking-Lot Debrief): rendered verbatim + dated, never
      // model-generated or summarized -- this is a transcript of what the
      // PARENT remembers the doctor saying, not a clinical record. Omitted
      // entirely (not an empty section) when no debrief exists yet.
      fromLastVisit: latestDebrief
        ? { text: latestDebrief.debriefText, visitDate: latestDebrief.visitDate, recordedAt: latestDebrief.createdAt }
        : null,
      sinceYourLastVisit: recap.sinceYourLastVisit,
      talkingPoints: talkingPoints.talkingPoints || talkingPointsFallback.talkingPoints,
      questionsToAsk: questions.questionsToAsk || questionsFallback.questionsToAsk,
      tipsAndPrep: {
        whatToBring: ["Vaccine card", "Medication list with doses", "Insurance card"],
        dueVaccines: dueDoses.map((d) => displayName(d))
      }
    },
    doctorPages: {
      intervalSummaryTable: encounterSummaries,
      vitalsLog: vitalsEntries.map((e) => ({ recordedAt: e.recordedAt, title: e.title, label: e.label })),
      vaccineRecord: plainVaccineList(allDoses),
      caregiverNotesAppendix: caregiverNotes
    }
  };
}

module.exports = {
  buildMonthSection,
  buildHalfYearSection,
  buildYearSection,
  buildVisitPackSection
};
