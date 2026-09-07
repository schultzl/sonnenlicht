from datetime import date, timedelta

from sonnenlicht.leaps import LEAPS, active_leap, leaps_overview, next_leap


def test_no_leap_between_windows():
    due = date(2026, 1, 1)
    assert active_leap(due, due) is None  # day 0, before leap 1's window


def test_leap_1_window():
    due = date(2026, 1, 1)
    leap = active_leap(due, due + timedelta(weeks=5))
    assert leap is not None
    assert leap["number"] == 1


def test_leap_detection_uses_due_date_not_birth_date():
    due = date(2026, 1, 1)
    on = due + timedelta(weeks=8)
    assert active_leap(due, on)["number"] == 2
    # Same calendar date relative to a different due date is unaffected.
    assert active_leap(due + timedelta(weeks=10), on) is None


def test_all_leaps_reachable():
    due = date(2026, 1, 1)
    found = {active_leap(due, due + timedelta(weeks=leap["week"]))["number"] for leap in LEAPS}
    assert found == {leap["number"] for leap in LEAPS}


def test_next_leap_between_windows():
    due = date(2026, 1, 1)
    # Corrected age 68 days: between leap 2's window (day 49-60) and leap
    # 3's (day 77-88).
    on = due + timedelta(days=68)
    assert active_leap(due, on) is None
    leap = next_leap(due, on)
    assert leap["number"] == 3
    assert leap["days_until"] == 77 - 68


def test_next_leap_none_after_last_window():
    due = date(2026, 1, 1)
    on = due + timedelta(weeks=100)
    assert active_leap(due, on) is None
    assert next_leap(due, on) is None


def test_leaps_overview_shape_and_order():
    overview = leaps_overview()
    assert [leap["number"] for leap in overview] == list(range(1, 11))
    for leap in overview:
        assert leap["week_from"] < leap["week_to"]
        assert leap["skills"]
        assert leap["name"]
