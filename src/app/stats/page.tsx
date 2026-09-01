"use client";

import { useMemo } from "react";
import TopBar from "@/components/TopBar";
import LogoScatterChart, { ScatterPoint } from "@/components/LogoScatterChart";
import TeamRankingsTable from "@/components/TeamRankingsTable";
import QBStatsTable from "@/components/QBStatsTable";
import { useTeams } from "@/lib/useTeams";
import { fmtSignedPct, fmtNum } from "@/lib/format";
import qbStats from "../../../prisma/seed-data/qb-stats-2025.json";

interface QBStat {
  rank: number;
  name: string;
  abbr: string;
  season: number;
  epaPlay: number;
  wpa: number;
  cpoe: number;
  anyA: number;
  successRate: number;
}

// Team-level EPA/play splits run roughly ±0.03-0.15 - 1 decimal on the
// percentage keeps the same digit count as how they're shown elsewhere
// in the app (e.g. Standings' EPA column).
const teamPctFmt = (n: number) => fmtSignedPct(n, 1);
// QB EPA/play is an order of magnitude smaller (±0.001-0.02), so it needs
// an extra decimal to preserve the same precision once shifted to a percent.
const qbEpaPctFmt = (n: number) => fmtSignedPct(n, 2);
const anyAFmt = (n: number) => fmtNum(n, 1);

export default function StatsPage() {
  const { teams, loading, error } = useTeams();

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

  const mvpPoints: ScatterPoint[] = useMemo(() => {
    const logoByAbbr = new Map((teams ?? []).map((t) => [t.abbr, t.logoUrl]));
    return (qbStats as QBStat[]).map((q) => ({
      key: `${q.abbr}-${q.name}`,
      label: `${q.name} (${q.abbr})`,
      logoUrl: logoByAbbr.get(q.abbr) ?? `/logos/${q.abbr}.png`,
      x: q.epaPlay,
      y: q.anyA,
    }));
  }, [teams]);

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

            <LogoScatterChart
              title={`Total EPA${isPlaceholder ? "*" : ""}`}
              xLabel="Off EPA/play"
              yLabel="Def EPA/play"
              points={totalEpaPoints}
              xFmt={teamPctFmt}
              yFmt={teamPctFmt}
              note="Negative defensive EPA/play is better. Top-right = strong offense, weak defense."
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

            <LogoScatterChart
              title="MVP Watch*"
              xLabel="EPA/play"
              yLabel="ANY/A"
              points={mvpPoints}
              xFmt={qbEpaPctFmt}
              yFmt={anyAFmt}
              note="* Using ANY/A in place of passing yards - yards weren't available from a source we could reliably parse. 2025 season stats."
            />

            <QBStatsTable />
          </div>
        )}
      </main>
    </>
  );
}
