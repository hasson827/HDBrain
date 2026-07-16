# HDBrain — 新加坡组屋(HDB)ML估值与购房负担能力顾问：专属主文档

> 上游文档：[BRAINSTORMING_MASTER.md](./BRAINSTORMING_MASTER.md)（Idea 5 当选）
> 团队：4 人 ｜ 自定 DDL：**10 天**（2026-07-13 → 2026-07-23）
> 本文档定位：Idea 5 的唯一工作主文档——概念展开、调研结果、工作流程、后续所有该 idea 的进展都记录在此。

---

## 目录（骨架）

1. [产品故事 (User Story)](#1-产品故事-user-story)
2. [功能构想 (Feature Ideation)](#2-功能构想-feature-ideation)
3. [前端 / 后端架构想象 (Architecture Sketch)](#3-前端--后端架构想象-architecture-sketch)
4. [技术细节展开：ML / LLM / Web 各做什么](#4-技术细节展开)
5. [广泛调研结果 (Research Findings)](#5-广泛调研结果-research-findings)
6. [10 天四人工作流程 (Workstreams & Plan)](#6-10-天四人工作流程)
7. [差异化定位与评分对照 (Positioning)](#7-差异化定位与评分对照)
8. [风险清单与开放问题 (Risks & Open Questions)](#8-风险清单与开放问题)
9. [工作日志 (Work Log)](#9-工作日志-work-log)

---

## 1. 产品故事 (User Story)

### 主线故事：Wei Ling 和 Marcus 的买房之旅

Wei Ling（27 岁，市场营销专员，月薪 S$4,800）和未婚夫 Marcus（29 岁，物流主管，月薪 S$5,500）打算明年结婚。BTO 摇号两次失败后，他们决定转向转售组屋（HDB resale flat）市场。周五晚上，两人坐在咖啡馆里打开了 **HDBrain**。

**第一幕：我们到底买得起什么？（负担能力，Affordability）**
Wei Ling 在「Affordability Explorer」里输入两人的月收入、现有存款（现金 S$60k + CPF OA 合计 S$110k）、每月车贷 S$600。系统瞬间按 MSR 30%（Mortgage Servicing Ratio，月供收入比）、TDSR 55%（Total Debt Servicing Ratio，总债务收入比）、LTV 75%（Loan-to-Value，贷款价值比）规则算出：**最高可负担房价约 S$68 万**（HDB 贷款路径）或 S$72 万（银行贷款路径，但需多付 5% 现金）。新加坡地图立即变色——**买得起的镇区亮绿灯**：Woodlands、Sengkang、Punggol 的 4-room 随便挑；Queenstown、Bishan 的 4-room 大面积灰掉，但同镇 3-room 还亮着。两人第一次对"预算 vs 地段"的取舍有了直观的全景图。

**第二幕：这套房到底值多少？（ML 估值）**
中介带他们看了一套 Sengkang 的 4-room，卖家开价 S$62 万。Marcus 把地址、楼层区间（10-12 层）、面积 93㎡、剩余租期 74 年输入「AI Valuation」。模型（XGBoost，训练于 90 万+ 条官方成交记录）给出估值 **S$58.6 万，90% 置信区间 [S$56.1 万, S$61.2 万]**——开价高出估值 5.8%。页面下方的 SHAP 瀑布图解释了每一分钱：+S$3.2 万来自"距离 MRT 380 米"，+S$1.8 万来自中高楼层，**−S$2.4 万来自剩余租期只剩 74 年**。旁边自动列出同小区近 6 个月 8 笔真实成交对照。两人拿着这张"估值卡"跟卖家砍到了 S$59.5 万。

**第三幕：现在买还是再等等？（市场脉搏）**
Wei Ling 心里还打鼓：房价会不会跌？她点开「Market Pulse」：Sengkang 4-room 价格指数过去 12 个月 +4.2%，模型对下季度的方向判断是"温和上行"，且该镇当前"估值热度分"处于全岛中位——不算过热。LLM 生成的一段人话总结写道："以你们的预算，该镇当前溢价水平合理；若再等 6 个月，按近期趋势可能多付约 S$1-2 万，但你们的 CPF 也会增长约 S$8k，紧迫性中等。"

**第四幕：结果**
两周后他们以 S$59.3 万签约——比开价省下 S$2.7 万，月供 S$1,780（收入的 17.3%，远低于 30% 红线），Wei Ling 把 HDBrain 的估值报告 PDF 存进了婚礼筹备文件夹。

### 次要用户画像（一并覆盖，展示时可提）

| 用户 | 场景 | 用到的功能 |
|---|---|---|
| 卖家 Auntie Tan | 想知道自家 Toa Payoh 老三房挂牌价该定多少 | AI 估值 + 同类成交对照 |
| 换房家庭 | 卖 4-room 换 5-room，算"卖旧买新"的资金缺口 | 估值 × 2 + 负担能力引擎 |
| 政策研究者/学生 | 想看"剩余租期衰减对价格的影响"（99 年地契问题） | 市场分析页的租期-价格曲线 |

---

## 2. 功能构想 (Feature Ideation)

> 分为 P0（核心，必须有，直接对应评分项）/ P1（强烈建议）/ P2（时间富余再做）。

### P0 — 核心闭环（缺一不可）

1. **AI Valuation 估值器**：输入镇区/楼型/楼层/面积/剩余租期（→ 自动地理编码补齐 MRT 距离等特征）→ 输出估值 + 置信区间 + SHAP 逐特征解释瀑布图 + 近期同类真实成交对照表。**这是 ML 主线的门面。**
2. **Affordability Explorer 负担能力地图**：输入收入/存款/CPF/现有债务 → 规则引擎（MSR/TDSR/LTV/印花税 BSD）算出最高可负担价 → 地图上按镇区×楼型高亮"买得起/买不起"，点击镇区看该预算下的可选楼型和预计月供。**这是产品创新的门面（估值的反向查询）。**
3. **Model Arena 模型对比页**：Linear Regression / Ridge / Random Forest / XGBoost /（可选 LightGBM、简单 NN）的 RMSE / MAE / R² / MAPE 横向对比表 + 残差分析图 + 特征重要性对比。**这是 60% 评分项的直接证据陈列室——别的组藏在 notebook 里，我们把它做成产品页面。**

### P1 — 强烈建议

4. **Market Pulse 市场脉搏**：分镇区价格指数曲线（可按楼型筛选）、同比涨幅热力图、"估值热度分"（当前成交价 vs 模型估值的镇区级平均溢价——负数=可能低估的镇）。
5. **Lease Decay Lab 租期衰减实验室**：固定其他特征，只滑动"剩余租期"滑块，实时看估值曲线——把新加坡人最关心的 99 年地契问题做成可交互的教学工具（展示/poster 的高光点）。
6. **LLM 报告生成**：一键把估值结果 + SHAP + 负担能力结论合成一段自然语言"购房顾问报告"（可下载）。单次 API 调用，成本可忽略。
7. **Responsible AI 页**：模型局限性声明（不能替代持牌估价师）、数据截止时间、置信区间的正确解读、按镇区/楼型分组的误差公平性审计表。**5% 送分项 + 加深专业印象。**

### P2 — 时间富余再做

8. 租金估值（data.gov.sg 也有 HDB 出租登记数据）→ "买 vs 租"对比计算器。
9. BTO vs Resale 对比器（等 BTO 的机会成本估算）。
10. 聚类页：K-means 把 26 个镇按价格行为聚成"价格带"，展示无监督学习。
11. 历史回测：用 2023 年前数据训练、预测 2024-2025 成交，展示模型的时间外推能力（这个其实建议升 P1，见 §4.1 评估设计）。

---

## 3. 前端 / 后端架构想象 (Architecture Sketch)

### 3.1 总体形态：两条备选路线

| | 路线 A：纯 Streamlit（推荐） | 路线 B：React + FastAPI 全栈 |
|---|---|---|
| 结构 | Streamlit 多页应用，模型以 pickle/joblib 加载 | React(Vite)+ECharts/Mapbox 前端 ⇄ FastAPI 后端 ⇄ 模型服务 |
| 工期 | 2-3 人日 | 6-8 人日 |
| 评分 | Dashboard usability 10% 完全够 | 同样是 10%，无额外分 |
| 结论 | **默认走 A**；4 人里前端手快、且 P0 提前完成时可升级 B | 备选 |

课程官方也把 Streamlit 列为推荐路径（Lecture 6），评分表里应用可用性只占 10%——工程炫技的边际收益为零，**把省下的时间全部砸进模型与评估**。

### 3.2 后端（数据与模型层）设想

```
┌─────────────────────────────────────────────────────┐
│  离线管道（notebook / scripts，一次性+定期重跑）       │
│  data.gov.sg CSV (1990-now, ~90万条)                 │
│    → 清洗（楼层区间中点化、租期解析成月、面积异常值）    │
│    → OneMap API 地理编码（block 地址 → 经纬度，带缓存）│
│    → 特征工厂：距最近MRT/CBD距离、镇区one-hot、        │
│      成交年月、楼龄、storey、flat_model 等            │
│    → enriched_dataset.parquet                       │
│    → 训练脚本：LR/Ridge/RF/XGBoost + GridSearchCV    │
│      + 时间切分验证 → models/*.joblib + metrics.json │
│    → SHAP explainer 预计算                           │
├─────────────────────────────────────────────────────┤
│  在线层（Streamlit 进程内直接调用）                   │
│  · 估值服务：特征拼装 → model.predict → 区间 → SHAP   │
│  · 负担能力引擎：纯规则函数（MSR/TDSR/LTV/BSD/月供公式）│
│  · 对照检索：pandas 按镇/楼型/面积近邻查询成交记录      │
│  · LLM 客户端：一个薄封装，失败时优雅降级为模板文本      │
└─────────────────────────────────────────────────────┘
```

关键设计取舍：
- **地理编码离线做、结果落盘缓存**（全岛 HDB block 仅约 1 万个唯一地址，一次跑完永久复用）——在线请求零外部依赖，演示时不怕断网/限流。
- 数据集 enriched 后以 parquet 存储，Streamlit 直接读，不需要数据库（"simple web application"的字面许可）。
- 模型全部预训练落盘，页面加载 <1s。

### 3.3 前端（页面结构）设想

```
侧边栏导航
├── 🏠 Home             一句话价值主张 + 三入口
├── 💰 AI Valuation     表单 → 估值卡（数字+区间）→ SHAP瀑布图 → 可比成交表
├── 🗺️ Affordability    收入表单 → 可负担上限卡 → 镇区×楼型热力地图（pydeck/plotly）
├── 📈 Market Pulse     镇区指数曲线、热度热力图、租期衰减滑块实验室
├── ⚔️ Model Arena      模型对比表、残差图、特征重要性、时间外推回测
└── 🛡️ Responsible AI   局限性、公平性审计、数据来源声明
```

视觉锚点（poster/demo 记忆点）：**新加坡地图热力图**（Affordability）+ **SHAP 瀑布图**（Valuation）+ **租期衰减曲线**（Lease Lab）。

---

## 4. 技术细节展开

### 4.1 ML 要做什么（项目的 60% 主线）

**任务定义**：监督回归——给定房屋特征，预测转售成交价 `resale_price`。

**特征工程（评分 20% 的对应物，要做出层次感）**
| 层 | 特征 | 说明 |
|---|---|---|
| 原始 | town, flat_type, flat_model, floor_area_sqm, storey_range, lease_commence_date, month | 直接来自官方数据 |
| 衍生 | remaining_lease_months（解析）、storey_mid（区间中点）、flat_age、成交年/月（周期性编码） | 展示清洗功力 |
| **地理（我们的差异化）** | 距最近 MRT 站距离、距 CBD(Raffles Place)距离、1km 内小学数量（可选）、经纬度 | OneMap API 免费地理编码 |
| 市场 | 该镇过去 6 个月同楼型中位价（滞后特征，防泄漏：只用成交月之前的数据） | 展示时间序列意识 |

**模型阵容与对比实验（评分 20%+20% 的对应物）**
1. Baseline 0：镇区×楼型分组中位价（"中介经验法"，必须有，用于回答"ML 到底带来多少提升"）。
2. Linear Regression → Ridge/Lasso（正则化对比）。
3. Random Forest。
4. XGBoost（预期冠军，文献里 R²≈0.96-0.98、MAE≈S$1.5-2 万）。
5. 可选：LightGBM、简单 MLP（覆盖"深度学习也试过"）。

**评估设计（这是拉开差距的地方，别的组常见错误是随机切分）**
- **时间切分为主**：train ≤2023-12，test = 2024-01 至今——模拟真实部署（"用历史预测未来"）；同时报告随机切分结果，**对比两者差异本身就是一个发现**（随机切分会高估性能，因为同小区同期成交泄漏）。
- 指标：RMSE、MAE、R²、**MAPE 与中位百分比误差**（行业口径——SRX X-Value 公布的就是"中位误差 2.8%"，我们直接跟行业标杆对表！）。
- 分组误差分析：按镇区/楼型/价格段的 MAE 表 → 同时喂给 Responsible AI 公平性讨论。
- 不确定性：Quantile Regression（XGBoost 的 quantile 目标或 GBR quantile loss）给出 5%-95% 置信区间，并做区间覆盖率校验。
- 消融实验：无地理特征 vs 有地理特征——定量证明"我们加的 MRT 距离值多少钱"。

**无监督（可选加分）**：K-means 镇区聚类（按价格水平+增速+波动），Silhouette 选 k，正好用上 Lecture 4。

**负担能力引擎（非 ML，纯金融规则，但是金融相关性 20% 的核心素材）**
- MSR ≤ 30%（HDB/EC 适用）、TDSR ≤ 55%、LTV 上限 75%（2024-08 起 HDB 贷款从 80% 下调）、月供按等额本息公式（HDB 贷款利率 2.6% vs 银行贷款约 3-4%，双路径对比）、BSD 印花税分级、CPF OA 可用额。
- 反向求解：给定收入/存款 → 最高可负担房价 → 与各镇区各楼型的模型估值分布求交 → 地图着色。

### 4.2 LLM 要做什么（严格辅助位，符合我们的定调）

| 用途 | 调用时机 | 成本控制 | 降级方案 |
|---|---|---|---|
| 估值报告生成：把估值+SHAP top5+负担能力结论 → 一段人话顾问报告 | 用户点击"生成报告"按钮时 | 每次 1 call，输入 <1k tokens | 无 API key 时回退到模板字符串拼接 |
| Market Pulse 摘要：镇区指数数据 → 每周市场点评 | 离线预生成，存静态文本 | 每周 26 镇 ×1 call，可一次性生成 | 同上 |
| （可选 P2）RAG 政策问答：喂 HDB 官网的购房规则页面，回答"BTO 和 resale 的 grant 差别" | 用户提问时 | 呼应 Lecture 5 的 RAG 主题 | 砍掉不影响主线 |

原则写进代码：**LLM 挂了/没额度，产品所有核心功能照常运行**。这句话本身放进 Responsible AI 页和 presentation，就是加分陈述。

### 4.3 Web 要做什么

- Streamlit 多页应用（见 §3.3），`st.cache_data`/`st.cache_resource` 缓存数据与模型。
- 地图：`pydeck`（Streamlit 原生支持）或 `plotly choropleth`；需要新加坡 planning area 的 GeoJSON（data.gov.sg 有 Master Plan 边界数据）。
- 图表：plotly（交互式 SHAP 瀑布、残差图、指数曲线）。
- 部署：Streamlit Community Cloud（免费、给 TA/评委一个可点击链接——交付物清单里明确要 dashboard link）。

---

## 5. 广泛调研结果 (Research Findings)

> 调研日期：2026-07-13。结论先行：**数据侧完美（官方、免费、量大、字段全），学术与开源侧"预测价格"已被做过多次——所以我们的创新必须落在"估值+负担能力反向查询+不确定性+公平性"的产品与方法组合上，而非预测本身。**

### 5.1 数据来源（全部免费，已验证存在）

| 数据 | 来源 | 内容 | 用途 |
|---|---|---|---|
| **HDB Resale Flat Prices** | [data.gov.sg](https://data.gov.sg/)（官方开放数据门户） | 1990 至今全部转售成交，~90 万条：month, town, flat_type, block, street_name, storey_range, floor_area_sqm, flat_model, lease_commence_date, remaining_lease, resale_price；分 5 个 CSV 按年代拆分，持续更新 | **核心训练数据** |
| **OneMap API** | [onemap.gov.sg](https://www.onemap.gov.sg)（SLA 官方） | 免费地理编码/逆编码/路径规划，无需付费（搜索端点甚至无需注册）；[实操教程](https://medium.com/data-and-beyond/geocoding-the-hdb-property-info-dataset-using-onemap-api-70651e360943) | block 地址 → 经纬度 → MRT/CBD 距离特征 |
| MRT 站点坐标 | data.gov.sg / OneMap / 社区整理 CSV | 全部车站经纬度（含在建线路） | 距离特征 |
| HDB Property Information | data.gov.sg | 每栋 block 的总层数、单位数、建成年 | 特征补充 |
| Master Plan Planning Area 边界 GeoJSON | data.gov.sg (URA) | 镇区多边形 | 地图热力图 |
| HDB Renting Out of Flats | data.gov.sg | 出租登记数据 | P2 租金估值 |
| 政策参数 | [MAS MSR/TDSR 官方解释](https://www.mas.gov.sg/regulation/explainers/new-housing-loans/msr-and-tdsr-rules)、[MoneySense 官方购房负担指南](https://www.moneysense.gov.sg/buying-a-property-how-much-can-you-afford/) | MSR 30% / TDSR 55% / LTV 75%（HDB 贷款，2024-08 起）/ HDB 贷款利率 2.6% / 银行贷款 5% 现金首付规则 | 负担能力引擎的规则依据（**引用官方来源，报告显专业**） |
| 参考数据准备教程 | [Towards Data Science 数据准备实战](https://towardsdatascience.com/predicting-singapore-hdb-resale-price-data-preparation-be39152b8c69/)、[新加坡开放城市数据指南 (Urban Analytics Lab, NUS)](https://ual.sg/project/open-urban-data-singapore/) | 踩坑指南 | 加速 Day 1-2 |

### 5.2 市面成品（竞品/标杆——证明真实需求存在，也是我们对表的对象）

| 产品 | 定位 | 关键事实 | 对我们的意义 |
|---|---|---|---|
| **SRX X-Value** ([srx.com.sg/xvalue-pricing](https://www.srx.com.sg/xvalue-pricing)) | 新加坡最早（2014）的自动估值模型（AVM, Automated Valuation Model） | 自称 98% 准确率；**Resale HDB 中位百分比误差 2.8%**，公寓 2.1%；基于 ML 分析可比成交 | **行业金标准**。我们的评估直接用同口径（中位百分比误差）对表："学生项目 vs 行业标杆差多少" ——极好的 presentation 叙事 |
| **99.co Property Value Tool** ([99.co/singapore/property-value-tool/hdb](https://www.99.co/singapore/property-value-tool/hdb)) | 由 SRX X-Value 驱动（同属 99 Group） | 提供买/卖/租/再融资估值报告 | 学习其结果呈现方式（估值卡+可比成交） |
| PropertyGuru 估值工具 | 竞品 AVM | 按同区同面积历史成交给出高于/低于均值判断 | 功能参照 |
| [工具横评（Ohmyhome）](https://ohmyhome.com/en-sg/blog/the-battle-of-property-valuation-tools-whos-the-most-accurate/)、[Seedly 横评](https://seedly.sg/opinions/comparing-home-valuation-tools-srx-x-value-vs-4-alternatives-for-better-or-for-worse/) | 第三方评测 | 各工具估值差异可达数万新元 | 佐证"估值不确定性"叙事 → 支撑我们的置信区间功能 |
| **市场空白** | — | 竞品全都是"给房估价"；**没有一家做"给人估房"（输入你的财务状况 → 反向告诉你能买哪里）**；MoneySense/银行的负担能力计算器只给一个数字，不连地图不连估值模型 | **这就是我们的创新缺口：Valuation × Affordability 的闭环产品** |

### 5.3 学术界与开源项目

| 类别 | 条目 | 要点 |
|---|---|---|
| 开源（NUS 课程作品！） | [grrrrnt/hdb-resale-price-prediction](https://github.com/grrrrnt/hdb-resale-price-prediction)（NUS CS3244 项目） | 多 ML 模型横评的先例——**说明本校课程语境认可该选题**；也提醒我们必须做得比"裸预测"更多 |
| 开源（最接近我们的） | [teyang-lau/HDB_Resale_Prices](https://github.com/teyang-lau/HDB_Resale_Prices) | 2015-2019 数据，R²=0.96、MAE≈S$2 万，且已做 Streamlit 部署——**架构直接可参考**，同时是我们要超越的基线（更多数据、地理特征、区间估计、负担引擎） |
| 开源 | [hengbl/HDB-Resale-Price-Prediction](https://github.com/hengbl/HDB-Resale-Price-Prediction)、[JackFongNew/Singapore-HDB-Resale-Price-Prediction](https://github.com/JackFongNew/Singapore-HDB-Resale-Price-Prediction)、[changjulian17/resale_HDB](https://github.com/changjulian17/resale_HDB) | 特征工程与建模思路参考池 |
| 技术博客（性能锚点） | [UpLevel 项目报告](https://projects.uplevel.work/features/predicting-property-resale-price-singapore-hdb-private-machine-learning)：GBR RMSE≈S$17.8k、R²=98.7% vs 线性回归 RMSE≈S$36k、R²=94.5%；[Desmond Quek 2025](https://medium.com/@desmond_57481/decoding-the-hdb-property-market-using-machine-learning-to-explain-and-estimate-hdb-resale-prices-7d43b9d5d6e2) 用 SHAP 解释 HDB 价格 | **给了我们明确的性能预期区间**：树模型 R²>0.96 是"及格线"，MAE < S$2 万可达 |
| 学术方向关键词（写报告引用用） | hedonic pricing model（特征价格模型，房地产估值经典理论框架）、automated valuation model (AVM)、lease decay effect（新加坡 99 年地契租期衰减，SMU/NUS 有多篇实证研究） | 报告/短论文的理论包装：我们做的本质是 "ML-based hedonic AVM + affordability constraint mapping" |

### 5.4 调研总结论（一句话）

> 数据完美、选题被验证、竞品与文献给出清晰的性能锚点（中位误差 ~3%、R²≈0.96、MAE≈S$2 万）；**"预测价格"没有创新分，创新分在：① Affordability 反向查询闭环（市场空白）② 置信区间+时间外推的诚实评估 ③ SHAP 可解释 + 公平性审计 ④ 与行业标杆 SRX 同口径对表的叙事。**

---

## 6. 10 天四人工作流程

> DDL：2026-07-23。按**工作流（workstream）**划分而非按天排期；每个 workstream 有负责人（Owner）、产出物（Deliverable）和验收标准（DoD, Definition of Done）。四人代号 A/B/C/D（组内自行认领）。

### Workstream 1：数据管道（Owner: A；前 30% 时间最重）
- 下载 5 个年代段 CSV，合并、schema 对齐（老数据无 remaining_lease 字段，需从 lease_commence_date 推算）。
- 清洗：storey_range → 中点数值；remaining_lease 字符串 → 月数；异常值检查（面积/价格极端值）。
- OneMap 地理编码脚本（带本地缓存 + 限速重试），产出 `block→(lat,lng)` 映射表（~1 万唯一地址）。
- 特征工厂：MRT 距离、CBD 距离、镇区滞后中位价（注意时间防泄漏）。
- **DoD**：`enriched_dataset.parquet` 生成，附一页数据字典；抽查 20 个地址的地理编码正确。

### Workstream 2：建模与评估（Owner: B，C 协作；全程最重，60% 分数所在）
- Baseline（分组中位价）→ LR/Ridge → RF → XGBoost，统一的训练/评估脚手架（同一切分、同一指标函数，保证公平比较）。
- 时间切分 vs 随机切分双轨评估；GridSearchCV/TimeSeriesSplit 调参。
- Quantile 模型输出置信区间 + 覆盖率校验。
- SHAP explainer 预计算与序列化。
- 消融实验（±地理特征）、分组误差表（镇/楼型/价格段）。
- **DoD**：`metrics.json` + 模型文件落盘；XGBoost 时间外推 MAPE 中位数 ≤5%（对标 SRX 2.8%，学生项目 5% 内即可讲好故事）；每个对比实验有一张可直接进 slides 的图。

### Workstream 3：负担能力引擎 + 业务规则（Owner: C）
- 实现 MSR/TDSR/LTV/月供/BSD 印花税/CPF 规则的纯函数库（HDB 贷款 vs 银行贷款双路径），每条规则注明官方出处（MAS/MoneySense）。
- 反向求解器：财务状况 → 最高可负担价 → 与镇区×楼型估值分布求交。
- 单元测试：用 MoneySense 官方计算器的算例做对拍验证。
- **DoD**：至少 5 个手工算例与官方计算器结果一致（±1%）。

### Workstream 4：Web 应用（Owner: D；中后段发力）
- Streamlit 骨架六页（见 §3.3）先用假数据搭出来（不等模型），随后逐页接真数据。
- 地图热力图（planning area GeoJSON + pydeck/plotly）、SHAP 瀑布图、租期滑块实验室。
- LLM 报告生成薄封装（含无 key 降级）。
- 部署到 Streamlit Community Cloud。
- **DoD**：外网可访问链接；一次完整的"故事线走查"（按 §1 的 Wei Ling 剧本从头点到尾无报错）。

### Workstream 5：文档与展示（全员，Owner: A 牵头；最后 30% 时间）
- README/报告（问题陈述、数据、方法、评估、局限、Responsible AI——直接按交付物清单的小节写）。
- Poster（视觉锚点：地图热力图 + SHAP 瀑布 + 模型对比表 + "vs SRX 2.8%"对表图）。
- Slides + demo 演练（按 Wei Ling 故事讲，3 分钟版和 8 分钟版各一）。
- （可选，冲分）ACM 格式 4 页短论文："An Interpretable ML-based AVM with Affordability Mapping for Singapore Public Housing"。
- **DoD**：所有交付物齐 + 至少 2 次全组彩排。

### 里程碑（Milestone，不排日程只设检查点）

| 检查点 | 状态标准 | 建议不晚于 |
|---|---|---|
| M1 数据就绪 | enriched parquet 可用，EDA 完成 | Day 3 |
| M2 模型冠军产生 | 全部模型跑完对比，XGBoost 调优完成 | Day 6 |
| M3 端到端可点 | Web 六页全部接真数据，云端可访问 | Day 8 |
| M4 冻结与打磨 | 功能冻结，只修 bug + 做文档/poster/彩排 | Day 9-10 |

### 并行原则
- W1 与 W4（假数据骨架）、W3 从 Day 1 即可三线并行；W2 在 M1 后火力全开（B+C 双人）；C 在 W3 完成后转入 W2 做评估实验。
- 每晚 15 分钟站会（线上即可）：昨天/今天/阻塞。所有进展记入本文档 §9 工作日志。

---

## 7. 差异化定位与评分对照

**一句话定位（写进 proposal 的第一段）**：
> HDBrain is an interpretable, ML-based automated valuation model (AVM) for Singapore public housing, extended with an affordability-mapping engine that inverts the valuation question — from "what is this flat worth?" to "which flats can *I* afford?" — grounded in official MAS lending rules (MSR/TDSR/LTV).

| 评分项 | 我们的对应弹药 |
|---|---|
| Financial relevance & problem framing 20% | 普通人最大金融决策；MAS 官方规则引擎；hedonic AVM 理论框架 |
| Data prep & feature engineering 20% | 90 万条官方数据 + OneMap 地理特征 + 防泄漏滞后特征 + 数据字典 |
| Model correctness 20% | Baseline→线性→树→集成的完整阶梯 + 调参 + quantile 区间 |
| Evaluation & benchmark 20% | 时间外推评估、消融实验、分组误差、**与行业标杆 SRX 2.8% 同口径对表** |
| Dashboard usability 10% | 六页 Streamlit + 地图 + 云端链接 + 故事线走查 |
| Responsible AI 5% | 专门页面：非持牌估价声明、公平性审计、LLM 降级设计、数据时效 |
| Presentation 5% | Wei Ling 故事线 demo + 三大视觉锚点 |
| Innovative Idea | Affordability 反向查询 = 已验证的市场空白（§5.2） |

**关于新加坡 vs 中国**：确定新加坡。理由：① 官方数据质量碾压（中国二手房无同级公开成交明细）；② 教授/评委的本地共鸣；③ MAS 规则公开明确可引用；④ OneMap 免费。中国方向仅在 limitations 里提一句"框架可迁移"。

---

## 8. 风险清单与开放问题

| 风险 | 等级 | 缓解 |
|---|---|---|
| OneMap API 限速导致地理编码慢 | 中 | 唯一地址仅 ~1 万个；带缓存分批跑，Day 1 就启动 |
| 地图 GeoJSON 与 HDB town 命名对不上（planning area ≠ HDB town） | 中 | 提前做映射表；对不上就退化为按镇散点/气泡图 |
| 随机切分成绩好看、时间切分成绩下滑 | 低 | 这本身就是我们要讲的发现，诚实报告即可 |
| Streamlit Cloud 部署内存限制（90 万行数据） | 中 | 线上只带聚合后数据 + 模型文件；明细查询预生成索引 |
| 规则引擎参数过时（LTV 等政策变动） | 低 | 全部参数集中一个 config 文件 + 标注来源与查证日期 |

开放问题（待组内/TA 确认）：
- [ ] 问 TA：项目是否需要"预测未来价格走势"成分，还是横截面估值即可？（影响是否加一个简单的镇区指数 ARIMA 预测模块——加了正好覆盖 Lecture 4 的统计模型）
- [ ] 组内认领 A/B/C/D 角色
- [ ] 是否冲 ACM 短论文（建议：是，W2 的实验设计本来就是按论文标准做的）
- [ ] LLM 用哪家 API（预算 <$5，任何便宜模型都够）

---

## 9. 工作日志 (Work Log)

| 日期 | 事项 | 产出 |
|---|---|---|
| 2026-07-13 | Idea 5 当选；完成概念展开（故事/功能/架构/技术细节）；完成四轮网络调研（学术、竞品、开源、数据源、政策规则）；制定 10 天四 workstream 计划 | 本文档 v1 |
| 2026-07-13 | 搭建并跑通最小可运行 Pipeline（MVP），验证 Workstream 1（数据管道）与 Workstream 2（建模评估）的核心思路可行 | [`Project/HDBrain_MVP_Pipeline/`](../HDBrain_MVP_Pipeline/)，详见下方 §10 |

（后续每次工作在此追加）

---

## 10. MVP 工作说明（2026-07-13）

> 这一节讲清楚：这次做了什么、为什么这么做、结果说明了什么、和正式版差距在哪、下一步该干嘛。
> 对应产出：[`Project/HDBrain_MVP_Pipeline/`](../HDBrain_MVP_Pipeline/)（独立文件夹，含 `README.md`、`scripts/`、`data/`、`outputs/`）

### 10.1 这次任务的定位

任务要求"最小可运行 pipeline，不需要把前端后端做出来"。所以这次**只打通 ML 主线**（§4.1 里设计的"数据 → 特征工程 → 多模型对比 → 评估"这条 60% 分值所在的链路），完全不碰 Streamlit 页面、LLM 接口、负担能力引擎这些属于 Workstream 3/4 的内容。目的是尽早验证两件最有风险的事：**真实数据到底能不能拿到手**，以及**我们设计的评估方法（时间切分、消融实验）在真实数据上到底跑不跑得出有意义的数字**。这两件事一旦有问题，越早发现成本越低——这也是为什么把它排在 10 天计划最前面做。

### 10.2 做了什么，按顺序讲

**第一步：找数据。** 原计划直连 [data.gov.sg](https://data.gov.sg/) 官方 API 下载，但实测发现该站点有 Cloudflare 反爬保护，本机网络环境下用 `curl` 直连返回 403（不是数据不存在，是访问被拦截，学校网络或浏览器环境大概率没有这个问题）。于是转向一个我们在前期调研阶段（§5.3）就已经发现并记录过的开源项目 [teyang-lau/HDB_Resale_Prices](https://github.com/teyang-lau/HDB_Resale_Prices)——它的仓库里完整镜像了 data.gov.sg 的官方原始 CSV（内容是官方数据，只是访问路径换成了 GitHub），还额外带了 MRT 站点坐标表，正好省掉了自己整理 MRT 坐标的功夫。最终下载到了 **117,527 条 2015-01 至 2020-09 的真实 HDB 转售成交记录**。这不是模拟数据，是真实官方交易记录，只是时间跨度受限于这个镜像仓库最后同步的时间点（2020-09）——正式开发阶段需要换回直连 data.gov.sg 拿到最新数据。

**第二步：清洗和特征工程（`scripts/01_build_dataset.py`）。** 把两个年代段的 CSV 合并、统一 `remaining_lease` 字段格式（2017 年后官方数据写作"61 years 04 months"这种字符串，2015-2016 年数据是纯数字年份，得先统一解析成月数）、把"10 TO 12"这种楼层区间转换成数值中点、算出楼龄。这些是基础清洗。真正体现设计功力的是两块：一是地理特征——用经纬度算每笔交易到最近 MRT 站、到 CBD（Raffles Place）的距离；二是"防泄漏"的市场滞后特征——每笔交易所在镇区和楼型的"过去 6 个月历史中位价"，这里特意用了 `shift(1)` 确保只用**成交月之前**的历史数据，不会用未来信息"偷看"答案（这是很多学生项目容易踩的坑，我们在文档设计阶段就写明了要避免）。

**关于地理坐标的简化，这里要说清楚**：正式设计要求用 OneMap API 对每一栋楼（block）做精确地理编码。但这次 MVP 没有去申请/调用 OneMap API（一是为了让 pipeline 在任何网络环境下都能独立跑通、不依赖外部 API 的稳定性，二是控制这次任务的范围），改用了**26 个 HDB 镇区的中心点坐标**做近似替代——同一个镇区的所有交易共享同一个坐标。这个简化是**故意且明确标注**的：它足够支撑我们验证"地理距离特征到底有没有用"这个方法论问题（结果证明有用，见下），但不足以支撑"精确到每栋楼的定价差异"这个正式版要做的事。README 和本节都把这一点写清楚了，避免后续被误认为是精确坐标。

**第三步：多模型训练与评估（`scripts/02_train_and_evaluate.py`）。** 五个模型放在同一套评估脚手架里公平对比：Baseline（镇区×楼型分组中位价，代表"中介经验法"）、Linear Regression、Ridge、Random Forest、GBRT（Gradient Boosting，这里作为 XGBoost 的替代，原因见下）。做了三组实验：① 随机切分 vs 时间切分，看两者结果差多少；② 有无地理特征的消融实验，量化地理特征的价值；③ 特征重要性 + 置换重要性（permutation importance），看模型到底在依赖什么信息做判断。

**第四步：出图（`scripts/03_make_plots.py`）。** 生成了模型对比条形图（带 SRX X-Value 行业标杆参考线）和特征重要性图，存在 `outputs/` 里，可以直接用在后续的 slides/poster 里。

### 10.3 中间踩的一个坑：environment 被搞坏了，已经修复

按原计划要装 `xgboost` 和 `shap`（正式设计里用 SHAP 做可解释性瀑布图）。`pip install shap` 把本机全局 numpy 从 1.26 升级到了 2.2，而这台机器上的 pandas/streamlit 等一批库是针对 numpy 1.x 编译的，升级后当场导致 `import pandas` 全面报错——不只是这个项目的问题，是**整个 Python 环境**都受影响。发现后立刻用 `pip install "numpy<2"` 把版本压回 1.26.4，卸载了引发冲突的 `shap`、`xgboost`、`cvxpy`，验证 numpy/pandas/sklearn/matplotlib/streamlit 全部恢复正常后才继续往下做。

因为这个原因，MVP 里没有真的用 `xgboost`（用 sklearn 自带的 `GradientBoostingRegressor` 代替，效果同源、原理相近，正式开发时换回 `XGBRegressor` 只需要改一行）、没有用 `shap`（用 sklearn 自带的 `permutation_importance` 加 RandomForest 内置特征重要性代替）。这是这次 MVP 和正式设计之间**最大的一处技术性偏差**，记录在这里防止大家看到 README 里"GBRT_XGBoost_proxy"这种命名感到困惑——这是有意为之的替代方案，不是疏漏。

### 10.4 结果说明了什么

跑出来的核心数字（详见 `outputs/model_comparison_summary.csv` 和 README）：

- **Random Forest 是这次 MVP 里表现最好的模型**：时间切分下 R²=0.900，MAE≈S$32,060，中位数绝对百分比误差 5.44%。这和我们在调研阶段（§5.3）从其他开源项目和论文里查到的性能锚点（R²≈0.96-0.98）比略低，主要因为：① 地理坐标是镇区级近似而非精确坐标；② 用的是更严格的时间外推评估，而不是大部分参考项目用的随机切分。
- **随机切分确实会让模型"显得更好"**：同一个 Random Forest，随机切分给出 R²=0.939，时间切分只有 0.900。这正好验证了我们在文档设计阶段（§4.1）就预判的"评估陷阱"——同小区同时期的成交存在信息泄漏，随机切分会高估真实的样本外表现。这个对比本身就是一个值得写进报告的发现，而不是失败。
- **地理特征确实有用**：去掉 MRT/CBD 距离特征后，GBRT 的 R² 从 0.9044 降到 0.8909。即使只是粗糙的镇区级近似坐标也能带来可测量的提升，这为"正式版换上 OneMap 精确坐标后效果会更好"这个假设提供了初步支撑证据。
- **和行业标杆的差距是可解释、可缩小的**：SRX X-Value 官方公布的 HDB 中位误差是 2.8%，我们目前是 5.4%-6.1%。差距主要来自坐标精度和数据新鲜度（截至 2020-09），而不是方法论缺陷——这个"差距可归因"的叙事本身对报告和 presentation 是有利的。

### 10.5 和正式设计（§3、§4）的差距清单

| 项目 | MVP 现状 | 正式设计要求 | 影响 |
|---|---|---|---|
| 地理坐标 | 26 个镇区中心点近似 | OneMap API 精确到每栋 block | 精度上限，是提升空间最大的一项 |
| 数据时间范围 | 2015-01 ~ 2020-09（GitHub 镜像） | data.gov.sg 最新数据（至今） | 缺了近 5 年市场数据，尤其疫情后的价格结构变化 |
| 树模型 | sklearn GBRT | XGBoost（需重新处理 numpy 版本冲突，建议用虚拟环境隔离） | 预期性能相近，XGBoost 一般略优且训练更快 |
| 可解释性 | Permutation Importance + RF 内置重要性 | SHAP 逐样本瀑布图 | MVP 只能看"整体"重要性，看不到"单笔交易"级别的解释 |
| 不确定性量化 | 无 | Quantile Regression 置信区间 + 覆盖率校验 | 正式版才有"90% 置信区间"这个产品卖点 |
| 调参 | 默认/手调参数 | GridSearchCV + TimeSeriesSplit | 当前数字有进一步优化空间 |
| 前端/负担能力引擎/LLM | 完全没做 | Workstream 3/4 的全部内容 | 本次任务范围明确排除，不是遗漏 |

### 10.6 下一步建议

1. 组内确认后，把这次踩过的 numpy/xgboost/shap 环境冲突问题记下来——**正式开发建议用虚拟环境（venv/conda）隔离**，不要在这台机器的全局 Python 环境里继续装包，避免再次影响其他项目。
2. 优先在学校网络或浏览器环境下测试能否直连 data.gov.sg 官方 API（如果可以，就不需要再依赖 GitHub 镜像，能拿到最新数据）。
3. 申请 OneMap API（免费、据调研不需要注册即可用搜索接口），把地理编码从"镇区近似"升级到"block 精确"，这是下一步性价比最高的改进点。
4. 这次的评估脚手架（`02_train_and_evaluate.py`）设计成了可直接扩展的结构——加新模型、加新实验，都可以在现有函数基础上加，不需要重写。
