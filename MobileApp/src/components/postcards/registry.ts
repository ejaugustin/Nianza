// NZA-POSTCARDS-v1.0 Section 3 + NZA-POSTCARDS-v1.1-Seasonal Section 3: maps
// each backend `postcard-frame` row's templateKey to its hand-built render
// component. The row is metadata (palette, composition blurb, date window)
// for the picker; the component is the actual design, built once here, not
// generated per send.
import type { PostcardDateRange } from "@/api/content";
import {
  ArchTemplate,
  FilmstripTemplate,
  FullBleedBannerTemplate,
  GrowthLineTemplate,
  NotecardTemplate,
  PolaroidTemplate
} from "./core-templates";
import {
  ChristmasTemplate,
  DiwaliTemplate,
  HalloweenTemplate,
  HanukkahTemplate,
  LunarNewYearTemplate
} from "./holiday-templates";
import {
  AutumnLeavesTemplate,
  SpringBloomTemplate,
  SummerSunTemplate,
  WinterSnowTemplate
} from "./seasonal-templates";
import type { PostcardTemplateComponent } from "./types";

export const CORE_TEMPLATE_KEYS = ["polaroid", "arch", "full-bleed-banner", "notecard", "filmstrip", "growth-line"] as const;
export const SEASONAL_TEMPLATE_KEYS = ["autumn-leaves", "winter-snow", "spring-bloom", "summer-sun"] as const;
export const HOLIDAY_TEMPLATE_KEYS = ["halloween", "christmas", "hanukkah", "lunar-new-year", "diwali"] as const;

export const TEMPLATE_COMPONENTS: Record<string, PostcardTemplateComponent> = {
  polaroid: PolaroidTemplate,
  arch: ArchTemplate,
  "full-bleed-banner": FullBleedBannerTemplate,
  notecard: NotecardTemplate,
  filmstrip: FilmstripTemplate,
  "growth-line": GrowthLineTemplate,
  "autumn-leaves": AutumnLeavesTemplate,
  "winter-snow": WinterSnowTemplate,
  "spring-bloom": SpringBloomTemplate,
  "summer-sun": SummerSunTemplate,
  halloween: HalloweenTemplate,
  christmas: ChristmasTemplate,
  hanukkah: HanukkahTemplate,
  "lunar-new-year": LunarNewYearTemplate,
  diwali: DiwaliTemplate
};

// The one core template offered if the content-library fetch fails or is
// still loading -- compose must never be blocked on a network call for the
// default deck (v1.0 keeps this fully on-device).
export const DEFAULT_CORE_TEMPLATE_KEY: (typeof CORE_TEMPLATE_KEYS)[number] = "polaroid";

/** Date-window gate for Seasonal & Holiday tab visibility (v1.1 Section 3):
 * only templates currently inside their window show up; nothing is
 * backfilled outside season, and this list is never used to pick a default. */
export function isWithinDateWindow(range: PostcardDateRange | null, now: Date): boolean {
  if (!range) return true;
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const value = month * 100 + day;
  const start = range.startMonth * 100 + range.startDay;
  const end = range.endMonth * 100 + range.endDay;
  // Ranges that wrap the new year (e.g. Winter Snow: Dec 1 - Feb 15).
  if (start > end) return value >= start || value <= end;
  return value >= start && value <= end;
}
