# README_XCH — HDBrain 前端负责人工作文档

> **文档定位**：这是 XCH（前端负责人）的个人主工作文档。后续所有审核记录、训练记录、前端设计、与后端同学的沟通事项，都按下面的章节框架追加到本文档，不另开新文件。
> **上游文档**：[IDEA5_HDBrain_MASTER.md](./Brianstorming/IDEA5_HDBrain_MASTER.md)（项目 Idea 主文档）｜ [HDBrain/README.md](./HDBrain/README.md)（后端仓库说明）
> **创建日期**：2026-07-16 ｜ 项目 DDL：2026-07-23（**剩余 7 天**）

---

## 目录（框架）

1. [§1 项目快照（路径地图与当前状态）](#1-项目快照)
2. [§2 后端完成情况审核（v1，2026-07-16）](#2-后端完成情况审核v12026-07-16)
3. [§3 训练指南（我要在命令行里做什么）](#3-训练指南)
4. [§4 训练结果记录（待填）](#4-训练结果记录)
5. [§5 下一步规划：前端 v1 与未来工作](#5-下一步规划)
6. [§6 与后端同学的沟通清单](#6-与后端同学的沟通清单)
7. [§7 工作日志（追加区）](#7-工作日志)

---

## 1. 项目快照

### 1.1 路径地图

| 路径 | 内容 | 备注 |
|---|---|---|
| `Project/Brianstorming/` | 初期调研材料 + Idea 主文档 | 只读参考 |
| `Project/Brianstorming/IDEA5_HDBrain_MASTER.md` | 项目 Idea/需求总纲 | MVP 章节已于 2026-07-16 删除 |
| `Project/HDBrain/` | 后端同学的 git 仓库（`main` 分支） | **不要乱改**；前端代码后续会加进这里 |
| `Project/HDBrain/data/` | 我手动下载的数据（不进 git） | 含 raw + processed + `hdb_dataset.csv`，见 §1.2 |
| `Project/HDBrain/docs/` | 后端写的文档 | `data_processing.md`（数据链路）、`streamlit_interface.md`（**给前端的接口规范，必读**） |
| `Project/HDBrain/models/`、`outputs/` | 训练产物（不进 git） | **目前不存在，需我训练生成**，见 §3 |
| `Project/README_XCH.md` | 本文档 | — |

### 1.2 数据状态（已核实，2026-07-16）

- `data/hdb_dataset.csv`（283 MB）：**最终 ML 训练集，已就绪**。实测 981,450 行，覆盖 1990-01 至 2026-07；29 个特征列 + 目标列 `real_price` + 2 个元数据列（`town`、`flat_type`，仅供 baseline 分组，不进模型）。
- `data/processed/hdb_resale_model_dataset.csv`（268 MB）：交易级宽表（中间产物），也已在下载包里。
- `data/raw/`：5 个年代段的官方成交 CSV + CPI + 各类设施坐标文件，文件名与 `src/data/preprocess_reference.py` 里硬编码的名字**逐一核对过，全部匹配**。
- **结论：数据预处理两步（preprocess / build_dataset）不需要我重跑**，可以直接进入模型训练。
- 时间切分：train = year ≤ 2023（约 91.5 万行），test = year ≥ 2024（66,097 行 = 2024:27,832 + 2025:25,085 + 2026:13,180）。

### 1.3 环境状态

- 磁盘：D 盘剩余约 163 GB，足够容纳 ~16 GB 的 Random Forest 模型文件。
- 仓库依赖：conda 环境 `HDBrain`（python 3.12 + `requirements.txt`）。**我还没创建这个环境**（见 §3 第 0 步）。

---

## 2. 后端完成情况审核（v1，2026-07-16）

> 审核方式：逐文件通读 `src/` 全部 22 个 Python 文件 + `docs/` 两份文档 + README + git log。以下先给总评，再给对照表，最后是问题/风险清单。

### 2.1 总评

**后端把「数据管道 + 建模评估 + 负担能力引擎」三条 workstream 的 v1 做完了，代码风格统一、结构清晰、有中文文档，且专门为前端写了接口规范（`docs/streamlit_interface.md`），交接质量高。**
主要缺口有两类：一是 **README 描述与实际仓库不符**（宣称的 `src/app/`、`src/llm/`、`tests/`、`config.yaml` 实际不存在，git log 显示曾被 reset/移除）；二是相对 Idea 文档（§4.1）**评估设计还缺几块拉分项**（随机切分对照、调参、分组误差公平性审计、滞后特征）。负担能力引擎目前是简化版（只有 MSR，没有 TDSR/LTV 双路径）。这些都不阻塞我先训练和搭前端，但要列入 v2 和沟通清单。

### 2.2 与 Idea 文档（IDEA5 §4/§6）的对照表

| Workstream | Idea 文档要求 | 实际完成情况 | 判定 |
|---|---|---|---|
| **W1 数据管道** | data.gov.sg 全量数据、清洗、地理特征（MRT/CBD 距离）、防泄漏滞后特征 | ✅ 1990–2026 全量 98 万行；✅ 楼层/租期/楼型清洗；✅ 地理特征**超出预期**——不止 MRT/CBD，还有学校/小贩中心/公园/商场/超市 6 类设施的最近距离 + 2km 计数（复现自参考仓库 teyang-lau/HDB_Resale_Prices 的坐标数据，非 OneMap 实时编码）；❌ 镇区滞后中位价特征未做 | **90%** |
| **W2 建模** | Baseline→LR/Ridge/Lasso→RF→XGBoost、时间切分、quantile 区间、SHAP、消融 | ✅ 6 个模型统一脚手架（`src/models/`）；✅ 时间切分（≤2023 / ≥2024）；✅ XGBoost 多分位数模型（q05/q50/q95）+ 覆盖率校验；✅ SHAP（beeswarm/bar/瀑布图）；✅ 12 组特征消融（`src/experiment/ablation.py`）；❌ 随机切分对照未做；❌ GridSearchCV/TimeSeriesSplit 调参未做；❌ 分镇区/楼型/价格段误差审计未做；❌ LightGBM 在 requirements 里但无模型脚本 | **75%** |
| **W3 负担能力引擎** | MSR/TDSR/LTV/BSD/月供、HDB vs 银行双路径、反向求解、与官方计算器对拍 | ✅ 等额本息月供 + 反向求解最高可负担价；✅ BSD 印花税分级（2024/25 税率）；✅ MSR 约束 + 多收入情景 + 热力图；❌ TDSR 55% 未做（无现有债务输入）；❌ LTV 双路径未做（首付默认 10%，与现行 HDB 贷款 LTV 75% 即首付 25% 的政策不符）；❌ 无单元测试对拍 | **60%** |
| **W4 Web 前端** | Streamlit 六页应用 | ❌ 未做（这是我的活）。✅ 但接口文档 `docs/streamlit_interface.md` 已写好，含调用示例、表单字段、地图方案、缓存建议 | **0%（按分工正常）** |
| **LLM 辅助** | 报告生成 + 降级方案 | ❌ 只有 `.env.example`（Ollama 配置）和 requirements 里的 `ollama` 依赖，无任何 LLM 代码 | **5%** |

### 2.3 关键技术事实（前端开发必须知道）

1. **目标变量是 `real_price`（CPI 通胀调整后价格），不是名义成交价 `resale_price`**。计算方式 `real_price = resale_price / cpi × 100`（CPI 基期约 2019=100）。注意：CPI 文件只到 2020-09，之后的月份被 forward-fill——所以 **2020-10 之后 real ≈ nominal（名义价）**，前端展示时预测值可以近似按"当前新元"处理，但 1990–2020 的历史数据是通胀调整过的。README 里说"quantile 区间在 2024 年数据上覆盖率低（价格通胀漂移）"就是这个设计的直接后果。
2. **模型输入是 29 列纯数值特征向量**（列名见 `docs/data_processing.md` §3.7）。前端把用户表单输入变成这 29 列，是**前端最核心的胶水逻辑**（楼层区间→`storey_range_code`（映射表在 `src/data/build_dataset.py` 的 `STOREY_ORDER`）、town→region one-hot、flat_model→5 大类 one-hot、月份→sin/cos、设施距离需按 town 中位数查表填充）。
3. **`metrics.py` 里的 "mape" 实际是中位数绝对百分比误差（median APE）**，不是均值 MAPE。这恰好和行业标杆 SRX X-Value 的口径（中位误差 2.8%）一致，对表有利，但展示时须写清楚"Median APE"。
4. 随机森林 `max_depth=None`（全深度树）× 200 棵 × 91.5 万训练样本 = **~16 GB 模型文件**，这就是"训练结果太大不进 git、要我重新训练"的原因。
5. Baseline 预测的分组键是 (`town`, `flat_type`)；CBD 距离用的锚点是 **Dhoby Ghaut**（非 Idea 文档说的 Raffles Place，差异极小，无影响）。

### 2.4 问题/风险清单（按严重度排序）

| # | 问题 | 严重度 | 影响与建议 |
|---|---|---|---|
| 1 | **README 与实际不符**：宣称的 `src/app/`（Streamlit）、`src/llm/`、`tests/`、`config.yaml` 都不存在；Quickstart 第 4-7 步（.env / Ollama / streamlit run / pytest）目前全部无法执行 | 高（文档层面） | 训练只需 Quickstart 第 3 步的后两条命令。README 需要修正（沟通清单 #1） |
| 2 | **负担能力引擎政策参数过时/缺失**：首付默认 10%（对应旧政策 90% LTV；2024-08 起 HDB 贷款 LTV 已降至 75% → 首付 25%）；无 TDSR、无现有债务字段 | 高（业务正确性） | 前端 v1 可先把首付做成滑块（默认改 0.25）并加说明；TDSR 补齐列入 v2（沟通清单 #2） |
| 3 | **评估缺 3 个拉分项**：随机切分 vs 时间切分对照、调参（GridSearchCV/TimeSeriesSplit）、分组误差公平性审计（Responsible AI 页的素材） | 中（评分相关） | 不阻塞前端；列入 v2 建模待办（沟通清单 #3） |
| 4 | `requirements.txt` **缺 `geopy`**（`preprocess_reference.py` 要用）；也缺前端要用的 `folium`/`streamlit-folium` | 中 | 我不跑 preprocess 所以暂不受影响；做前端时我自己补装并提 PR 更新 requirements |
| 5 | `mapper.py` 用 `max` 聚合 one-hot dummies，可能让一个代表性画像同时属于多个 flat_model 类别（注释说"取最常见类别"与实现不符）；`_aggregate_dummies` 是死代码 | 低-中 | 对 Affordability 地图的预测值有轻微失真；提醒后端（沟通清单 #4） |
| 6 | `validate_reference.py` 依赖 `reference/` 目录（未跟踪、我没有下载） | 低 | 仅验证用，不在训练管线里，可忽略 |
| 7 | 训练/测试切分里 **2026 年只有半年数据且在测试集**；quantile 覆盖率在 2024+ 偏低（README 自己承认） | 低（已知限制） | 前端展示置信区间时加"区间按 2017–2023 分布校准"的脚注；v2 可做区间校准（conformal） |

---

## 3. 训练指南

> 目标：生成 `models/`（6+1 个模型文件）和 `outputs/`（全部指标 JSON/CSV + 图）。
> 以下命令在 **Anaconda Prompt 或 PowerShell** 中执行均可。**不要用全局 Python 直接装包**（Brainstorming 阶段踩过 numpy/shap 版本冲突把全局环境搞坏的坑，务必用隔离环境）。

### 第 0 步：创建并激活 conda 环境（只需一次）

```cmd
cd /d "D:\XCH\STUDY\0.6 Exchange\NUS\AI - ML for Financial Services\Project\HDBrain"
conda env create -f environment.yml
conda activate HDBrain
```

- 若机器上没有 conda：装 [Miniconda](https://docs.conda.io/en/latest/miniconda.html)；或退而求其次用 venv：`python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt`。
- PowerShell 里 `cd /d` 不适用，直接 `cd "D:\...\HDBrain"` 即可。

### 第 1 步：跳过数据预处理（已确认无需执行）

README Quickstart 里的 `python src/data/preprocess_reference.py` 和 `python src/data/build_dataset.py` **不用跑**——下载包里已含最终训练集 `data/hdb_dataset.csv`（981,450 行，已实测可正常读取）。
（如果以后数据更新了才需要重跑这两步，且要先 `pip install geopy`——requirements 里漏了它。）

### 第 2 步：训练全部模型 + 评估 + SHAP + 消融

```cmd
python src/run_pipeline.py
```

它按顺序执行 5 个阶段（任一阶段失败会停下并打印 `FAILED: <脚本名>`）：

| 阶段 | 脚本 | 产物 | 预计耗时 |
|---|---|---|---|
| 1. 六模型训练 | `src/models/run_all.py` | `models/*_model.joblib` ×6、`outputs/*_metrics.json` ×6 | RF 最慢（全深度树 + 写 16GB 文件，可能 10–30 分钟）；其余每个 <5 分钟 |
| 2. 分位数区间 | `src/models/quantile_interval.py` | `models/quantile_model.joblib`、`outputs/quantile_metrics.csv`、`quantile_intervals.png` | 几分钟 |
| 3. 模型对比图 | `src/models/viz.py` | `outputs/model_comparison.csv`、`model_comparison_test.png` | 秒级 |
| 4. SHAP 解释 | `src/models/shap_analysis.py` | `outputs/shap_summary.png`、`shap_bar.png`、`shap_waterfall_*.png`、`shap_feature_importance.csv` | 几分钟 |
| 5. 特征消融 | `src/experiment/ablation.py` | `outputs/ablation_results.csv`、`ablation_drop.csv/png` | **最耗时**：重训 XGBoost ~11 次，估 15–40 分钟 |

**总预计 30–90 分钟**（视 CPU）。同学说"很快"大概率指的是 XGBoost 部分；RF 和消融是大头。

### 第 3 步：跑负担能力引擎

```cmd
python src/run_affordability.py
```

依赖第 2 步产出的 `models/xgboost_model.joblib`，产出 `outputs/affordability_map.csv`、`affordability_scenarios.csv` 和 3 张图。耗时几分钟。

### 第 4 步：验收清单（跑完后逐项核对）

- [ ] `models/` 下有 7 个 `.joblib`（baseline / linear / ridge / lasso / random_forest / xgboost / quantile），其中 `random_forest_model.joblib` 约 16 GB。
- [ ] `outputs/` 下有 6 个 `*_metrics.json` + `model_comparison.csv`。
- [ ] 打开 `model_comparison.csv`，对照性能锚点：**XGBoost test R² 应在 0.9 上下、Median APE 个位数百分比**（Idea 文档锚点：文献 R²≈0.96–0.98、SRX 中位误差 2.8%；因是严格时间外推，略低正常）。
- [ ] `quantile_metrics.csv` 里 test 的 `coverage_90` ——预期**明显低于 0.90**（README 已预告的通胀漂移问题），记下实际数字。
- [ ] 把关键数字填进本文档 §4。

### 补充说明

- **磁盘**：需 ~20 GB 空闲（已确认 D 盘剩 163 GB ✅）。**内存**：91.5 万行 × 200 棵全深度树，训练期间 RF 可能吃 10GB+ 内存，建议关闭大型程序后再跑。
- 分步执行也可以：只想先看 XGBoost 就 `python src/models/xgboost_model.py`；训练完只重跑解释分析用 `python src/run_explain.py`（= SHAP + 消融）。
- README Quickstart 里的 `.env` / Ollama / `streamlit run src/app/Home.py` / `pytest` **这次都不用管**——对应代码尚不存在（见 §2.4 #1）。

---

## 4. 训练结果记录

> （待训练完成后填写：各模型 test RMSE / MAE / R² / Median APE、quantile coverage、消融结论、与 SRX 2.8% 的对比、实际耗时、踩坑记录。）

---

## 5. 下一步规划

### Phase A：验证训练产物（拿到结果当天）

1. 按 §3 第 4 步验收清单核对产物完整性，把数字填进 §4。
2. 快速 sanity check：手工挑 2–3 笔近期真实成交（data/raw 最新 CSV 里找），用 XGBoost 预测对比误差是否在个位数百分比。
3. 如果 RF 的 16GB 确认无误 → 前端**不加载 RF**，只加载 XGBoost（点估计）+ quantile（区间），Model Arena 页用 `outputs/*.json` 静态数据展示 RF 成绩即可。

### Phase B：前端 v1（Streamlit，本周核心工作）

**页面结构**（按 IDEA5 §3.3 六页 + `docs/streamlit_interface.md` 的接口规范）：

| 优先级 | 页面 | 数据/模型依赖 | 要点 |
|---|---|---|---|
| P0 | 💰 AI Valuation | `xgboost_model.joblib` + `quantile_model.joblib` | 表单 → 29 列特征向量 → 点估计 + 90% 区间 + SHAP 瀑布（可用 `shap.TreeExplainer` 在线算单样本，毫秒级）+ 同类成交对照表（从 processed CSV 按 town/flat_type/面积近邻查） |
| P0 | 🗺️ Affordability | `affordability_map()`（<1s/全量 1500 组） | 表单（收入/首付/利率/年限/MSR/CPF）→ 地图（folium CircleMarker，坐标用 `data/raw/flat_coordinates_clean.csv` 按 town 聚合）+ Top10 表 |
| P0 | ⚔️ Model Arena | `outputs/*.json`、`*.png`（纯静态） | 直接读训练产物渲染，无模型加载，最容易先做 |
| P1 | 📈 Market Pulse | processed CSV 聚合 | 镇区指数曲线 + 租期衰减滑块（Lease Decay Lab 并入此页：固定特征滑动 remaining_lease 调用 XGBoost） |
| P1 | 🛡️ Responsible AI | 静态文案 + `quantile_metrics.csv` | 必写：非持牌估价声明、区间按 2017–2023 校准的漂移问题、real_price 语义 |
| P1 | 🏠 Home | — | 最后写 |

**前端技术准备事项**：

1. 补装依赖：`folium`、`streamlit-folium`（并提 PR 加进 requirements.txt）。
2. 写核心胶水模块（建议 `src/app/feature_builder.py`）：用户输入 → 29 列特征向量。复用 `build_dataset.py` 里的 `STOREY_ORDER` / `REGION_MAP` / `MODEL_MAP` 常量（直接 import，别复制粘贴）。
3. 设施距离特征的填充策略：用户只会输入 town/楼型/楼层/面积/租期，6 类设施距离用「该 town 的中位数」查表（可预计算一张 town → 中位设施特征表存 CSV，启动时加载）。
4. 缓存策略：`@st.cache_resource` 加载模型、`@st.cache_data` 加载数据；**云端部署时不带 RF 和 268MB 宽表**（Streamlit Cloud 内存限制，IDEA5 §8 风险表早有预告）——明细对照表预生成聚合索引。
5. 首付滑块默认值改 0.25（现行 HDB LTV 75%），UI 注明政策出处（MAS，2024-08）。

### Phase C：v2+ 待办池（按价值排序，与团队分工协商）

1. LLM 顾问报告（Ollama 本地 + 无服务降级为模板文本——降级设计本身是 Responsible AI 卖分点）。
2. 负担能力引擎补 TDSR/LTV 双路径 + MoneySense 官方计算器对拍单测。
3. 建模补拉分项：随机 vs 时间切分对照、调参、分镇区/楼型/价格段误差审计、（可选）conformal 区间校准解决 2024+ 覆盖率低的问题。
4. 部署 Streamlit Community Cloud + 故事线走查（Wei Ling 剧本）。
5. 文档/Poster/Slides（Workstream 5，全员）。

### 时间线建议（DDL 2026-07-23，剩 7 天）

- **07-16（今天）**：跑训练（§3）→ 填 §4 → 开工 Model Arena + Valuation 页。
- **07-17~19**：前端 P0 三页完成并接真模型。
- **07-20~21**：P1 三页 + LLM（若来得及）+ 部署。
- **07-22~23**：冻结、文档、poster、彩排（对应 IDEA5 里程碑 M4）。

---

## 6. 与后端同学的沟通清单

> （提出时机：下次组会/群消息；均不阻塞我当前工作）

1. **README 修正**：Project Structure 和 Quickstart 里 `src/app/`、`src/llm/`、`tests/`、`config.yaml`、Ollama 步骤与实际仓库不符（git log 显示被 reset 掉了）——是打算后面补，还是 README 该改？
2. **首付/LTV 参数**：`BuyerProfile.downpayment_pct=0.10` 对应旧政策；现行 HDB 贷款 LTV 75%。v2 是否由后端补 TDSR + 双贷款路径，还是我在前端层处理？
3. **评估补强**：随机切分对照、调参、分组误差审计（Responsible AI 素材）是否列入他的 v2？
4. **mapper.py 小问题**：one-hot dummies 用 `max` 聚合与"最常见类别"注释不符 + `_aggregate_dummies` 死代码；顺带 `requirements.txt` 缺 `geopy`。
5. **确认 LLM 模块归属**（Ollama 依赖和 .env 都留好了，代码谁写？）。
6. **训练耗时确认**：他说"很快"——RF 全深度树在他机器上实际跑了多久？（校准我的预期）

---

## 7. 工作日志

| 日期 | 事项 | 产出 |
|---|---|---|
| 2026-07-16 | 通读 IDEA5 主文档与 HDBrain 仓库全部源码/文档；核实数据下载完整性（981,450 行，1990–2026-07，文件名与脚本匹配）；完成后端 v1 审核（§2）；编写训练指南（§3）与前端规划（§5）；从 IDEA5 文档中删除已废弃的 MVP 章节 | 本文档 v1 |
