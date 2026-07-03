import pytest

from sonnenlicht import growth

# Reference values straight from the WHO weight-for-age expanded tables
# (M column = median weight in kg; SD2 column = weight at z=+2).
BOYS_DAY0_MEDIAN = 3.3464
BOYS_DAY0_SD2 = 4.419
GIRLS_DAY0_MEDIAN = 3.2322


@pytest.fixture(scope="module")
def boys():
    return growth.load_lms("m")


@pytest.fixture(scope="module")
def girls():
    return growth.load_lms("f")


def test_tables_cover_five_years(boys, girls):
    assert len(boys) == 1857
    assert len(girls) == 1857


def test_median_at_birth(boys, girls):
    assert growth.value_for_z(boys[0], 0) == pytest.approx(BOYS_DAY0_MEDIAN, abs=1e-4)
    assert growth.value_for_z(girls[0], 0) == pytest.approx(GIRLS_DAY0_MEDIAN, abs=1e-4)


def test_value_for_z_matches_who_sd_column(boys):
    assert growth.value_for_z(boys[0], 2) == pytest.approx(BOYS_DAY0_SD2, abs=1e-3)


def test_z_roundtrip(boys):
    weight = growth.value_for_z(boys[100], 1.5)
    assert growth.z_for_weight(boys[100], weight) == pytest.approx(1.5, abs=1e-9)


def test_percentile_from_z():
    assert growth.percentile_from_z(0) == pytest.approx(50)
    assert growth.percentile_from_z(-1.880794) == pytest.approx(3, abs=0.01)
    assert growth.percentile_from_z(1.880794) == pytest.approx(97, abs=0.01)


def test_assess_weight(boys):
    median_birth = growth.assess_weight(boys, 0, 3346)
    assert median_birth["percentile"] == pytest.approx(50, abs=0.5)
    assert growth.assess_weight(boys, 3000, 15000) is None
    assert growth.assess_weight(boys, -1, 3000) is None


def test_curve_points(boys):
    points = growth.curve_points(boys, 12)
    assert len(points) == 13
    assert points[0]["week"] == 0
    assert points[0]["p50"] == pytest.approx(BOYS_DAY0_MEDIAN, abs=1e-3)
    for p in points:
        assert p["p3"] < p["p15"] < p["p50"] < p["p85"] < p["p97"]
    # clamping beyond the table's 5-year range
    assert growth.curve_points(boys, 10_000)[-1]["week"] == 265
