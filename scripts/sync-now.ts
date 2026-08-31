import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { appConfig } from "../src/db/schema";
import { runFullSync } from "../src/lib/sync";

async function main() {
  const config = await db.select().from(appConfig).where(eq(appConfig.id, "singleton"));
  const season = config[0]?.season ?? 2026;
  console.log(`Running full sync for season ${season}...`);
  const result = await runFullSync(season);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
