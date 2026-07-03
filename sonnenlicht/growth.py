"""WHO weight-for-age LMS math (birth to 5 years, per-day tables).

Uses the plain LMS formulas. WHO's official z-score computation flattens
values beyond ±3 SD; readings that far out are reported as-is here — the
app is informational and extreme values belong at the pediatrician's.
"""

import csv
import math
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

# z cut-offs of the named percentile curves drawn in the chart
PERCENTILE_Z = {
    "p3": -1.880794,
    "p15": -1.036433,
    "p50": 0.0,
    "p85": 1.036433,
    "p97": 1.880794,
}


def load_lms(sex: str) -> list[tuple[float, float, float]]:
    """Return (L, M, S) per day of age, list index == day. `sex` is 'm' or 'f'."""
    name = "wfa_boys_lms.csv" if sex == "m" else "wfa_girls_lms.csv"
    table = []
    with open(DATA_DIR / name, newline="") as f:
        for row in csv.DictReader(f):
            assert int(row["day"]) == len(table), "LMS table must be contiguous by day"
            table.append((float(row["L"]), float(row["M"]), float(row["S"])))
    return table


def value_for_z(lms: tuple[float, float, float], z: float) -> float:
    """Weight in kg at the given z-score."""
    L, M, S = lms
    return M * (1 + L * S * z) ** (1 / L)


def z_for_weight(lms: tuple[float, float, float], weight_kg: float) -> float:
    L, M, S = lms
    return ((weight_kg / M) ** L - 1) / (L * S)


def percentile_from_z(z: float) -> float:
    return 50 * (1 + math.erf(z / math.sqrt(2)))


def assess_weight(table: list, age_days: int, weight_grams: int) -> dict | None:
    """z-score and percentile of a measurement, or None if the age is outside
    the table (> 5 years)."""
    if not 0 <= age_days < len(table):
        return None
    z = z_for_weight(table[age_days], weight_grams / 1000)
    return {"z": round(z, 2), "percentile": round(percentile_from_z(z), 1)}


def curve_points(table: list, to_week: int) -> list[dict]:
    """Weekly percentile-curve values in kg, weeks 0..to_week (clamped to the
    table's range)."""
    max_week = (len(table) - 1) // 7
    points = []
    for week in range(min(to_week, max_week) + 1):
        lms = table[week * 7]
        point = {"week": week}
        for key, z in PERCENTILE_Z.items():
            point[key] = round(value_for_z(lms, z), 3)
        points.append(point)
    return points
