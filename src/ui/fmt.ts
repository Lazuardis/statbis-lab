import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { formatNumber, formatP, type Places, type Sep } from './format';

/** Number formatting with the user's decimal places and separator, available to every section. */
export interface Fmt {
  sep: Sep;
  places: Places;
  num: (x: number | null | undefined) => string;
  p: (x: number) => string;
  /** "= .006" or "< .001", for running text after "p". */
  pEq: (x: number) => string;
  int: (n: number) => string;
  pct: (x: number) => string;
}

export function makeFmt(sep: Sep, places: Places): Fmt {
  const num = (x: number | null | undefined) => (x === null || x === undefined || Number.isNaN(x) ? '—' : formatNumber(x, places, sep));
  return {
    sep,
    places,
    num,
    p: (x) => formatP(x, sep),
    pEq: (x) => {
      const s = formatP(x, sep);
      return s.startsWith('<') ? s : `= ${s}`;
    },
    int: (n) => String(n),
    pct: (x) => formatNumber(x, places === 'auto' ? 2 : places, sep),
  };
}

export const FmtContext = createContext<Fmt>(makeFmt('.', 'auto'));

export function useFmt(): Fmt {
  return useContext(FmtContext);
}
