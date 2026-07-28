const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
const milestonesLibrary = require("../milestones/library");
const vitalsLibrary = require("../vitals/library");

// Vitals entryId is `${recordedAt}#${uuid}`, and ISO-8601 timestamps sort
// correctly as strings, so a plain BETWEEN on the sort key gives us a real
// date-range query instead of a full scan-and-filter.
async function fetchVitalsInRange(documentClient, table, childId, startDate, endDate) {
  if (!table) return [];
  const result = await documentClient.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: "childId = :childId AND entryId BETWEEN :start AND :end",
    ExpressionAttributeValues: {
      ":childId": childId,
      ":start": startDate,
      ":end": `${endDate}#￿`
    }
  }));
  return (result.Items || []).map(vitalsLibrary.serializeEntry);
}

async function fetchMilestonesInRange(documentClient, table, childId, startDate, endDate) {
  if (!table) return [];
  const result = await documentClient.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: "childId = :childId AND observedAt BETWEEN :start AND :end",
    ExpressionAttributeValues: {
      ":childId": childId,
      ":start": startDate,
      ":end": endDate
    }
  }));
  return (result.Items || []).filter((item) => !item.cleared && item.progressType !== "watch-for");
}

// Doses aren't stored sorted by date (the sort key is doseId), so fetch the
// whole small per-child list and filter/sort here.
async function fetchAllVaccineDoses(documentClient, table, childId) {
  if (!table) return [];
  const result = await documentClient.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: "childId = :childId",
    ExpressionAttributeValues: { ":childId": childId }
  }));
  return (result.Items || []).sort((a, b) => String(a.givenOn || "").localeCompare(String(b.givenOn || "")));
}

async function fetchAllEncounters(documentClient, table, childId) {
  if (!table) return [];
  const result = await documentClient.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: "childId = :childId",
    ExpressionAttributeValues: { ":childId": childId }
  }));
  return result.Items || [];
}

function encounterOverlapsRange(encounter, startDate, endDate) {
  const start = encounter.startedAt || "";
  const end = encounter.endedAt || new Date().toISOString();
  return start <= endDate && end >= startDate;
}

function milestoneDomain(milestoneId) {
  const found = milestonesLibrary.findMilestone(milestoneId);
  return found ? { domain: found.milestone.domain, tab: found.milestone.tab, text: found.milestone.text } : null;
}

function isGrowthEntry(entry) {
  return vitalsLibrary.GROWTH_TYPES.has(entry.entryType);
}

function isCaregiverNote(entry) {
  return Boolean(entry.note) && entry.entryType !== "temperature";
}

// N5 (Parking-Lot Debrief): debriefId embeds an ISO timestamp
// (`${now}#${uuid}`), so it sorts correctly as a string -- same trick as
// vitals entryId -- letting ScanIndexForward:false + Limit:1 give us the
// single most recent debrief without a full table scan.
async function fetchLatestDebrief(documentClient, table, childId) {
  if (!table) return null;
  const result = await documentClient.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: "childId = :childId",
    ExpressionAttributeValues: { ":childId": childId },
    ScanIndexForward: false,
    Limit: 1
  }));
  return (result.Items || [])[0] || null;
}

module.exports = {
  fetchVitalsInRange,
  fetchMilestonesInRange,
  fetchAllVaccineDoses,
  fetchAllEncounters,
  fetchLatestDebrief,
  encounterOverlapsRange,
  milestoneDomain,
  isGrowthEntry,
  isCaregiverNote
};
