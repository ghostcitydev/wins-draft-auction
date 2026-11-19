"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const fmtGb = (gb: number) => (gb === 0 ? "-" : gb % 1 ? gb.toFixed(1) : String(gb));

function Logo({ team, size = 18 }: { team: PlayoffTeamInfo; size?: number }) {
  return (
    <Image
      src={team.logoUrl}
      alt={team.abbr}
      width={size}
      height={size}
      unoptimized
      // Logo files have different aspect ratios; pin every one to the same
      // square box so rows and the record text under them line up.
      className="flex-shrink-0 object-contain"
      style={{ width: size, height: size, minWidth: size }}
    />
  );
}

export default function PlayoffsPage() {
  const { data, loading, error } = usePlayoffs();
  const [picked, setPicked] = useState<number | null>(null);
  const [divisionPick, setDivision] = useState<string | null>(null);
  const [conferencePick, setConference] = useState<string | null>(null);

  const teamByAbbr = useMemo(
    () => new Map((data?.teams ?? []).map((t) => [t.abbr, t])),
    [data]
  );

  // Default to the latest completed week; keep the user's pick if it still exists.
  const week =
    data && picked !== null && picked >= 1 && picked <= data.maxWeek ? picked : data?.maxWeek ?? 0;
  const current: PlayoffWeek | undefined = data?.weeks[week - 1];
  const divisionNames = useMemo(
    () => [...new Set((data?.teams ?? []).map((t) => t.division))].sort(),
    [data]
  );
  const division =
    divisionPick && divisionNames.includes(divisionPick) ? divisionPick : divisionNames[0] ?? "";
  const conference =
    conferencePick && data?.conferences.includes(conferencePick)
      ? conferencePick
      : data?.conferences[0] ?? "";
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
          <div className="space-y-3">
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
              <SectionTitle>Division races by week</SectionTitle>
              <Pills
                options={divisionNames}
                value={division}
                onChange={setDivision}
              />
              <WeekGrid
                weeks={data.weeks}
                selectedWeek={week}
                onPick={setPicked}
                rows={[0, 1, 2, 3].map((i) => ({
                  label: String(i + 1),
                  cell: (w) => (
                    <TeamCell abbr={w.divisions[division]?.[i]} w={w} teamByAbbr={teamByAbbr} />
                  ),
                }))}
              />
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <p className="text-sm font-semibold">Seeds &amp; wild card matchups by week</p>
                <Pills options={data.conferences} value={conference} onChange={setConference} compact />
              </div>
              <div className="space-y-3">
                <WeekGrid
                  title="Wild card matchups"
                  weeks={data.weeks}
                  selectedWeek={week}
                  onPick={setPicked}
                  rows={(
                    [
                      [1, 0],
                      [2, 7],
                      [3, 6],
                      [4, 5],
                    ] as const
                  ).map(([hi, lo]) => ({
                    label: lo ? `${hi} v ${lo}` : `${hi} bye`,
                    cell: (w) => (
                      <MatchupCell
                        home={w.seeds[conference]?.[hi - 1]}
                        away={lo ? w.seeds[conference]?.[lo - 1] : undefined}
                        w={w}
                        teamByAbbr={teamByAbbr}
                      />
                    ),
                  }))}
                />
                <WeekGrid
                  title="Seeds"
                  labelHeader="Seed"
                  weeks={data.weeks}
                  selectedWeek={week}
                  onPick={setPicked}
                  rows={Array.from({ length: 7 }, (_, i) => ({
                    label: String(i + 1),
                    divider: i === 4,
                    cell: (w) => (
                      <TeamCell abbr={w.seeds[conference]?.[i]} w={w} teamByAbbr={teamByAbbr} />
                    ),
                  }))}
                />
              </div>
            </section>

            <p className="px-1 text-[11px] text-muted">
              Tap any week in a grid to load it above. NFL tiebreakers
              (head-to-head, division/conference record, common games, SOV, SOS, net points); the
              points-ranking and net-TD steps aren&apos;t tracked, and a coin toss is alphabetical.
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
  const hunt = order.slice(7, 9);

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
                "flex items-center gap-2 px-2 py-1 text-sm odd:bg-surface even:bg-surface-2",
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

interface GridRow {
  label: string;
  divider?: boolean;
  cell: (w: PlayoffWeek) => React.ReactNode;
}

/** Weeks across, one row per rank/seed/matchup; tap any column to select that week. */
function WeekGrid({
  title,
  rows,
  weeks,
  selectedWeek,
  onPick,
  labelHeader = "",
}: {
  title?: string;
  rows: GridRow[];
  weeks: PlayoffWeek[];
  selectedWeek: number;
  onPick: (w: number) => void;
  labelHeader?: string;
}) {
  // Keep the selected (by default the latest) week in view in narrow columns.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    const col = el?.querySelector<HTMLElement>(`[data-week="${selectedWeek}"]`);
    if (!el || !col) return;
    const left = col.offsetLeft - el.clientWidth / 2 + col.offsetWidth / 2;
    el.scrollLeft = Math.max(0, left);
  }, [selectedWeek, weeks.length]);

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-2">
      {title && <p className="mb-1.5 px-1 text-xs font-semibold text-muted">{title}</p>}
      <div ref={scroller} className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted">
              <th className="sticky left-0 z-10 bg-surface px-1.5 py-0.5 text-left font-semibold">
                {labelHeader}
              </th>
              {weeks.map((w) => (
                <th
                  key={w.week}
                  data-week={w.week}
                  onClick={() => onPick(w.week)}
                  className={clsx(
                    "cursor-pointer px-1 py-1 text-center text-[11px] font-semibold tabular-nums",
                    w.week === selectedWeek && "text-accent"
                  )}
                >
                  W{w.week}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={clsx(
                  "border-b border-border last:border-b-0",
                  row.divider && "border-t-2"
                )}
              >
                <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums text-muted">
                  {row.label}
                </td>
                {weeks.map((w) => (
                  <td
                    key={w.week}
                    onClick={() => onPick(w.week)}
                    className={clsx(
                      "cursor-pointer px-1 py-1 text-center",
                      w.week === selectedWeek && "bg-accent/15"
                    )}
                  >
                    {row.cell(w)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamCell({
  abbr,
  w,
  teamByAbbr,
}: {
  abbr: string | undefined;
  w: PlayoffWeek;
  teamByAbbr: Map<string, PlayoffTeamInfo>;
}) {
  const team = abbr ? teamByAbbr.get(abbr) : undefined;
  const s = abbr ? w.standings[abbr] : undefined;
  if (!team || !s) return null;
  return (
    <div className="flex flex-col items-center gap-0.5" title={`${team.name} (${record(s)})`}>
      <Logo team={team} size={22} />
      {/* W-L only (ties left out) so the label never wraps in narrow grid cells. */}
      <span className="whitespace-nowrap text-[9px] leading-none tabular-nums text-muted">
        {s.w}-{s.l}
      </span>
    </div>
  );
}

function MatchupCell({
  home,
  away,
  w,
  teamByAbbr,
}: {
  home: string | undefined;
  away: string | undefined;
  w: PlayoffWeek;
  teamByAbbr: Map<string, PlayoffTeamInfo>;
}) {
  // Stacked vertically so logos are the same size as every other grid on the page.
  if (!home || !teamByAbbr.get(home)) return null;
  return (
    <div className="flex flex-col items-center gap-1">
      <TeamCell abbr={home} w={w} teamByAbbr={teamByAbbr} />
      {away && (
        <>
          <span className="text-[9px] leading-none text-muted">v</span>
          <TeamCell abbr={away} w={w} teamByAbbr={teamByAbbr} />
        </>
      )}
    </div>
  );
}

function Pills({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex gap-1 overflow-x-auto",
        compact ? "rounded-full border border-border bg-surface p-0.5" : "mb-2 px-1"
      )}
    >
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={clsx(
            "flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition",
            o === value ? "bg-accent text-background" : "text-muted",
            !compact && o !== value && "border border-border bg-surface"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
