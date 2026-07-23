import pytest

from sonnenlicht.milestones import load_milestones, relevant_for_week


@pytest.fixture(scope="module")
def table():
    return load_milestones()


def test_keys_are_unique(table):
    keys = [row["key"] for row in table]
    assert len(keys) == len(set(keys))


def test_categories_are_known(table):
    assert {row["category"] for row in table} <= {"Sozial", "Motorik"}


def test_week_ranges_are_valid(table):
    for row in table:
        assert 0 <= row["week_from"] <= row["week_to"]


def test_relevant_for_week_filters_by_window(table):
    relevant = relevant_for_week(table, 10)
    assert relevant
    assert all(row["week_from"] <= 10 <= row["week_to"] for row in relevant)
    assert all(row not in relevant for row in table if row["week_to"] < 10)


def test_relevant_for_week_empty_beyond_table(table):
    assert relevant_for_week(table, 1000) == []
