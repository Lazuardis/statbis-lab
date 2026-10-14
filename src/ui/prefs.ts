import type { DecimalSetting } from '../data/types';
import type { Lang } from '../i18n/i18n';
import type { Places, Sep } from './format';

/** The only things ever stored in the browser: UI preferences, never data or report content. */
export interface Prefs {
  lang: Lang;
  decimal: DecimalSetting;
  places: Places;
}

const KEY = 'statbis-lab.prefs';
export const DEFAULT_PREFS: Prefs = { lang: 'id', decimal: 'auto', places: 'auto' };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      lang: p.lang === 'en' || p.lang === 'id' ? p.lang : DEFAULT_PREFS.lang,
      decimal: p.decimal === 'comma' || p.decimal === 'point' ? p.decimal : 'auto',
      places: p.places === 2 || p.places === 3 || p.places === 4 || p.places === 5 || p.places === 6 ? p.places : 'auto',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable (private window, blocked); preferences just won't persist */
  }
}

/** Separator used to show results: forced by the setting, otherwise by the language. */
export function displaySep(p: Prefs): Sep {
  if (p.decimal === 'comma') return ',';
  if (p.decimal === 'point') return '.';
  return p.lang === 'id' ? ',' : '.';
}
