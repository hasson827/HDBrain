"""
Export precomputed JSON data for the HDBrain static frontend (web/).

This is the one-time bridge between the trained models / training data and the
frontend, per README_XCH.md §7.6 / §8 S1. It never trains anything; it only reads
existing artifacts and writes flat JSON files the browser can fetch directly.

Reads:
  - models/xgboost_model.joblib, models/quantile_model.joblib
  - data/hdb_dataset.csv (via src.models.load_data)
  - data/processed/hdb_resale_model_dataset.csv (real transaction records, for comparables)
  - data/raw/flat_coordinates_clean.csv (town centroid coordinates)
  - outputs/*_metrics.json, outputs/quantile_metrics.csv, outputs/ablation_results.csv,
    outputs/shap_feature_importance.csv

Writes to web/static/data/:
  grid_valuation.json, shap_local.json, lease_curves.json,
  town_index.json, arena.json, comparables.json, town_meta.json

Run with the HDBrain conda environment:
    python src/export_frontend_data.py
"""

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.affordability.mapper import build_representative_profiles
from src.data.build_dataset import REGION_MAP, STOREY_ORDER
from src.models import get_feature_columns, load_data

MODEL_DIR = ROOT / "models"
OUTPUT_DIR = ROOT / "outputs"
DATA_DIR = ROOT / "data"
WEB_DATA_DIR = ROOT / "web" / "static" / "data"

STOREY_LABELS = {i: label for i, label in enumerate(STOREY_ORDER)}
LEASE_MIN, LEASE_MAX = 30, 99
COMPARABLES_PER_GROUP = 20
RANDOM_STATE = 42

AMENITY_DIST_COLS = [
    "school_dist", "hawker_dist", "park_dist",
    "mall_dist", "mrt_dist", "supermarket_dist", "dist_dhoby",
]


def file_hash(path: Path, chunk_size: int = 1 << 20) -> str:
    """Short sha256 of a file's contents, used as a data-provenance fingerprint."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(chunk_size):
            h.update(chunk)
    return h.hexdigest()[:12]


def make_meta(**kwargs) -> dict:
    meta = {"generated_at": datetime.now(timezone.utc).isoformat()}
    meta.update(kwargs)
    return meta


def write_json(name: str, payload: dict) -> None:
    WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = WEB_DATA_DIR / name
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  wrote {name}: {path.stat().st_size / 1024:.1f} KB")


def export_grid_valuation(rep: pd.DataFrame, xgb_hash: str, quantile_hash: str, current_year: int) -> None:
    rows = []
    for _, r in rep.iterrows():
        code = int(r["storey_range_code"])
        rows.append({
            "town": r["town"],
            "flat_type": r["flat_type"],
            "storey_range_code": code,
            "storey_range": STOREY_LABELS.get(code, "UNKNOWN"),
            "floor_area_sqm": round(float(r["floor_area_sqm"]), 1),
            "remaining_lease": round(float(r["remaining_lease"]), 1),
            "predicted_price": round(float(r["predicted_price"]), 0),
            "q05": round(float(r["q05"]), 0),
            "q50": round(float(r["q50"]), 0),
            "q95": round(float(r["q95"]), 0),
        })
    write_json("grid_valuation.json", {
        "_meta": make_meta(
            model_file="xgboost_model.joblib", model_hash=xgb_hash,
            quantile_model_file="quantile_model.joblib", quantile_model_hash=quantile_hash,
            n_rows=len(rows), current_year=current_year,
        ),
        "rows": rows,
    })


def export_shap_local(rep: pd.DataFrame, feature_cols: list, xgb_model, xgb_hash: str) -> None:
    print("  computing SHAP values for the representative grid (TreeExplainer)...")
    explainer = shap.TreeExplainer(xgb_model)
    shap_values = explainer.shap_values(rep[feature_cols])

    rows = []
    for i, (_, r) in enumerate(rep.iterrows()):
        pairs = sorted(zip(feature_cols, shap_values[i]), key=lambda kv: -abs(kv[1]))[:6]
        rows.append({
            "town": r["town"],
            "flat_type": r["flat_type"],
            "storey_range_code": int(r["storey_range_code"]),
            "top_features": [
                {"feature": f, "value_sgd": round(float(v), 0)} for f, v in pairs
            ],
        })
    write_json("shap_local.json", {
        "_meta": make_meta(model_file="xgboost_model.joblib", model_hash=xgb_hash, n_rows=len(rows)),
        "rows": rows,
    })


def export_lease_curves(rep: pd.DataFrame, feature_cols: list, xgb_model, quantile_model, xgb_hash: str) -> None:
    """For each (town, flat_type), pick the representative row whose storey is closest
    to the group's median storey, then sweep remaining_lease from LEASE_MAX down to
    LEASE_MIN holding every other feature fixed at that row's values."""
    print("  building lease-decay curves (town x flat_type, remaining_lease sweep)...")
    curves = []
    for (town, flat_type), group in rep.groupby(["town", "flat_type"]):
        median_storey = group["storey_range_code"].median()
        pick_idx = (group["storey_range_code"] - median_storey).abs().idxmin()
        base_row = group.loc[pick_idx].copy()

        sweep = pd.concat([base_row.to_frame().T] * (LEASE_MAX - LEASE_MIN + 1), ignore_index=True)
        leases = list(range(LEASE_MAX, LEASE_MIN - 1, -1))
        sweep["remaining_lease"] = leases
        sweep[feature_cols] = sweep[feature_cols].apply(pd.to_numeric)

        point = xgb_model.predict(sweep[feature_cols])
        q_preds = quantile_model.predict(sweep[feature_cols])

        curves.append({
            "town": town,
            "flat_type": flat_type,
            "storey_range_code": int(base_row["storey_range_code"]),
            "remaining_lease": leases,
            "predicted_price": [round(float(v), 0) for v in point],
            "q05": [round(float(v), 0) for v in q_preds[:, 0]],
            "q95": [round(float(v), 0) for v in q_preds[:, 2]],
        })

    write_json("lease_curves.json", {
        "_meta": make_meta(model_file="xgboost_model.joblib", model_hash=xgb_hash,
                            n_rows=len(curves), lease_range=[LEASE_MIN, LEASE_MAX]),
        "rows": curves,
    })


def export_town_index() -> None:
    """Town x month median real_price series, from the processed wide table (has
    calendar month + town + real_price, unlike the numeric-only hdb_dataset.csv)."""
    print("  aggregating town x month price series from processed wide table...")
    wide = pd.read_csv(
        DATA_DIR / "processed" / "hdb_resale_model_dataset.csv",
        usecols=["month", "town", "real_price"],
    )
    wide["month"] = pd.to_datetime(wide["month"])
    wide = wide[wide["month"] >= "2015-01-01"]

    monthly = (
        wide.groupby(["town", pd.Grouper(key="month", freq="MS")])["real_price"]
        .median()
        .reset_index()
    )

    series = {}
    for town, g in monthly.groupby("town"):
        g = g.sort_values("month")
        series[town] = {
            "months": g["month"].dt.strftime("%Y-%m").tolist(),
            "median_real_price": [round(float(v), 0) for v in g["real_price"]],
        }

    write_json("town_index.json", {
        "_meta": make_meta(source="data/processed/hdb_resale_model_dataset.csv",
                            since="2015-01", n_towns=len(series)),
        "towns": series,
    })


def export_arena() -> None:
    print("  bundling model comparison, ablation, and SHAP global metrics...")
    model_files = [
        "baseline_metrics.json", "linear_regression_metrics.json", "lasso_regression_metrics.json",
        "ridge_regression_metrics.json", "random_forest_metrics.json", "xgboost_metrics.json",
    ]
    models = []
    for fname in model_files:
        with open(OUTPUT_DIR / fname, encoding="utf-8") as f:
            models.append(json.load(f))

    quantile_metrics = pd.read_csv(OUTPUT_DIR / "quantile_metrics.csv").to_dict(orient="records")
    ablation = pd.read_csv(OUTPUT_DIR / "ablation_results.csv").to_dict(orient="records")
    shap_global = (
        pd.read_csv(OUTPUT_DIR / "shap_feature_importance.csv")
        .head(10)
        .to_dict(orient="records")
    )

    write_json("arena.json", {
        "_meta": make_meta(
            source="outputs/*_metrics.json, quantile_metrics.csv, ablation_results.csv, shap_feature_importance.csv",
        ),
        "models": models,
        "quantile_metrics": quantile_metrics,
        "ablation": ablation,
        "shap_global_top10": shap_global,
    })


def export_comparables() -> None:
    print("  sampling recent real transactions per (town, flat_type)...")
    wide = pd.read_csv(
        DATA_DIR / "processed" / "hdb_resale_model_dataset.csv",
        usecols=["month", "town", "flat_type", "storey_range", "floor_area_sqm",
                 "remaining_lease", "flat", "resale_price"],
    )
    wide["month"] = pd.to_datetime(wide["month"])
    cutoff = wide["month"].max() - pd.DateOffset(months=12)
    recent = wide[wide["month"] > cutoff]

    groups = {}
    for (town, flat_type), g in recent.groupby(["town", "flat_type"]):
        sample = g.sample(n=min(COMPARABLES_PER_GROUP, len(g)), random_state=RANDOM_STATE)
        sample = sample.sort_values("month", ascending=False)
        key = f"{town}|{flat_type}"
        groups[key] = [
            {
                "month": row["month"].strftime("%Y-%m"),
                "flat": row["flat"],
                "storey_range": row["storey_range"],
                "floor_area_sqm": round(float(row["floor_area_sqm"]), 1),
                "remaining_lease": round(float(row["remaining_lease"]), 1),
                "resale_price": round(float(row["resale_price"]), 0),
            }
            for _, row in sample.iterrows()
        ]

    write_json("comparables.json", {
        "_meta": make_meta(
            source="data/processed/hdb_resale_model_dataset.csv",
            window_months=12, max_per_group=COMPARABLES_PER_GROUP, n_groups=len(groups),
        ),
        "groups": groups,
    })


def export_town_meta(train_df: pd.DataFrame) -> None:
    print("  computing town centroids and median amenity distances...")
    coords = pd.read_csv(DATA_DIR / "raw" / "flat_coordinates_clean.csv")
    wide_flats = pd.read_csv(
        DATA_DIR / "processed" / "hdb_resale_model_dataset.csv",
        usecols=["town", "flat"],
    ).drop_duplicates()
    joined = wide_flats.merge(coords, left_on="flat", right_on="address", how="inner")
    centroids = joined.groupby("town")[["LATITUDE", "LONGITUDE"]].median()

    amenity_medians = train_df.groupby("town")[AMENITY_DIST_COLS].median()
    counts = train_df.groupby("town").size()

    towns = {}
    for town in sorted(train_df["town"].unique()):
        entry = {
            "region": REGION_MAP.get(town, "Unknown"),
            "n_transactions": int(counts.get(town, 0)),
            "median_amenity_dist": {
                col: round(float(amenity_medians.loc[town, col]), 0)
                for col in AMENITY_DIST_COLS
            } if town in amenity_medians.index else None,
        }
        if town in centroids.index:
            entry["lat"] = round(float(centroids.loc[town, "LATITUDE"]), 5)
            entry["lon"] = round(float(centroids.loc[town, "LONGITUDE"]), 5)
        else:
            entry["lat"] = None
            entry["lon"] = None
        towns[town] = entry

    n_missing_coords = sum(1 for t in towns.values() if t["lat"] is None)
    write_json("town_meta.json", {
        "_meta": make_meta(
            source="data/hdb_dataset.csv + data/raw/flat_coordinates_clean.csv",
            n_towns=len(towns), n_missing_coords=n_missing_coords,
            note="Coordinates are town centroids (median of matched flat addresses), "
                 "not exact polygon boundaries. Map SVG itself is an S2 deliverable.",
        ),
        "towns": towns,
    })


def main():
    print("Loading models...")
    xgb_model = joblib.load(MODEL_DIR / "xgboost_model.joblib")
    quantile_model = joblib.load(MODEL_DIR / "quantile_model.joblib")
    xgb_hash = file_hash(MODEL_DIR / "xgboost_model.joblib")
    quantile_hash = file_hash(MODEL_DIR / "quantile_model.joblib")

    print("Loading training data...")
    train_df, _ = load_data()
    current_year = int(train_df["year"].max())

    print("Building representative profiles (town x flat_type x storey_range_code)...")
    rep = build_representative_profiles(train_df, current_year=current_year)
    feature_cols = list(getattr(xgb_model, "feature_names_in_", get_feature_columns(rep)))
    rep["predicted_price"] = xgb_model.predict(rep[feature_cols])
    q_preds = quantile_model.predict(rep[feature_cols])
    rep["q05"], rep["q50"], rep["q95"] = q_preds[:, 0], q_preds[:, 1], q_preds[:, 2]

    print("\nExporting JSON files to web/static/data/ ...")
    export_grid_valuation(rep, xgb_hash, quantile_hash, current_year)
    export_shap_local(rep, feature_cols, xgb_model, xgb_hash)
    export_lease_curves(rep, feature_cols, xgb_model, quantile_model, xgb_hash)
    export_town_index()
    export_arena()
    export_comparables()
    export_town_meta(train_df)

    print("\nExport complete.")


if __name__ == "__main__":
    main()
