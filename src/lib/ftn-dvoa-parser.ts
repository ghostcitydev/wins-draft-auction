import { ABBR_ALIASES } from "./team-aliases";

export interface ParsedDvoaRow {
  abbr: string;
  wins: number | null;
  losses: number | null;
  dave: number | null;
  meanWins: number | null;
  tot: number | null;
  div: number | null;
  wc: number | null;
  seed1: number | null;
  seed2: number | null;
  seed3: number | null;
  seed4: number | null;
  seed5: number | null;
  seed6: number | null;
  seed7: number | null;
}

export interface DvoaParseResult {
  rows: ParsedDvoaRow[];
  errors: string[];
}

const KNOWN_ABBRS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN",
  "DET", "GB", "HOU", "IND", "JAX", "KC", "LAC", "LAR", "LV", "MIA",
  "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB",
  "TEN", "WAS",
  ...Object.keys(ABBR_ALIASES),
].sort((a, b) => b.length - a.length);

function normalizeAbbr(raw: string): string {
  const upper = raw.toUpperCase();
  return ABBR_ALIASES[upper] ?? upper;
}

function parsePct(raw: string): number | null {
  const cleaned = raw.trim().replace(/%$/, "").replace(/^\+/, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "--" || cleaned === "—") return null;
  const n = Number(cleaned);
  // FTN's page reports these as whole percentages (9.3, not 0.093) - store
  // as a 0-1 fraction so it matches the fmtPct()/fmtSignedPct() convention
  // used everywhere else in this app.
  return Number.isFinite(n) ? n / 100 : null;
}

function parseNum(raw: string): number | null {
  const cleaned = raw.trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "--" || cleaned === "—") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses FTN Fantasy's DVOA/playoff-odds report
 * (https://ftnfantasy.com/nfl/dvoa-playoff-odds), copy/pasted as plain text
 * (one division's table at a time or the whole page - division headers like
 * "NFC East" and repeated "Team W-L DAVE ..." header rows are skipped).
 * Each data row is: Team, W-L, DAVE, Mean Wins, TOT, DIV, WC, #1..#7.
 */
export function parseFtnDvoaPaste(raw: string): DvoaParseResult {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: ParsedDvoaRow[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    // Skip division section headers ("### NFC East", "NFC East"), table
    // header rows, and markdown separator rows.
    if (/^#{0,3}\s*(AFC|NFC)\s+(East|North|South|West)\s*$/i.test(line)) continue;
    if (/^\|?\s*team\s*\|/i.test(line) || /^team\b/i.test(line)) continue;
    if (/^[|\s:-]+$/.test(line)) continue;

    let cells = line
      .split(/\||\t/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 14) {
      const bySpaces = line.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);
      if (bySpaces.length > cells.length) cells = bySpaces;
    }
    if (cells.length < 14) {
      errors.push(`Couldn't split into enough columns: "${line.slice(0, 80)}"`);
      continue;
    }

    const abbrMatch = KNOWN_ABBRS.find((abbr) =>
      new RegExp(`(^|[^A-Za-z])${abbr}([^A-Za-z]|$)`, "i").test(cells[0])
    );
    if (!abbrMatch) {
      errors.push(`Couldn't find a team abbreviation in: "${cells[0].slice(0, 40)}"`);
      continue;
    }

    const wl = cells[1].match(/(\d+)\s*-\s*(\d+)/);

    rows.push({
      abbr: normalizeAbbr(abbrMatch),
      wins: wl ? Number(wl[1]) : null,
      losses: wl ? Number(wl[2]) : null,
      dave: parsePct(cells[2]),
      meanWins: parseNum(cells[3]),
      tot: parsePct(cells[4]),
      div: parsePct(cells[5]),
      wc: parsePct(cells[6]),
      seed1: parsePct(cells[7]),
      seed2: parsePct(cells[8]),
      seed3: parsePct(cells[9]),
      seed4: parsePct(cells[10]),
      seed5: parsePct(cells[11]),
      seed6: parsePct(cells[12]),
      seed7: parsePct(cells[13]),
    });
  }

  return { rows, errors };
}
