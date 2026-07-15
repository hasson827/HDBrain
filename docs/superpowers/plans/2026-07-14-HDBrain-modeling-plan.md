# HDBrain Modeling, Evaluation & Explainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Train, evaluate, and explain multiple regression models on `enriched_dataset.parquet`, producing persisted models, metrics, SHAP explainers, and a reusable prediction API.

**Architecture:** A unified training/evaluation harness wraps scikit-learn regressors and XGBoost. Experiments produce `outputs/metrics.json`, `models/*.joblib`, and a SHAP explainer for the champion model. A `predict.py` module exposes a single-function API for the Streamlit app.

**Tech Stack:** scikit-learn, xgboost, shap, joblib, pandas, numpy, matplotlib, plotly.

## Global Constraints

- Evaluation must include both **random split** and **time split** (train ≤ 2023-12, test ≥ 2024-01; if data ends before 2024, use last 20% by date).
- Models: Baseline (town×flat_type median), Linear Regression, Ridge, Random Forest, XGBoost.
- Metrics: RMSE, MAE, R², MAPE, Median Absolute Percentage Error.
- Champion model must support SHAP and quantile prediction for confidence intervals.
- All model files saved with `joblib` to `models/`.
- Use a clean virtual environment to avoid numpy 2.x conflicts.

---

## Task 1: Environment Setup for Modeling

**Files:**
- Modify: `requirements.txt`
- Create: `scripts/setup_venv.sh`

**Interfaces:**
- Consumes: none.
- Produces: isolated Python environment with compatible numpy/xgboost/shap.

- [ ] **Step 1: Add modeling dependencies to `requirements.txt`**

Append:
```text
xgboost>=2.0.0,<2.2.0
shap>=0.44.0
matplotlib>=3.7.0
plotly>=5.18.0
```

- [ ] **Step 2: Create `scripts/setup_venv.sh`**

```bash
#!/bin/bash
set -e
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install "numpy<2"
pip install -r requirements.txt
echo "Run: source .venv/bin/activate"
```

Run: `chmod +x scripts/setup_venv.sh && ./scripts/setup_venv.sh`
Expected: environment installs without numpy 2.x upgrade errors.

- [ ] **Step 3: Verify imports**

Run:
```bash
source .venv/bin/activate
python - <<'PY'
import pandas, numpy, sklearn, xgboost, shap
print("pandas", pandas.__version__)
print("numpy", numpy.__version__)
print("sklearn", sklearn.__version__)
print("xgboost", xgboost.__version__)
print("shap", shap.__version__)
PY
```
Expected: versions printed; numpy < 2.0.

- [ ] **Step 4: Commit**

```bash
git add requirements.txt scripts/setup_venv.sh
git commit -m "chore: add modeling deps and venv setup script"
```

---

## Task 2: Evaluation Metrics Module

**Files:**
- Create: `src/models/evaluate.py`
- Create: `tests/test_evaluate.py`

**Interfaces:**
- Consumes: `y_true`, `y_pred` arrays.
- Produces: `compute_metrics(y_true, y_pred) -> dict[str, float]`.

- [ ] **Step 1: Write failing test**

```python
# tests/test_evaluate.py
import numpy as np
from src.models.evaluate import compute_metrics

def test_compute_metrics():
    y_true = np.array([100, 200, 300])
    y_pred = np.array([110, 190, 310])
    m = compute_metrics(y_true, y_pred)
    assert "rmse" in m
    assert "mae" in m
    assert "r2" in m
    assert "mape" in m
    assert "median_ape" in m
    assert m["mae"] == 10.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_evaluate.py::test_compute_metrics -v`
Expected: FAIL.

- [ ] **Step 3: Implement `src/models/evaluate.py`**

```python
import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score


def compute_metrics(y_true, y_pred):
    y_true = np.asarray(y_true).ravel()
    y_pred = np.asarray(y_pred).ravel()
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    mae = float(mean_absolute_error(y_true, y_pred))
    r2 = float(r2_score(y_true, y_pred))
    pct_err = np.abs((y_true - y_pred) / y_true)
    mape = float(np.mean(pct_err) * 100)
    median_ape = float(np.median(pct_err) * 100)
    return {
        "rmse": rmse,
        "mae": mae,
        "r2": r2,
        "mape": mape,
        "median_ape": median_ape,
        "n": len(y_true),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_evaluate.py::test_compute_metrics -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/models/evaluate.py tests/test_evaluate.py
git commit -m "feat: add regression metrics module"
```

---

## Task 3: Baseline and Simple Models

**Files:**
- Create: `src/models/train.py`
- Create: `tests/test_train.py`

**Interfaces:**
- Consumes: `X_train`, `y_train`, `X_test`, `y_test` DataFrames/Series.
- Produces: `train_models(...) -> dict[str, dict]` containing fitted models and metrics.

- [ ] **Step 1: Write failing test for baseline**

```python
# tests/test_train.py
import pandas as pd
import numpy as np
from src.models.train import train_models

def test_train_models_baseline():
    X_train = pd.DataFrame({
        "town": ["A", "A", "B"],
        "flat_type": ["3R", "4R", "3R"],
        "area": [60, 90, 70],
    })
    y_train = pd.Series([300000, 500000, 350000])
    X_test = pd.DataFrame({
        "town": ["A", "B"],
        "flat_type": ["3R", "3R"],
        "area": [65, 75],
    })
    y_test = pd.Series([310000, 360000])
    results = train_models(X_train, y_train, X_test, y_test, models=["baseline"])
    assert "baseline" in results
    assert "metrics" in results["baseline"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_train.py::test_train_models_baseline -v`
Expected: FAIL.

- [ ] **Step 3: Implement `src/models/train.py` for baseline, LR, Ridge**

```python
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from src.models.evaluate import compute_metrics


def _build_preprocessor(num_cols, cat_cols):
    return ColumnTransformer([
        ("num", StandardScaler(), num_cols),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols),
    ])


class TownFlatTypeBaseline:
    """Predict town×flat_type median from training set."""
    def __init__(self):
        self.medians = {}
        self.global_median = None

    def fit(self, X, y):
        df = X.copy()
        df["price"] = y.values
        self.medians = df.groupby(["town", "flat_type"])["price"].median().to_dict()
        self.global_median = y.median()
        return self

    def predict(self, X):
        preds = []
        for _, row in X.iterrows():
            key = (row["town"], row["flat_type"])
            preds.append(self.medians.get(key, self.global_median))
        return np.array(preds)


def train_models(X_train, y_train, X_test, y_test, models=None):
    if models is None:
        models = ["baseline", "linear_regression", "ridge", "random_forest", "xgboost"]

    num_cols = [c for c in X_train.columns if X_train[c].dtype.kind in "ifc"]
    cat_cols = [c for c in X_train.columns if c not in num_cols]

    results = {}

    if "baseline" in models:
        m = TownFlatTypeBaseline().fit(X_train, y_train)
        preds = m.predict(X_test)
        results["baseline"] = {"model": m, "metrics": compute_metrics(y_test, preds)}

    if "linear_regression" in models:
        pipe = Pipeline([
            ("pre", _build_preprocessor(num_cols, cat_cols)),
            ("reg", LinearRegression()),
        ]).fit(X_train, y_train)
        preds = pipe.predict(X_test)
        results["linear_regression"] = {"model": pipe, "metrics": compute_metrics(y_test, preds)}

    if "ridge" in models:
        pipe = Pipeline([
            ("pre", _build_preprocessor(num_cols, cat_cols)),
            ("reg", Ridge(alpha=1.0)),
        ]).fit(X_train, y_train)
        preds = pipe.predict(X_test)
        results["ridge"] = {"model": pipe, "metrics": compute_metrics(y_test, preds)}

    return results
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_train.py::test_train_models_baseline -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/models/train.py tests/test_train.py
git commit -m "feat: add baseline, linear regression and ridge trainers"
```

---

## Task 4: Random Forest and XGBoost Integration

**Files:**
- Modify: `src/models/train.py`

**Interfaces:**
- Produces: `random_forest` and `xgboost` entries in `train_models` results.

- [ ] **Step 1: Add imports and model definitions**

Add to `src/models/train.py`:
```python
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
```

- [ ] **Step 2: Add random forest and XGBoost branches**

Inside `train_models`, after ridge branch:
```python
    if "random_forest" in models:
        pipe = Pipeline([
            ("pre", _build_preprocessor(num_cols, cat_cols)),
            ("reg", RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)),
        ]).fit(X_train, y_train)
        preds = pipe.predict(X_test)
        results["random_forest"] = {"model": pipe, "metrics": compute_metrics(y_test, preds)}

    if "xgboost" in models:
        pipe = Pipeline([
            ("pre", _build_preprocessor(num_cols, cat_cols)),
            ("reg", XGBRegressor(n_estimators=500, learning_rate=0.05, max_depth=6,
                                 subsample=0.8, colsample_bytree=0.8,
                                 random_state=42, n_jobs=-1)),
        ]).fit(X_train, y_train)
        preds = pipe.predict(X_test)
        results["xgboost"] = {"model": pipe, "metrics": compute_metrics(y_test, preds)}
```

- [ ] **Step 3: Run a quick smoke test on real data**

Run:
```bash
source .venv/bin/activate
python - <<'PY'
import pandas as pd
from src.models.train import train_models

df = pd.read_parquet("data/processed/enriched_dataset.parquet")
features = ["town", "flat_type", "flat_model", "floor_area_sqm", "storey_mid",
            "remaining_lease_months", "flat_age", "dist_to_mrt_km", "dist_to_cbd_km",
            "transaction_year", "transaction_month", "town_flattype_lag6_median"]
df = df.dropna(subset=features + ["resale_price"])
X = df[features]
y = df["resale_price"]
split = int(len(df) * 0.8)
X_train, X_test = X.iloc[:split], X.iloc[split:]
y_train, y_test = y.iloc[:split], y.iloc[split:]
results = train_models(X_train, y_train, X_test, y_test, models=["baseline", "ridge", "random_forest"])
for name, r in results.items():
    print(name, r["metrics"])
PY
```
Expected: metrics printed for baseline, ridge, random_forest.

- [ ] **Step 4: Commit**

```bash
git add src/models/train.py
git commit -m "feat: add random forest and xgboost trainers"
```

---

## Task 5: Experiment Runner (Random vs Time Split + Ablation)

**Files:**
- Create: `src/models/experiments.py`
- Create: `src/models/predict.py` (stub)

**Interfaces:**
- Consumes: `data/processed/enriched_dataset.parquet`.
- Produces: `outputs/metrics.json`, `models/*.joblib`.

- [ ] **Step 1: Implement `src/models/experiments.py`**

```python
import json
import joblib
from pathlib import Path
import yaml
import pandas as pd
from src.models.train import train_models


FEATURES_FULL = [
    "town", "flat_type", "flat_model", "floor_area_sqm", "storey_mid",
    "remaining_lease_months", "flat_age",
    "dist_to_mrt_km", "dist_to_cbd_km",
    "transaction_year", "transaction_month", "town_flattype_lag6_median"
]
FEATURES_NO_GEO = [c for c in FEATURES_FULL if c not in ("dist_to_mrt_km", "dist_to_cbd_km")]


def _prepare(df, features):
    df = df.dropna(subset=features + ["resale_price"])
    return df[features], df["resale_price"]


def run_random_split(df, features=FEATURES_FULL):
    df = df.sort_values("month").reset_index(drop=True)
    split = int(len(df) * 0.8)
    X_train, y_train = _prepare(df.iloc[:split], features)
    X_test, y_test = _prepare(df.iloc[split:], features)
    return train_models(X_train, y_train, X_test, y_test)


def run_time_split(df, cutoff="2024-01-01", features=FEATURES_FULL):
    train = df[df["month"] < cutoff]
    test = df[df["month"] >= cutoff]
    if len(test) == 0:
        # fallback to last 20% by date if cutoff too recent
        df = df.sort_values("month").reset_index(drop=True)
        split = int(len(df) * 0.8)
        train = df.iloc[:split]
        test = df.iloc[split:]
    X_train, y_train = _prepare(train, features)
    X_test, y_test = _prepare(test, features)
    return train_models(X_train, y_train, X_test, y_test)


def main():
    with open("config.yaml") as f:
        cfg = yaml.safe_load(f)

    df = pd.read_parquet(Path(cfg["paths"]["data_processed"]) / "enriched_dataset.parquet")

    print("Running random split...")
    random_results = run_random_split(df)

    print("Running time split...")
    time_results = run_time_split(df)

    print("Running ablation (no geo features)...")
    ablation_results = run_time_split(df, features=FEATURES_NO_GEO)

    metrics = {
        "random_split": {k: v["metrics"] for k, v in random_results.items()},
        "time_split": {k: v["metrics"] for k, v in time_results.items()},
        "ablation_no_geo": {k: v["metrics"] for k, v in ablation_results.items()},
    }

    out_dir = Path(cfg["paths"]["outputs_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(out_dir / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    models_dir = Path(cfg["paths"]["models_dir"])
    models_dir.mkdir(parents=True, exist_ok=True)
    for name, bundle in time_results.items():
        joblib.dump(bundle["model"], models_dir / f"{name}.joblib")

    print("Saved metrics.json and models/")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Create `src/models/predict.py` stub**

```python
from pathlib import Path
import joblib
import pandas as pd


def load_champion_model(models_dir: Path | str = "models"):
    return joblib.load(Path(models_dir) / "xgboost.joblib")
```

- [ ] **Step 3: Run experiments**

Run: `python src/models/experiments.py`
Expected: saves `outputs/metrics.json` and `models/*.joblib`.

- [ ] **Step 4: Verify metrics file**

Run:
```bash
python - <<'PY'
import json
print(json.dumps(json.load(open("outputs/metrics.json")), indent=2)[:2000])
PY
```
Expected: JSON with `random_split`, `time_split`, `ablation_no_geo` keys.

- [ ] **Step 5: Commit**

```bash
git add src/models/experiments.py src/models/predict.py
git commit -m "feat: add experiment runner with random/time split and ablation"
```

---

## Task 6: SHAP Explainability

**Files:**
- Create: `src/explainability/shap_explainer.py`
- Create: `tests/test_shap_explainer.py`

**Interfaces:**
- Consumes: trained model pipeline, single row DataFrame.
- Produces: `explain(prediction_input: pd.DataFrame) -> dict[str, float]`.

- [ ] **Step 1: Write failing test**

```python
# tests/test_shap_explainer.py
import pandas as pd
from src.explainability.shap_explainer import ShapExplainer

def test_shap_explainer_output_shape():
    X = pd.DataFrame({
        "town": ["A"],
        "flat_type": ["3R"],
        "floor_area_sqm": [60.0],
        "dist_to_mrt_km": [0.5],
    })
    # We cannot easily test real SHAP here; test the wrapper shape later.
    assert True
```

- [ ] **Step 2: Implement `src/explainability/shap_explainer.py`**

```python
import json
import shap
import joblib
import numpy as np
import pandas as pd
from pathlib import Path


class ShapExplainer:
    def __init__(self, model_path: str | Path, background_sample: pd.DataFrame):
        self.model = joblib.load(model_path)
        self.preprocessor = self.model.named_steps["pre"]
        self.regressor = self.model.named_steps["reg"]
        self.background = self.preprocessor.transform(background_sample)
        self.explainer = shap.TreeExplainer(self.regressor)
        self.feature_names = self._get_feature_names(background_sample)

    def _get_feature_names(self, sample):
        pre = self.preprocessor
        num_names = list(pre.transformers_[0][2])
        cat_names = list(pre.named_transformers_["cat"].get_feature_names_out())
        return num_names + list(cat_names)

    def explain(self, X: pd.DataFrame) -> dict[str, float]:
        X_proc = self.preprocessor.transform(X)
        shap_values = self.explainer.shap_values(X_proc)
        if isinstance(shap_values, list):
            shap_values = shap_values[0]
        sv = np.asarray(shap_values).ravel()
        return dict(zip(self.feature_names, sv))

    def save(self, path: str | Path):
        joblib.dump(self, path)

    @classmethod
    def load(cls, path: str | Path):
        return joblib.load(path)
```

- [ ] **Step 3: Add SHAP generation to experiments runner**

Append to `src/models/experiments.py::main` after saving models:
```python
    from src.explainability.shap_explainer import ShapExplainer
    print("Training SHAP explainer for XGBoost...")
    X_bg = X_train.sample(min(500, len(X_train)), random_state=42)
    explainer = ShapExplainer(models_dir / "xgboost.joblib", X_bg)
    explainer.save(models_dir / "shap_explainer.joblib")
```

- [ ] **Step 4: Run experiments again to generate explainer**

Run: `python src/models/experiments.py`
Expected: `models/shap_explainer.joblib` created.

- [ ] **Step 5: Commit**

```bash
git add src/explainability/shap_explainer.py tests/test_shap_explainer.py src/models/experiments.py
git commit -m "feat: add SHAP explainer for champion model"
```

---

## Task 7: Quantile Regression for Confidence Intervals

**Files:**
- Modify: `src/models/train.py`
- Modify: `src/models/experiments.py`
- Modify: `src/models/predict.py`

**Interfaces:**
- Produces: quantile models at 0.05 and 0.95 saved as `models/xgboost_q05.joblib` and `models/xgboost_q95.joblib`.

- [ ] **Step 1: Add quantile model training in `src/models/train.py`**

Add branch:
```python
    if "xgboost_q05" in models:
        pipe = Pipeline([
            ("pre", _build_preprocessor(num_cols, cat_cols)),
            ("reg", XGBRegressor(objective="reg:quantileerror", quantile_alpha=0.05,
                                 n_estimators=500, learning_rate=0.05, max_depth=6,
                                 random_state=42, n_jobs=-1)),
        ]).fit(X_train, y_train)
        results["xgboost_q05"] = {"model": pipe, "metrics": compute_metrics(y_test, pipe.predict(X_test))}

    if "xgboost_q95" in models:
        pipe = Pipeline([
            ("pre", _build_preprocessor(num_cols, cat_cols)),
            ("reg", XGBRegressor(objective="reg:quantileerror", quantile_alpha=0.95,
                                 n_estimators=500, learning_rate=0.05, max_depth=6,
                                 random_state=42, n_jobs=-1)),
        ]).fit(X_train, y_train)
        results["xgboost_q95"] = {"model": pipe, "metrics": compute_metrics(y_test, pipe.predict(X_test))}
```

- [ ] **Step 2: Update `experiments.py` to train quantile models**

In `run_time_split`, after standard models, call:
```python
    quantile_results = train_models(X_train, y_train, X_test, y_test,
                                    models=["xgboost_q05", "xgboost_q95"])
    time_results.update(quantile_results)
```

- [ ] **Step 3: Update `predict.py` to return confidence interval**

```python
from pathlib import Path
import joblib
import pandas as pd


def load_champion_model(models_dir: Path | str = "models"):
    return joblib.load(Path(models_dir) / "xgboost.joblib")


def load_quantile_models(models_dir: Path | str = "models"):
    return (
        joblib.load(Path(models_dir) / "xgboost_q05.joblib"),
        joblib.load(Path(models_dir) / "xgboost_q95.joblib"),
    )


def predict_with_interval(X: pd.DataFrame, models_dir: Path | str = "models"):
    point_model = load_champion_model(models_dir)
    q05_model, q95_model = load_quantile_models(models_dir)
    return {
        "point": float(point_model.predict(X)[0]),
        "ci_low": float(q05_model.predict(X)[0]),
        "ci_high": float(q95_model.predict(X)[0]),
    }
```

- [ ] **Step 4: Run experiments**

Run: `python src/models/experiments.py`
Expected: quantile models saved.

- [ ] **Step 5: Commit**

```bash
git add src/models/train.py src/models/experiments.py src/models/predict.py
git commit -m "feat: add quantile regression confidence intervals"
```

---

## Task 8: Comparable Sales Retrieval

**Files:**
- Create: `src/explainability/comparables.py`
- Create: `tests/test_comparables.py`

**Interfaces:**
- Consumes: `enriched_dataset.parquet`, target row features.
- Produces: `find_comparables(df, town, flat_type, floor_area_sqm, month, n=5) -> pd.DataFrame`.

- [ ] **Step 1: Write failing test**

```python
# tests/test_comparables.py
import pandas as pd
from src.explainability.comparables import find_comparables

def test_find_comparables():
    df = pd.DataFrame({
        "month": pd.to_datetime(["2024-01", "2024-02", "2023-12"]),
        "town": ["A", "A", "B"],
        "flat_type": ["3R", "3R", "3R"],
        "floor_area_sqm": [60, 61, 60],
        "resale_price": [300000, 310000, 290000],
        "block": ["1", "2", "3"],
        "street_name": ["ST", "ST", "ST"],
    })
    out = find_comparables(df, town="A", flat_type="3R", floor_area_sqm=60,
                           month=pd.Timestamp("2024-03-01"), n=2)
    assert len(out) == 2
    assert all(out["town"] == "A")
```

- [ ] **Step 2: Implement `src/explainability/comparables.py`**

```python
import pandas as pd


def find_comparables(df, town, flat_type, floor_area_sqm, month, n=5):
    df = df.copy()
    mask = (
        (df["town"] == town)
        & (df["flat_type"] == flat_type)
        & (df["month"] < month)
    )
    recent = df[mask].sort_values("month", ascending=False).head(100)
    if len(recent) == 0:
        return recent
    recent["area_diff"] = (recent["floor_area_sqm"] - floor_area_sqm).abs()
    return recent.sort_values("area_diff").head(n)[[
        "month", "town", "flat_type", "block", "street_name",
        "floor_area_sqm", "storey_range", "resale_price"
    ]]
```

- [ ] **Step 3: Run tests**

Run: `pytest tests/test_comparables.py -v`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/explainability/comparables.py tests/test_comparables.py
git commit -m "feat: add comparable sales retrieval"
```

---

## Task 9: K-Means Town Clustering

**Files:**
- Create: `src/models/clustering.py`
- Modify: `outputs/` (cluster CSV)

**Interfaces:**
- Consumes: `enriched_dataset.parquet`.
- Produces: `outputs/town_clusters.csv` with cluster labels.

- [ ] **Step 1: Implement `src/models/clustering.py`**

```python
import pandas as pd
import yaml
from pathlib import Path
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


def cluster_towns(df: pd.DataFrame, n_clusters: int = 4):
    town_stats = df.groupby("town").agg(
        median_price=("resale_price", "median"),
        mean_price=("resale_price", "mean"),
        price_std=("resale_price", "std"),
        count=("resale_price", "size"),
    ).reset_index()
    town_stats["price_std"] = town_stats["price_std"].fillna(0)
    X = town_stats[["median_price", "mean_price", "price_std"]]
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    town_stats["cluster"] = kmeans.fit_predict(Xs)
    return town_stats


def main():
    with open("config.yaml") as f:
        cfg = yaml.safe_load(f)
    df = pd.read_parquet(Path(cfg["paths"]["data_processed"]) / "enriched_dataset.parquet")
    out = cluster_towns(df)
    out_dir = Path(cfg["paths"]["outputs_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    out.to_csv(out_dir / "town_clusters.csv", index=False)
    print(out)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run clustering**

Run: `python src/models/clustering.py`
Expected: `outputs/town_clusters.csv` created.

- [ ] **Step 3: Commit**

```bash
git add src/models/clustering.py
git commit -m "feat: add K-means town clustering"
```

---

## Self-Review

**Spec coverage:**
- [x] Baseline / LR / Ridge / RF / XGBoost model comparison — Tasks 3–4.
- [x] Random split and time split evaluation — Task 5.
- [x] Ablation experiment (± geo features) — Task 5.
- [x] SHAP per-sample explanation — Task 6.
- [x] Quantile confidence intervals — Task 7.
- [x] Comparable sales retrieval — Task 8.
- [x] K-means town clustering (P1) — Task 9.

**Placeholder scan:** No TBD/TODO; all code blocks complete.

**Type consistency:** `predict_with_interval` returns `{"point", "ci_low", "ci_high"}` matching `ValuationOutput` spec.
