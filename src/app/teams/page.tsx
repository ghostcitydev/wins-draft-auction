"use client";

import TopBar from "@/components/TopBar";
import StandingsTable from "@/components/StandingsTable";
import { useTeams } from "@/lib/useTeams";

export default function TeamsPage() {
  const { teams, loading, error } = useTeams();

  return (
    <>
      <TopBar title="Teams" />
      <main className="mx-auto max-w-2xl px-3 pt-4">
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            Couldn&apos;t load teams ({error}). Pull to refresh or check back shortly.
          </div>
        )}

        {!loading && !error && teams && teams.every((t) => t.paid === null) && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            No draft picks entered yet. Head to the{" "}
            <a href="/admin" className="text-accent underline">
              Setup
            </a>{" "}
            tab to enter this year&apos;s auction results.
          </div>
        )}

        {!loading && !error && teams && teams.length > 0 && (
          <StandingsTable teams={teams} />
        )}

        <p className="mt-3 pb-1 text-center text-[11px] text-muted">
          Scroll sideways for more stats · tap a team for its full schedule
        </p>
        {!loading && teams?.some((t) => t.epaIsPlaceholder || t.pythagoreanIsPlaceholder) && (
          <p className="pb-2 text-center text-[11px] text-muted">
            * shows last season&apos;s numbers until that team has played its first game this season
          </p>
        )}
      </main>
    </>
  );
}
