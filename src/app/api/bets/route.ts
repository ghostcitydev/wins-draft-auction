import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { appConfig, bets, teams } from "@/db/schema";
import { getBetRows } from "@/lib/bets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
    const season = config[0]?.season ?? 2026;
    const rows = await getBetRows(season);
    return NextResponse.json({ season, bets: rows });
  } catch (err) {
    console.error("[api/bets] GET failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error loading bets" },
      { status: 500 }
    );
  }
}

interface CreateBetPayload {
  week: number;
  teamAbbr: string;
  spread: number;
  juice?: number;
  units?: number;
  notes?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateBetPayload = await req.json();
    const { week, teamAbbr, spread } = body;

    if (!week || !teamAbbr || spread === undefined || spread === null) {
      return NextResponse.json({ error: "week, teamAbbr, and spread are required" }, { status: 400 });
    }

    const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
    const season = config[0]?.season ?? 2026;

    const team = (await db.select().from(teams).where(eq(teams.abbr, teamAbbr.toUpperCase())))[0];
    if (!team) {
      return NextResponse.json({ error: `Unknown team abbreviation "${teamAbbr}"` }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(bets)
      .where(and(eq(bets.season, season), eq(bets.week, week), eq(bets.teamId, team.id)));
    if (existing.length) {
      return NextResponse.json(
        { error: `Already have a bet on ${team.abbr} for week ${week} - edit or delete it instead.` },
        { status: 409 }
      );
    }

    const inserted = await db
      .insert(bets)
      .values({
        season,
        week,
        teamId: team.id,
        spread,
        juice: body.juice ?? -110,
        units: body.units ?? 1,
        notes: body.notes ?? null,
      })
      .returning();

    return NextResponse.json({ ok: true, bet: inserted[0] });
  } catch (err) {
    console.error("[api/bets] POST failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error creating bet" },
      { status: 500 }
    );
  }
}
