"""Approximate 'Wonder Weeks' developmental-leap (Entwicklungssprung) windows.

Leaps track gestational/corrected age, not age since birth, so they're
calculated from the due date (ET / Entbindungstermin) — this keeps the
commonly published week numbers meaningful for babies born early or late.
Pure lookup, no I/O; mirrors the age/sleep/feeding modules in this package.
"""

from datetime import date

LEAPS = [
    {"number": 1, "name": "Wahrnehmungssprung", "week": 5},
    {"number": 2, "name": "Sprung der Muster", "week": 8},
    {"number": 3, "name": "Sprung der Übergänge", "week": 12},
    {"number": 4, "name": "Sprung der Ereignisse", "week": 19},
    {"number": 5, "name": "Sprung der Beziehungen", "week": 26},
    {"number": 6, "name": "Sprung der Kategorien", "week": 37},
    {"number": 7, "name": "Sprung der Reihenfolgen", "week": 46},
    {"number": 8, "name": "Sprung der Programme", "week": 55},
    {"number": 9, "name": "Sprung der Prinzipien", "week": 64},
    {"number": 10, "name": "Sprung der Systeme", "week": 75},
]

# Each leap's fussy window: starts ~1 week before the marked week, tapers off
# a few days after.
_WINDOW_BEFORE_DAYS = 7
_WINDOW_AFTER_DAYS = 4


def active_leap(due_date: date, on: date) -> dict | None:
    """The leap `on` likely falls in, based on corrected age since
    `due_date`, or None if no leap window is currently active."""
    corrected_days = (on - due_date).days
    for leap in LEAPS:
        center_days = leap["week"] * 7
        if center_days - _WINDOW_BEFORE_DAYS <= corrected_days <= center_days + _WINDOW_AFTER_DAYS:
            return dict(leap)
    return None
