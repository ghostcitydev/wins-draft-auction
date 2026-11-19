/** Client-safe types for the Playoffs tab (no DB imports). */

export interface PlayoffTeamInfo {
  abbr: string;
  name: string;
  shortName: string;
  conference: string;
  division: string;
  logoUrl: string;
}

export interface PlayoffStanding {
  abbr: string;
  w: number;
  l: number;
  t: number;
  pct: number;
  divW: number;
  divL: number;
  divT: number;
  confW: number;
  confL: number;
  confT: number;
  pointDiff: number;
  /** 1-7 if in the playoff field after this week, else null */
  seed: number | null;
  /** 1-4 within its division */
  divRank: number;
  /** games behind the division leader */
  gamesBack: number;
  /** games behind the 7th seed (only for teams outside the field) */
  wcGamesBack?: number;
}

export interface PlayoffWeek {
  week: number;
  standings: Record<string, PlayoffStanding>;
  /** division name -> team abbrs in division order */
  divisions: Record<string, string[]>;
  /** conference -> all its team abbrs in seed order (1..16) */
  seeds: Record<string, string[]>;
}

export interface PlayoffsResult {
  season: number;
  isPreview: boolean;
  maxWeek: number;
  conferences: string[];
  teams: PlayoffTeamInfo[];
  weeks: PlayoffWeek[];
}
