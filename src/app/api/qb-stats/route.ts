import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appConfig, qbRatings, teams } from "@/db/schema";

export const dynamic = "force-dynamic";

export interface QbStatRow {
  name: string;
  abbr: string | null;
  logoUrl: string;
  epaPlay: number | null;
  anyA: number | null;
  totalYds: number | null;
  totalTd: number | null;
}

export async function GET() {
  try {
    const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
    const season = config[0]?.season ?? 2026;

    const [allRatings, allTeams] = await Promise.all([
      db.select().from(qbRatings).where(eq(qbRatings.season, season)),
      db.select().from(teams),
    ]);

    const week = allRatings.length ? Math.max(...allRatings.map((r) => r.week)) : null;
    const teamById = new Map(allTeams.map((t) => [t.id, t]));

    const allRows: (QbStatRow & { teamId: string | null })[] = allRatings
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
    const bestByTeam = new Map<string, QbStatRow & { teamId: string | null }>();
    const noTeam: (QbStatRow & { teamId: string | null })[] = [];
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

    const rows: QbStatRow[] = [...bestByTeam.values(), ...noTeam]
      .map((r) => ({
        name: r.name,
        abbr: r.abbr,
        logoUrl: r.logoUrl,
        epaPlay: r.epaPlay,
        anyA: r.anyA,
        totalYds: r.totalYds,
        totalTd: r.totalTd,
      }))
      .sort((a, b) => (b.epaPlay ?? -Infinity) - (a.epaPlay ?? -Infinity));

    return NextResponse.json({ season, week, qbs: rows });
  } catch (err) {
    console.error("[api/qb-stats] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error loading QB stats" },
      { status: 500 }
    );
  }
}
