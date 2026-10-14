import { detectColumn, variableWarnings, type VariableWarnings } from './detect';
import { fingerprint } from './fingerprint';
import { makeIsMissing } from './missing';
import { parseNumber, splitDelimited } from './parse';
import type { Dataset, DecimalSetting, Variable } from './types';

export type BuildResult =
  | { ok: true; dataset: Dataset; headerLooksNumeric: boolean }
  | { ok: false; error: 'empty' | 'noRows' };

/** Turn pasted (tab-separated) or example (comma-separated) text into a dataset. */
export async function buildDataset(
  text: string,
  opts: { name: string; delimiter?: string; invalidCodes: readonly string[]; decimal: DecimalSetting },
): Promise<BuildResult> {
  const grid = splitDelimited(text, opts.delimiter ?? '\t');
  if (grid.length === 0 || grid[0]!.length === 0) return { ok: false, error: 'empty' };
  if (grid.length < 2) return { ok: false, error: 'noRows' };

  const rawHeader = grid[0]!;
  const rows = grid.slice(1);
  const header = uniqueNames(rawHeader);
  const isMissing = makeIsMissing(opts.invalidCodes);

  const variables: Variable[] = header.map((name, j) => {
    const reading = detectColumn(column(rows, j), isMissing, opts.decimal);
    return { id: `v${j}`, name, levelSetByUser: false, unit: '', ratio: false, ...reading };
  });

  const headerLooksNumeric = rawHeader.every((c) => c !== '' && parseNumber(c, 'point') !== null);

  return {
    ok: true,
    headerLooksNumeric,
    dataset: {
      name: opts.name,
      header,
      rows,
      variables,
      fingerprint: await fingerprint(rawHeader, rows),
    },
  };
}

/** Re-read levels after the decimal setting or the invalid-values list changes. */
export function redetect(
  dataset: Dataset,
  invalidCodes: readonly string[],
  decimal: DecimalSetting,
): Dataset {
  const isMissing = makeIsMissing(invalidCodes);
  const variables = dataset.variables.map((v, j) => {
    const reading = detectColumn(column(dataset.rows, j), isMissing, decimal);
    return v.levelSetByUser ? { ...v, decimal: reading.decimal } : { ...v, ...reading };
  });
  return { ...dataset, variables };
}

export function column(rows: readonly (readonly string[])[], j: number): string[] {
  return rows.map((r) => r[j] ?? '');
}

export function warningsFor(dataset: Dataset, invalidCodes: readonly string[]): VariableWarnings[] {
  const isMissing = makeIsMissing(invalidCodes);
  return dataset.variables.map((v, j) => variableWarnings(v, column(dataset.rows, j), isMissing));
}

/** Blank names become Var1, Var2, …; repeated names get _2, _3, … */
export function uniqueNames(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  return raw.map((r, j) => {
    const base = r === '' ? `Var${j + 1}` : r;
    let name = base;
    let k = 2;
    while (seen.has(name.toLowerCase())) name = `${base}_${k++}`;
    seen.add(name.toLowerCase());
    return name;
  });
}
