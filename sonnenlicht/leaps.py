"""Approximate 'Wonder Weeks' developmental-leap (Entwicklungssprung) windows.

Leaps track gestational/corrected age, not age since birth, so they're
calculated from the due date (ET / Entbindungstermin) — this keeps the
commonly published week numbers meaningful for babies born early or late.
Pure lookup, no I/O; mirrors the age/sleep/feeding modules in this package.
"""

from datetime import date

LEAPS = [
    {
        "number": 1,
        "name": "Wahrnehmungssprung",
        "week": 5,
        "skills": "Nimmt Sinnesreize bewusster wahr (Sehen, Hören, Riechen) — wird leichter überreizt.",
    },
    {
        "number": 2,
        "name": "Sprung der Muster",
        "week": 8,
        "skills": "Erkennt einfache Muster und Wiederholungen; erste bewusstere Bewegungen.",
    },
    {
        "number": 3,
        "name": "Sprung der Übergänge",
        "week": 12,
        "skills": "Nimmt fließende Übergänge und Bewegungen wahr; verfolgt Dinge mit den Augen.",
    },
    {
        "number": 4,
        "name": "Sprung der Ereignisse",
        "week": 19,
        "skills": "Versteht einfache Abläufe und Ereignisse; greift gezielter nach Gegenständen.",
    },
    {
        "number": 5,
        "name": "Sprung der Beziehungen",
        "week": 26,
        "skills": "Begreift Beziehungen zwischen Dingen (nah/fern, innen/außen); Fremdeln beginnt oft.",
    },
    {
        "number": 6,
        "name": "Sprung der Kategorien",
        "week": 37,
        "skills": "Ordnet Dinge und Menschen in Kategorien ein; unterscheidet vertraut von fremd deutlicher.",
    },
    {
        "number": 7,
        "name": "Sprung der Reihenfolgen",
        "week": 46,
        "skills": "Versteht Handlungsabfolgen; ahmt Handlungen in der richtigen Reihenfolge nach.",
    },
    {
        "number": 8,
        "name": "Sprung der Programme",
        "week": 55,
        "skills": "Verfolgt eigene kleine Vorhaben zielgerichtet; probiert verschiedene Lösungswege aus.",
    },
    {
        "number": 9,
        "name": "Sprung der Prinzipien",
        "week": 64,
        "skills": "Erkennt Prinzipien wie Besitz und Konsequenzen; will Dinge zunehmend selbst tun.",
    },
    {
        "number": 10,
        "name": "Sprung der Systeme",
        "week": 75,
        "skills": "Versteht komplexere Zusammenhänge und soziale Rollen.",
    },
]

# Each leap's fussy window: starts ~1 week before the marked week, tapers off
# a few days after.
_WINDOW_BEFORE_DAYS = 7
_WINDOW_AFTER_DAYS = 4


def _window_days(leap: dict) -> tuple[int, int]:
    center_days = leap["week"] * 7
    return center_days - _WINDOW_BEFORE_DAYS, center_days + _WINDOW_AFTER_DAYS


def active_leap(due_date: date, on: date) -> dict | None:
    """The leap `on` likely falls in, based on corrected age since
    `due_date`, or None if no leap window is currently active."""
    corrected_days = (on - due_date).days
    for leap in LEAPS:
        start_days, end_days = _window_days(leap)
        if start_days <= corrected_days <= end_days:
            return dict(leap)
    return None


def next_leap(due_date: date, on: date) -> dict | None:
    """The next leap whose window hasn't started yet, with `days_until` its
    window opens, or None if every leap's window has already passed."""
    corrected_days = (on - due_date).days
    for leap in LEAPS:
        start_days, _ = _window_days(leap)
        if corrected_days < start_days:
            return {**leap, "days_until": start_days - corrected_days}
    return None


def leaps_overview() -> list[dict]:
    """The full leap reference table for display, with each leap's window
    expressed in whole weeks (from the due date)."""
    overview = []
    for leap in LEAPS:
        start_days, end_days = _window_days(leap)
        overview.append(
            {
                "number": leap["number"],
                "name": leap["name"],
                "skills": leap["skills"],
                "week_from": start_days // 7,
                "week_to": -(-end_days // 7),  # ceil division
            }
        )
    return overview
