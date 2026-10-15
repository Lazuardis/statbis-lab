import { parseNumber } from '../../data/parse';
import type { Dataset, Variable } from '../../data/types';

/** Values of one column ready for analysis, with the case numbers (1-based grid rows) they came from. */
export interface NumericColumn {
  values: number[];
  cases: number[];
  missing: number;
}

export interface CategoryColumn {
  values: string[];
  cases: number[];
  missing: number;
}

export function numericColumn(d: Dataset, j: number, isMissing: (c: string) => boolean): NumericColumn {
  const v = d.variables[j]!;
  const out: NumericColumn = { values: [], cases: [], missing: 0 };
  d.rows.forEach((row, r) => {
    const cell = row[j] ?? '';
    const x = isMissing(cell) ? null : parseNumber(cell, v.decimal);
    if (x === null) out.missing++;
    else {
      out.values.push(x);
      out.cases.push(r + 1);
    }
  });
  return out;
}

export function categoryColumn(d: Dataset, j: number, isMissing: (c: string) => boolean): CategoryColumn {
  const out: CategoryColumn = { values: [], cases: [], missing: 0 };
  d.rows.forEach((row, r) => {
    const cell = row[j] ?? '';
    if (isMissing(cell)) out.missing++;
    else {
      out.values.push(cell);
      out.cases.push(r + 1);
    }
  });
  return out;
}

/** Rows where both a number (column j) and a group label (column g) are present. */
export function groupedNumeric(
  d: Dataset,
  j: number,
  g: number,
  isMissing: (c: string) => boolean,
): { groups: Map<string, NumericColumn>; excluded: number } {
  const v = d.variables[j]!;
  const groups = new Map<string, NumericColumn>();
  let excluded = 0;
  d.rows.forEach((row, r) => {
    const cell = row[j] ?? '';
    const label = row[g] ?? '';
    const x = isMissing(cell) ? null : parseNumber(cell, v.decimal);
    if (x === null || isMissing(label)) {
      excluded++;
      return;
    }
    let col = groups.get(label);
    if (!col) groups.set(label, (col = { values: [], cases: [], missing: 0 }));
    col.values.push(x);
    col.cases.push(r + 1);
  });
  return { groups, excluded };
}

/** "Delivery_min (min)" when the variable has a unit. */
export function labelWithUnit(v: Variable): string {
  return v.unit ? `${v.name} (${v.unit})` : v.name;
}

/** " min" to append after a number in running text, or "". */
export function unitSuffix(v: Variable): string {
  return v.unit ? ` ${v.unit}` : '';
}
