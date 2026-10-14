# Statbis Lab

A free statistics app that runs entirely in the browser. Students paste their data from Excel or
Google Sheets; nothing is uploaded or saved. The full specification is in [CLAUDE.md](CLAUDE.md).

## Everyday commands

Run these in a terminal opened in this folder.

| What | Command |
|---|---|
| Open the app on your computer (live-updating while we build) | `npm run dev`, then visit http://localhost:5173 |
| Run the automatic checks | `npm test` |
| Make the version you publish (written to the `dist` folder) | `npm run build` |
| Look at the published version locally before uploading | `npm run preview` |
| Rebuild the practice datasets in `examples/` | `python scripts/make_examples.py --check` |
| Recompute the reference values the tests compare against | `python scripts/make_golden.py` |

The first time on a new computer, run `npm install` once to download the building blocks.

## Publishing on Vercel

The app is a plain static site, so Vercel only needs three settings:

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`

No environment variables or server functions are needed.

## Folder guide

- `src/data/` — reading pasted tables, missing values, variable types, the dataset fingerprint
- `src/stats/` — the statistical formulas (from Milestone 2)
- `src/ui/` — the screens; `src/i18n/` — every text in English and Bahasa Indonesia
- `examples/` — practice datasets (made by `scripts/make_examples.py`)
- `tests/` — automatic checks; `tests/golden/` holds reference values computed in Python
- `docs/METHODS.md` — the formulas actually implemented
- `reference/` — Numiqo screenshots for design reference only (kept out of git, never published)
