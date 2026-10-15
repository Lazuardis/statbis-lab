/**
 * Sample size at the proposal stage. z values are the rounded textbook ones (1.645, 1.96, 2.576)
 * so a student's hand calculation gives the same n.
 */

export const Z_TABLE: Record<number, number> = { 0.9: 1.645, 0.95: 1.96, 0.99: 2.576 };

/** Round up, ignoring floating-point noise (384.0000000001 counts as 384). */
function ceilClean(x: number): number {
  return Math.ceil(Math.round(x * 1e9) / 1e9);
}

export interface SampleSize {
  z: number;
  /** Unrounded n per group. */
  exact: number;
  perGroup: number;
  groups: number;
  total: number;
}

/** Mean: n = (z·σ / E)², rounded up, per group. */
export function sampleSizeMean(confidence: number, sigma: number, margin: number, groups = 1): SampleSize | null {
  const z = Z_TABLE[confidence];
  if (!z || !(sigma > 0) || !(margin > 0) || !(groups >= 1)) return null;
  const exact = ((z * sigma) / margin) ** 2;
  const perGroup = ceilClean(exact);
  return { z, exact, perGroup, groups, total: perGroup * groups };
}

/** Proportion: n = z²·p(1 − p) / E², rounded up, per group (p and E as fractions). */
export function sampleSizeProportion(confidence: number, p: number, margin: number, groups = 1): SampleSize | null {
  const z = Z_TABLE[confidence];
  if (!z || !(p > 0 && p < 1) || !(margin > 0 && margin < 1) || !(groups >= 1)) return null;
  const exact = (z * z * p * (1 - p)) / (margin * margin);
  const perGroup = ceilClean(exact);
  return { z, exact, perGroup, groups, total: perGroup * groups };
}
