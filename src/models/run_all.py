"""Run all model training scripts sequentially."""

import subprocess
import sys
from pathlib import Path

MODELS = [
    "baseline.py",
    "lr.py",
    "ridge_lr.py",
    "lasso_lr.py",
    "random_forest.py",
    "xgboost_model.py",
]

SCRIPTS_DIR = Path(__file__).resolve().parent


def main():
    for script in MODELS:
        path = SCRIPTS_DIR / script
        print(f"\n=== Running {script} ===")
        result = subprocess.run([sys.executable, str(path)], cwd=Path(__file__).resolve().parents[2])
        if result.returncode != 0:
            print(f"Failed: {script}")
            return result.returncode
    print("\n=== All models trained ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
