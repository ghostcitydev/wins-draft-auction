"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { PlayerGroup } from "@/lib/team-types";
import { fmtNum, fmtSigned, fmtMoney, fmtSignedMoney, fmtPct, fmtSignedPct } from "@/lib/format";

type SortKey = "player" | "w" | "l" | "pct" | "ou" | "paid" | "value" | "diff" | "proj" | "pyth" | "epa";

const COLUMNS: {
  key: SortKey;
  label: string;
  format: (g: PlayerGroup) => string;
  value: (g: PlayerGroup) => number;
  positive?: (g: PlayerGroup) => boolean;
}[] = [
  { key: "w", label: "W", format: (g) => `${g.totalWins}`, value: (g) => g.totalWins },
  { key: "l", label: "L", format: (g) => `${g.totalLosses}`, value: (g) => g.totalLosses },
  { key: "pct", label: "PCT", format: (g) => fmtPct(g.winPct), value: (g) => g.winPct },
  { key: "ou", label: "O/U", format: (g) => fmtNum(g.totalPreseasonOU), value: (g) => g.totalPreseasonOU },
  { key: "paid", label: "Paid", format: (g) => fmtMoney(g.totalPaid), value: (g) => g.totalPaid },
  {
    key: "value",
    label: "Value",
    format: (g) => fmtSignedMoney(g.totalValue),
    value: (g) => g.totalValue,
    positive: (g) => g.totalValue > 0,
  },
  {
    key: "diff",
    label: "Diff",
    format: (g) => fmtSigned(g.avgDiff),
    value: (g) => g.avgDiff,
    positive: (g) => g.avgDiff > 0,
  },
  { key: "proj", label: "Proj", format: (g) => fmtNum(g.totalProjected), value: (g) => g.totalProjected },
  { key: "pyth", label: "Pyth", format: (g) => fmtNum(g.totalPythagoreanWins), value: (g) => g.totalPythagoreanWins },
  {
    key: "epa",
    label: "EPA",
    format: (g) => fmtSignedPct(g.avgEpa),
    value: (g) => g.avgEpa,
    positive: (g) => g.avgEpa > 0,
  },
];

export default function PlayerLeaderboard({ groups }: { groups: PlayerGroup[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("pct");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setDir(key === "player" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    const copy = [...groups];
    if (sortKey === "player") {
      copy.sort((a, b) =>
        dir === "asc" ? a.playerName.localeCompare(b.playerName) : b.playerName.localeCompare(a.playerName)
      );
    } else {
      const col = COLUMNS.find((c) => c.key === sortKey)!;
      copy.sort((a, b) => (dir === "asc" ? col.value(a) - col.value(b) : col.value(b) - col.value(a)));
    }
    return copy;
  }, [groups, sortKey, dir]);

  const arrow = (key: SortKey) => (key === sortKey ? (dir === "desc" ? "▾" : "▴") : "");

  return (
    <div className="flex overflow-x-auto no-scrollbar rounded-2xl border border-border">
      <div className="sticky left-0 z-10 flex-shrink-0 bg-surface">
        <button
          type="button"
          onClick={() => handleSort("player")}
          className={clsx(
            "flex h-9 w-full items-center gap-1 border-b border-border px-2.5 text-xs font-semibold",
            sortKey === "player" ? "text-foreground" : "text-muted"
          )}
        >
          Player <span className="text-[9px]">{arrow("player")}</span>
        </button>
        {sorted.map((g, i) => (
          <Link
            key={g.playerId}
            href={`#player-${g.playerId}`}
            className={clsx(
              "flex h-11 items-center gap-2 border-b border-border px-2.5 active:bg-surface-2",
              i === sorted.length - 1 && "border-b-0"
            )}
            style={{ minWidth: 136 }}
          >
            <span className="w-4 flex-shrink-0 text-xs text-muted">{i + 1}</span>
            <span className="truncate text-[13px] font-semibold">{g.playerName}</span>
          </Link>
        ))}
      </div>

      <div className="flex-shrink-0">
        <div className="flex h-9 border-b border-border">
          {COLUMNS.map((col) => (
            <button
              key={col.label}
              type="button"
              onClick={() => handleSort(col.key)}
              className={clsx(
                "flex w-[54px] flex-shrink-0 items-center justify-center gap-0.5 text-xs font-semibold",
                sortKey === col.key ? "text-foreground" : "text-muted"
              )}
            >
              {col.label} <span className="text-[9px]">{arrow(col.key)}</span>
            </button>
          ))}
        </div>
        {sorted.map((g) => (
          <div key={g.playerId} className="flex h-11 border-b border-border last:border-b-0">
            {COLUMNS.map((col) => {
              const isPositive = col.positive?.(g);
              return (
                <div
                  key={col.label}
                  className={clsx(
                    "flex w-[54px] flex-shrink-0 items-center justify-center text-[13px] tabular-nums",
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
