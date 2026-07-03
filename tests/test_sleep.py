import pytest

from sonnenlicht.sleep import bracket_for_week, load_sleep_table


@pytest.fixture(scope="module")
def table():
    return load_sleep_table()


def test_table_is_contiguous_from_birth(table):
    assert table[0]["week_from"] == 0
    for prev, cur in zip(table, table[1:]):
        assert cur["week_from"] == prev["week_to"] + 1


def test_bracket_edges(table):
    assert bracket_for_week(table, 0)["week_from"] == 0
    assert bracket_for_week(table, 3)["week_to"] == 3
    assert bracket_for_week(table, 4)["week_from"] == 4
    assert bracket_for_week(table, 52)["week_from"] == 39


def test_clamps_beyond_table_end(table):
    assert bracket_for_week(table, 500) == table[-1]


def test_nap_length_fields(table):
    for row in table:
        assert 0 < row["nap_length_min"] <= row["nap_length_max"]
