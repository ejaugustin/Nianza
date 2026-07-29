// M16 (Family postcards), per NZA-POSTCARDS-v1.0 / v1.1-Seasonal (July 2026):
// a curated deck of visually distinct templates -- composition (photo shape,
// placement, whether an illustrated motif anchors the card) varies between
// templates, not just palette. Each `templateKey` maps to a hand-built React
// Native layout component shipped in the app (see
// MobileApp/src/components/postcards/registry.tsx) -- this content-library
// row is metadata only (which templates exist, their palette, their active
// date window for the seasonal/holiday tiers), never executable design
// content. Adding a template later means adding both a row here and a
// component in the app, same as today's content-review-free design content
// (postcard-template, generational-shift).
//
// `category` is "core" (always available, the default picker set),
// "seasonal" (secular, evergreen, safe for every family), or "holiday"
// (specific traditions -- opt-in only, browsed into via a second tab, never
// auto-suggested or defaulted, per DO NOT 22). `dateRange` is null for core
// templates (no gating) and a month/day window for seasonal/holiday ones,
// same wraparound convention as the old postcard-template dateRange (start >
// end wraps across the New Year).
//
// Lunar-calendar holiday windows (Hanukkah, Lunar New Year, Diwali) are
// seeded with real 2026 dates plus a few days' buffer and MUST be updated
// yearly by admin -- same operational pattern as the vaccine schedule's
// versioned publish. Flagged in docs/forward-looking-notes.md.
const POSTCARD_FRAMES = [
  // --- Core deck (NZA-POSTCARDS-v1.0): six structurally distinct layouts,
  // always available, no date gating. This is the picker's default set.
  {
    templateKey: "polaroid",
    category: "core",
    composition: "Tilted photo in a polaroid frame; handwritten-style caption beneath; small washi-tape corner accents.",
    bestFor: "General updates, casual moments",
    palette: ["#F4F0E8", "#34ABC4", "#C4714A"],
    dateRange: null
  },
  {
    templateKey: "arch",
    category: "core",
    composition: "Photo cropped into a tall arch; headline above; serif message below. Minimal, elegant.",
    bestFor: "Quieter milestones, portraits",
    palette: ["#F4F0E8", "#1D7A91"],
    dateRange: null
  },
  {
    templateKey: "full-bleed-banner",
    category: "core",
    composition: "Photo edge-to-edge; soft gradient scrim; bold headline overlaid on the bottom third.",
    bestFor: "Photo-forward, high-impact moments",
    palette: ["#1D7A91", "#0F3B47"],
    dateRange: null
  },
  {
    templateKey: "notecard",
    category: "core",
    composition: "Small circular photo inset like a wax seal; rest is a handwritten-style letter on cream stationery texture.",
    bestFor: "The most \"grandmother\" template -- reads as an actual letter",
    palette: ["#F4F0E8", "#C4714A"],
    dateRange: null
  },
  {
    templateKey: "filmstrip",
    category: "core",
    composition: "Several small sequential photos along one edge; one larger hero photo.",
    bestFor: "Updates with more than one photo",
    palette: ["#1D1D1D", "#34ABC4"],
    dateRange: null
  },
  {
    templateKey: "growth-line",
    category: "core",
    composition: "Thin illustrated dotted path with small milestone-icon markers along the bottom; photo on top.",
    bestFor: "Milestone-specific postcards -- a developmental visual idea built in",
    palette: ["#F4F0E8", "#34ABC4", "#1D7A91"],
    dateRange: null
  },

  // --- Seasonal tier (NZA-POSTCARDS-v1.1-Seasonal Section 1): secular,
  // evergreen, safe for every family. Date-gated, never defaulted.
  {
    templateKey: "autumn-leaves",
    category: "seasonal",
    composition: "Photo framed by a scattering of simple line-art leaves along one edge.",
    bestFor: "Fall moments",
    palette: ["#C1694F", "#A9673A", "#D9A441"],
    dateRange: { startMonth: 9, startDay: 15, endMonth: 11, endDay: 15 }
  },
  {
    templateKey: "winter-snow",
    category: "seasonal",
    composition: "Photo behind a light snowfall overlay; cool palette. The neutral December option for any family, regardless of what else they celebrate.",
    bestFor: "Winter, any family",
    palette: ["#EAF3F6", "#7C9CBF", "#2F5D50"],
    dateRange: { startMonth: 12, startDay: 1, endMonth: 2, endDay: 15 }
  },
  {
    templateKey: "spring-bloom",
    category: "seasonal",
    composition: "Photo cropped into a soft flower-petal shape; floral line art border.",
    bestFor: "Spring moments",
    palette: ["#7FB069", "#F4B4C6", "#F4F0E8"],
    dateRange: { startMonth: 3, startDay: 1, endMonth: 5, endDay: 31 }
  },
  {
    templateKey: "summer-sun",
    category: "seasonal",
    composition: "Full-bleed photo with a simple sun/wave motif along the bottom edge.",
    bestFor: "Summer moments",
    palette: ["#F4B942", "#34ABC4"],
    dateRange: { startMonth: 6, startDay: 1, endMonth: 8, endDay: 31 }
  },

  // --- Holiday tier (NZA-POSTCARDS-v1.1-Seasonal Section 2): specific
  // traditions, opt-in only -- parent must actively browse into this tab.
  // Original simple line art only, no licensed/trademarked holiday IP.
  {
    templateKey: "halloween",
    category: "holiday",
    composition: "Photo cropped into a simple pumpkin silhouette; gentle, not spooky.",
    bestFor: "Halloween",
    palette: ["#B85C38", "#2F5D50"],
    dateRange: { startMonth: 10, startDay: 1, endMonth: 10, endDay: 31 }
  },
  {
    templateKey: "christmas",
    category: "holiday",
    composition: "Photo framed with a simple ornament/string-light line-art border.",
    bestFor: "Christmas",
    palette: ["#2F5D50", "#C1694F", "#F4F0E8"],
    dateRange: { startMonth: 12, startDay: 1, endMonth: 12, endDay: 26 }
  },
  {
    templateKey: "hanukkah",
    category: "holiday",
    composition: "Photo beside a simple menorah line-art motif, blue/white/gold.",
    bestFor: "Hanukkah",
    palette: ["#2C5F8A", "#F4F0E8", "#D9A441"],
    // 2026: Dec 4 (sundown) - Dec 12. Admin-set yearly -- lunar-calendar dates.
    dateRange: { startMonth: 11, startDay: 30, endMonth: 12, endDay: 13 }
  },
  {
    templateKey: "lunar-new-year",
    category: "holiday",
    composition: "Photo framed with a simple lantern-string motif, red/gold.",
    bestFor: "Lunar New Year",
    palette: ["#C1372E", "#D9A441"],
    // 2026: Feb 17, celebrations through the Mar 3 Lantern Festival. Admin-set yearly.
    dateRange: { startMonth: 2, startDay: 10, endMonth: 3, endDay: 5 }
  },
  {
    templateKey: "diwali",
    category: "holiday",
    composition: "Photo framed with a simple diya (oil lamp) line-art motif, warm gold.",
    bestFor: "Diwali",
    palette: ["#D9A441", "#B85C38"],
    // 2026: Nov 8. Admin-set yearly -- lunar-calendar dates.
    dateRange: { startMonth: 11, startDay: 3, endMonth: 11, endDay: 13 }
  }
];

module.exports = { POSTCARD_FRAMES };
