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
  epa: number;
  value: number | null;
  vor: number | null;
  currentValue: number | null;
  pastSchedule: ScheduleGame[];
  futureSchedule: ScheduleGame[];
}

export interface PlayerGroup {
  playerId: string;
  playerName: string;
  totalPaid: number;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  totalValue: number;
  teams: TeamRow[];
}

export function groupByPlayer(rows: TeamRow[]): PlayerGroup[] {
  const map = new Map<string, PlayerGroup>();
  for (const row of rows) {
    if (!row.playerId || !row.playerName) continue;
    if (!map.has(row.playerId)) {
      map.set(row.playerId, {
        playerId: row.playerId,
        playerName: row.playerName,
        totalPaid: 0,
        totalWins: 0,
        totalLosses: 0,
        totalTies: 0,
        totalValue: 0,
        teams: [],
      });
    }
    const group = map.get(row.playerId)!;
    group.teams.push(row);
    group.totalPaid += row.paid ?? 0;
    group.totalWins += row.wins;
    group.totalLosses += row.losses;
    group.totalTies += row.ties;
    group.totalValue += row.value ?? 0;
  }
  return [...map.values()].sort((a, b) => b.totalWins - a.totalWins);
}
