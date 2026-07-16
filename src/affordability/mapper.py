"""Map affordability across town / flat_type / storey_range combinations."""

import math
from pathlib import Path
import sys
from typing import Optional

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.affordability.calculator import affordability_metrics
from src.affordability.user_profile import BuyerProfile
from src.models import load_data, get_feature_columns

MODEL_PATH = ROOT / "models" / "xgboost_model.joblib"
GROUP_COLS = ["town", "flat_type", "storey_range_code"]


def _aggregate_dummies(df: pd.DataFrame, prefix: str) -> pd.Series:
    """For one-hot encoded columns, pick the category with the highest mean."""
    cols = [c for c in df.columns if c.startswith(prefix)]
    if not cols:
        return pd.Series(np.nan, index=df.index)
    return df[cols].idxmax(axis=1)


def build_representative_profiles(df: pd.DataFrame, current_year: Optional[int] = None) -> pd.DataFrame:
    """Aggregate the full dataset into representative (town, flat_type, storey) profiles.

    Numeric features are median-valued; one-hot region/model dummies collapse to the
    most common category per group.  The snapshot uses the latest year in the data
    and June for the cyclical month features.
    """
    if current_year is None:
        current_year = int(df["year"].max())

    numeric_cols = [
        "flat_type_code",
        "floor_area_sqm",
        "remaining_lease",
        "school_dist",
        "hawker_dist",
        "park_dist",
        "mall_dist",
        "mrt_dist",
        "supermarket_dist",
        "dist_dhoby",
        "num_school_2km",
        "num_hawker_2km",
        "num_park_2km",
        "num_mall_2km",
        "num_mrt_2km",
        "num_supermarket_2km",
    ]

    agg = {}
    for col in numeric_cols:
        if col in df.columns:
            agg[col] = "median"

    # Region/model dummies: take the most common category per group
    region_cols = [c for c in df.columns if c.startswith("region_")]
    model_cols = [c for c in df.columns if c.startswith("model_")]
    if region_cols:
        agg.update({c: "max" for c in region_cols})
    if model_cols:
        agg.update({c: "max" for c in model_cols})

    grouped = df.groupby(GROUP_COLS).agg(agg).reset_index()

    # Fill in snapshot time features
    grouped["year"] = current_year
    grouped["month_sin"] = math.sin(2 * math.pi * 6 / 12)
    grouped["month_cos"] = math.cos(2 * math.pi * 6 / 12)

    return grouped


def predict_prices(profile_df: pd.DataFrame, model) -> np.ndarray:
    """Predict price for representative profiles using the point model."""
    feature_cols = list(getattr(model, "feature_names_in_", []))
    if not feature_cols:
        feature_cols = get_feature_columns(profile_df)
    return model.predict(profile_df[feature_cols])


def affordability_map(profile: BuyerProfile, model=None, df=None) -> pd.DataFrame:
    """Return a DataFrame of affordability metrics for every town/flat_type/storey group."""
    if df is None:
        df, _ = load_data()
    if model is None:
        model = joblib.load(MODEL_PATH)

    rep = build_representative_profiles(df)
    rep["predicted_price"] = predict_prices(rep, model)

    metrics = rep["predicted_price"].apply(lambda p: affordability_metrics(p, profile))
    metrics_df = pd.DataFrame(metrics.tolist())
    metrics_df = metrics_df.rename(columns={"price": "predicted_price"})
    result = pd.concat([rep[GROUP_COLS].reset_index(drop=True), metrics_df], axis=1)
    return result


def most_affordable_groups(result_df: pd.DataFrame, top_n: int = 10) -> pd.DataFrame:
    """Return the groups with the smallest affordability gap (or largest surplus)."""
    return result_df.nsmallest(top_n, "affordability_gap")[
        GROUP_COLS + ["predicted_price", "monthly_payment", "pti", "affordable", "affordability_gap"]
    ]


def save_map(result_df: pd.DataFrame, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    result_df.to_csv(path, index=False)
    print(f"Saved affordability map to {path}")
