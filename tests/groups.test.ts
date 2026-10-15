import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { levene, oneWayAnova, tukeyKramer } from '../src/stats/anova';
import { chiSquareGof, chiSquareIndependence } from '../src/stats/chisquare';

const golden = JSON.parse(readFileSync(new URL('./golden/groups.json', import.meta.url), 'utf8'));

function close(actual: number, expected: number, isP = false) {
  const tol = isP && expected < 1e-6 ? 1e-4 : 1e-6;
  const denom = Math.abs(expected) < 1e-12 ? 1 : Math.abs(expected);
  expect(Math.abs(actual - expected) / denom, `${actual} vs ${expected}`).toBeLessThan(tol);
}

describe('one-way ANOVA, Levene and Tukey–Kramer match scipy', () => {
  for (const g of golden.anova) {
    it(g.name, () => {
      const groups = Object.entries(g.groups as Record<string, number[]>).map(([label, values]) => ({ label, values }));
      const a = oneWayAnova(groups, 0.05)!;
      close(a.f, g.f);
      close(a.p, g.p, true);
      close(a.ssBetween + a.ssWithin, a.ssTotal);
      const l = levene(groups)!;
      close(l.w, g.levene);
      close(l.p, g.leveneP, true);
      const tk = tukeyKramer(a, 0.05);
      g.pairs.forEach((pair: { diff: number; p: number; lower: number; upper: number }, i: number) => {
        const mine = tk.pairs[i]!;
        close(mine.diff, pair.diff);
        // Tukey p comes from 1 − CDF of the studentized range: below 1e-6 it is accurate to
        // ~1e-8 absolute only (always displayed as "< .001"). See docs/METHODS.md.
        if (pair.p >= 1e-6) close(mine.p, pair.p, true);
        else expect(Math.abs(mine.p - pair.p)).toBeLessThan(1e-8);
        close(mine.lower, pair.lower);
        close(mine.upper, pair.upper);
      });
    });
  }
});

describe('chi-square independence matches scipy (correction=False)', () => {
  for (const g of golden.independence) {
    it(g.name, () => {
      const r = chiSquareIndependence(g.rows, g.cols, g.observed, 0.05)!;
      close(r.chi2, g.chi2);
      expect(r.df).toBe(g.df);
      close(r.p, g.p, true);
      r.expected.flat().forEach((e, i) => close(e, g.expected.flat()[i]));
    });
  }
  it('flags cells with E < 5 (ex08: Family × Cash)', () => {
    const g = golden.independence[0];
    const r = chiSquareIndependence(g.rows, g.cols, g.observed, 0.05)!;
    expect(r.smallCells.map(([i, j]) => `${g.rows[i]}×${g.cols[j]}`)).toEqual(['Family×Cash']);
  });
});

describe('chi-square goodness of fit matches scipy', () => {
  for (const g of golden.gof) {
    it(`${g.observed.join('/')}`, () => {
      const r = chiSquareGof(g.observed.map(String), g.observed, g.shares, 0.05)!;
      close(r.chi2, g.chi2);
      close(r.p, g.p, true);
    });
  }
  it('rejects shares that do not sum to 100%', () => {
    expect(chiSquareGof(['a', 'b'], [5, 5], [0.5, 0.4], 0.05)).toBeNull();
  });
});
