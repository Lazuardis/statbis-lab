export type Level = 'metric' | 'ordinal' | 'nominal';

/** How numbers are read from text. 'auto' decides per column. */
export type DecimalSetting = 'auto' | 'comma' | 'point';

/** The separator actually used to read one column. */
export type ColumnDecimal = 'point' | 'comma';

export interface Variable {
  /** Stable key that survives renaming. */
  id: string;
  name: string;
  level: Level;
  /** True once the user picked the level, so re-reading the data does not override it. */
  levelSetByUser: boolean;
  unit: string;
  /** Ratio scale (has a true zero); needed for CV. Only meaningful for metric variables. */
  ratio: boolean;
  decimal: ColumnDecimal;
}

export interface Dataset {
  /** Editable label used in the report and its file name. */
  name: string;
  /** Header row as pasted (after trimming and de-duplication). */
  header: string[];
  /** Data rows of trimmed cell text, all padded to header length. */
  rows: string[][];
  variables: Variable[];
  /** First 8 hex characters of SHA-256 over the canonical cells. */
  fingerprint: string;
}
