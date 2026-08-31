"use client";

import TopBar from "@/components/TopBar";
import PlayerLeaderboard from "@/components/PlayerLeaderboard";
import StandingsTable from "@/components/StandingsTable";
import { useTeams } from "@/lib/useTeams";
import { groupByPlayer } from "@/lib/team-types";
import { fmtSignedMoney } from "@/lib/format";

export default function StandingsPage() {
  const { teams, loading, error } = useTeams();
  const groups = teams ? groupByPlayer(teams) : [];

  return (
    <>
      <TopBar title="Standings" />
      <main className="mx-auto max-w-2xl px-3 pt-4">
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            Couldn&apos;t load standings ({error}). Pull to refresh or check back shortly.
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            No draft picks entered yet. Head to the{" "}
            <a href="/admin" className="text-accent underline">
              Setup
            </a>{" "}
            tab to enter this year&apos;s auction results.
          </div>
        )}

        {groups.length > 0 && (
          <>
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted">Leaderboard</h2>
            <PlayerLeaderboard groups={groups} />
          </>
        )}

        {!loading && teams?.some((t) => t.epaIsPlaceholder || t.pythagoreanIsPlaceholder) && (
          <p className="mt-2 text-center text-[11px] text-muted">
            * shows last season&apos;s numbers until that team has played its first game this season
          </p>
        )}

        <div className="mt-6 space-y-6 pb-4">
          {groups.map((g, idx) => (
            <section key={g.playerId} id={`player-${g.playerId}`}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-base font-semibold">
                  <span className="mr-2 text-muted">#{idx + 1}</span>
                  {g.playerName}
                </h2>
                <div className="text-sm text-muted">
                  <span className="font-medium text-foreground">
                    {g.totalWins}-{g.totalLosses}
                    {g.totalTies ? `-${g.totalTies}` : ""}
                  </span>{" "}
                  · {fmtSignedMoney(g.totalValue)}
                </div>
              </div>
              <StandingsTable teams={g.teams} />
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
