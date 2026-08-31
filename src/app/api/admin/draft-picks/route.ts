import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teams, players, draftPicks, appConfig } from "@/db/schema";

export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true; // no secret configured -> open (local/dev use)
  return req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
  const season = config[0]?.season ?? 2026;

  const [allTeams, allPlayers, picks] = await Promise.all([
    db.select().from(teams),
    db.select().from(players),
    db.select().from(draftPicks).where(eq(draftPicks.season, season)),
  ]);

  return NextResponse.json({ season, teams: allTeams, players: allPlayers, draftPicks: picks });
}

interface DraftPickPayload {
  teamId: string;
  playerName: string;
  paid: number;
  preseasonOU: number;
  athleticProjection?: number | null;
  round?: number;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
  const season = config[0]?.season ?? 2026;

  const body: { picks: DraftPickPayload[] } = await req.json();
  if (!Array.isArray(body.picks)) {
    return NextResponse.json({ error: "Expected { picks: [...] }" }, { status: 400 });
  }

  for (const pick of body.picks) {
    if (!pick.teamId || !pick.playerName) continue;

    let player = (await db.select().from(players).where(eq(players.name, pick.playerName)))[0];
    if (!player) {
      const inserted = await db.insert(players).values({ name: pick.playerName }).returning();
      player = inserted[0];
    }

    const existing = await db.select().from(draftPicks).where(eq(draftPicks.teamId, pick.teamId));
    if (existing.length) {
      await db
        .update(draftPicks)
        .set({
          playerId: player.id,
          paid: pick.paid,
          preseasonOU: pick.preseasonOU,
          athleticProjection: pick.athleticProjection ?? null,
          round: pick.round ?? null,
        })
        .where(eq(draftPicks.teamId, pick.teamId));
    } else {
      await db.insert(draftPicks).values({
        season,
        teamId: pick.teamId,
        playerId: player.id,
        paid: pick.paid,
        preseasonOU: pick.preseasonOU,
        athleticProjection: pick.athleticProjection ?? null,
        round: pick.round ?? null,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
