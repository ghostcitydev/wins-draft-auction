import { config as loadEnv } from "dotenv";

// Explicitly load .env.local first (this is where `vercel env pull` and
// Next.js convention put things) - dotenv/config only auto-loads a plain
// `.env` file by default, which silently left DATABASE_URL unset here.
loadEnv({ path: ".env.local" });
loadEnv(); // fall back to a plain .env if present, without overriding
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
