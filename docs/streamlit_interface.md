# Streamlit 可视化应用接口文档

> 本文档为未来 HDBrain 前端（Streamlit）提供详细接口说明。当前仅保留接口规范，暂未实现 UI。
> 所有示例代码均基于现有 `src/` 模块，可直接在 Streamlit 页面中调用。

---

## 1. 目标与范围

Streamlit 应用面向购房者或政策分析人员，核心目标是：

1. **地图展示**：在新加坡地图上展示不同区域、房型、时间段内的预测房价。
2. **用户画像录入**：收集家庭月收入、贷款参数、首付、CPF 等。
3. **可负担性计算**：根据用户画像与预测房价，计算月供、PTI、可负担区间。
4. **地图可视化可负担性**：将“可负担 / 不可负担”结果叠加在地图上。

本应用只读取已训练好的模型（`models/`）和清洗后的数据（`data/`），**不重新训练模型**。

---

## 2. 依赖建议

```text
streamlit
folium
streamlit-folium
pydeck
pandas
numpy
joblib
xgboost
scikit-learn
```

> 地图优先推荐 `folium` + `streamlit-folium`，因为无需 Mapbox token；若需要 3D/高密度热力，可选用 `pydeck`。

---

## 3. 模块接口总览

| 模块 | 主要用途 | 关键函数/类 |
|---|---|---|
| `src.models` | 加载数据、获取特征列 | `load_data()`, `get_feature_columns()` |
| `src.affordability.user_profile` | 用户画像 | `BuyerProfile` |
| `src.affordability.calculator` | 贷款、印花税、可负担性 | `monthly_mortgage()`, `stamp_duty()`, `max_affordable_price()`, `affordability_metrics()` |
| `src.affordability.mapper` | 区域/房型房价与可负担性映射 | `build_representative_profiles()`, `affordability_map()`, `most_affordable_groups()` |
| `src.affordability.scenarios` | 多收入情景分析 | `run_scenarios()` |

---

## 4. 功能 1：地图展示预测房价

### 4.1 输入

| 参数 | 类型 | 说明 | 默认值 |
|---|---|---|---|
| `year` | `int` | 预测年份 | 当前数据最大年份 |
| `month` | `int` | 预测月份（1-12） | 6 |
| `flat_type` | `List[str]` | 可选房型过滤，如 `["3 ROOM", "4 ROOM"]` | 全部 |
| `storey_range` | `Optional[List[int]]` | 楼层编码过滤 | 不限 |
| `price_statistic` | `"median" \| "mean"` | 聚合方式 | `"median"` |

### 4.2 数据准备

预测时需要把用户选择的时间信息转换为模型特征：

```python
import math
import joblib
import pandas as pd
from src.models import load_data, get_feature_columns

# 加载数据与模型
train_df, _ = load_data()
model = joblib.load("models/xgboost_model.joblib")

# 用户选择
year = 2024
month = 6
flat_types = ["3 ROOM", "4 ROOM"]

# 筛选数据
df = train_df.copy()
df = df[df["flat_type"].isin(flat_types)]

# 按地理单元聚合；此处以 town 为例，也可按 block/street
agg = df.groupby(["town", "flat_type"]).median(numeric_only=True).reset_index()

# 替换时间为用户选择
agg["year"] = year
agg["month_sin"] = math.sin(2 * math.pi * month / 12)
agg["month_cos"] = math.cos(2 * math.pi * month / 12)

# 预测
feature_cols = list(getattr(model, "feature_names_in_", get_feature_columns(agg)))
agg["predicted_price"] = model.predict(agg[feature_cols])
```

### 4.3 地理编码

清洗后的数据集 `data/processed/hdb_resale_model_dataset.csv` 包含 `flat` 字段（如 `"1 BEACH RD"`）。地理坐标来自：

```text
data/raw/flat_coordinates_clean.csv
```

示例：

```python
coords = pd.read_csv("data/raw/flat_coordinates_clean.csv")
# 假设包含 flat, latitude, longitude 列
df_geo = df.merge(coords, on="flat", how="left")
```

> 若 `flat_coordinates_clean.csv` 没有 `town` 字段，需要先用 `data/raw/hdb-property-information.csv` 或 `data/processed/hdb_resale_model_dataset.csv` 中的 `flat → town` 映射再聚合。

### 4.4 地图可视化

推荐方案 A：`folium.CircleMarker` 按区域绘制气泡，颜色映射房价。

```python
import folium
from streamlit_folium import st_folium

m = folium.Map(location=[1.3521, 103.8198], zoom_start=11)
for _, row in df_geo.iterrows():
    folium.CircleMarker(
        location=[row["latitude"], row["longitude"]],
        radius=5,
        color=None,
        fill=True,
        fill_color="#d62728" if row["predicted_price"] > 800_000 else "#2ca02c",
        fill_opacity=0.7,
        popup=f"{row['town']} {row['flat_type']}<br>SGD {row['predicted_price']:,.0f}",
    ).add_to(m)

st_folium(m, width=700, height=500)
```

推荐方案 B：若后续能获取到 **town 级 GeoJSON 边界**，可用 `folium.Choropleth` 绘制分级统计图。

---

## 5. 功能 2：用户画像输入表单

### 5.1 表单字段

| 字段 | Streamlit 控件 | 类型 | 默认值 | 校验规则 |
|---|---|---|---|---|
| 家庭月收入 | `st.number_input` | `float` | `8000` | `> 0` |
| 贷款类型 | `st.radio` / `st.selectbox` | `str` | `"HDB 组屋贷款"` | `hdb` / `bank` |
| 首付比例 | `st.slider` | `float` | `0.25` | `[0.05, 1.0]` |
| 贷款年利率 | `st.number_input` | `float` | `0.026`（HDB）/ `0.035`（银行） | `>= 0` |
| 贷款年限 | `st.slider` | `int` | `25` | `[5, 35]` |
| MSR 上限 | `st.slider` | `float` | `0.30` | `[0.1, 1.0]` |
| TDSR 上限 | `st.slider` | `float` | `0.55` | `[0.1, 1.0]` |
| 现有月债务 | `st.number_input` | `float` | `0` | `>= 0` |
| 现金存款 | `st.number_input` | `float` | `60000` | `>= 0`；传 `None` 表示未知（此时不启用首付预算约束） |
| CPF 可用金额 | `st.number_input` | `float` | `0` | `>= 0` |
| 偏好房型 | `st.multiselect` | `List[str]` | 全部 | 从 `df["flat_type"].unique()` 取值 |
| 偏好区域 | `st.multiselect` | `List[str]` | 全部 | 从 `df["town"].unique()` 取值 |

> **政策说明**：自 2024 年 8 月起，HDB 组屋贷款 LTV 上限为 75%，即最低首付 25%。银行贷款利率通常高于 HDB 优惠利率 2.6%，前端默认使用 3.5%（用户可手动调整）。MSR 上限 30%，TDSR 上限 55%。
> **首付预算约束**：当提供 `cash_savings`（非 None）时，`max_affordable_price` 会额外用首付预算封顶——首付 + BSD 必须落在 现金存款 + CPF 之内（求解函数 `max_price_from_upfront_budget`）。简化假设：现金与 CPF 合并计入前期预算，未建模银行贷款"至少 5% 须为现金"的规则。前端表单建议必填该项，避免向存款不足的用户展示误导性的高可负担价。

### 5.2 转换为 `BuyerProfile`

推荐根据贷款类型使用便利工厂函数：

```python
from src.affordability.user_profile import BuyerProfile

if loan_type == "hdb":
    profile = BuyerProfile.for_hdb_loan(
        monthly_income=monthly_income,
        downpayment_pct=downpayment_pct,
        interest_rate=interest_rate,
        tenure_years=tenure_years,
        msr_limit=msr_limit,
        tdsr_limit=tdsr_limit,
        existing_debt_monthly=existing_debt_monthly,
        cash_savings=cash_savings,
        cpf_available=cpf_available,
    )
else:
    profile = BuyerProfile.for_bank_loan(
        monthly_income=monthly_income,
        interest_rate=interest_rate,
        downpayment_pct=downpayment_pct,
        tenure_years=tenure_years,
        msr_limit=msr_limit,
        tdsr_limit=tdsr_limit,
        existing_debt_monthly=existing_debt_monthly,
        cash_savings=cash_savings,
        cpf_available=cpf_available,
    )
```

或直接实例化（默认值已按当前 HDB 政策设置）：

```python
profile = BuyerProfile(
    monthly_income=monthly_income,
    downpayment_pct=downpayment_pct,
    interest_rate=interest_rate,
    tenure_years=tenure_years,
    msr_limit=msr_limit,
    tdsr_limit=tdsr_limit,
    existing_debt_monthly=existing_debt_monthly,
    cash_savings=cash_savings,
    cpf_available=cpf_available,
    loan_type=loan_type,  # "hdb" or "bank"
)
```

---

## 6. 功能 3：可负担性计算

### 6.1 核心调用

```python
from src.affordability.calculator import (
    max_affordable_price,
    affordability_metrics,
)

max_price = max_affordable_price(profile)
metrics = affordability_metrics(predicted_price, profile)
```

### 6.2 返回字段说明

| 字段 | 含义 | 单位 |
|---|---|---|
| `predicted_price` | 模型预测房价 | SGD |
| `max_affordable_price` | 在该用户 MSR/TDSR/首付约束下的最高可负担房价 | SGD |
| `monthly_payment` | 等额本息月供 | SGD/月 |
| `monthly_income` | 家庭月收入 | SGD/月 |
| `existing_debt_monthly` | 现有月债务 | SGD/月 |
| `cash_savings` | 现金存款（`None` = 未知，未启用首付预算约束） | SGD |
| `msr` | Mortgage Servicing Ratio = 月供 / 月收入 | 比例 |
| `msr_limit` | MSR 上限 | 比例 |
| `tdsr` | Total Debt Servicing Ratio = (月供 + 现有债务) / 月收入 | 比例 |
| `tdsr_limit` | TDSR 上限 | 比例 |
| `pti` | Payment-to-Income = 月供 / 月收入（与 MSR 同义） | 比例 |
| `price_to_annual_income` | 房价 / 年收入 | 倍数 |
| `downpayment` | 首付金额 | SGD |
| `downpayment_pct` | 首付比例 | 比例 |
| `loan_amount` | 贷款本金 | SGD |
| `loan_to_value` | 贷款价值比 LTV = 贷款本金 / 房价 | 比例 |
| `stamp_duty` | 买方印花税 BSD | SGD |
| `total_upfront_cash` | 首付 + 印花税 − CPF | SGD |
| `affordable` | 是否可负担（满足 MSR、TDSR 且房价不超过最高可负担价） | bool |
| `affordability_gap` | 预测房价 − 最高可负担房价 | SGD（负值表示可负担） |
| `loan_type` | 贷款类型 | `"hdb"` / `"bank"` |

### 6.3 Streamlit 展示示例

```python
st.metric("最高可负担房价", f"S${max_price:,.0f}")
st.metric("预测房价", f"S${metrics['predicted_price']:,.0f}")
st.metric("月供", f"S${metrics['monthly_payment']:,.0f}")
st.metric("月供收入比", f"{metrics['pti']*100:.1f}%")

if metrics["affordable"]:
    st.success("该房产在该预算下可负担")
else:
    st.error(f"缺口约 S${metrics['affordability_gap']:,.0f}")
```

---

## 7. 功能 4：在地图上可视化可负担性

### 7.1 生成每个区域的可负担性结果

```python
from src.affordability.mapper import affordability_map

result = affordability_map(profile, model=model, df=train_df)

# 若用户选择了偏好区域/房型，再过滤
if preferred_towns:
    result = result[result["town"].isin(preferred_towns)]
if preferred_flat_types:
    result = result[result["flat_type"].isin(preferred_flat_types)]
```

### 7.2 颜色映射建议

| 颜色 | 条件 | 含义 |
|---|---|---|
| 绿色 | `affordable == True` | 可负担 |
| 红色 | `affordable == False` | 不可负担 |
| 颜色深浅 | `abs(affordability_gap)` 大小 | 缺口/盈余越大颜色越深 |

### 7.3 地图绘制示例

```python
import folium
from streamlit_folium import st_folium

m = folium.Map(location=[1.3521, 103.8198], zoom_start=11)

for _, row in result.iterrows():
    color = "#2ca02c" if row["affordable"] else "#d62728"
    folium.CircleMarker(
        location=[row["latitude"], row["longitude"]],
        radius=6,
        color=color,
        fill=True,
        fill_opacity=0.7,
        popup=(
            f"{row['town']} {row['flat_type']}<br>"
            f"预测价: S${row['predicted_price']:,.0f}<br>"
            f"月供: S${row['monthly_payment']:,.0f}<br>"
            f"PTI: {row['pti']*100:.1f}%<br>"
            f"缺口: S${row['affordability_gap']:,.0f}"
        ),
    ).add_to(m)

st_folium(m, width=700, height=500)
```

### 7.4 可选：可负担组合列表

```python
from src.affordability.mapper import most_affordable_groups

best = most_affordable_groups(result, top_n=10)
st.dataframe(best)
```

---

## 8. 推荐页面布局

```text
┌─────────────────────────────────────────────────────┐
│  标题：HDBrain 可负担性地图                          │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  侧边栏       │  主区域：地图（预测房价 / 可负担性）  │
│  · 月收入     │                                      │
│  · 首付比例   │  次级区域：                          │
│  · 利率       │  · 最高可负担房价卡片                │
│  · 贷款年限   │  · 可负担组合 Top 10 表格            │
│  · MSR 上限   │  · 各 town PTI 条形图                │
│  · CPF 金额   │                                      │
│  · 房型过滤   │                                      │
│  · 区域过滤   │                                      │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

---

## 9. 性能与缓存建议

### 9.1 缓存模型与数据

```python
import streamlit as st
import joblib
from src.models import load_data

@st.cache_resource
def load_model():
    return joblib.load("models/xgboost_model.joblib")

@st.cache_data
def get_data():
    return load_data()
```

### 9.2 缓存区域聚合结果

`build_representative_profiles()` 和 `affordability_map()` 的结果只依赖于训练数据和模型，与用户选择的时间/收入无关的部分可以预先计算一次。

```python
@st.cache_data
def get_representative_profiles():
    from src.affordability.mapper import build_representative_profiles
    train_df, _ = get_data()
    return build_representative_profiles(train_df)
```

### 9.3 预测耗时

- 单条预测：毫秒级。
- 全量 `town × flat_type × storey_range_code`（约 1500 组）：< 1 秒。
- 若细化到 `block` 级别：建议后台预计算或采样展示。

---

## 10. 可扩展点

| 扩展 | 说明 |
|---|---|
| 分位数区间 | 使用 `models/quantile_model.joblib` 在地图上展示 90% 价格区间，而不仅是中位数 |
| 时间滑块 | 在地图上按年份/月份动态播放房价变化 |
| 政策模拟 | 在侧边栏增加“如果利率上升 1%”或“如果 MSR 降到 25%”等情景 |
| 交通等时圈 | 结合 MRT 坐标，展示“距某站 15 分钟内可负担房源” |
| 保存报告 | 允许用户下载当前筛选条件下的 CSV 报告 |

---

## 11. 文件位置

- 本文档：`docs/streamlit_interface.md`
- 可负担性引擎：`src/affordability/`
- 统一入口（命令行）：`src/run_affordability.py`
- 训练好的模型：`models/`
