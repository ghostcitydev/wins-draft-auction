"use client";

import Link from "next/link";
import clsx from "clsx";
import type { PlayerGroup } from "@/lib/team-types";
import { fmtNum, fmtSigned, fmtMoney, fmtSignedMoney, fmtPct } from "@/lib/format";

const COLUMNS: { label: string; format: (g: PlayerGroup) => string; positive?: (g: PlayerGroup) => boolean }[] = [
  { label: "W", format: (g) => `${g.totalWins}` },
  { label: "L", format: (g) => `${g.totalLosses}` },
  { label: "PCT", format: (g) => fmtPct(g.winPct) },
  { label: "O/U", format: (g) => fmtNum(g.avgPreseasonOU) },
  { label: "Paid", format: (g) => fmtMoney(g.totalPaid) },
  { label: "Value", format: (g) => fmtSignedMoney(g.totalValue), positive: (g) => g.totalValue > 0 },
  { label: "Diff", format: (g) => fmtSigned(g.avgDiff), positive: (g) => g.avgDiff > 0 },
  { label: "Proj", format: (g) => fmtNum(g.totalProjected) },
  { label: "Pyth", format: (g) => fmtNum(g.totalPythagoreanWins) },
  { label: "EPA", format: (g) => fmtSigned(g.avgEpa, 3), positive: (g) => g.avgEpa > 0 },
];

export default function PlayerLeaderboard({ groups }: { groups: PlayerGroup[] }) {
  return (
    <div className="flex overflow-x-auto no-scrollbar rounded-2xl border border-border">
      <div className="sticky left-0 z-10 flex-shrink-0 bg-surface">
        <div className="flex h-10 items-center border-b border-border px-3 text-xs font-semibold text-muted">
          Player
        </div>
        {groups.map((g, i) => (
          <Link
            key={g.playerId}
            href={`#player-${g.playerId}`}
            className={clsx(
              "flex h-12 items-center gap-2 border-b border-border px-3 active:bg-surface-2",
              i === groups.length - 1 && "border-b-0"
            )}
            style={{ minWidth: 148 }}
          >
            <span className="w-4 flex-shrink-0 text-xs text-muted">{i + 1}</span>
            <span className="truncate text-sm font-semibold">{g.playerName}</span>
          </Link>
        ))}
      </div>

      <div className="flex-shrink-0">
        <div className="flex h-10 border-b border-border">
          {COLUMNS.map((col) => (
            <div key={col.label} className="flex w-[62px] flex-shrink-0 items-center justify-center text-xs font-semibold text-muted">
              {col.label}
            </div>
          ))}
        </div>
        {groups.map((g) => (
          <div key={g.playerId} className="flex h-12 border-b border-border last:border-b-0">
            {COLUMNS.map((col) => {
              const isPositive = col.positive?.(g);
              return (
                <div
                  key={col.label}
                  className={clsx(
                    "flex w-[62px] flex-shrink-0 items-center justify-center text-sm tabular-nums",
                    isPositive === true && "text-accent",
                    isPositive === false && col.label === "Value" && g.totalValue < 0 && "text-danger",
                    isPositive === false && col.label === "Diff" && g.avgDiff < 0 && "text-danger",
                    isPositive === false && col.label === "EPA" && g.avgEpa < 0 && "text-danger"
                  )}
                >
                  {col.format(g)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
