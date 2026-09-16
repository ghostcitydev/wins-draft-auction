"use client";

import Image from "next/image";
import { fmtNum } from "@/lib/format";
import { useQbStats } from "@/lib/useQbStats";

// QB EPA/play is shown as the plain per-play decimal (0.69, 0.67, ...), not
// shifted into a percentage like team-level EPA/play.
const qbEpaFmt = (n: number | null) => fmtNum(n, 2);

export default function QBStatsTable() {
  const { qbs, week, loading, error } = useQbStats();

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="mb-2 px-1 text-sm font-semibold">
        QB stats <span className="align-super text-[10px] text-muted">*</span>
      </p>

      {loading && <div className="h-40 animate-pulse rounded-xl bg-surface-2" />}

      {!loading && error && (
        <p className="px-1 text-sm text-muted">Couldn&apos;t load QB stats ({error}).</p>
      )}

      {!loading && !error && (!qbs || qbs.length === 0) && (
        <p className="px-1 text-sm text-muted">
          No QB stats logged yet - paste this week&apos;s nfelo Live QB EPA Leaders export on the
          setup page.
        </p>
      )}

      {!loading && !error && qbs && qbs.length > 0 && (
        <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: "7%" }} />
              <col style={{ width: "29%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-1 py-1.5 text-center font-semibold">#</th>
                <th className="px-2 py-1.5 text-left font-semibold">QB</th>
                <th className="px-1 py-1.5 text-center font-semibold">EPA/pl</th>
                <th className="px-1 py-1.5 text-center font-semibold">ANY/A</th>
                <th className="px-1 py-1.5 text-center font-semibold">Yds</th>
                <th className="px-1 py-1.5 text-center font-semibold">TD</th>
              </tr>
            </thead>
            <tbody>
              {qbs.map((q, i) => (
                <tr
                  key={`${q.abbr ?? "FA"}-${q.name}`}
                  className="border-b border-border last:border-b-0 odd:bg-surface even:bg-surface-2"
                >
                  <td className="px-1 py-1.5 text-center text-xs text-muted">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Image src={q.logoUrl} alt={q.abbr ?? ""} width={16} height={16} unoptimized />
                      <span className="truncate text-[12px]">{q.name}</span>
                    </div>
                  </td>
                  <td className="px-1 py-1.5 text-center tabular-nums text-[11px] text-muted">
                    {qbEpaFmt(q.epaPlay)}
                  </td>
                  <td className="px-1 py-1.5 text-center tabular-nums text-[11px] text-muted">
                    {fmtNum(q.anyA, 1)}
                  </td>
                  <td className="px-1 py-1.5 text-center tabular-nums text-[11px] text-muted">
                    {fmtNum(q.totalYds, 0)}
                  </td>
                  <td className="px-1 py-1.5 text-center tabular-nums text-[11px] text-muted">
                    {fmtNum(q.totalTd, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-1.5 px-1 text-[11px] text-muted">
        * {week ? `Week ${week}` : "Latest week"} - EPA/play, ANY/A, total yards and total TDs from
        nfelo&apos;s Live QB EPA Leaders export. Ranked by EPA/play.
      </p>
    </div>
  );
}
