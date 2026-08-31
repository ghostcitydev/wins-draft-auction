/**
 * Thin client for ESPN's public (unauthenticated) NFL scoreboard endpoint.
 * This is the same endpoint the espn.com scoreboard page itself calls, and is
 * widely used by open-source sports trackers. No API key required.
 */

const BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

export interface EspnGame {
  espnEventId: string;
  week: number;
  date: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  completed: boolean;
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  team: { displayName: string; abbreviation: string };
}

interface EspnEvent {
  id: string;
  date: string;
  competitions: Array<{
    competitors: EspnCompetitor[];
    status: { type: { completed: boolean } };
  }>;
}

interface EspnScoreboardResponse {
  events: EspnEvent[];
}

/** seasontype: 1 = preseason, 2 = regular season, 3 = postseason */
export async function fetchEspnWeek(
  season: number,
  week: number,
  seasontype: 1 | 2 | 3 = 2
): Promise<EspnGame[]> {
  const url = `${BASE}?year=${season}&seasontype=${seasontype}&week=${week}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`ESPN scoreboard fetch failed (${res.status}) for week ${week}`);
  }
  const data: EspnScoreboardResponse = await res.json();

  return (data.events ?? []).map((event) => {
    const comp = event.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === "home");
    const away = comp.competitors.find((c) => c.homeAway === "away");
    const completed = comp.status.type.completed;
    return {
      espnEventId: event.id,
      week,
      date: event.date,
      homeTeamName: home?.team.displayName ?? "",
      awayTeamName: away?.team.displayName ?? "",
      homeScore: completed && home?.score !== undefined ? Number(home.score) : null,
      awayScore: completed && away?.score !== undefined ? Number(away.score) : null,
      completed,
    };
  });
}

/** Fetches the full regular-season schedule (weeks 1-18), past and future. */
export async function fetchEspnSeason(season: number): Promise<EspnGame[]> {
  const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
  const results = await Promise.all(
    weeks.map((week) =>
      fetchEspnWeek(season, week).catch((err) => {
        console.error(`[espn] week ${week} failed:`, err);
        return [] as EspnGame[];
      })
    )
  );
  return results.flat();
}
