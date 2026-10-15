import { chi2Inv, chi2Pdf, fInv, fPdf } from '../../stats/distributions';
import { C, H, M, Svg, W, XAxis, YAxis, niceTicks, scale } from './common';

/**
 * F or χ² density with the observed statistic marked and the p-value area (to its right) shaded,
 * plus the critical value as a dashed line.
 */
export function DistChart(props: {
  kind: 'F' | 'chi2';
  df1: number;
  df2?: number;
  stat: number;
  crit: number;
  title: string;
  xLabel: string;
  yLabel: string;
  observedLabel: string;
  criticalLabel: string;
  pLabel: string;
  sep: '.' | ',';
}) {
  const pdf = (x: number) => (props.kind === 'F' ? fPdf(x, props.df1, props.df2!) : chi2Pdf(x, props.df1));
  const q999 = props.kind === 'F' ? fInv(0.999, props.df1, props.df2!) : chi2Inv(0.999, props.df1);
  const xMax = Math.max(props.stat * 1.15, props.crit * 1.25, Math.min(q999, Math.max(props.crit * 2, props.stat * 1.15)));
  const n = 240;
  const xs0 = Array.from({ length: n + 1 }, (_, i) => (xMax * i) / n);
  const ys0 = xs0.map((x) => (x === 0 ? NaN : pdf(x)));
  const finite = ys0.filter((y) => Number.isFinite(y));
  // Cap the spike near 0 (F with df1 ≤ 2, χ² with df ≤ 2) so the tail stays visible.
  const yCap = Math.min(Math.max(...finite), (finite[Math.floor(n * 0.08)] ?? 1) * 3);
  const yTicks = niceTicks(0, yCap * 1.05, 4);
  const yTop = yTicks.at(-1)!;
  const xTicks = niceTicks(0, xMax);
  const x = scale(0, xTicks.at(-1)!, M.left, W - M.right);
  const y = scale(0, yTop, H - M.bottom, M.top);
  const clamp = (v: number) => (Number.isFinite(v) ? Math.min(v, yTop) : yTop);
  const points = xs0.map((v, i) => `${x(v).toFixed(1)},${y(clamp(ys0[i]!)).toFixed(1)}`).join(' ');
  const tail = xs0.filter((v) => v >= props.stat);
  const area =
    props.stat < xMax
      ? `${x(props.stat).toFixed(1)},${y(0)} ` +
        [props.stat, ...tail].map((v) => `${x(v).toFixed(1)},${y(clamp(pdf(v))).toFixed(1)}`).join(' ') +
        ` ${x(xMax).toFixed(1)},${y(0)}`
      : '';

  return (
    <Svg title={props.title}>
      <YAxis ticks={yTicks} y={y} x={M.left} label={props.yLabel} sep={props.sep} />
      <XAxis ticks={xTicks} x={x} y={H - M.bottom} label={props.xLabel} sep={props.sep} />
      {area && <polygon points={area} fill={C.band} fill-opacity="0.25" />}
      <polyline points={points} fill="none" stroke={C.accent} stroke-width="2" />
      {props.crit <= xTicks.at(-1)! && (
        <line x1={x(props.crit)} x2={x(props.crit)} y1={M.top + 20} y2={H - M.bottom} stroke={C.muted} stroke-dasharray="5 4" />
      )}
      {props.stat <= xTicks.at(-1)! && (
        <line x1={x(props.stat)} x2={x(props.stat)} y1={M.top + 20} y2={H - M.bottom} stroke={C.band} stroke-width="2" />
      )}
      <text x={W - M.right} y={M.top + 6} text-anchor="end" fill={C.band} font-size="12">
        {props.observedLabel}
      </text>
      <text x={W - M.right} y={M.top + 22} text-anchor="end" fill={C.muted} font-size="12">
        {props.criticalLabel}
      </text>
      <text x={W - M.right} y={M.top + 38} text-anchor="end" fill={C.text} font-size="12">
        {props.pLabel}
      </text>
    </Svg>
  );
}
