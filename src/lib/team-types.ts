/** Pure types + client-safe helpers (no DB imports) shared between server queries and client components. */

export interface ScheduleGame {
  week: number;
  date: string | null;
  opponentAbbr: string;
  opponentName: string;
  home: boolean;
  played: boolean;
  teamScore: number | null;
  opponentScore: number | null;
  result: "W" | "L" | "T" | null;
}

export interface TeamRow {
  id: string;
  name: string;
  shortName: string;
  abbr: string;
  division: string;
  conference: string;
  logoUrl: string;
  playerId: string | null;
  playerName: string | null;
  paid: number | null;
  preseasonOU: number | null;
  projected: number | null;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  pythagoreanWins: number;
  pythagoreanIsPlaceholder: boolean;
  epa: number;
  epaIsPlaceholder: boolean;
  placeholderSeason: number | null;
  value: number | null;
  vor: number | null;
  currentValue: number | null;
  pastSchedule: ScheduleGame[];
  futureSchedule: ScheduleGame[];
}

export interface PlayerGroup {
  playerId: string;
  playerName: string;
  teams: TeamRow[];
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  winPct: number;
  totalPaid: number;
  totalValue: number;
  totalPreseasonOU: number;
  avgDiff: number;
  totalProjected: number;
  totalPythagoreanWins: number;
  avgEpa: number;
}

export function groupByPlayer(rows: TeamRow[]): PlayerGroup[] {
  const map = new Map<string, TeamRow[]>();
  for (const row of rows) {
    if (!row.playerId || !row.playerName) continue;
    const list = map.get(row.playerId) ?? [];
    list.push(row);
    map.set(row.playerId, list);
  }

  const groups: PlayerGroup[] = [...map.entries()].map(([playerId, teams]) => {
    const playerName = teams[0].playerName!;
    const totalWins = teams.reduce((s, t) => s + t.wins, 0);
    const totalLosses = teams.reduce((s, t) => s + t.losses, 0);
    const totalTies = teams.reduce((s, t) => s + t.ties, 0);
    const gp = totalWins + totalLosses + totalTies;
    const n = teams.length || 1;

    return {
      playerId,
      playerName,
      teams,
      totalWins,
      totalLosses,
      totalTies,
      winPct: gp > 0 ? (totalWins + 0.5 * totalTies) / gp : 0,
      totalPaid: teams.reduce((s, t) => s + (t.paid ?? 0), 0),
      totalValue: teams.reduce((s, t) => s + (t.value ?? 0), 0),
      totalPreseasonOU: teams.reduce((s, t) => s + (t.preseasonOU ?? 0), 0),
      avgDiff: teams.reduce((s, t) => s + t.diff, 0) / n,
      totalProjected: teams.reduce((s, t) => s + (t.projected ?? 0), 0),
      totalPythagoreanWins: teams.reduce((s, t) => s + t.pythagoreanWins, 0),
      avgEpa: teams.reduce((s, t) => s + t.epa, 0) / n,
    };
  });

  return groups.sort((a, b) => b.totalWins - a.totalWins);
}
