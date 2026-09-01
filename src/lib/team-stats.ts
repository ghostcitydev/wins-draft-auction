import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { teams, draftPicks, players, games, teamRatings, appConfig } from "@/db/schema";
import {
  winPct,
  projectedWins,
  computeLeagueValues,
} from "./calculations";
import type { TeamRow, ScheduleGame } from "./team-types";
export type { TeamRow, ScheduleGame, PlayerGroup } from "./team-types";
export { groupByPlayer } from "./team-types";

export async function getTeamRows(season: number): Promise<TeamRow[]> {
  const prevSeason = season - 1;
  const [allTeams, allDraftPicks, allPlayers, config, allGames, prevSeasonCompletedGames, allRatings, prevRatings] =
    await Promise.all([
      db.select().from(teams),
      db.select().from(draftPicks).where(eq(draftPicks.season, season)),
      db.select().from(players),
      db.select().from(appConfig).where(eq(appConfig.id, "singleton")),
      db.select().from(games).where(eq(games.season, season)),
      db.select().from(games).where(and(eq(games.season, prevSeason), eq(games.completed, true))),
      db.select().from(teamRatings).where(eq(teamRatings.season, season)),
      db.select().from(teamRatings).where(eq(teamRatings.season, prevSeason)),
    ]);

  // Has this season actually started? Used to decide whether "past/future
  // opponent strength" should use this season's real completed/remaining
  // splits, or fall back to last season's schedule as a preseason proxy.
  const seasonHasStarted = allGames.some((g) => g.completed);

  // Ratings are pasted in weekly (all 32 teams at once) - use whichever week
  // is most recent for each season.
  const latestWeek = (rows: typeof allRatings) =>
    rows.length ? Math.max(...rows.map((r) => r.week)) : null;
  const currentWeek = latestWeek(allRatings);
  const prevWeek = latestWeek(prevRatings);
  const currentRatingsByTeam = new Map(
    allRatings.filter((r) => r.week === currentWeek).map((r) => [r.teamId, r])
  );
  const prevRatingsByTeam = new Map(
    prevRatings.filter((r) => r.week === prevWeek).map((r) => [r.teamId, r])
  );

  // Same current-season/prior-season fallback used for `epa` above, exposed
  // as a lookup so we can resolve an opponent's EPA (not just a team's own).
  const resolvedEpa = (teamId: string): number =>
    currentRatingsByTeam.get(teamId)?.epaPlay ?? prevRatingsByTeam.get(teamId)?.epaPlay ?? 0;

  const avgOpponentEpa = (opponentIds: string[]): number | null => {
    if (!opponentIds.length) return null;
    const vals = opponentIds.map(resolvedEpa);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

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

    // EPA and Pythagorean wins come from a weekly nfelo.com paste (see
    // /api/admin/team-ratings), not a computed proxy - nfelo has no public
    // API. EPA falls back to last season's most recent snapshot (clearly
    // flagged as a placeholder) before this season has a rating logged.
    // Pythagorean wins don't get that fallback - it's a real, honest 0 until
    // the current season has actual results to compute it from.
    const currentRating = currentRatingsByTeam.get(team.id);
    let epaRating = currentRating;
    let epaIsPlaceholder = false;
    if (!epaRating) {
      epaRating = prevRatingsByTeam.get(team.id);
      epaIsPlaceholder = Boolean(epaRating);
    }

    const draftPick = draftPickByTeamId.get(team.id);
    const player = draftPick ? playerById.get(draftPick.playerId) : undefined;

    // Past/future opponent strength (avg EPA/play of opponents already
    // played vs. opponents still to come). Once the season has real
    // completed games, this uses this season's actual past/future splits.
    // Before that, "past" borrows last season's completed schedule as a
    // stand-in (flagged as a placeholder) and "future" uses this season's
    // full schedule, since every game is still ahead of it.
    const opponentIdOf = (g: { homeTeamId: string; awayTeamId: string }) =>
      g.homeTeamId === team.id ? g.awayTeamId : g.homeTeamId;
    const prevSeasonGamesForTeam = prevSeasonCompletedGames.filter(
      (g) => g.homeTeamId === team.id || g.awayTeamId === team.id
    );
    const pastOppGames = seasonHasStarted
      ? teamGames.filter((g) => g.completed)
      : prevSeasonGamesForTeam;
    const futureOppGames = seasonHasStarted ? teamGames.filter((g) => !g.completed) : teamGames;
    const pastOpponentEpa = avgOpponentEpa(pastOppGames.map(opponentIdOf));
    const futureOpponentEpa = avgOpponentEpa(futureOppGames.map(opponentIdOf));

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
      // Prefer a real published projection (e.g. The Athletic's preseason
      // preview) over the computed OU-based formula - only fall back to the
      // formula if a team/season doesn't have a real one entered yet.
      projected: draftPick
        ? draftPick.athleticProjection ?? projectedWins(draftPick.preseasonOU)
        : null,
      wins,
      losses,
      ties,
      winPct: winPct(record),
      pointsFor,
      pointsAgainst,
      pythagoreanWins: currentRating?.pythagWins ?? 0,
      pythagoreanIsPlaceholder: false,
      epa: epaRating?.epaPlay ?? 0,
      epaIsPlaceholder,
      placeholderSeason: epaIsPlaceholder ? prevSeason : null,
      // Offense/defense EPA splits come from the same weekly nfelo paste as
      // `epa` above, so they share its current-season/placeholder status.
      offEpa: epaRating?.offPlay ?? 0,
      offPassEpa: epaRating?.offPass ?? 0,
      offRushEpa: epaRating?.offRush ?? 0,
      defEpa: epaRating?.defPlay ?? 0,
      defPassEpa: epaRating?.defPass ?? 0,
      defRushEpa: epaRating?.defRush ?? 0,
      pastOpponentEpa,
      futureOpponentEpa,
      scheduleIsPreseason: !seasonHasStarted,
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

  const leagueHasAnyWins = draftedIdx.some(({ r }) => r.wins > 0);

  if (draftedIdx.length && leagueHasAnyWins) {
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
  } else if (draftedIdx.length) {
    // Nobody has a win yet (preseason) - show 0 rather than a misleading
    // "-$paid" that would imply every pick is already underwater.
    draftedIdx.forEach(({ i }) => {
      rows[i].vor = 0;
      rows[i].currentValue = 0;
      rows[i].value = 0;
    });
  }

  return rows.sort((a, b) => a.abbr.localeCompare(b.abbr));
}
