import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { teams, games, teamWeekStats, syncLog } from "@/db/schema";
import { fetchEspnSeason } from "./espn";
import { fetchNflverseTeamWeekStats } from "./nflverse";

/** Known historical/alternate abbreviations used by outside data sources. */
const ABBR_ALIASES: Record<string, string> = {
  LA: "LAR",
  STL: "LAR",
  SD: "LAC",
  OAK: "LV",
  LVR: "LV",
  JAC: "JAX",
  WSH: "WAS",
};

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

export async function syncNflverseEpa(season: number) {
  const allTeams = await db.select().from(teams);
  const byAbbr = new Map(allTeams.map((t) => [t.abbr, t]));
  const resolveTeam = (abbr: string) => byAbbr.get(abbr) ?? byAbbr.get(ABBR_ALIASES[abbr] ?? "");

  let rows: Awaited<ReturnType<typeof fetchNflverseTeamWeekStats>>;
  try {
    rows = await fetchNflverseTeamWeekStats(season);
  } catch (err) {
    await db.insert(syncLog).values({ source: "nflverse", status: "error", message: String(err) });
    throw err;
  }

  const unmatched = new Set<string>();
  let upserted = 0;

  for (const r of rows) {
    const team = resolveTeam(r.team);
    const opponent = resolveTeam(r.opponentTeam);
    if (!team || !opponent) {
      if (!team) unmatched.add(r.team);
      if (!opponent) unmatched.add(r.opponentTeam);
      continue;
    }

    await db
      .insert(teamWeekStats)
      .values({
        season: r.season,
        week: r.week,
        teamId: team.id,
        opponentTeamId: opponent.id,
        offPlays: r.offPlays,
        offEpa: r.offEpa,
      })
      .onConflictDoUpdate({
        target: [teamWeekStats.season, teamWeekStats.week, teamWeekStats.teamId],
        set: {
          opponentTeamId: opponent.id,
          offPlays: r.offPlays,
          offEpa: r.offEpa,
        },
      });
    upserted++;
  }

  await db.insert(syncLog).values({
    source: "nflverse",
    status: unmatched.size ? "partial" : "ok",
    message: unmatched.size
      ? `Upserted ${upserted} team-week rows. Unmatched abbreviations: ${[...unmatched].join(", ")}`
      : `Upserted ${upserted} team-week rows.`,
  });

  return { upserted, unmatched: [...unmatched] };
}

/**
 * One-time backfill of the previous season's games + EPA. Before the current
 * season has any games, the app shows last season's numbers as clearly-marked
 * placeholders (see getTeamRows) so EPA/Pythagorean columns aren't just blank
 * zeros - this is what populates the data behind that.
 */
export async function backfillPreviousSeasonIfNeeded(season: number) {
  const prevSeason = season - 1;

  const [hasGames, hasStats] = await Promise.all([
    db.select({ id: games.id }).from(games).where(eq(games.season, prevSeason)).limit(1),
    db.select({ id: teamWeekStats.id }).from(teamWeekStats).where(eq(teamWeekStats.season, prevSeason)).limit(1),
  ]);

  const tasks: Promise<unknown>[] = [];
  if (!hasGames.length) tasks.push(syncEspnSchedule(prevSeason));
  if (!hasStats.length) tasks.push(syncNflverseEpa(prevSeason));

  if (tasks.length) await Promise.allSettled(tasks);
}

/** Runs both syncs; used by the cron route and the manual "sync now" button. */
export async function runFullSync(season: number) {
  const [espn, nflverse] = await Promise.allSettled([
    syncEspnSchedule(season),
    syncNflverseEpa(season),
  ]);
  await backfillPreviousSeasonIfNeeded(season).catch((err) =>
    console.error("[sync] previous-season backfill failed:", err)
  );
  return { espn, nflverse };
}

export async function getLastSyncTime(): Promise<Date | null> {
  const rows = await db.select().from(syncLog).orderBy(desc(syncLog.ranAt)).limit(1);
  return rows[0]?.ranAt ?? null;
}
