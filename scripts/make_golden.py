"""Compute reference values for the Vitest golden tests.

Usage:  python scripts/make_golden.py

Writes tests/golden/*.json. Reference values come from Python (hashlib now; scipy and
statsmodels from Milestone 2 on), never from the app itself.
"""

import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GOLDEN = ROOT / "tests" / "golden"

POINT_NUMBER = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$")
COMMA_DECIMAL = re.compile(r"^[+-]?(\d*,\d+)$")


def js_number_str(x: float) -> str:
    """JavaScript's String(number) for the ordinary values used here."""
    if x == int(x) and abs(x) < 1e21:
        return str(int(x))
    return repr(x)


def canonical_cell(cell: str) -> str:
    t = cell.strip()
    if POINT_NUMBER.match(t):
        return js_number_str(float(t))
    if COMMA_DECIMAL.match(t):
        return js_number_str(float(t.replace(",", ".")))
    return t


def fingerprint(rows: list[list[str]]) -> str:
    """Over the data rows only (the first row holds the names and is excluded)."""
    text = "\n".join("\t".join(canonical_cell(c) for c in r) for r in rows[1:])
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:8]


def to_tsv(rows: list[list[str]], comma_decimal: bool = False) -> str:
    """Text as Excel puts it on the clipboard (CRLF, trailing newline)."""
    def cell(c: str) -> str:
        if comma_decimal and POINT_NUMBER.match(c) and "." in c:
            return c.replace(".", ",")
        return c
    return "".join("\t".join(cell(c) for c in r) + "\r\n" for r in rows)


def fingerprint_cases() -> list[dict]:
    with open(ROOT / "C3_basket_by_channel.csv", newline="", encoding="utf-8") as f:
        pilot = [row for row in csv.reader(f)]
    small = [["Name", "Score", "Note"], ["A", "1.50", " x "], ["B", "2", ""], ["C", "-0.25", "NA"]]
    return [
        {"name": "pilot, English-locale paste", "text": to_tsv(pilot), "fingerprint": fingerprint(pilot)},
        {"name": "pilot, Indonesian-locale paste", "text": to_tsv(pilot, comma_decimal=True),
         "fingerprint": fingerprint(pilot)},
        {"name": "small table with padding and NA", "text": to_tsv(small) + "\t\t\r\n",
         "fingerprint": fingerprint(small)},
    ]


def descriptive_cases() -> dict:
    """Summary statistics, CIs and Shapiro-Wilk with numpy/scipy (QUARTILE.EXC = 'weibull')."""
    import numpy as np
    import pandas as pd
    from scipy import stats

    ex = ROOT / "examples"
    rng = np.random.default_rng(7)
    samples = {
        "ex01 Delivery_min": pd.read_csv(ex / "ex01_describe_delivery.csv").Delivery_min.dropna().tolist(),
        "ex02 Basket_value": pd.read_csv(ex / "ex02_ci_basket.csv").Basket_value.tolist(),
        "ex07 Delivery_min": pd.read_csv(ex / "ex07_anova_outlets.csv").Delivery_min.tolist(),
        "n=3": [2.0, 7.5, 3.1],
        "n=4": [10.0, 12.0, 15.0, 30.0],
        "n=5 ties": [4.0, 4.0, 5.0, 9.0, 9.0],
        "n=7": [1.2, 3.4, 2.2, 8.9, 5.5, 4.4, 2.0],
        "n=11": [round(v, 2) for v in rng.normal(50, 10, 11)],
        "n=12": [round(v, 2) for v in rng.exponential(5, 12)],
        "n=40 lognormal": [round(v, 3) for v in rng.lognormal(3, 0.6, 40)],
        "n=300 normal": [round(v, 2) for v in rng.normal(100, 15, 300)],
    }
    cases = []
    for name, x in samples.items():
        a = np.asarray(x, float)
        n = len(a)

        def exc(q: float):
            pos = q * (n + 1)
            return None if pos < 1 or pos > n else float(np.percentile(a, q * 100, method="weibull"))

        vals, counts = np.unique(a, return_counts=True)
        top = counts.max()
        sw = stats.shapiro(a)
        ci = {}
        for conf in (0.90, 0.95, 0.99):
            lo, hi = stats.t.interval(conf, n - 1, a.mean(), a.std(ddof=1) / np.sqrt(n))
            ci[str(conf)] = {"tCrit": float(stats.t.ppf(1 - (1 - conf) / 2, n - 1)), "lower": float(lo), "upper": float(hi)}
        cases.append({
            "name": name, "x": x, "n": n, "mean": float(a.mean()), "sd": float(a.std(ddof=1)),
            "variance": float(a.var(ddof=1)), "median": float(np.median(a)), "q1": exc(0.25), "q3": exc(0.75),
            "skewness": float(stats.skew(a, bias=False)),
            "modes": [] if top == 1 else [float(v) for v in vals[counts == top]],
            "ci": ci, "shapiroW": float(sw.statistic), "shapiroP": float(sw.pvalue),
        })
    props = []
    for x, n in ((23, 60), (33, 45), (2, 30), (150, 300)):
        for conf in (0.90, 0.95, 0.99):
            ph = x / n
            z = float(stats.norm.ppf(1 - (1 - conf) / 2))
            se = (ph * (1 - ph) / n) ** 0.5
            props.append({"x": x, "n": n, "conf": conf, "z": z, "lower": ph - z * se, "upper": ph + z * se,
                          "conditionsMet": bool(n * ph >= 5 and n * (1 - ph) >= 5)})
    return {"samples": cases, "proportions": props}


def main() -> None:
    GOLDEN.mkdir(parents=True, exist_ok=True)
    for name, data in (("fingerprint", fingerprint_cases()), ("descriptive", descriptive_cases())):
        out = GOLDEN / f"{name}.json"
        out.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
