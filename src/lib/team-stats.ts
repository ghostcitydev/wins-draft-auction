import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teams, draftPicks, players, games, teamWeekStats, appConfig } from "@/db/schema";
import {
  winPct,
  pointDiffPerGame,
  pythagoreanWins,
  projectedWins,
  epaDifferential,
  computeLeagueValues,
} from "./calculations";
import type { TeamRow, ScheduleGame } from "./team-types";
export type { TeamRow, ScheduleGame, PlayerGroup } from "./team-types";
export { groupByPlayer } from "./team-types";

export async function getTeamRows(season: number): Promise<TeamRow[]> {
  const [allTeams, allDraftPicks, allPlayers, config, allGames, allWeekStats] = await Promise.all([
    db.select().from(teams),
    db.select().from(draftPicks).where(eq(draftPicks.season, season)),
    db.select().from(players),
    db.select().from(appConfig).where(eq(appConfig.id, "singleton")),
    db.select().from(games).where(eq(games.season, season)),
    db.select().from(teamWeekStats).where(eq(teamWeekStats.season, season)),
  ]);

  const playerById = new Map(allPlayers.map((p) => [p.id, p]));
  const draftPickByTeamId = new Map(allDraftPicks.map((d) => [d.teamId, d]));
  const teamById = new Map(allTeams.map((t) => [t.id, t]));
  const totalBudget = config[0]?.totalBudget ?? 400;
  const maxTeamValue = config[0]?.maxTeamValue ?? 47;

  const rows: TeamRow[] = allTeams.map((team) => {
    const teamGames = allGames.filter(
      (g) => g.homeTeamId === team.id || g.awayTeamId === team.id
    );

    let wins = 0,
      losses = 0,
      ties = 0,
      pointsFor = 0,
      pointsAgainst = 0;

    const scheduleEntries: ScheduleGame[] = teamGames.map((g) => {
      const isHome = g.homeTeamId === team.id;
      const opponent = teamById.get(isHome ? g.awayTeamId : g.homeTeamId)!;
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;
      let result: "W" | "L" | "T" | null = null;

      if (g.completed && teamScore !== null && oppScore !== null) {
        if (teamScore > oppScore) {
          result = "W";
          wins++;
        } else if (teamScore < oppScore) {
          result = "L";
          losses++;
        } else {
          result = "T";
          ties++;
        }
        pointsFor += teamScore;
        pointsAgainst += oppScore;
      }

      return {
        week: g.week,
        date: g.date ? new Date(g.date).toISOString() : null,
        opponentAbbr: opponent.abbr,
        opponentName: opponent.name,
        home: isHome,
        played: g.completed,
        teamScore,
        opponentScore: oppScore,
        result,
      };
    });

    const record = { wins, losses, ties, pointsFor, pointsAgainst };

    const myWeekStats = allWeekStats.filter((w) => w.teamId === team.id);
    const offPlays = myWeekStats.reduce((s, w) => s + w.offPlays, 0);
    const offEpa = myWeekStats.reduce((s, w) => s + w.offEpa, 0);
    const defWeekStats = allWeekStats.filter((w) => w.opponentTeamId === team.id);
    const defPlaysFaced = defWeekStats.reduce((s, w) => s + w.offPlays, 0);
    const defEpaAllowed = defWeekStats.reduce((s, w) => s + w.offEpa, 0);

    const draftPick = draftPickByTeamId.get(team.id);
    const player = draftPick ? playerById.get(draftPick.playerId) : undefined;

    return {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      abbr: team.abbr,
      division: team.division,
      conference: team.conference,
      logoUrl: team.logoUrl ?? `/logos/${team.abbr}.png`,
      playerId: draftPick?.playerId ?? null,
      playerName: player?.name ?? null,
      paid: draftPick?.paid ?? null,
      preseasonOU: draftPick?.preseasonOU ?? null,
      projected: draftPick ? projectedWins(draftPick.preseasonOU) : null,
      wins,
      losses,
      ties,
      winPct: winPct(record),
      pointsFor,
      pointsAgainst,
      diff: pointDiffPerGame(record),
      pythagoreanWins: pythagoreanWins(record),
      epa: epaDifferential(offEpa, offPlays, defEpaAllowed, defPlaysFaced),
      value: null,
      vor: null,
      currentValue: null,
      pastSchedule: scheduleEntries.filter((s) => s.played).sort((a, b) => a.week - b.week),
      futureSchedule: scheduleEntries.filter((s) => !s.played).sort((a, b) => a.week - b.week),
    };
  });

  const draftedIdx = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.paid !== null);

  if (draftedIdx.length) {
    const values = computeLeagueValues(
      draftedIdx.map(({ r }) => ({
        wins: r.wins,
        losses: r.losses,
        ties: r.ties,
        pointsFor: r.pointsFor,
        pointsAgainst: r.pointsAgainst,
        paid: r.paid as number,
      })),
      totalBudget,
      maxTeamValue
    );
    draftedIdx.forEach(({ i }, idx) => {
      rows[i].vor = values[idx].vor;
      rows[i].currentValue = values[idx].currentValue;
      rows[i].value = values[idx].value;
    });
  }

  return rows.sort((a, b) => a.abbr.localeCompare(b.abbr));
}
