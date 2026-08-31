import { NextResponse } from "next/server";
import { db } from "@/db";
import { appConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLastSyncTime } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
    const lastSync = await getLastSyncTime();
    return NextResponse.json({
      season: config[0]?.season ?? 2026,
      totalBudget: config[0]?.totalBudget ?? 400,
      maxTeamValue: config[0]?.maxTeamValue ?? 47,
      lastSync,
    });
  } catch (err) {
    console.error("[api/config] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error loading config" },
      { status: 500 }
    );
  }
}
