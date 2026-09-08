import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { appConfig, futurePicks } from "@/db/schema";
import { getFuturePicks } from "@/lib/futures";
import { FUTURE_CATEGORY_BY_KEY } from "@/lib/future-categories";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
    const season = config[0]?.season ?? 2026;
    const picks = await getFuturePicks(season);
    return NextResponse.json({ season, picks });
  } catch (err) {
    console.error("[api/futures] GET failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error loading futures" },
      { status: 500 }
    );
  }
}

interface SubmitFuturesPayload {
  persona: string;
  picks: Record<string, string>;
}

// One persona's full submission at a time - upserts every non-empty
// category they filled in. Unknown category keys are rejected so a stale
// client can't write garbage rows that never show up anywhere in the UI.
export async function POST(req: NextRequest) {
  try {
    const body: SubmitFuturesPayload = await req.json();
    const persona = body.persona?.trim();
    if (!persona) {
      return NextResponse.json({ error: "persona is required" }, { status: 400 });
    }
    const entries = Object.entries(body.picks ?? {}).filter(([, value]) => value && value.trim());
    if (!entries.length) {
      return NextResponse.json({ error: "At least one pick is required" }, { status: 400 });
    }
    for (const [category] of entries) {
      if (!FUTURE_CATEGORY_BY_KEY[category]) {
        return NextResponse.json({ error: `Unknown category "${category}"` }, { status: 400 });
      }
    }

    const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
    const season = config[0]?.season ?? 2026;

    for (const [category, rawValue] of entries) {
      const value = rawValue.trim();
      const existing = await db
        .select()
        .from(futurePicks)
        .where(
          and(
            eq(futurePicks.season, season),
            eq(futurePicks.persona, persona),
            eq(futurePicks.category, category)
          )
        );
      if (existing.length) {
        await db
          .update(futurePicks)
          .set({ value, updatedAt: new Date() })
          .where(eq(futurePicks.id, existing[0].id));
      } else {
        await db.insert(futurePicks).values({ season, persona, category, value });
      }
    }

    const picks = await getFuturePicks(season);
    return NextResponse.json({ ok: true, season, picks });
  } catch (err) {
    console.error("[api/futures] POST failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error saving futures picks" },
      { status: 500 }
    );
  }
}
