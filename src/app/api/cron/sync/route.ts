import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runFullSync } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Belt-and-suspenders scheduled sync (see vercel.json "crons"). The app also
 * refreshes on-demand on every page load if data is stale (see
 * src/lib/auto-sync.ts), so this cron isn't strictly required for
 * correctness - it just keeps data fresh even if nobody opens the app.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
  const season = config[0]?.season ?? 2026;
  const result = await runFullSync(season);
  return NextResponse.json({ season, result });
}
