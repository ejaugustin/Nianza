const library = require("./milestones-en.json");

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date, months) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const next = new Date(Date.UTC(year, month + months, day));
  if (next.getUTCDate() !== day) next.setUTCDate(0);
  return next;
}

function monthsBetween(start, end) {
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
  months += end.getUTCMonth() - start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

function childBirthDate(child) {
  return parseDate(child.birthDate || child.childBirthDate);
}

function correctedBirthDate(child) {
  const birthDate = childBirthDate(child);
  if (!birthDate) return null;
  const bornEarly = child.bornEarly === true || child.bornEarly === "true";
  const weeksEarly = Number(child.weeksEarly ?? child.prematurityWeeks ?? 0);
  return bornEarly && Number.isFinite(weeksEarly) && weeksEarly > 0
    ? addDays(birthDate, weeksEarly * 7)
    : birthDate;
}

function effectiveAgeMonths(child, now = new Date()) {
  const explicitCorrectedAge = Number(child.correctedAgeMonths);
  if (Number.isFinite(explicitCorrectedAge)) return Math.max(0, explicitCorrectedAge);

  const explicitAge = Number(child.ageMonths ?? child.ageWindowMonths);
  const birthDate = correctedBirthDate(child);
  if (birthDate) return monthsBetween(birthDate, now);
  return Number.isFinite(explicitAge) ? Math.max(0, explicitAge) : 0;
}

function currentWindowForAge(ageMonths) {
  return library.windows.find((window) => window.windowEndMonths >= ageMonths) || library.windows.at(-1);
}

function windowEndDate(child, window) {
  const birthDate = correctedBirthDate(child);
  if (!birthDate) return null;
  return addMonths(birthDate, window.windowEndMonths);
}

function trackedFromDate(child, now = new Date()) {
  return parseDate(child.createdAt || child.profileCreatedAt || child.onboardingCompletedAt) || now;
}

function isWindowTracked(child, window, now = new Date()) {
  const endDate = windowEndDate(child, window);
  if (!endDate) return true;
  return endDate.getTime() >= trackedFromDate(child, now).getTime();
}

function latestProgressByMilestone(progressItems = []) {
  const byMilestone = new Map();
  for (const item of progressItems) {
    if (!item?.milestoneId) continue;
    const current = byMilestone.get(item.milestoneId);
    if (!current || String(item.observedAt || "").localeCompare(String(current.observedAt || "")) > 0) {
      byMilestone.set(item.milestoneId, item);
    }
  }
  return byMilestone;
}

function findMilestone(milestoneId) {
  for (const window of library.windows) {
    const milestone = window.milestones.find((item) => item.milestoneId === milestoneId);
    if (milestone) return { window, milestone };
  }
  return null;
}

function serializeMilestone(milestone, progress, extra = {}) {
  return {
    milestoneId: milestone.milestoneId,
    text: milestone.text,
    domain: milestone.domain,
    tab: milestone.tab,
    selfCare: Boolean(milestone.selfCare),
    status: progress ? "observed" : "unobserved",
    observedAt: progress?.observedAt || null,
    backfilled: Boolean(progress?.backfilled),
    photoUrls: Array.isArray(progress?.photoUrls) ? progress.photoUrls : [],
    ...extra
  };
}

function buildMilestoneProgress({ child, progressItems = [], now = new Date() }) {
  const ageMonths = effectiveAgeMonths(child, now);
  const currentWindow = currentWindowForAge(ageMonths);
  const progressByMilestone = latestProgressByMilestone(progressItems);
  const notTrackedWindows = library.windows
    .filter((window) => window.windowEndMonths < currentWindow.windowEndMonths && !isWindowTracked(child, window, now))
    .map((window) => window.ageKey);

  const rolledOver = library.windows
    .filter((window) => window.windowEndMonths < currentWindow.windowEndMonths && isWindowTracked(child, window, now))
    .flatMap((window) => window.milestones
      .filter((milestone) => !progressByMilestone.has(milestone.milestoneId))
      .map((milestone) => serializeMilestone(milestone, null, {
        originWindow: window.ageKey,
        originLabel: window.label
      })));

  return {
    libraryVersion: library.version,
    source: library.source,
    childId: child.childId,
    childCreatedAt: child.createdAt || null,
    effectiveAgeMonths: ageMonths,
    currentWindow: {
      ageKey: currentWindow.ageKey,
      label: currentWindow.label,
      windowEndMonths: currentWindow.windowEndMonths,
      milestones: currentWindow.milestones.map((milestone) => (
        serializeMilestone(milestone, progressByMilestone.get(milestone.milestoneId))
      )),
      actEarly: currentWindow.actEarly || []
    },
    rolledOver,
    notTrackedWindows,
    backfillOffered: Boolean(child.backfillOffered),
    shouldOfferBackfill: notTrackedWindows.length > 0 && !child.backfillOffered
  };
}

module.exports = {
  library,
  buildMilestoneProgress,
  currentWindowForAge,
  effectiveAgeMonths,
  findMilestone,
  isWindowTracked,
  latestProgressByMilestone
};
