import { isCommaDecimal, parseNumber } from './parse';
import type { ColumnDecimal, DecimalSetting, Level, Variable } from './types';

export interface ColumnReading {
  level: Level;
  decimal: ColumnDecimal;
}

/**
 * Auto-detect like Numiqo: a column whose non-missing cells are all numbers is metric,
 * anything else is nominal. Auto never proposes ordinal; the user chooses that.
 */
export function detectColumn(
  cells: readonly string[],
  isMissing: (c: string) => boolean,
  setting: DecimalSetting,
): ColumnReading {
  const present = cells.filter((c) => !isMissing(c));
  if (present.length === 0) return { level: 'nominal', decimal: 'point' };

  const allParse = (d: ColumnDecimal) => present.every((c) => parseNumber(c, d) !== null);

  if (setting === 'point' || setting === 'comma') {
    return { level: allParse(setting) ? 'metric' : 'nominal', decimal: setting };
  }
  if (allParse('point')) return { level: 'metric', decimal: 'point' };
  if (present.some(isCommaDecimal) && allParse('comma')) return { level: 'metric', decimal: 'comma' };
  return { level: 'nominal', decimal: 'point' };
}

export interface VariableWarnings {
  /** Metric column with few distinct whole numbers: probably a coded category. */
  codedCategory: boolean;
  /** Nominal column with > 20 categories or nearly one per row: probably an ID. */
  idLike: boolean;
  /** Metric column cells that are not numbers and will count as missing. */
  nonNumericCount: number;
}

export const CODED_MAX_DISTINCT = 10;
export const ID_MAX_CATEGORIES = 20;
export const ID_UNIQUE_SHARE = 0.9;

export function variableWarnings(
  variable: Variable,
  cells: readonly string[],
  isMissing: (c: string) => boolean,
): VariableWarnings {
  const present = cells.filter((c) => !isMissing(c));
  const out: VariableWarnings = { codedCategory: false, idLike: false, nonNumericCount: 0 };

  if (variable.level === 'metric') {
    const nums: number[] = [];
    for (const c of present) {
      const x = parseNumber(c, variable.decimal);
      if (x === null) out.nonNumericCount++;
      else nums.push(x);
    }
    const distinct = new Set(nums);
    out.codedCategory =
      nums.length > distinct.size &&
      distinct.size <= CODED_MAX_DISTINCT &&
      nums.every((x) => Number.isInteger(x));
  } else if (variable.level === 'nominal') {
    const distinct = new Set(present).size;
    out.idLike =
      distinct > ID_MAX_CATEGORIES ||
      (present.length >= 10 && distinct >= ID_UNIQUE_SHARE * present.length);
  }
  return out;
}
