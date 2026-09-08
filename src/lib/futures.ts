import { eq } from "drizzle-orm";
import { db } from "@/db";
import { futurePicks } from "@/db/schema";

export interface FuturePickRow {
  persona: string;
  category: string;
  value: string;
  updatedAt: string;
}

/**
 * All futures picks for a season, across every persona. No grading - this
 * is just raw picks for the client to group by category/persona and render
 * side-by-side (see src/lib/future-categories.ts for what each category
 * means and src/components/FuturesBoard.tsx for the comparison table).
 */
export async function getFuturePicks(season: number): Promise<FuturePickRow[]> {
  const rows = await db.select().from(futurePicks).where(eq(futurePicks.season, season));
  return rows.map((r) => ({
    persona: r.persona,
    category: r.category,
    value: r.value,
    updatedAt: r.updatedAt.toISOString(),
  }));
}
