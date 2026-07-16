"""
Baseline model: median resale price by town and flat type.

This represents the "agent's rule of thumb" and is used to quantify how much
ML improves over a simple grouping strategy.
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
    """Compute median real_price by (town, flat_type)."""
    return train_df.groupby(["town", "flat_type"])["real_price"].median().reset_index()


def predict(baseline_df, X):
    """Merge baseline medians onto X; fallback to global median if unseen group."""
    baseline_renamed = baseline_df.rename(columns={"real_price": "predicted_price"})
    merged = X.merge(baseline_renamed, on=["town", "flat_type"], how="left")
    global_median = baseline_df["real_price"].median()
    merged["predicted_price"] = merged["predicted_price"].fillna(global_median)
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
