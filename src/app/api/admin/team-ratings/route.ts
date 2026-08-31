import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teams, teamRatings, appConfig } from "@/db/schema";
import { parseNfeloPaste } from "@/lib/nfelo-parser";

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

  const { rows, errors } = parseNfeloPaste(body.rawText);

  const allTeams = await db.select().from(teams);
  const byAbbr = new Map(allTeams.map((t) => [t.abbr, t]));

  let upserted = 0;
  const unmatchedAbbrs: string[] = [];

  for (const row of rows) {
    const team = byAbbr.get(row.abbr);
    if (!team) {
      unmatchedAbbrs.push(row.abbr);
      continue;
    }

    await db
      .insert(teamRatings)
      .values({
        season: body.season,
        week: body.week,
        teamId: team.id,
        source: "nfelo",
        nfeloRating: row.nfeloRating,
        qbAdj: row.qbAdj,
        value: row.value,
        wow: row.wow,
        ytd: row.ytd,
        offPlay: row.offPlay,
        offPass: row.offPass,
        offRush: row.offRush,
        defPlay: row.defPlay,
        defPass: row.defPass,
        defRush: row.defRush,
        epaPlay: row.epaPlay,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        diff: row.diff,
        wins: row.wins,
        pythagWins: row.pythagWins,
        elo: row.elo,
        film: row.film,
      })
      .onConflictDoUpdate({
        target: [teamRatings.season, teamRatings.week, teamRatings.teamId],
        set: {
          nfeloRating: row.nfeloRating,
          qbAdj: row.qbAdj,
          value: row.value,
          wow: row.wow,
          ytd: row.ytd,
          offPlay: row.offPlay,
          offPass: row.offPass,
          offRush: row.offRush,
          defPlay: row.defPlay,
          defPass: row.defPass,
          defRush: row.defRush,
          epaPlay: row.epaPlay,
          pointsFor: row.pointsFor,
          pointsAgainst: row.pointsAgainst,
          diff: row.diff,
          wins: row.wins,
          pythagWins: row.pythagWins,
          elo: row.elo,
          film: row.film,
        },
      });
    upserted++;
  }

  return NextResponse.json({
    upserted,
    totalParsed: rows.length,
    parseErrors: errors,
    unmatchedAbbrs,
  });
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
  const season = config[0]?.season ?? 2026;
  const rows = await db.select().from(teamRatings).where(eq(teamRatings.season, season));
  const weeks = [...new Set(rows.map((r) => r.week))].sort((a, b) => b - a);
  return NextResponse.json({ season, weeksLogged: weeks, rowCount: rows.length });
}
