import type { ColumnDecimal } from './types';

/**
 * Split delimited text (tab-separated from Excel / Google Sheets, or our own example CSVs)
 * into rows of cells. Handles Excel's quoting: a cell containing the delimiter, a newline or a
 * quote is wrapped in double quotes, with inner quotes doubled.
 *
 * Line endings are normalised, a leading byte-order mark is dropped, every cell is trimmed,
 * and trailing blank rows and trailing blank columns are removed.
 */
export function splitDelimited(text: string, delimiter = '\t'): string[][] {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let cellStarted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && !cellStarted) {
      inQuotes = true;
      cellStarted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
      cellStarted = false;
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      cellStarted = false;
    } else {
      cell += ch;
      if (ch !== ' ') cellStarted = true;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const trimmed = rows.map((r) => r.map((c) => c.trim()));
  return dropTrailingBlanks(trimmed);
}

function dropTrailingBlanks(rows: string[][]): string[][] {
  const isBlankRow = (r: string[]) => r.every((c) => c === '');
  let end = rows.length;
  while (end > 0 && isBlankRow(rows[end - 1]!)) end--;
  const kept = rows.slice(0, end);

  let width = 0;
  for (const r of kept) {
    for (let j = r.length - 1; j >= 0; j--) {
      if (r[j] !== '') {
        width = Math.max(width, j + 1);
        break;
      }
    }
  }
  return kept.map((r) => {
    const out = r.slice(0, width);
    while (out.length < width) out.push('');
    return out;
  });
}

const POINT_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const COMMA_NUMBER = /^[+-]?(\d+,?\d*|,\d+)$/;

/** Read a trimmed cell as a number using the given decimal separator; null if it is not one. */
export function parseNumber(text: string, decimal: ColumnDecimal): number | null {
  if (decimal === 'point') {
    return POINT_NUMBER.test(text) ? Number(text) : null;
  }
  return COMMA_NUMBER.test(text) ? Number(text.replace(',', '.')) : null;
}

/** True if the cell is a number written with a single decimal comma, e.g. `12,5`. */
export function isCommaDecimal(text: string): boolean {
  return /^[+-]?(\d*,\d+)$/.test(text);
}
