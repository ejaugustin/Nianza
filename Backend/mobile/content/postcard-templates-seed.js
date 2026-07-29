// M16 (Family postcards): a small fixed library of card designs. Each
// template is a color theme + a caption format string with {childName} /
// {milestoneText} placeholders -- the actual postcard is assembled
// client-side from real milestone/photo data the same way N4's grandparent
// note is (deterministic template + real data, never AI-generated copy).
//
// `season` + `dateRange` are optional. Evergreen templates (season: null)
// are always eligible. Seasonal templates are only surfaced by the client
// while today's date falls inside dateRange (month/day, 1-indexed,
// inclusive; a range where start > end wraps across the New Year, e.g.
// Dec 1 - Jan 5). Nothing here is a notification or a nudge -- these only
// change which designs the parent sees when they open the postcard compose
// screen on their own.
const POSTCARD_TEMPLATES = [
  {
    templateId: "warm-sunrise",
    colorTheme: "#F2A65A",
    captionFormat: "{childName} just {milestoneText}. Had to share.",
    season: null,
    dateRange: null
  },
  {
    templateId: "soft-sage",
    colorTheme: "#8FA998",
    captionFormat: "A little update from {childName}: {milestoneText}.",
    season: null,
    dateRange: null
  },
  {
    templateId: "dusty-blue",
    colorTheme: "#7C9CBF",
    captionFormat: "Thought you'd want to see this -- {childName} {milestoneText}.",
    season: null,
    dateRange: null
  },
  {
    templateId: "terracotta-clay",
    colorTheme: "#C1694F",
    captionFormat: "{childName}'s latest: {milestoneText}.",
    season: null,
    dateRange: null
  },
  {
    templateId: "soft-lilac",
    colorTheme: "#9B8AC4",
    captionFormat: "Sending a little joy your way -- {childName} {milestoneText}.",
    season: null,
    dateRange: null
  },
  {
    templateId: "back-to-school",
    colorTheme: "#D9A441",
    captionFormat: "{childName} is off to a new year -- {milestoneText}.",
    season: "back-to-school",
    dateRange: { startMonth: 8, startDay: 1, endMonth: 9, endDay: 15 }
  },
  {
    templateId: "harvest-thanks",
    colorTheme: "#A9673A",
    captionFormat: "Grateful for this one -- {childName} {milestoneText}.",
    season: "thanksgiving",
    dateRange: { startMonth: 11, startDay: 1, endMonth: 11, endDay: 30 }
  },
  {
    templateId: "winter-lights",
    colorTheme: "#2F5D50",
    captionFormat: "Sending holiday cheer -- {childName} {milestoneText}.",
    season: "winter-holidays",
    dateRange: { startMonth: 12, startDay: 1, endMonth: 1, endDay: 5 }
  },
  {
    templateId: "fresh-start",
    colorTheme: "#3B4C6B",
    captionFormat: "Kicking off the year with this -- {childName} {milestoneText}.",
    season: "new-year",
    dateRange: { startMonth: 1, startDay: 1, endMonth: 1, endDay: 15 }
  },
  {
    templateId: "little-valentine",
    colorTheme: "#D46A85",
    captionFormat: "A little love note -- {childName} {milestoneText}.",
    season: "valentines",
    dateRange: { startMonth: 2, startDay: 1, endMonth: 2, endDay: 14 }
  },
  {
    templateId: "spring-bloom",
    colorTheme: "#7FB069",
    captionFormat: "Spring update from {childName}: {milestoneText}.",
    season: "spring",
    dateRange: { startMonth: 3, startDay: 15, endMonth: 5, endDay: 15 }
  },
  {
    templateId: "sunny-days",
    colorTheme: "#F4B942",
    captionFormat: "Summer with {childName}: {milestoneText}.",
    season: "summer",
    dateRange: { startMonth: 6, startDay: 1, endMonth: 8, endDay: 15 }
  },
  {
    templateId: "pumpkin-patch",
    colorTheme: "#B85C38",
    captionFormat: "A little Halloween update -- {childName} {milestoneText}.",
    season: "halloween",
    dateRange: { startMonth: 10, startDay: 1, endMonth: 10, endDay: 31 }
  }
];

module.exports = { POSTCARD_TEMPLATES };
