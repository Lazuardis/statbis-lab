# Methods implemented in Statbis Lab

This file records the formulas the app actually computes, kept in sync with `src/stats/` and the
golden tests. CLAUDE.md ("Method specifications") is the contract; this file is the record.

## Data handling (Milestone 1)

**Entering data.** The grid is an editable spreadsheet; its first row holds the variable names.
Pasted text is read as tab-separated (Excel and Google Sheets), including quoted cells, and is
written into the grid from the active cell. Cells are trimmed. Trailing blank rows, and trailing
columns with no name and no data, are dropped. Unnamed columns are called `Var1`, `Var2`, … by
position; repeated names get `_2`, `_3`, …

**Missing values.** A cell is missing if it is blank or equals one of the *Invalid values* codes
(trimmed, ignoring case). Defaults: `NA`, `N/A`, `-`, `.`, `?`, `#N/A`, `#NULL!`.

**Level of measurement (auto-detect).** A column whose non-missing cells are all numbers is
metric; anything else is nominal. Auto-detect never proposes ordinal.
- Decimal separator *Auto*: a column is read with a point if every cell parses that way;
  otherwise with a comma if it has at least one comma-decimal number (`12,5`) and every cell
  parses with a comma. *Comma* or *Point* forces the separator for every column.
- Coded-category warning: metric, all whole numbers, at most 10 distinct values, some repeated.
- ID-column warning: nominal with more than 20 categories, or at least 10 values of which at
  least 90% are distinct.

**Dataset fingerprint.** Computed over the data cells only (not the variable names), in grid
order, and recomputed after every edit. Each cell is canonicalised: trimmed; a number written with
a point or with a single decimal comma becomes its shortest round-trip form (`12,50` → `12.5`,
`007` → `7`); anything else stays as text. Cells are joined with a tab, rows with a newline, and
the first 8 hex characters of SHA-256 of the UTF-8 text are shown. Settings, renaming and level
changes do not affect it. Verified against Python's `hashlib` (`tests/golden/fingerprint.json`).
Each report item records the fingerprint at the moment it was added.

**Number display.** *Automatic*: up to 4 significant figures, never fewer than 2 decimals.
p-values: three decimals without the leading zero (`.006`), and `< .001` below 0.001.

## Statistical methods

Added from Milestone 2 onwards.
