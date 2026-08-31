import { getLastSyncTime, runFullSync } from "./sync";

const STALE_MS = 15 * 60 * 1000; // 15 minutes

let inFlight: Promise<unknown> | null = null;

/**
 * Demand-driven refresh: if the data hasn't been synced recently, sync it
 * before serving the request. This is what makes the app feel "live" without
 * depending on how often (or whether) a cron job is configured - a visit to
 * the page is enough to pull fresh scores/EPA.
 */
export async function syncIfStale(season: number): Promise<void> {
  try {
    const last = await getLastSyncTime();
    const isStale = !last || Date.now() - last.getTime() > STALE_MS;
    if (!isStale) return;

    if (!inFlight) {
      inFlight = runFullSync(season).finally(() => {
        inFlight = null;
      });
    }
    await inFlight;
  } catch (err) {
    // Never let a sync failure break the page - just log it and serve
    // whatever data is already in the database.
    console.error("[auto-sync] failed:", err);
  }
}
