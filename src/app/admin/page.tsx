"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import TopBar from "@/components/TopBar";

interface AdminTeam {
  id: string;
  name: string;
  shortName: string;
  abbr: string;
  logoUrl: string | null;
}
interface AdminPlayer {
  id: string;
  name: string;
}
interface AdminDraftPick {
  teamId: string;
  playerId: string;
  paid: number;
  preseasonOU: number;
  round: number | null;
}

interface RowState {
  playerName: string;
  paid: string;
  preseasonOU: string;
}

interface RatingsSummary {
  season: number;
  weeksLogged: number[];
  rowCount: number;
}

interface RatingsSaveResult {
  upserted: number;
  totalParsed: number;
  parseErrors: string[];
  unmatchedAbbrs: string[];
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [ratingsSeason, setRatingsSeason] = useState("2026");
  const [ratingsWeek, setRatingsWeek] = useState("1");
  const [ratingsText, setRatingsText] = useState("");
  const [ratingsStatus, setRatingsStatus] = useState<string | null>(null);
  const [ratingsSaving, setRatingsSaving] = useState(false);
  const [ratingsResult, setRatingsResult] = useState<RatingsSaveResult | null>(null);
  const [ratingsSummary, setRatingsSummary] = useState<RatingsSummary | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("wins-draft-admin-secret");
    if (stored !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a one-time value from localStorage on mount
      setSecret(stored);
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount/unlock is intentional
    setLoading(true);
    fetch("/api/admin/draft-picks", { headers: { "x-admin-secret": secret } })
      .then(async (res) => {
        if (!res.ok) throw new Error("Unauthorized or failed to load");
        return res.json();
      })
      .then((data: { teams: AdminTeam[]; players: AdminPlayer[]; draftPicks: AdminDraftPick[] }) => {
        setTeams(data.teams);
        setPlayers(data.players);
        const playerById = new Map(data.players.map((p) => [p.id, p]));
        const initial: Record<string, RowState> = {};
        for (const t of data.teams) {
          const pick = data.draftPicks.find((d) => d.teamId === t.id);
          initial[t.id] = {
            playerName: pick ? playerById.get(pick.playerId)?.name ?? "" : "",
            paid: pick ? String(pick.paid) : "",
            preseasonOU: pick ? String(pick.preseasonOU) : "",
          };
        }
        setRows(initial);
        setStatus(null);
      })
      .catch((err) => setStatus(err.message))
      .finally(() => setLoading(false));
  }, [unlocked, secret]);

  useEffect(() => {
    if (!unlocked) return;
    fetch("/api/admin/team-ratings", { headers: { "x-admin-secret": secret } })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data: RatingsSummary | null) => {
        if (data) {
          setRatingsSummary(data);
          setRatingsSeason(String(data.season));
          const nextWeek = data.weeksLogged.length ? Math.max(...data.weeksLogged) + 1 : 1;
          setRatingsWeek(String(nextWeek));
        }
      })
      .catch(() => {});
  }, [unlocked, secret]);

  const handleSaveRatings = async () => {
    setRatingsSaving(true);
    setRatingsStatus("Saving…");
    setRatingsResult(null);
    try {
      const res = await fetch("/api/admin/team-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({
          season: Number(ratingsSeason),
          week: Number(ratingsWeek),
          rawText: ratingsText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRatingsStatus(data.error ?? "Failed to save - check your secret.");
        return;
      }
      setRatingsResult(data as RatingsSaveResult);
      setRatingsStatus(`Saved ${data.upserted}/${data.totalParsed} team rows ✓`);
      const summaryRes = await fetch("/api/admin/team-ratings", { headers: { "x-admin-secret": secret } });
      if (summaryRes.ok) setRatingsSummary(await summaryRes.json());
    } catch {
      setRatingsStatus("Failed to save - check your connection.");
    } finally {
      setRatingsSaving(false);
    }
  };

  const totals = useMemo(() => {
    const byPlayer: Record<string, { paid: number; count: number }> = {};
    for (const t of teams) {
      const r = rows[t.id];
      if (!r?.playerName) continue;
      byPlayer[r.playerName] ??= { paid: 0, count: 0 };
      byPlayer[r.playerName].paid += Number(r.paid) || 0;
      byPlayer[r.playerName].count += 1;
    }
    return byPlayer;
  }, [rows, teams]);

  const handleUnlock = () => {
    window.localStorage.setItem("wins-draft-admin-secret", secret);
    setUnlocked(true);
  };

  const updateRow = (teamId: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [teamId]: { ...prev[teamId], ...patch } }));
  };

  const handleSave = async () => {
    setStatus("Saving…");
    const picks = teams
      .map((t) => {
        const r = rows[t.id];
        if (!r?.playerName || !r.paid || !r.preseasonOU) return null;
        return {
          teamId: t.id,
          playerName: r.playerName.trim(),
          paid: Number(r.paid),
          preseasonOU: Number(r.preseasonOU),
        };
      })
      .filter(Boolean);

    const res = await fetch("/api/admin/draft-picks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({ picks }),
    });

    setStatus(res.ok ? `Saved ${picks.length} picks ✓` : "Failed to save - check your secret.");
  };

  if (!unlocked) {
    return (
      <>
        <TopBar title="Setup" />
        <main className="mx-auto max-w-2xl px-4 pt-8">
          <h2 className="mb-2 text-lg font-semibold">Commissioner setup</h2>
          <p className="mb-4 text-sm text-muted">
            Enter the shared admin passphrase to edit this season&apos;s draft picks. If no
            passphrase was configured, leave this blank.
          </p>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Admin passphrase"
            className="mb-3 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={handleUnlock}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-background active:scale-95"
          >
            Continue
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="Setup" />
      <main className="mx-auto max-w-2xl px-3 pt-4 pb-8">
        <p className="mb-3 px-1 text-sm text-muted">
          Assign each team to a player, the $ paid at auction, and the preseason O/U win total.
          Budgets and team counts below are shown for your own sanity-check.
        </p>

        {players.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5 px-1">
            {Object.entries(totals).map(([name, t]) => (
              <span
                key={name}
                className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs"
              >
                {name}: {t.count} teams · ${t.paid}
              </span>
            ))}
          </div>
        )}

        {loading && <div className="h-40 animate-pulse rounded-2xl bg-surface" />}

        <datalist id="player-names">
          {players.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>

        <div className="space-y-2">
          {teams.map((t) => {
            const r = rows[t.id] ?? { playerName: "", paid: "", preseasonOU: "" };
            return (
              <div key={t.id} className="rounded-2xl border border-border bg-surface p-3">
                <div className="mb-2 flex items-center gap-2">
                  {t.logoUrl && <Image src={t.logoUrl} alt={t.abbr} width={24} height={24} unoptimized />}
                  <span className="text-sm font-semibold">{t.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    list="player-names"
                    value={r.playerName}
                    onChange={(e) => updateRow(t.id, { playerName: e.target.value })}
                    placeholder="Player"
                    className="col-span-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
                  />
                  <input
                    inputMode="decimal"
                    value={r.paid}
                    onChange={(e) => updateRow(t.id, { paid: e.target.value })}
                    placeholder="Paid $"
                    className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
                  />
                  <input
                    inputMode="decimal"
                    value={r.preseasonOU}
                    onChange={(e) => updateRow(t.id, { preseasonOU: e.target.value })}
                    placeholder="O/U"
                    className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleSave}
          className="sticky bottom-2 mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-background shadow-lg active:scale-95"
        >
          Save all picks
        </button>
        {status && <p className="mt-2 text-center text-sm text-muted">{status}</p>}

        <div className="mt-8 border-t border-border pt-6">
          <h2 className="mb-1 text-lg font-semibold">Weekly nfelo ratings</h2>
          <p className="mb-3 text-sm text-muted">
            Each week, open{" "}
            <a
              href="https://www.nfeloapp.com/nfl-power-ratings/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              nfeloapp.com/nfl-power-ratings
            </a>
            , select and copy the ratings table, and paste it below. This feeds EPA and
            Pythagorean wins - nfelo has no public API, so this replaces last week&apos;s snapshot
            for every team in one paste.
          </p>

          {ratingsSummary && (
            <p className="mb-3 text-xs text-muted">
              {ratingsSummary.season}: {ratingsSummary.rowCount} rows logged across{" "}
              {ratingsSummary.weeksLogged.length} week{ratingsSummary.weeksLogged.length === 1 ? "" : "s"}
              {ratingsSummary.weeksLogged.length > 0 &&
                ` (latest: week ${Math.max(...ratingsSummary.weeksLogged)})`}
              .
            </p>
          )}

          <div className="mb-2 grid grid-cols-2 gap-2">
            <input
              inputMode="numeric"
              value={ratingsSeason}
              onChange={(e) => setRatingsSeason(e.target.value)}
              placeholder="Season"
              className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            <input
              inputMode="numeric"
              value={ratingsWeek}
              onChange={(e) => setRatingsWeek(e.target.value)}
              placeholder="Week"
              className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>

          <textarea
            value={ratingsText}
            onChange={(e) => setRatingsText(e.target.value)}
            placeholder="Paste the nfelo power ratings table here…"
            rows={8}
            className="mb-3 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-xs outline-none focus:border-accent"
          />

          <button
            onClick={handleSaveRatings}
            disabled={ratingsSaving || !ratingsText.trim()}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-background active:scale-95 disabled:opacity-50"
          >
            {ratingsSaving ? "Saving…" : "Parse & save ratings"}
          </button>
          {ratingsStatus && <p className="mt-2 text-center text-sm text-muted">{ratingsStatus}</p>}

          {ratingsResult && (ratingsResult.parseErrors.length > 0 || ratingsResult.unmatchedAbbrs.length > 0) && (
            <div className="mt-3 rounded-xl border border-border bg-surface p-3 text-xs text-muted">
              {ratingsResult.unmatchedAbbrs.length > 0 && (
                <p className="mb-1">
                  Unmatched team abbreviations: {ratingsResult.unmatchedAbbrs.join(", ")}
                </p>
              )}
              {ratingsResult.parseErrors.map((err, i) => (
                <p key={i} className="mb-1">
                  {err}
                </p>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
