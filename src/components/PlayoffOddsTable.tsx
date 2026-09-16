"use client";

import Image from "next/image";
import type { TeamRow } from "@/lib/team-types";
import { fmtPct, fmtSignedPct, fmtNum } from "@/lib/format";

export default function PlayoffOddsTable({ teams }: { teams: TeamRow[] }) {
  const hasData = teams.some((t) => t.playoffTot !== null);
  const sorted = [...teams].sort((a, b) => (b.playoffTot ?? -1) - (a.playoffTot ?? -1));

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="mb-2 px-1 text-sm font-semibold">DVOA &amp; playoff odds</p>

      {!hasData ? (
        <p className="px-1 text-sm text-muted">
          No playoff-odds snapshot logged yet - paste FTN&apos;s DVOA/playoff-odds report on the
          setup page.
        </p>
      ) : (
        <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
          <table className="text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-border text-xs text-muted">
                <th className="w-7 px-1 py-1.5 text-center font-semibold">#</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-left font-semibold">Team</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-left font-semibold">DAVE</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-left font-semibold">Mean W</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-left font-semibold">Div%</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-left font-semibold">WC%</th>
                <th className="whitespace-nowrap px-2.5 py-1.5 text-left font-semibold">Make PO%</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr
                  key={t.id}
                  className="border-b border-border last:border-b-0 odd:bg-surface even:bg-surface-2"
                >
                  <td className="px-1 py-1.5 text-center text-xs text-muted">{i + 1}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Image src={t.logoUrl} alt={t.abbr} width={16} height={16} unoptimized />
                      <span className="text-[12px] font-medium">{t.abbr}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-[11px] tabular-nums text-muted">
                    {fmtSignedPct(t.dave, 1)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-[11px] tabular-nums text-muted">
                    {fmtNum(t.meanWins, 1)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-[11px] tabular-nums text-muted">
                    {fmtPct(t.playoffDiv, 0)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-[11px] tabular-nums text-muted">
                    {fmtPct(t.playoffWc, 0)}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-[11px] tabular-nums font-medium">
                    {fmtPct(t.playoffTot, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-1.5 px-1 text-[11px] text-muted">
        DAVE = DVOA + preseason projection blend · Mean W = simulated mean wins · Make PO% = odds
        of making the playoffs (FTN Fantasy, 25,000-simulation model)
      </p>
    </div>
  );
}
