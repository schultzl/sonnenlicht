"""Sleep/wake reference table lookup. Pure functions — the web layer loads
the CSV once at startup and passes the table in."""

import csv
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

_INT_FIELDS = (
    "week_from",
    "week_to",
    "total_sleep_min_h",
    "total_sleep_max_h",
    "wake_window_min",
    "wake_window_max",
    "nap_length_min",
    "nap_length_max",
)


def load_sleep_table(path: Path | None = None) -> list[dict]:
    path = path or DATA_DIR / "sleep_phases.csv"
    with open(path, newline="", encoding="utf-8") as f:
        rows = [dict(r) for r in csv.DictReader(f)]
    for row in rows:
        for field in _INT_FIELDS:
            row[field] = int(row[field])
    return rows


def bracket_for_week(table: list[dict], week: int) -> dict:
    """Return the bracket containing `week`, clamped to the last bracket for
    older children (the table currently ends at week 104)."""
    for row in table:
        if row["week_from"] <= week <= row["week_to"]:
            return row
    return table[-1]
