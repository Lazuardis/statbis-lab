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

## Descriptive statistics (Milestone 2) — `src/stats/descriptive.ts`

Golden-tested against numpy/scipy (`tests/golden/descriptive.json`) at 1e-6 relative tolerance.

- **Mean** x̄ = Σx / n. **Variance** s² = Σ(x − x̄)² / (n − 1) (two-pass), **SD** s = √s².
- **Median**: middle value, or the average of the two middle values.
- **Quartiles** = Excel `QUARTILE.EXC`: position p(n + 1), linear interpolation between order
  statistics; undefined ("—") when the position is outside 1..n (n < 3). numpy `method="weibull"`.
- **IQR** = Q3 − Q1. **Range** = max − min.
- **Mode**: every value tied for the highest count; "no mode" when every value occurs once.
- **Skewness** = Excel `SKEW`: n / ((n − 1)(n − 2)) · Σ((x − x̄)/s)³ (scipy `skew(bias=False)`).
- **CV** = s / x̄ × 100%, only for variables marked ratio scale with x̄ > 0.
- **CI for a mean**: x̄ ± t(1 − α/2, n − 1) · s/√n (Excel `CONFIDENCE.T`).
- **CI for a proportion** (frequency table): Wald p̂ ± z(1 − α/2)·√(p̂(1 − p̂)/n); flagged † when
  n·p̂ < 5 or n·(1 − p̂) < 5.
- **Outliers**: values outside Q1 − 1.5·IQR and Q3 + 1.5·IQR (EXC quartiles), listed with case
  numbers; per group when a grouping variable is ticked.
- **Grouping**: a ticked nominal *or ordinal* variable splits every statistic by group (rows with
  a missing value in either variable are excluded and counted). An ordinal variable alone gives a
  frequency table, two give a contingency table. (Only descriptive output; tests follow their own
  rules.)
- Categories are listed in natural order (numbers by value, then text alphabetically).

## Charts (Milestone 2) — `src/ui/charts/`

- **Histogram**: Sturges bins ⌈log₂ n⌉ + 1 by default, equal widths from min to max; optional
  normal curve with x̄ and s, scaled to counts (n × bin width) or density.
- **Box plot**: box from Q1 to Q3 (EXC), median line, whiskers to the most extreme values inside
  the fences, outliers as open circles; optional mean (diamond) and jittered points.
- **Q-Q plot**: sorted values against z = Φ⁻¹((i − 0.375)/(n + 0.25)); reference line through
  (z₀.₂₅, Q1) and (z₀.₇₅, Q3); optional 95% pointwise band line(z) ± 1.96 · slope ·
  √(p(1 − p)/n) / φ(z), p = (i − 0.375)/(n + 0.25).
- **Shapiro–Wilk** (`src/stats/normality.ts`): Royston (1995) AS R94, n = 3..5000, matches
  `scipy.stats.shapiro` to 1e-6. Shown only as a supplementary line under the Q-Q plot.

## Sample size (Milestone 2) — `src/stats/samplesize.ts`

- z uses the rounded textbook values 1.645 (90%), 1.96 (95%), 2.576 (99%), so hand calculations
  agree.
- Mean: n = (z·σ/E)²; proportion: n = z²·p(1 − p)/E²; always rounded **up** (after removing
  floating-point noise at 1e-9), then multiplied by the number of groups.

## Statistical tests

Added from Milestone 3 onwards.
