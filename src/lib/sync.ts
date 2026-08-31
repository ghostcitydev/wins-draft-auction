import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { teams, games, syncLog } from "@/db/schema";
import { fetchEspnSeason } from "./espn";

export async function syncEspnSchedule(season: number) {
  const allTeams = await db.select().from(teams);
  const byName = new Map(allTeams.map((t) => [t.name, t]));

  let fetched: Awaited<ReturnType<typeof fetchEspnSeason>>;
  try {
    fetched = await fetchEspnSeason(season);
  } catch (err) {
    await db.insert(syncLog).values({ source: "espn", status: "error", message: String(err) });
    throw err;
  }

  const unmatched = new Set<string>();
  let upserted = 0;

  for (const g of fetched) {
    const home = byName.get(g.homeTeamName);
    const away = byName.get(g.awayTeamName);
    if (!home || !away) {
      if (!home) unmatched.add(g.homeTeamName);
      if (!away) unmatched.add(g.awayTeamName);
      continue;
    }

    await db
      .insert(games)
      .values({
        espnEventId: g.espnEventId,
        season,
        week: g.week,
        seasonType: "REG",
        date: new Date(g.date),
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        completed: g.completed,
      })
      .onConflictDoUpdate({
        target: games.espnEventId,
        set: {
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          completed: g.completed,
          date: new Date(g.date),
        },
      });
    upserted++;
  }

  await db.insert(syncLog).values({
    source: "espn",
    status: unmatched.size ? "partial" : "ok",
    message: unmatched.size
      ? `Upserted ${upserted} games. Unmatched team names: ${[...unmatched].join(", ")}`
      : `Upserted ${upserted} games.`,
  });

  return { upserted, unmatched: [...unmatched] };
}

/**
 * One-time backfill of the previous season's games. EPA/Pythagorean
 * placeholders come from team_ratings instead (see getTeamRows +
 * /api/admin/team-ratings) - those are pasted in by the commissioner, not
 * auto-synced, since nfelo.com has no public API.
 */
export async function backfillPreviousSeasonIfNeeded(season: number) {
  const prevSeason = season - 1;
  const hasGames = await db.select({ id: games.id }).from(games).where(eq(games.season, prevSeason)).limit(1);
  if (!hasGames.length) await syncEspnSchedule(prevSeason);
}

/** Runs the live sync; used by the cron route and the manual "sync now" button. */
export async function runFullSync(season: number) {
  const espn = await Promise.allSettled([syncEspnSchedule(season)]);
  await backfillPreviousSeasonIfNeeded(season).catch((err) =>
    console.error("[sync] previous-season backfill failed:", err)
  );
  return { espn: espn[0] };
}

export async function getLastSyncTime(): Promise<Date | null> {
  const rows = await db.select().from(syncLog).orderBy(desc(syncLog.ranAt)).limit(1);
  return rows[0]?.ranAt ?? null;
}
