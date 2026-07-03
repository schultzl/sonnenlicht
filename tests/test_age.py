from datetime import date

from sonnenlicht.age import age_in_days, weeks_and_days


def test_age_in_days():
    assert age_in_days(date(2026, 1, 1), date(2026, 1, 1)) == 0
    assert age_in_days(date(2026, 1, 1), date(2026, 1, 8)) == 7
    assert age_in_days(date(2026, 1, 1), date(2026, 3, 1)) == 59


def test_weeks_and_days():
    assert weeks_and_days(0) == (0, 0)
    assert weeks_and_days(6) == (0, 6)
    assert weeks_and_days(7) == (1, 0)
    assert weeks_and_days(100) == (14, 2)
