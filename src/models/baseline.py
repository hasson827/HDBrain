"""
Baseline model: area-proportional unit price by town and flat type.

This represents the "agent's rule of thumb" — estimate a representative
price per square metre for each (town, flat_type), then scale by the
subject flat's floor area.  Used to quantify how much ML improves over
a simple grouping strategy.
"""

from pathlib import Path
import sys

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.models import load_data
from src.models.metrics import compute_metrics, save_metrics

OUTPUT_DIR = ROOT / "outputs"
MODEL_DIR = ROOT / "models"
MODEL_NAME = "baseline"


def train(train_df):
    """Compute area-adjusted unit price by (town, flat_type).

    Instead of a flat median price per group, we estimate the representative
    price per square metre.  Prediction is then unit_price * floor_area_sqm,
    which respects the intuition that larger flats in the same town/flat_type
    should cost proportionally more.
    """
    grouped = (
        train_df.groupby(["town", "flat_type"])
        .agg(total_price=("real_price", "sum"), total_area=("floor_area_sqm", "sum"))
        .reset_index()
    )
    grouped["unit_price"] = grouped["total_price"] / grouped["total_area"]
    return grouped[["town", "flat_type", "unit_price"]]


def predict(baseline_df, X):
    """Predict price = unit_price * floor_area_sqm; fallback to global unit price."""
    merged = X.merge(baseline_df, on=["town", "flat_type"], how="left")
    global_unit_price = baseline_df["unit_price"].mean()
    merged["unit_price"] = merged["unit_price"].fillna(global_unit_price)
    merged["predicted_price"] = merged["unit_price"] * merged["floor_area_sqm"]
    return merged["predicted_price"].values


def main():
    train_df, test_df = load_data()
    baseline_df = train(train_df)

    # Evaluate
    y_train = train_df["real_price"].values
    y_test = test_df["real_price"].values
    pred_train = predict(baseline_df, train_df)
    pred_test = predict(baseline_df, test_df)

    metrics = {
        "model": MODEL_NAME,
        "train": compute_metrics(y_train, pred_train),
        "test": compute_metrics(y_test, pred_test),
    }
    save_metrics(metrics, MODEL_NAME, OUTPUT_DIR)

    # Save model artifact
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(baseline_df, MODEL_DIR / f"{MODEL_NAME}_model.joblib")
    print(f"Saved model to {MODEL_DIR / MODEL_NAME}_model.joblib")


if __name__ == "__main__":
    main()
