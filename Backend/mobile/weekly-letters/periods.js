// NZA-WEEKLY-LETTER-v1.0: week windows are anchored to Sunday 00:00 UTC.
// The generation job runs Sunday 6pm Eastern, so "now" on a normal run falls
// on the Sunday that ends the window -- resolveWeekWindow(now) always
// returns [most-recent-Sunday-at-or-before-now minus 7 days, that Sunday),
// i.e. the week that just finished.
function startOfWeekUTC(date) {
  const truncated = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = truncated.getUTCDay(); // 0 = Sunday
  truncated.setUTCDate(truncated.getUTCDate() - day);
  return truncated;
}

function formatShort(iso) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));
}

function resolveWeekWindow(now = new Date()) {
  const thisSunday = startOfWeekUTC(now);
  const lastSunday = new Date(thisSunday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekStartDate = lastSunday.toISOString();
  const weekEndDate = thisSunday.toISOString();
  return {
    weekStartDate,
    weekEndDate,
    weekStartDateKey: weekStartDate.slice(0, 10),
    windowLabel: `${formatShort(weekStartDate)} - ${formatShort(new Date(thisSunday.getTime() - 1000).toISOString())}`
  };
}

function letterIdFor(childId, weekStartDateKey) {
  return `weekly-letter#${childId}#${weekStartDateKey}`;
}

module.exports = { resolveWeekWindow, letterIdFor, formatShort };
