import pandas as pd
from src.data.load import load_raw_data


def test_load_raw_data_schema(tmp_path):
    raw = tmp_path / "raw"
    raw.mkdir()
    (raw / "a.csv").write_text(
        "month,town,flat_type,block,street_name,storey_range,floor_area_sqm,flat_model,lease_commence_date,resale_price\n"
        "2012-01,ANG MO KIO,3 ROOM,123,ANG MO KIO AVE 3,01 TO 03,60,New Generation,1978,300000\n"
    )
    (raw / "b.csv").write_text(
        "month,town,flat_type,block,street_name,storey_range,floor_area_sqm,flat_model,lease_commence_date,remaining_lease,resale_price\n"
        "2017-01,ANG MO KIO,3 ROOM,124,ANG MO KIO AVE 3,04 TO 06,60,New Generation,1978,62 years 06 months,320000\n"
    )
    df = load_raw_data(raw)
    assert set(df.columns) == {
        "month",
        "town",
        "flat_type",
        "block",
        "street_name",
        "storey_range",
        "floor_area_sqm",
        "flat_model",
        "lease_commence_date",
        "remaining_lease",
        "resale_price",
    }
    assert len(df) == 2
    # Row from schema without remaining_lease should have NA
    assert pd.isna(df.loc[df["block"] == "123", "remaining_lease"].iloc[0])
