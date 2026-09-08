"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import TopBar from "@/components/TopBar";
import { useBets } from "@/lib/useBets";
import { useTeams } from "@/lib/useTeams";
import { fmtSigned, fmtPct } from "@/lib/format";
import type { BetRow } from "@/lib/bets";

const fmtUnits = (n: number | null | undefined, withSuffix = true) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${fmtSigned(n, 2)}${withSuffix ? "u" : ""}`;
};
const fmtSpread = (n: number) => fmtSigned(n, 1);
const fmtJuice = (n: number) => fmtSigned(n, 0);
const fmtClv = (n: number | null) => (n === null ? "—" : fmtSigned(n, 1));

function resultBadge(bet: BetRow) {
  if (!bet.result) {
    return <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">Pending</span>;
  }
  const label = bet.result === "win" ? "Win" : bet.result === "loss" ? "Loss" : "Push";
  return (
    <span
      className={clsx(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        bet.result === "win" && "bg-accent/20 text-accent",
        bet.result === "loss" && "bg-danger/20 text-danger",
        bet.result === "push" && "bg-surface-2 text-muted"
      )}
    >
      {label}
    </span>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

const NEW_PERSONA = "__new__";

function AddBetForm({
  teamOptions,
  existingPersonas,
  onCreated,
}: {
  teamOptions: { abbr: string; shortName: string }[];
  existingPersonas: string[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [week, setWeek] = useState("1");
  const [teamAbbr, setTeamAbbr] = useState(teamOptions[0]?.abbr ?? "");
  const [personaChoice, setPersonaChoice] = useState(existingPersonas[0] ?? "Datong Dave");
  const [newPersona, setNewPersona] = useState("");
  const [spread, setSpread] = useState("");
  const [juice, setJuice] = useState("-107");
  const [units, setUnits] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    if (spread === "") {
      setError("Enter a spread");
      return;
    }
    const persona = personaChoice === NEW_PERSONA ? newPersona.trim() : personaChoice;
    if (!persona) {
      setError("Enter a persona name");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week: Number(week),
          teamAbbr,
          persona,
          spread: Number(spread),
          juice: Number(juice),
          units: Number(units),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to add bet");
      setSpread("");
      setNewPersona("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add bet");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-border bg-surface py-3 text-sm font-medium text-muted active:scale-[0.99]"
      >
        + Add a bet
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Week
          <input
            type="number"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="text-xs text-muted">
          Team
          <select
            value={teamAbbr}
            onChange={(e) => setTeamAbbr(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
          >
            {teamOptions.map((t) => (
              <option key={t.abbr} value={t.abbr}>
                {t.shortName} ({t.abbr})
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-xs text-muted">
          Persona
          <select
            value={personaChoice}
            onChange={(e) => setPersonaChoice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
          >
            {existingPersonas.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={NEW_PERSONA}>+ New persona…</option>
          </select>
          {personaChoice === NEW_PERSONA && (
            <input
              type="text"
              placeholder="Persona name"
              value={newPersona}
              onChange={(e) => setNewPersona(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          )}
        </label>
        <label className="text-xs text-muted">
          Spread
          <input
            type="number"
            step="0.5"
            placeholder="+2.5"
            value={spread}
            onChange={(e) => setSpread(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="text-xs text-muted">
          Juice
          <input
            type="number"
            value={juice}
            onChange={(e) => setJuice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="text-xs text-muted">
          Units
          <input
            type="number"
            step="0.25"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={saving}
          className="flex-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save bet"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ClosingLineInput({ bet, onSaved }: { bet: BetRow; onSaved: () => void }) {
  const [value, setValue] = useState(bet.closingLine !== null ? String(bet.closingLine) : "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (value === "") return;
    setSaving(true);
    try {
      await fetch(`/api/bets/${bet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingLine: Number(value) }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step="0.5"
        placeholder="close"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-16 rounded-md border border-border bg-surface-2 px-1.5 py-1 text-[12px] outline-none focus:border-accent"
      />
      <button
        onClick={save}
        disabled={saving || value === ""}
        className="rounded-md border border-border px-1.5 py-1 text-[11px] text-muted disabled:opacity-40"
      >
        {saving ? "…" : "Save"}
      </button>
    </div>
  );
}

export default function BetsPage() {
  const { betRows, loading, error, reload } = useBets();
  const { teams } = useTeams();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const teamOptions = useMemo(
    () =>
      (teams ?? [])
        .map((t) => ({ abbr: t.abbr, shortName: t.shortName }))
        .sort((a, b) => a.shortName.localeCompare(b.shortName)),
    [teams]
  );

  // All personas seen across every bet (not filtered), used to populate the
  // AddBetForm's persona picker and the filter control below - always
  // includes the "Datong Dave" default even before any bets exist for it.
  const existingPersonas = useMemo(() => {
    const set = new Set<string>(["Datong Dave"]);
    for (const b of betRows ?? []) set.add(b.persona);
    return [...set].sort();
  }, [betRows]);

  const [personaFilter, setPersonaFilter] = useState<string>("All");

  // Everything below (summary cards, chart, bet list) tracks the selected
  // persona so each bettor's record can be reviewed independently.
  const filteredRows = useMemo(
    () => (personaFilter === "All" ? betRows ?? [] : (betRows ?? []).filter((b) => b.persona === personaFilter)),
    [betRows, personaFilter]
  );

  const graded = useMemo(() => filteredRows.filter((b) => b.result !== null), [filteredRows]);
  const wins = graded.filter((b) => b.result === "win").length;
  const losses = graded.filter((b) => b.result === "loss").length;
  const pushes = graded.filter((b) => b.result === "push").length;
  const decided = wins + losses;
  const winPct = decided > 0 ? wins / decided : null;
  const netUnits = graded.reduce((s, b) => s + (b.unitsResult ?? 0), 0);
  const withClosing = useMemo(() => filteredRows.filter((b) => b.clv !== null), [filteredRows]);
  const avgClv = withClosing.length
    ? withClosing.reduce((s, b) => s + (b.clv ?? 0), 0) / withClosing.length
    : null;

  const chartData = useMemo(() => {
    return graded.reduce<{ idx: number; label: string; matchup: string; cumulative: number }[]>(
      (acc, b, i) => {
        const prevTotal = acc.length ? acc[acc.length - 1].cumulative : 0;
        acc.push({
          idx: i + 1,
          label: b.teamAbbr,
          matchup: `${b.teamAbbr} ${b.home ? "vs" : "@"} ${b.opponentAbbr}`,
          cumulative: Math.round((prevTotal + (b.unitsResult ?? 0)) * 100) / 100,
        });
        return acc;
      },
      []
    );
  }, [graded]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/bets/${id}`, { method: "DELETE" });
      reload();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <TopBar title="Bets" />
      <main className="mx-auto max-w-2xl px-3 pt-4 pb-6">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            Couldn&apos;t load bets ({error}). Pull to refresh or check back shortly.
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-xs text-muted">
              Persona
              <select
                value={personaFilter}
                onChange={(e) => setPersonaFilter(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-foreground outline-none focus:border-accent"
              >
                <option value="All">All personas</option>
                {existingPersonas.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <SummaryCard
                label="Record (ATS)"
                value={`${wins}-${losses}${pushes ? `-${pushes}` : ""}`}
                sub={winPct !== null ? fmtPct(winPct) : "no graded bets yet"}
              />
              <SummaryCard label="Units" value={fmtUnits(netUnits)} sub={`${graded.length} graded`} />
              <SummaryCard
                label="Avg CLV"
                value={avgClv !== null ? `${fmtClv(avgClv)} pts` : "—"}
                sub={`${withClosing.length} w/ closing line`}
              />
              <SummaryCard label="Total Bets" value={`${filteredRows.length}`} sub="this season" />
            </div>

            <div className="rounded-2xl border border-border bg-surface p-3">
              <p className="mb-1 px-1 text-sm font-semibold">Cumulative units</p>
              {chartData.length > 0 ? (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "var(--muted)" }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "var(--muted)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ReferenceLine y={0} stroke="var(--border)" />
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          color: "var(--foreground)",
                        }}
                        formatter={(value) => [fmtUnits(typeof value === "number" ? value : Number(value)), "Cumulative"]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.matchup ?? ""}
                      />
                      <Line
                        type="monotone"
                        dataKey="cumulative"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="px-1 py-6 text-center text-xs text-muted">
                  No graded bets yet for {personaFilter === "All" ? "any persona" : personaFilter} - this chart
                  fills in once games finish.
                </p>
              )}
            </div>

            <AddBetForm teamOptions={teamOptions} existingPersonas={existingPersonas} onCreated={reload} />

            {betRows?.length === 0 && (
              <div className="rounded-2xl border border-border bg-surface p-4 text-center text-sm text-muted">
                No bets yet - add your first one above.
              </div>
            )}

            {(betRows?.length ?? 0) > 0 && filteredRows.length === 0 && (
              <div className="rounded-2xl border border-border bg-surface p-4 text-center text-sm text-muted">
                No bets for {personaFilter} yet.
              </div>
            )}

            <div className="space-y-2">
              {filteredRows.map((b) => (
                <div key={b.id} className="rounded-2xl border border-border bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Image src={b.logoUrl} alt={b.teamAbbr} width={24} height={24} unoptimized />
                      <div>
                        <p className="text-sm font-semibold">
                          {b.teamAbbr} {fmtSpread(b.spread)}{" "}
                          <span className="font-normal text-muted">
                            {b.home ? "vs" : "@"} {b.opponentAbbr}
                          </span>
                        </p>
                        <p className="text-[11px] text-muted">
                          Wk {b.week}
                          {b.gameDate && ` · ${new Date(b.gameDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                          {" · "}
                          {fmtJuice(b.juice)} · {fmtUnits(b.units, true)} risked
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                        {b.persona}
                      </span>
                      {resultBadge(b)}
                      <button
                        onClick={() => handleDelete(b.id)}
                        disabled={deletingId === b.id}
                        className="text-muted disabled:opacity-40"
                        aria-label="Delete bet"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[12px]">
                    <div className="flex items-center gap-3">
                      <span className="text-muted">
                        Close:{" "}
                        {b.closingLine !== null ? (
                          <span className="font-medium text-foreground">{fmtSpread(b.closingLine)}</span>
                        ) : (
                          <ClosingLineInput bet={b} onSaved={reload} />
                        )}
                      </span>
                      {b.clv !== null && <span className="text-muted">CLV: {fmtClv(b.clv)}</span>}
                    </div>
                    {b.result && (
                      <span
                        className={clsx(
                          "font-semibold tabular-nums",
                          (b.unitsResult ?? 0) > 0 && "text-accent",
                          (b.unitsResult ?? 0) < 0 && "text-danger"
                        )}
                      >
                        {fmtUnits(b.unitsResult)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
