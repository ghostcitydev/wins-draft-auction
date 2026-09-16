import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teams, qbRatings, appConfig } from "@/db/schema";
import { parseQbEpaPaste } from "@/lib/qb-epa-parser";

export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true;
  return req.headers.get("x-admin-secret") === secret;
}

interface PastePayload {
  season: number;
  week: number;
  rawText: string;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: PastePayload = await req.json();
  if (!body.rawText || !body.season || !body.week) {
    return NextResponse.json({ error: "Expected { season, week, rawText }" }, { status: 400 });
  }

  const { rows, errors, unmatchedNames } = parseQbEpaPaste(body.rawText);

  const allTeams = await db.select().from(teams);
  const teamIdByAbbr = new Map(allTeams.map((t) => [t.abbr, t.id]));

  let upserted = 0;

  for (const row of rows) {
    const teamId = row.abbr ? teamIdByAbbr.get(row.abbr) ?? null : null;

    await db
      .insert(qbRatings)
      .values({
        season: body.season,
        week: body.week,
        name: row.name,
        teamId,
        source: "nfelo",
        epaPlay: row.epaPlay,
        anyA: row.anyA,
        totalYds: row.totalYds,
        totalTd: row.totalTd,
      })
      .onConflictDoUpdate({
        target: [qbRatings.season, qbRatings.week, qbRatings.name],
        set: {
          teamId,
          epaPlay: row.epaPlay,
          anyA: row.anyA,
          totalYds: row.totalYds,
          totalTd: row.totalTd,
        },
      });
    upserted++;
  }

  return NextResponse.json({
    upserted,
    totalParsed: rows.length,
    parseErrors: errors,
    unmatchedNames,
  });
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
  const season = config[0]?.season ?? 2026;
  const rows = await db.select().from(qbRatings).where(eq(qbRatings.season, season));
  const weeks = [...new Set(rows.map((r) => r.week))].sort((a, b) => b - a);
  return NextResponse.json({ season, weeksLogged: weeks, rowCount: rows.length });
}
