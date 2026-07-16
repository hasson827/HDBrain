# HDBrain

A tool for predicting Singapore housing prices and providing home-buying advice to residents. This is the final project of our team in NUS Summer Workshop.

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
```

After running, model artifacts will be in `models/` and all metrics/plots in `outputs/`.

### 4. Configure environment variables (optional)

```bash
cp .env.example .env
# Edit .env to set your preferred Ollama model
```

### 5. Start Ollama locally

- Download and install [Ollama](https://ollama.com/).
- Pull a model, for example:

```bash
ollama pull qwen3.5:9b-mlx
```

- Keep the Ollama service running.

### 6. Run the Streamlit app

```bash
streamlit run src/app/Home.py
```

### 7. Run tests

```bash
pytest
```

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
│   ├── app/            # Streamlit app
│   ├── data/           # Data preprocessing and dataset builder
│   ├── experiment/     # Feature ablation experiments
│   ├── llm/            # LLM-related code
│   ├── models/         # Model training scripts
│   ├── run_affordability.py
│   ├── run_explain.py
│   └── run_pipeline.py
├── tests/              # Unit tests
├── config.yaml         # Project configuration
├── environment.yml     # Conda environment
├── requirements.txt    # Python dependencies
└── README.md
```

## Notes

- The Random Forest model is very large due to full-depth trees. If disk space is a concern, consider reducing `n_estimators` or `max_depth` in `src/models/random_forest.py`.
- Prediction intervals from the quantile model are calibrated on the 2017–2023 distribution; coverage on 2024 data is low due to price inflation drift. See `docs/streamlit_interface.md` for the Streamlit app interface spec.
