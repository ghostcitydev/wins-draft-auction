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
  xFmt,
  yFmt,
}: {
  active?: boolean;
  payload?: { payload: ScatterPoint }[];
  xLabel: string;
  yLabel: string;
  xFmt: (n: number) => string;
  yFmt: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-semibold">{p.label}</p>
      <p className="text-muted">
        {xLabel}: <span className="text-foreground">{xFmt(p.x)}</span>
      </p>
      <p className="text-muted">
        {yLabel}: <span className="text-foreground">{yFmt(p.y)}</span>
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
  xFmt = (n: number) => n.toFixed(1),
  yFmt = xFmt,
  height = 260,
}: {
  title: string;
  note?: string;
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xFmt?: (n: number) => string;
  yFmt?: (n: number) => string;
  height?: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="px-1 text-sm font-semibold">{title}</p>
      <p className="mb-1 px-1 text-[11px] text-muted">
        X: {xLabel} · Y: {yLabel}
      </p>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={(v) => xFmt(v as number)}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v) => yFmt(v as number)}
            />
            <ReferenceLine x={0} stroke="var(--border)" />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Tooltip
              content={<ChartTooltip xLabel={xLabel} yLabel={yLabel} xFmt={xFmt} yFmt={yFmt} />}
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
