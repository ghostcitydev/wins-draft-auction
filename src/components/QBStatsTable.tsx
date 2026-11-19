"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { fmtNum, fmtPct } from "@/lib/format";
import { useQbStats } from "@/lib/useQbStats";
import type { QbStatRow } from "@/app/api/qb-stats/route";

// Whole-number percentage (67%, not 67.1% or 0.67).
const qbEpaFmt = (n: number | null) => fmtPct(n, 0);

type SortKey = "mvpIndex" | "epaPlay" | "anyA" | "totalYds" | "totalTd" | "qbWins";

const COLUMNS: { key: SortKey; label: string; fmt: (n: number | null) => string }[] = [
  { key: "mvpIndex", label: "MVP", fmt: (n) => fmtNum(n, 1) },
  { key: "epaPlay", label: "EPA/pl", fmt: qbEpaFmt },
  { key: "anyA", label: "ANY/A", fmt: (n) => fmtNum(n, 1) },
  { key: "totalYds", label: "Yds", fmt: (n) => fmtNum(n, 0) },
  { key: "totalTd", label: "TD", fmt: (n) => fmtNum(n, 0) },
  { key: "qbWins", label: "W", fmt: (n) => fmtNum(n, 0) },
];

export default function QBStatsTable() {
  const { qbs, week, loading, error } = useQbStats();
  const [sortKey, setSortKey] = useState<SortKey>("mvpIndex");

  const sorted = useMemo(
    () =>
      [...(qbs ?? [])].sort(
        (a: QbStatRow, b: QbStatRow) => (b[sortKey] ?? -Infinity) - (a[sortKey] ?? -Infinity)
      ),
    [qbs, sortKey]
  );

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
              <col style={{ width: "6%" }} />
              <col style={{ width: "28%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-1 py-1.5 text-center font-semibold">#</th>
                <th className="px-2 py-1.5 text-left font-semibold">QB</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="px-0.5 py-1.5 text-center font-semibold">
                    <button
                      type="button"
                      onClick={() => setSortKey(c.key)}
                      className={sortKey === c.key ? "text-foreground underline" : "hover:underline"}
                    >
                      {c.label}
                      {sortKey === c.key ? " ▾" : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((q, i) => (
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
                  {COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className={`px-0.5 py-1.5 text-center tabular-nums text-[11px] ${
                        c.key === "mvpIndex" ? "font-semibold" : "text-muted"
                      }`}
                    >
                      {c.fmt(q[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-1.5 px-1 text-[11px] text-muted">
        * {week ? `Week ${week}` : "Latest week"} - EPA/play, ANY/A, passing yards and total TDs
        (passing + rushing) from nfelo; QB wins as the starter from nflverse. MVP Index (0-100)
        scales each stat across this list and weights EPA/play, TDs, ANY/A and yards 15% each and
        wins 40%. Tap a column to sort.
      </p>
    </div>
  );
}
