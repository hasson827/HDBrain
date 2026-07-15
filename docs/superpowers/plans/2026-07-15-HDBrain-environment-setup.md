# HDBrain 环境与 Quickstart 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 HDBrain 建立可复现的 conda 开发环境，填充核心依赖文件，并在 README.md 中提供清晰的 Quickstart。

**Architecture：** 采用 `environment.yml`（conda 管理 Python 3.12）+ `requirements.txt`（pip 管理 ML/Web/LLM/开发包）的两文件方案；README Quickstart 按 7 步命令式说明；`.env.example` 预留 Ollama 相关配置。

**Tech Stack：** Python 3.12, conda, pandas, numpy, scikit-learn, xgboost, lightgbm, shap, streamlit, ollama, matplotlib, seaborn, plotly, jupyterlab, pytest, pyyaml, python-dotenv.

## Global Constraints
- Python 版本：`3.12`
- conda 通道：`conda-forge`（优先）+ `defaults`
- 依赖版本：使用 `>=` 下限，避免锁定过死
- 所有新增文件必须可独立验证
- README Quickstart 假设用户已安装 conda 和 git

---

### Task 1: 创建 `environment.yml`

**Files:**
- Create: `environment.yml`

**Interfaces:**
- Produces: `hdbrain` conda environment definition.

- [ ] **Step 1: Write `environment.yml`**

```yaml
name: HDBrain
channels:
  - conda-forge
  - defaults
dependencies:
  - python=3.12
  - pip
  - pip:
      - -r requirements.txt
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python -c "import yaml; yaml.safe_load(open('environment.yml'))"`
Expected: no output / no exception.

- [ ] **Step 3: Commit**

```bash
git add environment.yml
git commit -m "chore: add conda environment definition"
```

---

### Task 2: 创建 `requirements.txt`

**Files:**
- Create: `requirements.txt`

**Interfaces:**
- Produces: pip-installable dependency list consumed by `environment.yml`.

- [ ] **Step 1: Write `requirements.txt`**

```text
# Data manipulation
pandas>=2.0
numpy>=1.24

# Machine learning
scikit-learn>=1.4
xgboost>=2.0
lightgbm>=4.0

# Explainability
shap>=0.45

# Web app
streamlit>=1.32

# Local LLM
ollama>=0.1

# Visualization
matplotlib>=3.8
seaborn>=0.13
plotly>=5.18

# Exploration and testing
jupyterlab>=4.0
pytest>=8.0

# Configuration and utilities
pyyaml>=6.0
python-dotenv>=1.0
```

- [ ] **Step 2: Check file is non-empty and readable**

Run: `wc -l requirements.txt`
Expected: at least 25 lines.

- [ ] **Step 3: Commit**

```bash
git add requirements.txt
git commit -m "chore: add project dependencies"
```

---

### Task 3: 创建 `.env.example`

**Files:**
- Create: `.env.example`

**Interfaces:**
- Produces: template environment variables for Ollama and optional secrets.

- [ ] **Step 1: Write `.env.example`**

```text
# Local Ollama server URL
OLLAMA_HOST=http://localhost:11434

# Default model for home-buying advice
OLLAMA_MODEL=llama3.2

# Optional: data paths
# DATA_RAW_DIR=data/raw
# DATA_PROCESSED_DIR=data/processed
```

- [ ] **Step 2: Validate file exists and has expected keys**

Run: `grep -E '^(OLLAMA_HOST|OLLAMA_MODEL)=' .env.example`
Expected: two matching lines.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add environment variable template"
```

---

### Task 4: 更新 `README.md` 添加 Quickstart

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `environment.yml`, `requirements.txt`, `.env.example`, and project structure.
- Produces: README with Quickstart section.

- [ ] **Step 1: Read current `README.md`**

Run: `cat README.md`
Expected: existing 2-line project description.

- [ ] **Step 2: Append Quickstart section**

Final `README.md` should look like:

```markdown
# HDBrain

A tool for predicting Singapore housing prices and providing home-buying advice to residents. This is the final project of our team in NUS Summer Workshop.

## Quickstart

### 1. Clone the repository

```bash
git clone <repository-url>
cd HDBrain
```

### 2. Create and activate the conda environment

```bash
conda env create -f environment.yml
conda activate hdbrain
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables (optional)

```bash
cp .env.example .env
# Edit .env to set your preferred Ollama model
```

### 5. Start Ollama locally

- Download and install [Ollama](https://ollama.com/).
- Pull a model, for example:

```bash
ollama pull llama3.2
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
```

- [ ] **Step 3: Verify README renders correctly**

Run: `python -c "import markdown" 2>/dev/null || echo 'markdown optional'`
Fallback: visually confirm section headers and code fences.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add Quickstart and project structure to README"
```

---

### Task 5: 创建并验证 conda 环境

**Files:**
- Uses: `environment.yml`, `requirements.txt`

**Interfaces:**
- Produces: working `hdbrain` conda environment.

- [ ] **Step 1: Create conda environment**

Run: `conda env create -f environment.yml`
Expected: environment `hdbrain` created successfully.

- [ ] **Step 2: Activate environment and check Python version**

Run:
```bash
conda activate hdbrain
python --version
```
Expected: `Python 3.12.x`

- [ ] **Step 3: Verify key imports**

Run:
```bash
python -c "import pandas, numpy, sklearn, xgboost, lightgbm, shap, streamlit, ollama, matplotlib, seaborn, plotly, yaml, dotenv; print('all imports ok')"
```
Expected: `all imports ok`

- [ ] **Step 4: Run pytest**

Run: `pytest`
Expected: `collected 0 items` (no tests yet) with exit code 5, which is acceptable at this stage.

- [ ] **Step 5: Commit environment verification log (optional)**

No file change required; do not commit generated conda files.

---

## Self-Review

**Spec coverage:**
- `environment.yml` for Python 3.12 → Task 1
- `requirements.txt` with core/dev dependencies → Task 2
- `.env.example` for Ollama config → Task 3
- README Quickstart with 7 steps → Task 4
- Environment creation and import verification → Task 5

**Placeholder scan:**
- No TBD/TODO.
- No vague "add error handling" statements.
- All code blocks contain concrete content.

**Type consistency:**
- N/A for configuration/docs plan; no code interfaces between tasks.
