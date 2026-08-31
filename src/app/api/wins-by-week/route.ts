import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appConfig } from "@/db/schema";
import { getWinsByWeek } from "@/lib/wins-by-week";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
    const season = config[0]?.season ?? 2026;
    const data = await getWinsByWeek(season);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/wins-by-week] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
