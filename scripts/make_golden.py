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


def main() -> None:
    GOLDEN.mkdir(parents=True, exist_ok=True)
    out = GOLDEN / "fingerprint.json"
    out.write_text(json.dumps(fingerprint_cases(), indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
