/** Display formatting. Kept out of src/stats, which returns unrounded numbers only. */

export type Places = 'auto' | 2 | 3 | 4 | 5 | 6;
export type Sep = '.' | ',';

/**
 * Automatic: up to 4 significant figures, never fewer than 2 decimals (68.79, 2.834, 0.1700).
 * A fixed number of places rounds to exactly that many decimals.
 */
export function formatNumber(x: number, places: Places, sep: Sep): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : x < 0 ? '-∞' : '—';
  let decimals: number;
  if (places === 'auto') {
    const magnitude = Math.floor(Math.log10(Math.abs(x))) + 1;
    decimals = x === 0 ? 2 : Math.min(12, Math.max(2, 4 - magnitude));
  } else {
    decimals = places;
  }
  let s = x.toFixed(decimals);
  if (/^-0\.?0*$/.test(s)) s = s.slice(1);
  return sep === ',' ? s.replace('.', ',') : s;
}

/** p-values APA style: `.006`, `< .001`, no leading zero, always 3 decimals. */
export function formatP(p: number, sep: Sep): string {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.001) return `< ${sep}001`;
  const s = p.toFixed(3);
  return (s.startsWith('0') ? s.slice(1) : s).replace('.', sep);
}

export function formatCount(n: number): string {
  return String(n);
}
