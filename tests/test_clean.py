import pandas as pd
from src.data.clean import parse_remaining_lease, parse_storey_range, clean_data


def test_parse_remaining_lease_years_months():
    assert parse_remaining_lease("62 years 06 months") == 62 * 12 + 6


def test_parse_remaining_lease_numeric():
    assert parse_remaining_lease(62) == 62 * 12


def test_parse_storey_range():
    assert parse_storey_range("10 TO 12") == 11


def test_clean_data_columns():
    df = pd.DataFrame({
        "month": ["2017-01"],
        "town": ["ANG MO KIO"],
        "flat_type": ["3 ROOM"],
        "block": ["123"],
        "street_name": ["ANG MO KIO AVE 3"],
        "storey_range": ["10 TO 12"],
        "floor_area_sqm": [60.0],
        "flat_model": ["New Generation"],
        "lease_commence_date": [1978],
        "remaining_lease": ["62 years 06 months"],
        "resale_price": [320000],
    })
    out = clean_data(df)
    assert "remaining_lease_months" in out.columns
    assert out["remaining_lease_months"].iloc[0] == 62 * 12 + 6
    assert out["storey_mid"].iloc[0] == 11
    assert out["flat_age"].iloc[0] == 2017 - 1978


def test_clean_data_missing_remaining_lease():
    df = pd.DataFrame({
        "month": ["2012-01"],
        "town": ["ANG MO KIO"],
        "flat_type": ["3 ROOM"],
        "block": ["123"],
        "street_name": ["ANG MO KIO AVE 3"],
        "storey_range": ["01 TO 03"],
        "floor_area_sqm": [60.0],
        "flat_model": ["New Generation"],
        "lease_commence_date": [1978],
        "remaining_lease": [pd.NA],
        "resale_price": [300000],
    })
    out = clean_data(df)
    # 99-year lease minus elapsed years (2012-1978 = 34)
    expected_months = (99 - 34) * 12
    assert out["remaining_lease_months"].iloc[0] == expected_months
