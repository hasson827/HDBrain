"""
Visualise model comparison metrics (Model Arena).

Reads outputs/*_metrics.json and produces:
- outputs/model_comparison_test.png (bar chart of test-set metrics)
- outputs/model_comparison.csv (summary table)
"""

import json
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "outputs"

METRIC_NAMES = ["rmse", "mae", "r2", "mape"]
METRIC_LABELS = {
    "rmse": "RMSE (SGD)",
    "mae": "MAE (SGD)",
    "r2": "R²",
    "mape": "MAPE (%)",
}


def load_all_metrics():
    records = []
    for path in sorted(OUTPUT_DIR.glob("*_metrics.json")):
        with open(path) as f:
            data = json.load(f)
        row = {"model": data["model"]}
        for split in ["train", "test"]:
            for metric in METRIC_NAMES:
                row[f"{split}_{metric}"] = data[split][metric]
        records.append(row)
    return pd.DataFrame(records)


def plot_metrics(df):
    test_cols = [f"test_{m}" for m in METRIC_NAMES]
    plot_df = df.set_index("model")[test_cols]
    plot_df.columns = [METRIC_LABELS[m.replace("test_", "")] for m in plot_df.columns]

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    axes = axes.flatten()

    for idx, (metric, label) in enumerate(plot_df.items()):
        ax = axes[idx]
        colors = plt.cm.tab10(range(len(label)))
        label.sort_values(ascending=True if metric != "R²" else False).plot(
            kind="barh", ax=ax, color=colors
        )
        ax.set_title(f"Test Set: {metric}")
        ax.set_xlabel(metric)

    plt.tight_layout()
    fig.savefig(OUTPUT_DIR / "model_comparison_test.png", dpi=150)
    print(f"Saved plot to {OUTPUT_DIR / 'model_comparison_test.png'}")
    plt.close(fig)


def main():
    df = load_all_metrics()
    if df.empty:
        print(f"No metrics found in {OUTPUT_DIR}. Run model scripts first.")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_DIR / "model_comparison.csv", index=False)
    print(f"Saved summary to {OUTPUT_DIR / 'model_comparison.csv'}")
    print(df.to_string(index=False))

    plot_metrics(df)


if __name__ == "__main__":
    main()
