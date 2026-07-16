"""Shared utilities for model training scripts."""

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "hdb_dataset.csv"
OUTPUT_DIR = ROOT / "outputs"


def load_data():
    """Load the full ML dataset and split by year (time-based split)."""
    df = pd.read_csv(DATA_PATH)
    train = df[df["year"] <= 2023].copy()
    test = df[df["year"] >= 2024].copy()
    return train, test


def get_feature_columns(df):
    """Return numeric feature columns, excluding metadata and target."""
    exclude = {"town", "flat_type", "real_price"}
    return [c for c in df.columns if c not in exclude]
