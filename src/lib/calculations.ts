/**
 * Draft-pool calculation engine.
 *
 * These formulas replicate the methodology from the commissioner's original
 * "NFL Wins Draft Auction" spreadsheet (Value sheet), reverse-engineered
 * directly from its live formulas so the numbers stay faithful to how the
 * league has always scored itself:
 *
 *   - New VOR        = Wins - MIN(Wins) across all 32 teams
 *   - Current Value  = MIN(maxTeamValue, VOR * (totalBudget / SUM(VOR)))
 *   - Value          = Current Value - Paid
 *   - Projected wins = 3.125 * (preseasonOU - 4.5)   [static, from the O/U line]
 *
 * Pythagorean wins uses the standard Football Outsiders / Pro-Football-Reference
 * NFL exponent (2.37) applied to points for/against pulled live from ESPN.
 * EPA/play is a genuine offense-minus-defense efficiency number computed from
 * nflverse's public play-by-play-derived team-week stats (real data, not a
 * fabricated substitute for any proprietary rating).
 */

export const PYTHAGOREAN_EXPONENT = 2.37;

export interface TeamRecordInput {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

export function gamesPlayed(r: TeamRecordInput): number {
  return r.wins + r.losses + r.ties;
}

export function winPct(r: TeamRecordInput): number {
  const gp = gamesPlayed(r);
  if (gp === 0) return 0;
  return (r.wins + 0.5 * r.ties) / gp;
}

export function pointDiffPerGame(r: TeamRecordInput): number {
  const gp = gamesPlayed(r);
  if (gp === 0) return 0;
  return (r.pointsFor - r.pointsAgainst) / gp;
}

export function pythagoreanWins(r: TeamRecordInput): number {
  const gp = gamesPlayed(r);
  if (gp === 0 || (r.pointsFor === 0 && r.pointsAgainst === 0)) return 0;
  const pf = Math.pow(r.pointsFor, PYTHAGOREAN_EXPONENT);
  const pa = Math.pow(r.pointsAgainst, PYTHAGOREAN_EXPONENT);
  if (pf + pa === 0) return 0;
  return gp * (pf / (pf + pa));
}

export function projectedWins(preseasonOU: number): number {
  return 3.125 * (preseasonOU - 4.5);
}

/** EPA/play differential: offense EPA per play minus defensive EPA/play allowed. */
export function epaDifferential(
  offEpaSum: number,
  offPlays: number,
  defEpaAllowedSum: number,
  defPlaysFaced: number
): number {
  const offPerPlay = offPlays > 0 ? offEpaSum / offPlays : 0;
  const defPerPlay = defPlaysFaced > 0 ? defEpaAllowedSum / defPlaysFaced : 0;
  return offPerPlay - defPerPlay;
}

export interface ValueInput extends TeamRecordInput {
  paid: number;
}

export interface ValueResult {
  vor: number;
  currentValue: number;
  value: number;
}

/**
 * Computes VOR / Current Value / Value across the whole league at once,
 * matching the spreadsheet's SUM(...)-across-all-teams formulas.
 */
export function computeLeagueValues(
  teams: ValueInput[],
  totalBudget: number,
  maxTeamValue: number
): ValueResult[] {
  const minWins = teams.length ? Math.min(...teams.map((t) => t.wins)) : 0;
  const vors = teams.map((t) => t.wins - minWins);
  const sumVor = vors.reduce((a, b) => a + b, 0);

  return teams.map((t, i) => {
    const vor = vors[i];
    let currentValue = 0;
    if (sumVor > 0) {
      currentValue = Math.min(maxTeamValue, vor * (totalBudget / sumVor));
    }
    return {
      vor,
      currentValue,
      value: currentValue - t.paid,
    };
  });
}
