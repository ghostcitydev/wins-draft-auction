import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { teams, appConfig } from "../src/db/schema";
import teamsMaster from "../prisma/seed-data/teams-master.json";

async function main() {
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

  const existingConfig = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
  if (!existingConfig.length) {
    await db.insert(appConfig).values({ id: "singleton", season: 2026, totalBudget: 400, maxTeamValue: 47 });
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
