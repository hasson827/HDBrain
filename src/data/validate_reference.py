"""
Validate processed outputs in data/processed/ against the reference repository.

Run from project root:
    python src/data/validate_reference.py
"""

from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]
REF_DIR = PROJECT_ROOT / "reference" / "HDB_Resale_Prices" / "Data"
OUT_DIR = PROJECT_ROOT / "data" / "processed"


def compare_amenity_files() -> dict:
    """Compare flat_*.csv and flat_amenities.csv against reference."""
    results = {}

    files = {
        "flat_amenities.csv": None,
        "flat_supermarket.csv": None,
        "flat_school.csv": None,
        "flat_hawker.csv": None,
        "flat_park.csv": None,
        "flat_mall.csv": None,
        "flat_mrt.csv": None,
    }

    for fname in files:
        ref = pd.read_csv(REF_DIR / fname)
        out = pd.read_csv(OUT_DIR / fname)
        ref = ref.sort_values("flat").reset_index(drop=True)
        out = out.sort_values("flat").reset_index(drop=True)

        file_result = {"shape_ref": ref.shape, "shape_out": out.shape}

        # Object columns: exact match
        obj_cols = [c for c in ref.columns if ref[c].dtype == "object"]
        for col in obj_cols:
            match = ref[col].fillna("__NA__").eq(out[col].fillna("__NA__")).all()
            file_result[f"{col}_exact_match"] = bool(match)

        # Numeric columns: max abs diff
        num_cols = [
            c
            for c in ref.columns
            if c != "flat" and ref[c].dtype.kind in "fi"
        ]
        for col in num_cols:
            diff = (ref[col] - out[col]).abs().max()
            file_result[f"{col}_max_abs_diff"] = float(diff)

        results[fname] = file_result

    return results


def compare_resale_by_year() -> dict:
    """Compare all_resale_prices_by_year.csv against reference for 1990-2020."""
    ref = pd.read_csv(REF_DIR / "all_resale_prices_by_year.csv")
    out = pd.read_csv(OUT_DIR / "all_resale_prices_by_year.csv")

    results = {
        "shape_ref": ref.shape,
        "shape_out": out.shape,
        "years_ref": sorted(ref["year"].unique().tolist()),
        "years_out": sorted(out["year"].unique().tolist()),
    }

    # 1990-2019 (the period where data sources are essentially identical)
    ref_sub = ref[ref["year"] <= 2019].copy()
    out_sub = out[out["year"] <= 2019].copy()
    merged = ref_sub.merge(
        out_sub, on=["year", "flat"], how="outer", indicator=True, suffixes=("_ref", "_out")
    )
    matched = merged[merged["_merge"] == "both"]
    results["1990-2019"] = {
        "matched_rows": len(matched),
        "only_in_ref": int((merged["_merge"] == "left_only").sum()),
        "only_in_out": int((merged["_merge"] == "right_only").sum()),
        "real_price_max_abs_diff": float(
            (matched["real_price_ref"] - matched["real_price_out"]).abs().max()
        ),
    }

    # 1990-2020 (full overlap, but 2020 data sources differ)
    ref_sub = ref[ref["year"] <= 2020].copy()
    out_sub = out[out["year"] <= 2020].copy()
    merged = ref_sub.merge(
        out_sub, on=["year", "flat"], how="outer", indicator=True, suffixes=("_ref", "_out")
    )
    matched = merged[merged["_merge"] == "both"]
    price_diff = (matched["real_price_ref"] - matched["real_price_out"]).abs()
    results["1990-2020"] = {
        "matched_rows": len(matched),
        "only_in_ref": int((merged["_merge"] == "left_only").sum()),
        "only_in_out": int((merged["_merge"] == "right_only").sum()),
        "real_price_max_abs_diff": float(price_diff.max()),
        "rows_with_diff_gt_1000": int(price_diff.gt(1000).sum()),
    }

    # 2021+ (only in output)
    out_sub = out[out["year"] >= 2021].copy()
    results["2021+"] = {
        "rows": len(out_sub),
        "real_price_min": float(out_sub["real_price"].min()),
        "real_price_max": float(out_sub["real_price"].max()),
    }

    return results


def main():
    print("=== Validating amenity outputs ===")
    amenity_results = compare_amenity_files()
    for fname, res in amenity_results.items():
        print(f"\n{fname}:")
        for k, v in res.items():
            print(f"  {k}: {v}")

    print("\n=== Validating resale prices by year ===")
    resale_results = compare_resale_by_year()
    for k, v in resale_results.items():
        print(f"\n{k}:")
        if isinstance(v, dict):
            for kk, vv in v.items():
                print(f"  {kk}: {vv}")
        else:
            print(f"  {v}")


if __name__ == "__main__":
    main()
