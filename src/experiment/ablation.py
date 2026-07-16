"""
Feature ablation experiments for the XGBoost model.

Each ablation retrains XGBoost with one feature group removed and measures
relative performance drop versus the full model on the time-split test set.

Output:
  - outputs/ablation_results.csv
  - outputs/ablation_drop.csv
  - outputs/ablation_drop.png
"""

from pathlib import Path
import sys

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.models import load_data, get_feature_columns
from src.models.metrics import compute_metrics

OUTPUT_DIR = ROOT / "outputs"
MODEL_DIR = ROOT / "models"
MODEL_PATH = MODEL_DIR / "xgboost_model.joblib"

# Feature groups to ablate. Keys are group names; values are column prefix/suffix patterns.
GROUPS = {
    "location_raw": ["town"],  # will be ignored; town is not numeric
    "region": ["region_"],
    "flat_model": ["model_"],
    "flat_type": ["flat_type_code"],
    "storey": ["storey_range_code"],
    "floor_area": ["floor_area_sqm"],
    "lease": ["remaining_lease"],
    "month_cycle": ["month_sin", "month_cos"],
    "year": ["year"],
    "amenity_distance": ["_dist"],
    "amenity_count": ["num_"],
    "dist_dhoby": ["dist_dhoby"],
}


def belongs_to_group(col: str, patterns: list[str]) -> bool:
    """Return True if column matches any of the patterns."""
    for pat in patterns:
        if col.startswith(pat) or col.endswith(pat) or col == pat:
            return True
    return False


def get_columns_to_drop(feature_cols, patterns):
    return [c for c in feature_cols if belongs_to_group(c, patterns)]


def train_eval_xgboost(X_train, y_train, X_test, y_test, seed=42):
    """Train a fixed-configuration XGBoost and return test metrics."""
    model = XGBRegressor(
        n_estimators=500,
        learning_rate=0.05,
        max_depth=8,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="reg:squarederror",
        n_jobs=-1,
        random_state=seed,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    pred_test = model.predict(X_test)
    return compute_metrics(y_test, pred_test)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    train_df, test_df = load_data()
    feature_cols = get_feature_columns(train_df)
    y_train = train_df["real_price"]
    y_test = test_df["real_price"]

    # Full model metrics (reuse saved model predictions if available)
    print("Full model...")
    model = joblib.load(MODEL_PATH)
    full_pred = model.predict(test_df[feature_cols])
    full_metrics = compute_metrics(y_test, full_pred)
    print(full_metrics)

    records = []
    for group_name, patterns in GROUPS.items():
        drop_cols = get_columns_to_drop(feature_cols, patterns)
        if not drop_cols:
            print(f"Skipping {group_name}: no columns matched {patterns}")
            continue

        keep_cols = [c for c in feature_cols if c not in drop_cols]
        print(f"\nAblating '{group_name}' -> dropping {len(drop_cols)} columns")
        metrics = train_eval_xgboost(
            train_df[keep_cols], y_train, test_df[keep_cols], y_test
        )
        records.append({
            "ablation": group_name,
            "dropped_columns": len(drop_cols),
            "test_rmse": metrics["rmse"],
            "test_mae": metrics["mae"],
            "test_r2": metrics["r2"],
            "test_mape": metrics["mape"],
        })

    ablation_df = pd.DataFrame(records)

    # Compute relative drops
    ablation_df["rmse_drop"] = ablation_df["test_rmse"] - full_metrics["rmse"]
    ablation_df["r2_drop"] = full_metrics["r2"] - ablation_df["test_r2"]
    ablation_df["mape_increase"] = ablation_df["test_mape"] - full_metrics["mape"]

    # Sort by R² drop (larger = more important group)
    ablation_df = ablation_df.sort_values("r2_drop", ascending=False)

    ablation_df.to_csv(OUTPUT_DIR / "ablation_results.csv", index=False)
    print(f"\nSaved {OUTPUT_DIR / 'ablation_results.csv'}")
    print(ablation_df.to_string(index=False))

    # Summarize drops
    drop_cols = ["ablation", "rmse_drop", "r2_drop", "mape_increase"]
    drop_df = ablation_df[drop_cols].copy()
    drop_df.to_csv(OUTPUT_DIR / "ablation_drop.csv", index=False)

    # Plot R² drop
    plt.figure(figsize=(10, 6))
    colors = ["#d62728" if v > 0 else "#2ca02c" for v in drop_df["r2_drop"]]
    plt.barh(drop_df["ablation"], drop_df["r2_drop"], color=colors)
    plt.xlabel("R² drop (full - ablated)")
    plt.title("Feature Group Ablation: R² Drop on 2024 Test Set")
    plt.axvline(0, color="black", linewidth=0.8)
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "ablation_drop.png", dpi=150)
    print(f"Saved {OUTPUT_DIR / 'ablation_drop.png'}")
    plt.close()


if __name__ == "__main__":
    main()
