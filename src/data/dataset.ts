import { detectColumn, variableWarnings, type VariableWarnings } from './detect';
import { emptyDataset, setCells, type EditContext } from './edit';
import { makeIsMissing } from './missing';
import { parseNumber, splitDelimited } from './parse';
import type { Dataset, DecimalSetting } from './types';

export type BuildResult =
  | { ok: true; dataset: Dataset; headerLooksNumeric: boolean }
  | { ok: false; error: 'empty' | 'noRows' };

/** Turn pasted (tab-separated) or example (comma-separated) text into a dataset; first row = names. */
export function buildDataset(
  text: string,
  opts: { name: string; delimiter?: string } & EditContext,
): BuildResult {
  const grid = splitDelimited(text, opts.delimiter ?? '\t');
  if (grid.length === 0 || grid[0]!.length === 0) return { ok: false, error: 'empty' };
  if (grid.length < 2) return { ok: false, error: 'noRows' };

  const header = grid[0]!;
  return {
    ok: true,
    headerLooksNumeric: header.every((c) => c !== '' && parseNumber(c, 'point') !== null),
    dataset: setCells(emptyDataset(opts.name), -1, 0, grid, opts),
  };
}

/** Re-read levels after the decimal setting or the invalid-values list changes. */
export function redetect(dataset: Dataset, invalidCodes: readonly string[], decimal: DecimalSetting): Dataset {
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
