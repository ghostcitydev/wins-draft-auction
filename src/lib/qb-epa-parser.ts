/**
 * Parses nfeloapp.com's "Live QB EPA Leaders" CSV export (or a tab-pasted
 * copy of the same table) into one row per QB. The export has no team
 * column - just a "F.Last" name - so each name is resolved to a team abbr
 * via QB_TEAM_ABBR below, a manually-verified snapshot (not derived/guessed)
 * of each 2026 Week 1 box-score QB's team. Names that don't match get
 * flagged in NfeloQbParseResult.errors instead of being silently dropped or
 * guessed at, since a wrong team attribution is worse than a missing row.
 *
 * Update QB_TEAM_ABBR by hand (verify via a current source, don't guess)
 * whenever a new week's export includes a QB who isn't in it yet - e.g. a
 * new starter after an injury/trade.
 */
import { ABBR_ALIASES } from "./team-aliases";

export interface ParsedQbRow {
  name: string;
  abbr: string | null;
  epaPlay: number | null;
  anyA: number | null;
  totalYds: number | null;
  totalTd: number | null;
}

export interface QbParseResult {
  rows: ParsedQbRow[];
  errors: string[];
  unmatchedNames: string[];
}

// Verified against the SI "Complete List of Every Starting NFL Quarterback
// for 2026 Season" (updated 9/11/26) plus individual roster checks for
// backups who saw Week 1 snaps - see conversation/commit history, not
// guessed from memory. Re-verify before trusting this for a new season.
export const QB_TEAM_ABBR: Record<string, string> = {
  "J.Dart": "NYG",
  "T.Lawrence": "JAX",
  "C.Williams": "CHI",
  "B.Young": "CAR",
  "L.Jackson": "BAL",
  "J.Allen": "BUF",
  "J.Brissett": "ARI",
  "D.Prescott": "DAL",
  "D.Lock": "SEA",
  "B.Purdy": "SF",
  "G.Smith": "NYJ",
  "C.Wentz": "MIN",
  "J.Daniels": "WAS",
  "C.Stroud": "HOU",
  "J.Hurts": "PHI",
  "J.Burrow": "CIN",
  "D.Maye": "NE",
  "K.Pickett": "CAR",
  "S.Bennett": "LAR",
  "J.Goff": "DET",
  "T.Shough": "NO",
  "K.Cousins": "LV",
  "K.Murray": "MIN",
  "S.Darnold": "SEA",
  "C.Johnston": "PIT",
  "P.Mahomes": "KC",
  "C.Ward": "TEN",
  "J.Herbert": "LAC",
  "J.Love": "GB",
  "M.Willis": "MIA",
  "D.Watson": "CLE",
  "B.Mayfield": "TB",
  "D.Jones": "IND",
  "A.Rodgers": "PIT",
  "C.Rush": "ATL",
  "B.Nix": "DEN",
  "M.Stafford": "LAR",
};

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

export function parseQbEpaPaste(raw: string): QbParseResult {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: ParsedQbRow[] = [];
  const errors: string[] = [];
  const unmatchedNames: string[] = [];

  for (const line of lines) {
    if (/^qb\b/i.test(line)) continue; // header row

    let cells = line.split(",").map((c) => c.trim());
    if (cells.length < 7) {
      cells = line.split("\t").map((c) => c.trim());
    }
    if (cells.length < 7) {
      errors.push(`Couldn't split into enough columns: "${line.slice(0, 80)}"`);
      continue;
    }

    // QB,Total EPA,EPA/Play,Rating,ANY/A,Total Yds,Total TD,...
    const name = cells[0];
    if (!name) continue;

    const epaPlay = parseNum(cells[2]);
    const anyA = parseNum(cells[4]);
    const totalYds = parseNum(cells[5]);
    const totalTd = parseNum(cells[6]);

    const mapped = QB_TEAM_ABBR[name];
    if (!mapped) {
      unmatchedNames.push(name);
      rows.push({ name, abbr: null, epaPlay, anyA, totalYds, totalTd });
      continue;
    }

    rows.push({ name, abbr: normalizeAbbr(mapped), epaPlay, anyA, totalYds, totalTd });
  }

  return { rows, errors, unmatchedNames };
}
