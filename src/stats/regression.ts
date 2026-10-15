import { mean } from './descriptive';
import { fSf, tInv } from './distributions';
import { pFromT } from './tests';

export interface Pearson {
  n: number;
  r: number;
  t: number;
  df: number;
  p: number;
}

/** Pearson r with the test of ρ = 0: t = r√(n − 2)/√(1 − r²), df = n − 2 (two-sided). */
export function pearson(x: readonly number[], y: readonly number[]): Pearson | null {
  const n = x.length;
  if (n < 3) return null;
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (!(sxx > 0 && syy > 0)) return null;
  const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
  const df = n - 2;
  const t = Math.abs(r) === 1 ? Math.sign(r) * Infinity : (r * Math.sqrt(df)) / Math.sqrt(1 - r * r);
  return { n, r, t, df, p: Math.abs(r) === 1 ? 0 : pFromT(t, df, 'two-sided') };
}

export interface Coefficient {
  b: number;
  se: number;
  t: number;
  p: number;
  lower: number;
  upper: number;
}

export interface SimpleRegression {
  n: number;
  meanX: number;
  meanY: number;
  sxx: number;
  sxy: number;
  intercept: Coefficient;
  slope: Coefficient;
  r: number;
  rSquared: number;
  /** Standard error of the estimate √(SSE/(n − 2)) */
  seEstimate: number;
  ssRegression: number;
  ssResidual: number;
  ssTotal: number;
  dfRegression: number;
  dfResidual: number;
  dfTotal: number;
  msRegression: number;
  msResidual: number;
  f: number;
  pF: number;
  tCrit: number;
  minX: number;
  maxX: number;
  fitted: number[];
  residuals: number[];
}

/** Ordinary least squares y = b₀ + b₁x (Excel SLOPE, INTERCEPT, RSQ and the ToolPak regression). */
export function simpleRegression(x: readonly number[], y: readonly number[], confidence: number): SimpleRegression | null {
  const n = x.length;
  if (n < 3) return null;
  const mx = mean(x);
  const my = mean(y);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i]! - mx) ** 2;
    sxy += (x[i]! - mx) * (y[i]! - my);
    syy += (y[i]! - my) ** 2;
  }
  if (!(sxx > 0)) return null;
  const b1 = sxy / sxx;
  const b0 = my - b1 * mx;
  const fitted = x.map((v) => b0 + b1 * v);
  const residuals = y.map((v, i) => v - fitted[i]!);
  const ssResidual = residuals.reduce((a, e) => a + e * e, 0);
  const ssTotal = syy;
  const ssRegression = Math.max(0, ssTotal - ssResidual);
  const dfResidual = n - 2;
  const msResidual = ssResidual / dfResidual;
  const s = Math.sqrt(msResidual);
  const tCrit = tInv(1 - (1 - confidence) / 2, dfResidual);
  const coef = (b: number, se: number): Coefficient => {
    const t = b / se;
    return { b, se, t, p: se > 0 ? pFromT(t, dfResidual, 'two-sided') : 0, lower: b - tCrit * se, upper: b + tCrit * se };
  };
  const seB1 = s / Math.sqrt(sxx);
  const seB0 = s * Math.sqrt(1 / n + (mx * mx) / sxx);
  const rSquared = ssTotal > 0 ? ssRegression / ssTotal : 0;
  const f = ssRegression / msResidual;
  return {
    n,
    meanX: mx,
    meanY: my,
    sxx,
    sxy,
    intercept: coef(b0, seB0),
    slope: coef(b1, seB1),
    r: syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0,
    rSquared,
    seEstimate: s,
    ssRegression,
    ssResidual,
    ssTotal,
    dfRegression: 1,
    dfResidual,
    dfTotal: n - 1,
    msRegression: ssRegression,
    msResidual,
    f,
    pF: msResidual > 0 ? fSf(f, 1, dfResidual) : 0,
    tCrit,
    minX: Math.min(...x),
    maxX: Math.max(...x),
    fitted,
    residuals,
  };
}
