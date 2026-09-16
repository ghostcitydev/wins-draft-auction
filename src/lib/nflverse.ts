/**
 * Pulls real, publicly-published play-by-play-derived team stats from the
 * nflverse project (https://github.com/nflverse/nflverse-data), which
 * updates within a day of each game. This gives genuine offensive/defensive
 * EPA per play - not an invented substitute for a proprietary rating.
 *
 * Team-week file docs: https://nflreadr.nflverse.com/reference/load_team_stats.html
 */
import Papa from "papaparse";

const STATS_TEAM_WEEK_URL = (season: number) =>
  `https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_${season}.csv`;

export interface NflverseTeamWeekRow {
  season: number;
  week: number;
  team: string;
  opponentTeam: string;
  offPlays: number;
  offEpa: number;
}

/**
 * Fetches and aggregates the raw team-week CSV into one row per
 * (team, opponent, week) with total offensive plays and total offensive EPA
 * for that game. Defensive EPA allowed for a team is derived later by
 * summing the opponent's offensive rows against that team.
 */
export async function fetchNflverseTeamWeekStats(
  season: number
): Promise<NflverseTeamWeekRow[]> {
  const url = STATS_TEAM_WEEK_URL(season);
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`nflverse team-week stats fetch failed (${res.status}) for ${season}`);
  }
  const csvText = await res.text();
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    console.error("[nflverse] CSV parse errors:", parsed.errors.slice(0, 3));
  }

  const rows: NflverseTeamWeekRow[] = [];
  for (const r of parsed.data) {
    const team = r.team;
    const opponentTeam = r.opponent_team;
    const week = Number(r.week);
    const seasonVal = Number(r.season);
    if (!team || !opponentTeam || Number.isNaN(week) || Number.isNaN(seasonVal)) continue;

    const attempts = Number(r.attempts) || 0;
    const sacksSuffered = Number(r.sacks_suffered) || 0;
    const carries = Number(r.carries) || 0;
    const passingEpa = Number(r.passing_epa) || 0;
    const rushingEpa = Number(r.rushing_epa) || 0;

    const offPlays = attempts + sacksSuffered + carries;
    const offEpa = passingEpa + rushingEpa;

    if (offPlays === 0) continue;

    rows.push({
      season: seasonVal,
      week,
      team,
      opponentTeam,
      offPlays,
      offEpa,
    });
  }
  return rows;
}
