"""Pytest configuration: ensure the project root is on PYTHONPATH."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
