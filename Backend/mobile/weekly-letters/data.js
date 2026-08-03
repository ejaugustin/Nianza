// Reuses the reports feature's fetch helpers directly rather than
// duplicating DynamoDB query logic -- vitals/milestone windowed queries,
// dose/encounter fetch-then-filter, are exactly the same shape here as in
// mobile/reports/data.js.
const reportData = require("../reports/data");

async function fetchWeekData({ documentClient, tables, childId, weekStartDate, weekEndDate }) {
  const [vitalsEntries, milestoneObservations, allEncounters, allDoses] = await Promise.all([
    reportData.fetchVitalsInRange(documentClient, tables.VITALS_TABLE, childId, weekStartDate, weekEndDate),
    reportData.fetchMilestonesInRange(documentClient, tables.MILESTONES_TABLE, childId, weekStartDate, weekEndDate),
    reportData.fetchAllEncounters(documentClient, tables.SICK_ENCOUNTERS_TABLE, childId),
    reportData.fetchAllVaccineDoses(documentClient, tables.VACCINES_TABLE, childId)
  ]);

  const encountersInWindow = allEncounters.filter((e) => reportData.encounterOverlapsRange(e, weekStartDate, weekEndDate));
  const dosesInWindow = allDoses.filter((d) => d.givenOn && d.givenOn >= weekStartDate.slice(0, 10) && d.givenOn <= weekEndDate.slice(0, 10));

  return { vitalsEntries, milestoneObservations, encountersInWindow, dosesInWindow };
}

// Addendum A SS3.1: the model needs texture (specific labels/notes), not
// counts. Each entry keeps its type, a human label, freeform note text where
// present, and a date -- nothing else, so the prompt payload stays compact.
function buildWeekItems({ vitalsEntries, milestoneObservations, encountersInWindow, dosesInWindow }) {
  const items = [];

  for (const entry of vitalsEntries) {
    items.push({
      type: entry.entryType,
      label: entry.label || entry.title,
      note: entry.note || null,
      date: (entry.entryId || "").split("#")[0] || entry.recordedAt || null
    });
  }

  for (const observation of milestoneObservations) {
    items.push({
      type: observation.milestoneId && String(observation.milestoneId).startsWith("custom#") ? "custom-first" : "milestone",
      label: observation.customName || observation.milestoneName || observation.milestoneId,
      note: null,
      date: observation.observedAt
    });
  }

  for (const encounter of encountersInWindow) {
    items.push({
      type: "sick-encounter",
      label: encounter.name || "Sick day",
      note: null,
      date: encounter.startedAt
    });
  }

  for (const dose of dosesInWindow) {
    items.push({
      type: "vaccine-dose",
      label: dose.vaccineName || dose.doseId,
      note: null,
      date: dose.givenOn
    });
  }

  items.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  return items;
}

module.exports = { fetchWeekData, buildWeekItems };
