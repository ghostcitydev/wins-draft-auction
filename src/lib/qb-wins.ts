/**
 * QB wins for the MVP Index. Neither nfelo paste carries a win/loss record,
 * so starters come from nflverse's public player-week stats (same project
 * as src/lib/nflverse.ts, updated within a day of each game): the QB with
 * the most pass attempts for a team in a game is that game's starter. The
 * route then credits the starter with a win from the `games` table's final
 * score.
 *
 * Docs: https://nflreadr.nflverse.com/reference/load_player_stats.html
 */
import Papa from "papaparse";
import { ABBR_ALIASES } from "./team-aliases";

const STATS_PLAYER_WEEK_URL = (season: number) =>
  `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv`;

export interface QbStart {
  week: number;
  /** Team abbr, normalised to the app's (e.g. LA -> LAR). */
  team: string;
  playerId: string;
  /** nflverse's "F.Last" name - the same form as qbKey() in qb-epa-parser. */
  key: string;
}

// The CSV is ~5MB (too big for Next's fetch cache), and QB stats are polled
// every minute, so keep the parsed starters in memory per warm instance.
const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<number, { at: number; starts: QbStart[] }>();

export async function fetchQbStarts(season: number): Promise<QbStart[]> {
  const hit = cache.get(season);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.starts;

  const res = await fetch(STATS_PLAYER_WEEK_URL(season), { cache: "no-store" });
  if (!res.ok) throw new Error(`nflverse player-week stats fetch failed (${res.status})`);
  const parsed = Papa.parse<Record<string, string>>(await res.text(), {
    header: true,
    skipEmptyLines: true,
  });

  // game_id + team -> the QB with the most attempts.
  const best = new Map<string, QbStart & { attempts: number }>();
  for (const r of parsed.data) {
    if (r.position !== "QB" || r.season_type !== "REG") continue;
    const week = Number(r.week);
    const attempts = Number(r.attempts) || 0;
    if (!r.game_id || !r.team || !r.player_name || !Number.isFinite(week)) continue;
    const team = ABBR_ALIASES[r.team.toUpperCase()] ?? r.team.toUpperCase();
    const slot = `${r.game_id}|${team}`;
    const existing = best.get(slot);
    if (!existing || attempts > existing.attempts) {
      best.set(slot, { week, team, playerId: r.player_id, key: r.player_name, attempts });
    }
  }

  const starts = [...best.values()].map(({ week, team, playerId, key }) => ({
    week,
    team,
    playerId,
    key,
  }));
  cache.set(season, { at: Date.now(), starts });
  return starts;
}
