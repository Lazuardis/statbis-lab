import { mean, variance } from './descriptive';
import { normCdf, normInv, tCdf, tInv } from './distributions';

/**
 * One-variable and two-group tests (course formulas). 'greater' means the first quantity is
 * larger: x̄ > μ₀, p̂ > p₀, group 1 > group 2, after > before (d̄ > 0).
 * Confidence intervals are always two-sided at 1 − α.
 */
export type Alternative = 'two-sided' | 'greater' | 'less';

/** Tails are taken from the lower CDF at −|t| so tiny p-values stay accurate. */
export function pFromT(t: number, df: number, alt: Alternative): number {
  if (alt === 'greater') return tCdf(-t, df);
  if (alt === 'less') return tCdf(t, df);
  return Math.min(1, 2 * tCdf(-Math.abs(t), df));
}

export function pFromZ(z: number, alt: Alternative): number {
  if (alt === 'greater') return normCdf(-z);
  if (alt === 'less') return normCdf(z);
  return Math.min(1, 2 * normCdf(-Math.abs(z)));
}

/** Critical value for the chosen alternative (two-sided: 1 − α/2; one-sided: 1 − α). */
export function tCritical(alpha: number, df: number, alt: Alternative): number {
  return tInv(alt === 'two-sided' ? 1 - alpha / 2 : 1 - alpha, df);
}

export function zCritical(alpha: number, alt: Alternative): number {
  return normInv(alt === 'two-sided' ? 1 - alpha / 2 : 1 - alpha);
}

// ---------------------------------------------------------------- one-sample t

export interface OneSampleT {
  n: number;
  mean: number;
  sd: number;
  se: number;
  df: number;
  mu0: number;
  diff: number;
  t: number;
  p: number;
  tCrit: number;
  ciLower: number;
  ciUpper: number;
  ciT: number;
}

/** t = (x̄ − μ₀)/(s/√n), df = n − 1. */
export function oneSampleT(x: readonly number[], mu0: number, alt: Alternative, alpha: number): OneSampleT | null {
  const n = x.length;
  if (n < 2) return null;
  const m = mean(x);
  const sd = Math.sqrt(variance(x));
  const se = sd / Math.sqrt(n);
  const df = n - 1;
  const t = (m - mu0) / se;
  const ciT = tInv(1 - alpha / 2, df);
  return {
    n,
    mean: m,
    sd,
    se,
    df,
    mu0,
    diff: m - mu0,
    t,
    p: pFromT(t, df, alt),
    tCrit: tCritical(alpha, df, alt),
    ciLower: m - ciT * se,
    ciUpper: m + ciT * se,
    ciT,
  };
}

// ---------------------------------------------------------------- Welch two-sample t

export interface WelchT {
  n1: number;
  n2: number;
  mean1: number;
  mean2: number;
  sd1: number;
  sd2: number;
  se1: number;
  se2: number;
  /** s₁²/n₁ and s₂²/n₂ */
  v1: number;
  v2: number;
  diff: number;
  se: number;
  df: number;
  t: number;
  p: number;
  tCrit: number;
  ciT: number;
  ciLower: number;
  ciUpper: number;
}

/** Welch: t = (x̄₁ − x̄₂)/√(s₁²/n₁ + s₂²/n₂), Welch–Satterthwaite df (Excel T.TEST type 3). */
export function welchT(x1: readonly number[], x2: readonly number[], alt: Alternative, alpha: number): WelchT | null {
  const n1 = x1.length;
  const n2 = x2.length;
  if (n1 < 2 || n2 < 2) return null;
  const mean1 = mean(x1);
  const mean2 = mean(x2);
  const var1 = variance(x1);
  const var2 = variance(x2);
  const v1 = var1 / n1;
  const v2 = var2 / n2;
  const se = Math.sqrt(v1 + v2);
  const df = (v1 + v2) ** 2 / (v1 ** 2 / (n1 - 1) + v2 ** 2 / (n2 - 1));
  const diff = mean1 - mean2;
  const t = diff / se;
  const ciT = tInv(1 - alpha / 2, df);
  return {
    n1,
    n2,
    mean1,
    mean2,
    sd1: Math.sqrt(var1),
    sd2: Math.sqrt(var2),
    se1: Math.sqrt(v1),
    se2: Math.sqrt(v2),
    v1,
    v2,
    diff,
    se,
    df,
    t,
    p: pFromT(t, df, alt),
    tCrit: tCritical(alpha, df, alt),
    ciT,
    ciLower: diff - ciT * se,
    ciUpper: diff + ciT * se,
  };
}

// ---------------------------------------------------------------- paired t

export interface PairedT {
  n: number;
  meanD: number;
  sdD: number;
  se: number;
  df: number;
  t: number;
  p: number;
  tCrit: number;
  ciT: number;
  ciLower: number;
  ciUpper: number;
  diffs: number[];
}

/** d = after − before per row; t = d̄/(s_d/√n), df = n − 1 (Excel T.TEST type 1). */
export function pairedT(before: readonly number[], after: readonly number[], alt: Alternative, alpha: number): PairedT | null {
  const diffs = after.map((a, i) => a - before[i]!);
  const n = diffs.length;
  if (n < 2) return null;
  const meanD = mean(diffs);
  const sdD = Math.sqrt(variance(diffs));
  const se = sdD / Math.sqrt(n);
  const df = n - 1;
  const t = meanD / se;
  const ciT = tInv(1 - alpha / 2, df);
  return {
    n,
    meanD,
    sdD,
    se,
    df,
    t,
    p: pFromT(t, df, alt),
    tCrit: tCritical(alpha, df, alt),
    ciT,
    ciLower: meanD - ciT * se,
    ciUpper: meanD + ciT * se,
    diffs,
  };
}

// ---------------------------------------------------------------- one-proportion z

export interface OneProportionZ {
  n: number;
  x: number;
  pHat: number;
  p0: number;
  /** SE under H₀: √(p₀(1 − p₀)/n) */
  se0: number;
  z: number;
  p: number;
  zCrit: number;
  /** Wald CI uses √(p̂(1 − p̂)/n) */
  seHat: number;
  ciZ: number;
  ciLower: number;
  ciUpper: number;
  /** n·p₀ ≥ 5 and n·(1 − p₀) ≥ 5 */
  conditionsMet: boolean;
}

export function oneProportionZ(x: number, n: number, p0: number, alt: Alternative, alpha: number): OneProportionZ | null {
  if (n < 1 || !(p0 > 0 && p0 < 1)) return null;
  const pHat = x / n;
  const se0 = Math.sqrt((p0 * (1 - p0)) / n);
  const z = (pHat - p0) / se0;
  const seHat = Math.sqrt((pHat * (1 - pHat)) / n);
  const ciZ = normInv(1 - alpha / 2);
  return {
    n,
    x,
    pHat,
    p0,
    se0,
    z,
    p: pFromZ(z, alt),
    zCrit: zCritical(alpha, alt),
    seHat,
    ciZ,
    ciLower: pHat - ciZ * seHat,
    ciUpper: pHat + ciZ * seHat,
    conditionsMet: n * p0 >= 5 && n * (1 - p0) >= 5,
  };
}

// ---------------------------------------------------------------- two-proportion z

export interface TwoProportionZ {
  x1: number;
  n1: number;
  x2: number;
  n2: number;
  p1: number;
  p2: number;
  pooled: number;
  /** Pooled SE for the test */
  se: number;
  z: number;
  p: number;
  zCrit: number;
  diff: number;
  /** Unpooled SE for the Wald CI */
  seCI: number;
  ciZ: number;
  ciLower: number;
  ciUpper: number;
  /** n·p ≥ 5 and n·(1 − p) ≥ 5 in each group (using the group's p̂). */
  conditionsMet: boolean;
}

export function twoProportionZ(x1: number, n1: number, x2: number, n2: number, alt: Alternative, alpha: number): TwoProportionZ | null {
  if (n1 < 1 || n2 < 1) return null;
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pooled = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (!(se > 0)) return null;
  const diff = p1 - p2;
  const z = diff / se;
  const seCI = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  const ciZ = normInv(1 - alpha / 2);
  const ok = (x: number, n: number) => x >= 5 && n - x >= 5;
  return {
    x1,
    n1,
    x2,
    n2,
    p1,
    p2,
    pooled,
    se,
    z,
    p: pFromZ(z, alt),
    zCrit: zCritical(alpha, alt),
    diff,
    seCI,
    ciZ,
    ciLower: diff - ciZ * seCI,
    ciUpper: diff + ciZ * seCI,
    conditionsMet: ok(x1, n1) && ok(x2, n2),
  };
}
