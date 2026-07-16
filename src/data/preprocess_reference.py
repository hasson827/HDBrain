"""
Replicate the preprocessing pipeline from the reference repository
HDB_Resale_Prices (TeYang Lau) for the HDBrain project.

This script:
  1. Reads facility and HDB coordinate data from data/raw/.
  2. Computes nearest amenity distances and counts of amenities within 2 km.
  3. Merges them into flat_amenities.csv.
  4. Reads HDB resale transaction data from data/raw/.
  5. Adjusts resale prices for inflation using CPI.
  6. Aggregates to median real price per year per flat address.
  7. Merges with coordinates and normalises prices.
  8. Writes all outputs to data/processed/.

All paths are relative to the project root (the parent of src/).
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Tuple

import numpy as np
import pandas as pd
from geopy.distance import geodesic


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

# ---------------------------------------------------------------------------
# Utility functions (mirroring reference/utils_functions.py)
# ---------------------------------------------------------------------------

def _haversine(lat1: np.ndarray, lon1: np.ndarray, lat2: np.ndarray, lon2: np.ndarray) -> np.ndarray:
    """Vectorised haversine distance in kilometres."""
    R = 6371.0
    lat1_rad = np.radians(lat1)
    lat2_rad = np.radians(lat2)
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = (
        np.sin(dlat / 2.0) ** 2
        + np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(dlon / 2.0) ** 2
    )
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return R * c


def find_nearest(house: pd.DataFrame, amenity: pd.DataFrame, radius: float = 2.0) -> Dict[str, list]:
    """
    Find nearest amenity and count amenities within `radius` km.

    Mirrors the reference implementation in utils_functions.py but uses vectorised
    haversine distances to select candidates, then recomputes exact geodesic
    distances for those candidates.  This is deterministic and produces the same
    nearest-neighbour/count results as the reference loop because haversine and
    geodesic distances rank amenities identically for Singapore-scale distances.
    """
    # The reference loop overwrites the result for duplicate addresses, so the
    # last occurrence in `house` determines the coordinate used.
    house_last = house.drop_duplicates(subset=[house.columns[0]], keep="last")
    flat_ids = house_last.iloc[:, 0].to_numpy()
    flat_lats = house_last.iloc[:, 1].to_numpy(dtype=float)
    flat_lons = house_last.iloc[:, 2].to_numpy(dtype=float)

    amenity_ids = amenity.iloc[:, 0].to_numpy()
    amenity_lats = amenity.iloc[:, 1].to_numpy(dtype=float)
    amenity_lons = amenity.iloc[:, 2].to_numpy(dtype=float)

    # Haversine distance matrix (n_flats x n_amenities)
    d_hav = _haversine(
        flat_lats[:, None],
        flat_lons[:, None],
        amenity_lats[None, :],
        amenity_lons[None, :],
    )

    # For exact nearest-neighbour matching we select all amenities whose
    # haversine distance is within 0.05 km of the minimum haversine distance.
    # Because geodesic and haversine differ by at most a few tens of metres for
    # Singapore, the true geodesic nearest must lie in this set.  We then
    # iterate those candidates in their original order and use < for ties,
    # matching the reference loop exactly.
    min_hav = d_hav.min(axis=1, keepdims=True)
    nearest_candidate_mask = d_hav <= (min_hav + 0.05)

    # Count candidates within a slightly enlarged haversine radius, then verify
    # with geodesic to match the reference exactly.
    count_candidate_mask = d_hav <= (radius + 0.05)

    results: Dict[str, list] = {}
    for i, flat_id in enumerate(flat_ids):
        flat_loc = (float(flat_lats[i]), float(flat_lons[i]))

        # Nearest amenity - exact geodesic among candidates near min haversine
        best_j = None
        best_dist = 100.0
        best_id = ""
        for j in np.where(nearest_candidate_mask[i])[0]:
            amenity_loc = (float(amenity_lats[j]), float(amenity_lons[j]))
            dist = float(str(geodesic(flat_loc, amenity_loc))[:-3])
            if dist < best_dist:
                best_dist = dist
                best_j = j
                best_id = amenity_ids[j]

        # Count amenities within radius using exact geodesic for candidates
        count = 0
        for k in np.where(count_candidate_mask[i])[0]:
            cand_loc = (float(amenity_lats[k]), float(amenity_lons[k]))
            dist = float(str(geodesic(flat_loc, cand_loc))[:-3])
            if dist <= radius:
                count += 1

        results[flat_id] = [flat_id, best_id, best_dist, count]

    return results


def dist_from_location(house: pd.DataFrame, location: Tuple[float, float]) -> Dict[str, list]:
    """Distance from each house to a single lat/lon location (Dhoby Ghaut)."""
    # Last duplicate wins, matching the reference loop.
    house_last = house.drop_duplicates(subset=[house.columns[0]], keep="last")
    flat_ids = house_last.iloc[:, 0].to_numpy()
    flat_lats = house_last.iloc[:, 1].to_numpy(dtype=float)
    flat_lons = house_last.iloc[:, 2].to_numpy(dtype=float)

    results: Dict[str, list] = {}
    for i, flat_id in enumerate(flat_ids):
        flat_loc = (float(flat_lats[i]), float(flat_lons[i]))
        distance = float(str(geodesic(flat_loc, location))[:-3])
        results[flat_id] = [flat_id, distance]

    return results


# ---------------------------------------------------------------------------
# Amenity preprocessing
# ---------------------------------------------------------------------------

def load_flat_coordinates() -> pd.DataFrame:
    """Load flat_coordinates_clean.csv exactly as in the reference notebook."""
    path = RAW_DIR / "flat_coordinates_clean.csv"
    df = pd.read_csv(path)
    return df[["address", "LATITUDE", "LONGITUDE"]]


def amenity_supermarket(flat_coord: pd.DataFrame) -> pd.DataFrame:
    df = pd.read_csv(RAW_DIR / "supermarket_coordinates_clean.csv")
    # The reference notebook drops duplicates on the search key, which is the
    # 'address' column in the raw API output.  The clean file keeps SEARCHVAL.
    # To mirror the reference, we assume the clean file already represents the
    # deduplicated result and use it directly.
    df = df[["SEARCHVAL", "LATITUDE", "LONGITUDE"]]
    nearest = find_nearest(flat_coord, df)
    out = (
        pd.DataFrame.from_dict(nearest, orient="index")
        .rename(
            columns={
                0: "flat",
                1: "supermarket",
                2: "supermarket_dist",
                3: "num_supermarket_2km",
            }
        )
        .reset_index(drop=True)
        .drop(columns=["supermarket"])
    )
    return out


def amenity_school(flat_coord: pd.DataFrame) -> pd.DataFrame:
    df = pd.read_csv(RAW_DIR / "school_coordinates_clean.csv")
    df = df[["address", "LATITUDE", "LONGITUDE"]]
    nearest = find_nearest(flat_coord, df)
    out = (
        pd.DataFrame.from_dict(nearest, orient="index")
        .rename(
            columns={
                0: "flat",
                1: "school",
                2: "school_dist",
                3: "num_school_2km",
            }
        )
        .reset_index(drop=True)
    )
    return out


def amenity_hawker(flat_coord: pd.DataFrame) -> pd.DataFrame:
    df = pd.read_csv(RAW_DIR / "hawker_coordinates_clean.csv")
    df = df[["address", "LATITUDE", "LONGITUDE"]]
    nearest = find_nearest(flat_coord, df)
    out = (
        pd.DataFrame.from_dict(nearest, orient="index")
        .rename(
            columns={
                0: "flat",
                1: "hawker",
                2: "hawker_dist",
                3: "num_hawker_2km",
            }
        )
        .reset_index(drop=True)
    )
    return out


def amenity_park(flat_coord: pd.DataFrame) -> pd.DataFrame:
    df = pd.read_csv(RAW_DIR / "parks_coordinates_clean.csv")
    df = df.reset_index()[["index", "Y", "X"]]
    nearest = find_nearest(flat_coord, df)
    out = (
        pd.DataFrame.from_dict(nearest, orient="index")
        .rename(
            columns={
                0: "flat",
                1: "park",
                2: "park_dist",
                3: "num_park_2km",
            }
        )
        .reset_index(drop=True)
        .drop(columns=["park"])
    )
    return out


def amenity_mall(flat_coord: pd.DataFrame) -> pd.DataFrame:
    df = pd.read_csv(RAW_DIR / "shoppingmall_coordinates_clean.csv")
    df = df[["address", "LATITUDE", "LONGITUDE"]]
    nearest = find_nearest(flat_coord, df)
    out = (
        pd.DataFrame.from_dict(nearest, orient="index")
        .rename(
            columns={
                0: "flat",
                1: "mall",
                2: "mall_dist",
                3: "num_mall_2km",
            }
        )
        .reset_index(drop=True)
    )
    return out


def amenity_mrt(flat_coord: pd.DataFrame) -> pd.DataFrame:
    df = pd.read_csv(RAW_DIR / "MRT_coordinates.csv")
    df = df[["STN_NAME", "Latitude", "Longitude"]]
    nearest = find_nearest(flat_coord, df)
    out = (
        pd.DataFrame.from_dict(nearest, orient="index")
        .rename(
            columns={
                0: "flat",
                1: "mrt",
                2: "mrt_dist",
                3: "num_mrt_2km",
            }
        )
        .reset_index(drop=True)
    )
    return out


def build_flat_amenities() -> pd.DataFrame:
    """Reproduce Data/flat_amenities.csv."""
    print("Loading flat coordinates...")
    flat_coord = load_flat_coordinates()

    print("Computing nearest supermarkets...")
    flat_supermarket = amenity_supermarket(flat_coord)

    print("Computing nearest schools...")
    flat_school = amenity_school(flat_coord)

    print("Computing nearest hawkers...")
    flat_hawker = amenity_hawker(flat_coord)

    print("Computing nearest parks...")
    flat_park = amenity_park(flat_coord)

    print("Computing nearest malls...")
    flat_mall = amenity_mall(flat_coord)

    print("Computing nearest MRTs...")
    flat_mrt = amenity_mrt(flat_coord)

    print("Merging amenity tables...")
    flat_amenities = flat_school.merge(flat_hawker, on="flat", how="outer")
    flat_amenities = flat_amenities.merge(flat_park, on="flat", how="outer")
    flat_amenities = flat_amenities.merge(flat_mall, on="flat", how="outer")
    flat_amenities = flat_amenities.merge(flat_mrt, on="flat", how="outer")
    flat_amenities = flat_amenities.merge(flat_supermarket, on="flat", how="outer")

    print("Computing distance from Dhoby Ghaut...")
    dist_dhoby = dist_from_location(flat_coord, (1.299308, 103.845285))
    dist_dhoby_df = (
        pd.DataFrame.from_dict(dist_dhoby, orient="index")
        .rename(columns={0: "flat", 1: "dist_dhoby"})
        .reset_index(drop=True)
    )
    flat_amenities = flat_amenities.merge(dist_dhoby_df, on="flat", how="outer")

    # Column order from reference flat_amenities.csv
    cols = [
        "flat",
        "school",
        "school_dist",
        "num_school_2km",
        "hawker",
        "hawker_dist",
        "num_hawker_2km",
        "park_dist",
        "num_park_2km",
        "mall",
        "mall_dist",
        "num_mall_2km",
        "mrt",
        "mrt_dist",
        "num_mrt_2km",
        "supermarket_dist",
        "num_supermarket_2km",
        "dist_dhoby",
    ]
    flat_amenities = flat_amenities[cols]

    return flat_amenities, {
        "flat_supermarket": flat_supermarket,
        "flat_school": flat_school,
        "flat_hawker": flat_hawker,
        "flat_park": flat_park,
        "flat_mall": flat_mall,
        "flat_mrt": flat_mrt,
    }


# ---------------------------------------------------------------------------
# Resale price preprocessing
# ---------------------------------------------------------------------------

def load_resale_prices() -> pd.DataFrame:
    """
    Load the user's HDB resale price CSVs from data/raw/.

    The reference repository concatenates five files covering 1990-2020.
    The user's download uses slightly different filenames and extends to 2026.
    """
    files = [
        "Resale Flat Prices (Based on Approval Date), 1990 - 1999.csv",
        "Resale Flat Prices (Based on Approval Date), 2000 - Feb 2012.csv",
        "Resale Flat Prices (Based on Registration Date), From Mar 2012 to Dec 2014.csv",
        "Resale Flat Prices (Based on Registration Date), From Jan 2015 to Dec 2016.csv",
        "Resale flat prices based on registration date from Jan-2017 onwards.csv",
    ]

    chunks = []
    for fname in files:
        path = RAW_DIR / fname
        if not path.exists():
            raise FileNotFoundError(f"Expected resale file not found: {path}")
        chunks.append(pd.read_csv(path))
        print(f"  Loaded {fname}: {chunks[-1].shape}")

    prices = pd.concat(chunks, axis=0, ignore_index=True, sort=False)
    prices["month"] = pd.to_datetime(prices["month"])
    return prices


def get_years(text):
    """Convert remaining_lease strings like '93 years 06 months' to float years."""
    if isinstance(text, str):
        yearmonth = [int(s) for s in text.split() if s.isdigit()]
        if len(yearmonth) > 1:
            return yearmonth[0] + (yearmonth[1] / 12)
        return yearmonth[0]
    return text


def build_resale_by_year() -> pd.DataFrame:
    """Reproduce Data/all_resale_prices_by_year.csv."""
    print("Loading resale price files...")
    prices = load_resale_prices()

    # Clean flat model values (used in the modelling notebook)
    prices["flat_type"] = prices["flat_type"].str.replace("MULTI-GENERATION", "MULTI GENERATION")
    replace_values = {
        "NEW GENERATION": "New Generation",
        "SIMPLIFIED": "Simplified",
        "STANDARD": "Standard",
        "MODEL A-MAISONETTE": "Maisonette",
        "MULTI GENERATION": "Multi Generation",
        "IMPROVED-MAISONETTE": "Executive Maisonette",
        "Improved-Maisonette": "Executive Maisonette",
        "Premium Maisonette": "Executive Maisonette",
        "2-ROOM": "2-room",
        "MODEL A": "Model A",
        "MAISONETTE": "Maisonette",
        "Model A-Maisonette": "Maisonette",
        "IMPROVED": "Improved",
        "TERRACE": "Terrace",
        "PREMIUM APARTMENT": "Premium Apartment",
        "PREMIUM MAISONETTE": "Premium Maisonette",
        "ADJOINED FLAT": "Adjoined flat",
    }
    prices["flat_model"] = prices["flat_model"].replace(replace_values)

    # Convert remaining_lease to years when present
    if "remaining_lease" in prices.columns:
        prices["remaining_lease"] = prices["remaining_lease"].apply(get_years)

    # CPI adjustment
    print("Applying CPI adjustment...")
    cpi = pd.read_csv(RAW_DIR / "CPI.csv")
    cpi["month"] = pd.to_datetime(cpi["month"], format="%Y %b")

    # The reference CPI file ends in 2020-09, but the user's resale data may
    # extend beyond that.  Forward-fill the latest CPI for any missing months so
    # that all transactions can be inflation-adjusted.  This is a pragmatic
    # choice; for production work one would append the latest official CPI series.
    min_month, max_month = prices["month"].min(), prices["month"].max()
    full_months = pd.DataFrame(
        {"month": pd.date_range(start=min_month, end=max_month, freq="MS")}
    )
    cpi = full_months.merge(cpi, on="month", how="left")
    cpi["cpi"] = cpi["cpi"].ffill()

    prices = prices.merge(cpi, on="month", how="left")
    prices["real_price"] = (prices["resale_price"] / prices["cpi"]) * 100

    # Build address and year
    prices["flat"] = prices["block"] + " " + prices["street_name"]
    prices["year"] = pd.DatetimeIndex(prices["month"]).year

    # Aggregate median real price per year per flat
    print("Aggregating median real price by year and flat...")
    by_year = (
        prices.groupby(["year", "flat"], as_index=False)
        .agg({"real_price": "median"})
        .sort_values(["year", "flat"])
        .reset_index(drop=True)
    )

    # Merge coordinates (keep first coordinate per address, matching reference)
    print("Merging coordinates...")
    flat_coord = pd.read_csv(RAW_DIR / "flat_coordinates_clean.csv")
    flat_coord = flat_coord.drop_duplicates(subset=["address"], keep="first")
    flat_coord = flat_coord.rename(columns={"address": "flat"})
    by_year = by_year.merge(flat_coord[["flat", "LATITUDE", "LONGITUDE"]], on="flat", how="left")

    # Normalise price to [0, 1]
    max_price = by_year["real_price"].max()
    by_year["norm_price"] = by_year["real_price"] / max_price

    # Column order from reference all_resale_prices_by_year.csv
    by_year = by_year[["year", "flat", "real_price", "LATITUDE", "LONGITUDE", "norm_price"]]

    return by_year, prices


# ---------------------------------------------------------------------------
# Final modelling dataset (not saved in reference, but requested by user)
# ---------------------------------------------------------------------------

def build_model_dataset(prices: pd.DataFrame, flat_amenities: pd.DataFrame) -> pd.DataFrame:
    """
    Build a panel dataset with time, flat attributes, amenity counts and price.

    This mirrors the `prices1519` DataFrame used for modelling in the reference
    notebook (cell 62 onward), but keeps all years available in the user's data.
    """
    df = prices.copy()
    df["flat"] = df["block"] + " " + df["street_name"]
    df = df.merge(flat_amenities, on="flat", how="left")

    # Region mapping from reference notebook
    d_region = {
        "ANG MO KIO": "North East",
        "BEDOK": "East",
        "BISHAN": "Central",
        "BUKIT BATOK": "West",
        "BUKIT MERAH": "Central",
        "BUKIT PANJANG": "West",
        "BUKIT TIMAH": "Central",
        "CENTRAL AREA": "Central",
        "CHOA CHU KANG": "West",
        "CLEMENTI": "West",
        "GEYLANG": "Central",
        "HOUGANG": "North East",
        "JURONG EAST": "West",
        "JURONG WEST": "West",
        "KALLANG/WHAMPOA": "Central",
        "MARINE PARADE": "Central",
        "PASIR RIS": "East",
        "PUNGGOL": "North East",
        "QUEENSTOWN": "Central",
        "SEMBAWANG": "North",
        "SENGKANG": "North East",
        "SERANGOON": "North East",
        "TAMPINES": "East",
        "TOA PAYOH": "Central",
        "WOODLANDS": "North",
        "YISHUN": "North",
        "LIM CHU KANG": "North",
    }
    df["region"] = df["town"].map(d_region)

    # Fill missing amenity distances/counts with median per town
    amenity_cols = [
        "school_dist",
        "num_school_2km",
        "hawker_dist",
        "num_hawker_2km",
        "park_dist",
        "num_park_2km",
        "mall_dist",
        "num_mall_2km",
        "mrt_dist",
        "num_mrt_2km",
        "supermarket_dist",
        "num_supermarket_2km",
        "dist_dhoby",
    ]
    for col in amenity_cols:
        if col in df.columns:
            df[col] = df.groupby("town")[col].transform(lambda x: x.fillna(x.median()))

    keep_cols = [
        "month",
        "year",
        "town",
        "region",
        "flat_type",
        "storey_range",
        "floor_area_sqm",
        "flat_model",
        "lease_commence_date",
        "remaining_lease",
        "flat",
        "school_dist",
        "num_school_2km",
        "hawker_dist",
        "num_hawker_2km",
        "park_dist",
        "num_park_2km",
        "mall_dist",
        "num_mall_2km",
        "mrt_dist",
        "num_mrt_2km",
        "supermarket_dist",
        "num_supermarket_2km",
        "dist_dhoby",
        "resale_price",
        "cpi",
        "real_price",
    ]
    available_cols = [c for c in keep_cols if c in df.columns]
    return df[available_cols]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    # --- Amenities ---
    print("\n=== Building amenity features ===")
    flat_amenities, amenity_parts = build_flat_amenities()

    print("Saving flat_*.csv files...")
    for name, df in amenity_parts.items():
        df.to_csv(PROCESSED_DIR / f"{name}.csv", index=False)

    flat_amenities.to_csv(PROCESSED_DIR / "flat_amenities.csv", index=False)
    print(f"Saved flat_amenities.csv: {flat_amenities.shape}")

    # --- Resale prices by year ---
    print("\n=== Building resale price by year ===")
    resale_by_year, full_prices = build_resale_by_year()
    resale_by_year.to_csv(PROCESSED_DIR / "all_resale_prices_by_year.csv", index=False)
    print(f"Saved all_resale_prices_by_year.csv: {resale_by_year.shape}")

    # --- Full modelling dataset ---
    print("\n=== Building full modelling dataset ===")
    model_df = build_model_dataset(full_prices, flat_amenities)
    model_df.to_csv(PROCESSED_DIR / "hdb_resale_model_dataset.csv", index=False)
    print(f"Saved hdb_resale_model_dataset.csv: {model_df.shape}")

    print("\nDone. All outputs written to", PROCESSED_DIR)


if __name__ == "__main__":
    main()
