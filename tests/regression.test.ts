import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pearson, simpleRegression } from '../src/stats/regression';

const golden = JSON.parse(readFileSync(new URL('./golden/regression.json', import.meta.url), 'utf8'));

function close(actual: number, expected: number, isP = false) {
  const tol = isP && expected < 1e-6 ? 1e-4 : 1e-6;
  const denom = Math.abs(expected) < 1e-12 ? 1 : Math.abs(expected);
  expect(Math.abs(actual - expected) / denom, `${actual} vs ${expected}`).toBeLessThan(tol);
}

describe('Pearson r and simple regression match scipy/statsmodels', () => {
  for (const g of golden) {
    it(g.name, () => {
      const p = pearson(g.x, g.y)!;
      close(p.r, g.r);
      close(p.p, g.rP, true);
      const r = simpleRegression(g.x, g.y, 0.95)!;
      close(r.intercept.b, g.intercept);
      close(r.slope.b, g.slope);
      close(r.intercept.se, g.seIntercept);
      close(r.slope.se, g.seSlope);
      close(r.intercept.t, g.tIntercept);
      close(r.slope.t, g.tSlope);
      close(r.intercept.p, g.pIntercept, true);
      close(r.slope.p, g.pSlope, true);
      close(r.intercept.lower, g.ciIntercept[0]);
      close(r.intercept.upper, g.ciIntercept[1]);
      close(r.slope.lower, g.ciSlope[0]);
      close(r.slope.upper, g.ciSlope[1]);
      close(r.rSquared, g.rSquared);
      close(r.seEstimate, g.seEstimate);
      close(r.f, g.f);
      close(r.pF, g.pF, true);
      close(r.ssResidual, g.ssResidual);
      close(r.ssRegression, g.ssRegression);
      close(r.r * r.r, g.rSquared);
    });
  }
  it('slope p equals Significance F in simple regression', () => {
    const g = golden[0];
    const r = simpleRegression(g.x, g.y, 0.95)!;
    close(r.slope.p, r.pF, true);
  });
});
