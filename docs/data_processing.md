# HDBrain 数据处理与数据集构建说明

> 本文档说明 HDBrain 项目的数据处理链路：
> 1. 从 `data/raw/` 生成预处理文件（`src/data/preprocess_reference.py`）
> 2. 从预处理文件生成可直接用于机器学习的纯数字数据集（`src/data/build_dataset.py`）

---

## 1. 数据链路总览

```
data/raw/  →  preprocess_reference.py  →  data/processed/hdb_resale_model_dataset.csv
                                              ↓
                                    build_dataset.py
                                              ↓
                                      data/hdb_dataset.csv
```

- **`preprocess_reference.py`**：复现参考仓库 `HDB_Resale_Prices` 的完整处理逻辑，生成中间文件和交易级宽表。
- **`build_dataset.py`**：从宽表出发，做特征丢弃、编码、缺失值填充，输出**纯数字、无缺失**的 ML 数据集。

---

## 2. 运行方式

确保已激活 `HDBrain` conda 环境。

### 步骤 1：生成预处理文件

```bash
python src/data/preprocess_reference.py
```

输出到 `data/processed/`，主要包括：

| 文件 | 说明 |
|------|------|
| `hdb_resale_model_dataset.csv` | 交易级宽表（含原始类别列与设施特征） |
| `flat_amenities.csv` | 每个地址的设施距离与 2km 数量 |
| `all_resale_prices_by_year.csv` | 每年每地址的通胀调整后中位数价格 |

### 步骤 2：生成 ML 数据集

```bash
python src/data/build_dataset.py
```

输入：`data/processed/hdb_resale_model_dataset.csv`  
输出：`data/hdb_dataset.csv`

---

## 3. `build_dataset.py` 做了什么？

### 3.1 读取预处理宽表

`data/processed/hdb_resale_model_dataset.csv` 包含原始类别列和数值特征：

- 时间：`month`、`year`
- 类别：`town`、`region`、`flat_type`、`storey_range`、`flat_model`
- 数值：`floor_area_sqm`、`lease_commence_date`、`remaining_lease`
- 设施：`school_dist`、`num_school_2km`、…、`dist_dhoby`
- 价格：`resale_price`、`cpi`、`real_price`

### 3.2 时间特征

从 `month` 提取月份，做 cyclical 编码：

```text
month_sin = sin(2π * month / 12)
month_cos = cos(2π * month / 12)
```

`month` 本身在最终数据集中丢弃。

### 3.3 类别特征编码

#### `flat_type`（标签编码）

按房间数从少到多排序：

```text
1 ROOM → 0, 2 ROOM → 1, 3 ROOM → 2, 4 ROOM → 3, 5 ROOM → 4,
EXECUTIVE → 5, MULTI GENERATION → 6
```

#### `storey_range`（标签编码）

按楼层从低到高排序：

```text
01 TO 03 → 0, 01 TO 05 → 1, 04 TO 06 → 2, ...
```

#### `region`（One-Hot 编码）

生成 dummy 列：

```text
region_East, region_North, region_North East, region_West
```

`Central` 作为基准列省略，避免完全共线性。

#### `flat_model`（归类 + One-Hot 编码）

先把 `flat_model` 归为 5 大类，再 one-hot：

| 原始值 | 归类后 |
|--------|--------|
| Model A / Simplified / Model A2 | Model A |
| Standard / Improved / 2-room | Standard |
| New Generation | New Generation |
| Apartment / Premium Apartment / Premium Apartment Loft / APARTMENT | Apartment |
| Maisonette / Executive Maisonette | Maisonette |
| Special / Terrace / Adjoined flat / Type S1/S2 / DBSS / 3Gen / Multi Generation | Special |

生成 dummy 列：

```text
model_Apartment, model_Maisonette, model_Model A,
model_New Generation, model_Special
```

`Standard` 作为基准列省略。

### 3.4 剩余租约填充

`remaining_lease` 在 2015 年后的原始数据中已存在；对缺失值使用：

```text
remaining_lease = 99 - (year - lease_commence_date)
```

填充后，`lease_commence_date` 不再保留。

### 3.5 设施特征缺失值填充

对 `school_dist`、`num_school_2km`、…、`dist_dhoby` 等列，使用同 `town` 的中位数填充缺失值。

### 3.6 丢弃的列

最终数据集中**不保留**以下原始/冗余列：

```text
month, town, flat, flat_type, storey_range, flat_model,
lease_commence_date, resale_price, cpi
```

### 3.7 输出文件

`data/hdb_dataset.csv` 包含：

- 28 个特征列
- 1 个目标列 `real_price`
- 981,450 行
- 无缺失值
- 全部纯数字

完整列名：

```text
year, month_sin, month_cos,
flat_type_code, storey_range_code, floor_area_sqm, remaining_lease,
region_East, region_North, region_North East, region_West,
model_Apartment, model_Maisonette, model_Model A, model_New Generation, model_Special,
school_dist, hawker_dist, park_dist, mall_dist, mrt_dist, supermarket_dist, dist_dhoby,
num_school_2km, num_hawker_2km, num_park_2km, num_mall_2km, num_mrt_2km, num_supermarket_2km,
real_price
```

---

## 4. 模型训练示例

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

df = pd.read_csv("data/hdb_dataset.csv")

X = df.drop(columns=["real_price"])
y = df["real_price"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.1, random_state=42)

model = RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)
model.fit(X_train, y_train)

pred = model.predict(X_test)
print(f"R²: {r2_score(y_test, pred):.4f}")
print(f"MAE: {mean_absolute_error(y_test, pred):,.0f}")
```

---

## 5. 与参考仓库（HDB_Resale_Prices）的差异

参考仓库的处理逻辑主要记录在 `flat_prices.ipynb` 与 `utils_functions.py` 中。本项目做了以下适配：

1. **resale 数据来源更新**：项目使用的是更新的下载版本，2020 年及以后的数据与参考仓库略有差异。
2. **时间范围延长**：参考仓库数据到 2020 年，项目数据到 2026 年 7 月。
3. **CPI 前向填充**：参考仓库的 CPI 文件到 2020-09，项目脚本对缺失月份 forward-fill。
4. **新增 `LIM CHU KANG`**：该 town 在项目数据中出现但参考仓库的 region 映射未包含，已映射到 `"North"`。
5. **最终数据集拆分**：参考仓库直接在 notebook 中生成 `df` 用于建模；本项目把它拆成了 `preprocess_reference.py` + `build_dataset.py`，职责更清晰。

---

## 6. 验证

可使用 `src/data/validate_reference.py` 对比 `data/processed/` 与参考仓库 `reference/HDB_Resale_Prices/Data/` 中的预处理文件：

- 所有设施文件与参考仓库完全一致。
- `all_resale_prices_by_year.csv` 在 1990–2019 年的所有参考行均匹配，`real_price` 差异小于 0.5 SGD。
- 2020 年因数据源更新存在少量差异，属正常情况。
