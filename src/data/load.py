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
