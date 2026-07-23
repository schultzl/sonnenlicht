"""Developmental milestone reference table lookup. Pure functions — the web
layer loads the CSV once at startup and passes the table in."""

import csv
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

_INT_FIELDS = ("week_from", "week_to")


def load_milestones(path: Path | None = None) -> list[dict]:
    path = path or DATA_DIR / "milestones.csv"
    with open(path, newline="", encoding="utf-8") as f:
        rows = [dict(r) for r in csv.DictReader(f)]
    for row in rows:
        for field in _INT_FIELDS:
            row[field] = int(row[field])
    return rows


def relevant_for_week(table: list[dict], week: int) -> list[dict]:
    """Milestones whose typical window includes `week`."""
    return [row for row in table if row["week_from"] <= week <= row["week_to"]]
