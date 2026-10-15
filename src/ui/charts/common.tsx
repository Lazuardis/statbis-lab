import type { ComponentChildren } from 'preact';

/**
 * Shared pieces for the hand-written SVG charts. Colours are literal values (not CSS variables)
 * so a downloaded SVG/PNG or a chart in the report looks the same outside the app.
 */

export const C = {
  accent: '#0F6B6B',
  fill: '#4F9393',
  text: '#1F2933',
  muted: '#6B7785',
  axis: '#9AA5B1',
  band: '#B42318',
  white: '#FFFFFF',
};

/** Okabe–Ito: colour-blind-safe palette for groups. */
export const GROUP_COLOURS = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000'];

export const FONT = 'Lato, "Segoe UI", Arial, sans-serif';

export const W = 600;
export const H = 380;
export const M = { top: 44, right: 24, bottom: 58, left: 70 };

/** Round numbers for axis ticks covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, target = 6): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (lo === hi) {
    const d = Math.abs(lo) || 1;
    lo -= d / 2;
    hi += d / 2;
  }
  const raw = (hi - lo) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const first = Math.ceil(lo / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = first; v <= hi + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return ticks;
}

/** Extend [lo, hi] outwards to the nearest nice ticks. */
export function niceDomain(lo: number, hi: number, target = 6): [number, number] {
  if (lo === hi) return [lo - (Math.abs(lo) || 1) / 2, hi + (Math.abs(hi) || 1) / 2];
  const t = niceTicks(lo, hi, target);
  const step = t.length > 1 ? t[1]! - t[0]! : (hi - lo) / target;
  return [Math.min(lo, Math.floor(lo / step + 1e-9) * step), Math.max(hi, Math.ceil(hi / step - 1e-9) * step)];
}

export function scale(d0: number, d1: number, r0: number, r1: number) {
  const k = (r1 - r0) / (d1 - d0 || 1);
  return (v: number) => r0 + (v - d0) * k;
}

/** Tick label without trailing zeros, with the chosen decimal separator. */
export function tickLabel(v: number, sep: '.' | ','): string {
  const s = Number(v.toPrecision(10)).toString();
  return sep === ',' ? s.replace('.', ',') : s;
}

export function Svg(props: { title: string; children: ComponentChildren; width?: number; height?: number }) {
  const w = props.width ?? W;
  const h = props.height ?? H;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      font-family={FONT}
      font-size="13"
      role="img"
      aria-label={props.title}
      class="chart-svg"
    >
      <rect width={w} height={h} fill={C.white} />
      <text x={w / 2} y={24} text-anchor="middle" font-size="16" fill={C.text}>
        {props.title}
      </text>
      {props.children}
    </svg>
  );
}

/** Left axis with ticks and a rotated label. */
export function YAxis(props: { ticks: number[]; y: (v: number) => number; x: number; label: string; sep: '.' | ','; height?: number }) {
  const h = props.height ?? H;
  return (
    <g>
      <line x1={props.x} x2={props.x} y1={props.y(props.ticks[0] ?? 0)} y2={props.y(props.ticks.at(-1) ?? 0)} stroke={C.axis} />
      {props.ticks.map((t) => (
        <g key={t}>
          <line x1={props.x - 5} x2={props.x} y1={props.y(t)} y2={props.y(t)} stroke={C.axis} />
          <text x={props.x - 8} y={props.y(t) + 4} text-anchor="end" fill={C.muted} font-size="12">
            {tickLabel(t, props.sep)}
          </text>
        </g>
      ))}
      <text transform={`translate(18 ${(M.top + h - M.bottom) / 2}) rotate(-90)`} text-anchor="middle" fill={C.text}>
        {props.label}
      </text>
    </g>
  );
}

/** Bottom axis with ticks and a label. */
export function XAxis(props: { ticks: number[]; x: (v: number) => number; y: number; label: string; sep: '.' | ','; width?: number }) {
  const w = props.width ?? W;
  return (
    <g>
      <line x1={props.x(props.ticks[0] ?? 0)} x2={props.x(props.ticks.at(-1) ?? 0)} y1={props.y} y2={props.y} stroke={C.axis} />
      {props.ticks.map((t) => (
        <g key={t}>
          <line x1={props.x(t)} x2={props.x(t)} y1={props.y} y2={props.y + 5} stroke={C.axis} />
          <text x={props.x(t)} y={props.y + 19} text-anchor="middle" fill={C.muted} font-size="12">
            {tickLabel(t, props.sep)}
          </text>
        </g>
      ))}
      <text x={(M.left + w - M.right) / 2} y={props.y + 42} text-anchor="middle" fill={C.text}>
        {props.label}
      </text>
    </g>
  );
}

/** Deterministic jitter in [−1, 1] so a re-rendered chart does not shuffle its points. */
export function jitter(i: number): number {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}
