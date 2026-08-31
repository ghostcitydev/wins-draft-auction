import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runFullSync } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Manual "Sync Now" trigger, called from the UI. */
export async function POST(req: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  if (secret) {
    const provided = req.headers.get("x-sync-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
  const season = config[0]?.season ?? 2026;
  const result = await runFullSync(season);
  return NextResponse.json({ season, result });
}
