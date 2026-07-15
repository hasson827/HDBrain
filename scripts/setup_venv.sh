#!/bin/bash
set -e
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install "numpy<2"
pip install -r requirements.txt
echo "Run: source .venv/bin/activate"
