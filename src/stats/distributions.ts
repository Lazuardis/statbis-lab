import { jStat } from 'jstat';

/*
 * Distribution functions. Upper tails are computed directly (not as 1 − CDF) so that very small
 * p-values keep their relative accuracy.
 */

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

/** Student t CDF with df degrees of freedom (accurate in the lower tail). */
export function tCdf(t: number, df: number): number {
  return jStat.studentt.cdf(t, df);
}

/** Student t quantile. */
export function tInv(p: number, df: number): number {
  return jStat.studentt.inv(p, df);
}

/** Upper tail of F(d1, d2): P(F > f) = I_{d2/(d2 + d1·f)}(d2/2, d1/2). */
export function fSf(f: number, d1: number, d2: number): number {
  if (!(f > 0)) return 1;
  return jStat.ibeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
}

export function fInv(p: number, d1: number, d2: number): number {
  return jStat.centralF.inv(p, d1, d2);
}

export function fPdf(f: number, d1: number, d2: number): number {
  return jStat.centralF.pdf(f, d1, d2);
}

/** Upper tail of χ²(k): Q(k/2, x/2), the regularised upper incomplete gamma function. */
export function chi2Sf(x: number, k: number): number {
  if (!(x > 0)) return 1;
  return gammaQ(k / 2, x / 2);
}

export function chi2Inv(p: number, k: number): number {
  return jStat.chisquare.inv(p, k);
}

export function chi2Pdf(x: number, k: number): number {
  return jStat.chisquare.pdf(x, k);
}

/** Studentized range CDF (Tukey), k means, df degrees of freedom. */
export function tukeyCdf(q: number, k: number, df: number): number {
  return jStat.tukey.cdf(q, k, df);
}

export function tukeyInv(p: number, k: number, df: number): number {
  return jStat.tukey.inv(p, k, df);
}

/** Regularised upper incomplete gamma Q(a, x): series below a + 1, continued fraction above. */
function gammaQ(a: number, x: number): number {
  const lnGammaA = jStat.gammaln(a);
  if (x < a + 1) {
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 1000; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-16) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - lnGammaA);
  }
  // Lentz's continued fraction
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGammaA) * h;
}
