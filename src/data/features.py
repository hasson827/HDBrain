import numpy as np
import pandas as pd


def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1 = np.radians(lat1)
    phi2 = np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2) ** 2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return R * c


def _nearest_mrt_distance(lat, lng, mrt_df):
    dists = haversine(lat, lng, mrt_df["lat"].values, mrt_df["lng"].values)
    return dists.min()


def engineer_features(df: pd.DataFrame, coords: pd.DataFrame, mrt_df: pd.DataFrame,
                      cbd=(1.283933, 103.852222)) -> pd.DataFrame:
    df = df.copy()

    # Ensure string index keys
    coords = coords.copy()
    coords.index = coords.index.set_levels(coords.index.levels[0].astype(str), level=0)
    coords.index = coords.index.set_levels(coords.index.levels[1].astype(str), level=1)

    df["block"] = df["block"].astype(str)
    df["street_name"] = df["street_name"].astype(str)

    df = df.join(coords, on=["block", "street_name"], how="left")

    # Fallback for missing coords: use CBD coordinates to avoid breakage
    df["lat"] = df["lat"].fillna(cbd[0])
    df["lng"] = df["lng"].fillna(cbd[1])

    df["dist_to_cbd_km"] = df.apply(
        lambda r: haversine(r["lat"], r["lng"], cbd[0], cbd[1]), axis=1
    )
    df["dist_to_mrt_km"] = df.apply(
        lambda r: _nearest_mrt_distance(r["lat"], r["lng"], mrt_df), axis=1
    )

    # Temporal features
    df["transaction_year"] = df["month"].dt.year
    df["transaction_month"] = df["month"].dt.month

    # Lagged median price by town + flat_type (no leakage: use previous months only)
    df = df.sort_values("month").reset_index(drop=True)
    df["year_month"] = df["month"].dt.to_period("M")

    monthly_median = (
        df.groupby(["town", "flat_type", "year_month"])["resale_price"]
        .median()
        .rename("_monthly_median")
    )
    # shift by one month within each town/flat_type group
    lagged = monthly_median.groupby(level=[0, 1]).shift(1)
    rolling_lag6 = lagged.groupby(level=[0, 1]).rolling(window=6, min_periods=1).median()
    # rolling creates a MultiIndex with group levels duplicated; keep only last level
    rolling_lag6 = rolling_lag6.reset_index(level=[0, 1], drop=True).rename("town_flattype_lag6_median")

    df = df.merge(rolling_lag6, on=["town", "flat_type", "year_month"], how="left")
    return df
