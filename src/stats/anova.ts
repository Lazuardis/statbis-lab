import { mean, variance } from './descriptive';
import { fInv, fSf, tukeyCdf, tukeyInv } from './distributions';

export interface GroupSummary {
  label: string;
  count: number;
  sum: number;
  mean: number;
  variance: number;
  sd: number;
}

export interface Anova {
  groups: GroupSummary[];
  k: number;
  N: number;
  ssBetween: number;
  ssWithin: number;
  ssTotal: number;
  dfBetween: number;
  dfWithin: number;
  dfTotal: number;
  msBetween: number;
  msWithin: number;
  f: number;
  p: number;
  fCrit: number;
  grandMean: number;
}

/** One-way ANOVA, layout of the Excel ToolPak "ANOVA: Single Factor". */
export function oneWayAnova(groups: { label: string; values: readonly number[] }[], alpha: number): Anova | null {
  const k = groups.length;
  if (k < 2 || groups.some((g) => g.values.length < 1)) return null;
  const all = groups.flatMap((g) => [...g.values]);
  const N = all.length;
  if (N - k < 1) return null;
  const grandMean = mean(all);
  const summaries: GroupSummary[] = groups.map((g) => {
    const v = g.values.length > 1 ? variance(g.values) : NaN;
    return {
      label: g.label,
      count: g.values.length,
      sum: g.values.reduce((a, b) => a + b, 0),
      mean: mean(g.values),
      variance: v,
      sd: Math.sqrt(v),
    };
  });
  let ssBetween = 0;
  let ssWithin = 0;
  groups.forEach((g, i) => {
    const m = summaries[i]!.mean;
    ssBetween += g.values.length * (m - grandMean) ** 2;
    for (const x of g.values) ssWithin += (x - m) ** 2;
  });
  const dfBetween = k - 1;
  const dfWithin = N - k;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const f = msBetween / msWithin;
  return {
    groups: summaries,
    k,
    N,
    ssBetween,
    ssWithin,
    ssTotal: ssBetween + ssWithin,
    dfBetween,
    dfWithin,
    dfTotal: N - 1,
    msBetween,
    msWithin,
    f,
    p: fSf(f, dfBetween, dfWithin),
    fCrit: fInv(1 - alpha, dfBetween, dfWithin),
    grandMean,
  };
}

export interface Levene {
  w: number;
  df1: number;
  df2: number;
  p: number;
}

/** Levene's test, mean-centred: one-way ANOVA on |x − group mean| (scipy levene center='mean'). */
export function levene(groups: { label: string; values: readonly number[] }[]): Levene | null {
  const dev = groups.map((g) => {
    const m = mean(g.values);
    return { label: g.label, values: g.values.map((x) => Math.abs(x - m)) };
  });
  const a = oneWayAnova(dev, 0.05);
  if (!a || !Number.isFinite(a.f)) return null;
  return { w: a.f, df1: a.dfBetween, df2: a.dfWithin, p: a.p };
}

export interface TukeyPair {
  first: string;
  second: string;
  /** mean(first) − mean(second) */
  diff: number;
  se: number;
  q: number;
  p: number;
  lower: number;
  upper: number;
}

export interface Tukey {
  qCrit: number;
  df: number;
  k: number;
  pairs: TukeyPair[];
}

/**
 * Tukey–Kramer HSD for every pair (unequal group sizes allowed):
 * SE = √(MS_within/2 · (1/nᵢ + 1/nⱼ)), q = |diff| / SE, p from the studentized range with
 * k means and N − k df; simultaneous CI diff ± q(1 − α; k, N − k) · SE.
 */
export function tukeyKramer(a: Anova, alpha: number): Tukey {
  const qCrit = tukeyInv(1 - alpha, a.k, a.dfWithin);
  const pairs: TukeyPair[] = [];
  for (let i = 0; i < a.k; i++) {
    for (let j = i + 1; j < a.k; j++) {
      const gi = a.groups[i]!;
      const gj = a.groups[j]!;
      const diff = gi.mean - gj.mean;
      const se = Math.sqrt((a.msWithin / 2) * (1 / gi.count + 1 / gj.count));
      const q = Math.abs(diff) / se;
      pairs.push({
        first: gi.label,
        second: gj.label,
        diff,
        se,
        q,
        p: Math.max(0, Math.min(1, 1 - tukeyCdf(q, a.k, a.dfWithin))),
        lower: diff - qCrit * se,
        upper: diff + qCrit * se,
      });
    }
  }
  return { qCrit, df: a.dfWithin, k: a.k, pairs };
}
