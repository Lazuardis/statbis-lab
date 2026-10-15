# CLAUDE.md — Statbis Lab

A free, browser-based statistics app for the group project (Tugas Besar) of **DB234305 Statistics
for Business**, Departemen Manajemen Bisnis, ITS. It replaces Numiqo, whose free tier blurs every
result table, and it deliberately **follows Numiqo's interaction model** so that students and
assistants who have seen Numiqo, or its video tutorials, feel at home. "Statbis Lab" is a working
name; rename freely.

Owner: Lazuardi Al-Muzaki (RPS developer lecturer, IUP class). Ask him before any decision listed
under "Ask first" at the end of this file.

## Decisions (2026-10-14) — these override the rest of this file where they conflict

- **Name** "Statbis Lab" stays. **Brand accent** `#0F6B6B` plus tints/shades derived from it.
- **Hosting**: Vercel, set up by Lazuardi himself. The repository is local only; no GitHub repo, no
  GitHub Pages, no deployment workflow. Asset paths must be relative so any static host works.
- **Data entry is paste or typing** in this version: no Import dialog, no CSV/XLSX file reading, no
  papaparse or SheetJS. Toolbar: *New data · Example data ▾ · Copy data · Settings*. Because there
  is no file name, the data has an editable name under the grid (default "My data"; example name
  for examples); the report uses it.
- **The grid is an editable spreadsheet** (decided 2026-10-15; replaces non-negotiable 7). Click a
  cell and type, paste a block into any cell, Delete clears, Tab/Enter/arrows move, Ctrl+Z/Ctrl+Y
  undo/redo, right-click to insert or delete rows and columns. The first grid row holds the
  variable names. New data, pasted data and example data are all editable. Nothing is saved, so:
  *Copy data* puts the whole table on the clipboard for Excel/Sheets, and the page warns before
  closing while there are edits that have not been copied. No file export.
- **Fingerprint** is computed over the current data values (not the column names), recomputed after
  every edit. Each cell is canonicalised: trimmed; a cell that reads as a number with a point
  (`12.5`) or a single decimal comma (`12,5`) is written as the shortest round-trip number (`12.5`);
  anything else stays as trimmed text. Trailing blank rows and columns are dropped. The same sheet
  gives the same fingerprint on English- and Indonesian-locale Excel. Settings and renaming do not
  affect it. Each report item records the fingerprint it was made with; items made before a later
  edit say so in the report.
- **Ordinal** is not silently treated as nominal. It is accepted only where a rule says
  "nominal/ordinal"; elsewhere the student must decide and change the level.
- **Decimal separator**: Auto reads each column on its own (comma-decimal column if it has
  comma-decimal numbers and no dots) and displays results with a comma in Bahasa and a point in
  English. Comma or Point forces both reading and display. *Copy* uses the display separator.
- **Automatic decimal places** = up to 4 significant figures, never fewer than 2 decimals;
  p-values `.006` and `< .001`.
- **Paired t**: d = right-hand column − left-hand column in the grid, with a swap button; always
  print "d = <after> − <before>" with the real names.
- **Two-proportion z**: a "Compare groups of" choice (default the variable ticked first) next to
  the success-category picker.
- **Two metric variables on the Hypothesis tab** still give the paired t-test, with the fixed line
  "This assumes each row is the same unit measured twice. To see whether two measures move
  together, use the Correlation tab."
- **Paste** always works; if the grid has data, confirm first (and say the report will be cleared).
- **Invalid values** list resets each visit (not stored). Stored prefs: language, decimal separator,
  decimal places.
- **Default language** Bahasa Indonesia; the choice is remembered.
- **No guide link** in the header for now. *Not sure which test?* stays on the Hypothesis tab (M5).
- **Course-context agnostic UI**: no course week numbers, dates, "Final Project" or "module Poin"
  references in anything the app shows. Example data may keep the Dapur Kita setting. The delivery
  timeline still applies (milestones 1–5 live before Week 12).
- **Work through all milestones without stopping** (decided 2026-10-15; replaces "report to
  Lazuardi before starting the next milestone"). Commit after each milestone and give one short
  report at the end. Lazuardi is on Claude Pro: keep verification lean (tests plus one browser check
  per milestone), avoid repeated screenshots.
- **Font**: Lato bundled locally via `@fontsource/lato` (no Google Fonts request).
- **Post-hoc after ANOVA**: Tukey–Kramer HSD (confirmed 2026-10-15). Shown under the ANOVA,
  all pairs: difference (first − second), SE, q, p, simultaneous CI; studentized range
  distribution; golden-test against statsmodels `pairwise_tukeyhsd` / scipy `tukey_hsd`.

## Who uses it, and for what

- **Students** (Classes A, B, C, IUP, G; ~180 students in groups) run the analyses for their project
  report and submit the app's report file with their data (module Poin 5.b).
- **Assistants** use the same app during Asistensi to re-run a group's analysis from the group's own
  data file and check that the report's numbers trace back to it (rubric component 4).

Most users are second-year business students, not statisticians. They use Windows laptops and
Chrome, sometimes phones. Many will paste data straight from Excel or Google Sheets.

## Non-negotiables

1. **Runs entirely in the browser.** Static site, no backend, no network calls after the page loads,
   no analytics or trackers. Data never leaves the user's machine (UU No. 27/2022 PDP).
2. **Nothing is persisted.** No localStorage, IndexedDB or cookies for data or report content
   (Numiqo keeps both in the browser; we do not, because students use shared lab computers). Only UI
   preferences (language, decimal separator, decimal places) may be stored. If the report drawer has
   items, warn before the page is closed or reloaded.
3. **Course formulas only.** Every method computes exactly what the course teaches, so a student's
   manual calculation reconciles with the app (module Poin 8.d). Specifically: Wald CI and z-test for
   proportions (not exact binomial or Clopper–Pearson), Welch for two independent means,
   `QUARTILE.EXC` quartiles, sample SD with n − 1, chi-square **without** Yates correction.
   Where a formula is spelled out under "Method specifications", that formula is the contract.
4. **Only the methods in this file.** Do not add a test, effect size, post-hoc procedure or
   transformation that is not listed here, even if Numiqo has it. Ask first.
5. **Interpretation stops at the statistics.** Like Numiqo's *Interpretation* link, every results
   table can show a templated paragraph, filled with the live values, that explains what each column
   means and states the statistical decision ("p = 0.006 is below α = 0.05, so the null hypothesis
   that the two means are equal is rejected"). It must **never** draw the business conclusion, give a
   recommendation, or use causal wording ("X impacts Y") — module Poin 11.b requires groups to write
   that themselves. Templates are hand-written text in `i18n`, not generated.
6. **No AI or LLM features.** Numiqo's *Explain* and *APA Style* buttons have no equivalent here.
7. **Data is read-only in the app.** No cell editing, no row deletion, no recoding (Numiqo's
   *prepare data* has no equivalent). Cleaning happens in Excel and is logged in the group's
   *Log Pembersihan* sheet (module Poin 7.f); to fix data, the user fixes the source file and
   re-imports. Renaming a variable and changing its type are allowed — they do not change values.
8. **Bilingual UI**: English and Bahasa Indonesia, switchable from the header at any time without
   losing state. Bahasa must read naturally, not as a literal translation. Statistical terms that the
   course teaches in English (p-value, confidence interval, ANOVA, chi-square) may stay in English.
9. **Borrow the pattern, not the brand.** Reproduce Numiqo's layout and interaction patterns. Do not
   copy its name, logo, icons, colours, help text, example datasets or code.

## Not in scope (say no, or ask)

- Data cleaning tools: duplicates, impossible values, mixed units, recoding, transformations.
- *Uji kecukupan data* and *uji keseragaman data*. The module explicitly retired them. Do not build
  them, even if asked by a student-facing request.
- Post-hoc tests after ANOVA, two-way or repeated-measures ANOVA, non-parametric tests, multiple
  regression, logistic regression, Cronbach's alpha, Cohen's d, η², Cramér's V. None is taught in
  DB234305. (When Numiqo would offer a non-parametric alternative, we show nothing.)
- Accounts, sharing links, cloud save, collaboration, surveys.

## UI and interaction model (modelled on Numiqo)

Reference screenshots of Numiqo are in `reference/numiqo/` (taken 2026-10-14, free tier, so some
values are blurred). Look at them before building each screen. The numbered list below names the
screenshot that shows each pattern.

### Page structure — one page, top to bottom
1. **Header**: app name (left); language switch `EN | ID` and a link to the guide (right).
2. **Data toolbar** above the grid (`01`): *New data* · *Import* · *Example data ▾* · *Settings*.
   Right-aligned, a small note with an icon: "Your data stays in this browser".
3. **Data grid** (`01`): spreadsheet look, a *Case* column of row numbers, and above each variable
   name a small **type label** (`metric`, `ordinal`, `nominal`) with an icon. The grid scrolls inside
   its own frame (about 15 rows visible) so the analysis area stays close below it.
   Under the grid, one line: file name · rows × columns · dataset fingerprint.
4. **Analysis tabs** (`01`, `08`) in a row of text links, the active one bold:
   **Descriptive / Charts · Hypothesis tests · Correlation · Regression · Sample size**.
   Numiqo has a second row (Reliability, Survival, MSA, …); we have none. Tabs use hash routes
   (`#/describe`, `#/tests`, `#/correlation`, `#/regression`, `#/sample-size`) so the browser back
   button works on GitHub Pages.
5. **Variable picker** (`02`, `08`): three columns headed **Metric variables · Ordinal variables ·
   Nominal variables**, each listing the variables of that type as checkboxes. The Regression tab
   instead shows **Dependent variable** (radio buttons) and **Independent variable** (radio buttons —
   simple regression only, unlike Numiqo's checkboxes).
6. **Options** under the picker (`02`, `09`): e.g. *Calculate* checkboxes on the Descriptive tab, the
   *Alternative hypothesis* radios and *Test value* input on the Hypothesis tab, α and confidence
   level.
7. **Results**, streaming below as soon as a valid selection exists — no "Run" button. Each result is
   a titled section (`09`, `10`): a large heading with a thin accent rule, then pill buttons for the
   section (*Check assumptions*, *Check your manual working*), then its tables and charts.
8. **Report drawer** (`12`): a floating button bottom-right with a count badge opens a right-side
   drawer titled *Report*.

### Auto-selection of the test (Hypothesis tests tab) — the core Numiqo pattern
The user ticks variables; the app decides the test and titles the section with its name (`08`).

| Ticked | Test shown |
|---|---|
| 1 metric | One-sample t-test, with a *Test value* input (μ₀) |
| 1 nominal/ordinal with 2 categories | One-proportion z-test, with *success category* and *test proportion* inputs |
| 1 nominal/ordinal with ≥ 3 categories | Chi-square goodness-of-fit, with an expected-shares input |
| 1 metric + 1 nominal with 2 groups | Two-sample t-test (Welch) |
| 1 metric + 1 nominal with ≥ 3 groups | One-way ANOVA |
| 2 metric | Paired t-test (rows are the pairs) |
| 2 nominal, both with 2 categories | Two-proportion z-test, then chi-square of independence below it, with the note "z² equals χ² for a 2 × 2 table" |
| 2 nominal, otherwise | Chi-square test of independence |
| anything else | A short message: which combinations are supported, and a link to *Not sure which test?* |

A small link above the picker, **Not sure which test?**, opens the method guide (see below).

### Data entry and variables
- **Paste**: when the grid is empty, clicking the first header cell and pressing Ctrl+V (or ⌘V)
  fills the grid from tab-separated clipboard text, first row = names. This is how most students
  will enter data. A pasted grid replaces the current one after a confirmation.
- **Import dialog** (`06`): drag-and-drop area plus *Browse*, for .xlsx, .csv and .tsv. If an .xlsx
  has several sheets, ask which one. (No export of data — the user already has the file.)
- **Variable dialog** (`05`): clicking a column's type label opens it. Fields: *Name*;
  *Level of measurement* radios `metric · ordinal · nominal` with an *Auto-detect* button;
  *Unit* (e.g. "Rp ribu", "menit"); *Ratio scale (has a true zero)* checkbox, shown for metric
  variables, needed for CV. No delete button.
- **Auto-detect** like Numiqo: numbers → metric, text → nominal. Then warn (never block):
  - a metric column with ≤ 10 distinct whole numbers — "Is this a coded category (1 = Male,
    2 = Female)? Change it to nominal in the variable dialog." Numiqo's documented commonest trap;
  - a nominal column with > 20 categories or nearly one per row — shown as a red info icon next to
    the variable in the picker (`08`, `Order_ID`), tooltip "Looks like an ID column; it cannot be used
    as a grouping variable."
- **Settings dialog** (`07`): *Invalid values* (a list of codes treated as missing; defaults
  `NA`, `N/A`, `-`, `.`, `?`, `#N/A`, `#NULL!`, empty), *Decimal separator* (Auto · Comma · Point),
  *Number of decimal places* (Automatic, 2–6). No chart-colour or grid-line settings.

### Results tables
- Toolbar above every table (`10`): **Copy · Interpretation · Add to report**. *Copy* puts
  tab-separated text on the clipboard so it pastes into Excel and Word as a table. *Interpretation*
  toggles the templated paragraph below the table (`11`, and non-negotiable 5).
- **Hypotheses block** at the top of every test (`09`): two columns, *Null hypothesis* and
  *Alternative hypothesis*, in words with the real variable and group names, bolding the key phrase
  ("there is **no difference** between …"). The wording follows the chosen alternative.
- The **Alternative hypothesis** radios name the groups or the test value, e.g.
  "GoFood ≠ Walk-in · GoFood > Walk-in · GoFood < Walk-in" (`09`). A **Group order** control (swap
  button) sets which group comes first; default alphabetical. Numiqo uses order of first appearance,
  which flips the sign of the difference without telling the user — we always print
  "difference = <first group> − <second group>".
- Numbers right-aligned; p-values shown like `.006` and `< .001` (as Numiqo and APA do), with the
  decimal separator from Settings. Every table says `n used` and, if any, `n excluded (missing)`.

### Charts
- Each chart section is two columns (`03`, `04`): **options on the left** (radio buttons and
  checkboxes, e.g. histogram *y-axis: density / frequency*, *Show: mean, median, normal curve,
  statistics*, *Bin count*; box plot *Orientation*, *Show: mean, points*; Q-Q plot *95% band:
  yes / no*; scatter *Regression line*, *Swap axes*), and the **chart on the right** with a toolbar
  *Download PNG · SVG · Copy · Add to report*.
- Clean, flat style: white background, no grid lines, one accent colour for single series and a
  colour-blind-safe palette (Okabe–Ito) for groups. Title, axis labels with units, variable names.

### Report drawer (Numiqo calls it Documentation)
- *Add to report* on any table or chart appends it, with its interpretation if open, under a heading
  naming the analysis (`12`).
- Drawer header buttons: **Copy all · Print · Download HTML · Clear**. *Print* uses the browser print
  dialog (so students can save a PDF). The report opens with a fixed block: app name and version,
  date and time, dataset file name, rows × columns, fingerprint.
- Footer note: "Not saved — download or print before closing this page."
- *Download HTML* produces one self-contained file named
  `<dataset>_statbis-report_<yyyymmdd-hhmm>.html`. This is the output file groups submit.

### Additions that Numiqo does not have
- **Check your manual working** pill on every test: lists the summary inputs (n, mean, SD, counts)
  and the intermediate quantities (standard error, df, critical value, test statistic) unrounded to
  6 significant figures. It does **not** show the substituted formula step by step — students do
  that part by hand. One line explains that differences in the 3rd decimal usually come from rounding.
- **Check assumptions** pill (Numiqo paywalls theirs): the method-specific panel described under each
  method below.
- **Dataset fingerprint**: see "Data handling".
- **Method guide** (*Not sure which test?*): the module Poin 8 table as a small interactive picker —
  choose the question type and the data, and it says which tab and which variables to tick.

| Question | Data | Method | Course week |
|---|---|---|---|
| What is the true mean / proportion? | 1 metric / 1 nominal | CI for a mean (t) / for a proportion (z) | 9 |
| Does the mean / proportion differ from a target? | 1 metric / 1 nominal | One-sample t-test / one-proportion z-test | 10 |
| Do two independent groups differ? | metric + 2-group nominal / 2 binary nominal | Two-sample t-test (Welch) / two-proportion z-test | 11 |
| Is there a change before vs after? | 2 metric, same rows | Paired t-test | 11 |
| Do three or more groups differ? | metric + nominal with ≥ 3 groups | One-way ANOVA | 12 |
| Are two categorical variables related? | 2 nominal | Chi-square test of independence | 12 |
| Do two numeric variables move together? | 2 metric | Correlation and simple linear regression | 13 |

### Visual design
Numiqo's look is quiet and academic: white page, max content width ~1200 px centred, generous
spacing, a single teal accent for links, selected states and buttons, light-grey table rules,
large section headings with a thin accent underline. Follow that feel with our own tokens: accent
`#0F6B6B` (deep teal, close to the course's MB-Deck-Template-1 brand — Lazuardi may supply the exact
hex), text `#1F2933`, muted `#6B7785`, rules `#E3E8EC`, font Lato (fallback system sans). Define
colours as CSS custom properties. Layout must work at 1366 × 768 (typical student laptop) and stay
usable on a phone (picker columns stack; tables scroll horizontally inside their frame).

## Data handling

**Import.** Paste, CSV/TSV or XLSX all land in the same grid.
Decimal comma support: Indonesian-locale files write `12,5`. With Settings → Auto, detect columns
that contain comma-decimal numbers and no dots; show which separator was used under the grid.

**Missing values.** Blank cells and the *Invalid values* codes are missing. Each analysis drops
incomplete rows for its own variables only.

**Dataset fingerprint.** At import, compute SHA-256 over the imported cell values (trimmed, joined
with tab and newline, header row included) and show the first 8 hex characters. Renaming a variable
or changing its type afterwards does **not** change the fingerprint. It appears under the grid and in
the report header. An assistant re-importing the group's submitted file sees the same fingerprint,
which shows the report came from that file.

## Tech stack

- Vite + TypeScript (strict). UI with Preact (small bundle). Plain CSS with custom properties.
- `jstat` for distribution functions (normal, t, F, chi-square CDFs and inverses).
- `papaparse` for CSV/TSV. SheetJS (`xlsx`) for .xlsx import — install from the official
  cdn.sheetjs.com tarball, not the stale npm registry version.
- Charts as hand-written SVG components (histogram, box plot, Q-Q plot, scatter, residual plot, bar
  chart, F and χ² density with shaded tail). Keep them simple; this also makes SVG download trivial.
  If that proves too slow to build, ask before adding a chart library.
- Vitest for tests. Python 3 + scipy + statsmodels + pandas for generating reference values only.
- Hosting: GitHub Pages via a GitHub Actions workflow on push to `main`.

Ask before adding any other runtime dependency.

## Repository layout

```
src/
  stats/        pure functions only — no DOM, no i18n, no formatting
    distributions.ts  descriptive.ts  quartiles.ts  normality.ts
    ci.ts  onesample.ts  twosample.ts  paired.ts  proportions.ts
    anova.ts  chisquare.ts  regression.ts  samplesize.ts
  data/         import (paste, CSV, XLSX), type detection, missing values, fingerprint
  ui/
    shell/      header, toolbar, grid, tabs, variable picker, dialogs, report drawer
    sections/   one result section per method
    charts/     SVG chart components
    interpret/  interpretation templates (filled from results; text lives in i18n)
  i18n/         en.json, id.json
reference/numiqo/   screenshots of Numiqo used as the UX reference (do not ship)
examples/       practice datasets, one CSV per method (see "Example datasets")
scripts/
  make_examples.py   builds examples/ with a fixed seed
  make_golden.py     computes reference values with scipy/statsmodels → tests/golden/*.json
tests/
  golden/       reference JSON (committed)
  *.test.ts
docs/
  METHODS.md    the formulas actually implemented, kept in sync with src/stats
```

Commands: `npm run dev`, `npm test`, `npm run build`, `python scripts/make_golden.py`.

## Working rules for Claude Code

- Build and test `src/stats` before the UI for each method. A method is done only when its golden
  tests pass at 1e-6 relative tolerance (1e-4 for p-values below 1e-6).
- Changing a formula means changing `docs/METHODS.md` and the golden tests in the same commit.
- Every new UI string, including interpretation templates, goes into both `en.json` and `id.json`
  in the same commit.
- Before building a screen, open the matching file in `reference/numiqo/`. After building it, take a
  screenshot of ours at 1366 × 768 and compare layout, spacing and the order of elements.
- After each milestone, run the build, open it in the browser, try every example dataset, and
  report to Lazuardi what works and what does not before starting the next milestone.
- Keep the production bundle under 1 MB gzipped. Report the size at each milestone.

## Method specifications

Notation: n sample size, x̄ mean, s sample SD (n − 1), α significance level (default 0.05; options
0.01 / 0.05 / 0.10), confidence level 1 − α (default 95%).

### Descriptive / Charts tab
*Calculate* checkboxes (`02`), default ticked: n, Mean, Std. deviation, Minimum, Maximum. Also
available: Median, Mode, Variance, Range, Quartiles (Q1, Q3), IQR, Skewness, CV, CI for mean,
Missing. With a nominal variable also ticked, every statistic is shown per group. A nominal variable
on its own gives a frequency table (count, %, cumulative %) with *CI for proportion* available, and
a bar chart. Two nominal variables give a contingency table (counts, row %, column %).
- **Mode**: list every value tied for the highest frequency; "no mode" if every value occurs once.
- **Quartiles** = Excel `QUARTILE.EXC`: position p(n + 1), linear interpolation between order
  statistics; "—" with a note when the position falls outside 1..n.
- **Skewness** = Excel `SKEW`: n / ((n − 1)(n − 2)) · Σ((x − x̄)/s)³.
- **CV** = s / x̄ × 100%, only when the variable is marked ratio and x̄ > 0; otherwise "—" and why.
- **Outliers**: fences Q1 − 1.5·IQR and Q3 + 1.5·IQR (EXC quartiles). A table lists flagged values
  with their case numbers, and the text says "investigate, do not delete automatically; report
  results with and without them if they change the conclusion" (module Poin 7.f).
- **Charts**, in this order: histogram (default y-axis frequency, Sturges bins, optional normal
  curve), box plot (Tukey whiskers to the most extreme points inside the fences, outliers as dots,
  drawn from our EXC quartiles — never from a library's), Q-Q / normal probability plot (sorted values
  against z = Φ⁻¹((i − 0.375)/(n + 0.25)), reference line through Q1 and Q3, optional 95% band).
- **Shapiro–Wilk** sits under the Q-Q plot as a supplementary line, never on its own, with the fixed
  caption: "A p-value above 0.05 does not prove normality. Judge from the histogram and the Q-Q
  plot; with n ≥ 30 per group the methods here are robust." (Module Poin 8.c.) Royston's AS R94
  algorithm; golden-test against scipy.

### CI for a mean (Descriptive tab, and inside the one-sample t-test)
x̄ ± t(α/2, n − 1) · s/√n. Report x̄, s, n, SE, df, t critical, margin of error, lower, upper.
Equals Excel `CONFIDENCE.T`.

### CI for a proportion (frequency table, and inside the one-proportion z-test)
p̂ ± z(α/2) · √(p̂(1 − p̂)/n) for the chosen category. Check n·p̂ ≥ 5 and n·(1 − p̂) ≥ 5; if not,
warn that the interval is unreliable and more data is needed. No exact alternative is offered.

### One-sample t-test
t = (x̄ − μ₀)/(s/√n), df = n − 1. Report t, df, p, decision, the difference x̄ − μ₀ with its unit,
and the CI for the mean. Check assumptions: histogram, Q-Q plot, n.

### One-proportion z-test
z = (p̂ − p₀)/√(p₀(1 − p₀)/n) — the standard error uses p₀, not p̂. Check n·p₀ ≥ 5 and
n·(1 − p₀) ≥ 5. Report z, p, decision, p̂ − p₀ in percentage points, and the Wald CI for p.

### Two-sample t-test (independent, Welch)
t = (x̄₁ − x̄₂)/√(s₁²/n₁ + s₂²/n₂), Welch–Satterthwaite df (fractional) — Excel `T.TEST` type 3.
Report **only** the Welch row. (Numiqo prints an equal-variances row and an unequal-variances row
plus Levene's test; the course lets the spreadsheet choose the variance treatment and does not teach
pooled vs unpooled — Week 11 note.) Sections: Hypotheses · Descriptive statistics by group (n, mean,
SD, SE of mean) · Box plot by group · t-test result (difference with unit, t, df, p) · 95% CI of the
difference. Check assumptions: Q-Q plot per group, SD ratio (larger/smaller), n per group.
Note for METHODS.md: Excel's Analysis ToolPak *t-Test: Two-Sample Assuming Unequal Variances* rounds
df to an integer, so its p-value can differ slightly from `T.TEST` and from this app. Verify in Excel
during the build and record the result.

### Paired t-test
Two metric variables, one row per unit (before, after). d = second ticked − first ticked; a swap
button reverses it. t = d̄/(s_d/√n), df = n − 1. Report d̄ with unit, s_d, t, df, p, decision, CI
for the mean difference. Equals Excel `T.TEST` type 1. Rows with either value missing are dropped and
counted. Check assumptions: histogram and Q-Q plot of the differences.

### Two-proportion z-test
From two binary nominal variables (outcome × group), or from summarised counts entered in a small
form inside the section ("I only have counts"). Pooled p̄ = (x₁ + x₂)/(n₁ + n₂);
z = (p̂₁ − p̂₂)/√(p̄(1 − p̄)(1/n₁ + 1/n₂)). CI for p₁ − p₂ is the unpooled Wald interval
(p̂₁ − p̂₂) ± z(α/2)·√(p̂₁(1 − p̂₁)/n₁ + p̂₂(1 − p̂₂)/n₂). The user picks the success category.
Check n·p ≥ 5 and n·(1 − p) ≥ 5 in each group. Report the difference in percentage points. This is
the A/B conversion-rate case (Week 11 indicator 4).

### One-way ANOVA
Group summary (count, sum, mean, variance) and the table Source | SS | df | MS | F | p for Between
groups (df k − 1), Within groups (df N − k) and Total — the layout of the Excel ToolPak *ANOVA:
Single Factor*. Box plot by group. Chart: F distribution with the observed F marked and the p-value
area shaded (Week 12 indicator 7). Check assumptions ("comparable spread", Week 12 indicator 8):
group SDs, largest/smallest SD ratio with the rule of thumb "below 2 is usually fine", Levene's test
(mean-centred), Q-Q plot per group. No post-hoc test (see "Ask first").

### Chi-square test of independence
Observed counts with row and column totals, expected counts E = row total × column total / N,
X² = Σ(O − E)²/E, df = (r − 1)(c − 1), p. Equals Excel `CHISQ.TEST`. **No Yates correction**,
including for 2×2 tables (scipy applies it by default — pass `correction=False` in golden values).
Flag every cell with E < 5 (module Poin 7.d sets ≥ 5 per cell) and suggest merging categories.
Chart: chi-square distribution with X² marked and p shaded. Also accept a pasted contingency table via
"I only have a table".

### Chi-square goodness-of-fit (benchmark)
One nominal variable with ≥ 3 categories; the user enters expected shares (must sum to 100%) or
expected counts. X² = Σ(O − E)²/E, df = k − 1. Same expected-count check.

### Correlation tab
Two or more metric variables ticked → Pearson r for each pair (matrix when > 2), with n and the test
of r = 0: t = r√(n − 2)/√(1 − r²), df = n − 2. Scatter plot for a pair. Static note under the
result: correlation is not causation.

### Regression tab (simple linear only)
Dependent variable (radio) and one independent variable (radio). Sections, following Numiqo's order:
Number of cases · Model summary (R, R², standard error of the estimate) · ANOVA table · Coefficients
(B, SE, t, p, 95% CI for intercept and slope) · Regression equation in words with units ·
Scatter plot with fitted line · Residual plot (residuals vs X). Values must equal Excel's `SLOPE`,
`INTERCEPT`, `RSQ`, `CORREL` and the ToolPak regression output.
- **Predict**: an input for an X value; show ŷ with its unit. If X is outside [min X, max X], warn
  that this is extrapolation (Week 13 indicator 7). No prediction or confidence intervals.

### Sample size tab (proposal stage, module Poin 7.d)
- Mean: n = (z·σ/E)², rounded up. Inputs: confidence (default 95%, z = 1.96), σ (or paste 10–15
  pilot values to compute s), E with unit.
- Proportion: n = z²·p(1 − p)/E², rounded up; p defaults to 0.5.
- A "number of groups compared" multiplier. Next to the result, the module's minimums: 30 per group
  for means, n·p ≥ 5 and n·(1 − p) ≥ 5 for proportions, expected count ≥ 5 per chi-square cell.

## Example datasets

`scripts/make_examples.py` builds one CSV per method with a fixed seed, in the course's running
setting — *Dapur Kita*, an illustrative cloud kitchen in Surabaya on GoFood. Each file has an ID
column and realistic units. They load from the *Example data* menu and double as the assistants'
training material.

| File | Method | Content |
|---|---|---|
| `ex01_describe_delivery.csv` | Descriptive / Charts | 120 delivery times (min), right-skewed, 2 planted outliers, 3 blanks, plus a numeric-coded `Outlet_code` (1/2/3) to trigger the coded-category warning |
| `ex02_ci_basket.csv` | CIs | 60 orders: basket value (Rp ribu), used voucher yes/no |
| `ex03_onesample_waiting.csv` | One-sample t / one-proportion z | 45 peak-hour waiting times vs a 10-minute target; on-time yes/no vs an 80% target |
| `ex04_twosample_channel.csv` | Two-sample t | **The supplied pilot file** `C3_basket_by_channel.csv` (GoFood vs Walk-in, 40 + 40), renamed |
| `ex05_paired_promo.csv` | Paired t | 30 menu items, weekly units sold before and after a promo |
| `ex06_twoprop_banner.csv` | Two-proportion z | A/B test of two app banners: banner A/B, converted yes/no (≈ 600 visitors) |
| `ex07_anova_outlets.csv` | One-way ANOVA | Delivery times at 4 outlets (Gubeng, Keputih, Darmo, Rungkut), 25 each |
| `ex08_chisq_segment.csv` | Chi-square | 300 customers: segment (student / office worker / family) × payment (QRIS / cash / e-wallet) |
| `ex09_regression_promo.csv` | Correlation & regression | 52 weeks: promo spend (Rp juta) vs orders |

Make every planted feature deliberate (a significant result in some files, a non-significant one in
at least one, one chi-square table with a cell below E = 5) and record the intended results in a
comment at the top of `make_examples.py`.

### Smoke test from the pilot file

`C3_basket_by_channel.csv` (80 rows: Order_ID, Channel, Basket_value in Rp ribu) was run in Numiqo
and in scipy on 2026-10-14; both agree. With GoFood first, the app must reproduce:

| Quantity | Value |
|---|---|
| GoFood: n, mean, SD | 40, 68.7925, 11.5931 |
| Walk-in: n, mean, SD | 40, 61.0200, 12.9006 |
| Difference (GoFood − Walk-in) | 7.7725 |
| Welch t, df | 2.834217, 77.1258 |
| p (two-tailed) | 0.005861 |
| 95% CI of difference | 2.3119 to 13.2331 |

Pasting this file into the grid must also show `Order_ID` with the ID-column warning, exactly as
Numiqo did (`08`/`09`).

## Milestones (course weeks refer to the 2026 RPS)

1. **Shell** — header, language switch, toolbar, paste/import, grid with type labels, variable
   dialog, settings, fingerprint, tabs, variable picker, report drawer, deployment.
2. **Descriptive / Charts and Sample size** — needed for the Week 10 proposal and Asistensi 1.
3. **Hypothesis tests, one variable and two groups** — one-sample t, one-proportion z, Welch t,
   paired t, two-proportion z, both CIs. The smoke test must pass.
4. **Several groups and categories** — ANOVA, chi-square independence and goodness-of-fit.
5. **Correlation and Regression tabs**, method guide.
6. **Training pack** — every example dataset wired in; a printable one-page guide per method built
   from the in-app interpretation templates and *Check assumptions* panels.

Milestones 1–5 must be live before Week 12 (Asistensi 2, when groups analyse their data); the
assistants' training on the app should happen before then.

## Ask first

- The app's final name, the exact brand hex, and which GitHub account hosts it (personal or an ITS
  organisation).
- Post-hoc comparisons after a significant ANOVA: not taught, but groups will ask which groups
  differ. Default is to leave them out.
- Whether Shapiro–Wilk should appear at all (default: supplementary line under the Q-Q plot).
- Any method, statistic, chart or Numiqo feature not specified in this file.
