import { chi2Inv, chi2Sf } from './distributions';

export interface ChiSquareIndependence {
  rows: string[];
  cols: string[];
  observed: number[][];
  expected: number[][];
  rowTotals: number[];
  colTotals: number[];
  total: number;
  /** (O − E)²/E per cell */
  contributions: number[][];
  chi2: number;
  df: number;
  p: number;
  critical: number;
  /** Cells with E < 5, as [row, col] indexes. */
  smallCells: [number, number][];
}

/** X² = Σ(O − E)²/E with E = row total × column total / N, no Yates correction (Excel CHISQ.TEST). */
export function chiSquareIndependence(
  rows: string[],
  cols: string[],
  observed: number[][],
  alpha: number,
): ChiSquareIndependence | null {
  const rowTotals = observed.map((r) => r.reduce((a, b) => a + b, 0));
  const colTotals = cols.map((_, j) => observed.reduce((a, r) => a + r[j]!, 0));
  const total = rowTotals.reduce((a, b) => a + b, 0);
  if (rows.length < 2 || cols.length < 2 || total === 0) return null;
  if (rowTotals.some((t) => t === 0) || colTotals.some((t) => t === 0)) return null;
  const expected = rowTotals.map((rt) => colTotals.map((ct) => (rt * ct) / total));
  const contributions = observed.map((r, i) => r.map((o, j) => (o - expected[i]![j]!) ** 2 / expected[i]![j]!));
  const chi2 = contributions.flat().reduce((a, b) => a + b, 0);
  const df = (rows.length - 1) * (cols.length - 1);
  const smallCells: [number, number][] = [];
  expected.forEach((r, i) => r.forEach((e, j) => e < 5 && smallCells.push([i, j])));
  return {
    rows,
    cols,
    observed,
    expected,
    rowTotals,
    colTotals,
    total,
    contributions,
    chi2,
    df,
    p: chi2Sf(chi2, df),
    critical: chi2Inv(1 - alpha, df),
    smallCells,
  };
}

export interface ChiSquareGof {
  categories: string[];
  observed: number[];
  expected: number[];
  contributions: number[];
  total: number;
  chi2: number;
  df: number;
  p: number;
  critical: number;
  smallCells: number[];
}

/** Goodness of fit against expected shares (summing to 1): X² = Σ(O − E)²/E, df = k − 1. */
export function chiSquareGof(categories: string[], observed: number[], shares: number[], alpha: number): ChiSquareGof | null {
  const k = categories.length;
  const total = observed.reduce((a, b) => a + b, 0);
  const shareSum = shares.reduce((a, b) => a + b, 0);
  if (k < 2 || total === 0 || shares.some((s) => !(s > 0)) || Math.abs(shareSum - 1) > 1e-6) return null;
  const expected = shares.map((s) => s * total);
  const contributions = observed.map((o, i) => (o - expected[i]!) ** 2 / expected[i]!);
  const chi2 = contributions.reduce((a, b) => a + b, 0);
  const df = k - 1;
  return {
    categories,
    observed,
    expected,
    contributions,
    total,
    chi2,
    df,
    p: chi2Sf(chi2, df),
    critical: chi2Inv(1 - alpha, df),
    smallCells: expected.map((e, i) => (e < 5 ? i : -1)).filter((i) => i >= 0),
  };
}
