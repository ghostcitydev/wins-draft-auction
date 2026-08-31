import { NextResponse } from "next/server";
import { db } from "@/db";
import { appConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getTeamRows } from "@/lib/team-stats";
import { groupByPlayer } from "@/lib/team-types";
import { syncIfStale } from "@/lib/auto-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
    const season = config[0]?.season ?? 2026;

    await syncIfStale(season);
    const rows = await getTeamRows(season);
    return NextResponse.json({ season, players: groupByPlayer(rows) });
  } catch (err) {
    console.error("[api/players] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error loading players" },
      { status: 500 }
    );
  }
}
