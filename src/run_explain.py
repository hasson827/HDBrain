"""
Run interpretability and ablation analyses after models have been trained.
"""

import subprocess
import sys
from pathlib import Path

SCRIPTS = [
    "src/models/shap_analysis.py",
    "src/experiment/ablation.py",
]
ROOT = Path(__file__).resolve().parents[1]


def main():
    for script in SCRIPTS:
        print(f"\n=== Running {script} ===")
        result = subprocess.run([sys.executable, str(ROOT / script)], cwd=ROOT)
        if result.returncode != 0:
            print(f"Failed: {script}")
            return result.returncode
    print("\n=== Interpretability and ablation complete ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
