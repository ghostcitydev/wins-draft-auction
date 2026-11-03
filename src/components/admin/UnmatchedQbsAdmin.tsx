"use client";

import { useCallback, useEffect, useState } from "react";

interface UnmatchedQb {
  key: string;
  names: string[];
  weeks: number[];
  suggestedAbbr: string | null;
}

interface QbTeamsResponse {
  season: number;
  unmatched: UnmatchedQb[];
  teams: { abbr: string; name: string }[];
}

/**
 * Lists QBs saved this season with no team and lets the commissioner pick
 * one for each. Saving stores the assignment (so future pastes match too)
 * and fixes the already-saved rows - no code change needed for a new QB.
 */
export default function UnmatchedQbsAdmin({ secret }: { secret: string }) {
  const [data, setData] = useState<QbTeamsResponse | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/qb-teams", { headers: { "x-admin-secret": secret } });
      if (!res.ok) {
        setStatus("Couldn't load unmatched QBs.");
        return;
      }
      const json: QbTeamsResponse = await res.json();
      setData(json);
      setPicks(Object.fromEntries(json.unmatched.map((q) => [q.key, q.suggestedAbbr ?? ""])));
    } catch {
      setStatus("Couldn't load unmatched QBs.");
    }
  }, [secret]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is intentional
    load();
  }, [load]);

  const handleSave = async () => {
    const assignments = Object.entries(picks)
      .filter(([, abbr]) => abbr)
      .map(([key, abbr]) => ({ key, abbr }));
    setSaving(true);
    setStatus("Saving…");
    try {
      const res = await fetch("/api/admin/qb-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ assignments }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(json.error ?? "Failed to save - check your secret.");
        return;
      }
      setStatus(`Saved ${json.saved} QB${json.saved === 1 ? "" : "s"}, updated ${json.rowsUpdated} rows ✓`);
      await load();
    } catch {
      setStatus("Failed to save - check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const anyPicked = Object.values(picks).some(Boolean);

  return (
    <div className="mt-8 border-t border-border pt-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Unmatched QBs</h2>
        <button onClick={load} className="text-xs text-muted underline">
          Refresh
        </button>
      </div>
      <p className="mb-3 text-sm text-muted">
        QBs from your pastes that don&apos;t have a team yet. Pick a team and hit Save - it&apos;s
        remembered for every future paste and fixes the weeks already saved.
      </p>

      {data && data.unmatched.length === 0 && (
        <p className="text-sm text-muted">All {data.season} QBs are matched to a team ✓</p>
      )}

      {data && data.unmatched.length > 0 && (
        <>
          <ul className="mb-3 space-y-2">
            {data.unmatched.map((q) => (
              <li key={q.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{q.names.join(" / ")}</p>
                  <p className="text-xs text-muted">
                    Week{q.weeks.length === 1 ? "" : "s"} {q.weeks.join(", ")}
                  </p>
                </div>
                <select
                  value={picks[q.key] ?? ""}
                  onChange={(e) => setPicks((p) => ({ ...p, [q.key]: e.target.value }))}
                  className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
                >
                  <option value="">Team…</option>
                  {data.teams.map((t) => (
                    <option key={t.abbr} value={t.abbr}>
                      {t.abbr} - {t.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <button
            onClick={handleSave}
            disabled={saving || !anyPicked}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-background active:scale-95 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      )}
      {status && <p className="mt-2 text-center text-sm text-muted">{status}</p>}
    </div>
  );
}
