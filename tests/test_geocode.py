import pandas as pd
from pathlib import Path
from src.data.geocode import build_address_cache, TOWN_CENTROIDS


def test_build_address_cache_fallback(tmp_path):
    df = pd.DataFrame({
        "block": ["123"],
        "street_name": ["ANG MO KIO AVE 3"],
        "town": ["ANG MO KIO"],
    })
    cache = tmp_path / "block_coords.csv"
    out = build_address_cache(df, cache, town_centroids=TOWN_CENTROIDS, use_api=False)
    assert len(out) == 1
    assert "lat" in out.columns and "lng" in out.columns
    # When API is disabled, coordinates should equal town centroid
    key = ("123", "ANG MO KIO AVE 3")
    assert out.loc[key, "lat"] == TOWN_CENTROIDS["ANG MO KIO"][0]
    assert out.loc[key, "lng"] == TOWN_CENTROIDS["ANG MO KIO"][1]
    assert cache.exists()


def test_build_address_cache_loads_existing(tmp_path):
    df = pd.DataFrame({
        "block": ["123"],
        "street_name": ["ANG MO KIO AVE 3"],
        "town": ["ANG MO KIO"],
    })
    cache = tmp_path / "block_coords.csv"
    cache.write_text("block,street_name,lat,lng\n123,ANG MO KIO AVE 3,1.5,104.0\n")
    out = build_address_cache(df, cache, town_centroids=TOWN_CENTROIDS)
    assert out.loc[("123", "ANG MO KIO AVE 3"), "lat"] == 1.5
