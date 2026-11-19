"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import TopBar from "@/components/TopBar";
import type {
  PlayoffStanding,
  PlayoffTeamInfo,
  PlayoffWeek,
  PlayoffsResult,
} from "@/lib/playoff-types";

function usePlayoffs(pollMs = 60000) {
  const [data, setData] = useState<PlayoffsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/playoffs", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error ? String(json.error) : `Request failed (${res.status})`);
      }
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount is intentional
    load();
    const interval = setInterval(load, pollMs);
    const onRefresh = () => load();
    window.addEventListener("wins-draft:refresh", onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("wins-draft:refresh", onRefresh);
    };
  }, [load, pollMs]);

  return { data, loading, error };
}

const record = (s: PlayoffStanding) => `${s.w}-${s.l}${s.t ? `-${s.t}` : ""}`;
const divRecord = (s: PlayoffStanding) => `${s.divW}-${s.divL}${s.divT ? `-${s.divT}` : ""}`;
const fmtGb = (gb: number) => (gb === 0 ? "-" : gb % 1 ? gb.toFixed(1) : String(gb));

function Logo({ team, size = 18 }: { team: PlayoffTeamInfo; size?: number }) {
  return (
    <Image
      src={team.logoUrl}
      alt={team.abbr}
      width={size}
      height={size}
      unoptimized
      className="flex-shrink-0"
    />
  );
}

export default function PlayoffsPage() {
  const { data, loading, error } = usePlayoffs();
  const [picked, setPicked] = useState<number | null>(null);

  const teamByAbbr = useMemo(
    () => new Map((data?.teams ?? []).map((t) => [t.abbr, t])),
    [data]
  );

  // Default to the latest completed week; keep the user's pick if it still exists.
  const week =
    data && picked !== null && picked >= 1 && picked <= data.maxWeek ? picked : data?.maxWeek ?? 0;
  const current: PlayoffWeek | undefined = data?.weeks[week - 1];
  const previous: PlayoffWeek | undefined = data?.weeks[week - 2];

  return (
    <>
      <TopBar title="Playoffs" />
      <main className="mx-auto max-w-2xl px-3 pt-4 pb-6">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            Couldn&apos;t load the playoff picture ({error}). Check back shortly.
          </div>
        )}

        {!loading && !error && data && data.maxWeek === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
            No completed games yet - the playoff picture shows up after Week 1.
          </div>
        )}

        {!loading && !error && data && current && (
          <div className="space-y-4">
            {data.isPreview && (
              <p className="rounded-xl border border-border bg-surface px-3 py-2 text-[11px] text-muted">
                * Showing the {data.season} season until this season&apos;s first games are final.
              </p>
            )}

            <WeekPicker maxWeek={data.maxWeek} week={week} onChange={setPicked} />

            <section>
              <SectionTitle>Playoff picture · after Week {week}</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.conferences.map((conf) => (
                  <SeedCard
                    key={conf}
                    conf={conf}
                    current={current}
                    previous={previous}
                    teamByAbbr={teamByAbbr}
                  />
                ))}
              </div>
            </section>

            <section>
              <SectionTitle>Division races</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.keys(current.divisions)
                  .sort()
                  .map((d) => (
                    <DivisionCard
                      key={d}
                      name={d}
                      order={current.divisions[d]}
                      current={current}
                      teamByAbbr={teamByAbbr}
                    />
                  ))}
              </div>
            </section>

            <section>
              <SectionTitle>Seeds by week</SectionTitle>
              <div className="space-y-3">
                {data.conferences.map((conf) => (
                  <SeedHistory
                    key={conf}
                    conf={conf}
                    weeks={data.weeks}
                    selectedWeek={week}
                    onPick={setPicked}
                    teamByAbbr={teamByAbbr}
                  />
                ))}
              </div>
            </section>

            <p className="px-1 text-[11px] text-muted">
              Built from final regular-season scores. Ties use a simplified NFL order: head-to-head,
              division record, conference record, then point differential (common games, strength of
              victory and strength of schedule are skipped), so a seed can differ from the official
              one in a close race.
            </p>
          </div>
        )}
      </main>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 px-1 text-sm font-semibold">{children}</p>;
}

function WeekPicker({
  maxWeek,
  week,
  onChange,
}: {
  maxWeek: number;
  week: number;
  onChange: (w: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-2">
      <button
        onClick={() => onChange(Math.max(1, week - 1))}
        disabled={week <= 1}
        aria-label="Previous week"
        className="rounded-full border border-border px-2.5 py-1 text-xs text-muted disabled:opacity-40"
      >
        ‹
      </button>
      <div className="flex flex-1 gap-1 overflow-x-auto">
        {Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => (
          <button
            key={w}
            onClick={() => onChange(w)}
            className={clsx(
              "flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition",
              w === week ? "bg-accent text-background" : "text-muted"
            )}
          >
            W{w}
          </button>
        ))}
      </div>
      <button
        onClick={() => onChange(Math.min(maxWeek, week + 1))}
        disabled={week >= maxWeek}
        aria-label="Next week"
        className="rounded-full border border-border px-2.5 py-1 text-xs text-muted disabled:opacity-40"
      >
        ›
      </button>
    </div>
  );
}

function SeedCard({
  conf,
  current,
  previous,
  teamByAbbr,
}: {
  conf: string;
  current: PlayoffWeek;
  previous?: PlayoffWeek;
  teamByAbbr: Map<string, PlayoffTeamInfo>;
}) {
  const order = current.seeds[conf] ?? [];
  const field = order.slice(0, 7);
  const hunt = order.slice(7, 10);

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">{conf}</p>
      <div className="overflow-hidden rounded-xl border border-border">
        {field.map((abbr, i) => {
          const team = teamByAbbr.get(abbr);
          const s = current.standings[abbr];
          if (!team || !s) return null;
          const prevSeed = previous?.standings[abbr]?.seed ?? null;
          const seed = i + 1;
          return (
            <div
              key={abbr}
              className={clsx(
                "flex items-center gap-2 px-2 py-1.5 text-sm odd:bg-surface even:bg-surface-2",
                i === 4 && "border-t border-border"
              )}
            >
              <span className="w-4 text-center text-xs font-semibold tabular-nums text-muted">
                {seed}
              </span>
              <Logo team={team} size={20} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {team.shortName}
              </span>
              <Movement prev={prevSeed} now={seed} hasPrev={!!previous} />
              <span className="w-10 text-right text-xs tabular-nums">{record(s)}</span>
              <span
                className={clsx(
                  "w-7 text-right text-[10px] font-semibold",
                  i < 4 ? "text-accent" : "text-muted"
                )}
              >
                {i < 4 ? "DIV" : "WC"}
              </span>
            </div>
          );
        })}
      </div>
      {hunt.length > 0 && (
        <div className="mt-2 px-1">
          <p className="mb-1 text-[11px] font-semibold text-muted">In the hunt</p>
          <div className="space-y-1">
            {hunt.map((abbr) => {
              const team = teamByAbbr.get(abbr);
              const s = current.standings[abbr];
              if (!team || !s) return null;
              return (
                <div key={abbr} className="flex items-center gap-2 text-xs text-muted">
                  <Logo team={team} size={14} />
                  <span className="min-w-0 flex-1 truncate">{team.shortName}</span>
                  <span className="tabular-nums">{record(s)}</span>
                  <span className="w-14 text-right tabular-nums">
                    {s.wcGamesBack ? `${fmtGb(s.wcGamesBack)} GB` : "tied"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Movement({ prev, now, hasPrev }: { prev: number | null; now: number; hasPrev: boolean }) {
  if (!hasPrev) return <span className="w-6" />;
  if (prev === null)
    return <span className="w-6 text-right text-[10px] font-semibold text-accent">NEW</span>;
  if (prev === now) return <span className="w-6" />;
  const up = now < prev;
  return (
    <span
      className={clsx(
        "w-6 text-right text-[10px] font-semibold tabular-nums",
        up ? "text-accent" : "text-danger"
      )}
    >
      {up ? "▲" : "▼"}
      {Math.abs(prev - now)}
    </span>
  );
}

function DivisionCard({
  name,
  order,
  current,
  teamByAbbr,
}: {
  name: string;
  order: string[];
  current: PlayoffWeek;
  teamByAbbr: Map<string, PlayoffTeamInfo>;
}) {
  const anyTies = order.some((a) => current.standings[a]?.t);
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="mb-2 px-1 text-sm font-semibold">{name}</p>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted">
              <th className="px-2 py-1 text-left font-semibold">Team</th>
              <th className="px-1 py-1 text-center font-semibold">W</th>
              <th className="px-1 py-1 text-center font-semibold">L</th>
              {anyTies && <th className="px-1 py-1 text-center font-semibold">T</th>}
              <th className="px-1 py-1 text-center font-semibold">GB</th>
              <th className="px-1 py-1 text-center font-semibold">Div</th>
              <th className="px-2 py-1 text-right font-semibold">Seed</th>
            </tr>
          </thead>
          <tbody>
            {order.map((abbr) => {
              const team = teamByAbbr.get(abbr);
              const s = current.standings[abbr];
              if (!team || !s) return null;
              return (
                <tr
                  key={abbr}
                  className="border-b border-border last:border-b-0 odd:bg-surface even:bg-surface-2"
                >
                  <td className="px-2 py-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Logo team={team} size={18} />
                      <span className="truncate text-[13px] font-medium">{team.shortName}</span>
                    </div>
                  </td>
                  <td className="px-1 py-1.5 text-center text-xs tabular-nums">{s.w}</td>
                  <td className="px-1 py-1.5 text-center text-xs tabular-nums">{s.l}</td>
                  {anyTies && (
                    <td className="px-1 py-1.5 text-center text-xs tabular-nums">{s.t}</td>
                  )}
                  <td className="px-1 py-1.5 text-center text-xs tabular-nums text-muted">
                    {fmtGb(s.gamesBack)}
                  </td>
                  <td className="px-1 py-1.5 text-center text-[11px] tabular-nums text-muted">
                    {divRecord(s)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-[11px] font-semibold tabular-nums">
                    {s.seed ? (
                      <span className={s.seed <= 4 ? "text-accent" : "text-accent-2"}>
                        {s.seed}
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeedHistory({
  conf,
  weeks,
  selectedWeek,
  onPick,
  teamByAbbr,
}: {
  conf: string;
  weeks: PlayoffWeek[];
  selectedWeek: number;
  onPick: (w: number) => void;
  teamByAbbr: Map<string, PlayoffTeamInfo>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">{conf}</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="text-xs">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted">
              <th className="sticky left-0 z-10 bg-surface px-2 py-1 text-left font-semibold">
                Seed
              </th>
              {weeks.map((w) => (
                <th
                  key={w.week}
                  onClick={() => onPick(w.week)}
                  className={clsx(
                    "cursor-pointer px-1 py-1 text-center font-semibold tabular-nums",
                    w.week === selectedWeek && "text-accent"
                  )}
                >
                  W{w.week}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 7 }, (_, i) => (
              <tr
                key={i}
                className={clsx(
                  "border-b border-border last:border-b-0 odd:bg-surface even:bg-surface-2",
                  i === 4 && "border-t-2"
                )}
              >
                <td className="sticky left-0 z-10 bg-inherit px-2 py-1 text-center font-semibold tabular-nums text-muted">
                  {i + 1}
                </td>
                {weeks.map((w) => {
                  const abbr = w.seeds[conf]?.[i];
                  const team = abbr ? teamByAbbr.get(abbr) : undefined;
                  return (
                    <td
                      key={w.week}
                      onClick={() => onPick(w.week)}
                      className={clsx(
                        "cursor-pointer px-1 py-1 text-center",
                        w.week === selectedWeek && "bg-accent/15"
                      )}
                      title={team ? `${team.name} (${record(w.standings[team.abbr])})` : undefined}
                    >
                      {team && (
                        <div className="flex justify-center">
                          <Logo team={team} size={18} />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-muted">Tap a week to view it above.</p>
    </div>
  );
}
