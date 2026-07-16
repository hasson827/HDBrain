"""Random Forest model."""

from pathlib import Path
import sys

import joblib
from sklearn.ensemble import RandomForestRegressor

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.models import load_data, get_feature_columns
from src.models.metrics import compute_metrics, save_metrics

OUTPUT_DIR = ROOT / "outputs"
MODEL_DIR = ROOT / "models"
MODEL_NAME = "random_forest"


def main():
    train_df, test_df = load_data()
    feature_cols = get_feature_columns(train_df)

    X_train, y_train = train_df[feature_cols], train_df["real_price"]
    X_test, y_test = test_df[feature_cols], test_df["real_price"]

    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=None,
        n_jobs=-1,
        random_state=42,
    )
    model.fit(X_train, y_train)

    pred_train = model.predict(X_train)
    pred_test = model.predict(X_test)

    metrics = {
        "model": MODEL_NAME,
        "train": compute_metrics(y_train, pred_train),
        "test": compute_metrics(y_test, pred_test),
    }
    save_metrics(metrics, MODEL_NAME, OUTPUT_DIR)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_DIR / f"{MODEL_NAME}_model.joblib")
    print(f"Saved model to {MODEL_DIR / MODEL_NAME}_model.joblib")


if __name__ == "__main__":
    main()
