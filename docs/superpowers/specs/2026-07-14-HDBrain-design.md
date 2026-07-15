# HDBrain 10 天单人实施设计文档

> 上游文档：
> - `docs/BRAINSTORMING_MASTER.md`（Idea 5 横向对比）
> - `docs/IDEA5_HDBrain_MASTER.md`（HDBrain 概念展开与 MVP 说明）
>
> 本设计基于接口驱动并行方案（方案 B），按单人实现重新编排。

---

## 1. 项目背景与目标

HDBrain 是新加坡组屋（HDB）转售价格的 ML 估值与购房负担能力顾问。核心定位：

> 一个可解释的、基于 ML 的自动估值模型（AVM），叠加 MAS 购房贷款规则引擎（MSR/TDSR/LTV），把问题从“这套房值多少”反转为“以我现在的财务状况，我能买哪里的房”。

本项目为 NUS SOC Summer Workshop — AI/ML for Financial Services（SWS3022）课程期末项目，评分权重最高的是“数据 → 特征工程 → 多模型对比 → 评估”这条 ML 主线，因此设计优先保证 ML  pipeline 的完整性与严谨性，Web 应用使用轻量 Streamlit 实现。

---

## 2. 范围与成功标准

### 2.1 交付物优先级

| 优先级 | 交付物 | 说明 |
|---|---|---|
| P0 | 可运行的 Streamlit 多页应用 | 6 页：Home / AI Valuation / Affordability / Market Pulse / Model Arena / Responsible AI |
| P0 | 完整数据管道 | 合并 5 个 CSV → 清洗 → OneMap 精确地理编码 → 特征工程 → `enriched_dataset.parquet` |
| P0 | 多模型对比实验 | Baseline / LR / Ridge / RF / XGBoost，随机切分 + 时间切分双轨评估 |
| P0 | 负担能力引擎 | MSR/TDSR/LTV/月供/BSD 规则，输出最高可负担价 |
| P1 | SHAP 逐样本解释 + 置信区间 | 估值卡的核心展示 |
| P1 | 地图热力图 + 租期衰减实验室 | 视觉记忆点 |
| P1 | LLM 报告生成（含降级） | 一键生成购房顾问报告，使用 DeepSeek API |
| P1 | K-means 镇区聚类 | 无监督学习加分项，放入 Market Pulse 页 |
| P2 | ACM 4 页短论文 | 时间富余则做 |

### 2.2 成功标准

1. Streamlit 应用能在本地和 Streamlit Cloud 跑通，完成一次 Wei Ling 故事线走查无报错。
2. 模型对比表至少包含 5 个模型，时间切分评估有真实数字。
3. 负担能力引擎与 MoneySense 官方算例误差 ≤1%。
4. LLM 失败时核心功能不降速、不报错。

---

## 3. 文件结构与模块边界

```
HDBrain/
├── data/
│   ├── raw/                    # 5 个原始 CSV，不动
│   ├── processed/
│   │   └── enriched_dataset.parquet
│   └── external/
│       ├── mrt_stations.csv
│       ├── block_coords.csv    # OneMap 地理编码缓存
│       └── planning_area.geojson
├── src/
│   ├── data/                   # 数据管道
│   │   ├── load.py             # 读 5 个 CSV，统一 schema
│   │   ├── clean.py            # 清洗：租期解析、楼层中点、异常值
│   │   ├── geocode.py          # OneMap 调用 + 本地缓存
│   │   ├── features.py         # 特征工程：MRT/CBD 距离、滞后价格
│   │   └── build_dataset.py    # 一键生成 enriched_dataset.parquet
│   ├── models/
│   │   ├── train.py            # 统一训练接口
│   │   ├── evaluate.py         # 评估函数：RMSE/MAE/R²/MAPE
│   │   ├── predict.py          # 在线预测封装
│   │   └── experiments.py      # 实验矩阵：随机/时间切分、消融
│   ├── affordability/
│   │   ├── rules.py            # MSR/TDSR/LTV/月供/BSD 纯函数
│   │   └── solver.py           # 反向求解最高可负担价
│   ├── explainability/
│   │   ├── shap_explainer.py   # SHAP 计算与可视化数据
│   │   └── comparables.py      # 同类成交检索
│   ├── llm/
│   │   ├── client.py           # 薄封装 + 降级
│   │   └── prompts.py          # 所有 prompt 模板
│   └── app/
│       ├── Home.py
│       └── pages/
│           ├── 01_AI_Valuation.py
│           ├── 02_Affordability.py
│           ├── 03_Market_Pulse.py
│           ├── 04_Model_Arena.py
│           └── 05_Responsible_AI.py
├── models/                     # 落盘模型
├── outputs/                    # metrics.json、图表
├── tests/                      # 单元测试
├── config.yaml                 # 政策参数、路径、API key
├── requirements.txt
└── README.md
```

### 模块依赖规则

- `data/` 不依赖 `models/` 和 `app/`。
- `models/` 只依赖 `data/` 输出的 parquet。
- `affordability/` 只依赖 `config.yaml`。
- `app/` 调用 `models.predict`、`affordability.solver`、`llm.client`，不直接碰原始 CSV。

---

## 4. 数据流与架构

### 4.1 离线管道（训练前一次性/定期重跑）

```
data/raw/*.csv
   │
   ▼
src/data/load.py          ──► 合并 5 个 CSV，统一字段名与类型
   │
   ▼
src/data/clean.py         ──► 解析 remaining_lease、storey_range 转中点、
│                             处理 1990–2012 approval date 与 2012+ registration date 的衔接
   │
   ▼
src/data/geocode.py       ──► 唯一 block 地址 → OneMap API → block_coords.csv（缓存）
│                             失败则 fallback 到镇区中心点
   │
   ▼
src/data/features.py      ──► 计算 MRT/CBD 距离、楼龄、成交年月、
│                             镇区×楼型滞后 6 个月中位价（shift 1 防泄漏）
   │
   ▼
data/processed/enriched_dataset.parquet
   │
   ▼
src/models/experiments.py ──► 随机切分 + 时间切分 + 消融实验
   │
   ▼
models/*.joblib + outputs/metrics.json + outputs/figures/
```

### 4.2 在线层（Streamlit 运行时）

```
Streamlit 启动
   │
   ▼
加载 config.yaml、enriched_dataset.parquet、模型文件、SHAP explainer
   │
   ├── AI Valuation ──► 输入表单 → 特征拼装 → predict → 置信区间 → SHAP 瀑布图 → 同类成交
   │
   ├── Affordability ──► 收入/存款/债务输入 → solver → 最高可负担价 → 地图着色
   │
   ├── Market Pulse ──► 聚合数据 → 价格指数曲线 + 热度热力图 + 租期滑块实验室
   │
   ├── Model Arena ──► metrics.json + 图表直接展示
   │
   ├── Responsible AI ──► 静态声明 + 分组误差表
   │
   └── LLM 报告（P1）──► 点击生成 → 调用 API → 失败则模板文本
```

### 4.3 关键设计点

- 地理编码离线做，线上只读 `block_coords.csv`，演示不怕断网。
- 模型和 SHAP explainer 预训练落盘，Streamlit 启动时一次性加载。
- 所有慢操作（LLM、大数据查询）加缓存。

---

## 5. 10 天单人日程

> 今天 7/14，DDL 7/23。原则是：**先让端到端骨架跑起来，再逐步升级精确度**。

| 日期 | 重点任务 | 当日可验证产出 |
|---|---|---|
| **Day 1 (7/14)** | 搭建项目结构；实现 `load.py` + `clean.py`；用现有 5 个 CSV 生成 v0 parquet | `python src/data/build_dataset.py` 跑通 |
| **Day 2 (7/15)** | 实现训练/评估脚手架；跑 Baseline/LR/Ridge/RF/GBRT 五模型对比；开始写 `affordability/rules.py` | `outputs/model_comparison_summary.csv` 有数字 |
| **Day 3 (7/16)** | 搭 Streamlit 六页骨架；用 v0 数据把全部页面跑通；完成负担能力反向求解器 | `streamlit run src/app/Home.py` 能看到六页导航 |
| **Day 4 (7/17)** | 尝试连 data.gov.sg API 下载最新数据；实现 OneMap 地理编码脚本并跑完全部唯一 block；更新特征工程 | `data/external/block_coords.csv` 生成 |
| **Day 5 (7/18)** | 用精确坐标重新训练模型；安装/配置 XGBoost；处理 numpy 版本隔离；跑时间切分 + 消融实验 | XGBoost 加入对比表，时间切分指标出炉 |
| **Day 6 (7/19)** | 集成 SHAP；实现 Quantile 置信区间；实现同类成交检索 | AI Valuation 页有 SHAP 瀑布图 |
| **Day 7 (7/20)** | 地图热力图（planning area GeoJSON）；租期衰减实验室；Market Pulse 聚合指标；K-means 镇区聚类 | Affordability 页有新加坡地图；聚类结果可用 |
| **Day 8 (7/21)** | LLM 客户端 + 降级；端到端走查；修复明显 bug；尝试 Streamlit Cloud 部署 | 外网可访问链接 |
| **Day 9 (7/22)** | README/方法报告；Poster 素材导出；Slides 脚本；短论文草稿（可选） | 全部文档初稿 |
| **Day 10 (7/23)** | 最终打磨、bug 修复、排练、交付 | 冻结代码，提交所有交付物 |

### 防崩线

- Day 4 晚上若 data.gov.sg 仍连不上，立刻 fallback 到本地 5 个 CSV，不浪费 Day 5。
- Day 5 若 XGBoost/shap 环境冲突，立刻切到干净 venv/conda，不再在全局环境折腾。

---

## 6. 关键接口定义

### 6.1 估值请求输入/输出

```python
class ValuationInput(BaseModel):
    town: str                       # e.g. "SENGKANG"
    flat_type: str                  # e.g. "4 ROOM"
    flat_model: str                 # e.g. "Model A"
    floor_area_sqm: float
    storey_range: str               # e.g. "10 TO 12"
    lease_commence_date: int        # e.g. 1988
    block: str                      # e.g. "123A"
    street_name: str                # e.g. "COMPASSVALE BOW"
    month: str = "2024-01"          # 默认当前月，用于滞后特征

class ValuationOutput(BaseModel):
    predicted_price: float
    ci_low: float
    ci_high: float
    shap_values: dict[str, float]   # 特征 → SHAP 值
    comparables: pd.DataFrame       # 近 6 个月同类成交
```

### 6.2 负担能力请求输入/输出

```python
class AffordabilityInput(BaseModel):
    monthly_income: float
    cash_on_hand: float
    cpf_oa: float
    existing_debts: float = 0.0
    loan_type: Literal["HDB", "Bank"]
    tenure_years: int = 25
    is_first_time_buyer: bool = True
    resident_status: Literal["Citizen", "PR", "Foreigner"] = "Citizen"

class AffordabilityOutput(BaseModel):
    max_price: float                # 最高可负担房价
    max_loan: float
    downpayment_cash_needed: float
    monthly_mortgage: float
    msr_pct: float
    tdsr_pct: float
```

### 6.3 模型训练输出

```
models/{model_name}.joblib

outputs/metrics.json:
{
  "random_split": {"LR": {...}, "Ridge": {...}, ...},
  "time_split":   {"LR": {...}, "Ridge": {...}, ...},
  "ablation":     {"with_geo": {...}, "without_geo": {...}}
}
```

### 6.4 LLM 客户端接口

```python
def generate_report(valuation: ValuationOutput,
                    affordability: AffordabilityOutput) -> str:
    """
    成功：返回自然语言报告。
    失败/无 API key：返回模板文本，不抛异常。
    """
```

### 6.5 LLM 选型

- **供应商：DeepSeek**（`deepseek-chat` 或 `deepseek-reasoner`，默认使用 `deepseek-chat`）。
- 通过兼容 OpenAI SDK 的方式调用，`config.yaml` 中配置 `llm_base_url`、`llm_model`、`llm_api_key`。
- 默认 prompt 控制在 <1k tokens，单次成本 <$0.01。
- 失败/无 API key 时回退到模板文本。

---

## 7. 风险与回退策略

| 风险 | 影响 | 回退方案 |
|---|---|---|
| data.gov.sg API 被 Cloudflare 拦截 | 拿不到最新数据 | 先在学校网络测试；Day 4 晚上仍不通则 fallback 到本地 5 个 CSV |
| OneMap API 限速/失败 | 精确坐标缺失 | 用镇区中心点坐标 fallback，功能仍可运行 |
| XGBoost/shap 引发 numpy 版本冲突 | 全局 Python 环境再次损坏 | 用干净 venv/conda 环境隔离，不在全局环境安装 |
| LLM API 余额不足/失败 | 报告生成功能不可用 | 降级为模板字符串拼接，不抛异常 |
| Streamlit Cloud 内存不足（90 万行 parquet） | 部署失败 | 线上只加载聚合数据 + 模型文件，明细查询用预生成索引 |
| 时间切分性能明显低于随机切分 | 报告数字不好看 | 本身作为“评估陷阱”的发现诚实报告，不掩盖 |

---

## 8. 测试与验证策略

### 8.1 单元测试

| 测试文件 | 测什么 |
|---|---|
| `tests/test_clean.py` | `remaining_lease` 字符串解析为月数；楼层区间 "10 TO 12" → 11 |
| `tests/test_features.py` | MRT/CBD 距离计算正确；滞后中位价没有未来泄漏 |
| `tests/test_affordability.py` | 与 MoneySense 官方算例对拍，误差 ≤1% |
| `tests/test_predict.py` | 输入合法时 `predict()` 不抛异常；输出价格在合理区间 |

### 8.2 集成验证

- 数据管道：`python src/data/build_dataset.py` 生成 parquet 后，`pytest tests/test_features.py` 验证无泄漏。
- 训练流程：`python src/models/experiments.py` 跑完后，`outputs/metrics.json` 必须包含 `random_split` 和 `time_split` 两个 key。
- Web 走查：按 Wei Ling 故事线手动点一遍——输入负担能力 → 看地图 → 输入一套房估价 → 看 SHAP → 生成报告。

### 8.3 部署验证

- 本地 `streamlit run src/app/Home.py` 无报错。
- Streamlit Cloud 部署后，外网链接能打开并完成一次完整交互。
- LLM 失败场景测试：把 API key 设错，确认页面仍可用且报告降级为模板文本。

---

## 9. 已确认事项

- [x] LLM API 供应商：**DeepSeek**（默认模型 `deepseek-chat`）。
- [x] data.gov.sg 在学校网络测试，本机被拦截则 fallback 到本地 CSV。
- [x] K-means 镇区聚类从 P2 提前到 P1，放入 Market Pulse 页。
