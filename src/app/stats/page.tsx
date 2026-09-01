"use client";

import { useMemo } from "react";
import TopBar from "@/components/TopBar";
import LogoScatterChart, { ScatterPoint } from "@/components/LogoScatterChart";
import TeamRankingsTable from "@/components/TeamRankingsTable";
import QBStatsTable from "@/components/QBStatsTable";
import { useTeams } from "@/lib/useTeams";
import { fmtSignedPct } from "@/lib/format";
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

const pctFmt = (n: number) => fmtSignedPct(n, 2);

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

            <LogoScatterChart
              title={`Total EPA - Offense × Defense${isPlaceholder ? "*" : ""}`}
              xLabel="Off EPA/play"
              yLabel="Def EPA/play"
              points={totalEpaPoints}
              fmt={pctFmt}
              note="Negative defensive EPA/play is better. Top-right = strong offense, weak defense."
            />

            <LogoScatterChart
              title={`Off EPA - Pass × Rush${isPlaceholder ? "*" : ""}`}
              xLabel="Pass EPA/play"
              yLabel="Rush EPA/play"
              points={offEpaPoints}
              fmt={pctFmt}
            />

            <LogoScatterChart
              title={`Def EPA - Pass × Rush${isPlaceholder ? "*" : ""}`}
              xLabel="Pass EPA/play allowed"
              yLabel="Rush EPA/play allowed"
              points={defEpaPoints}
              fmt={pctFmt}
              note="More negative is better on both axes."
            />

            <div className="rounded-2xl border border-border bg-surface p-6 text-center">
              <p className="text-sm font-semibold">Past vs. future schedule</p>
              <p className="mt-1 text-sm text-muted">Coming soon.</p>
            </div>

            <LogoScatterChart
              title="MVP Watch - EPA/play × ANY/A*"
              xLabel="EPA/play"
              yLabel="ANY/A"
              points={mvpPoints}
              fmt={(n) => n.toFixed(2)}
              note="* Using ANY/A in place of passing yards - yards weren't available from a source we could reliably parse. 2025 season stats."
            />

            <TeamRankingsTable teams={teams} />

            <QBStatsTable />
          </div>
        )}
      </main>
    </>
  );
}
