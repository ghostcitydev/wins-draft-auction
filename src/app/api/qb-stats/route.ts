import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appConfig, games, qbRatings, teams } from "@/db/schema";
import { qbKey } from "@/lib/qb-epa-parser";
import { fetchQbStarts, QbStart } from "@/lib/qb-wins";

export const dynamic = "force-dynamic";

export interface QbStatRow {
  name: string;
  abbr: string | null;
  logoUrl: string;
  epaPlay: number | null;
  anyA: number | null;
  totalYds: number | null;
  totalTd: number | null;
  /** Regular-season wins as the starter; null if nflverse couldn't be read. */
  qbWins: number | null;
  /** 0-100; see mvpIndex() below. */
  mvpIndex: number | null;
}

type RawQbRow = Omit<QbStatRow, "qbWins" | "mvpIndex"> & { teamId: string | null };

// MVP Index weights. Each stat is min-max scaled to 0-1 across this week's
// QB list (best = 1, worst = 0; a missing stat counts as 0), then weighted
// and scaled to 0-100.
const MVP_WEIGHTS = {
  epaPlay: 0.15,
  totalTd: 0.15,
  anyA: 0.15,
  totalYds: 0.15,
  qbWins: 0.4,
} as const;

function withMvpIndex(rows: Omit<QbStatRow, "mvpIndex">[]): QbStatRow[] {
  const keys = Object.keys(MVP_WEIGHTS) as (keyof typeof MVP_WEIGHTS)[];
  const ranges = Object.fromEntries(
    keys.map((k) => {
      const vals = rows.map((r) => r[k]).filter((v): v is number => v !== null);
      return [k, vals.length ? [Math.min(...vals), Math.max(...vals)] : null];
    })
  ) as Record<keyof typeof MVP_WEIGHTS, [number, number] | null>;
  return rows.map((r) => {
    let score = 0;
    for (const k of keys) {
      const v = r[k];
      const range = ranges[k];
      if (v === null || !range) continue;
      const [lo, hi] = range;
      score += MVP_WEIGHTS[k] * (hi > lo ? (v - lo) / (hi - lo) : 1);
    }
    return { ...r, mvpIndex: Math.round(score * 1000) / 10 };
  });
}

// Wins per QB as the starter. Matched on nflverse's "F.Last" name; when two
// QBs share one (rare), the one who started for this row's team wins out.
function qbWinsFor(
  name: string,
  abbr: string | null,
  starts: QbStart[],
  winByWeekTeam: Map<string, boolean>
): number | null {
  const key = qbKey(name, {});
  const mine = starts.filter((s) => s.key === key);
  if (!mine.length) return 0;
  const ids = new Set(mine.map((s) => s.playerId));
  const playerId =
    ids.size === 1 ? mine[0].playerId : mine.find((s) => s.team === abbr)?.playerId;
  if (!playerId) return 0;
  return mine.filter((s) => s.playerId === playerId && winByWeekTeam.get(`${s.week}|${s.team}`))
    .length;
}

export async function GET() {
  try {
    const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
    const season = config[0]?.season ?? 2026;

    const [allRatings, allTeams, seasonGames, starts] = await Promise.all([
      db.select().from(qbRatings).where(eq(qbRatings.season, season)),
      db.select().from(teams),
      db
        .select()
        .from(games)
        .where(
          and(eq(games.season, season), eq(games.seasonType, "REG"), eq(games.completed, true))
        ),
      // QB wins are a bonus - if nflverse is down, still show the table.
      fetchQbStarts(season).catch((err) => {
        console.error("[api/qb-stats] QB starts unavailable:", err);
        return null;
      }),
    ]);

    // "week|ABBR" -> whether that team won its game that week.
    const abbrById = new Map(allTeams.map((t) => [t.id, t.abbr]));
    const winByWeekTeam = new Map<string, boolean>();
    for (const g of seasonGames) {
      if (g.homeScore === null || g.awayScore === null) continue;
      const home = abbrById.get(g.homeTeamId);
      const away = abbrById.get(g.awayTeamId);
      if (home) winByWeekTeam.set(`${g.week}|${home}`, g.homeScore > g.awayScore);
      if (away) winByWeekTeam.set(`${g.week}|${away}`, g.awayScore > g.homeScore);
    }

    // Latest week with chartable numbers - a week saved with blank EPA/ANY/A
    // (e.g. a paste whose columns didn't line up) shouldn't empty the page.
    const usableWeeks = allRatings
      .filter((r) => r.epaPlay !== null && r.anyA !== null)
      .map((r) => r.week);
    const week = usableWeeks.length ? Math.max(...usableWeeks) : null;
    const teamById = new Map(allTeams.map((t) => [t.id, t]));

    const allRows: RawQbRow[] = allRatings
      .filter((r) => r.week === week)
      .map((r) => {
        const team = r.teamId ? teamById.get(r.teamId) : undefined;
        return {
          name: r.name,
          abbr: team?.abbr ?? null,
          logoUrl: team?.logoUrl ?? `/logos/${team?.abbr ?? "nfl"}.png`,
          epaPlay: r.epaPlay,
          anyA: r.anyA,
          totalYds: r.totalYds,
          totalTd: r.totalTd,
          teamId: r.teamId,
        };
      });

    // A team can have more than one QB logged for a week (a backup who
    // played after an injury, a trick-play pass, etc). Keep only the one
    // with the most total yards - the best signal for who actually played
    // meaningful snaps - so the table/chart show one row per team (32).
    const bestByTeam = new Map<string, RawQbRow>();
    const noTeam: RawQbRow[] = [];
    for (const row of allRows) {
      if (!row.teamId) {
        noTeam.push(row);
        continue;
      }
      const existing = bestByTeam.get(row.teamId);
      if (!existing || (row.totalYds ?? -Infinity) > (existing.totalYds ?? -Infinity)) {
        bestByTeam.set(row.teamId, row);
      }
    }

    const rows: QbStatRow[] = withMvpIndex(
      [...bestByTeam.values(), ...noTeam].map((r) => ({
        name: r.name,
        abbr: r.abbr,
        logoUrl: r.logoUrl,
        epaPlay: r.epaPlay,
        anyA: r.anyA,
        totalYds: r.totalYds,
        totalTd: r.totalTd,
        qbWins: starts ? qbWinsFor(r.name, r.abbr, starts, winByWeekTeam) : null,
      }))
    ).sort((a, b) => (b.mvpIndex ?? -Infinity) - (a.mvpIndex ?? -Infinity));

    return NextResponse.json({ season, week, qbs: rows });
  } catch (err) {
    console.error("[api/qb-stats] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error loading QB stats" },
      { status: 500 }
    );
  }
}
