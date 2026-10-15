import { jStat } from 'jstat';

/** Standard normal CDF Φ(z). */
export function normCdf(z: number): number {
  return jStat.normal.cdf(z, 0, 1);
}

/** Standard normal density φ(z). */
export function normPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/** Standard normal quantile Φ⁻¹(p). */
export function normInv(p: number): number {
  return jStat.normal.inv(p, 0, 1);
}

/** Student t CDF with df degrees of freedom. */
export function tCdf(t: number, df: number): number {
  return jStat.studentt.cdf(t, df);
}

/** Student t quantile. */
export function tInv(p: number, df: number): number {
  return jStat.studentt.inv(p, df);
}
