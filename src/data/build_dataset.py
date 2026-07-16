"""
Build a clean, numeric-only ML dataset from the preprocessed transaction file.

Input:  data/processed/hdb_resale_model_dataset.csv
Output: data/hdb_dataset.csv

Run with the HDBrain conda environment:
    python src/data/build_dataset.py
"""

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
INPUT_PATH = ROOT / "data" / "processed" / "hdb_resale_model_dataset.csv"
OUTPUT_PATH = ROOT / "data" / "hdb_dataset.csv"

FLAT_TYPE_ORDER = [
    "1 ROOM", "2 ROOM", "3 ROOM", "4 ROOM", "5 ROOM", "EXECUTIVE", "MULTI GENERATION"
]
STOREY_ORDER = [
    "01 TO 03", "01 TO 05", "04 TO 06", "06 TO 10", "07 TO 09", "10 TO 12",
    "11 TO 15", "13 TO 15", "16 TO 18", "16 TO 20", "19 TO 21", "21 TO 25",
    "22 TO 24", "25 TO 27", "26 TO 30", "28 TO 30", "31 TO 33", "31 TO 35",
    "34 TO 36", "36 TO 40", "37 TO 39", "40 TO 42", "43 TO 45", "46 TO 48", "49 TO 51",
]
REGION_MAP = {
    "ANG MO KIO": "North East", "BEDOK": "East", "BISHAN": "Central",
    "BUKIT BATOK": "West", "BUKIT MERAH": "Central", "BUKIT PANJANG": "West",
    "BUKIT TIMAH": "Central", "CENTRAL AREA": "Central", "CHOA CHU KANG": "West",
    "CLEMENTI": "West", "GEYLANG": "Central", "HOUGANG": "North East",
    "JURONG EAST": "West", "JURONG WEST": "West", "KALLANG/WHAMPOA": "Central",
    "MARINE PARADE": "Central", "PASIR RIS": "East", "PUNGGOL": "North East",
    "QUEENSTOWN": "Central", "SEMBAWANG": "North", "SENGKANG": "North East",
    "SERANGOON": "North East", "TAMPINES": "East", "TOA PAYOH": "Central",
    "WOODLANDS": "North", "YISHUN": "North", "LIM CHU KANG": "North",
}
MODEL_MAP = {
    "Model A": "Model A", "Simplified": "Model A", "Model A2": "Model A",
    "Standard": "Standard", "Improved": "Standard", "2-room": "Standard",
    "New Generation": "New Generation",
    "Apartment": "Apartment", "Premium Apartment": "Apartment",
    "Premium Apartment Loft": "Apartment", "APARTMENT": "Apartment",
    "Maisonette": "Maisonette", "Executive Maisonette": "Maisonette",
    "Special": "Special", "Terrace": "Special",
    "Adjoined flat": "Special", "Type S1S2": "Special",
    "Type S1": "Special", "Type S2": "Special",
    "DBSS": "Special", "3Gen": "Special", "Multi Generation": "Special",
}


def build_dataset():
    df = pd.read_csv(INPUT_PATH)
    df["month"] = pd.to_datetime(df["month"])

    # --- time features ---
    df["month_sin"] = np.sin(2 * np.pi * df["month"].dt.month / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"].dt.month / 12)

    # --- categorical encodings ---
    df["flat_type_code"] = df["flat_type"].map({k: i for i, k in enumerate(FLAT_TYPE_ORDER)})
    df["storey_range_code"] = df["storey_range"].map({k: i for i, k in enumerate(STOREY_ORDER)})

    df["region"] = df["town"].map(REGION_MAP)
    df = pd.get_dummies(df, columns=["region"], prefix="region")

    df["flat_model_group"] = df["flat_model"].map(MODEL_MAP).fillna("Special")
    df = pd.get_dummies(df, columns=["flat_model_group"], prefix="model")

    # --- remaining lease ---
    df["remaining_lease"] = df.apply(
        lambda r: r["remaining_lease"] if pd.notna(r["remaining_lease"])
        else 99 - (r["year"] - r["lease_commence_date"]),
        axis=1,
    )

    # --- fill missing amenity values by town median ---
    dist_cols = [
        "school_dist", "hawker_dist", "park_dist", "mall_dist", "mrt_dist",
        "supermarket_dist", "dist_dhoby",
    ]
    count_cols = [c for c in df.columns if c.startswith("num_")]
    amenity_cols = dist_cols + count_cols
    for col in amenity_cols:
        df[col] = df.groupby("town")[col].transform(lambda x: x.fillna(x.median()))

    # --- select final numeric columns ---
    feature_cols = (
        ["year", "month_sin", "month_cos"]
        + ["flat_type_code", "storey_range_code", "floor_area_sqm", "remaining_lease"]
        + [c for c in df.columns if c.startswith("region_")]
        + [c for c in df.columns if c.startswith("model_")]
        + amenity_cols
    )

    # keep metadata columns for baseline grouping, but they are NOT model features
    metadata_cols = ["town", "flat_type"]

    out = df[metadata_cols + feature_cols + ["real_price"]].copy()

    # drop baseline columns to avoid collinearity
    baseline_to_drop = ["region_Central", "model_Standard"]
    out = out.drop(columns=[c for c in baseline_to_drop if c in out.columns])

    # ensure no missing values remain
    if out.isna().any().any():
        raise ValueError(f"Remaining NaNs:\n{out.isna().sum()[out.isna().sum() > 0]}")

    return out


def main():
    print("Building ML dataset from preprocessed file...")
    dataset = build_dataset()
    dataset.to_csv(OUTPUT_PATH, index=False)
    print(f"Saved {OUTPUT_PATH}: {dataset.shape}")
    print("Columns:")
    for c in dataset.columns:
        print(f"  {c}")


if __name__ == "__main__":
    main()
