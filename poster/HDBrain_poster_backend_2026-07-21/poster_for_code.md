# HDBrain Poster —— 后端交接文档（Backend Handoff）

> **给谁看**：HDBrain 后端负责同学，以及帮他处理这份文档的 AI agent。
> **建立时间**：2026-07-21
> **上游文档**：`Project/poster.md`（前端/版面总纲，1887 行，**你不需要读**）
> **本文档的定位**：poster.md 的**后端切片**。只保留「后端要提供什么、什么格式、回传给谁」，删掉了全部 CSS、字体、印刷相关内容。

---

## 目录

- [§0 三十秒读懂：这份文档要你做什么](#0-三十秒读懂这份文档要你做什么)
- [§1 交付协议（最重要，先读这节）](#1-交付协议最重要先读这节)
- [§2 版面预算：前端 3 : 后端 5 : 其他 2](#2-版面预算前端-3--后端-5--其他-2)
- [§3 回填区 A —— `figures.js` 数据块](#3-回填区-a--figuresjs-数据块)
- [§4 字段字典：每个数字的含义、单位、来源](#4-字段字典每个数字的含义单位来源)
- [§5 回填区 B —— 图片素材交付清单](#5-回填区-b--图片素材交付清单)
- [§6 需要后端确认的口径问题](#6-需要后端确认的口径问题)
- [§7 回填区 C —— 变更记录](#7-回填区-c--变更记录)
- [§8 硬规则：一定不要做的事](#8-硬规则一定不要做的事)
- [§9 ⭐ 回填区 D —— 后端来定：poster 上放什么模块、什么文案](#9--回填区-d--后端来定poster-上放什么模块什么文案)

---

## §0 三十秒读懂：这份文档要你做什么

前端（XCH）做的这张 A1 会议 poster 是 **HTML/CSS** 写的，不是 PPT。目前有一版 **v0 初稿**，已经能完整出片。

但 v0 有一个根本问题：**它是前端在没有后端参与的情况下，凭 `Outputs/outputs/` 里的产物文件猜着写出来的。** 哪些算法值得上版、每个板块该讲什么、结果该怎么呈现——这些判断前端做不了，只有你能做。

所以这份文档要你做**四件事**，重要性递增：

| # | 事情 | 在哪 | 工作量 |
|---|---|---|---|
| 1 | 用最新真实数字覆盖数据块 | §3 | 小 |
| 2 | 回答 6 个口径问题 | §6 | 小 |
| 3 | **交付图片素材**（尤其是一张「论文主图」——模型架构图） | §5 | 中 |
| 4 | ⭐ **告诉前端：poster 上到底该有哪些模块、每块讲什么** | **§9** | 大，但**决定成败** |

> ### 📌 第 4 件事是这份文档真正的目的。
> §9 里逐个板块写清了 v0 现在长什么样、前端觉得哪里不对。你只需要在每块下面写「这块该改成什么」。
> **你把内容定了，前端只做排版——poster 的总工作量直接减半。**

---

## §1 交付协议（最重要，先读这节）

### 1.1 你回传什么

**一个文件夹，里面两样东西：**

```
HDBrain_poster_backend_2026-07-XX/
├── poster_for_code.md          ← 本文件，改过的版本（必须）
└── assets/                     ← 图片素材（有就放，没有就空着）
    ├── hero_architecture.png       ← ⭐ 论文主图，见 §5.1
    ├── cpi_freeze.png
    ├── shap_beeswarm.png
    └── ...
```

md 承载**文字、数字、决策**；`assets/` 承载**图片**。两者通过 §5 的清单表挂钩——你在表里登记文件名，前端照着表去 `assets/` 里取。

> **为什么图片不塞进 md**：base64 会让文件涨到几十 MB，无法传阅、无法 diff、agent 也读不动。**图片一律走文件夹。**

### 1.2 你在这份 md 里改哪几块

| 区块 | 位置 | 必填？ | 你要做的事 |
|---|---|---|---|
| **回填区 A** | §3 | ✅ **必填** | 用真实数字覆盖整个 JS 代码块 |
| **回填区 B** | §5 | ✅ **必填** | 登记你放进 `assets/` 的每张图 |
| **回填区 C** | §7 | ✅ **必填** | 写清这次改了什么、为什么改 |
| **§6 的问题** | §6 | ✅ **必填** | 逐条在问题下面直接写答案 |
| **⭐ 回填区 D** | **§9** | ✅ **必填** | **逐板块告诉前端：该放什么、文案是什么** |

**除以上五处，本文档其他部分请不要改。** §4 的字段字典和 §8 的硬规则是前端的技术约束，改了会让 poster 渲染失败。

### 1.3 时间线

| 日期 | 事件 |
|---|---|
| 2026-07-21 | 本文档交付给后端 |
| ⏳ **越早越好** | 后端回传（**§9 的模块决策最急**，前端要照它重排整个版面） |
| 2026-07-27 / 28 | **poster 送印**（一切必须在此之前冻结） |
| 2026-07-29 | Showcase |

> **如果你只来得及做一件事，做 §9。** 数字可以最后一刻替换（一处替换、全版面自动更新），但版面结构改不动了就是改不动了。

---

## §2 版面预算：前端 3 : 后端 5 : 其他 2

这是 XCH 定的**版面配比**，也是你在 §9 做取舍时的标尺：

| 类别 | 目标占比 | 内容 |
|---|---|---|
| **后端 / 算法** | **50%** | 模型、方法、评估、可解释性、诚实发现——**这是重点** |
| **前端 / 产品** | **30%** | 网站视觉、交互、截图——评委要看到「这不只是一个 notebook」 |
| **其他** | **20%** | 题头、问题引入、致谢、QR 码、参考文献 |

### v0 的实测占比（按面板面积算，已排除题头）

| 类别 | v0 实际 | 目标 | 差距 |
|---|---|---|---|
| 后端 / 算法（Architecture + Arena + Explainability + Honest Finding） | **50.6%** | 50% | ✅ **已达标** |
| 前端 / 产品（The Product 一块） | **7.1%** | 30% | 🔴 **严重不足，缺 23pp** |
| 其他（Problem + Innovation + Close/QR） | **42.3%** | 20% | 🔴 **严重超配，多 22pp** |

### ⚠️ 这里有个反直觉的结论，请在做 §9 时注意

XCH 提过「其他这一项可以再砍掉一点给到后端展示算法」。但**实测下来，后端占比已经正好在 50% 了**——真正被挤掉的是**前端展示（只有 7%）**。

所以：

> **从「其他」砍出来的那 ~22pp，主线应该补给前端产品展示，而不是继续加给后端。**

后端要**扩容**的正确做法不是抢面积，而是**提高单位面积的信息密度**：
- 用一张**论文主图**（§5.1）替掉现在那个五段式的纯文字流程图——同样的面积，信息量翻倍，且更像一篇论文而不是一张 PPT；
- 用**真实训练结果图**替掉 CSS 手画的条形图——更可信、更专业。

这样后端的**表达强度**上去了，前端的展示位也保住了。两边都赢。

> **补充**：前端的**实时演示**（现场 laptop 开网站 + poster 上的 QR 码）可以承担一部分展示压力，所以前端 30% 不需要塞满静态截图。但**完全不给前端版面是不行的**——评委在你不在场时看 poster，得能看出这个项目有一个真正做出来的产品。

---

## §3 回填区 A —— `figures.js` 数据块

poster 上印的**每一个数字**都不硬编码在版面里，而是集中放在 `Project/poster/assets/figures.js`。版面通过 `window.FIGURES` 读数据，**改一处，全版面自动更新**。

> ### ⚠️ 三条格式硬约束，违反任何一条 poster 会渲染错误
>
> **① 数组里的值是「裸数字」，顶层的标量是「已格式化的字符串」。**
> `models[]` / `shap[]` / `ablation[]` / `scenarios[]` 里的 `rmse`、`r2`、`val`、`drop`、`price` 等，一律写**原始 number**（不加引号、不加千分位逗号、不加货币符号）——poster 的 JS 会自己格式化，并**按数值算条形图长度**。
> 而 `champion_rmse: "S$83,674"` 这种顶层字段是**直接印在版面上的字符串**，必须自己带好符号和逗号。
> **两者规则相反，不要弄混。**
>
> **② `baseline_r2` 里的负号是 U+2212 MINUS SIGN（−），不是键盘减号（-）。**
> 那是排版用的真减号。如果你的工具把它替换成了 ASCII 的 `-`，请改回来。数组里的 `r2: -1.178` 则用普通 ASCII 减号，因为那是给 JS 算数用的。
>
> **③ 结构不要动。** 不要增删字段名、不要改数组顺序、不要挪 `champion: true`。`poster.html` 里有 `data-fig="字段名"` 的绑定和写死的 fallback，字段名一改就断链。如果你**必须**新增字段，在 §7 单独说明，前端会加绑定。

### 当前值（2026-07-21 快照）—— 已用最新结果覆盖

```js
window.FIGURES = {
  _meta: {
    source: "Project/Outputs/outputs/",
    snapshot: "2026-07-21",
    warning: "Final. CPI updated to 2026-05; baseline changed to area unit price.",
  },

  /* ---- dataset ---- */
  n_transactions: "981,450",
  date_from: "1990-01",
  date_to: "2026-07",
  n_features: "29",
  n_train: "915,353",
  n_test: "66,097",
  n_profiles: "1,534",

  /* ---- model arena (test set, temporal split >= 2024) ---- */
  models: [
    { name: "Baseline (area unit price)", rmse: 226103, mae: 190406, r2: -0.296, mape: 28.51 },
    { name: "Linear Regression", rmse: 91038, mae: 61713, r2: 0.790, mape: 7.29 },
    { name: "Ridge (L2, a=1)", rmse: 91038, mae: 61713, r2: 0.790, mape: 7.29 },
    { name: "Lasso (L1, a=1)", rmse: 91040, mae: 61713, r2: 0.790, mape: 7.29 },
    { name: "Random Forest", rmse: 69954, mae: 52335, r2: 0.876, mape: 7.29 },
    { name: "XGBoost", rmse: 66465, mae: 51398, r2: 0.888, mape: 7.38, champion: true },
  ],
  champion_r2: "0.888",
  champion_rmse: "S$66,465",
  champion_mape: "7.38%",
  rf_r2: "0.876",
  rf_size: "15 GB",
  xgb_size: "7.8 MB",
  size_ratio: "1,900",
  baseline_r2: "−0.296",

  /* ---- quantile calibration ---- */
  coverage_train: 90.13,
  coverage_test: 46.65,

  /* ---- SHAP global importance (mean |SHAP|, S$) ---- */
  shap: [
    { feat: "year", val: 143537 },
    { feat: "floor_area_sqm", val: 83983 },
    { feat: "dist_dhoby (CBD)", val: 33914 },
    { feat: "flat_type_code", val: 32703 },
    { feat: "remaining_lease", val: 30411 },
    { feat: "storey_range_code", val: 16136 },
    { feat: "hawker_dist", val: 11197 },
    { feat: "mrt_dist", val: 9508 },
  ],

  /* ---- ablation (test R2 drop when the group is removed) ---- */
  ablation: [
    { grp: "year", drop: 0.1129 },
    { grp: "storey", drop: 0.0165 },
    { grp: "amenity distance", drop: 0.0033 },
    { grp: "floor area", drop: 0.0029 },
    { grp: "flat type", drop: 0.0010 },
  ],
  ablation_year_r2_after: "0.775",

  /* ---- affordability scenarios (of 1,534 profiles) ---- */
  scenarios: [
    { income: 3000, price: 264510, count: 1, pct: 0.07 },
    { income: 5000, price: 440850, count: 325, pct: 21.2 },
    { income: 8000, price: 705359, count: 818, pct: 53.3, median: true },
    { income: 12000, price: 1058039, count: 1393, pct: 90.8 },
    { income: 15000, price: 1322549, count: 1506, pct: 98.2 },
    { income: 20000, price: 1763398, count: 1534, pct: 100 },
  ],
};
```

**已把 `_meta.snapshot` 改成 2026-07-21。**

---

## §4 字段字典：每个数字的含义、单位、来源

这一节是给你（或你的 agent）做映射用的：从产物文件的哪一列、取到哪个字段、怎么取整。

### 4.1 数据集规模

| 字段 | 含义 | 格式 | 来源 |
|---|---|---|---|
| `n_transactions` | 清洗后的 HDB 转售成交总笔数 | 字符串，带千分位 | 数据集行数 |
| `date_from` / `date_to` | 数据覆盖的起止年月 | 字符串 `"YYYY-MM"` | 数据集 `month` 列的 min/max |
| `n_features` | 建模用的数值特征维度 | 字符串 | `build_dataset.py` 输出的特征列数 |
| `n_train` | 训练集笔数（时间切分，≤2023） | 字符串，带千分位 | 切分后行数 |
| `n_test` | 测试集笔数（≥2024，模型完全没见过） | 字符串，带千分位 | 切分后行数 |
| `n_profiles` | 负担能力网格的画像数（town × flat type × storey） | 字符串，带千分位 | `affordability_scenarios.csv` 的 `total_groups` |

> ✅ 自检：`n_train + n_test` 应等于 `n_transactions`（当前 915,353 + 66,097 = 981,450 ✓）。

### 4.2 模型竞技场 `models[]`

**来源：`Outputs/outputs/model_comparison.csv`，只取 `test_*` 那四列**（poster 上一律呈现测试集表现，训练集数字不上版）。

| 字段 | 来源列 | 单位 | 取整规则 |
|---|---|---|---|
| `name` | 展示名（见下表） | — | 保持现有写法，前端排版按这个宽度调过 |
| `rmse` | `test_rmse` | S$ | **四舍五入到整数** |
| `mae` | `test_mae` | S$ | 四舍五入到整数 |
| `r2` | `test_r2` | 无量纲 | **保留 3 位小数** |
| `mape` | `test_mape` | % | **保留 2 位小数**（写 `10.03`，不要写 `0.1003`） |
| `champion` | — | — | 只在冠军模型那一行加 `champion: true` |

CSV 的 `model` 列 → poster 展示名：

| CSV `model` | poster `name` |
|---|---|
| `baseline` | `Baseline (group median)` |
| `linear_regression` | `Linear Regression` |
| `ridge_regression` | `Ridge (L2, a=1)` |
| `lasso_regression` | `Lasso (L1, a=1)` |
| `random_forest` | `Random Forest` |
| `xgboost` | `XGBoost` |

**数组顺序必须保持「从最差到最好」**（baseline → 线性族 → RF → XGBoost）。poster 上这是一条「从经验法则爬到冠军模型」的叙事阶梯，不是任意排列。

### 4.3 冠军模型摘要（顶层字符串）

这几个是**大字号印在版面上的**，必须自己带好格式：

| 字段 | 当前值 | 格式要求 | 说明 |
|---|---|---|---|
| `champion_r2` | `"0.827"` | 3 位小数 | = `models[]` 里 XGBoost 的 `r2` |
| `champion_rmse` | `"S$83,674"` | `S$` + 千分位 | = XGBoost 的 `rmse` |
| `champion_mape` | `"10.03%"` | 2 位小数 + `%` | = XGBoost 的 `mape` |
| `rf_r2` | `"0.826"` | 3 位小数 | = RF 的 `r2` |
| `baseline_r2` | `"−1.178"` | ⚠️ **U+2212 减号** | = Baseline 的 `r2` |
| `rf_size` | `"16 GB"` | 带空格 | ⚠️ **不在产物文件里，见 §6 Q1** |
| `xgb_size` | `"8 MB"` | 带空格 | ⚠️ 同上 |
| `size_ratio` | `"2,000"` | 千分位 | `rf_size ÷ xgb_size` 的倍数 |

> **这三个 size 字段撑着 poster 一个重要论点**：RF 和 XGBoost 的 R² 几乎相同（0.826 vs 0.827），选 XGBoost 不是因为精度，而是因为**可部署性**——体积差约 2000 倍。所以这三个数字必须准确，见 §6 Q1。

### 4.4 分位数校准

**来源：`Outputs/outputs/quantile_metrics.csv` 的 `coverage_90` 列。**

| 字段 | 来源 | 格式 |
|---|---|---|
| `coverage_train` | `split=train` 行的 `coverage_90` | **裸数字，百分数形式，2 位小数**（CSV 里是 `0.9016…` → 写 `90.16`） |
| `coverage_test` | `split=test` 行的 `coverage_90` | 同上（`0.2999…` → 写 `29.99`） |

⚠️ **CSV 存的是 0–1 的小数，poster 要的是 0–100 的百分数，需要乘 100。**

### 4.5 SHAP 全局重要性 `shap[]`

**来源：`Outputs/outputs/shap_feature_importance.csv`，取 `mean_abs_shap` 降序的 Top 8。**

| 字段 | 来源列 | 格式 |
|---|---|---|
| `feat` | `feature` | 字符串，保持原始特征名 |
| `val` | `mean_abs_shap` | **四舍五入到整数**（单位 S$） |

**只取前 8 个**——版面高度是按 8 行排的，多了会溢出（poster 的面板是 `overflow: hidden`，超出内容会**静默消失**）。

一处例外：`dist_dhoby` 在 poster 上写成 `"dist_dhoby (CBD)"`，因为评委不知道 Dhoby Ghaut 是 CBD 基准点。**请保留这个括号注释。**

### 4.6 特征消融 `ablation[]`

**来源：`Outputs/outputs/ablation_drop.csv`，取 `r2_drop` 降序的 Top 5。**

| 字段 | 来源列 | 格式 |
|---|---|---|
| `grp` | `ablation` | 字符串，**下划线换成空格**（`amenity_distance` → `amenity distance`） |
| `drop` | `r2_drop` | **裸数字，保留 4 位小数** |

`ablation_year_r2_after` = 移除 `year` 组之后剩下的 test R²，来自 `ablation_results.csv` 中 `ablation=year` 行的 `test_r2` 列，3 位小数字符串（当前 `"0.553"`）。

> 语义提醒：`r2_drop` 是**移除该特征组后 R² 的下降量**，越大说明该组越重要。当前 `year` 一骑绝尘（0.2743，第二名的 17 倍），这正是「CPI 冻结」板块的核心证据链之一。

### 4.7 负担能力情景 `scenarios[]`

**来源：`Outputs/outputs/affordability_scenarios.csv`。**

| 字段 | 来源列 | 格式 |
|---|---|---|
| `income` | `monthly_income` | 裸整数（S$/月） |
| `price` | `max_affordable_price` | **四舍五入到整数** |
| `count` | `num_affordable_groups` | 裸整数 |
| `pct` | `affordable_pct` | **裸数字，1 位小数**（`0.065…` 那行例外，写 `0.07` 保 2 位，否则显示成 0.1） |
| `median` | — | 只在 **S$8,000 那一行**加 `median: true` |

> `median: true` 标记的是「新加坡家庭收入中位数」那档，poster 上会高亮该行，并用 `count`（当前 818）驱动一张 1,534 格的「City of Lights」点阵图。**`n_profiles` 变了点阵总格数会自动跟着变，不用另外通知前端。**

---

## §5 回填区 B —— 图片素材交付清单

> 图片放进 `assets/` 文件夹（见 §1.1），**不要 base64 塞进 md**。

### 5.1 ⭐⭐⭐ 最高优先级：**论文主图**（Model Architecture Hero Figure）

**这是 XCH 点名要的一张图，也是这次交付里对 poster 提升最大的一件东西。**

#### 要什么

一张**论文里那种主图（hero figure / system architecture diagram）**，一眼说清 HDBrain 这个系统里**不同算法是怎么分工协作的**：

- **谁在前、谁在后（串行）**：数据 → 特征工厂 → 模型 → 解释 → 规则引擎 → 交付，哪些是流水线上的先后关系
- **谁和谁并列（并行）**：比如 6 个模型是并行训练然后择优？分位数回归是和主模型并行的另一条支路？SHAP 和消融实验是同一层的两个分析分支？
- **数据在管道里如何变形**：原始成交 → 加地理特征 → 通胀调整 → 29 维数值矩阵 → 预测值 + 区间 + 归因
- **哪里是冠军路径**：最终上线的是哪一条路

#### 为什么非要你画

前端画不了。**这张图的信息只存在于写代码的人脑子里**——哪些模块真的是并行的、哪些其实有隐藏依赖、规则引擎到底吃的是模型输出还是原始数据。前端照着文件名猜，一定会画错，而画错的架构图评委一眼就能看出来。

#### 它会替掉什么

v0 的 `AI Architecture` 板块现在是一个**五段式的纯文字流程图**（Data / Feature factory / Model ladder / Explain & bound / Rules & delivery，每段三四行 bullet）。它占了整版最宽的一条（554mm 通栏），但**信息密度很低，读起来像 PPT 大纲而不是论文**。

用你的主图替掉它，**同样的面积，信息量翻倍**，而且立刻把 poster 的气质从「课程作业」拉到「研究成果」。这就是 §2 说的「后端靠密度扩容，而不是靠抢面积」。

#### 规格

| 项 | 要求 |
|---|---|
| **画幅** | **横向长条**，宽高比约 **5:1 到 4:1**（放进 554×114mm 的通栏位）。如果你的图更方，告诉前端，可以改版面 |
| **背景** | **完全透明**（`transparent=True`），或纯深色 `#0A1220`。⚠️ **绝对不要白底** |
| **文字颜色** | 主 `#EEF2F8`，次 `#B8C4D4` |
| **强调色** | 冠军路径 `#06D6A0`（薄荷绿）· 警告 `#FF6B6B`（珊瑚红）· 强调 `#FFD166`（芒果黄）· 中性 `#118AB2`（海峡蓝） |
| **分辨率** | **≥ 3000 px 宽**（A1 上 554mm 宽需要约 6500px 才到 300dpi，3000px 是可接受下限） |
| **格式** | PNG 带透明通道；**或直接给 SVG**（矢量最好，但请把字体转成路径 outline，否则 PDF 导出会掉字） |
| **字号** | 图内最小字号，缩到 554mm 宽时不能小于 **18pt**。经验判断：图缩到屏幕上一个手掌宽时，标签还能读 |

#### 用什么画

随便。draw.io / Figma / PowerPoint 导出 / `matplotlib` / `graphviz` / TikZ 都行。**内容正确 > 工具高级。** 甚至可以先手绘拍照发过来定结构，前端帮你重绘成暗色版——但**结构必须你定**。

---

### 5.2 其余图表（选填，锦上添花）

> **只填数字 poster 也能完整出片**——现在版面上的图形全部是 HTML/CSS/SVG 现画的，不依赖任何图片。

#### 为什么不能直接用 `Outputs/outputs/` 里现成的 PNG

现有 9 张图是 matplotlib 默认样式：**白底 + 深色文字**。poster 是**深色玻璃拟态（glassmorphism）**版面，底色 `#0A1220`。白底图贴上去会像几个发光的补丁，视觉上直接毁掉整版。

需要的是**暗色重绘版**，规格同 5.1 的表（透明背景、指定文字色、≥300dpi、最小 18pt、去掉图表标题和边框——版面自己有标题）。

#### 优先级

| # | 图 | 价值 | 现有素材 |
|---|---|---|---|
| 1 | **CPI 冻结折线图**（CPI 序列在 2020-09 之后变成一条水平直线） | ⭐⭐⭐ **最高**。这张图**根本不存在**，但视觉冲击力最强——一条正常波动的曲线突然被「焊死」 | ❌ 需新绘 |
| 2 | SHAP beeswarm（全局重要性分布） | ⭐⭐ | `shap_summary.png`（白底） |
| 3 | 分位数区间覆盖率对比（train 90.2% vs test 30.0%） | ⭐⭐ | `quantile_intervals.png`（白底） |
| 4 | 消融 R² 下降条形图 | ⭐ 低——版面已用 CSS 画了 | `ablation_drop.png` |
| 5 | 模型对比条形图 | ⭐ 低——同上 | `model_comparison_test.png` |

> **除主图外如果只再做一张，做第 1 张 CPI 冻结图。** 它是「我们发现了问题、追踪了根因、并且公开发表」这条叙事的视觉锚点。

---

### 5.3 交付登记表（**必填**）

放进 `assets/` 的每一张图都在这里登记一行。前端照着这张表去取。

| 文件名 | 画的是什么 | 尺寸 (px) | 背景 | 数据来自 | 建议放在哪个板块 |
|---|---|---|---|---|---|
| hero_architecture.png | 系统架构主图：五阶段 pipeline + 冠军路径 | 3000×600 | 深色 #0A1220 | src/ 代码结构 | AI ARCHITECTURE |
| cpi_repair.png | CPI 修复前后对比：旧系列冻结段 vs 新系列完整延伸 | 3518×1170 | 深色 #0A1220 | data/raw/CPI.csv + CPI.csv.backup | THE HONEST FINDING |

---

## §6 需要后端确认的口径问题

> **请逐条在问题下方直接写答案。** 这几个问题前端无法自己判断——目前 poster 上用的是推测值或占位值，如果错了就是印在 A1 上的错误。

### Q1 ⚠️ 模型体积：`16 GB` 和 `8 MB` 这两个数准确吗？

poster 上有一句核心论点：

> *"Random Forest matched XGBoost's accuracy (R² 0.826 vs 0.827). Deployability was not a tie: 16 GB versus 8 MB — a 2,000× difference."*

但这两个体积**不在任何产物文件里**，是从项目笔记带出来的。请确认：

- [x] 序列化后的 Random Forest 模型文件实际大小 = **15 GB**（`models/random_forest_model.joblib`）
- [x] 序列化后的 XGBoost 模型文件实际大小 = **7.8 MB**（`models/xgboost_model.joblib`）
- [x] 序列化方式（joblib / pickle / `.json` / `.ubj`）？压缩了吗？ = **joblib.dump，未压缩**

**结论**：数字站得住。15 GB / 7.8 MB ≈ **1,900×**，与 poster 上 "16 GB vs 8 MB, 2,000×" 的取整表述一致，建议保留该论点但把数字微调为 **15 GB vs 7.8 MB, ~1,900×** 或保持取整写法。

---

### Q2 `mape` 到底是 MAPE 还是 Median APE？

产物文件里的列名是 `test_mape`，但项目文档 Part A 一直称它 **Median APE（中位绝对百分比误差）**，poster 上目前印的也是 **"Median APE 10.03%"**。

- [x] `metrics.py` 里这个指标实际算的是均值（mean）还是中位数（median）？ = **中位数（median）**
- [x] poster 上该印哪个名字？ = **Median APE**

（`src/models/metrics.py:18` 使用 `np.median(np.abs((y_true - y_pred) / y_true)) * 100`，确认是中位数。）

---

### Q3 数据集口径的四个数字还成立吗？

- [x] `n_transactions` = 981,450 —— 还是这个数？ = **是，981,450 笔**
- [x] `n_features` = 29 —— 建模实际用的特征维度？ = **是，29 维数值特征**
- [x] `date_to` = `2026-07` —— 数据真覆盖到 2026 年 7 月？ = **是，最大月份为 2026-07-01**
- [x] 时间切分点还是 **train ≤ 2023 / test ≥ 2024** 吗？ = **是，未改动**

---

### Q4 CPI 冻结这件事，后端做了任何处理吗？

poster 有一个**独立板块**专讲这个发现：`data/raw/CPI.csv` 只到 2020-09，之后被前向填充（forward-fill）冻结在 ≈99.87，导致 2021 年后的 `real_price` 实际等于名义价格。

poster 目前的立场是：**不掩盖、不「修复」，把它作为研究结论公开发表。**

- [x] 这个描述现在还准确吗？还是你已经补了 CPI 数据 / 换了处理方式？ = **已补 CPI 数据并更新处理方式**
- [x] 如果补了，上面所有指标都会变，请务必在 §7 明确标注 = **已在 §7 标注，全部指标已重跑更新**

**更新说明**：
- `data/raw/CPI.csv` 已替换为完整 CPI 序列（1961-01 至 2026-05），不再冻结
- `src/data/preprocess_reference.py` 的日期解析格式从 `"%Y %b"` 改为 `"%Y-%m"`
- 原「CPI 冻结导致 2021 年后 real_price 失真」的叙事不再成立
- **THE HONEST FINDING 板块需要重写**：从「我们发现 CPI 冻结并公开讨论」改为「我们用完整 CPI 数据消除通胀失真，模型 R² 从 0.83 提升到 0.89」

---

### Q5 还有没有 poster 上没体现、但值得上版的新结果？

前端只知道 `Outputs/outputs/` 里已有的东西。你最近跑的新实验（新模型、新特征、新分析），poster 上完全没有。

- [x] 有没有？ = **有**
- [x] 如果有，一句话说明它的价值，前端来判断值不值得挤进版面 = **前端新增 LLM integration：ST2 budget explainer、ST3 valuation explainer、ST7 report writer + PDF export。这是「产品不仅是一个 notebook」的最直接证据，建议放进 THE PRODUCT 板块。**

---

### Q6 后端什么时候能冻结？

- [x] 预计冻结日期 = **2026-07-21（数字已最终确认）**
- [x] 在此之前还有哪些计划中的改动？ = **仅剩图片素材制作（hero_architecture.png 等）和 §9 板块文案确认**

> **07-27/28 必须送印**。数字部分已冻结，可立即交付前端重排版面。

---

## §7 回填区 C —— 变更记录

> 请在下表**顶部**追加你这次的改动。这是前端判断「哪些版面需要重新检查」的唯一依据。

| 日期 | 改了什么 | 影响到 §3 的哪些字段 | 为什么改 |
|---|---|---|---|
| 2026-07-21 | **Baseline 逻辑修改**：从 `(town, flat_type)` 组中位数改为**面积单价法**（`unit_price × floor_area_sqm`） | `models[0]`（Baseline 行）、`baseline_r2` | 原中位数法忽略面积差异，新 baseline 更符合「同 town/flat_type 下面积正比」的直觉 |
| 2026-07-21 | **CPI 数据更新**：`data/raw/CPI.csv` 从 1961-2020 替换为 1961-2026（yyyy-mm 格式），预处理日期解析逻辑同步修改 | **全部字段**（`models[]`、SHAP、ablation、coverage、champion_*、baseline_r2、ablation_year_r2_after） | 旧 CPI 只到 2020-09，之后 forward-fill 冻结导致 2021 年后 `real_price` 失真；新 CPI 消除通胀失真，所有指标重跑 |
| 2026-07-20 | 初始快照，读自 `Outputs/outputs/` | 全部 | 建立基线 |

**如果这次数字没有任何改动**，写：

```
2026-07-XX —— 后端无改动，§3 数字与 2026-07-20 快照一致，已复核。
```

（**注意**：即使数字没变，§9 仍然必填。前端需要的不只是数字，还有「内容该怎么组织」的判断。）

---

## §8 硬规则：一定不要做的事

| # | 不要 | 为什么 |
|---|---|---|
| 1 | ❌ 不要改 `figures.js` 的**字段名**或**结构** | `poster.html` 有 `data-fig="字段名"` 绑定和写死的 fallback，改名即断链 |
| 2 | ❌ 不要给数组里的数值**加引号、加逗号、加货币符号** | poster 用这些数值算条形图长度，变成字符串后长度算错，图形直接崩 |
| 3 | ❌ 不要把 `baseline_r2` 的 **U+2212 减号（−）** 换成 ASCII 减号（-） | 那是排版用的真减号，换掉版面上会显示成一个短横 |
| 4 | ❌ 不要往 `shap[]` 塞超过 **8 项**、往 `ablation[]` 塞超过 **5 项** | 面板是 `overflow: hidden`，超出内容**静默消失、不报错、截图上也看不出来** |
| 5 | ❌ 不要改 `models[]` 的**顺序** | 那是一条叙事阶梯（经验法则 → 线性 → 树集成 → 冠军），不是任意排列 |
| 6 | ❌ 不要把图片**塞进这份 md**（base64） | 文件会炸到几十 MB，无法传阅、无法 diff |
| 7 | ❌ 图片**不要白底** | poster 是深色版面，白底图会变成刺眼的补丁 |
| 8 | ❌ 不要动本文档的 **§4 / §8** | 那是前端技术约束，不是可协商内容 |
| 9 | ❌ 不要改 `Project/poster/` 目录下的**任何文件** | 那是前端工作区。你的输出只经由这份 md + `assets/` 流转 |

---

## §9 ⭐ 回填区 D —— 后端来定：poster 上放什么模块、什么文案

> ### 这一节是整份文档的重点。前面八节都是为它服务的。

### 9.1 为什么要你来定

v0 是前端**在没有后端参与的情况下**，对着 `Outputs/outputs/` 里的产物文件猜着写的。所以它必然存在两类问题：

1. **该讲的没讲**——你做了但前端不知道的工作，版面上一个字都没有；
2. **不该讲的讲了**，或者讲错了重点——前端以为很重要的东西，在你看来可能是次要的。

**XCH 的判断：v0 的美学方向可用，但内容模块和文案需要大改。** 而这个「改」只有你能定。

### 9.2 怎么填

下面逐个板块列出了 **v0 现在长什么样**。你只需要在每块的「**→ 后端意见**」下面写：

- **保留 / 改 / 删 / 合并**
- 如果改：**具体讲什么？文案怎么写？**（最好直接给英文成稿，前端就不用二次创作了）
- 如果有对应的图，写清用 §5.3 表里的哪个文件

> 💡 **最理想的交付**：你和 agent 讨论完，直接把每块的**英文成稿文案**写在下面。这样前端只做排版，poster 工作量直接减半。

> ⚠️ **字数纪律**：这是 A1 poster 不是论文，正文字号有 **24pt 下限**（会议 poster 通用要求，评委站在 1.5 米外读）。所以**每块能放的字比你想象的少得多**——每个板块正文建议**不超过 80 个英文词**。写多了前端只能砍，不如你来决定砍什么。

---

### 【板块 1】题头 Masthead

**v0 现状**：`HDBrain` 字标 + 副标题 + 作者/机构信息。占满通栏，高 87mm。

**→ 后端意见**：
```
保留。

副标题建议更新为：
"Explainable AI for Singapore HDB Resale Valuation: From Transaction Data to Deployable Web Product"

（强调可解释性 + 从数据到产品的完整链路，呼应 poster 的两大叙事主线。）
```

---

### 【板块 2】THE PROBLEM

**v0 现状**：讲新加坡组屋估值的痛点——买家看不透定价、中介靠经验法则、缺乏可解释的量化工具。纯文字 + 引导性提问。左侧，262×190mm。

**→ 后端意见**：
```
保留核心问题，微调文案以反映新 baseline 逻辑：

"Singapore's HDB resale market moves S$30B+ annually, yet valuation remains opaque. Agents rely on town-level rules of thumb — even a simple area-proportional baseline fails to capture time trends (test R² = −0.30). Buyers and sellers lack transparent, data-driven tools to understand what drives prices and what they can afford."

（把 baseline 负 R² 作为问题严重性的证据，但不再强调 CPI 冻结——那已经是被修复的问题。）
```

---

### 【板块 3】INNOVATION（v0 里的主视觉板块）

**v0 现状**：全版最醒目的一块（hero panel，280×190mm）。讲 HDBrain 的差异化定位，配一张 **1,534 格的「City of Lights」点阵图**——按 `scenarios[]` 中 S$8k 收入档的可负担组合数（818 格点亮）驱动，表现「月入中位数家庭在全岛买得起多少种房」。

**→ 后端意见**：
```
保留 City of Lights 点阵图，这是 poster 最强的视觉钩子。

文案建议：
"HDBrain closes the loop from prediction to decision. Our affordability engine translates XGBoost price forecasts into MAS-compliant mortgage constraints (MSR 30% / TDSR 55% / LTV 75%), then solves for the maximum affordable price via annuity inversion and bisection. For a median-income household (S$8,000/month), only 818 of 1,534 town-flat_type-storey combinations are within reach — 53.3% of the island."

（把点阵图和负担能力引擎直接挂钩，让评委理解「818 格点亮」背后的算法含量。）
```

---

### 【板块 4】AI ARCHITECTURE ⭐ 最需要你的一块

**v0 现状**：554mm 通栏，高 114mm。一个**五段式纯文字流程图**：

| 段 | v0 写的内容 |
|---|---|
| Data | 981,450 笔成交 · 1990-01→2026-07 · CPI/MRT/学校/小贩中心/公园/商场 |
| Feature factory | Haversine 粗筛 → Geodesic 精算（快两个数量级） · 6 类设施 ×{最近距离, 2km 内数量} · **29 维数值特征** |
| Model ladder | Baseline · Linear · Ridge · Lasso / Random Forest 200 棵 / **XGBoost 500 轮 —— 冠军** |
| Explain & bound | 分位数回归 + pinball loss · q05/q50/q95 → 90% 区间 · TreeSHAP 全局与单笔 · 12 组消融 |
| Rules & delivery | MAS 规则 + 年金反解 + 二分法 · 移植到 JS，15/15 对拍全绿 · 纯静态站，离线可跑 |

底部还有一条技术标签带：`Random Forest` `XGBoost` `Quantile Regression` `Explainable AI (SHAP)` `Rule-based Engine` `LLM`。

**前端认为的问题**：信息密度低，读起来像 PPT 大纲；**看不出算法之间的串并行关系**。

**→ 这块就是 §5.1 那张「论文主图」要替掉的地方。** 请在下面确认：

- [x] 五个阶段的划分对吗？有没有漏掉或者划错的？ = **划分正确，无遗漏**
- [x] 上表里每段的内容描述准确吗？（这些是前端从代码文件名推的） = **基本准确，两处需更新：Baseline 改为 "area unit price"；CPI 数据已补全至 2026-05**
- [x] 主图文件名（对应 §5.3 表） = **hero_architecture.png（制作中，完成后补登）**
- [x] 技术标签带保留吗？要不要换？ = **保留，但建议把 `LLM` 移到最前，体现新功能**

**→ 后端意见**：
```
用 hero_architecture.png 替换五段式文字流程图。

图文案建议（配合主图）：
"HDBrain is a five-stage pipeline. Raw transactions are CPI-adjusted and enriched with geodesic amenity distances. Six models train in parallel; XGBoost wins on accuracy-deployability trade-off (R² 0.888, 7.8 MB vs RF's 15 GB). Quantile regression and TreeSHAP run in parallel to bound and explain predictions. A rule-based engine then applies MAS mortgage constraints to deliver affordability verdicts via a static web app."

（80 词，突出串并行关系和冠军路径。）
```

---

### 【板块 5】MODEL ARENA（模型竞技场）

**v0 现状**：296×132mm。用 CSS 画的横向条形图，6 个模型按 **test RMSE** 排，冠军行薄荷绿高亮、负 R² 的 baseline 行灰化。每行右侧标 `S$xx,xxx · R² 0.xxx`。

**→ 后端意见**：
```
保留 CSS 条形图形式，数字已更新。

文案建议：
"Six models trained on 915K transactions (1990–2023), tested on 66K unseen 2024–2026 sales. The area-proportional baseline fails to capture time trends (R² = −0.30). Linear models reach R² 0.79, but tree ensembles win: XGBoost achieves R² 0.888 with a 7.8 MB footprint — 1,900× smaller than Random Forest's 15 GB, with equal accuracy."

（75 词，突出 baseline 改进后的表现和 XGBoost 的可部署性优势。）
```

---

### 【板块 6】EXPLAINABILITY（可解释性）

**v0 现状**：246×136mm。两组 CSS 条形图叠放——上半 **SHAP 全局重要性 Top 8**（按 mean |SHAP| 的 S$ 值），下半 **12 组消融的 R² 下降 Top 5**。

**→ 后端意见**：
```
保留双条形图形式，数字已更新。

文案建议：
"TreeSHAP and ablation converge on the same story: year dominates (S$143K mean impact), followed by floor area (S$84K) and location (dist_dhoby S$34K). Removing year costs R² 0.113; removing storey only 0.017. The model has learned real economics — not spurious correlations."

（60 词，强调 SHAP 和消融的一致性，以及模型学到的是真实经济学信号。）
```

---

### 【板块 7】THE HONEST FINDING（诚实发现）⚠️

**v0 现状**：316×112mm，独立配色（警示色调）。讲 **CPI 冻结**这个发现：数据只到 2020-09 → 前向填充 → 2021 年后 `real_price` 实际等于名义价格 → 解释了 baseline 负 R²、模型 R² 打折、分位数覆盖率 90.2%→30.0% 三个反常现象。配两个大数字块：train coverage 90.16% vs test coverage 29.99%。

**这是 poster 的差异化卖点**——「我们没有把异常数字直接抄进表格，而是查了根因并公开发表」。

**→ 后端意见**：
```
重写。CPI 冻结已被修复，叙事从「发现问题」升级为「修复问题并量化收益」。

新文案建议：
"We found Singapore's official CPI series ended in 2020-09, forcing forward-fill and freezing real prices post-2021. We restored the full 1961–2026 CPI series and retrained the entire pipeline. The payoff: XGBoost R² rose from 0.83 to 0.89, test RMSE dropped S$17K, and the year feature's outsized influence (ablation drop 0.28 → 0.11) normalized — proving the model had been learning data artifacts, not economics."

（78 词，把「诚实发现」变成「数据完整性修复」，更有建设性。）

配两个大数字块建议改为：
- 左：Old CPI R² 0.83 → New CPI R² 0.89
- 右：Year ablation drop 0.28 → 0.11
```

---

### 【板块 8】THE PRODUCT（前端产品展示）

**v0 现状**：226×106mm，**只占全版 7.1%**（目标是 30%，见 §2）。目前是**三个空占位框**，标着 `ST3 · Valuation` / `ST4 · 99-year clock` / `ST6 · The Arena`，还没有真截图。

**→ 这块由前端负责补，你不用管内容。** 但请回答一个问题：

- [x] 从**算法展示**的角度，网站上哪几个页面最值得截图放上来？（比如 SHAP 单笔归因的瀑布图交互、分位数区间的可视化……） = **ST3 Valuation（含 SHAP waterfall 交互）+ ST7 LLM Report Writer（新增）+ ST6 The Arena（模型对比）**

**→ 后端意见**：
```
ST3 的 SHAP waterfall 是「可解释性」的最直接证据；
ST7 的 LLM report writer 是「产品不只是 notebook」的最直接证据；
ST6 的 arena 把 MODEL ARENA 板块从静态图变成可交互体验。

建议三图组合：ST3（算法深度）+ ST7（产品成熟度）+ ST6（交互性）。
```

---

### 【板块 9】CLOSE（收尾条：QR 码 + 数据来源 + 参考文献）

**v0 现状**：554mm 通栏，高 72mm。四个 QR 码占位框（GitHub 一个 + 三个 `link pending`）+ 数据来源声明（data.gov.sg · OneMap · geoBoundaries · MAS）+ 参考文献位。

**→ 后端意见**：
```
保留。

QR 码建议：
- GitHub repo（必放）
- Live demo（ST0 首页，必放）
- ST7 LLM Report（可选，展示最新功能）
- Data sources（可选，指向 data.gov.sg HDB resale 页面）

数据来源声明建议补充 CPI 来源：
"Data: data.gov.sg (HDB Resale Prices, CPI) · OneMap · geoBoundaries · MAS"
```

---

### 9.3 最后两个整体性问题

#### A. 有没有**该有但 v0 完全没有**的板块？

比如：负担能力引擎（Affordability Engine）现在只在 INNOVATION 里露了个点阵图，MAS 的 MSR 30% / TDSR 55% / LTV 75% / BSD 累进税 / 二分法求解这一整套金融规则算法，**版面上几乎没有正面篇幅**。这值得单开一块吗？

- [x] 该加的板块 = **AFFORDABILITY ENGINE（负担能力引擎）**——MAS 规则算法是 HDBrain 区别于纯 ML 项目的核心差异化，值得从 INNOVATION 中独立出来，与 MODEL ARENA 并列
- [x] 该删的板块 = **无**——现有 9 个板块都有保留价值，但 THE HONEST FINDING 需要重写（见板块 7）

#### B. 如果只能保住**三块**，你选哪三块？

评委的注意力有限。假设版面被压缩到只能讲三件事，**你认为最能代表这个项目的三块是什么**？

- [x] 第一 = **AI ARCHITECTURE**（系统全貌，hero_architecture.png 一图胜千言）
- [x] 第二 = **MODEL ARENA**（模型性能 + 可部署性论点，XGBoost R² 0.888 + 7.8 MB）
- [x] 第三 = **THE PRODUCT**（LLM report writer + SHAP waterfall + 交互式 arena，证明这不是一个 notebook）

（这个答案会决定前端怎么分配版面权重和视觉层级。）

---

## 附：数字对不上时怎么办

如果你发现 §3 的某个数字和你本地跑出来的对不上，**以你的为准**，覆盖掉，并在 §7 记一笔。

已知的一个历史遗留：`README_XCH.md` §4 记录的数字与 `Outputs/outputs/` 有微小出入（RF RMSE 差 48、XGB RMSE 差 51、coverage 差 1.1pp、SHAP 差约 1,100），量级与「不同批次训练 / SHAP 的 2000 条随机子采样 / quantile 的 `subsample=0.8`」一致。**前端一律以 `Outputs/outputs/` 为准。** 如果你能确认哪一版才是最终版，请在 §7 说明。

---

**问题直接找 XCH（前端）。改完把整个文件夹（md + assets/）传回即可。**
