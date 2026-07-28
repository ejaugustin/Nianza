// Addendum A, Section 1: the three progress reports are calendar-anchored;
// the Visit Pack is visit-anchored. Each period resolves to a concrete
// {startDate, endDate} window plus a human label used throughout the report
// and in the H2 options sheet ("Covering everything since your July 3
// visit.").

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
}

function monthsAgo(date, months) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() - months);
  return result.toISOString();
}

function daysAgo(date, days) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function formatShort(iso) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));
}

function formatLong(iso) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric" }).format(new Date(iso));
}

// options.periodMonth: "YYYY-MM" for a specific past month; options.lastVisitDate:
// ISO date string if the parent has one on file (there is no Visit Planner
// backend yet, so this normally comes from nowhere and the Visit Pack falls
// back to 90 days, exactly as Addendum A section 1 permits).
function resolvePeriodWindow(period, options = {}, now = new Date()) {
  if (period === "halfyear") {
    const startDate = monthsAgo(now, 6);
    return {
      period,
      startDate,
      endDate: now.toISOString(),
      windowLabel: `${formatShort(startDate)} - ${formatShort(now.toISOString())}`,
      isFallbackWindow: false
    };
  }

  if (period === "year") {
    const startDate = monthsAgo(now, 12);
    return {
      period,
      startDate,
      endDate: now.toISOString(),
      windowLabel: `${formatShort(startDate)} - ${formatShort(now.toISOString())}`,
      isFallbackWindow: false
    };
  }

  if (period === "visit") {
    if (options.lastVisitDate) {
      const startDate = new Date(options.lastVisitDate).toISOString();
      return {
        period,
        startDate,
        endDate: now.toISOString(),
        windowLabel: `Since your ${formatLong(startDate)} visit`,
        isFallbackWindow: false
      };
    }
    const startDate = daysAgo(now, 90);
    return {
      period,
      startDate,
      endDate: now.toISOString(),
      windowLabel: "Last 90 days (no previous visit on file)",
      isFallbackWindow: true
    };
  }

  // "month" (default): a specific calendar month if periodMonth is given,
  // otherwise the current month to date.
  if (options.periodMonth && /^\d{4}-\d{2}$/.test(options.periodMonth)) {
    const [year, month] = options.periodMonth.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const endExclusive = new Date(Date.UTC(year, month, 1));
    const endDate = endExclusive > now ? now.toISOString() : new Date(endExclusive.getTime() - 1000).toISOString();
    return {
      period: "month",
      startDate,
      endDate,
      windowLabel: new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(startDate)),
      isFallbackWindow: false
    };
  }

  const startDate = startOfMonth(now);
  return {
    period: "month",
    startDate,
    endDate: now.toISOString(),
    windowLabel: new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(now),
    isFallbackWindow: false
  };
}

module.exports = { resolvePeriodWindow, formatShort, formatLong };
