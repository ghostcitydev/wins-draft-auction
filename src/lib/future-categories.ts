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
  /** Shorter form used for the narrow comparison-table column - falls back
   * to `label` when omitted. The form always shows the full `label`. */
  shortLabel?: string;
  type: FutureCategoryType;
  /** For "team" categories, restricts the team picker to one conference. */
  conference?: "AFC" | "NFC";
  group: "Playoff Bracket" | "Awards";
}

const afcSeeds: FutureCategory[] = Array.from({ length: 7 }, (_, i) => ({
  key: `afc_seed_${i + 1}`,
  label: `AFC #${i + 1} Seed`,
  shortLabel: `AFC #${i + 1}`,
  type: "team",
  conference: "AFC",
  group: "Playoff Bracket",
}));

const nfcSeeds: FutureCategory[] = Array.from({ length: 7 }, (_, i) => ({
  key: `nfc_seed_${i + 1}`,
  label: `NFC #${i + 1} Seed`,
  shortLabel: `NFC #${i + 1}`,
  type: "team",
  conference: "NFC",
  group: "Playoff Bracket",
}));

export const FUTURE_CATEGORIES: FutureCategory[] = [
  ...afcSeeds,
  ...nfcSeeds,
  { key: "afc_champion", label: "AFC Champion", shortLabel: "AFC Champ", type: "team", conference: "AFC", group: "Playoff Bracket" },
  { key: "nfc_champion", label: "NFC Champion", shortLabel: "NFC Champ", type: "team", conference: "NFC", group: "Playoff Bracket" },
  { key: "super_bowl_champion", label: "Super Bowl Champion", shortLabel: "SB Champ", type: "team", group: "Playoff Bracket" },
  { key: "mvp", label: "NFL MVP", shortLabel: "MVP", type: "text", group: "Awards" },
  { key: "opoy", label: "Offensive Player of the Year", shortLabel: "OPOY", type: "text", group: "Awards" },
  { key: "dpoy", label: "Defensive Player of the Year", shortLabel: "DPOY", type: "text", group: "Awards" },
  { key: "comeback_poy", label: "Comeback Player of the Year", shortLabel: "CPOY", type: "text", group: "Awards" },
  { key: "coach_of_year", label: "Coach of the Year", shortLabel: "COY", type: "text", group: "Awards" },
  { key: "fantasy_mvp", label: "Fantasy MVP", shortLabel: "Fantasy MVP", type: "text", group: "Awards" },
  { key: "first_coach_fired", label: "First Coach Fired", shortLabel: "1st Fired", type: "text", group: "Awards" },
  { key: "worst_to_first", label: "Worst to First Team", shortLabel: "Worst→First", type: "team", group: "Awards" },
  { key: "first_to_worst", label: "First to Worst Team", shortLabel: "First→Worst", type: "team", group: "Awards" },
];

export const FUTURE_CATEGORY_GROUPS: FutureCategory["group"][] = ["Playoff Bracket", "Awards"];

export const FUTURE_CATEGORY_BY_KEY: Record<string, FutureCategory> = Object.fromEntries(
  FUTURE_CATEGORIES.map((c) => [c.key, c])
);
