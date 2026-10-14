/** Codes treated as missing by default (blank cells are always missing). */
export const DEFAULT_INVALID_CODES: readonly string[] = ['NA', 'N/A', '-', '.', '?', '#N/A', '#NULL!'];

/** Build a test for missing cells. Codes are compared after trimming, ignoring case. */
export function makeIsMissing(codes: readonly string[]): (cell: string) => boolean {
  const set = new Set(codes.map((c) => c.trim().toUpperCase()).filter((c) => c !== ''));
  return (cell) => cell === '' || set.has(cell.toUpperCase());
}
