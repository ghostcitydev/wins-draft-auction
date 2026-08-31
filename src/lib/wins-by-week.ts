import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games, draftPicks, players } from "@/db/schema";

export interface WeekPoint {
  week: number;
  wins: number;
}

export interface PlayerWinsSeries {
  playerId: string;
  playerName: string;
  points: WeekPoint[];
}

export interface WinsByWeekResult {
  season: number;
  isPreview: boolean;
  maxWeek: number;
  series: PlayerWinsSeries[];
}

/**
 * Cumulative wins-by-week per player, for the "wins by week" line chart.
 * Always uses the CURRENT season's draft (player <-> team) mapping - real
 * game results are only pulled from a different season as a preview when
 * this season has no completed games yet (i.e. before the season starts),
 * so the chart isn't empty in the meantime. Once real games are on the
 * board for `currentSeason`, this switches over automatically.
 */
export async function getWinsByWeek(currentSeason: number): Promise<WinsByWeekResult> {
  const [currentSeasonGames, currentPicks, allPlayers] = await Promise.all([
    db.select().from(games).where(eq(games.season, currentSeason)),
    db.select().from(draftPicks).where(eq(draftPicks.season, currentSeason)),
    db.select().from(players),
  ]);

  const hasRealCurrentGames = currentSeasonGames.some((g) => g.completed);
  const season = hasRealCurrentGames ? currentSeason : currentSeason - 1;
  const isPreview = !hasRealCurrentGames;

  const seasonGames = hasRealCurrentGames
    ? currentSeasonGames
    : await db.select().from(games).where(eq(games.season, season));

  const playerById = new Map(allPlayers.map((p) => [p.id, p]));
  const teamIdToPlayerId = new Map(currentPicks.map((d) => [d.teamId, d.playerId]));

  const winsByPlayerWeek = new Map<string, Map<number, number>>();
  let maxWeek = 0;

  for (const g of seasonGames) {
    if (!g.completed || g.homeScore === null || g.awayScore === null) continue;
    maxWeek = Math.max(maxWeek, g.week);
    if (g.homeScore === g.awayScore) continue; // ties don't add a win to either side
    const winnerTeamId = g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId;
    const playerId = teamIdToPlayerId.get(winnerTeamId);
    if (!playerId) continue;
    if (!winsByPlayerWeek.has(playerId)) winsByPlayerWeek.set(playerId, new Map());
    const weekMap = winsByPlayerWeek.get(playerId)!;
    weekMap.set(g.week, (weekMap.get(g.week) ?? 0) + 1);
  }

  const playerIds = [...new Set(currentPicks.map((d) => d.playerId))];

  const series: PlayerWinsSeries[] = playerIds.map((playerId) => {
    const weekMap = winsByPlayerWeek.get(playerId) ?? new Map<number, number>();
    let cumulative = 0;
    const points: WeekPoint[] = [];
    for (let w = 1; w <= maxWeek; w++) {
      cumulative += weekMap.get(w) ?? 0;
      points.push({ week: w, wins: cumulative });
    }
    return {
      playerId,
      playerName: playerById.get(playerId)?.name ?? "Unknown",
      points,
    };
  });

  return { season, isPreview, maxWeek, series };
}
