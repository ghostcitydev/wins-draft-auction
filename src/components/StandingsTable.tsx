"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import type { TeamRow } from "@/lib/team-types";
import { fmtNum, fmtMoney, fmtSignedMoney, fmtPct, fmtSignedPct } from "@/lib/format";

const COLUMNS: {
  label: string;
  format: (r: TeamRow) => string;
  positive?: (r: TeamRow) => boolean | null;
  placeholder?: (r: TeamRow) => boolean;
}[] = [
  { label: "W", format: (r) => `${r.wins}` },
  { label: "L", format: (r) => `${r.losses}` },
  { label: "PCT", format: (r) => fmtPct(r.winPct) },
  { label: "O/U", format: (r) => fmtNum(r.preseasonOU) },
  { label: "Paid", format: (r) => fmtMoney(r.paid) },
  // Value = the raw auction dollar value this team's wins are worth right
  // now. Diff = that value minus what was paid for it (the P&L), matching
  // the Archive page's Value/Diff convention.
  { label: "Value", format: (r) => fmtMoney(r.currentValue) },
  { label: "Diff", format: (r) => fmtSignedMoney(r.value), positive: (r) => (r.value ?? 0) > 0 },
  { label: "Proj", format: (r) => fmtNum(r.projected) },
  {
    label: "Pyth",
    format: (r) => fmtNum(r.pythagoreanWins),
    placeholder: (r) => r.pythagoreanIsPlaceholder,
  },
  {
    label: "EPA",
    format: (r) => fmtSignedPct(r.epa),
    positive: (r) => r.epa > 0,
    placeholder: (r) => r.epaIsPlaceholder,
  },
];

export default function StandingsTable({ teams }: { teams: TeamRow[] }) {
  // Sorted by $ paid (highest first) rather than an interactive sort - simpler
  // to scan at a glance, and matches how the commissioner sheet was laid out.
  const sorted = useMemo(() => {
    const copy = [...teams];
    copy.sort((a, b) => (b.paid ?? -Infinity) - (a.paid ?? -Infinity));
    return copy;
  }, [teams]);

  return (
    <div className="flex overflow-x-auto no-scrollbar rounded-2xl border border-border">
      {/* Sticky team column */}
      <div className="sticky left-0 z-10 flex-shrink-0 bg-surface">
        <div className="flex h-9 items-center border-b border-border px-2.5 text-xs font-semibold text-muted">
          Team
        </div>
        {sorted.map((t, i) => (
          <Link
            key={t.id}
            href={`/teams/${t.abbr}`}
            className={clsx(
              "flex h-14 items-center gap-2 border-b border-border px-2.5 active:bg-surface-2",
              i === sorted.length - 1 && "border-b-0"
            )}
            style={{ minWidth: 150 }}
          >
            <Image src={t.logoUrl} alt={t.abbr} width={26} height={26} className="flex-shrink-0" unoptimized />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{t.shortName}</div>
              <div className="truncate text-[11px] text-muted">{t.division}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Scrollable stat columns */}
      <div className="flex-shrink-0">
        <div className="flex h-9 border-b border-border">
          {COLUMNS.map((col, idx) => (
            <div
              key={col.label + idx}
              className="flex w-[54px] flex-shrink-0 items-center justify-center text-xs font-semibold text-muted"
            >
              {col.label}
            </div>
          ))}
        </div>
        {sorted.map((t) => (
          <div key={t.id} className="flex h-14 border-b border-border last:border-b-0">
            {COLUMNS.map((col, idx) => {
              const isPositive = col.positive?.(t);
              const isPlaceholder = col.placeholder?.(t);
              return (
                <div
                  key={col.label + idx}
                  className={clsx(
                    "flex w-[54px] flex-shrink-0 items-center justify-center text-[13px] tabular-nums",
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
