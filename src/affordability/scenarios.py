"""Run affordability scenarios across a range of household incomes."""

from pathlib import Path
import sys
from typing import List

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.affordability.calculator import max_affordable_price
from src.affordability.mapper import affordability_map
from src.affordability.user_profile import BuyerProfile

MODEL_PATH = ROOT / "models" / "xgboost_model.joblib"
DEFAULT_INCOMES = [3_000, 5_000, 8_000, 12_000, 15_000, 20_000]


def run_scenarios(incomes: List[int] = None, model=None, df=None) -> pd.DataFrame:
    """For each income level, compute the number of affordable town/flat/storey groups."""
    if incomes is None:
        incomes = DEFAULT_INCOMES
    if model is None:
        model = joblib.load(MODEL_PATH)

    records = []
    for income in incomes:
        profile = BuyerProfile(monthly_income=income)
        max_price = max_affordable_price(profile)
        mapped = affordability_map(profile, model=model, df=df)
        affordable = mapped[mapped["affordable"]]

        example = None
        if not affordable.empty:
            # Pick the group with the largest surplus (most negative gap)
            best = affordable.loc[affordable["affordability_gap"].idxmin()]
            example = f"{best['town']} {best['flat_type']} (storey {best['storey_range_code']})"

        records.append({
            "monthly_income": income,
            "annual_income": income * 12,
            "max_affordable_price": max_price,
            "num_affordable_groups": len(affordable),
            "total_groups": len(mapped),
            "affordable_pct": len(affordable) / len(mapped) * 100 if len(mapped) > 0 else 0,
            "example_affordable_group": example,
        })

    return pd.DataFrame(records)


def save_scenarios(df: pd.DataFrame, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    print(f"Saved scenario summary to {path}")
