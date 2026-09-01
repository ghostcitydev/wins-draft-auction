"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ScatterPoint {
  key: string;
  label: string;
  logoUrl: string;
  x: number;
  y: number;
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: ScatterPoint;
}

function LogoDot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill="var(--surface)" stroke="var(--border)" />
      <image href={payload.logoUrl} x={cx - 9} y={cy - 9} width={18} height={18} />
    </g>
  );
}

function ChartTooltip({
  active,
  payload,
  xLabel,
  yLabel,
  fmt,
}: {
  active?: boolean;
  payload?: { payload: ScatterPoint }[];
  xLabel: string;
  yLabel: string;
  fmt: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-semibold">{p.label}</p>
      <p className="text-muted">
        {xLabel}: <span className="text-foreground">{fmt(p.x)}</span>
      </p>
      <p className="text-muted">
        {yLabel}: <span className="text-foreground">{fmt(p.y)}</span>
      </p>
    </div>
  );
}

export default function LogoScatterChart({
  title,
  note,
  points,
  xLabel,
  yLabel,
  fmt = (n: number) => n.toFixed(3),
  height = 260,
}: {
  title: string;
  note?: string;
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  fmt?: (n: number) => string;
  height?: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="mb-1 px-1 text-sm font-semibold">{title}</p>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              label={{ value: xLabel, position: "insideBottom", offset: -4, fontSize: 11, fill: "var(--muted)" }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              width={36}
              label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--muted)" }}
            />
            <ReferenceLine x={0} stroke="var(--border)" />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Tooltip
              content={<ChartTooltip xLabel={xLabel} yLabel={yLabel} fmt={fmt} />}
              cursor={{ stroke: "var(--border)" }}
            />
            <Scatter data={points} shape={(props: unknown) => <LogoDot {...(props as DotProps)} />} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {note && <p className="mt-1 px-1 text-[11px] text-muted">{note}</p>}
    </div>
  );
}
