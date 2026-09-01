"use client";

import Image from "next/image";
import { fmtNum, fmtSignedPct, fmtPct } from "@/lib/format";
import qbStats from "../../prisma/seed-data/qb-stats-2025.json";

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

const qbs = (qbStats as QBStat[]).slice().sort((a, b) => a.rank - b.rank);

export default function QBStatsTable() {
  const season = qbs[0]?.season ?? 2025;

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="mb-2 px-1 text-sm font-semibold">
        QB stats <span className="align-super text-[10px] text-muted">*</span>
      </p>
      <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col style={{ width: 26 }} />
            <col />
            <col style={{ width: 50 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 46 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border text-xs text-muted">
              <th className="px-1 py-1.5 text-center font-semibold">#</th>
              <th className="px-1.5 py-1.5 text-left font-semibold">QB</th>
              <th className="px-1 py-1.5 text-center font-semibold">EPA/pl</th>
              <th className="px-1 py-1.5 text-center font-semibold">CPOE</th>
              <th className="px-1 py-1.5 text-center font-semibold">ANY/A</th>
              <th className="px-1 py-1.5 text-center font-semibold">Succ%</th>
            </tr>
          </thead>
          <tbody>
            {qbs.map((q) => (
              <tr key={`${q.abbr}-${q.name}`} className="border-b border-border last:border-b-0 odd:bg-surface even:bg-surface-2">
                <td className="px-1 py-1.5 text-center text-xs text-muted">{q.rank}</td>
                <td className="px-1.5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Image src={`/logos/${q.abbr}.png`} alt={q.abbr} width={16} height={16} unoptimized />
                    <span className="truncate text-[12px]">{q.name}</span>
                  </div>
                </td>
                <td className="px-1 py-1.5 text-center tabular-nums text-[12px]">{fmtSignedPct(q.epaPlay, 2)}</td>
                <td className="px-1 py-1.5 text-center tabular-nums text-[12px]">{fmtSignedPct(q.cpoe, 1)}</td>
                <td className="px-1 py-1.5 text-center tabular-nums text-[12px]">{fmtNum(q.anyA, 1)}</td>
                <td className="px-1 py-1.5 text-center tabular-nums text-[12px]">{fmtPct(q.successRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-muted">
        * {season} season stats. Passing yards and TDs aren&apos;t shown here - nfelo has no public
        API and its published table for these wasn&apos;t in a format we could safely transcribe
        without risking wrong numbers, so we left them out rather than guess.
      </p>
    </div>
  );
}
