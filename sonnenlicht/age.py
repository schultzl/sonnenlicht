import calendar
from datetime import date


def age_in_days(birth_date: date, on: date) -> int:
    return (on - birth_date).days


def weeks_and_days(total_days: int) -> tuple[int, int]:
    return total_days // 7, total_days % 7


def _add_months(base: date, months: int) -> date:
    month_index = base.month - 1 + months
    year = base.year + month_index // 12
    month = month_index % 12 + 1
    day = min(base.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def months_and_days(birth_date: date, on: date) -> tuple[int, int]:
    """Calendar-based age: whole months since `birth_date`, plus the days
    since the most recent month-anniversary. Handles month-end overflow
    (e.g. born on the 31st, current month only has 28-30 days) by clamping
    the anniversary to the last day of the short month rather than rolling
    over into the next one."""
    months = (on.year - birth_date.year) * 12 + (on.month - birth_date.month)
    anniversary = _add_months(birth_date, months)
    if on < anniversary:
        months -= 1
        anniversary = _add_months(birth_date, months)
    return months, (on - anniversary).days
