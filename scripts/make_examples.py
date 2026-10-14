"""Build the practice datasets in examples/ (fixed seed, so the files never change).

Usage:  python scripts/make_examples.py          writes the CSVs
        python scripts/make_examples.py --check  also prints the results recorded below

Setting: Dapur Kita, an illustrative cloud kitchen in Surabaya selling on GoFood.

Intended results (alpha = 0.05; verified with scipy by --check, update this block if the data change):
  ex01  Delivery_min: n = 117 (3 blanks: cases 13, 59, 102), right-skewed (Excel SKEW = 3.946 with
        the outliers), planted outliers 112 and 126 (cases 37 and 88) are the only values above
        the upper fence 59.32 (QUARTILE.EXC); Outlet_code (1/2/3) triggers the coded-category
        warning; Order_ID triggers the ID-column warning.
  ex02  Basket_value mean = 78.243, 95% CI 74.013 to 82.473 (Rp ribu); voucher used 23/60 = 38.33%,
        95% Wald CI 26.03% to 50.64%.
  ex03  Waiting_min vs 10 min: t = 3.1454, p = .003 → significant.
        On_time vs 80%: phat = 33/45 = 73.33%, z = −1.118, p = .264 → NOT significant.
  ex04  Pilot file: Welch t = 2.834217, df = 77.1258, p = .005861 (GoFood − Walk-in = 7.7725).
  ex05  After − Before: mean d = 4.1 units, t = 2.2106, p = .035 → significant (only just).
  ex06  Converted: Banner A 31/300 = 10.33%, Banner B 49/300 = 16.33%; z (A − B) = −2.1617,
        p = .031 → significant; chi-square (no Yates) = 4.6731 = z².
  ex07  One-way ANOVA across 4 outlets: F = 4.2295, p = .0075 → significant; SD ratio 1.355 < 2.
  ex08  Segment × Payment: chi-square = 22.534, df = 4, p = .00016 → significant; one cell
        (Family × Cash) has expected count 4.33 < 5.
  ex09  Orders on Promo_spend: r = 0.8136, slope = 34.447 orders per Rp 1 juta,
        intercept = 428.358, p < .001.
"""

import shutil
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "examples"
SEED = 20261014


def write(df: pd.DataFrame, name: str) -> None:
    df.to_csv(OUT / name, index=False, lineterminator="\n")


def ex01(rng: np.random.Generator) -> pd.DataFrame:
    n = 120

    def draw(k: int) -> np.ndarray:
        return np.round(18 + rng.gamma(shape=2.2, scale=7.0, size=k), 1)

    t = draw(n)
    while True:  # redraw natural values beyond the upper fence, so only the planted ones are outliers
        q1, q3 = np.percentile(t, [25, 75], method="weibull")
        far = t > q3 + 1.5 * (q3 - q1)
        if not far.any():
            break
        t[far] = draw(int(far.sum()))
    t[36], t[87] = 112.0, 126.0  # planted outliers (cases 37 and 88)
    col = t.astype(object)
    for i in (12, 58, 101):  # three blanks
        col[i] = ""
    return pd.DataFrame({
        "Order_ID": [f"DL{1001 + i}" for i in range(n)],
        "Outlet_code": rng.integers(1, 4, size=n),
        "Delivery_min": col,
    })


def ex02(rng: np.random.Generator) -> pd.DataFrame:
    n = 60
    basket = np.round(rng.normal(78, 18, size=n), 1)
    voucher = np.array(["yes"] * 23 + ["no"] * 37)
    rng.shuffle(voucher)
    return pd.DataFrame({"Order_ID": [f"BK{2001 + i}" for i in range(n)],
                         "Basket_value": basket, "Used_voucher": voucher})


def ex03(rng: np.random.Generator) -> pd.DataFrame:
    n = 45
    wait = np.round(rng.normal(11.2, 3.0, size=n), 1)
    on_time = np.array(["yes"] * 33 + ["no"] * 12)
    rng.shuffle(on_time)
    return pd.DataFrame({"Order_ID": [f"WT{3001 + i}" for i in range(n)],
                         "Waiting_min": wait, "On_time": on_time})


def ex05(rng: np.random.Generator) -> pd.DataFrame:
    items = ["Nasi goreng", "Mie goreng", "Ayam geprek", "Soto ayam", "Rawon", "Nasi pecel",
             "Bakso", "Sate ayam", "Gado-gado", "Nasi uduk", "Ayam bakar", "Lele goreng",
             "Tahu telur", "Rujak cingur", "Lontong balap", "Nasi campur", "Bebek goreng",
             "Mie ayam", "Capcay", "Fuyunghai", "Es teh", "Es jeruk", "Kopi susu", "Jus alpukat",
             "Teh tarik", "Pisang goreng", "Martabak", "Roti bakar", "Kentang goreng", "Siomay"]
    before = rng.integers(40, 140, size=30)
    after = np.maximum(0, before + np.round(rng.normal(6, 10, size=30))).astype(int)
    return pd.DataFrame({"Menu_item": items, "Units_before": before, "Units_after": after})


def ex06(rng: np.random.Generator) -> pd.DataFrame:
    rows = []
    for banner, conv in (("A", 31), ("B", 49)):
        outcome = np.array(["yes"] * conv + ["no"] * (300 - conv))
        rng.shuffle(outcome)
        rows += [(banner, o) for o in outcome]
    order = rng.permutation(len(rows))
    rows = [rows[i] for i in order]
    return pd.DataFrame({"Visitor_ID": [f"V{10001 + i}" for i in range(len(rows))],
                         "Banner": [r[0] for r in rows], "Converted": [r[1] for r in rows]})


def ex07(rng: np.random.Generator) -> pd.DataFrame:
    outlets = {"Gubeng": 33, "Keputih": 36, "Darmo": 31, "Rungkut": 37}
    rows = [(o, round(float(rng.normal(m, 6)), 1)) for o, m in outlets.items() for _ in range(25)]
    order = rng.permutation(len(rows))
    rows = [rows[i] for i in order]
    return pd.DataFrame({"Order_ID": [f"OT{4001 + i}" for i in range(len(rows))],
                         "Outlet": [r[0] for r in rows], "Delivery_min": [r[1] for r in rows]})


def ex08(rng: np.random.Generator) -> pd.DataFrame:
    # Counts by segment (rows) and payment (columns: QRIS, Cash, E-wallet).
    table = {"Student": (60, 6, 64), "Office worker": (70, 12, 38), "Family": (12, 8, 30)}
    rows = [(seg, pay) for seg, counts in table.items()
            for pay, k in zip(("QRIS", "Cash", "E-wallet"), counts) for _ in range(k)]
    order = rng.permutation(len(rows))
    rows = [rows[i] for i in order]
    return pd.DataFrame({"Customer_ID": [f"C{5001 + i}" for i in range(len(rows))],
                         "Segment": [r[0] for r in rows], "Payment": [r[1] for r in rows]})


def ex09(rng: np.random.Generator) -> pd.DataFrame:
    spend = np.round(rng.uniform(2, 10, size=52), 2)
    orders = np.round(420 + 35 * spend + rng.normal(0, 55, size=52)).astype(int)
    return pd.DataFrame({"Week": np.arange(1, 53), "Promo_spend": spend, "Orders": orders})


def check() -> None:
    from scipy import stats

    def p(path: str) -> pd.DataFrame:
        return pd.read_csv(OUT / path)

    d = p("ex01_describe_delivery.csv")
    x = d.Delivery_min.dropna()
    q1, q3 = np.percentile(x, [25, 75], method="weibull")  # = QUARTILE.EXC
    upper = q3 + 1.5 * (q3 - q1)
    print("ex01 n", len(x), "skew", round(stats.skew(x, bias=False), 3), "upper fence", round(upper, 2),
          "outliers", list(d.index[d.Delivery_min > upper] + 1), list(x[x > upper]))

    d = p("ex02_ci_basket.csv")
    x = d.Basket_value
    ci = stats.t.interval(0.95, len(x) - 1, x.mean(), x.std(ddof=1) / np.sqrt(len(x)))
    ph = (d.Used_voucher == "yes").mean()
    se = np.sqrt(ph * (1 - ph) / len(d))
    print("ex02 mean", round(x.mean(), 3), "CI", np.round(ci, 3), "phat", round(ph, 4),
          "CI", round(ph - 1.959964 * se, 4), round(ph + 1.959964 * se, 4))

    d = p("ex03_onesample_waiting.csv")
    r = stats.ttest_1samp(d.Waiting_min, 10)
    ph = (d.On_time == "yes").mean()
    z = (ph - 0.8) / np.sqrt(0.8 * 0.2 / len(d))
    print("ex03 t", round(r.statistic, 4), "p", round(r.pvalue, 4), "| phat", round(ph, 4), "z", round(z, 4),
          "p", round(2 * stats.norm.sf(abs(z)), 4))

    d = p("ex04_twosample_channel.csv")
    r = stats.ttest_ind(d[d.Channel == "GoFood"].Basket_value, d[d.Channel == "Walk-in"].Basket_value,
                        equal_var=False)
    print("ex04 t", round(r.statistic, 6), "df", round(r.df, 4), "p", round(r.pvalue, 6))

    d = p("ex05_paired_promo.csv")
    r = stats.ttest_rel(d.Units_after, d.Units_before)
    print("ex05 mean d", round((d.Units_after - d.Units_before).mean(), 3), "t", round(r.statistic, 4),
          "p", round(r.pvalue, 4))

    d = p("ex06_twoprop_banner.csv")
    tab = pd.crosstab(d.Banner, d.Converted)
    chi2, pv, _, _ = stats.chi2_contingency(tab, correction=False)
    xa, xb = tab.loc["A", "yes"], tab.loc["B", "yes"]
    pa, pb, pp = xa / 300, xb / 300, (xa + xb) / 600
    z = (pa - pb) / np.sqrt(pp * (1 - pp) * (2 / 300))
    print("ex06 A", xa, "B", xb, "z", round(z, 4), "z²", round(z * z, 4), "chi2", round(chi2, 4), "p", round(pv, 4))

    d = p("ex07_anova_outlets.csv")
    groups = [g.Delivery_min.values for _, g in d.groupby("Outlet")]
    r = stats.f_oneway(*groups)
    sds = d.groupby("Outlet").Delivery_min.std()
    print("ex07 F", round(r.statistic, 4), "p", f"{r.pvalue:.2e}", "SD ratio", round(sds.max() / sds.min(), 3))

    d = p("ex08_chisq_segment.csv")
    tab = pd.crosstab(d.Segment, d.Payment)
    chi2, pv, dof, exp = stats.chi2_contingency(tab, correction=False)
    print("ex08 chi2", round(chi2, 3), "df", dof, "p", f"{pv:.2e}", "min E", round(exp.min(), 3),
          "cells E<5", int((exp < 5).sum()))

    d = p("ex09_regression_promo.csv")
    r = stats.linregress(d.Promo_spend, d.Orders)
    print("ex09 r", round(r.rvalue, 4), "slope", round(r.slope, 3), "intercept", round(r.intercept, 3),
          "p", f"{r.pvalue:.2e}")


def main() -> None:
    OUT.mkdir(exist_ok=True)
    rng = np.random.default_rng(SEED)
    write(ex01(rng), "ex01_describe_delivery.csv")
    write(ex02(rng), "ex02_ci_basket.csv")
    write(ex03(rng), "ex03_onesample_waiting.csv")
    shutil.copyfile(ROOT / "C3_basket_by_channel.csv", OUT / "ex04_twosample_channel.csv")
    write(ex05(rng), "ex05_paired_promo.csv")
    write(ex06(rng), "ex06_twoprop_banner.csv")
    write(ex07(rng), "ex07_anova_outlets.csv")
    write(ex08(rng), "ex08_chisq_segment.csv")
    write(ex09(rng), "ex09_regression_promo.csv")
    print(f"wrote 9 files to {OUT.relative_to(ROOT)}")
    if "--check" in sys.argv:
        check()


if __name__ == "__main__":
    main()
