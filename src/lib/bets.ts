import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bets, teams, games } from "@/db/schema";

export interface BetRow {
  id: string;
  season: number;
  week: number;
  persona: string;
  teamId: string;
  teamAbbr: string;
  teamName: string;
  teamShortName: string;
  logoUrl: string;
  opponentAbbr: string;
  opponentName: string;
  opponentLogoUrl: string;
  home: boolean;
  spread: number;
  juice: number;
  units: number;
  closingLine: number | null;
  notes: string | null;
  gameDate: string | null;
  completed: boolean;
  teamScore: number | null;
  opponentScore: number | null;
  /** null until the game is final */
  result: "win" | "loss" | "push" | null;
  /** profit/loss in units, null until graded */
  unitsResult: number | null;
  /**
   * Closing line value in points, signed so positive always means "got the
   * better number": spread - closingLine. E.g. took +2.5, closed +1.5 -> +1
   * (closed toward your side). Took -6.5, closed -7.5 -> +1 (closed away
   * from your side, i.e. you laid a cheaper number than the market settled
   * on). Null until a closing line is entered.
   */
  clv: number | null;
}

/** Profit (in units) for a WIN of `units` risked at American odds `juice`. */
function americanOddsProfit(units: number, juice: number): number {
  if (juice < 0) return units * (100 / Math.abs(juice));
  return units * (juice / 100);
}

export async function getBetRows(season: number): Promise<BetRow[]> {
  const [allBets, allTeams, allGames] = await Promise.all([
    db.select().from(bets).where(eq(bets.season, season)),
    db.select().from(teams),
    db.select().from(games).where(eq(games.season, season)),
  ]);

  const teamById = new Map(allTeams.map((t) => [t.id, t]));

  const rows: BetRow[] = allBets.map((b) => {
    const team = teamById.get(b.teamId)!;
    const game = allGames.find(
      (g) => g.week === b.week && (g.homeTeamId === b.teamId || g.awayTeamId === b.teamId)
    );

    let opponent: (typeof allTeams)[number] | null = null;
    let home = false;
    let gameDate: string | null = null;
    let completed = false;
    let teamScore: number | null = null;
    let opponentScore: number | null = null;

    if (game) {
      home = game.homeTeamId === b.teamId;
      const oppId = home ? game.awayTeamId : game.homeTeamId;
      opponent = teamById.get(oppId) ?? null;
      gameDate = game.date ? new Date(game.date).toISOString() : null;
      completed = game.completed;
      teamScore = home ? game.homeScore : game.awayScore;
      opponentScore = home ? game.awayScore : game.homeScore;
    }

    let result: BetRow["result"] = null;
    let unitsResult: number | null = null;
    if (completed && teamScore !== null && opponentScore !== null) {
      const margin = teamScore - opponentScore + b.spread;
      if (margin > 0) {
        result = "win";
        unitsResult = americanOddsProfit(b.units, b.juice);
      } else if (margin < 0) {
        result = "loss";
        unitsResult = -b.units;
      } else {
        result = "push";
        unitsResult = 0;
      }
    }

    const clv = b.closingLine !== null ? b.spread - b.closingLine : null;

    return {
      id: b.id,
      season: b.season,
      week: b.week,
      persona: b.persona,
      teamId: b.teamId,
      teamAbbr: team.abbr,
      teamName: team.name,
      teamShortName: team.shortName,
      logoUrl: team.logoUrl ?? `/logos/${team.abbr}.png`,
      opponentAbbr: opponent?.abbr ?? "?",
      opponentName: opponent?.name ?? "Unknown opponent",
      opponentLogoUrl: opponent?.logoUrl ?? (opponent ? `/logos/${opponent.abbr}.png` : ""),
      home,
      spread: b.spread,
      juice: b.juice,
      units: b.units,
      closingLine: b.closingLine,
      notes: b.notes,
      gameDate,
      completed,
      teamScore,
      opponentScore,
      result,
      unitsResult,
      clv,
    };
  });

  // Order by real game date (falls back to week for any bet whose game
  // hasn't synced yet), per the user's request to sort the bets list this
  // way rather than by entry order.
  return rows.sort((a, b) => {
    if (a.gameDate && b.gameDate) return a.gameDate.localeCompare(b.gameDate);
    if (a.gameDate) return -1;
    if (b.gameDate) return 1;
    return a.week - b.week;
  });
}
