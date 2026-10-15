import { tInv, normInv } from './distributions';

/** Pure descriptive statistics. Inputs are the non-missing values; nothing here formats. */

export interface Summary {
  n: number;
  sum: number;
  mean: number;
  /** Sample variance and SD with n − 1; NaN when n < 2. */
  variance: number;
  sd: number;
  min: number;
  max: number;
  range: number;
  median: number;
  /** Excel QUARTILE.EXC; null when the position falls outside 1..n. */
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  /** Excel SKEW; null when n < 3 or SD is 0. */
  skewness: number | null;
  /** Every value tied for the highest frequency; empty when every value occurs once. */
  modes: number[];
}

export function sortedCopy(x: readonly number[]): number[] {
  return [...x].sort((a, b) => a - b);
}

export function mean(x: readonly number[]): number {
  let s = 0;
  for (const v of x) s += v;
  return s / x.length;
}

/** Sample variance (n − 1), two-pass for accuracy. */
export function variance(x: readonly number[]): number {
  const n = x.length;
  if (n < 2) return NaN;
  const m = mean(x);
  let ss = 0;
  for (const v of x) ss += (v - m) * (v - m);
  return ss / (n - 1);
}

export function median(sorted: readonly number[]): number {
  const n = sorted.length;
  const h = Math.floor(n / 2);
  return n % 2 ? sorted[h]! : (sorted[h - 1]! + sorted[h]!) / 2;
}

/** Excel QUARTILE.EXC / PERCENTILE.EXC: position p(n + 1), linear interpolation. */
export function quantileExc(sorted: readonly number[], p: number): number | null {
  const n = sorted.length;
  const pos = p * (n + 1);
  if (pos < 1 || pos > n) return null;
  const k = Math.floor(pos);
  const frac = pos - k;
  if (k >= n) return sorted[n - 1]!;
  return sorted[k - 1]! + frac * (sorted[k]! - sorted[k - 1]!);
}

/** Excel SKEW: n / ((n − 1)(n − 2)) · Σ((x − x̄)/s)³. */
export function skewness(x: readonly number[]): number | null {
  const n = x.length;
  if (n < 3) return null;
  const m = mean(x);
  const s = Math.sqrt(variance(x));
  if (!(s > 0)) return null;
  let acc = 0;
  for (const v of x) acc += ((v - m) / s) ** 3;
  return (n / ((n - 1) * (n - 2))) * acc;
}

export function modes(x: readonly number[]): number[] {
  const counts = new Map<number, number>();
  for (const v of x) counts.set(v, (counts.get(v) ?? 0) + 1);
  let top = 0;
  for (const c of counts.values()) top = Math.max(top, c);
  if (top <= 1) return [];
  return [...counts.entries()].filter(([, c]) => c === top).map(([v]) => v).sort((a, b) => a - b);
}

export function summarize(x: readonly number[]): Summary {
  const s = sortedCopy(x);
  const n = s.length;
  const m = mean(s);
  const v = variance(s);
  const q1 = quantileExc(s, 0.25);
  const q3 = quantileExc(s, 0.75);
  return {
    n,
    sum: s.reduce((a, b) => a + b, 0),
    mean: m,
    variance: v,
    sd: Math.sqrt(v),
    min: s[0]!,
    max: s[n - 1]!,
    range: s[n - 1]! - s[0]!,
    median: median(s),
    q1,
    q3,
    iqr: q1 !== null && q3 !== null ? q3 - q1 : null,
    skewness: skewness(s),
    modes: modes(s),
  };
}

/** CV = s / x̄ × 100%; only meaningful on a ratio scale with x̄ > 0. */
export function coefficientOfVariation(sd: number, m: number): number | null {
  return m > 0 && Number.isFinite(sd) ? (sd / m) * 100 : null;
}

export interface MeanCI {
  n: number;
  mean: number;
  sd: number;
  se: number;
  df: number;
  tCrit: number;
  margin: number;
  lower: number;
  upper: number;
}

/** x̄ ± t(α/2, n − 1) · s/√n — equals Excel CONFIDENCE.T. */
export function meanCI(x: readonly number[], confidence: number): MeanCI | null {
  const n = x.length;
  if (n < 2) return null;
  const m = mean(x);
  const sd = Math.sqrt(variance(x));
  const se = sd / Math.sqrt(n);
  const df = n - 1;
  const tCrit = tInv(1 - (1 - confidence) / 2, df);
  const margin = tCrit * se;
  return { n, mean: m, sd, se, df, tCrit, margin, lower: m - margin, upper: m + margin };
}

export interface Fences {
  lower: number;
  upper: number;
}

/** Tukey fences Q1 − 1.5·IQR and Q3 + 1.5·IQR from EXC quartiles. */
export function fences(q1: number, q3: number): Fences {
  const iqr = q3 - q1;
  return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

export interface BoxStats {
  q1: number;
  median: number;
  q3: number;
  /** Whiskers reach the most extreme values inside the fences. */
  whiskerLow: number;
  whiskerHigh: number;
  fences: Fences;
  /** Indexes (into the input) of values outside the fences. */
  outliers: number[];
}

/** Box-plot numbers from our EXC quartiles; null when quartiles are undefined (n < 3). */
export function boxStats(x: readonly number[]): BoxStats | null {
  const s = sortedCopy(x);
  const q1 = quantileExc(s, 0.25);
  const q3 = quantileExc(s, 0.75);
  if (q1 === null || q3 === null) return null;
  const f = fences(q1, q3);
  const inside = s.filter((v) => v >= f.lower && v <= f.upper);
  const outliers: number[] = [];
  x.forEach((v, i) => {
    if (v < f.lower || v > f.upper) outliers.push(i);
  });
  return {
    q1,
    median: median(s),
    q3,
    whiskerLow: inside[0] ?? q1,
    whiskerHigh: inside[inside.length - 1] ?? q3,
    fences: f,
    outliers,
  };
}

export interface Frequency {
  category: string;
  count: number;
  percent: number;
  cumulativePercent: number;
}

/** Categories in natural order (numbers by value, text alphabetically). */
export function compareCategories(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function frequencies(values: readonly string[]): Frequency[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const n = values.length;
  let cum = 0;
  return [...counts.keys()].sort(compareCategories).map((category) => {
    const count = counts.get(category)!;
    cum += count;
    return { category, count, percent: (count / n) * 100, cumulativePercent: (cum / n) * 100 };
  });
}

export interface ProportionCI {
  n: number;
  x: number;
  pHat: number;
  z: number;
  se: number;
  margin: number;
  lower: number;
  upper: number;
  /** n·p̂ ≥ 5 and n·(1 − p̂) ≥ 5. */
  conditionsMet: boolean;
}

/** Wald interval p̂ ± z(α/2)·√(p̂(1 − p̂)/n). */
export function proportionCI(x: number, n: number, confidence: number): ProportionCI {
  const pHat = x / n;
  const z = normInv(1 - (1 - confidence) / 2);
  const se = Math.sqrt((pHat * (1 - pHat)) / n);
  const margin = z * se;
  return {
    n,
    x,
    pHat,
    z,
    se,
    margin,
    lower: pHat - margin,
    upper: pHat + margin,
    conditionsMet: n * pHat >= 5 && n * (1 - pHat) >= 5,
  };
}

export interface Crosstab {
  rows: string[];
  cols: string[];
  counts: number[][];
  rowTotals: number[];
  colTotals: number[];
  total: number;
}

export function crosstab(a: readonly string[], b: readonly string[]): Crosstab {
  const rows = [...new Set(a)].sort(compareCategories);
  const cols = [...new Set(b)].sort(compareCategories);
  const ri = new Map(rows.map((r, i) => [r, i]));
  const ci = new Map(cols.map((c, j) => [c, j]));
  const counts = rows.map(() => cols.map(() => 0));
  a.forEach((r, k) => counts[ri.get(r)!]![ci.get(b[k]!)!]!++);
  const rowTotals = counts.map((r) => r.reduce((s, v) => s + v, 0));
  const colTotals = cols.map((_, j) => counts.reduce((s, r) => s + r[j]!, 0));
  return { rows, cols, counts, rowTotals, colTotals, total: a.length };
}

/** Sturges' rule: ⌈log₂ n⌉ + 1 bins. */
export function sturgesBins(n: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(n, 1))) + 1);
}
