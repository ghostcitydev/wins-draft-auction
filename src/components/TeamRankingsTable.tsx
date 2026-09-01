"use client";

import Image from "next/image";
import type { TeamRow } from "@/lib/team-types";
import { fmtSignedPct } from "@/lib/format";

interface RankColumn {
  label: string;
  // Ascending sort = best value is the lowest number (used for defense,
  // where more negative EPA/play is better).
  direction: "desc" | "asc";
  value: (t: TeamRow) => number;
}

const COLUMNS: RankColumn[] = [
  { label: "Pass Off", direction: "desc", value: (t) => t.offPassEpa },
  { label: "Rush Off", direction: "desc", value: (t) => t.offRushEpa },
  { label: "Pass Def", direction: "asc", value: (t) => t.defPassEpa },
  { label: "Rush Def", direction: "asc", value: (t) => t.defRushEpa },
  { label: "Total EPA", direction: "desc", value: (t) => t.epa },
];

// Same digit-shift convention as the scatter charts - team EPA/play splits
// run roughly ±0.03-0.15, so 1 decimal on the percentage keeps the same
// precision as the raw fraction.
const fmt = (n: number) => fmtSignedPct(n, 1);

export default function TeamRankingsTable({ teams }: { teams: TeamRow[] }) {
  const ranked = COLUMNS.map((col) => {
    const sorted = [...teams].sort((a, b) =>
      col.direction === "desc" ? col.value(b) - col.value(a) : col.value(a) - col.value(b)
    );
    return { col, sorted };
  });

  const rowCount = teams.length;

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="mb-2 px-1 text-sm font-semibold">Team rankings</p>
      <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
        <table className="text-sm">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border text-xs text-muted">
              <th className="w-7 px-1 py-1.5 text-center font-semibold">#</th>
              {COLUMNS.map((c) => (
                <th key={c.label} className="whitespace-nowrap px-2.5 py-1.5 text-left font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, i) => (
              <tr key={i} className="border-b border-border last:border-b-0 odd:bg-surface even:bg-surface-2">
                <td className="px-1 py-1.5 text-center text-xs text-muted">{i + 1}</td>
                {ranked.map(({ col, sorted }) => {
                  const t = sorted[i];
                  return (
                    <td key={col.label} className="whitespace-nowrap px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Image src={t.logoUrl} alt={t.abbr} width={16} height={16} unoptimized />
                        <span className="text-[12px] font-medium">{t.abbr}</span>
                        <span className="ml-auto pl-2 text-[11px] tabular-nums text-muted">
                          {fmt(col.value(t))}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-muted">
        Pass/Rush Off ranked by EPA/play (higher is better) · Pass/Rush Def ranked by EPA/play
        allowed (more negative is better)
      </p>
    </div>
  );
}
