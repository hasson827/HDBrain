"""
SHAP interpretability analysis for the champion XGBoost model.

Reads:
  - outputs/xgboost_model.joblib
  - data/hdb_dataset.csv

Produces:
  - outputs/shap_summary.png
  - outputs/shap_bar.png
  - outputs/shap_waterfall_*.png (individual predictions)
  - outputs/shap_feature_importance.csv
"""

from pathlib import Path
import sys

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.models import load_data, get_feature_columns

OUTPUT_DIR = ROOT / "outputs"
MODEL_DIR = ROOT / "models"
MODEL_PATH = MODEL_DIR / "xgboost_model.joblib"
N_SAMPLE = 2000  # subsample for SHAP summary to keep runtime reasonable


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading model and data...")
    model = joblib.load(MODEL_PATH)
    train_df, test_df = load_data()
    feature_cols = get_feature_columns(train_df)

    X_train = train_df[feature_cols]
    X_test = test_df[feature_cols]

    # Use TreeSHAP
    print("Computing SHAP values...")
    explainer = shap.TreeExplainer(model)

    # Global summary on a subsample of test set
    sample_df = X_test.sample(n=min(N_SAMPLE, len(X_test)), random_state=42)
    shap_values = explainer.shap_values(sample_df)

    # SHAP summary plot (beeswarm)
    plt.figure(figsize=(10, 8))
    shap.summary_plot(shap_values, sample_df, show=False)
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "shap_summary.png", dpi=150)
    print(f"Saved {OUTPUT_DIR / 'shap_summary.png'}")
    plt.close()

    # SHAP bar plot (mean absolute SHAP value)
    plt.figure(figsize=(10, 8))
    shap.summary_plot(shap_values, sample_df, plot_type="bar", show=False)
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "shap_bar.png", dpi=150)
    print(f"Saved {OUTPUT_DIR / 'shap_bar.png'}")
    plt.close()

    # Save feature importance as CSV
    importance = pd.DataFrame({
        "feature": sample_df.columns,
        "mean_abs_shap": np.mean(np.abs(shap_values), axis=0),
    }).sort_values("mean_abs_shap", ascending=False)
    importance.to_csv(OUTPUT_DIR / "shap_feature_importance.csv", index=False)
    print(f"Saved {OUTPUT_DIR / 'shap_feature_importance.csv'}")
    print(importance.head(15).to_string(index=False))

    # Waterfall plots for a few individual predictions
    print("\nGenerating waterfall plots for individual predictions...")
    for idx in X_test.index[:3]:
        x = X_test.loc[idx:idx]
        sv = explainer.shap_values(x)[0]
        plt.figure(figsize=(12, 6))
        shap.waterfall_plot(shap.Explanation(
            values=sv,
            base_values=explainer.expected_value,
            data=x.iloc[0],
            feature_names=feature_cols,
        ), show=False)
        plt.tight_layout()
        fname = OUTPUT_DIR / f"shap_waterfall_{idx}.png"
        plt.savefig(fname, dpi=150)
        print(f"Saved {fname}")
        plt.close()

    print("\nSHAP analysis complete.")


if __name__ == "__main__":
    main()
