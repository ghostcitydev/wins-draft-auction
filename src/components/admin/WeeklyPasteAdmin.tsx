"use client";

import { useEffect, useState, type ReactNode } from "react";

interface Summary {
  season: number;
  weeksLogged: number[];
  rowCount: number;
}

interface SaveResult {
  upserted: number;
  totalParsed: number;
  parseErrors: string[];
  unmatchedAbbrs?: string[];
  unmatchedNames?: string[];
}

/**
 * Shared "paste this week's export, season/week + Parse & Save" admin block.
 * Used for anything that follows the same weekly-snapshot pattern as the
 * original nfelo ratings section (team-ratings, qb-ratings, team-dvoa) -
 * factored out so a third and fourth data source didn't mean copy/pasting
 * the same season/week/status/result state machine again.
 */
export default function WeeklyPasteAdmin({
  title,
  instructions,
  apiPath,
  secret,
  rowNoun,
  placeholder,
}: {
  title: string;
  instructions: ReactNode;
  apiPath: string;
  secret: string;
  rowNoun: string;
  placeholder: string;
}) {
  const [season, setSeason] = useState("2026");
  const [week, setWeek] = useState("1");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch(apiPath, { headers: { "x-admin-secret": secret } })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: Summary | null) => {
        if (data) {
          setSummary(data);
          setSeason(String(data.season));
          const nextWeek = data.weeksLogged.length ? Math.max(...data.weeksLogged) + 1 : 1;
          setWeek(String(nextWeek));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount/secret, same as sibling sections
  }, [apiPath, secret]);

  const handleSave = async () => {
    setSaving(true);
    setStatus("Saving…");
    setResult(null);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ season: Number(season), week: Number(week), rawText: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error ?? "Failed to save - check your secret.");
        return;
      }
      setResult(data as SaveResult);
      setStatus(`Saved ${data.upserted}/${data.totalParsed} ${rowNoun} ✓`);
      const summaryRes = await fetch(apiPath, { headers: { "x-admin-secret": secret } });
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch {
      setStatus("Failed to save - check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const unmatched = [...(result?.unmatchedAbbrs ?? []), ...(result?.unmatchedNames ?? [])];

  return (
    <div className="mt-8 border-t border-border pt-6">
      <h2 className="mb-1 text-lg font-semibold">{title}</h2>
      <div className="mb-3 text-sm text-muted">{instructions}</div>

      {summary && (
        <p className="mb-3 text-xs text-muted">
          {summary.season}: {summary.rowCount} rows logged across {summary.weeksLogged.length} week
          {summary.weeksLogged.length === 1 ? "" : "s"}
          {summary.weeksLogged.length > 0 && ` (latest: week ${Math.max(...summary.weeksLogged)})`}.
        </p>
      )}

      <div className="mb-2 grid grid-cols-2 gap-2">
        <input
          inputMode="numeric"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          placeholder="Season"
          className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
        <input
          inputMode="numeric"
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          placeholder="Week"
          className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={8}
        className="mb-3 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-xs outline-none focus:border-accent"
      />

      <button
        onClick={handleSave}
        disabled={saving || !text.trim()}
        className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-background active:scale-95 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Parse & save"}
      </button>
      {status && <p className="mt-2 text-center text-sm text-muted">{status}</p>}

      {result && (result.parseErrors.length > 0 || unmatched.length > 0) && (
        <div className="mt-3 rounded-xl border border-border bg-surface p-3 text-xs text-muted">
          {unmatched.length > 0 && <p className="mb-1">Unmatched: {unmatched.join(", ")}</p>}
          {result.parseErrors.map((err, i) => (
            <p key={i} className="mb-1">
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
