from datetime import date


def age_in_days(birth_date: date, on: date) -> int:
    return (on - birth_date).days


def weeks_and_days(total_days: int) -> tuple[int, int]:
    return total_days // 7, total_days % 7
