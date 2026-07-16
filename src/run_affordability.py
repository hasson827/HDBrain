"""
Run the full affordability engine.

Outputs:
  - outputs/affordability_map.csv
  - outputs/affordability_scenarios.csv
  - outputs/affordability_heatmap.png
  - outputs/affordability_pti.png
  - outputs/affordability_scenario_counts.png
"""

from pathlib import Path
import sys

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.affordability.calculator import affordability_metrics
from src.affordability.mapper import affordability_map, most_affordable_groups, save_map
from src.affordability.scenarios import DEFAULT_INCOMES, run_scenarios, save_scenarios
from src.affordability.user_profile import BuyerProfile
from src.affordability.viz import plot_affordability_heatmap, plot_pti_by_town, plot_scenario_counts
from src.models import load_data

OUTPUT_DIR = ROOT / "outputs"
MODEL_PATH = ROOT / "models" / "xgboost_model.joblib"


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load model and data once
    model = joblib.load(MODEL_PATH)
    train_df, _ = load_data()

    # Example: median-income household
    example_profile = BuyerProfile(monthly_income=8_000)
    print("Example profile:")
    print(f"  Monthly income: S${example_profile.monthly_income:,.0f}")
    print(f"  Max affordable price: S${affordability_metrics(0, example_profile)['max_affordable_price']:,.0f}")

    print("\nBuilding affordability map...")
    result_df = affordability_map(example_profile, model=model, df=train_df)
    save_map(result_df, OUTPUT_DIR / "affordability_map.csv")
    print("\nTop 10 most affordable groups:")
    print(most_affordable_groups(result_df, top_n=10).to_string(index=False))

    print("\nRunning income scenarios...")
    scenarios_df = run_scenarios(incomes=DEFAULT_INCOMES, model=model, df=train_df)
    save_scenarios(scenarios_df, OUTPUT_DIR / "affordability_scenarios.csv")
    print(scenarios_df.to_string(index=False))

    # Combine maps across all scenario incomes for the heatmap
    print("\nBuilding multi-income map for heatmap...")
    combined_maps = []
    for income in DEFAULT_INCOMES:
        profile = BuyerProfile(monthly_income=income)
        mapped = affordability_map(profile, model=model, df=train_df)
        combined_maps.append(mapped)
    combined_df = pd.concat(combined_maps, ignore_index=True)

    print("\nGenerating plots...")
    plot_affordability_heatmap(combined_df)
    plot_pti_by_town(result_df)
    plot_scenario_counts(scenarios_df)

    print("\nAffordability engine complete.")


if __name__ == "__main__":
    main()
