"use client";

import { useMemo } from "react";
import TopBar from "@/components/TopBar";
import LogoScatterChart, { ScatterPoint } from "@/components/LogoScatterChart";
import TeamRankingsTable from "@/components/TeamRankingsTable";
import PlayoffOddsTable from "@/components/PlayoffOddsTable";
import QBStatsTable from "@/components/QBStatsTable";
import { useTeams } from "@/lib/useTeams";
import { useQbStats } from "@/lib/useQbStats";
import { fmtSignedPct, fmtNum, fmtPct } from "@/lib/format";

// Team-level EPA/play splits run roughly ±0.03-0.15 - 1 decimal on the
// percentage keeps the same digit count as how they're shown elsewhere
// in the app (e.g. Standings' EPA column).
const teamPctFmt = (n: number) => fmtSignedPct(n, 1);
// QB EPA/play as a whole-number percentage (67%, not 67.1% or 0.67).
const qbEpaFmt = (n: number) => fmtPct(n, 0);
const anyAFmt = (n: number) => fmtNum(n, 1);

export default function StatsPage() {
  const { teams, loading, error } = useTeams();
  const { qbs: liveQbs } = useQbStats();

  const isPlaceholder = useMemo(() => teams?.some((t) => t.epaIsPlaceholder) ?? false, [teams]);
  const placeholderSeason = useMemo(
    () => teams?.find((t) => t.epaIsPlaceholder)?.placeholderSeason ?? null,
    [teams]
  );

  const totalEpaPoints: ScatterPoint[] = useMemo(
    () =>
      (teams ?? []).map((t) => ({
        key: t.abbr,
        label: t.shortName,
        logoUrl: t.logoUrl,
        x: t.offEpa,
        y: t.defEpa,
      })),
    [teams]
  );

  const offEpaPoints: ScatterPoint[] = useMemo(
    () =>
      (teams ?? []).map((t) => ({
        key: t.abbr,
        label: t.shortName,
        logoUrl: t.logoUrl,
        x: t.offPassEpa,
        y: t.offRushEpa,
      })),
    [teams]
  );

  const defEpaPoints: ScatterPoint[] = useMemo(
    () =>
      (teams ?? []).map((t) => ({
        key: t.abbr,
        label: t.shortName,
        logoUrl: t.logoUrl,
        x: t.defPassEpa,
        y: t.defRushEpa,
      })),
    [teams]
  );

  const mvpPoints: ScatterPoint[] = useMemo(
    () =>
      (liveQbs ?? [])
        .filter((q) => q.epaPlay !== null && q.anyA !== null)
        .map((q) => ({
          key: `${q.abbr ?? "FA"}-${q.name}`,
          label: q.abbr ? `${q.name} (${q.abbr})` : q.name,
          logoUrl: q.logoUrl,
          x: q.epaPlay as number,
          y: q.anyA as number,
        })),
    [liveQbs]
  );

  const schedulePoints: ScatterPoint[] = useMemo(
    () =>
      (teams ?? [])
        .filter((t) => t.pastOpponentEpa !== null && t.futureOpponentEpa !== null)
        .map((t) => ({
          key: t.abbr,
          label: t.shortName,
          logoUrl: t.logoUrl,
          x: t.pastOpponentEpa as number,
          y: t.futureOpponentEpa as number,
        })),
    [teams]
  );
  const scheduleIsPreseason = teams?.some((t) => t.scheduleIsPreseason) ?? false;

  return (
    <>
      <TopBar title="Stats" />
      <main className="mx-auto max-w-2xl px-3 pt-4 pb-6">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            Couldn&apos;t load stats ({error}). Pull to refresh or check back shortly.
          </div>
        )}

        {!loading && !error && teams && (
          <div className="space-y-4">
            {isPlaceholder && (
              <p className="rounded-xl border border-border bg-surface px-3 py-2 text-[11px] text-muted">
                * Showing {placeholderSeason} team EPA data until this season&apos;s ratings are
                logged - updates automatically once the commissioner pastes this week&apos;s nfelo
                numbers.
              </p>
            )}

            <TeamRankingsTable teams={teams} />

            <PlayoffOddsTable teams={teams} />

            <LogoScatterChart
              title={`Total EPA${isPlaceholder ? "*" : ""}`}
              xLabel="Off EPA/play"
              yLabel="Def EPA/play"
              points={totalEpaPoints}
              xFmt={teamPctFmt}
              yFmt={teamPctFmt}
              yReversed
              note="Def EPA/play axis is flipped so up = better defense, same as every other axis - the underlying number is still negative-is-good. Top-right = best teams overall."
            />

            <LogoScatterChart
              title={`Off EPA${isPlaceholder ? "*" : ""}`}
              xLabel="Pass EPA/play"
              yLabel="Rush EPA/play"
              points={offEpaPoints}
              xFmt={teamPctFmt}
              yFmt={teamPctFmt}
            />

            <LogoScatterChart
              title={`Def EPA${isPlaceholder ? "*" : ""}`}
              xLabel="Pass EPA/play allowed"
              yLabel="Rush EPA/play allowed"
              points={defEpaPoints}
              xFmt={teamPctFmt}
              yFmt={teamPctFmt}
              note="More negative is better on both axes."
            />

            {schedulePoints.length > 0 ? (
              <LogoScatterChart
                title={`Past vs. Future Schedule${scheduleIsPreseason ? "*" : ""}`}
                xLabel="Past opp. EPA/play"
                yLabel="Future opp. EPA/play"
                points={schedulePoints}
                xFmt={teamPctFmt}
                yFmt={teamPctFmt}
                note={
                  scheduleIsPreseason
                    ? "* Season hasn't started - \"past\" uses last season's completed schedule as a stand-in, \"future\" uses this year's full schedule. Switches to real in-season splits after Week 1."
                    : "Past = opponents already played; future = opponents left to play, both by avg opponent EPA/play. Top-right = tough schedule already, tough schedule ahead too."
                }
              />
            ) : (
              <div className="rounded-2xl border border-border bg-surface p-6 text-center">
                <p className="text-sm font-semibold">Past vs. Future Schedule</p>
                <p className="mt-1 text-sm text-muted">
                  No schedule data to compare yet - tap the sync button (top right) to pull last
                  season&apos;s completed games, then reload.
                </p>
              </div>
            )}

            <LogoScatterChart
              title="MVP Watch"
              xLabel="EPA/play"
              yLabel="ANY/A"
              points={mvpPoints}
              xFmt={qbEpaFmt}
              yFmt={anyAFmt}
              note="Live QB EPA Leaders export, latest logged week."
            />

            <QBStatsTable />
          </div>
        )}
      </main>
    </>
  );
}
