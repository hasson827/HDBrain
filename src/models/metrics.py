"""Model evaluation metrics."""

import json
from pathlib import Path

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


def compute_metrics(y_true, y_pred):
    """Return RMSE, MAE, R^2, MAPE."""
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    mse = mean_squared_error(y_true, y_pred)
    rmse = float(np.sqrt(mse))
    mae = float(mean_absolute_error(y_true, y_pred))
    r2 = float(r2_score(y_true, y_pred))
    mape = float(np.median(np.abs((y_true - y_pred) / y_true)) * 100)
    return {
        "rmse": rmse,
        "mae": mae,
        "r2": r2,
        "mape": mape,
    }


def save_metrics(metrics: dict, model_name: str, output_dir: Path):
    """Save metrics dict to outputs/{model_name}_metrics.json."""
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"{model_name}_metrics.json"
    with open(path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved metrics to {path}")
