# HDBrain 环境与 Quickstart 设计

## 目标
为 HDBrain（新加坡房价预测与购房建议工具）建立一套可复现的本地开发环境，并在 README.md 中提供清晰的 Quickstart，使新成员能在 10 分钟内跑起来。

## 技术栈确认
- **Python 版本**：3.12
- **数据处理**：pandas, numpy
- **机器学习**：scikit-learn, xgboost, lightgbm
- **可解释性**：shap
- **Web 应用**：streamlit（多页应用）
- **本地 LLM**：Ollama（通过 `ollama` Python 客户端调用）
- **可视化**：matplotlib, seaborn, plotly
- **探索/调试**：jupyterlab, pytest
- **配置/工具**：pyyaml, python-dotenv

## 方案选择：方案 B
采用 `environment.yml` + `requirements.txt` 组合：
- `environment.yml` 负责指定 Python 3.12 和 conda-forge 通道，并通过 `pip` 引入 `requirements.txt`。
- `requirements.txt` 负责所有具体包的版本约束。

优点：
- conda 管理 Python 解释器，版本稳定。
- pip 安装 ML/Web/LLM 包，版本更及时。
- Quickstart 命令清晰、两步完成。

## 文件变更
1. `environment.yml`：新建，定义 `HDBrain` 环境。
2. `requirements.txt`：新建/填充，列出核心与开发依赖。
3. `README.md`：新增 Quickstart 章节。
4. `.env.example`（可选但推荐）：预留 `OLLAMA_HOST` / `OLLAMA_MODEL` 等环境变量示例。

## README Quickstart 结构
```markdown
## Quickstart

1. 克隆仓库
   ```bash
   git clone <repo-url>
   cd HDBrain
   ```

2. 创建并激活 conda 环境
   ```bash
   conda env create -f environment.yml
   conda activate HDBrain
   ```

3. 安装/更新依赖
   ```bash
   pip install -r requirements.txt
   ```

4. 配置环境变量（可选）
   ```bash
   cp .env.example .env
   # 按需编辑 .env
   ```

5. 启动 Ollama 本地服务
   - 下载并安装 [Ollama](https://ollama.com/)
   - 拉取模型：`ollama pull <model-name>`
   - 保持 Ollama 服务运行

6. 运行 Streamlit 应用
   ```bash
   streamlit run src/app/Home.py
   ```

7. 运行测试
   ```bash
   pytest
   ```
```

## 验证步骤
- `conda activate HDBrain` 成功。
- `python --version` 显示 3.12.x。
- `python -c "import pandas, sklearn, xgboost, lightgbm, streamlit, ollama; print('ok')"` 无报错。
- `pytest` 可正常收集（当前无测试用例，显示 `collected 0 items`）。

## 依赖清单（初稿）
```text
pandas>=2.0
numpy>=1.24
scikit-learn>=1.4
xgboost>=2.0
lightgbm>=4.0
shap>=0.45
streamlit>=1.32
ollama>=0.1
matplotlib>=3.8
seaborn>=0.13
plotly>=5.18
jupyterlab>=4.0
pytest>=8.0
pyyaml>=6.0
python-dotenv>=1.0
```
