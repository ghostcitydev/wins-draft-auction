import { NextResponse } from "next/server";
import { db } from "@/db";
import { appConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getTeamRows } from "@/lib/team-stats";
import { syncIfStale } from "@/lib/auto-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
  const season = config[0]?.season ?? 2026;

  await syncIfStale(season);
  const rows = await getTeamRows(season);
  return NextResponse.json({ season, teams: rows });
}
