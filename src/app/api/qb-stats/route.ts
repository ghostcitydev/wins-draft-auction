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

    const rows: QbStatRow[] = allRatings
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
        };
      })
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
