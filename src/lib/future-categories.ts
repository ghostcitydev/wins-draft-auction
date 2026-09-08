/**
 * Fixed list of "futures" categories - preseason picks that aren't tied to
 * any one game (see the `future_picks` table). Two groups: the playoff
 * bracket (seeds + conference champs + Super Bowl champ) and award
 * categories (MVP, Coach of the Year, etc). This is a side-by-side
 * comparison feature only - there's no real data source to grade most of
 * these against (nobody's syncing "NFL MVP" from ESPN), so picks are never
 * scored, just displayed.
 */
export type FutureCategoryType = "team" | "text";

export interface FutureCategory {
  key: string;
  label: string;
  type: FutureCategoryType;
  /** For "team" categories, restricts the team picker to one conference. */
  conference?: "AFC" | "NFC";
  group: "Playoff Bracket" | "Awards";
}

const afcSeeds: FutureCategory[] = Array.from({ length: 7 }, (_, i) => ({
  key: `afc_seed_${i + 1}`,
  label: `AFC #${i + 1} Seed`,
  type: "team",
  conference: "AFC",
  group: "Playoff Bracket",
}));

const nfcSeeds: FutureCategory[] = Array.from({ length: 7 }, (_, i) => ({
  key: `nfc_seed_${i + 1}`,
  label: `NFC #${i + 1} Seed`,
  type: "team",
  conference: "NFC",
  group: "Playoff Bracket",
}));

export const FUTURE_CATEGORIES: FutureCategory[] = [
  ...afcSeeds,
  ...nfcSeeds,
  { key: "afc_champion", label: "AFC Champion", type: "team", conference: "AFC", group: "Playoff Bracket" },
  { key: "nfc_champion", label: "NFC Champion", type: "team", conference: "NFC", group: "Playoff Bracket" },
  { key: "super_bowl_champion", label: "Super Bowl Champion", type: "team", group: "Playoff Bracket" },
  { key: "mvp", label: "NFL MVP", type: "text", group: "Awards" },
  { key: "opoy", label: "Offensive Player of the Year", type: "text", group: "Awards" },
  { key: "dpoy", label: "Defensive Player of the Year", type: "text", group: "Awards" },
  { key: "comeback_poy", label: "Comeback Player of the Year", type: "text", group: "Awards" },
  { key: "coach_of_year", label: "Coach of the Year", type: "text", group: "Awards" },
  { key: "fantasy_mvp", label: "Fantasy MVP", type: "text", group: "Awards" },
  { key: "first_coach_fired", label: "First Coach Fired", type: "text", group: "Awards" },
  { key: "worst_to_first", label: "Worst to First Team", type: "team", group: "Awards" },
  { key: "first_to_worst", label: "First to Worst Team", type: "team", group: "Awards" },
];

export const FUTURE_CATEGORY_GROUPS: FutureCategory["group"][] = ["Playoff Bracket", "Awards"];

export const FUTURE_CATEGORY_BY_KEY: Record<string, FutureCategory> = Object.fromEntries(
  FUTURE_CATEGORIES.map((c) => [c.key, c])
);
