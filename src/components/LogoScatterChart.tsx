"use client";

import { useState } from "react";
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

export interface DiagonalLine {
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: ScatterPoint;
}

/**
 * Snug axis domain + ticks around the data: min/max padded by ~10% of the
 * span (room for the logo dots), widened to at least `minSpan` around the
 * data's center so a tight cluster doesn't over-zoom, stretched to include 0
 * when 0 sits just outside, then snapped outward to nice tick steps.
 */
export function snugAxis(
  values: number[],
  minSpan: number
): { domain: [number, number]; ticks: number[] } | undefined {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return undefined;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const pad = Math.max((max - min) * 0.1, minSpan * 0.05);
  let lo = min - pad;
  let hi = max + pad;
  if (hi - lo < minSpan) {
    const center = (min + max) / 2;
    lo = center - minSpan / 2;
    hi = center + minSpan / 2;
  }
  // Keep the 0 reference line on the chart when it's close to the data.
  const nearZero = (hi - lo) * 0.25;
  if (lo > 0 && lo <= nearZero) lo = 0;
  if (hi < 0 && -hi <= nearZero) hi = 0;
  // Round away float noise (e.g. 0.30000000000000004) so ticks format cleanly.
  const snap = (n: number) => Math.round(n * 1e9) / 1e9;
  // Pick the nice 1/2/2.5/5 x 10^k step whose outward-rounded domain wastes
  // the least space while keeping a readable 4-7 tick intervals.
  const mag = Math.pow(10, Math.floor(Math.log10((hi - lo) / 5)));
  let best: { lo: number; hi: number; step: number } | undefined;
  for (const m of [mag / 10, mag, mag * 10]) {
    for (const n of [1, 2, 2.5, 5]) {
      const step = n * m;
      const l = snap(Math.floor(snap(lo / step)) * step);
      const h = snap(Math.ceil(snap(hi / step)) * step);
      const intervals = Math.round((h - l) / step);
      if (intervals < 4 || intervals > 7) continue;
      if (!best || h - l < best.hi - best.lo - 1e-9) best = { lo: l, hi: h, step };
    }
  }
  if (!best) best = { lo, hi, step: (hi - lo) / 5 };
  const step = best.step;
  lo = best.lo;
  hi = best.hi;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(snap(t));
  return { domain: [lo, hi], ticks };
}

// Logo URLs that failed to load, remembered across re-renders so a missing
// logo stays a plain circle instead of flashing a broken-image icon.
const failedLogos = new Set<string>();

function LogoDot({ cx, cy, payload }: DotProps) {
  const [failed, setFailed] = useState(() => !!payload && failedLogos.has(payload.logoUrl));
  if (cx === undefined || cy === undefined || !payload) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill="var(--surface)" stroke="var(--border)" />
      {!failed && (
        <image
          href={payload.logoUrl}
          x={cx - 9}
          y={cy - 9}
          width={18}
          height={18}
          onError={() => {
            failedLogos.add(payload.logoUrl);
            setFailed(true);
          }}
        />
      )}
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
  diagonalLines = [],
  yReversed = false,
  fitMinSpan,
}: {
  title: string;
  note?: string;
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xFmt?: (n: number) => string;
  yFmt?: (n: number) => string;
  height?: number;
  diagonalLines?: DiagonalLine[];
  // Flips the Y axis's visual direction (top<->bottom) without touching the
  // underlying data or its sign convention - e.g. defensive EPA/play where
  // negative is genuinely better, but "up = better" should still read the
  // same as every other axis in the app.
  yReversed?: boolean;
  // When set, both axes fit the data snugly (see snugAxis) with at least this
  // much span each, instead of Recharts' wide auto-rounded domains.
  fitMinSpan?: number;
}) {
  const xFit =
    fitMinSpan !== undefined ? snugAxis(points.map((p) => p.x), fitMinSpan) : undefined;
  const yFit =
    fitMinSpan !== undefined ? snugAxis(points.map((p) => p.y), fitMinSpan) : undefined;
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
              domain={xFit?.domain ?? ["auto", "auto"]}
              ticks={xFit?.ticks}
              interval={xFit ? 0 : undefined}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={(v) => xFmt(v as number)}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              reversed={yReversed}
              domain={yFit?.domain ?? ["auto", "auto"]}
              ticks={yFit?.ticks}
              interval={yFit ? 0 : undefined}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v) => yFmt(v as number)}
            />
            <ReferenceLine x={0} stroke="var(--border)" />
            <ReferenceLine y={0} stroke="var(--border)" />
            {diagonalLines.map((d) => (
              <ReferenceLine
                key={d.label}
                segment={[
                  { x: d.x1, y: d.y1 },
                  { x: d.x2, y: d.y2 },
                ]}
                stroke="var(--muted)"
                strokeDasharray="4 3"
                ifOverflow="extendDomain"
                label={{
                  value: d.label,
                  position: "insideTopRight",
                  fill: "var(--muted)",
                  fontSize: 9,
                }}
              />
            ))}
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
