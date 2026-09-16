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
        <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: "7%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-1 py-1.5 text-center font-semibold">#</th>
                <th className="px-1 py-1.5 text-left font-semibold">Team</th>
                <th className="px-1 py-1.5 text-center font-semibold">DAVE</th>
                <th className="px-1 py-1.5 text-center font-semibold">Mean W</th>
                <th className="px-1 py-1.5 text-center font-semibold">Div%</th>
                <th className="px-1 py-1.5 text-center font-semibold">WC%</th>
                <th className="px-1 py-1.5 text-center font-semibold">PO%</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr
                  key={t.id}
                  className="border-b border-border last:border-b-0 odd:bg-surface even:bg-surface-2"
                >
                  <td className="px-1 py-1.5 text-center text-xs text-muted">{i + 1}</td>
                  <td className="px-1 py-1.5">
                    <div className="flex min-w-0 items-center gap-1">
                      <Image
                        src={t.logoUrl}
                        alt={t.abbr}
                        width={14}
                        height={14}
                        unoptimized
                        className="flex-shrink-0"
                      />
                      <span className="truncate text-[11px] font-medium">{t.abbr}</span>
                    </div>
                  </td>
                  <td className="px-1 py-1.5 text-center text-[10px] tabular-nums text-muted">
                    {fmtSignedPct(t.dave, 1)}
                  </td>
                  <td className="px-1 py-1.5 text-center text-[10px] tabular-nums text-muted">
                    {fmtNum(t.meanWins, 1)}
                  </td>
                  <td className="px-1 py-1.5 text-center text-[10px] tabular-nums text-muted">
                    {fmtPct(t.playoffDiv, 0)}
                  </td>
                  <td className="px-1 py-1.5 text-center text-[10px] tabular-nums text-muted">
                    {fmtPct(t.playoffWc, 0)}
                  </td>
                  <td className="px-1 py-1.5 text-center text-[10px] tabular-nums font-medium">
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
