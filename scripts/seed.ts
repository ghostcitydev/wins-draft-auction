import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { teams, players, draftPicks, appConfig } from "../src/db/schema";
import teamsMaster from "../prisma/seed-data/teams-master.json";
import draftPicks2026 from "../prisma/seed-data/draft-picks-2026.json";

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
        .set({ playerId: player.id, paid: pick.paid, preseasonOU: pick.preseasonOU, round: pick.round ?? null, season })
        .where(eq(draftPicks.teamId, team.id));
    } else {
      await db.insert(draftPicks).values({
        season,
        teamId: team.id,
        playerId: player.id,
        paid: pick.paid,
        preseasonOU: pick.preseasonOU,
        round: pick.round ?? null,
      });
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
