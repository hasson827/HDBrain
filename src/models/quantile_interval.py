"""
Quantile regression with XGBoost for prediction intervals.

Trains a single XGBoost model with objective='reg:quantileerror' for multiple
quantiles.  The 5%-95% outputs form a 90% prediction interval.

Reads:
  - data/hdb_dataset.csv

Writes:
  - models/quantile_model.joblib
  - outputs/quantile_metrics.csv
  - outputs/quantile_intervals.png
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

OUTPUT_DIR = ROOT / "outputs"
MODEL_DIR = ROOT / "models"
MODEL_NAME = "quantile"

# Lower, median, upper quantiles
QUANTILES = [0.05, 0.5, 0.95]
QUANTILE_NAMES = ["q05", "q50", "q95"]


def pinball_loss(y_true, y_pred, q):
    """Pinball / quantile loss for a single quantile."""
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    residual = y_true - y_pred
    return float(np.mean(np.maximum(q * residual, (q - 1) * residual)))


def train_quantile_model(X_train, y_train, X_test, y_test):
    model = XGBRegressor(
        objective="reg:quantileerror",
        quantile_alpha=QUANTILES,
        n_estimators=500,
        learning_rate=0.05,
        max_depth=8,
        subsample=0.8,
        colsample_bytree=0.8,
        n_jobs=-1,
        random_state=42,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )
    return model


def evaluate_intervals(y_true, preds_df):
    """Compute coverage, average width, and pinball losses."""
    lower = preds_df["q05"].values
    upper = preds_df["q95"].values
    y = np.asarray(y_true)

    coverage = float(np.mean((y >= lower) & (y <= upper)))
    avg_width = float(np.mean(upper - lower))
    median_width = float(np.median(upper - lower))

    metrics = {
        "coverage_90": coverage,
        "avg_width": avg_width,
        "median_width": median_width,
    }
    for q, name in zip(QUANTILES, QUANTILE_NAMES):
        metrics[f"pinball_{name}"] = pinball_loss(y, preds_df[name].values, q)
    return metrics


def plot_intervals(y_true, preds_df, n_sample=1000):
    """Plot actual prices vs sorted prediction intervals."""
    y = np.asarray(y_true)
    sample_idx = np.random.choice(len(y), size=min(n_sample, len(y)), replace=False)
    y_s = y[sample_idx]
    lower = preds_df["q05"].values[sample_idx]
    upper = preds_df["q95"].values[sample_idx]
    median = preds_df["q50"].values[sample_idx]

    sort_idx = np.argsort(y_s)
    y_s = y_s[sort_idx]
    lower = lower[sort_idx]
    upper = upper[sort_idx]
    median = median[sort_idx]

    plt.figure(figsize=(12, 6))
    x = np.arange(len(y_s))
    plt.fill_between(x, lower, upper, alpha=0.3, label="90% prediction interval")
    plt.plot(x, median, color="tab:blue", linewidth=0.8, label="Median prediction")
    plt.scatter(x, y_s, s=8, color="black", alpha=0.5, label="Actual")
    plt.xlabel("Sample (sorted by actual price)")
    plt.ylabel("Real price (SGD)")
    plt.title("XGBoost Quantile Regression: 90% Prediction Intervals")
    plt.legend()
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "quantile_intervals.png", dpi=150)
    print(f"Saved {OUTPUT_DIR / 'quantile_intervals.png'}")
    plt.close()


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading data...")
    train_df, test_df = load_data()
    feature_cols = get_feature_columns(train_df)

    X_train, y_train = train_df[feature_cols], train_df["real_price"]
    X_test, y_test = test_df[feature_cols], test_df["real_price"]

    print(f"Training quantile model for {QUANTILES}...")
    model = train_quantile_model(X_train, y_train, X_test, y_test)

    # Predictions
    train_pred = model.predict(X_train)
    test_pred = model.predict(X_test)

    train_preds_df = pd.DataFrame(train_pred, columns=QUANTILE_NAMES)
    test_preds_df = pd.DataFrame(test_pred, columns=QUANTILE_NAMES)

    train_metrics = evaluate_intervals(y_train, train_preds_df)
    test_metrics = evaluate_intervals(y_test, test_preds_df)

    summary = pd.DataFrame({
        "split": ["train", "test"],
        "coverage_90": [train_metrics["coverage_90"], test_metrics["coverage_90"]],
        "avg_width": [train_metrics["avg_width"], test_metrics["avg_width"]],
        "median_width": [train_metrics["median_width"], test_metrics["median_width"]],
        "pinball_q05": [train_metrics["pinball_q05"], test_metrics["pinball_q05"]],
        "pinball_q50": [train_metrics["pinball_q50"], test_metrics["pinball_q50"]],
        "pinball_q95": [train_metrics["pinball_q95"], test_metrics["pinball_q95"]],
    })
    summary.to_csv(OUTPUT_DIR / "quantile_metrics.csv", index=False)
    print(f"\nSaved {OUTPUT_DIR / 'quantile_metrics.csv'}")
    print(summary.to_string(index=False))

    # Save model
    joblib.dump(model, MODEL_DIR / f"{MODEL_NAME}_model.joblib")
    print(f"Saved model to {MODEL_DIR / MODEL_NAME}_model.joblib")

    # Plot test intervals
    plot_intervals(y_test, test_preds_df)


if __name__ == "__main__":
    main()
