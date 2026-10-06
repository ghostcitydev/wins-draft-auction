"use client";

import { useState } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  usePlotArea,
  useXAxisScale,
  useYAxisScale,
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

/** Faint labels for the four visual quadrants (split at the 0 lines). */
export interface QuadrantLabels {
  topLeft: string[];
  topRight: string[];
  bottomLeft: string[];
  bottomRight: string[];
}

const QUAD_FONT = 9;
const QUAD_LINE = 10;
const DOT_CLEARANCE = 13; // logo dot radius (10) + a little breathing room

/**
 * Draws each quadrant's label in the first spot - scanning inward from the
 * quadrant's outer corner - whose text box doesn't touch any team's logo.
 * A label with no free spot is simply left off.
 */
function QuadrantLabelLayer({ labels, points }: { labels: QuadrantLabels; points: ScatterPoint[] }) {
  const plot = usePlotArea();
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  if (!plot || !xScale || !yScale) return null;

  const left = plot.x;
  const right = plot.x + plot.width;
  const top = plot.y;
  const bottom = plot.y + plot.height;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const zeroX = clamp(Number(xScale(0) ?? (left + right) / 2), left, right);
  const zeroY = clamp(Number(yScale(0) ?? (top + bottom) / 2), top, bottom);
  const dots = points
    .map((p) => ({ x: Number(xScale(p.x)), y: Number(yScale(p.y)) }))
    .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));

  const hitsDot = (bx: number, by: number, bw: number, bh: number) =>
    dots.some((d) => {
      const nx = clamp(d.x, bx, bx + bw);
      const ny = clamp(d.y, by, by + bh);
      return (d.x - nx) ** 2 + (d.y - ny) ** 2 < DOT_CLEARANCE ** 2;
    });

  const inset = 4;
  const quads = [
    { lines: labels.topLeft, x0: left, x1: zeroX, y0: top, y1: zeroY, alignRight: false, fromTop: true },
    { lines: labels.topRight, x0: zeroX, x1: right, y0: top, y1: zeroY, alignRight: true, fromTop: true },
    { lines: labels.bottomLeft, x0: left, x1: zeroX, y0: zeroY, y1: bottom, alignRight: false, fromTop: false },
    { lines: labels.bottomRight, x0: zeroX, x1: right, y0: zeroY, y1: bottom, alignRight: true, fromTop: false },
  ];

  return (
    <g pointerEvents="none">
      {quads.map((q, qi) => {
        const w = Math.max(...q.lines.map((l) => l.length)) * QUAD_FONT * 0.55;
        const h = q.lines.length * QUAD_LINE;
        const xMin = q.x0 + inset;
        const xMax = q.x1 - inset - w;
        const yMin = q.y0 + inset;
        const yMax = q.y1 - inset - h;
        if (xMax < xMin || yMax < yMin) return null;
        // Candidate boxes ordered by distance from the quadrant's outer corner.
        const candidates: { x: number; y: number; dist: number }[] = [];
        for (let dx = 0; dx <= xMax - xMin; dx += 6) {
          for (let dy = 0; dy <= yMax - yMin; dy += 4) {
            candidates.push({
              x: q.alignRight ? xMax - dx : xMin + dx,
              y: q.fromTop ? yMin + dy : yMax - dy,
              dist: dx * dx + dy * dy,
            });
          }
        }
        candidates.sort((a, b) => a.dist - b.dist);
        const spot = candidates.find((c) => !hitsDot(c.x, c.y, w, h));
        if (!spot) return null;
        return (
          <text
            key={qi}
            x={q.alignRight ? spot.x + w : spot.x}
            y={spot.y}
            textAnchor={q.alignRight ? "end" : "start"}
            fontSize={QUAD_FONT}
            fill="var(--muted)"
            opacity={0.45}
          >
            {q.lines.map((line, li) => (
              <tspan
                key={li}
                x={q.alignRight ? spot.x + w : spot.x}
                dy={li === 0 ? QUAD_FONT : QUAD_LINE}
              >
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </g>
  );
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
  const nearZero = (hi - lo) * 0.15;
  if (lo > 0 && lo <= nearZero) lo = 0;
  if (hi < 0 && -hi <= nearZero) hi = 0;
  // Round away float noise (e.g. 0.30000000000000004) so ticks format cleanly.
  const snap = (n: number) => Math.round(n * 1e9) / 1e9;
  // Pick the nice 1/2/5 x 10^k step whose outward-rounded domain wastes the
  // least space while keeping a readable 4-9 tick intervals. (No 2.5 steps -
  // they'd show as rounded labels like "-8%" for -7.5% on whole-% axes.)
  const mag = Math.pow(10, Math.floor(Math.log10((hi - lo) / 5)));
  let best: { lo: number; hi: number; step: number } | undefined;
  for (const m of [mag / 10, mag, mag * 10]) {
    for (const n of [1, 2, 5]) {
      const step = n * m;
      const l = snap(Math.floor(snap(lo / step)) * step);
      const h = snap(Math.ceil(snap(hi / step)) * step);
      const intervals = Math.round((h - l) / step);
      if (intervals < 4 || intervals > 9) continue;
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
  xReversed = false,
  fitMinSpan,
  quadrantLabels,
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
  // Same idea for the X axis (right = better).
  xReversed?: boolean;
  // When set, the axes fit the data snugly (see snugAxis) with at least this
  // much span - one number for both axes, or [x, y] when their units differ -
  // instead of Recharts' wide auto-rounded domains.
  fitMinSpan?: number | [number, number];
  quadrantLabels?: QuadrantLabels;
}) {
  const [xMinSpan, yMinSpan] =
    typeof fitMinSpan === "number" ? [fitMinSpan, fitMinSpan] : fitMinSpan ?? [];
  const xFit =
    xMinSpan !== undefined ? snugAxis(points.map((p) => p.x), xMinSpan) : undefined;
  const yFit =
    yMinSpan !== undefined ? snugAxis(points.map((p) => p.y), yMinSpan) : undefined;
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
              reversed={xReversed}
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
            {quadrantLabels && <QuadrantLabelLayer labels={quadrantLabels} points={points} />}
            <Scatter data={points} shape={(props: unknown) => <LogoDot {...(props as DotProps)} />} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {note && <p className="mt-1 px-1 text-[11px] text-muted">{note}</p>}
    </div>
  );
}
