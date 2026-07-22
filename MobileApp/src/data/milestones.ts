import rawMilestones from "./milestones-en.json";

export type MilestoneTab = "Movement" | "Language" | "Social" | "Cognitive" | "Self-Care";

export type MilestoneDefinition = {
  milestoneId: string;
  text: string;
  domain: string;
  tab: Exclude<MilestoneTab, "Self-Care">;
  selfCare: boolean;
};

export type ActEarlyItem = {
  actEarlyId: string;
  text: string;
};

export type MilestoneWindow = {
  ageKey: string;
  label: string;
  windowEndMonths: number;
  milestones: MilestoneDefinition[];
  actEarly: ActEarlyItem[];
};

type MilestoneLibrary = {
  version: string;
  source: string;
  language: string;
  windows: MilestoneWindow[];
};

export const milestoneDomains: MilestoneTab[] = ["Movement", "Language", "Social", "Cognitive", "Self-Care"];
export const milestoneLibrary = rawMilestones as MilestoneLibrary;

export function getEffectiveAgeMonths(ageWindowMonths?: number | null, bornEarly?: boolean, weeksEarly?: number | null) {
  const chronologicalAge = typeof ageWindowMonths === "number" && Number.isFinite(ageWindowMonths) ? ageWindowMonths : 4;
  if (!bornEarly || !weeksEarly) return Math.max(0, chronologicalAge);
  return Math.max(0, chronologicalAge - weeksEarly / 4.345);
}

export function getCurrentMilestoneWindow(ageWindowMonths?: number | null, bornEarly?: boolean, weeksEarly?: number | null) {
  const effectiveAge = getEffectiveAgeMonths(ageWindowMonths, bornEarly, weeksEarly);
  return (
    milestoneLibrary.windows.find((window) => window.windowEndMonths >= effectiveAge) ||
    milestoneLibrary.windows[milestoneLibrary.windows.length - 1]
  );
}

export function getMilestonesForTab(window: MilestoneWindow, tab: MilestoneTab) {
  if (tab === "Self-Care") return window.milestones.filter((milestone) => milestone.selfCare);
  return window.milestones.filter((milestone) => milestone.tab === tab);
}

export function getSourceLabel() {
  return "CDC LTSAE";
}
