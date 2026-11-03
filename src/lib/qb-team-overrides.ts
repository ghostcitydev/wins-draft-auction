import { sql } from "drizzle-orm";
import { db } from "@/db";
import { qbTeamOverrides } from "@/db/schema";

let tableReady = false;

/**
 * Creates qb_team_overrides if it isn't there yet, so this feature works
 * on the live database right after a deploy without anyone having to run
 * db-update.bat first. Matches the qbTeamOverrides definition in
 * src/db/schema.ts (a later db:push sees it as already up to date).
 */
export async function ensureQbTeamOverridesTable() {
  if (tableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "qb_team_overrides" (
      "key" text PRIMARY KEY NOT NULL,
      "abbr" text NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  tableReady = true;
}

/** "F.Last" -> team abbr, as saved from /admin's Unmatched QBs section. */
export async function loadQbTeamOverrides(): Promise<Record<string, string>> {
  await ensureQbTeamOverridesTable();
  const rows = await db.select().from(qbTeamOverrides);
  return Object.fromEntries(rows.map((r) => [r.key, r.abbr]));
}
