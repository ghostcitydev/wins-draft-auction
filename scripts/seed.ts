import { config as loadEnv } from "dotenv";

// Explicitly load .env.local first (this is where `vercel env pull` and
// Next.js convention put things) - dotenv/config only auto-loads a plain
// `.env` file by default, which silently left DATABASE_URL unset here.
loadEnv({ path: ".env.local" });
loadEnv(); // fall back to a plain .env if present, without overriding
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { teams, players, draftPicks, appConfig, teamRatings, bets } from "../src/db/schema";
import { ABBR_ALIASES } from "../src/lib/team-aliases";
import teamsMaster from "../prisma/seed-data/teams-master.json";
import draftPicks2026 from "../prisma/seed-data/draft-picks-2026.json";
import teamRatings2025 from "../prisma/seed-data/team-ratings-2025.json";
import betsWeek1 from "../prisma/seed-data/bets-2026-week1.json";

async function main() {
  const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
  const season = config[0]?.season ?? 2026;

  console.log(`Seeding ${teamsMaster.length} teams...`);
  for (const t of teamsMaster as Array<{
    name: string;
    shortName: string;
    abbr: string;
    conference: string;
    division: string;
    espnLogoAbbr: string;
    logoUrl: string;
  }>) {
    const logoUrl = t.logoUrl;
    const existing = await db.select().from(teams).where(eq(teams.abbr, t.abbr));
    if (existing.length) {
      await db
        .update(teams)
        .set({ name: t.name, shortName: t.shortName, conference: t.conference, division: t.division, logoUrl })
        .where(eq(teams.abbr, t.abbr));
    } else {
      await db.insert(teams).values({
        name: t.name,
        shortName: t.shortName,
        abbr: t.abbr,
        conference: t.conference,
        division: t.division,
        logoUrl,
      });
    }
  }

  if (!existingConfigRow(config)) {
    await db.insert(appConfig).values({ id: "singleton", season: 2026, totalBudget: 400, maxTeamValue: 47 });
  }

  console.log(`Seeding ${draftPicks2026.length} draft picks for season ${season}...`);
  for (const pick of draftPicks2026 as Array<{
    abbr: string;
    player: string;
    round?: number;
    paid: number;
    preseasonOU: number;
    athleticProjection?: number;
  }>) {
    const team = (await db.select().from(teams).where(eq(teams.abbr, pick.abbr)))[0];
    if (!team) {
      console.warn(`  skip ${pick.abbr} - team not found`);
      continue;
    }

    let player = (await db.select().from(players).where(eq(players.name, pick.player)))[0];
    if (!player) {
      const inserted = await db.insert(players).values({ name: pick.player }).returning();
      player = inserted[0];
    }

    const existingPick = await db.select().from(draftPicks).where(eq(draftPicks.teamId, team.id));
    if (existingPick.length) {
      await db
        .update(draftPicks)
        .set({
          playerId: player.id,
          paid: pick.paid,
          preseasonOU: pick.preseasonOU,
          athleticProjection: pick.athleticProjection ?? null,
          round: pick.round ?? null,
          season,
        })
        .where(eq(draftPicks.teamId, team.id));
    } else {
      await db.insert(draftPicks).values({
        season,
        teamId: team.id,
        playerId: player.id,
        paid: pick.paid,
        preseasonOU: pick.preseasonOU,
        athleticProjection: pick.athleticProjection ?? null,
        round: pick.round ?? null,
      });
    }
  }

  console.log(`Seeding ${teamRatings2025.length} nfelo team-ratings rows for 2025 (placeholder season)...`);
  for (const r of teamRatings2025 as Array<{
    abbr: string;
    season: number;
    week: number;
    nfeloRating: number | null;
    qbAdj: number | null;
    value: number | null;
    wow: number | null;
    ytd: number | null;
    offPlay: number | null;
    offPass: number | null;
    offRush: number | null;
    defPlay: number | null;
    defPass: number | null;
    defRush: number | null;
    epaPlay: number | null;
    pointsFor: number | null;
    pointsAgainst: number | null;
    diff: number | null;
    wins: number | null;
    pythagWins: number | null;
    elo: number | null;
    film: number | null;
  }>) {
    const abbr = ABBR_ALIASES[r.abbr] ?? r.abbr;
    const team = (await db.select().from(teams).where(eq(teams.abbr, abbr)))[0];
    if (!team) {
      console.warn(`  skip rating for ${r.abbr} - team not found`);
      continue;
    }

    const existingRating = await db
      .select()
      .from(teamRatings)
      .where(and(eq(teamRatings.season, r.season), eq(teamRatings.week, r.week), eq(teamRatings.teamId, team.id)));

    const values = {
      season: r.season,
      week: r.week,
      teamId: team.id,
      source: "nfelo",
      nfeloRating: r.nfeloRating,
      qbAdj: r.qbAdj,
      value: r.value,
      wow: r.wow,
      ytd: r.ytd,
      offPlay: r.offPlay,
      offPass: r.offPass,
      offRush: r.offRush,
      defPlay: r.defPlay,
      defPass: r.defPass,
      defRush: r.defRush,
      epaPlay: r.epaPlay,
      pointsFor: r.pointsFor,
      pointsAgainst: r.pointsAgainst,
      diff: r.diff,
      wins: r.wins,
      pythagWins: r.pythagWins,
      elo: r.elo,
      film: r.film,
    };

    if (existingRating.length) {
      await db.update(teamRatings).set(values).where(eq(teamRatings.id, existingRating[0].id));
    } else {
      await db.insert(teamRatings).values(values);
    }
  }

  console.log(`Seeding ${betsWeek1.length} bets for season ${season}...`);
  for (const b of betsWeek1 as Array<{
    week: number;
    abbr: string;
    spread: number;
    juice: number;
    units: number;
  }>) {
    const team = (await db.select().from(teams).where(eq(teams.abbr, b.abbr)))[0];
    if (!team) {
      console.warn(`  skip bet on ${b.abbr} - team not found`);
      continue;
    }

    const existingBet = await db
      .select()
      .from(bets)
      .where(and(eq(bets.season, season), eq(bets.week, b.week), eq(bets.teamId, team.id)));

    const values = { season, week: b.week, teamId: team.id, spread: b.spread, juice: b.juice, units: b.units };

    if (existingBet.length) {
      await db.update(bets).set(values).where(eq(bets.id, existingBet[0].id));
    } else {
      await db.insert(bets).values(values);
    }
  }

  console.log("Done.");
  process.exit(0);
}

function existingConfigRow(config: unknown[]) {
  return config.length > 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
