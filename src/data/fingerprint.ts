import { isCommaDecimal, parseNumber } from './parse';

/**
 * Canonical form of one cell for the fingerprint. A number written with a point or with a single
 * decimal comma becomes its shortest round-trip form, so the same sheet copied from English- or
 * Indonesian-locale Excel gives the same fingerprint. Everything else is the trimmed text.
 */
export function canonicalCell(cell: string): string {
  const t = cell.trim();
  const point = parseNumber(t, 'point');
  if (point !== null) return String(point);
  if (isCommaDecimal(t)) return String(parseNumber(t, 'comma'));
  return t;
}

/** Data rows only: renaming a column never changes the fingerprint. */
export function canonicalText(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(canonicalCell).join('\t')).join('\n');
}

/** First 8 hex characters of SHA-256 over the canonical data cells; '' for an empty table. */
export async function fingerprint(rows: readonly (readonly string[])[]): Promise<string> {
  if (rows.length === 0) return '';
  const bytes = new TextEncoder().encode(canonicalText(rows));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest).slice(0, 4), (b) => b.toString(16).padStart(2, '0')).join('');
}
