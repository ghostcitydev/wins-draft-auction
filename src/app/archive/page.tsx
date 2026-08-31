"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import TopBar from "@/components/TopBar";
import archiveHistory from "../../../prisma/seed-data/archive-history.json";
import { fmtMoney, fmtSignedMoney, fmtPct } from "@/lib/format";

interface ArchiveTeam {
  team: string;
  abbr: string;
  wins: number;
  losses: number | null;
  paid: number;
  value: number | null;
}

interface ArchiveStanding {
  rank: number;
  player: string;
  wins: number;
  losses: number;
  winPct: number;
}

interface ArchiveYear {
  year: number;
  title: string;
  source: string;
  standings: ArchiveStanding[];
  teams: Record<string, ArchiveTeam[]>;
}

const history = archiveHistory as unknown as ArchiveYear[];
const years = [...history].sort((a, b) => b.year - a.year);

interface ArchiveFile {
  name: string;
  title: string;
  url: string;
  sizeBytes: number;
  modifiedAt: string;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ORDINAL = ["1st", "2nd", "3rd"];

export default function ArchivePage() {
  const [files, setFiles] = useState<ArchiveFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(years[0]?.year ?? 0);

  useEffect(() => {
    fetch("/api/archive", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setFiles(data.files ?? []);
        if (data.error) setError(data.error);
      })
      .catch(() => setError("Failed to load archive"));
  }, []);

  const selected = useMemo(
    () => years.find((y) => y.year === selectedYear) ?? years[0],
    [selectedYear]
  );

  return (
    <>
      <TopBar title="Archive" />
      <main className="mx-auto max-w-2xl px-3 pt-4 pb-6">
        <p className="mb-3 px-1 text-sm text-muted">
          Every past season&apos;s final standings, extracted from the commissioner&apos;s
          recap PDFs below.
        </p>

        <h2 className="mb-2 px-1 text-sm font-semibold text-muted">Past champions</h2>
        <div className="mb-6 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-xs text-muted">
                <th className="px-3 py-2 text-left font-semibold">Year</th>
                <th className="px-3 py-2 text-left font-semibold">1st</th>
                <th className="px-3 py-2 text-left font-semibold">2nd</th>
                <th className="px-3 py-2 text-left font-semibold">3rd</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year} className="border-b border-border bg-surface last:border-b-0 odd:bg-surface even:bg-surface-2">
                  <td className="px-3 py-2 font-semibold">{y.year}</td>
                  {[0, 1, 2].map((i) => (
                    <td key={i} className="px-3 py-2">
                      {y.standings[i]?.player ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-muted">Team by team</h2>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
          >
            {years.map((y) => (
              <option key={y.year} value={y.year}>
                {y.year}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <>
            <p className="mb-3 px-1 text-xs text-muted">{selected.title}</p>
            <div className="space-y-5">
              {selected.standings.map((s) => (
                <section key={s.player}>
                  <div className="mb-1.5 flex items-baseline justify-between px-1">
                    <h3 className="text-sm font-semibold">
                      <span className="mr-2 text-muted">
                        {ORDINAL[s.rank - 1] ?? `#${s.rank}`}
                      </span>
                      {s.player}
                    </h3>
                    <div className="text-xs text-muted">
                      <span className="font-medium text-foreground">
                        {s.wins}-{s.losses}
                      </span>{" "}
                      · {fmtPct(s.winPct)}
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted">
                          <th className="px-2.5 py-1.5 text-left font-semibold">Team</th>
                          <th className="px-2.5 py-1.5 text-center font-semibold">W</th>
                          <th className="px-2.5 py-1.5 text-center font-semibold">L</th>
                          <th className="px-2.5 py-1.5 text-center font-semibold">Paid</th>
                          <th className="px-2.5 py-1.5 text-center font-semibold">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.teams[s.player]?.map((t) => (
                          <tr key={t.abbr} className="border-b border-border bg-surface last:border-b-0">
                            <td className="px-2.5 py-1.5">
                              <div className="flex items-center gap-2">
                                <Image
                                  src={`/logos/${t.abbr}.png`}
                                  alt={t.abbr}
                                  width={20}
                                  height={20}
                                  unoptimized
                                />
                                <span className="truncate">{t.team}</span>
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5 text-center tabular-nums">{t.wins}</td>
                            <td className="px-2.5 py-1.5 text-center tabular-nums">
                              {t.losses ?? "—"}
                            </td>
                            <td className="px-2.5 py-1.5 text-center tabular-nums">
                              {fmtMoney(t.paid)}
                            </td>
                            <td className="px-2.5 py-1.5 text-center tabular-nums">
                              {t.value === null ? "—" : fmtSignedMoney(t.value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          </>
        )}

        <h2 className="mb-2 mt-6 px-1 text-sm font-semibold text-muted">Source documents</h2>

        {files === null && !error && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">{error}</div>
        )}

        {files?.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            Nothing here yet. Drop a PDF into <code>public/archive/</code> and push - it&apos;ll show up here automatically.
          </div>
        )}

        <div className="space-y-2">
          {files?.map((f) => (
            <a
              key={f.name}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 active:bg-surface-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold capitalize">{f.title}</div>
                <div className="text-[11px] text-muted">
                  {new Date(f.modifiedAt).toLocaleDateString()} · {fmtSize(f.sizeBytes)}
                </div>
              </div>
              <span className="text-muted">→</span>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
