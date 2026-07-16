"""Visualisations for the affordability engine."""

from pathlib import Path
import sys

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

OUTPUT_DIR = ROOT / "outputs"


def plot_affordability_heatmap(result_df: pd.DataFrame, output_path: Path = None):
    """Heatmap: town vs monthly income, colour = affordability gap."""
    if output_path is None:
        output_path = OUTPUT_DIR / "affordability_heatmap.png"

    # Use the most common flat_type per town for a clean view
    pivot = result_df.groupby(["town", "monthly_income"])["affordability_gap"].mean().unstack()

    plt.figure(figsize=(14, 10))
    sns.heatmap(
        pivot,
        cmap="RdYlGn_r",
        center=0,
        linewidths=0.5,
        annot=False,
        fmt=".0f",
        cbar_kws={"label": "Affordability gap (SGD)"},
    )
    plt.title("Affordability Gap by Town and Monthly Income\n(green = affordable, red = unaffordable)")
    plt.xlabel("Monthly household income (SGD)")
    plt.ylabel("Town")
    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    print(f"Saved heatmap to {output_path}")
    plt.close()


def plot_pti_by_town(result_df: pd.DataFrame, output_path: Path = None):
    """Bar plot of median payment-to-income ratio by town."""
    if output_path is None:
        output_path = OUTPUT_DIR / "affordability_pti.png"

    median_pti = result_df.groupby("town")["pti"].median().sort_values(ascending=True)

    plt.figure(figsize=(12, 8))
    colors = ["#2ca02c" if v <= 0.30 else "#d62728" for v in median_pti]
    median_pti.plot(kind="barh", color=colors)
    plt.axvline(0.30, color="black", linestyle="--", label="30% MSR limit")
    plt.xlabel("Median payment-to-income ratio (PTI)")
    plt.title("Median Mortgage Payment-to-Income Ratio by Town")
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    print(f"Saved PTI plot to {output_path}")
    plt.close()


def plot_scenario_counts(scenarios_df: pd.DataFrame, output_path: Path = None):
    """Bar plot of number of affordable groups per income scenario."""
    if output_path is None:
        output_path = OUTPUT_DIR / "affordability_scenario_counts.png"

    plt.figure(figsize=(10, 6))
    plt.bar(scenarios_df["monthly_income"].astype(str), scenarios_df["num_affordable_groups"])
    plt.xlabel("Monthly household income (SGD)")
    plt.ylabel("Number of affordable town/flat/storey groups")
    plt.title("Affordable Housing Options by Household Income")
    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    print(f"Saved scenario counts to {output_path}")
    plt.close()
