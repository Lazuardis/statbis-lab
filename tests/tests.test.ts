import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { oneProportionZ, oneSampleT, pairedT, twoProportionZ, welchT, type Alternative } from '../src/stats/tests';

const golden = JSON.parse(readFileSync(new URL('./golden/tests.json', import.meta.url), 'utf8'));
const pilot = readFileSync(new URL('../C3_basket_by_channel.csv', import.meta.url), 'utf8')
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((l) => l.split(','));

/** 1e-6 relative; 1e-4 for p-values below 1e-6 (CLAUDE.md working rules). */
function close(actual: number, expected: number, isP = false) {
  const tol = isP && expected < 1e-6 ? 1e-4 : 1e-6;
  const denom = Math.abs(expected) < 1e-12 ? 1 : Math.abs(expected);
  expect(Math.abs(actual - expected) / denom, `${actual} vs ${expected}`).toBeLessThan(tol);
}

describe('smoke test: pilot file, GoFood − Walk-in (CLAUDE.md)', () => {
  const gofood = pilot.filter((r) => r[1] === 'GoFood').map((r) => Number(r[2]));
  const walkin = pilot.filter((r) => r[1] === 'Walk-in').map((r) => Number(r[2]));
  const r = welchT(gofood, walkin, 'two-sided', 0.05)!;
  it('reproduces every published value', () => {
    expect(r.n1).toBe(40);
    expect(r.n2).toBe(40);
    expect(r.mean1.toFixed(4)).toBe('68.7925');
    expect(r.sd1.toFixed(4)).toBe('11.5931');
    expect(r.mean2.toFixed(4)).toBe('61.0200');
    expect(r.sd2.toFixed(4)).toBe('12.9006');
    expect(r.diff.toFixed(4)).toBe('7.7725');
    expect(r.t.toFixed(6)).toBe('2.834217');
    expect(r.df.toFixed(4)).toBe('77.1258');
    expect(r.p.toFixed(6)).toBe('0.005861');
    expect(r.ciLower.toFixed(4)).toBe('2.3119');
    expect(r.ciUpper.toFixed(4)).toBe('13.2331');
  });
});

describe('one-sample t matches scipy', () => {
  for (const g of golden.oneSample) {
    it(`n=${g.x.length} μ0=${g.mu0} ${g.alt} α=${g.alpha}`, () => {
      const r = oneSampleT(g.x, g.mu0, g.alt as Alternative, g.alpha)!;
      close(r.t, g.t);
      close(r.df, g.df);
      close(r.p, g.p, true);
      close(r.ciLower, g.ciLower);
      close(r.ciUpper, g.ciUpper);
    });
  }
});

describe('Welch t matches scipy', () => {
  for (const [i, g] of golden.welch.entries()) {
    it(`case ${i} ${g.alt}`, () => {
      const r = welchT(g.x1, g.x2, g.alt as Alternative, 0.05)!;
      close(r.t, g.t);
      close(r.df, g.df);
      close(r.p, g.p, true);
      close(r.ciLower, g.ciLower);
      close(r.ciUpper, g.ciUpper);
    });
  }
});

describe('paired t matches scipy (d = after − before)', () => {
  for (const [i, g] of golden.paired.entries()) {
    it(`case ${i} ${g.alt}`, () => {
      const r = pairedT(g.before, g.after, g.alt as Alternative, 0.05)!;
      close(r.t, g.t);
      close(r.df, g.df);
      close(r.p, g.p, true);
      close(r.ciLower, g.ciLower);
      close(r.ciUpper, g.ciUpper);
    });
  }
});

describe('one-proportion z matches statsmodels (SE uses p0)', () => {
  for (const g of golden.oneProp) {
    it(`${g.x}/${g.n} vs ${g.p0} ${g.alt}`, () => {
      const r = oneProportionZ(g.x, g.n, g.p0, g.alt as Alternative, 0.05)!;
      close(r.z, g.z);
      close(r.p, g.p, true);
      close(r.ciLower, g.ciLower);
      close(r.ciUpper, g.ciUpper);
    });
  }
});

describe('two-proportion z matches statsmodels (pooled test, unpooled CI)', () => {
  for (const g of golden.twoProp) {
    it(`${g.x1}/${g.n1} vs ${g.x2}/${g.n2} ${g.alt}`, () => {
      const r = twoProportionZ(g.x1, g.n1, g.x2, g.n2, g.alt as Alternative, 0.05)!;
      close(r.z, g.z);
      close(r.p, g.p, true);
      close(r.ciLower, g.ciLower);
      close(r.ciUpper, g.ciUpper);
    });
  }
  it('conditions n·p ≥ 5 and n·(1 − p) ≥ 5 per group', () => {
    expect(twoProportionZ(3, 40, 10, 40, 'two-sided', 0.05)!.conditionsMet).toBe(false);
    expect(twoProportionZ(31, 300, 49, 300, 'two-sided', 0.05)!.conditionsMet).toBe(true);
  });
});
