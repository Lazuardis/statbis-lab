import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  boxStats,
  coefficientOfVariation,
  crosstab,
  frequencies,
  meanCI,
  proportionCI,
  sturgesBins,
  summarize,
} from '../src/stats/descriptive';
import { shapiroWilk } from '../src/stats/normality';
import { sampleSizeMean, sampleSizeProportion } from '../src/stats/samplesize';

interface Sample {
  name: string;
  x: number[];
  n: number;
  mean: number;
  sd: number;
  variance: number;
  median: number;
  q1: number | null;
  q3: number | null;
  skewness: number;
  modes: number[];
  ci: Record<string, { tCrit: number; lower: number; upper: number }>;
  shapiroW: number;
  shapiroP: number;
}
const golden = JSON.parse(readFileSync(new URL('./golden/descriptive.json', import.meta.url), 'utf8')) as {
  samples: Sample[];
  proportions: { x: number; n: number; conf: number; z: number; lower: number; upper: number; conditionsMet: boolean }[];
};

/** Relative tolerance 1e-6 (absolute near zero), 1e-4 for p-values below 1e-6. */
function close(actual: number | null | undefined, expected: number, tol = 1e-6) {
  expect(actual).not.toBeNull();
  const scale = Math.max(Math.abs(expected), 1e-12);
  expect(Math.abs((actual as number) - expected) / (Math.abs(expected) < 1e-9 ? 1 : scale)).toBeLessThan(tol);
}

describe('summary statistics match numpy/scipy', () => {
  for (const g of golden.samples) {
    it(g.name, () => {
      const s = summarize(g.x);
      expect(s.n).toBe(g.n);
      close(s.mean, g.mean);
      close(s.sd, g.sd);
      close(s.variance, g.variance);
      close(s.median, g.median);
      if (g.q1 === null) expect(s.q1).toBeNull();
      else close(s.q1, g.q1);
      if (g.q3 === null) expect(s.q3).toBeNull();
      else close(s.q3, g.q3);
      close(s.skewness, g.skewness);
      expect(s.modes).toEqual(g.modes);
      for (const [conf, ci] of Object.entries(g.ci)) {
        const r = meanCI(g.x, Number(conf))!;
        close(r.tCrit, ci.tCrit);
        close(r.lower, ci.lower);
        close(r.upper, ci.upper);
      }
      const sw = shapiroWilk(g.x)!;
      close(sw.w, g.shapiroW);
      close(sw.p, g.shapiroP, g.shapiroP < 1e-6 ? 1e-4 : 1e-6);
    });
  }
});

describe('proportion CI (Wald) matches scipy', () => {
  for (const g of golden.proportions) {
    it(`${g.x}/${g.n} at ${g.conf}`, () => {
      const r = proportionCI(g.x, g.n, g.conf);
      close(r.z, g.z);
      close(r.lower, g.lower);
      close(r.upper, g.upper);
      expect(r.conditionsMet).toBe(g.conditionsMet);
    });
  }
});

describe('other descriptive pieces', () => {
  it('QUARTILE.EXC is undefined for n < 3', () => {
    expect(summarize([1, 2]).q1).toBeNull();
    expect(boxStats([1, 2])).toBeNull();
  });
  it('box plot whiskers stop at the last value inside the fences', () => {
    const x = [10, 11, 12, 13, 14, 15, 16, 40];
    const b = boxStats(x)!;
    expect(b.outliers).toEqual([7]);
    expect(b.whiskerHigh).toBe(16);
    expect(b.whiskerLow).toBe(10);
  });
  it('no mode when every value occurs once', () => {
    expect(summarize([1, 2, 3]).modes).toEqual([]);
    expect(summarize([2, 2, 3, 3, 1]).modes).toEqual([2, 3]);
  });
  it('CV only for a positive mean', () => {
    expect(coefficientOfVariation(2, 10)).toBeCloseTo(20);
    expect(coefficientOfVariation(2, -1)).toBeNull();
  });
  it('frequencies in natural order with cumulative percent', () => {
    const f = frequencies(['b', 'a', 'b', '10', '9']);
    expect(f.map((r) => r.category)).toEqual(['9', '10', 'a', 'b']);
    expect(f.at(-1)!.cumulativePercent).toBeCloseTo(100);
    expect(f[3]!.percent).toBeCloseTo(40);
  });
  it('crosstab totals', () => {
    const c = crosstab(['x', 'x', 'y'], ['1', '2', '2']);
    expect(c.counts).toEqual([
      [1, 1],
      [0, 1],
    ]);
    expect(c.rowTotals).toEqual([2, 1]);
    expect(c.colTotals).toEqual([1, 2]);
  });
  it('Sturges bins', () => {
    expect(sturgesBins(117)).toBe(8);
    expect(sturgesBins(1)).toBe(1);
  });
});

describe('sample size', () => {
  it('mean: (z·σ/E)² rounded up, textbook z', () => {
    const r = sampleSizeMean(0.95, 15, 5, 2)!;
    expect(r.z).toBe(1.96);
    expect(r.exact).toBeCloseTo(34.5744, 4);
    expect(r.perGroup).toBe(35);
    expect(r.total).toBe(70);
  });
  it('proportion: z²p(1−p)/E², p = 0.5, E = 5 points → 385', () => {
    expect(sampleSizeProportion(0.95, 0.5, 0.05)!.perGroup).toBe(385);
    expect(sampleSizeProportion(0.9, 0.5, 0.1)!.perGroup).toBe(68);
  });
  it('an exact whole number is not pushed up by rounding noise', () => {
    // (1.96 · 10 / 1.96)² = 100 exactly
    expect(sampleSizeMean(0.95, 10, 1.96)!.perGroup).toBe(100);
  });
  it('rejects impossible inputs', () => {
    expect(sampleSizeMean(0.95, 0, 5)).toBeNull();
    expect(sampleSizeProportion(0.95, 1, 0.05)).toBeNull();
  });
});
