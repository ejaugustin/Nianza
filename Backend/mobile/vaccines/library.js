const vaccineLibrary = require("./vaccines-en.json");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FLU_SEASON_START_MONTH = 7;
const FLU_DUE_MONTH = 9;
const FLU_SEASON_END_MONTH = 2;

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function monthsBetween(start, end) {
  const years = end.getUTCFullYear() - start.getUTCFullYear();
  const months = end.getUTCMonth() - start.getUTCMonth();
  const days = end.getUTCDate() - start.getUTCDate();
  return Math.max(0, years * 12 + months + days / 30.4375);
}

function chronologicalAgeMonths(child, now = new Date()) {
  const birthDate = parseDate(child.birthDate || child.childBirthDate);
  if (!birthDate) return typeof child.ageWindowMonths === "number" ? child.ageWindowMonths : 0;
  return monthsBetween(birthDate, now);
}

function profileAgeAtCreationMonths(child) {
  const birthDate = parseDate(child.birthDate || child.childBirthDate);
  const createdAt = parseDate(child.createdAt);
  if (!birthDate || !createdAt) return 0;
  return monthsBetween(birthDate, createdAt);
}

function profileCreatedAt(child) {
  return parseDate(child.createdAt) || null;
}

function allScheduledDoses() {
  return vaccineLibrary.series.flatMap((series) =>
    series.doses.map((dose) => ({
      ...dose,
      vaccineId: series.vaccineId,
      name: series.name,
      fullName: series.fullName,
      dosePosition: `${dose.doseNum} of ${series.doses.length}`
    }))
  );
}

function informationalRows() {
  return vaccineLibrary.informational || vaccineLibrary.informationalRows || vaccineLibrary.infoRows || vaccineLibrary.information || [];
}

function latestRecordByDose(records = []) {
  const latest = new Map();
  records.forEach((record) => {
    const doseId = record.doseId;
    if (!doseId || record.deleted) return;
    const existing = latest.get(doseId);
    if (!existing || String(record.updatedAt || record.recordedAt || "") > String(existing.updatedAt || existing.recordedAt || "")) {
      latest.set(doseId, record);
    }
  });
  return latest;
}

function seasonYearFor(now = new Date()) {
  const month = now.getUTCMonth();
  return month >= FLU_SEASON_START_MONTH ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function currentFluDose(now = new Date()) {
  const seasonYear = seasonYearFor(now);
  const seasonStart = new Date(Date.UTC(seasonYear, FLU_SEASON_START_MONTH, 1));
  const dueStart = new Date(Date.UTC(seasonYear, FLU_DUE_MONTH, 1));
  const seasonEnd = new Date(Date.UTC(seasonYear + 1, FLU_SEASON_END_MONTH + 1, 1));
  const ageAtSeasonStart = 6;
  return {
    doseId: `VX-FLU-${seasonYear}`,
    vaccineId: "FLU",
    name: "Flu",
    fullName: "Influenza",
    doseNum: 1,
    dosePosition: "seasonal dose",
    windowStartMonths: ageAtSeasonStart,
    windowEndMonths: 72,
    displayGroup: "Every year",
    note: "One dose each season starting at 6 months; two doses the first season for some children - your doctor will say",
    seasonal: true,
    seasonYear,
    seasonStart,
    dueStart,
    seasonEnd
  };
}

function statusForDose(dose, { ageMonths, profileCreatedAgeMonths, profileCreatedDate, record, now = new Date() }) {
  if (record) return "recorded";

  if (dose.seasonal) {
    if (ageMonths < 6 || now < dose.seasonStart || now >= dose.seasonEnd) return "future";
    if (profileCreatedDate && profileCreatedDate > dose.dueStart) return "unrecorded";
    if (now >= dose.dueStart) return "due";
    return "upcoming";
  }

  const preProfileWindowClosed = dose.windowEndMonths < profileCreatedAgeMonths;
  if (preProfileWindowClosed) return "unrecorded";
  if (ageMonths >= dose.windowStartMonths) return "due";
  if (dose.windowStartMonths - ageMonths <= 2) return "upcoming";
  return "future";
}

function serializeDose(dose, status, record) {
  return {
    doseId: dose.doseId,
    vaccineId: dose.vaccineId,
    name: dose.name,
    fullName: dose.fullName,
    doseNum: dose.doseNum,
    dosePosition: dose.dosePosition,
    displayGroup: dose.displayGroup,
    windowStartMonths: dose.windowStartMonths,
    windowEndMonths: dose.windowEndMonths,
    note: dose.note || null,
    status,
    givenOn: record?.givenOn || null,
    backfilled: Boolean(record?.backfilled),
    parentNote: record?.note || null,
    seasonYear: dose.seasonYear || null
  };
}

function buildVaccineProgress({ child, records = [], now = new Date() }) {
  const ageMonths = chronologicalAgeMonths(child, now);
  const profileCreatedAgeMonths = profileAgeAtCreationMonths(child);
  const profileCreatedDate = profileCreatedAt(child);
  const latest = latestRecordByDose(records);
  const fluDose = currentFluDose(now);
  const scheduledDoses = allScheduledDoses().filter((dose) => dose.doseId !== "VX-FLU-SEASON");
  const allDoses = ageMonths >= 6 ? [...scheduledDoses, fluDose] : scheduledDoses;
  const doses = allDoses.map((dose) => {
    const record = latest.get(dose.doseId);
    return serializeDose(dose, statusForDose(dose, { ageMonths, profileCreatedAgeMonths, profileCreatedDate, record, now }), record);
  });

  const groups = [];
  doses.forEach((dose) => {
    let group = groups.find((item) => item.displayGroup === dose.displayGroup);
    if (!group) {
      group = { displayGroup: dose.displayGroup, doses: [] };
      groups.push(group);
    }
    group.doses.push(dose);
  });

  const trackedDueCount = doses.filter((dose) => dose.status === "due").length;
  const shouldOfferBackfill = doses.some((dose) => dose.status === "unrecorded") && !child.vaccineBackfillOffered;

  return {
    childId: child.childId,
    scheduleVersion: vaccineLibrary.version,
    sourceVerifiedBy: vaccineLibrary.sourceVerifiedBy || null,
    ageBasis: "chronological",
    ageMonths: Math.round(ageMonths * 10) / 10,
    vaccineStatus: trackedDueCount > 0 ? "due" : "up-to-date",
    dueCount: trackedDueCount,
    shouldOfferBackfill,
    groups,
    informationalRows: informationalRows()
  };
}

function findDose(doseId) {
  if (!doseId) return null;
  if (/^VX-FLU-\d{4}$/.test(doseId)) return currentFluDose(new Date(`${doseId.slice(-4)}-10-01T00:00:00.000Z`));
  return allScheduledDoses().find((dose) => dose.doseId === doseId) || null;
}

module.exports = {
  buildVaccineProgress,
  findDose,
  _private: {
    chronologicalAgeMonths,
    profileAgeAtCreationMonths,
    statusForDose
  }
};
