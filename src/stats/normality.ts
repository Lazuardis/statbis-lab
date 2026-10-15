import { normCdf, normInv } from './distributions';

/**
 * Shapiro–Wilk W test, Royston (1995) algorithm AS R94 (the one scipy uses), for 3 ≤ n ≤ 5000.
 * Returns null outside that range or when all values are equal.
 */
export interface ShapiroWilk {
  n: number;
  w: number;
  p: number;
}

/** Evaluate cc[0] + cc[1]·x + … + cc[k−1]·x^(k−1). */
function poly(cc: readonly number[], x: number): number {
  let r = 0;
  for (let i = cc.length - 1; i >= 0; i--) r = r * x + cc[i]!;
  return r;
}

const C1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056];
const C2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];
const C3 = [0.544, -0.39978, 0.025054, -6.714e-4];
const C4 = [1.3822, -0.77857, 0.062767, -0.0020322];
const C5 = [-1.5861, -0.31082, -0.083751, 0.0038915];
const C6 = [-0.4803, -0.082676, 0.0030302];
const G = [-2.273, 0.459];

/** Royston's coefficients a₁ … a_{n/2} (for the lower half of the sorted sample). */
function coefficients(n: number): number[] {
  const nn2 = Math.floor(n / 2);
  if (n === 3) return [Math.SQRT1_2];
  const m: number[] = [];
  let summ2 = 0;
  for (let i = 1; i <= nn2; i++) {
    const v = normInv((i - 0.375) / (n + 0.25));
    m.push(v);
    summ2 += v * v;
  }
  summ2 *= 2;
  const ssumm2 = Math.sqrt(summ2);
  const rsn = 1 / Math.sqrt(n);
  const a = new Array<number>(nn2);
  const a1 = poly(C1, rsn) - m[0]! / ssumm2;
  let first: number;
  let fac: number;
  if (n > 5) {
    first = 2;
    const a2 = -m[1]! / ssumm2 + poly(C2, rsn);
    fac = Math.sqrt((summ2 - 2 * m[0]! ** 2 - 2 * m[1]! ** 2) / (1 - 2 * a1 ** 2 - 2 * a2 ** 2));
    a[1] = a2;
  } else {
    first = 1;
    fac = Math.sqrt((summ2 - 2 * m[0]! ** 2) / (1 - 2 * a1 ** 2));
  }
  a[0] = a1;
  for (let i = first; i < nn2; i++) a[i] = -m[i]! / fac;
  return a;
}

export function shapiroWilk(values: readonly number[]): ShapiroWilk | null {
  const n = values.length;
  if (n < 3 || n > 5000) return null;
  const x = [...values].sort((p, q) => p - q);
  if (x[n - 1]! - x[0]! < 1e-19 * Math.max(1, Math.abs(x[0]!))) return null;

  const a = coefficients(n);
  let num = 0;
  for (let i = 0; i < a.length; i++) num += a[i]! * (x[n - 1 - i]! - x[i]!);
  let m = 0;
  for (const v of x) m += v;
  m /= n;
  let ss = 0;
  for (const v of x) ss += (v - m) * (v - m);
  const w = Math.min(1, (num * num) / ss);

  if (n === 3) {
    const p = (6 / Math.PI) * (Math.asin(Math.sqrt(w)) - Math.PI / 3);
    return { n, w, p: Math.max(0, Math.min(1, p)) };
  }
  let w1 = Math.log(1 - w);
  let mu: number;
  let sigma: number;
  if (n <= 11) {
    const gamma = poly(G, n);
    if (w1 >= gamma) return { n, w, p: 0 };
    w1 = -Math.log(gamma - w1);
    mu = poly(C3, n);
    sigma = Math.exp(poly(C4, n));
  } else {
    const ln = Math.log(n);
    mu = poly(C5, ln);
    sigma = Math.exp(poly(C6, ln));
  }
  return { n, w, p: 1 - normCdf((w1 - mu) / sigma) };
}

/** Normal-score plotting positions for the Q-Q plot: z = Φ⁻¹((i − 0.375)/(n + 0.25)). */
export function normalScores(n: number): number[] {
  return Array.from({ length: n }, (_, k) => normInv((k + 1 - 0.375) / (n + 0.25)));
}
