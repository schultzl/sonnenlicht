"""Feeding reference table lookup. Pure functions — the web layer loads
the CSV once at startup and passes the table in.

These are general guideline ranges (typically printed on formula
packaging); breastfed babies usually feed on demand rather than to a
fixed volume."""

import csv
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

_INT_FIELDS = ("week_from", "week_to", "meals_min", "meals_max", "volume_min_ml", "volume_max_ml")


def load_feeding_guide(path: Path | None = None) -> list[dict]:
    path = path or DATA_DIR / "feeding_guide.csv"
    with open(path, newline="", encoding="utf-8") as f:
        rows = [dict(r) for r in csv.DictReader(f)]
    for row in rows:
        for field in _INT_FIELDS:
            row[field] = int(row[field])
    return rows


def bracket_for_week(table: list[dict], week: int) -> dict:
    """Return the bracket containing `week`, clamped to the last bracket for
    older children."""
    for row in table:
        if row["week_from"] <= week <= row["week_to"]:
            return row
    return table[-1]
