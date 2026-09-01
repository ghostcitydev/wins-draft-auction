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
 * Backfill of the previous season's games - used as a stand-in for
 * "past opponent strength" on the Stats page before the current season has
 * any completed games of its own (see getTeamRows). EPA/Pythagorean
 * placeholders come from team_ratings instead (see getTeamRows +
 * /api/admin/team-ratings) - those are pasted in by the commissioner, not
 * auto-synced, since nfelo.com has no public API.
 *
 * This only ever runs once (gated on "does this season have zero games
 * yet", not "does it have a full slate") - retrying on every stale-sync
 * cycle previously re-ran an 18-week ESPN refetch + ~270 sequential DB
 * upserts on top of the *current* season's own sync inside the same
 * request, which could blow past the serverless function's time limit and
 * take the whole page down mid-query. If a backfill genuinely comes up
 * short (partial team-name mismatches, etc.), re-run it deliberately via
 * a one-off script rather than looping it into every page load.
 */
export async function backfillPreviousSeasonIfNeeded(season: number) {
  const prevSeason = season - 1;
  const hasGames = await db.select({ id: games.id }).from(games).where(eq(games.season, prevSeason)).limit(1);
  if (!hasGames.length) return syncEspnSchedule(prevSeason);
  return { upserted: 0, unmatched: [], skipped: true as const };
}

/** Runs the live sync; used by the cron route and the manual "sync now" button. */
export async function runFullSync(season: number) {
  const espn = await Promise.allSettled([syncEspnSchedule(season)]);
  const backfill = await Promise.allSettled([backfillPreviousSeasonIfNeeded(season)]);
  if (backfill[0].status === "rejected") {
    console.error("[sync] previous-season backfill failed:", backfill[0].reason);
  }
  return { espn: espn[0], backfill: backfill[0] };
}

export async function getLastSyncTime(): Promise<Date | null> {
  const rows = await db.select().from(syncLog).orderBy(desc(syncLog.ranAt)).limit(1);
  return rows[0]?.ranAt ?? null;
}
