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

// Strips the formatting a pasted/exported table can carry around a number:
// surrounding quotes, thousands separators ("1,234" season yards once QBs
// pass 1,000), a leading "+", and a trailing "%" (scaled back to a decimal).
function parseNum(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let cleaned = raw.trim().replace(/^"|"$/g, "").replace(/,/g, "").replace(/^\+/, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "--" || cleaned === "—") return null;
  const isPct = cleaned.endsWith("%");
  if (isPct) cleaned = cleaned.slice(0, -1).trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return isPct ? n / 100 : n;
}

// nfelo lists QBs as "F.Last"; a copied web table can also come through as
// "Josh Allen" or "J. Allen". Normalize all of those to the "F.Last" keys
// QB_TEAM_ABBR uses.
function normalizeName(raw: string): string {
  const name = raw.trim().replace(/^"|"$/g, "").replace(/\s+/g, " ");
  if (QB_TEAM_ABBR[name]) return name;
  const dotted = name.match(/^([A-Za-z])[A-Za-z]*\.?\s*([A-Za-z'\-. ]+)$/);
  if (dotted) {
    const candidate = `${dotted[1].toUpperCase()}.${dotted[2].trim()}`;
    if (QB_TEAM_ABBR[candidate]) return candidate;
  }
  return name;
}

// Splits one line on tabs (a copied web table) or on commas outside double
// quotes (the CSV export, where a value like "1,234" is quoted).
function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

interface ColumnMap {
  name: number;
  epaPlay: number;
  anyA: number;
  totalYds: number;
  totalTd: number;
}

// Column order of the week-1 export: QB,Total EPA,EPA/Play,Rating,ANY/A,Total Yds,Total TD,...
const DEFAULT_COLUMNS: ColumnMap = { name: 0, epaPlay: 2, anyA: 4, totalYds: 5, totalTd: 6 };

function headerKey(cell: string): string {
  return cell.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Reads column positions from a header row, so a paste with an extra rank
// column, a team column, or reordered columns still lines up. Returns null
// if the line isn't a header.
function columnsFromHeader(cells: string[]): ColumnMap | null {
  const keys = cells.map(headerKey);
  const find = (...names: string[]) => keys.findIndex((k) => names.includes(k));
  const name = find("qb", "quarterback", "player", "name");
  const epaPlay = find("epaplay", "epaperplay", "epap", "epadb", "epadropback");
  const anyA = find("anya", "anypera");
  if (name === -1 || epaPlay === -1 || anyA === -1) return null;
  return {
    name,
    epaPlay,
    anyA,
    totalYds: find("totalyds", "totalyards", "yds", "yards"),
    totalTd: find("totaltd", "totaltds", "td", "tds"),
  };
}

export function parseQbEpaPaste(raw: string): QbParseResult {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: ParsedQbRow[] = [];
  const errors: string[] = [];
  const unmatchedNames: string[] = [];
  const seen = new Set<string>();
  let columns = DEFAULT_COLUMNS;

  for (const line of lines) {
    const cells = splitLine(line);

    const header = columnsFromHeader(cells);
    if (header) {
      columns = header;
      continue;
    }
    if (/^qb\b/i.test(line)) continue; // header row we couldn't map - keep last known layout

    const needed = Math.max(columns.name, columns.epaPlay, columns.anyA) + 1;
    if (cells.length < needed) {
      errors.push(`Couldn't split into enough columns: "${line.slice(0, 80)}"`);
      continue;
    }

    const name = normalizeName(cells[columns.name] ?? "");
    if (!name || seen.has(name)) continue; // blank, or a repeated row from a multi-page copy
    seen.add(name);

    const epaPlay = parseNum(cells[columns.epaPlay]);
    const anyA = parseNum(cells[columns.anyA]);
    const totalYds = columns.totalYds === -1 ? null : parseNum(cells[columns.totalYds]);
    const totalTd = columns.totalTd === -1 ? null : parseNum(cells[columns.totalTd]);

    if (epaPlay === null || anyA === null) {
      errors.push(`No EPA/Play or ANY/A number for "${name}" - check the pasted columns`);
    }

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
