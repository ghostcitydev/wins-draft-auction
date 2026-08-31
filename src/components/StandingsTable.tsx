"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import type { TeamRow } from "@/lib/team-types";
import { fmtNum, fmtSigned, fmtMoney, fmtSignedMoney, fmtPct } from "@/lib/format";

type SortKey =
  | "wins"
  | "losses"
  | "winPct"
  | "preseasonOU"
  | "paid"
  | "value"
  | "diff"
  | "projected"
  | "pythagoreanWins"
  | "epa";

const COLUMNS: {
  key: SortKey;
  label: string;
  format: (r: TeamRow) => string;
  positive?: (r: TeamRow) => boolean | null;
  placeholder?: (r: TeamRow) => boolean;
}[] = [
  { key: "wins", label: "W", format: (r) => `${r.wins}` },
  { key: "losses", label: "L", format: (r) => `${r.losses}` },
  { key: "winPct", label: "PCT", format: (r) => fmtPct(r.winPct) },
  { key: "preseasonOU", label: "O/U", format: (r) => fmtNum(r.preseasonOU) },
  { key: "paid", label: "Paid", format: (r) => fmtMoney(r.paid) },
  { key: "value", label: "Value", format: (r) => fmtSignedMoney(r.value), positive: (r) => (r.value ?? 0) > 0 },
  { key: "diff", label: "Diff", format: (r) => fmtSigned(r.diff), positive: (r) => r.diff > 0 },
  { key: "projected", label: "Proj", format: (r) => fmtNum(r.projected) },
  {
    key: "pythagoreanWins",
    label: "Pyth",
    format: (r) => fmtNum(r.pythagoreanWins),
    placeholder: (r) => r.pythagoreanIsPlaceholder,
  },
  {
    key: "epa",
    label: "EPA",
    format: (r) => fmtSigned(r.epa, 3),
    positive: (r) => r.epa > 0,
    placeholder: (r) => r.epaIsPlaceholder,
  },
];

export default function StandingsTable({ teams }: { teams: TeamRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("wins");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const sorted = useMemo(() => {
    const copy = [...teams];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return (av - bv) * sortDir;
    });
    return copy;
  }, [teams, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(-1);
    }
  };

  return (
    <div className="flex overflow-x-auto no-scrollbar rounded-2xl border border-border">
      {/* Sticky team column */}
      <div className="sticky left-0 z-10 flex-shrink-0 bg-surface">
        <div className="flex h-10 items-center border-b border-border px-3 text-xs font-semibold text-muted">
          Team
        </div>
        {sorted.map((t, i) => (
          <Link
            key={t.id}
            href={`/teams/${t.abbr}`}
            className={clsx(
              "flex h-16 items-center gap-2.5 border-b border-border px-3 active:bg-surface-2",
              i === sorted.length - 1 && "border-b-0"
            )}
            style={{ minWidth: 168 }}
          >
            <Image src={t.logoUrl} alt={t.abbr} width={30} height={30} className="flex-shrink-0" unoptimized />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{t.shortName}</div>
              <div className="truncate text-[11px] text-muted">
                {t.playerName ?? "Undrafted"}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Scrollable stat columns */}
      <div className="flex-shrink-0">
        <div className="flex h-10 border-b border-border">
          {COLUMNS.map((col, idx) => (
            <button
              key={col.label + idx}
              onClick={() => handleSort(col.key)}
              className="flex w-[62px] flex-shrink-0 items-center justify-center gap-0.5 text-xs font-semibold text-muted"
            >
              {col.label}
              {sortKey === col.key && (
                <span className="text-accent">{sortDir === 1 ? "▲" : "▼"}</span>
              )}
            </button>
          ))}
        </div>
        {sorted.map((t) => (
          <div key={t.id} className="flex h-16 border-b border-border last:border-b-0">
            {COLUMNS.map((col, idx) => {
              const isPositive = col.positive?.(t);
              const isPlaceholder = col.placeholder?.(t);
              return (
                <div
                  key={col.label + idx}
                  className={clsx(
                    "flex w-[62px] flex-shrink-0 items-center justify-center text-sm tabular-nums",
                    isPositive === true && !isPlaceholder && "text-accent",
                    isPositive === false && !isPlaceholder && "text-danger",
                    isPlaceholder && "italic text-muted"
                  )}
                  title={isPlaceholder ? `${t.placeholderSeason} placeholder - ${t.abbr} hasn't played yet this season` : undefined}
                >
                  {col.format(t)}
                  {isPlaceholder && <span className="ml-0.5 align-super text-[9px]">*</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
