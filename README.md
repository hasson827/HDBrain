# HDBrain

A tool for predicting Singapore housing prices and providing home-buying advice to residents. This is the final project of our team in NUS Summer Workshop.

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

### 3. Configure environment variables (optional)

```bash
cp .env.example .env
# Edit .env to set your preferred Ollama model
```

### 4. Start Ollama locally

- Download and install [Ollama](https://ollama.com/).
- Pull a model, for example:

```bash
ollama pull qwen3.5:9b-mlx
```

- Keep the Ollama service running.

### 5. Run the Streamlit app

```bash
streamlit run src/app/Home.py
```

### 6. Run tests

```bash
pytest
```

## Project Structure

```text
HDBrain/
├── data/               # Raw and processed datasets
├── docs/               # Design docs and plans
├── models/             # Trained model artifacts
├── outputs/            # Generated outputs
├── scripts/            # Utility scripts
├── src/                # Source code
│   ├── affordability/
│   ├── app/
│   ├── data/
│   ├── explainability/
│   ├── llm/
│   └── models/
├── tests/              # Unit tests
├── config.yaml         # Project configuration
├── environment.yml     # Conda environment
├── requirements.txt    # Python dependencies
└── README.md
```
