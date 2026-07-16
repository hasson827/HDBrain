# HDBrain

A tool for predicting Singapore HDB resale prices and providing home-buying affordability advice. This is the final project of our team in the NUS Summer Workshop.

## Large files

The following directories are **not tracked** by Git because they are too large for GitHub:

- `data/` — raw and processed CSVs (~ hundreds of MB)
- `models/` — trained model artifacts (the Random Forest model alone is ~16 GB)
- `outputs/` — metrics, plots, CSVs
- `reference/` — reference repository / external materials

These are generated locally by the scripts below.

## Quickstart

### 1. Clone the repository

```bash
git clone https://github.com/hasson827/HDBrain.git
cd HDBrain
```

### 2. Create and activate the conda environment

```bash
conda env create -f environment.yml
conda activate HDBrain
```

### 3. Generate data and train models

Place the original HDB resale price CSVs into `data/raw/`, then run:

```bash
# Build processed dataset
python src/data/preprocess_reference.py
python src/data/build_dataset.py

# Train all models, SHAP, ablation, and quantile regression
python src/run_pipeline.py

# Run affordability engine
python src/run_affordability.py

# Run unit tests
pytest
```

After running, model artifacts will be in `models/` and all metrics/plots in `outputs/`.

## Project Structure

```text
HDBrain/
├── data/               # Raw and processed datasets (not tracked)
├── docs/               # Design docs, data processing docs, interface specs
├── models/             # Trained model artifacts (not tracked)
├── outputs/            # Generated outputs (not tracked)
├── reference/          # Reference materials (not tracked)
├── src/                # Source code
│   ├── affordability/  # Affordability engine
│   ├── data/           # Data preprocessing and dataset builder
│   ├── experiment/     # Feature ablation experiments
│   ├── models/         # Model training scripts
│   ├── run_affordability.py
│   ├── run_explain.py
│   └── run_pipeline.py
├── tests/              # Unit tests
├── environment.yml     # Conda environment
├── requirements.txt    # Python dependencies
└── README.md
```

## Notes

- The Random Forest model is very large due to full-depth trees. If disk space is a concern, consider reducing `n_estimators` or `max_depth` in `src/models/random_forest.py`.
- Prediction intervals from the quantile model are calibrated on the 2017–2023 distribution; coverage on 2024 data is low due to price inflation drift. See `docs/streamlit_interface.md` for the Streamlit app interface spec.
- The affordability engine uses a default 25% downpayment and a 30% Mortgage Servicing Ratio (MSR) limit, consistent with current HDB concessionary-loan rules. See `src/affordability/` for the full calculation logic.
