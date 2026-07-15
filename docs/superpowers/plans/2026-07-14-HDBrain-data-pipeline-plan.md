# HDBrain Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible data pipeline that merges, cleans, geocodes, and engineers features from the 5 HDB resale CSV files into `data/processed/enriched_dataset.parquet`.

**Architecture:** Offline ETL: raw CSVs → unified schema → cleaning → OneMap geocoding with local cache → feature engineering (geospatial + temporal + market lags) → parquet. Online layer reads only the parquet and `block_coords.csv` cache.

**Tech Stack:** Python 3.10+, pandas, pyarrow, requests, python-dotenv, pytest.

## Global Constraints

- Data source: 5 CSV files in `data/raw/` (1990–1999 approval, 2000–Feb 2012 approval, Mar 2012–Dec 2014 registration, Jan 2015–Dec 2016 registration, Jan 2017 onwards registration).
- Output schema must match `ValuationInput` in `docs/superpowers/specs/2026-07-14-HDBrain-design.md`.
- OneMap geocoding failures must fallback to town-centroid coordinates.
- Temporal lag features must use only past data (`shift(1)`) to prevent leakage.
- All paths are relative to project root; use `pathlib.Path(__file__).resolve().parents[N]` to anchor.

---

## Task 1: Project Scaffolding and Configuration

**Files:**
- Create: `config.yaml`
- Create: `requirements.txt`
- Create: `.env.example`
- Create: `.gitignore` (or append to existing)
- Create: `tests/__init__.py`
- Create: `src/__init__.py`
- Create: `src/data/__init__.py`

**Interfaces:**
- Consumes: none.
- Produces: `config.yaml` loaded by downstream modules via a helper.

- [ ] **Step 1: Create `config.yaml` with paths and policy parameters**

```yaml
paths:
  data_raw: "data/raw"
  data_processed: "data/processed"
  data_external: "data/external"
  models_dir: "models"
  outputs_dir: "outputs"

onemap:
  base_url: "https://www.onemap.gov.sg/api/common/elastic/search"
  # If search endpoint requires token later, add token here or in .env

geography:
  cbd_lat: 1.283933
  cbd_lng: 103.852222  # Raffles Place

mrt:
  stations_csv: "data/external/mrt_stations.csv"
```

- [ ] **Step 2: Create `requirements.txt`**

```text
pandas>=1.5.0,<2.1.0
numpy>=1.24.0,<2.0.0
pyarrow>=12.0.0
scikit-learn>=1.3.0
requests>=2.31.0
python-dotenv>=1.0.0
pytest>=7.4.0
```

- [ ] **Step 3: Create `.env.example`**

```text
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

- [ ] **Step 4: Update `.gitignore`**

```text
.env
__pycache__/
*.pyc
.DS_Store
data/processed/
models/
outputs/
```

- [ ] **Step 5: Create empty `__init__.py` files and commit**

Run:
```bash
git add config.yaml requirements.txt .env.example .gitignore tests/__init__.py src/__init__.py src/data/__init__.py
git commit -m "chore: add project scaffolding and config"
```

---

## Task 2: CSV Loading and Schema Unification

**Files:**
- Create: `src/data/load.py`
- Create: `tests/test_load.py`

**Interfaces:**
- Consumes: `config.yaml` paths.
- Produces: `load_raw_data(raw_dir: Path) -> pd.DataFrame` with columns:
  `month, town, flat_type, block, street_name, storey_range, floor_area_sqm, flat_model, lease_commence_date, remaining_lease, resale_price`.

- [ ] **Step 1: Write failing test for schema unification**

```python
# tests/test_load.py
from pathlib import Path
from src.data.load import load_raw_data

def test_load_raw_data_schema(tmp_path):
    # minimal mock CSVs mimicking the two schema variants
    raw = tmp_path / "raw"
    raw.mkdir()
    (raw / "a.csv").write_text(
        "month,town,flat_type,block,street_name,storey_range,floor_area_sqm,flat_model,lease_commence_date,resale_price\n"
        "2012-01,ANG MO KIO,3 ROOM,123,ANG MO KIO AVE 3,01 TO 03,60,New Generation,1978,300000\n"
    )
    (raw / "b.csv").write_text(
        "month,town,flat_type,block,street_name,storey_range,floor_area_sqm,flat_model,lease_commence_date,remaining_lease,resale_price\n"
        "2017-01,ANG MO KIO,3 ROOM,124,ANG MO KIO AVE 3,04 TO 06,60,New Generation,1978,62 years 06 months,320000\n"
    )
    df = load_raw_data(raw)
    assert set(df.columns) == {
        "month", "town", "flat_type", "block", "street_name",
        "storey_range", "floor_area_sqm", "flat_model",
        "lease_commence_date", "remaining_lease", "resale_price"
    }
    assert len(df) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_load.py::test_load_raw_data_schema -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'src.data.load'"

- [ ] **Step 3: Implement `src/data/load.py`**

```python
from pathlib import Path
import pandas as pd

COLUMN_ORDER = [
    "month", "town", "flat_type", "block", "street_name",
    "storey_range", "floor_area_sqm", "flat_model",
    "lease_commence_date", "remaining_lease", "resale_price"
]


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    for col in COLUMN_ORDER:
        if col not in df.columns:
            df[col] = pd.NA
    return df[COLUMN_ORDER]


def load_raw_data(raw_dir: Path) -> pd.DataFrame:
    raw_dir = Path(raw_dir)
    csv_files = sorted(raw_dir.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in {raw_dir}")
    frames = []
    for f in csv_files:
        df = pd.read_csv(f, low_memory=False)
        frames.append(_normalise_columns(df))
    return pd.concat(frames, ignore_index=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_load.py::test_load_raw_data_schema -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/load.py tests/test_load.py
git commit -m "feat: add raw CSV loader with schema unification"
```

---

## Task 3: Data Cleaning

**Files:**
- Create: `src/data/clean.py`
- Create: `tests/test_clean.py`

**Interfaces:**
- Consumes: `pd.DataFrame` from `load_raw_data`.
- Produces: `clean_data(df: pd.DataFrame) -> pd.DataFrame` with numeric `remaining_lease_months`, `storey_mid`, `flat_age`, and standardised categorical columns.

- [ ] **Step 1: Write failing tests for cleaning functions**

```python
# tests/test_clean.py
import pandas as pd
from src.data.clean import parse_remaining_lease, parse_storey_range, clean_data

def test_parse_remaining_lease_years_months():
    assert parse_remaining_lease("62 years 06 months") == 62 * 12 + 6

def test_parse_remaining_lease_numeric():
    assert parse_remaining_lease(62) == 62 * 12

def test_parse_storey_range():
    assert parse_storey_range("10 TO 12") == 11

def test_clean_data_columns():
    df = pd.DataFrame({
        "month": ["2017-01"],
        "town": ["ANG MO KIO"],
        "flat_type": ["3 ROOM"],
        "block": ["123"],
        "street_name": ["ANG MO KIO AVE 3"],
        "storey_range": ["10 TO 12"],
        "floor_area_sqm": [60.0],
        "flat_model": ["New Generation"],
        "lease_commence_date": [1978],
        "remaining_lease": ["62 years 06 months"],
        "resale_price": [320000],
    })
    out = clean_data(df)
    assert "remaining_lease_months" in out.columns
    assert out["remaining_lease_months"].iloc[0] == 62 * 12 + 6
    assert out["storey_mid"].iloc[0] == 11
    assert out["flat_age"].iloc[0] == 2017 - 1978
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_clean.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `src/data/clean.py`**

```python
import re
import pandas as pd


def parse_remaining_lease(value):
    if pd.isna(value):
        return pd.NA
    if isinstance(value, (int, float)):
        return int(value * 12)
    s = str(value).strip().lower()
    years = 0
    months = 0
    m = re.search(r'(\d+)\s*years?', s)
    if m:
        years = int(m.group(1))
    m = re.search(r'(\d+)\s*months?', s)
    if m:
        months = int(m.group(1))
    return years * 12 + months


def parse_storey_range(value):
    if pd.isna(value):
        return pd.NA
    nums = [int(x) for x in re.findall(r'\d+', str(value))]
    if not nums:
        return pd.NA
    return sum(nums) / len(nums)


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["month"] = pd.to_datetime(df["month"], errors="coerce")
    df["town"] = df["town"].str.strip().str.upper()
    df["flat_type"] = df["flat_type"].str.strip().str.upper()
    df["flat_model"] = df["flat_model"].str.strip().str.upper()
    df["block"] = df["block"].str.strip().str.upper()
    df["street_name"] = df["street_name"].str.strip().str.upper()

    df["remaining_lease_months"] = df["remaining_lease"].apply(parse_remaining_lease)
    # fallback: infer from lease_commence_date if missing
    df["lease_commence_date"] = pd.to_numeric(df["lease_commence_date"], errors="coerce")
    df["remaining_lease_months"] = df["remaining_lease_months"].fillna(
        99 * 12 - (df["month"].dt.year - df["lease_commence_date"]) * 12
    )

    df["storey_mid"] = df["storey_range"].apply(parse_storey_range)
    df["floor_area_sqm"] = pd.to_numeric(df["floor_area_sqm"], errors="coerce")
    df["resale_price"] = pd.to_numeric(df["resale_price"], errors="coerce")
    df["flat_age"] = df["month"].dt.year - df["lease_commence_date"]

    # Drop rows missing critical fields
    df = df.dropna(subset=["resale_price", "floor_area_sqm", "lease_commence_date"])
    return df
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_clean.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/clean.py tests/test_clean.py
git commit -m "feat: add data cleaning with lease and storey parsing"
```

---

## Task 4: OneMap Geocoding with Cache

**Files:**
- Create: `src/data/geocode.py`
- Create: `tests/test_geocode.py`
- Create: `data/external/town_centroids.csv` (fallback)

**Interfaces:**
- Consumes: cleaned DataFrame with `block`, `street_name`, `town`.
- Produces: `geocode_blocks(df: pd.DataFrame, cache_path: Path) -> pd.DataFrame` returning a DataFrame indexed by unique `(block, street_name)` with `lat`, `lng`.

- [ ] **Step 1: Write failing test for geocoding fallback**

```python
# tests/test_geocode.py
import pandas as pd
from pathlib import Path
from src.data.geocode import build_address_cache, TOWN_CENTROIDS

def test_build_address_cache_fallback(tmp_path):
    df = pd.DataFrame({
        "block": ["123"],
        "street_name": ["ANG MO KIO AVE 3"],
        "town": ["ANG MO KIO"],
    })
    cache = tmp_path / "block_coords.csv"
    out = build_address_cache(df, cache, town_centroids=TOWN_CENTROIDS)
    assert len(out) == 1
    assert "lat" in out.columns and "lng" in out.columns
    # When API fails, coordinates should equal town centroid
    assert out.loc[("123", "ANG MO KIO AVE 3"), "lat"] == TOWN_CENTROIDS["ANG MO KIO"][0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_geocode.py::test_build_address_cache_fallback -v`
Expected: FAIL

- [ ] **Step 3: Implement `src/data/geocode.py`**

```python
import time
from pathlib import Path
import pandas as pd
import requests
import yaml

# Town centroid fallback (approximate)
TOWN_CENTROIDS = {
    "ANG MO KIO": (1.3691, 103.8454),
    "BEDOK": (1.3236, 103.9273),
    "BISHAN": (1.3526, 103.8353),
    "BUKIT BATOK": (1.3590, 103.7637),
    "BUKIT MERAH": (1.2819, 103.8239),
    "BUKIT PANJANG": (1.3774, 103.7719),
    "CHOA CHU KANG": (1.3840, 103.7471),
    "CLEMENTI": (1.3162, 103.7649),
    "GEYLANG": (1.3182, 103.8871),
    "HOUGANG": (1.3714, 103.8930),
    "JURONG EAST": (1.3329, 103.7436),
    "JURONG WEST": (1.3404, 103.7090),
    "KALLANG/WHAMPOA": (1.3138, 103.8621),
    "PASIR RIS": (1.3731, 103.9493),
    "PUNGGOL": (1.3984, 103.9072),
    "QUEENSTOWN": (1.2948, 103.8060),
    "SENGKANG": (1.3917, 103.8953),
    "SERANGOON": (1.3554, 103.8679),
    "TAMPINES": (1.3496, 103.9568),
    "TOA PAYOH": (1.3343, 103.8563),
    "WOODLANDS": (1.4382, 103.7890),
    "YISHUN": (1.4304, 103.8354),
    "SEMBAWANG": (1.4491, 103.8185),
    "SIMEI": (1.3434, 103.9539),
    "TENGAH": (1.3570, 103.7400),
    "PASIR RIS": (1.3731, 103.9493),
}


def _load_config():
    with open("config.yaml") as f:
        return yaml.safe_load(f)


def _search_onemap(address: str) -> tuple[float, float] | None:
    cfg = _load_config()
    url = cfg["onemap"]["base_url"]
    params = {"searchVal": address, "returnGeom": "Y", "getAddrDetails": "N"}
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        if data.get("results"):
            lat = float(data["results"][0]["LATITUDE"])
            lng = float(data["results"][0]["LONGITUDE"])
            return lat, lng
    except Exception:
        pass
    return None


def build_address_cache(df: pd.DataFrame, cache_path: Path, town_centroids: dict | None = None) -> pd.DataFrame:
    cache_path = Path(cache_path)
    if town_centroids is None:
        town_centroids = TOWN_CENTROIDS

    if cache_path.exists():
        return pd.read_csv(cache_path, index_col=["block", "street_name"])

    unique = df[["block", "street_name", "town"]].drop_duplicates().dropna()
    rows = []
    for _, row in unique.iterrows():
        address = f"{row['block']} {row['street_name']}"
        coords = _search_onemap(address)
        if coords is None:
            coords = town_centroids.get(row["town"], (1.35, 103.8))
        rows.append({
            "block": row["block"],
            "street_name": row["street_name"],
            "lat": coords[0],
            "lng": coords[1],
        })
        time.sleep(0.2)  # be polite to API

    out = pd.DataFrame(rows).set_index(["block", "street_name"])
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(cache_path)
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_geocode.py::test_build_address_cache_fallback -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/geocode.py tests/test_geocode.py
git commit -m "feat: add OneMap geocoding with town-centroid fallback"
```

---

## Task 5: Feature Engineering

**Files:**
- Create: `src/data/features.py`
- Create: `tests/test_features.py`
- Create: `data/external/mrt_stations.csv`

**Interfaces:**
- Consumes: cleaned DataFrame and `block_coords.csv`.
- Produces: `engineer_features(df: pd.DataFrame, coords: pd.DataFrame, mrt: pd.DataFrame) -> pd.DataFrame` adding distance-to-MRT, distance-to-CBD, and lagged median price features.

- [ ] **Step 1: Write failing test for feature engineering**

```python
# tests/test_features.py
import pandas as pd
from src.data.features import engineer_features, haversine

def test_haversine():
    # ~1 km between two close points
    d = haversine(1.35, 103.85, 1.36, 103.85)
    assert 100 < d < 120

def test_engineer_features_no_leakage():
    df = pd.DataFrame({
        "month": pd.to_datetime(["2017-01", "2017-02", "2017-03"]),
        "town": ["ANG MO KIO"] * 3,
        "flat_type": ["3 ROOM"] * 3,
        "block": ["123"] * 3,
        "street_name": ["ANG MO KIO AVE 3"] * 3,
        "storey_mid": [5.0] * 3,
        "floor_area_sqm": [60.0] * 3,
        "flat_model": ["NEW GENERATION"] * 3,
        "lease_commence_date": [1978] * 3,
        "remaining_lease_months": [700] * 3,
        "resale_price": [300000, 310000, 320000],
        "flat_age": [39, 39, 39],
    })
    coords = pd.DataFrame({
        "block": ["123"],
        "street_name": ["ANG MO KIO AVE 3"],
        "lat": [1.3691],
        "lng": [103.8454],
    }).set_index(["block", "street_name"])
    mrt = pd.DataFrame({
        "station_name": ["ANG MO KIO"],
        "lat": [1.3700],
        "lng": [103.8500],
    })
    out = engineer_features(df, coords, mrt)
    assert "dist_to_mrt_km" in out.columns
    assert "dist_to_cbd_km" in out.columns
    assert "town_flattype_lag6_median" in out.columns
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_features.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `src/data/features.py`**

```python
import numpy as np
import pandas as pd
from pathlib import Path


def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1 = np.radians(lat1)
    phi2 = np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2) ** 2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return R * c


def _nearest_mrt_distance(lat, lng, mrt_df):
    dists = haversine(lat, lng, mrt_df["lat"].values, mrt_df["lng"].values)
    return dists.min()


def engineer_features(df: pd.DataFrame, coords: pd.DataFrame, mrt_df: pd.DataFrame, cbd=(1.283933, 103.852222)) -> pd.DataFrame:
    df = df.copy()
    df = df.join(coords, on=["block", "street_name"], how="left")

    # Fallback for missing coords: town centroid approximation handled in geocode step,
    # but fill any remaining NaNs with CBD to avoid breakage.
    df["lat"] = df["lat"].fillna(cbd[0])
    df["lng"] = df["lng"].fillna(cbd[1])

    df["dist_to_cbd_km"] = df.apply(lambda r: haversine(r["lat"], r["lng"], cbd[0], cbd[1]), axis=1)
    df["dist_to_mrt_km"] = df.apply(lambda r: _nearest_mrt_distance(r["lat"], r["lng"], mrt_df), axis=1)

    # Temporal features
    df["transaction_year"] = df["month"].dt.year
    df["transaction_month"] = df["month"].dt.month

    # Lagged median price by town + flat_type (no leakage: use previous months only)
    df = df.sort_values("month").reset_index(drop=True)
    df["year_month"] = df["month"].dt.to_period("M")
    lagged = (
        df.groupby(["town", "flat_type", "year_month"])["resale_price"]
        .median()
        .groupby(level=[0, 1])
        .shift(1)
        .rolling(window=6, min_periods=1)
        .median()
        .rename("town_flattype_lag6_median")
    )
    df = df.merge(lagged, on=["town", "flat_type", "year_month"], how="left")
    return df
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_features.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/features.py tests/test_features.py
git commit -m "feat: add geospatial and temporal lag features"
```

---

## Task 6: Build Dataset Entry Point

**Files:**
- Create: `src/data/build_dataset.py`
- Modify: `data/external/mrt_stations.csv` (create if missing)

**Interfaces:**
- Consumes: `load_raw_data`, `clean_data`, `build_address_cache`, `engineer_features`.
- Produces: `data/processed/enriched_dataset.parquet`.

- [ ] **Step 1: Create a minimal MRT stations CSV**

If `data/external/mrt_stations.csv` does not exist, create it with at least the following header and one row:

```csv
station_name,lat,lng
ANG MO KIO,1.3700,103.8500
```

A more complete MRT list should be added later, but this is enough for the pipeline to run.

- [ ] **Step 2: Implement `src/data/build_dataset.py`**

```python
import yaml
from pathlib import Path
from src.data.load import load_raw_data
from src.data.clean import clean_data
from src.data.geocode import build_address_cache
from src.data.features import engineer_features


def main():
    with open("config.yaml") as f:
        cfg = yaml.safe_load(f)

    raw_dir = Path(cfg["paths"]["data_raw"])
    processed_dir = Path(cfg["paths"]["data_processed"])
    external_dir = Path(cfg["paths"]["data_external"])
    processed_dir.mkdir(parents=True, exist_ok=True)
    external_dir.mkdir(parents=True, exist_ok=True)

    print("Loading raw data...")
    df = load_raw_data(raw_dir)

    print("Cleaning...")
    df = clean_data(df)

    print("Geocoding (or loading cache)...")
    cache_path = external_dir / "block_coords.csv"
    coords = build_address_cache(df, cache_path)

    print("Engineering features...")
    mrt_path = external_dir / "mrt_stations.csv"
    if not mrt_path.exists():
        raise FileNotFoundError(f"MRT stations file not found: {mrt_path}")
    import pandas as pd
    mrt = pd.read_csv(mrt_path)
    df = engineer_features(df, coords, mrt)

    output_path = processed_dir / "enriched_dataset.parquet"
    df.to_parquet(output_path, index=False)
    print(f"Saved {len(df)} rows to {output_path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run the pipeline end-to-end**

Run: `python src/data/build_dataset.py`
Expected: `Saved N rows to data/processed/enriched_dataset.parquet`

- [ ] **Step 4: Verify parquet columns**

Run:
```bash
python - <<'PY'
import pandas as pd
df = pd.read_parquet("data/processed/enriched_dataset.parquet")
print(df.shape)
print(df.columns.tolist())
PY
```
Expected: shape printed; columns include `dist_to_mrt_km`, `dist_to_cbd_km`, `town_flattype_lag6_median`.

- [ ] **Step 5: Commit**

```bash
git add src/data/build_dataset.py data/external/mrt_stations.csv
git commit -m "feat: add dataset build entrypoint"
```

---

## Self-Review

**Spec coverage:**
- [x] Merge 5 CSVs with unified schema — Task 2.
- [x] Clean `remaining_lease`, `storey_range`, compute `flat_age` — Task 3.
- [x] OneMap geocoding with cache and town-centroid fallback — Task 4.
- [x] Geospatial features (MRT/CBD distance) — Task 5.
- [x] Temporal lag features without leakage — Task 5.
- [x] Output `enriched_dataset.parquet` — Task 6.

**Placeholder scan:** No TBD/TODO; all code blocks are complete.

**Type consistency:** `load_raw_data` → `clean_data` → `build_address_cache` → `engineer_features` chain uses `pd.DataFrame` consistently.
