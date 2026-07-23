import pytest

from sonnenlicht.feeding import bracket_for_week, load_feeding_guide


@pytest.fixture(scope="module")
def table():
    return load_feeding_guide()


def test_table_is_contiguous_from_birth(table):
    assert table[0]["week_from"] == 0
    for prev, cur in zip(table, table[1:]):
        assert cur["week_from"] == prev["week_to"] + 1


def test_bracket_edges(table):
    assert bracket_for_week(table, 0)["week_from"] == 0
    assert bracket_for_week(table, 1)["week_from"] == 1
    assert bracket_for_week(table, 5)["week_from"] == 4


def test_clamps_beyond_table_end(table):
    assert bracket_for_week(table, 500) == table[-1]


def test_volume_and_meal_ranges_are_valid(table):
    for row in table:
        assert 0 < row["meals_min"] <= row["meals_max"]
        assert 0 < row["volume_min_ml"] <= row["volume_max_ml"]
