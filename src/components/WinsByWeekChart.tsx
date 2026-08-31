"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface WeekPoint {
  week: number;
  wins: number;
}

interface PlayerWinsSeries {
  playerId: string;
  playerName: string;
  points: WeekPoint[];
}

interface WinsByWeekResult {
  season: number;
  isPreview: boolean;
  maxWeek: number;
  series: PlayerWinsSeries[];
}

const COLORS = [
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#ec4899",
  "#a855f7",
  "#eab308",
  "#14b8a6",
  "#ef4444",
];

export default function WinsByWeekChart() {
  const [data, setData] = useState<WinsByWeekResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wins-by-week", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Request failed");
        return json as WinsByWeekResult;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  if (error) return null;

  const noData = !data || data.maxWeek === 0 || data.series.every((s) => s.points.length === 0);

  if (!data || noData) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-sm font-semibold">Wins by week</p>
        <p className="mt-1 text-sm text-muted">
          Coming soon - this fills in once games start counting this season.
        </p>
      </div>
    );
  }

  const rows = Array.from({ length: data.maxWeek }, (_, i) => {
    const week = i + 1;
    const row: Record<string, number> = { week };
    for (const s of data.series) {
      row[s.playerName] = s.points.find((p) => p.week === week)?.wins ?? 0;
    }
    return row;
  });

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="mb-1 flex items-center justify-between px-1">
        <p className="text-sm font-semibold">Wins by week</p>
        {data.isPreview && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
            {data.season} preview
          </span>
        )}
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              labelFormatter={(w) => `Week ${w}`}
            />
            {data.series.map((s, i) => (
              <Line
                key={s.playerId}
                type="monotone"
                dataKey={s.playerName}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1">
        {data.series.map((s, i) => (
          <span key={s.playerId} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            {s.playerName}
          </span>
        ))}
      </div>

      {data.isPreview && (
        <p className="mt-2 px-1 text-[11px] text-muted">
          Showing {data.season}&apos;s actual results applied to this year&apos;s draft groups,
          since the current season hasn&apos;t started yet.
        </p>
      )}
    </div>
  );
}
