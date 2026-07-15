import pandas as pd
from src.data.features import engineer_features, haversine


def test_haversine():
    # ~1.1 km between two close points
    d = haversine(1.35, 103.85, 1.36, 103.85)
    assert 1.0 < d < 1.2


def test_engineer_features():
    df = pd.DataFrame({
        "month": pd.to_datetime(["2017-01", "2017-02", "2017-03"]),
        "town": ["ANG MO KIO", "ANG MO KIO", "ANG MO KIO"],
        "flat_type": ["3 ROOM", "3 ROOM", "3 ROOM"],
        "block": ["123", "123", "123"],
        "street_name": ["ANG MO KIO AVE 3", "ANG MO KIO AVE 3", "ANG MO KIO AVE 3"],
        "storey_range": ["01 TO 03", "04 TO 06", "07 TO 09"],
        "storey_mid": [2.0, 5.0, 8.0],
        "floor_area_sqm": [60.0, 60.0, 60.0],
        "flat_model": ["NEW GENERATION", "NEW GENERATION", "NEW GENERATION"],
        "lease_commence_date": [1978, 1978, 1978],
        "remaining_lease_months": [700, 700, 700],
        "flat_age": [39, 39, 39],
        "resale_price": [300000, 310000, 320000],
    })
    coords = pd.DataFrame({
        "block": ["123"],
        "street_name": ["ANG MO KIO AVE 3"],
        "lat": [1.3691],
        "lng": [103.8454],
    }).set_index(["block", "street_name"])
    mrt = pd.DataFrame({
        "station_name": ["ANG MO KIO"],
        "lat": [1.3700],
        "lng": [103.8500],
    })
    out = engineer_features(df, coords, mrt)
    assert "dist_to_mrt_km" in out.columns
    assert "dist_to_cbd_km" in out.columns
    assert "town_flattype_lag6_median" in out.columns
    # No leakage: first row should not have lag feature (no prior month)
    assert pd.isna(out.iloc[0]["town_flattype_lag6_median"])
