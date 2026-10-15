import { detectColumn } from './detect';
import { makeIsMissing } from './missing';
import type { Dataset, DecimalSetting, Variable } from './types';

/**
 * Spreadsheet operations on a dataset. All are pure: they return a new dataset and leave the old
 * one untouched (the app keeps old versions for undo).
 *
 * Row index -1 is the names row (the first grid row); 0, 1, … are data rows.
 */

export interface EditContext {
  invalidCodes: readonly string[];
  decimal: DecimalSetting;
}

export function emptyDataset(name: string): Dataset {
  return { name, rows: [], variables: [], nextVarId: 0 };
}

export function autoVariableName(index: number): string {
  return `Var${index + 1}`;
}

function newVariable(id: number, index: number): Variable {
  return {
    id: `v${id}`,
    name: autoVariableName(index),
    autoName: true,
    level: 'nominal',
    levelSetByUser: false,
    unit: '',
    ratio: false,
    decimal: 'point',
  };
}

/** Write a block of cells with its top-left corner at (r0, c0), growing the table as needed. */
export function setCells(d: Dataset, r0: number, c0: number, block: readonly (readonly string[])[], ctx: EditContext): Dataset {
  if (block.length === 0) return d;
  const width = Math.max(...block.map((r) => r.length));
  if (width === 0) return d;

  let nextVarId = d.nextVarId;
  const variables = d.variables.slice();
  while (variables.length < c0 + width) variables.push(newVariable(nextVarId++, variables.length));
  const nCols = variables.length;

  const rows = d.rows.slice();
  const lastRow = r0 + block.length - 1;
  while (rows.length <= lastRow) rows.push([]);
  const copied = new Set<number>();
  const touched = new Set<number>();

  block.forEach((line, i) => {
    const r = r0 + i;
    for (let k = 0; k < width; k++) {
      const c = c0 + k;
      const value = (line[k] ?? '').trim();
      touched.add(c);
      if (r === -1) {
        variables[c] = value === '' ? { ...variables[c]!, autoName: true } : { ...variables[c]!, name: value, autoName: false };
      } else if (r >= 0) {
        if (!copied.has(r)) {
          rows[r] = padRow(rows[r]!, nCols);
          copied.add(r);
        }
        rows[r]![c] = value;
      }
    }
  });

  return normalize({ ...d, rows: rows.map((row) => padRow(row, nCols, false)), variables, nextVarId }, ctx, touched);
}

/** Clear a rectangle (inclusive), names row included when r0 is -1. */
export function clearRange(d: Dataset, r0: number, c0: number, r1: number, c1: number, ctx: EditContext): Dataset {
  const lastRow = Math.min(r1, d.rows.length - 1);
  const lastCol = Math.min(c1, d.variables.length - 1);
  if (lastCol < c0 || lastRow < r0) return d;
  const block = Array.from({ length: lastRow - r0 + 1 }, () => Array<string>(lastCol - c0 + 1).fill(''));
  return setCells(d, r0, c0, block, ctx);
}

export function insertRows(d: Dataset, at: number, count: number, ctx: EditContext): Dataset {
  if (at >= d.rows.length) return d; // below the table there is nothing to push down
  const rows = d.rows.slice();
  rows.splice(at, 0, ...Array.from({ length: count }, () => Array<string>(d.variables.length).fill('')));
  return normalize({ ...d, rows }, ctx, new Set());
}

export function deleteRows(d: Dataset, from: number, count: number, ctx: EditContext): Dataset {
  if (from >= d.rows.length) return d;
  const rows = d.rows.slice();
  rows.splice(from, count);
  return normalize({ ...d, rows }, ctx, allColumns(d));
}

export function insertColumns(d: Dataset, at: number, count: number, ctx: EditContext): Dataset {
  if (at >= d.variables.length) return d;
  let nextVarId = d.nextVarId;
  const added = Array.from({ length: count }, (_, k) => newVariable(nextVarId++, at + k));
  const variables = d.variables.slice();
  variables.splice(at, 0, ...added);
  const rows = d.rows.map((r) => {
    const out = r.slice();
    out.splice(at, 0, ...Array<string>(count).fill(''));
    return out;
  });
  return normalize({ ...d, rows, variables, nextVarId }, ctx, new Set());
}

export function deleteColumns(d: Dataset, from: number, count: number, ctx: EditContext): Dataset {
  if (from >= d.variables.length) return d;
  const variables = d.variables.slice();
  variables.splice(from, count);
  const rows = d.rows.map((r) => {
    const out = r.slice();
    out.splice(from, count);
    return out;
  });
  return normalize({ ...d, rows, variables }, ctx, new Set());
}

/** Replace one variable's properties (from the variable dialog). */
export function updateVariable(d: Dataset, index: number, v: Variable, ctx: EditContext): Dataset {
  const variables = d.variables.map((old, k) => (k === index ? v : old));
  return normalize({ ...d, variables }, ctx, new Set());
}

function allColumns(d: Dataset): Set<number> {
  return new Set(d.variables.map((_, j) => j));
}

function padRow(row: readonly string[], n: number, copy = true): string[] {
  if (row.length === n) return copy ? row.slice() : (row as string[]);
  const out = row.slice(0, n);
  while (out.length < n) out.push('');
  return out;
}

/**
 * Tidy up after any change: drop trailing blank rows and trailing unnamed blank columns, number
 * unnamed columns by position, make names unique, and re-detect the level of changed columns
 * (unless the user chose the level).
 */
export function normalize(d: Dataset, ctx: EditContext, touched: Set<number>): Dataset {
  let { rows, variables } = d;

  let end = rows.length;
  while (end > 0 && rows[end - 1]!.every((c) => c === '')) end--;
  if (end < rows.length) rows = rows.slice(0, end);

  let width = variables.length;
  while (width > 0 && variables[width - 1]!.autoName && rows.every((r) => (r[width - 1] ?? '') === '')) width--;
  if (width < variables.length) {
    variables = variables.slice(0, width);
    rows = rows.map((r) => r.slice(0, width));
  }

  const isMissing = makeIsMissing(ctx.invalidCodes);
  const seen = new Set<string>();
  variables = variables.map((v, j) => {
    let next = v;
    if (v.autoName && v.name !== autoVariableName(j)) next = { ...next, name: autoVariableName(j) };
    let name = next.name;
    for (let k = 2; seen.has(name.toLowerCase()); k++) name = `${next.name}_${k}`;
    seen.add(name.toLowerCase());
    if (name !== next.name) next = { ...next, name };
    if (touched.has(j)) {
      const reading = detectColumn(
        rows.map((r) => r[j] ?? ''),
        isMissing,
        ctx.decimal,
      );
      next = next.levelSetByUser ? { ...next, decimal: reading.decimal } : { ...next, ...reading };
    }
    return next;
  });

  return { ...d, rows, variables };
}

/** Whole table as tab-separated text, names row first: pastes straight into Excel or Sheets. */
export function datasetToTsv(d: Dataset): string {
  const clean = (s: string) => (/[\t\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [d.variables.map((v) => v.name), ...d.rows].map((r) => r.map(clean).join('\t')).join('\r\n') + '\r\n';
}

/** A rectangle of the grid (names row included when r0 is -1) as tab-separated text. */
export function rangeToTsv(d: Dataset, r0: number, c0: number, r1: number, c1: number): string {
  const lines: string[] = [];
  for (let r = r0; r <= r1; r++) {
    const cells: string[] = [];
    for (let c = c0; c <= c1; c++) {
      const v = d.variables[c];
      cells.push(r === -1 ? (v && !v.autoName ? v.name : '') : (d.rows[r]?.[c] ?? ''));
    }
    lines.push(cells.join('\t'));
  }
  return lines.join('\r\n');
}

/** Columns nobody named and nobody filled: kept for position, hidden from the variable picker. */
export function isUnusedColumn(d: Dataset, j: number): boolean {
  return d.variables[j]!.autoName && d.rows.every((r) => (r[j] ?? '') === '');
}
