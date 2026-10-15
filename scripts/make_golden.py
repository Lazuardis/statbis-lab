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


def tests_cases() -> dict:
    """One-sample t, Welch t, paired t (scipy) and proportion z-tests (statsmodels)."""
    import numpy as np
    import pandas as pd
    from scipy import stats
    from statsmodels.stats.proportion import proportions_ztest

    ex = ROOT / "examples"
    alts = {"two-sided": "two-sided", "greater": "larger", "less": "smaller"}
    out: dict = {"oneSample": [], "welch": [], "paired": [], "oneProp": [], "twoProp": []}

    d3 = pd.read_csv(ex / "ex03_onesample_waiting.csv")
    for x, mu0 in ((d3.Waiting_min.tolist(), 10.0), ([4.1, 5.2, 3.9, 6.0, 5.5], 5.0)):
        for alt in alts:
            for alpha in (0.05, 0.01):
                r = stats.ttest_1samp(x, mu0, alternative=alt)
                ci = r.confidence_interval(1 - alpha) if alt == "two-sided" else stats.ttest_1samp(x, mu0).confidence_interval(1 - alpha)
                out["oneSample"].append({"x": x, "mu0": mu0, "alt": alt, "alpha": alpha, "t": float(r.statistic),
                                         "df": float(r.df), "p": float(r.pvalue), "ciLower": float(ci.low), "ciUpper": float(ci.high)})

    d4 = pd.read_csv(ex / "ex04_twosample_channel.csv")
    g, w = d4[d4.Channel == "GoFood"].Basket_value.tolist(), d4[d4.Channel == "Walk-in"].Basket_value.tolist()
    d7 = pd.read_csv(ex / "ex07_anova_outlets.csv")
    a, b = d7[d7.Outlet == "Darmo"].Delivery_min.tolist(), d7[d7.Outlet == "Gubeng"].Delivery_min.tolist()
    for x1, x2 in ((g, w), (w, g), (a, b), ([1.0, 2.0, 4.0], [3.0, 5.0, 9.0, 12.0])):
        for alt in alts:
            r = stats.ttest_ind(x1, x2, equal_var=False, alternative=alt)
            ci = stats.ttest_ind(x1, x2, equal_var=False).confidence_interval(0.95)
            out["welch"].append({"x1": x1, "x2": x2, "alt": alt, "t": float(r.statistic), "df": float(r.df),
                                 "p": float(r.pvalue), "ciLower": float(ci.low), "ciUpper": float(ci.high)})

    d5 = pd.read_csv(ex / "ex05_paired_promo.csv")
    before, after = d5.Units_before.astype(float).tolist(), d5.Units_after.astype(float).tolist()
    for bb, aa in ((before, after), ([10.0, 12.0, 9.0, 15.0], [11.0, 15.0, 9.5, 14.0])):
        for alt in alts:
            r = stats.ttest_rel(aa, bb, alternative=alt)
            ci = stats.ttest_rel(aa, bb).confidence_interval(0.95)
            out["paired"].append({"before": bb, "after": aa, "alt": alt, "t": float(r.statistic), "df": float(r.df),
                                  "p": float(r.pvalue), "ciLower": float(ci.low), "ciUpper": float(ci.high)})

    for x, n, p0 in ((33, 45, 0.8), (23, 60, 0.5), (12, 100, 0.08)):
        for alt in alts:
            z, p = proportions_ztest(x, n, value=p0, alternative=alts[alt], prop_var=p0)
            ph = x / n
            zc = float(stats.norm.ppf(0.975))
            se = (ph * (1 - ph) / n) ** 0.5
            out["oneProp"].append({"x": x, "n": n, "p0": p0, "alt": alt, "z": float(z), "p": float(p),
                                   "ciLower": ph - zc * se, "ciUpper": ph + zc * se})

    for x1, n1, x2, n2 in ((31, 300, 49, 300), (49, 300, 31, 300), (18, 40, 9, 35)):
        for alt in alts:
            z, p = proportions_ztest([x1, x2], [n1, n2], alternative=alts[alt])
            p1, p2 = x1 / n1, x2 / n2
            se = (p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2) ** 0.5
            zc = float(stats.norm.ppf(0.975))
            out["twoProp"].append({"x1": x1, "n1": n1, "x2": x2, "n2": n2, "alt": alt, "z": float(z), "p": float(p),
                                   "ciLower": p1 - p2 - zc * se, "ciUpper": p1 - p2 + zc * se})
    return out


def groups_cases() -> dict:
    """One-way ANOVA, Levene (mean-centred), Tukey HSD, chi-square independence and GOF (scipy)."""
    import numpy as np
    import pandas as pd
    from scipy import stats

    ex = ROOT / "examples"
    d7 = pd.read_csv(ex / "ex07_anova_outlets.csv")
    rng = np.random.default_rng(11)
    sets = {
        "ex07 outlets": {o: d7[d7.Outlet == o].Delivery_min.tolist() for o in sorted(d7.Outlet.unique())},
        "unequal sizes": {"A": [round(v, 2) for v in rng.normal(10, 2, 8)],
                          "B": [round(v, 2) for v in rng.normal(12, 3, 15)],
                          "C": [round(v, 2) for v in rng.normal(11, 2.5, 5)]},
        "far apart": {"X": [1.0, 2.0, 1.5, 2.2], "Y": [10.0, 11.0, 10.5, 9.8], "Z": [20.0, 21.0, 19.5, 20.4]},
    }
    anova = []
    for name, groups in sets.items():
        vals = list(groups.values())
        f = stats.f_oneway(*vals)
        lev = stats.levene(*vals, center="mean")
        hsd = stats.tukey_hsd(*vals)
        ci = hsd.confidence_interval(0.95)
        labels = list(groups.keys())
        pairs = []
        for i in range(len(labels)):
            for j in range(i + 1, len(labels)):
                pairs.append({"first": labels[i], "second": labels[j], "diff": float(hsd.statistic[i, j]),
                              "p": float(hsd.pvalue[i, j]), "lower": float(ci.low[i, j]), "upper": float(ci.high[i, j])})
        anova.append({"name": name, "groups": groups, "f": float(f.statistic), "p": float(f.pvalue),
                      "levene": float(lev.statistic), "leveneP": float(lev.pvalue), "pairs": pairs})

    d8 = pd.read_csv(ex / "ex08_chisq_segment.csv")
    d6 = pd.read_csv(ex / "ex06_twoprop_banner.csv")
    tables = {
        "ex08 segment x payment": pd.crosstab(d8.Segment, d8.Payment),
        "ex06 banner x converted": pd.crosstab(d6.Banner, d6.Converted),
    }
    indep = []
    for name, tab in tables.items():
        chi2, p, dof, exp = stats.chi2_contingency(tab.values, correction=False)
        indep.append({"name": name, "rows": [str(r) for r in tab.index], "cols": [str(c) for c in tab.columns],
                      "observed": tab.values.tolist(), "chi2": float(chi2), "p": float(p), "df": int(dof),
                      "expected": exp.tolist()})
    big = np.array([[200, 5], [5, 200]])
    chi2, p, dof, exp = stats.chi2_contingency(big, correction=False)
    indep.append({"name": "tiny p", "rows": ["a", "b"], "cols": ["x", "y"], "observed": big.tolist(),
                  "chi2": float(chi2), "p": float(p), "df": int(dof), "expected": exp.tolist()})

    gof = []
    for obs, shares in (([142, 26, 132], [0.45, 0.10, 0.45]), ([30, 20, 25, 25], [0.25, 0.25, 0.25, 0.25]),
                        ([50, 30, 20], [0.5, 0.3, 0.2])):
        r = stats.chisquare(obs, f_exp=[s * sum(obs) for s in shares])
        gof.append({"observed": obs, "shares": shares, "chi2": float(r.statistic), "p": float(r.pvalue)})
    return {"anova": anova, "independence": indep, "gof": gof}


def regression_cases() -> list[dict]:
    """Pearson r (scipy) and simple OLS (statsmodels), the Excel ToolPak regression quantities."""
    import numpy as np
    import pandas as pd
    import statsmodels.api as sm
    from scipy import stats

    ex = ROOT / "examples"
    d9 = pd.read_csv(ex / "ex09_regression_promo.csv")
    d5 = pd.read_csv(ex / "ex05_paired_promo.csv")
    rng = np.random.default_rng(5)
    xs = [round(v, 2) for v in rng.uniform(0, 10, 25)]
    pairs = {
        "ex09 orders on promo": (d9.Promo_spend.tolist(), d9.Orders.astype(float).tolist()),
        "ex05 after on before": (d5.Units_before.astype(float).tolist(), d5.Units_after.astype(float).tolist()),
        "weak": (xs, [round(5 + 0.05 * x + v, 2) for x, v in zip(xs, rng.normal(0, 3, 25))]),
        "negative small": ([1.0, 2.0, 3.0, 4.0, 5.0, 6.0], [9.5, 8.1, 7.7, 5.0, 4.4, 2.9]),
    }
    out = []
    for name, (x, y) in pairs.items():
        pr = stats.pearsonr(x, y)
        m = sm.OLS(y, sm.add_constant(x)).fit()
        ci = m.conf_int(0.05)
        out.append({
            "name": name, "x": x, "y": y, "r": float(pr.statistic), "rP": float(pr.pvalue),
            "intercept": float(m.params[0]), "slope": float(m.params[1]),
            "seIntercept": float(m.bse[0]), "seSlope": float(m.bse[1]),
            "tIntercept": float(m.tvalues[0]), "tSlope": float(m.tvalues[1]),
            "pIntercept": float(m.pvalues[0]), "pSlope": float(m.pvalues[1]),
            "ciIntercept": [float(ci[0][0]), float(ci[0][1])], "ciSlope": [float(ci[1][0]), float(ci[1][1])],
            "rSquared": float(m.rsquared), "seEstimate": float(np.sqrt(m.mse_resid)),
            "f": float(m.fvalue), "pF": float(m.f_pvalue), "ssResidual": float(m.ssr), "ssRegression": float(m.ess),
        })
    return out


def main() -> None:
    GOLDEN.mkdir(parents=True, exist_ok=True)
    for name, data in (("fingerprint", fingerprint_cases()), ("descriptive", descriptive_cases()),
                       ("tests", tests_cases()), ("groups", groups_cases()), ("regression", regression_cases())):
        out = GOLDEN / f"{name}.json"
        out.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
