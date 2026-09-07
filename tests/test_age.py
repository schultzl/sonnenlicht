from datetime import date

from sonnenlicht.age import age_in_days, months_and_days, weeks_and_days


def test_age_in_days():
    assert age_in_days(date(2026, 1, 1), date(2026, 1, 1)) == 0
    assert age_in_days(date(2026, 1, 1), date(2026, 1, 8)) == 7
    assert age_in_days(date(2026, 1, 1), date(2026, 3, 1)) == 59


def test_weeks_and_days():
    assert weeks_and_days(0) == (0, 0)
    assert weeks_and_days(6) == (0, 6)
    assert weeks_and_days(7) == (1, 0)
    assert weeks_and_days(100) == (14, 2)


def test_months_and_days():
    assert months_and_days(date(2026, 1, 1), date(2026, 1, 1)) == (0, 0)
    assert months_and_days(date(2026, 1, 1), date(2026, 1, 31)) == (0, 30)
    assert months_and_days(date(2026, 1, 1), date(2026, 2, 1)) == (1, 0)
    assert months_and_days(date(2026, 1, 15), date(2026, 2, 1)) == (0, 17)
    assert months_and_days(date(2026, 1, 1), date(2027, 1, 1)) == (12, 0)


def test_months_and_days_month_end_overflow():
    # Born on the 31st; a month later, that day doesn't exist in February.
    assert months_and_days(date(2026, 1, 31), date(2026, 2, 28)) == (1, 0)
    assert months_and_days(date(2026, 1, 31), date(2026, 3, 2)) == (1, 2)
