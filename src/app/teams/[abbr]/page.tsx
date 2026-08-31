"use client";

import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import clsx from "clsx";
import TopBar from "@/components/TopBar";
import { useTeams } from "@/lib/useTeams";
import { fmtNum, fmtSigned, fmtMoney, fmtSignedMoney, fmtPct } from "@/lib/format";
import type { ScheduleGame } from "@/lib/team-types";

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div
        className={clsx(
          "mt-0.5 text-lg font-semibold tabular-nums",
          tone === "pos" && "text-accent",
          tone === "neg" && "text-danger"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function GameRow({ game }: { game: ScheduleGame }) {
  const badgeColor =
    game.result === "W" ? "bg-accent/20 text-accent" : game.result === "L" ? "bg-danger/20 text-danger" : "bg-surface-2 text-muted";
  const dateStr = game.date
    ? new Date(game.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";

  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <span className="w-7 flex-shrink-0 text-xs text-muted">Wk{game.week}</span>
        <span className="text-sm">
          {game.home ? "vs" : "@"} {game.opponentName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {game.played ? (
          <>
            <span className="text-sm tabular-nums text-muted">
              {game.teamScore}-{game.opponentScore}
            </span>
            <span className={clsx("rounded-md px-1.5 py-0.5 text-xs font-semibold", badgeColor)}>
              {game.result}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted">{dateStr}</span>
        )}
      </div>
    </div>
  );
}

export default function TeamDetailPage() {
  const params = useParams<{ abbr: string }>();
  const router = useRouter();
  const { teams, loading } = useTeams();
  const team = teams?.find((t) => t.abbr.toLowerCase() === params.abbr.toLowerCase());

  return (
    <>
      <TopBar title="Team" />
      <main className="mx-auto max-w-2xl px-3 pt-4 pb-6">
        <button onClick={() => router.back()} className="mb-3 text-sm text-muted">
          ← Back
        </button>

        {loading && <div className="h-40 animate-pulse rounded-2xl bg-surface" />}

        {!loading && !team && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            Team not found.
          </div>
        )}

        {team && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <Image src={team.logoUrl} alt={team.abbr} width={56} height={56} unoptimized />
              <div>
                <h2 className="text-xl font-bold">{team.name}</h2>
                <p className="text-sm text-muted">
                  {team.division} · {team.playerName ?? "Undrafted"}
                </p>
              </div>
            </div>

            <div className="mb-2 grid grid-cols-3 gap-2">
              <StatCard label="Record" value={`${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ""}`} />
              <StatCard label="Win %" value={fmtPct(team.winPct)} />
              <StatCard label="Diff/G" value={fmtSigned(team.diff)} tone={team.diff > 0 ? "pos" : team.diff < 0 ? "neg" : undefined} />
              <StatCard label="Preseason O/U" value={fmtNum(team.preseasonOU)} />
              <StatCard label="Projected" value={fmtNum(team.projected)} />
              <StatCard label="Pythagorean" value={fmtNum(team.pythagoreanWins)} />
              <StatCard label="Paid" value={fmtMoney(team.paid)} />
              <StatCard label="Value" value={fmtSignedMoney(team.value)} tone={(team.value ?? 0) > 0 ? "pos" : (team.value ?? 0) < 0 ? "neg" : undefined} />
              <StatCard label="EPA/play" value={fmtSigned(team.epa, 3)} tone={team.epa > 0 ? "pos" : team.epa < 0 ? "neg" : undefined} />
            </div>

            <section className="mt-5">
              <h3 className="mb-1 px-1 text-sm font-semibold text-muted">Past Schedule</h3>
              <div className="rounded-2xl border border-border bg-surface px-3">
                {team.pastSchedule.length === 0 ? (
                  <p className="py-3 text-sm text-muted">No games played yet.</p>
                ) : (
                  team.pastSchedule.map((g, i) => <GameRow key={i} game={g} />)
                )}
              </div>
            </section>

            <section className="mt-5">
              <h3 className="mb-1 px-1 text-sm font-semibold text-muted">Future Schedule</h3>
              <div className="rounded-2xl border border-border bg-surface px-3">
                {team.futureSchedule.length === 0 ? (
                  <p className="py-3 text-sm text-muted">Season complete.</p>
                ) : (
                  team.futureSchedule.map((g, i) => <GameRow key={i} game={g} />)
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
