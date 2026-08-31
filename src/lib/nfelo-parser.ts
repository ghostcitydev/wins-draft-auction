import { ABBR_ALIASES } from "./team-aliases";

export interface ParsedNfeloRow {
  abbr: string;
  nfeloRating: number | null;
  qbAdj: number | null;
  value: number | null;
  wow: number | null;
  ytd: number | null;
  offPlay: number | null;
  offPass: number | null;
  offRush: number | null;
  defPlay: number | null;
  defPass: number | null;
  defRush: number | null;
  epaPlay: number | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
  diff: number | null;
  wins: number | null;
  pythagWins: number | null;
  elo: number | null;
  film: number | null;
}

export interface NfeloParseResult {
  rows: ParsedNfeloRow[];
  errors: string[];
}

const NUMERIC_FIELD_ORDER: Array<keyof ParsedNfeloRow> = [
  "nfeloRating",
  "qbAdj",
  "value",
  "wow",
  "ytd",
  "offPlay",
  "offPass",
  "offRush",
  "defPlay",
  "defPass",
  "defRush",
  "epaPlay",
  "pointsFor",
  "pointsAgainst",
  "diff",
  "wins",
  "pythagWins",
  "elo",
  "film",
];

const KNOWN_ABBRS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN",
  "DET", "GB", "HOU", "IND", "JAX", "KC", "LAC", "LAR", "LV", "MIA",
  "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB",
  "TEN", "WAS",
  ...Object.keys(ABBR_ALIASES),
].sort((a, b) => b.length - a.length); // longest first, so "LAR" beats "LA"

function normalizeAbbr(raw: string): string {
  const upper = raw.toUpperCase();
  return ABBR_ALIASES[upper] ?? upper;
}

function parseNum(raw: string): number | null {
  const cleaned = raw.trim().replace(/^\+/, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "--" || cleaned === "—") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses a pasted nfelo.com power-ratings table (copy the table from
 * https://www.nfeloapp.com/nfl-power-ratings/ and paste as plain text) into
 * one row per team. Designed defensively since there's no public API and
 * exact copy/paste formatting varies by browser - see NfeloParseResult.errors
 * for anything that didn't parse cleanly rather than silently guessing.
 */
export function parseNfeloPaste(raw: string): NfeloParseResult {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: ParsedNfeloRow[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    // Skip header/label rows.
    if (/^(rank\s*)?team\b/i.test(line) || /nfelo\s+qb\s*adj/i.test(line)) continue;

    let cells = line.split("\t").map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < NUMERIC_FIELD_ORDER.length + 1) {
      // Fall back to splitting on runs of 2+ spaces (common if tabs were lost).
      const bySpaces = line.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);
      if (bySpaces.length > cells.length) cells = bySpaces;
    }

    if (cells.length < NUMERIC_FIELD_ORDER.length + 1) {
      errors.push(`Couldn't split into enough columns: "${line.slice(0, 80)}"`);
      continue;
    }

    const numericCells = cells.slice(-NUMERIC_FIELD_ORDER.length);
    const identityChunk = cells.slice(0, cells.length - NUMERIC_FIELD_ORDER.length).join(" ");

    const abbrMatch = KNOWN_ABBRS.find((abbr) =>
      new RegExp(`(^|[^A-Za-z])${abbr}([^A-Za-z]|$)`, "i").test(identityChunk)
    );
    if (!abbrMatch) {
      errors.push(`Couldn't find a team abbreviation in: "${identityChunk.slice(0, 60)}"`);
      continue;
    }

    const parsed: Record<string, number | null> = {};
    NUMERIC_FIELD_ORDER.forEach((field, i) => {
      parsed[field] = parseNum(numericCells[i]);
    });

    rows.push({
      abbr: normalizeAbbr(abbrMatch),
      ...(parsed as unknown as Omit<ParsedNfeloRow, "abbr">),
    });
  }

  return { rows, errors };
}
