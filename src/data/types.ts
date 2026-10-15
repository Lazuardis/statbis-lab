export type Level = 'metric' | 'ordinal' | 'nominal';

/** How numbers are read from text. 'auto' decides per column. */
export type DecimalSetting = 'auto' | 'comma' | 'point';

/** The separator actually used to read one column. */
export type ColumnDecimal = 'point' | 'comma';

export interface Variable {
  /** Stable key that survives renaming and moving. */
  id: string;
  name: string;
  /** True when nobody gave the column a name, so it is called Var1, Var2, … by position. */
  autoName: boolean;
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
  /** Data rows of trimmed cell text; every row has one cell per variable. */
  rows: string[][];
  variables: Variable[];
  /** Counter for new variable ids. */
  nextVarId: number;
}
