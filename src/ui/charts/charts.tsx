import { boxStats, mean as meanOf, median as medianOf, sortedCopy } from '../../stats/descriptive';
import { normInv, normPdf } from '../../stats/distributions';
import { normalScores } from '../../stats/normality';
import { C, GROUP_COLOURS, H, M, Svg, W, XAxis, YAxis, jitter, niceDomain, niceTicks, scale, tickLabel } from './common';

type Sep = '.' | ',';

// ---------------------------------------------------------------- histogram

export function Histogram(props: {
  title: string;
  xLabel: string;
  yLabel: string;
  values: number[];
  bins: number;
  density: boolean;
  showMean: boolean;
  showMedian: boolean;
  showNormal: boolean;
  statsText: string | null;
  meanLabel: string;
  medianLabel: string;
  sep: Sep;
}) {
  const x = props.values;
  const n = x.length;
  const lo = Math.min(...x);
  const hi = Math.max(...x);
  const k = Math.max(1, Math.round(props.bins));
  const width = hi > lo ? (hi - lo) / k : 1;
  const start = hi > lo ? lo : lo - 0.5;
  const counts = new Array<number>(k).fill(0);
  for (const v of x) counts[Math.min(k - 1, Math.floor((v - start) / width))]!++;
  const heights = counts.map((c) => (props.density ? c / (n * width) : c));

  const m = meanOf(x);
  const s = n > 1 ? Math.sqrt(x.reduce((a, v) => a + (v - m) ** 2, 0) / (n - 1)) : 0;
  const curveAt = (v: number) => (s > 0 ? normPdf((v - m) / s) / s : 0) * (props.density ? 1 : n * width);
  const curveTop = props.showNormal && s > 0 ? curveAt(m) : 0;

  const [x0, x1] = niceDomain(start, start + k * width);
  const yTicks = niceTicks(0, Math.max(...heights, curveTop) * 1.05 || 1, 5);
  const xs = scale(x0, x1, M.left, W - M.right);
  const ys = scale(0, yTicks.at(-1)!, H - M.bottom, M.top);

  const curve =
    props.showNormal && s > 0
      ? Array.from({ length: 121 }, (_, i) => {
          const v = x0 + ((x1 - x0) * i) / 120;
          return `${xs(v).toFixed(1)},${ys(Math.min(curveAt(v), yTicks.at(-1)!)).toFixed(1)}`;
        }).join(' ')
      : null;

  return (
    <Svg title={props.title}>
      <YAxis ticks={yTicks} y={ys} x={M.left} label={props.yLabel} sep={props.sep} />
      <XAxis ticks={niceTicks(x0, x1)} x={xs} y={H - M.bottom} label={props.xLabel} sep={props.sep} />
      {heights.map((h, i) => (
        <rect
          key={i}
          x={xs(start + i * width)}
          y={ys(h)}
          width={Math.max(0, xs(start + (i + 1) * width) - xs(start + i * width))}
          height={Math.max(0, ys(0) - ys(h))}
          fill={C.fill}
          stroke={C.white}
          stroke-width="1"
        />
      ))}
      {curve && <polyline points={curve} fill="none" stroke={C.accent} stroke-width="2" />}
      {props.showMean && <VLine x={xs(m)} label={props.meanLabel} colour={GROUP_COLOURS[5]!} dashed={false} />}
      {props.showMedian && <VLine x={xs(medianOf(sortedCopy(x)))} label={props.medianLabel} colour={GROUP_COLOURS[0]!} dashed />}
      {props.statsText && (
        <text x={W - M.right} y={M.top + 4} text-anchor="end" fill={C.muted} font-size="12">
          {props.statsText}
        </text>
      )}
    </Svg>
  );
}

function VLine(props: { x: number; label: string; colour: string; dashed: boolean }) {
  return (
    <g>
      <line
        x1={props.x}
        x2={props.x}
        y1={M.top + 14}
        y2={H - M.bottom}
        stroke={props.colour}
        stroke-width="2"
        stroke-dasharray={props.dashed ? '6 4' : undefined}
      />
      <text x={props.x + 4} y={M.top + 26} fill={props.colour} font-size="12">
        {props.label}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------- box plot

export interface BoxGroup {
  label: string;
  values: number[];
}

export function BoxPlot(props: {
  title: string;
  valueLabel: string;
  groupLabel: string;
  groups: BoxGroup[];
  horizontal: boolean;
  showMean: boolean;
  showPoints: boolean;
  sep: Sep;
}) {
  const all = props.groups.flatMap((g) => g.values);
  const [v0, v1] = niceDomain(Math.min(...all), Math.max(...all));
  const ticks = niceTicks(v0, v1);
  const k = props.groups.length;
  const colourOf = (i: number) => (k === 1 ? C.accent : GROUP_COLOURS[i % GROUP_COLOURS.length]!);
  const hz = props.horizontal;
  const left = hz ? Math.max(M.left, 12 + 7 * Math.max(...props.groups.map((g) => g.label.length))) : M.left;
  const val = hz ? scale(v0, v1, left, W - M.right) : scale(v0, v1, H - M.bottom, M.top);
  const bandStart = hz ? M.top : left;
  const bandLen = hz ? H - M.bottom - M.top : W - M.right - left;
  const slot = bandLen / k;
  const half = Math.min(slot * 0.3, 60);

  // pos(v, c): value v at cross-position c (centre of the group band)
  const pt = (v: number, c: number) => (hz ? { x: val(v), y: c } : { x: c, y: val(v) });

  return (
    <Svg title={props.title}>
      {hz ? (
        <XAxis ticks={ticks} x={val} y={H - M.bottom} label={props.valueLabel} sep={props.sep} />
      ) : (
        <YAxis ticks={ticks} y={val} x={M.left} label={props.valueLabel} sep={props.sep} />
      )}
      {props.groups.map((g, i) => {
        const b = boxStats(g.values);
        const c = bandStart + slot * (i + 0.5);
        const colour = colourOf(i);
        const labelPos = hz ? { x: left - 8, y: c + 4, anchor: 'end' } : { x: c, y: H - M.bottom + 19, anchor: 'middle' };
        const label = (
          <text x={labelPos.x} y={labelPos.y} text-anchor={labelPos.anchor} fill={C.text}>
            {g.label}
          </text>
        );
        const points = props.showPoints
          ? g.values.map((v, j) => {
              const p = pt(v, c + jitter(j + i * 997) * half * 0.8);
              return <circle key={`p${j}`} cx={p.x} cy={p.y} r="2.4" fill={colour} fill-opacity="0.35" />;
            })
          : null;
        if (!b) {
          return (
            <g key={g.label}>
              {label}
              {g.values.map((v, j) => {
                const p = pt(v, c);
                return <circle key={j} cx={p.x} cy={p.y} r="3.5" fill={colour} />;
              })}
            </g>
          );
        }
        const lo = pt(b.q1, c - half);
        const hi = pt(b.q3, c + half);
        const med0 = pt(b.median, c - half);
        const med1 = pt(b.median, c + half);
        const wl = pt(b.whiskerLow, c);
        const wh = pt(b.whiskerHigh, c);
        const ql = pt(b.q1, c);
        const qh = pt(b.q3, c);
        const cap = (v: number) => {
          const a = pt(v, c - half / 2);
          const z = pt(v, c + half / 2);
          return <line x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke={colour} stroke-width="1.5" />;
        };
        const m = pt(meanOf(g.values), c);
        return (
          <g key={g.label}>
            {label}
            {points}
            <line x1={wl.x} y1={wl.y} x2={ql.x} y2={ql.y} stroke={colour} stroke-width="1.5" />
            <line x1={qh.x} y1={qh.y} x2={wh.x} y2={wh.y} stroke={colour} stroke-width="1.5" />
            {cap(b.whiskerLow)}
            {cap(b.whiskerHigh)}
            <rect
              x={Math.min(lo.x, hi.x)}
              y={Math.min(lo.y, hi.y)}
              width={Math.abs(hi.x - lo.x)}
              height={Math.abs(hi.y - lo.y)}
              fill={colour}
              fill-opacity="0.22"
              stroke={colour}
              stroke-width="1.5"
            />
            <line x1={med0.x} y1={med0.y} x2={med1.x} y2={med1.y} stroke={colour} stroke-width="2.5" />
            {b.outliers.map((idx) => {
              const p = pt(g.values[idx]!, c);
              return <circle key={`o${idx}`} cx={p.x} cy={p.y} r="3.5" fill={C.white} stroke={colour} stroke-width="1.5" />;
            })}
            {props.showMean && (
              <path d={`M${m.x - 5},${m.y} L${m.x},${m.y - 5} L${m.x + 5},${m.y} L${m.x},${m.y + 5} Z`} fill={C.text} />
            )}
          </g>
        );
      })}
      {k > 1 && !hz && (
        <text x={(left + W - M.right) / 2} y={H - M.bottom + 42} text-anchor="middle" fill={C.text}>
          {props.groupLabel}
        </text>
      )}
    </Svg>
  );
}

// ---------------------------------------------------------------- Q-Q plot

export function QQPlot(props: { title: string; valueLabel: string; zLabel: string; values: number[]; band: boolean; sep: Sep }) {
  const s = sortedCopy(props.values);
  const n = s.length;
  const z = normalScores(n);
  // Reference line through the quartiles: (z₀.₂₅, Q1) and (z₀.₇₅, Q3), EXC quartiles.
  const q = (p: number) => {
    const pos = p * (n + 1);
    const k = Math.min(Math.max(Math.floor(pos), 1), n - 1);
    return s[k - 1]! + (pos - k) * (s[k]! - s[k - 1]!);
  };
  const z1 = normInv(0.25);
  const z3 = normInv(0.75);
  const slope = n >= 3 ? (q(0.75) - q(0.25)) / (z3 - z1) : 0;
  const intercept = n >= 3 ? q(0.25) - slope * z1 : meanOf(s);
  const line = (zz: number) => intercept + slope * zz;
  const halfBand = (i: number) => {
    const p = (i + 1 - 0.375) / (n + 0.25);
    return (1.96 * slope * Math.sqrt((p * (1 - p)) / n)) / normPdf(z[i]!);
  };

  const yLo = Math.min(s[0]!, ...(props.band ? z.map((zz, i) => line(zz) - halfBand(i)) : []));
  const yHi = Math.max(s[n - 1]!, ...(props.band ? z.map((zz, i) => line(zz) + halfBand(i)) : []));
  const [y0, y1] = niceDomain(yLo, yHi);
  const [x0, x1] = niceDomain(Math.min(-2, z[0]!), Math.max(2, z[n - 1]!));
  const xs = scale(x0, x1, M.left, W - M.right);
  const ys = scale(y0, y1, H - M.bottom, M.top);
  const clampY = (v: number) => ys(Math.max(y0, Math.min(y1, v)));
  const path = (f: (i: number) => number) => z.map((zz, i) => `${xs(zz).toFixed(1)},${clampY(f(i)).toFixed(1)}`).join(' ');

  return (
    <Svg title={props.title}>
      <YAxis ticks={niceTicks(y0, y1)} y={ys} x={M.left} label={props.valueLabel} sep={props.sep} />
      <XAxis ticks={niceTicks(x0, x1)} x={xs} y={H - M.bottom} label={props.zLabel} sep={props.sep} />
      {n >= 3 && <line x1={xs(x0)} y1={clampY(line(x0))} x2={xs(x1)} y2={clampY(line(x1))} stroke={C.accent} stroke-width="1.5" />}
      {props.band && n >= 3 && (
        <>
          <polyline points={path((i) => line(z[i]!) - halfBand(i))} fill="none" stroke={C.band} stroke-width="1.2" stroke-dasharray="5 4" />
          <polyline points={path((i) => line(z[i]!) + halfBand(i))} fill="none" stroke={C.band} stroke-width="1.2" stroke-dasharray="5 4" />
        </>
      )}
      {s.map((v, i) => (
        <circle key={i} cx={xs(z[i]!)} cy={ys(v)} r="3" fill={C.accent} fill-opacity="0.75" />
      ))}
    </Svg>
  );
}

// ---------------------------------------------------------------- bar chart

export function BarChart(props: {
  title: string;
  xLabel: string;
  yLabel: string;
  categories: string[];
  values: number[];
  sep: Sep;
  /** Format the value printed on top of each bar. */
  label: (v: number) => string;
}) {
  const k = props.categories.length;
  const yTicks = niceTicks(0, Math.max(...props.values, 0) * 1.08 || 1, 5);
  const ys = scale(0, yTicks.at(-1)!, H - M.bottom, M.top);
  const slot = (W - M.right - M.left) / Math.max(k, 1);
  const bw = Math.min(slot * 0.7, 90);
  const rotate = k > 6;
  return (
    <Svg title={props.title}>
      <YAxis ticks={yTicks} y={ys} x={M.left} label={props.yLabel} sep={props.sep} />
      <line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke={C.axis} />
      {props.categories.map((cat, i) => {
        const cx = M.left + slot * (i + 0.5);
        const v = props.values[i]!;
        return (
          <g key={cat}>
            <rect x={cx - bw / 2} y={ys(v)} width={bw} height={Math.max(0, ys(0) - ys(v))} fill={C.fill} />
            <text x={cx} y={ys(v) - 5} text-anchor="middle" fill={C.text} font-size="12">
              {props.label(v)}
            </text>
            <text
              x={cx}
              y={H - M.bottom + 18}
              text-anchor={rotate ? 'end' : 'middle'}
              transform={rotate ? `rotate(-35 ${cx} ${H - M.bottom + 18})` : undefined}
              fill={C.text}
              font-size="12"
            >
              {cat.length > 18 ? `${cat.slice(0, 17)}…` : cat}
            </text>
          </g>
        );
      })}
      {!rotate && (
        <text x={(M.left + W - M.right) / 2} y={H - M.bottom + 42} text-anchor="middle" fill={C.text}>
          {props.xLabel}
        </text>
      )}
    </Svg>
  );
}

export { tickLabel };

// ---------------------------------------------------------------- scatter and residual plots

export function Scatter(props: {
  title: string;
  xLabel: string;
  yLabel: string;
  x: number[];
  y: number[];
  /** Fitted line y = a + b·x drawn across the x range, if given. */
  line?: { a: number; b: number } | null;
  /** Horizontal reference at y = 0 (residual plot). */
  zeroLine?: boolean;
  sep: Sep;
}) {
  const [x0, x1] = niceDomain(Math.min(...props.x), Math.max(...props.x));
  const ys = props.zeroLine ? [...props.y, 0] : props.y;
  const [y0, y1] = niceDomain(Math.min(...ys), Math.max(...ys));
  const sx = scale(x0, x1, M.left, W - M.right);
  const sy = scale(y0, y1, H - M.bottom, M.top);
  const lo = Math.min(...props.x);
  const hi = Math.max(...props.x);
  return (
    <Svg title={props.title}>
      <YAxis ticks={niceTicks(y0, y1)} y={sy} x={M.left} label={props.yLabel} sep={props.sep} />
      <XAxis ticks={niceTicks(x0, x1)} x={sx} y={H - M.bottom} label={props.xLabel} sep={props.sep} />
      {props.zeroLine && <line x1={sx(x0)} x2={sx(x1)} y1={sy(0)} y2={sy(0)} stroke={C.muted} stroke-dasharray="5 4" />}
      {props.x.map((v, i) => (
        <circle key={i} cx={sx(v)} cy={sy(props.y[i]!)} r="3.5" fill={C.accent} fill-opacity="0.7" />
      ))}
      {props.line && (
        <line
          x1={sx(lo)}
          y1={sy(props.line.a + props.line.b * lo)}
          x2={sx(hi)}
          y2={sy(props.line.a + props.line.b * hi)}
          stroke={GROUP_COLOURS[5]}
          stroke-width="2"
        />
      )}
    </Svg>
  );
}
