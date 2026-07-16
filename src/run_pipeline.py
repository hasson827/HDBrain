"""
Full pipeline: train all models, generate quantile intervals, visualisations,
SHAP interpretability, and ablation experiments.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

STAGES = [
    ("Train all base models", ["src/models/run_all.py"]),
    ("Quantile regression", ["src/models/quantile_interval.py"]),
    ("Model comparison visualisation", ["src/models/viz.py"]),
    ("SHAP interpretability", ["src/models/shap_analysis.py"]),
    ("Feature ablation", ["src/experiment/ablation.py"]),
]


def run_script(script):
    result = subprocess.run([sys.executable, str(ROOT / script)], cwd=ROOT)
    return result.returncode


def main():
    (ROOT / "models").mkdir(parents=True, exist_ok=True)
    (ROOT / "outputs").mkdir(parents=True, exist_ok=True)

    for stage_name, scripts in STAGES:
        print(f"\n{'='*60}\n{stage_name}\n{'='*60}")
        for script in scripts:
            print(f"\n--- Running {script} ---")
            rc = run_script(script)
            if rc != 0:
                print(f"FAILED: {script}")
                return rc

    print("\n" + "=" * 60)
    print("Full pipeline completed successfully.")
    print("Models saved to: models/")
    print("Metrics and plots saved to: outputs/")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
