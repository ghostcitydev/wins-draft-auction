"use client";

import { Fragment, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import {
  FUTURE_CATEGORIES,
  FUTURE_CATEGORY_GROUPS,
  type FutureCategory,
} from "@/lib/future-categories";
import type { FuturePickRow } from "@/lib/futures";
import type { TeamRow } from "@/lib/team-types";

const NEW_PERSONA = "__new__";

type PicksByPersona = Map<string, Record<string, string>>;

export default function FuturesBoard({
  teams,
  existingPersonas,
  picks,
  loading,
  error,
  reload,
}: {
  teams: TeamRow[] | null;
  existingPersonas: string[];
  picks: FuturePickRow[] | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  const teamByAbbr = useMemo(() => new Map((teams ?? []).map((t) => [t.abbr, t])), [teams]);

  const picksByPersona: PicksByPersona = useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    for (const p of picks ?? []) {
      if (!map.has(p.persona)) map.set(p.persona, {});
      map.get(p.persona)![p.category] = p.value;
    }
    return map;
  }, [picks]);

  const personasWithPicks = useMemo(
    () => [...new Set([...existingPersonas, ...picksByPersona.keys()])].sort(),
    [existingPersonas, picksByPersona]
  );

  const [editingOpen, setEditingOpen] = useState(false);

  return (
    <div className="space-y-4">
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          Couldn&apos;t load futures ({error}). Pull to refresh or check back shortly.
        </div>
      )}

      {!loading && !error && (
        <>
          {!editingOpen ? (
            <button
              onClick={() => setEditingOpen(true)}
              className="w-full rounded-2xl border border-dashed border-border bg-surface py-3 text-sm font-medium text-muted active:scale-[0.99]"
            >
              + Enter / edit picks
            </button>
          ) : (
            <FuturesForm
              teams={teams ?? []}
              existingPersonas={existingPersonas}
              picksByPersona={picksByPersona}
              onSaved={() => {
                reload();
                setEditingOpen(false);
              }}
              onClose={() => setEditingOpen(false)}
            />
          )}

          <FuturesTable
            teamByAbbr={teamByAbbr}
            picksByPersona={picksByPersona}
            personas={personasWithPicks}
          />
        </>
      )}
    </div>
  );
}

function FuturesForm({
  teams,
  existingPersonas,
  picksByPersona,
  onSaved,
  onClose,
}: {
  teams: TeamRow[];
  existingPersonas: string[];
  picksByPersona: PicksByPersona;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [personaChoice, setPersonaChoice] = useState(existingPersonas[0] ?? "Datong Dave");
  const [newPersona, setNewPersona] = useState("");
  const persona = personaChoice === NEW_PERSONA ? newPersona.trim() : personaChoice;

  const [values, setValues] = useState<Record<string, string>>(
    () => picksByPersona.get(personaChoice) ?? {}
  );
  const [loadedFor, setLoadedFor] = useState(personaChoice);
  // Re-seed the form's values when the user switches to a persona whose
  // existing picks we haven't loaded into local state yet (skipped while
  // "+ New persona…" is selected, since there's nothing to load for it).
  if (personaChoice !== NEW_PERSONA && loadedFor !== personaChoice) {
    setValues(picksByPersona.get(personaChoice) ?? {});
    setLoadedFor(personaChoice);
  }

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const teamsByConference = useMemo(() => {
    const afc = teams.filter((t) => t.conference === "AFC").sort((a, b) => a.shortName.localeCompare(b.shortName));
    const nfc = teams.filter((t) => t.conference === "NFC").sort((a, b) => a.shortName.localeCompare(b.shortName));
    const all = [...teams].sort((a, b) => a.shortName.localeCompare(b.shortName));
    return { AFC: afc, NFC: nfc, all };
  }, [teams]);

  const optionsFor = (cat: FutureCategory) =>
    cat.conference ? teamsByConference[cat.conference] : teamsByConference.all;

  const submit = async () => {
    setError(null);
    if (!persona) {
      setError("Enter a persona name");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/futures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, picks: values }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save picks");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save picks");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <label className="text-xs text-muted">
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

      {FUTURE_CATEGORY_GROUPS.map((group) => (
        <div key={group}>
          <p className="mb-1 mt-3 text-xs font-semibold text-muted">{group}</p>
          <div className="grid grid-cols-2 gap-2">
            {FUTURE_CATEGORIES.filter((c) => c.group === group).map((cat) => (
              <label
                key={cat.key}
                className={clsx("text-xs text-muted", cat.type === "text" && "col-span-2")}
              >
                {cat.label}
                {cat.type === "team" ? (
                  <select
                    value={values[cat.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [cat.key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
                  >
                    <option value="">—</option>
                    {optionsFor(cat).map((t) => (
                      <option key={t.abbr} value={t.abbr}>
                        {t.shortName} ({t.abbr})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={values[cat.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [cat.key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      ))}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={saving}
          className="flex-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save picks"}
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FuturesTable({
  teamByAbbr,
  picksByPersona,
  personas,
}: {
  teamByAbbr: Map<string, TeamRow>;
  picksByPersona: PicksByPersona;
  personas: string[];
}) {
  if (personas.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-center text-sm text-muted">
        No picks yet - enter yours above.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[480px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 bg-surface px-2 py-2 text-left font-semibold">
              Category
            </th>
            {personas.map((p) => (
              <th key={p} className="whitespace-nowrap px-2 py-2 text-left font-semibold">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FUTURE_CATEGORY_GROUPS.map((group) => (
            <Fragment key={group}>
              <tr className="bg-surface-2">
                <td
                  colSpan={personas.length + 1}
                  className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted"
                >
                  {group}
                </td>
              </tr>
              {FUTURE_CATEGORIES.filter((c) => c.group === group).map((cat) => (
                <tr key={cat.key} className="border-b border-border last:border-0">
                  <td className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-muted">
                    {cat.label}
                  </td>
                  {personas.map((p) => {
                    const value = picksByPersona.get(p)?.[cat.key];
                    const team = value ? teamByAbbr.get(value) : undefined;
                    return (
                      <td key={p} className="whitespace-nowrap px-2 py-1.5">
                        {!value ? (
                          <span className="text-muted">—</span>
                        ) : team ? (
                          <span className="flex items-center gap-1">
                            <Image src={team.logoUrl} alt={value} width={16} height={16} unoptimized />
                            {value}
                          </span>
                        ) : (
                          value
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
