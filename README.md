# HDBrain

**Explainable AI for Singapore HDB resale valuation — from 981,450 transactions to a
deployable web product.**

[Live product](https://hasson827.github.io/HDBrain/) ·
[Six-minute walkthrough](https://hasson827.github.io/HDBrain/demo.html) ·
[A1 poster (PDF)](poster/SWS3022_01.pdf)

Capstone for **NUS SWS3022 — AI/ML in Financial Services**, Group 1.
Lin Hali (ZJU) · Xu Chuhao (UIUC) · Zhang Zherui (UIUC) · Zhao Hongshuo (ZJU)

---

## The problem, and what we did differently

Buying a resale flat is the largest financial decision most Singaporeans make. Every
valuation tool on the market prices a flat you have **already picked**. None of them
starts from what you can actually afford.

HDBrain inverts the loop. It prices all **1,534** `(town × flat type × storey)` profiles
on the island, then intersects that price surface with MAS mortgage rules — so the first
thing a household sees is a map of what is within reach, not a number for a flat they may
never be able to buy.

| The question | What HDBrain answers with | Machinery |
|---|---|---|
| *What can we afford?* | A max affordable price, the binding constraint named, and every town tiered on a map | Rule-based engine: MSR 30% / TDSR 55%, LTV 75%, progressive BSD, annuity inversion + bisection |
| *What is this flat worth, and why?* | A point estimate, a 90% interval, and a per-flat SHAP breakdown **in Singapore dollars** | XGBoost + quantile regression (q05/q50/q95) + TreeSHAP |
| *Should we buy now?* | A live 99-year lease-decay curve and a 26-town resale price index | Precomputed model sweeps over `remaining_lease` |

Two design commitments run through all of it:

- **Dual-constraint affordability.** Monthly serviceability *and* upfront cash. The
  backend engine originally reported a max price implied only by the mortgage, which
  tells a household with S$60,000 in savings that it can afford a S$705,359 flat. Both
  the Python engine and the JS port now cap by the upfront budget too (see
  `max_price_from_upfront_budget`), and the product names which constraint binds.
- **An LLM that never calculates.** The report writer and the plain-English explainers
  are LLM-generated prose over a deterministic fact sheet; every `S$` figure in the
  output is checked against the engine's own numbers and rejected if it does not match.
  With no key and no network, a template provider takes over and the product is unchanged.

---

## Results

Six models, one **temporal split**: trained on every sale up to 2023 (915,353 rows),
scored on the 66,097 sales from 2024–2026 that no model ever saw. A random split would
have flattered every row in this table.

| Model | test RMSE | test MAE | test R² | test Median APE |
|---|---:|---:|---:|---:|
| Baseline (area unit price) | S$226,103 | S$190,406 | **−0.296** | 28.51% |
| Linear Regression | S$91,038 | S$61,713 | 0.790 | 7.29% |
| Ridge (L2, α=1) | S$91,038 | S$61,713 | 0.790 | 7.29% |
| Lasso (L1, α=1) | S$91,040 | S$61,713 | 0.790 | 7.29% |
| Random Forest | S$69,854 | S$52,271 | 0.876 | 7.28% |
| **XGBoost — champion** | **S$66,009** | **S$51,044** | **0.890** | 7.32% |

Two things in that table are worth reading twice.

- **Median APE is essentially tied** across Linear Regression, Random Forest and XGBoost
  (7.28–7.32%) while RMSE differs by S$25,000. The typical flat is easy; the champion
  earns its win on the tail, not on the median.
- **Random Forest ties on accuracy and loses on deployability.** R² 0.876 in ≈15 GiB of
  full-depth trees against XGBoost's 0.890 in 7.8 MiB — a ~1,960× size ratio for a 0.014
  R² gap. That is the trade-off that decided which model ships.

**What drives a price** (mean |SHAP|, in S$ — literally how much a feature moves a
valuation):

| `year` | `floor_area_sqm` | `flat_type_code` | `dist_dhoby` (CBD) | `remaining_lease` | `storey_range_code` |
|---:|---:|---:|---:|---:|---:|
| 145,241 | 73,149 | 41,931 | 37,988 | 29,958 | 16,351 |

**Ablation** — test R² lost when a whole feature group is dropped and XGBoost is retrained
(`src/experiment/ablation.py` declares 12 groups; 11 have matching numeric columns and
run): `year` 0.115 → `storey` 0.015 → `floor area` 0.005 →
`amenity distance` 0.005 → `flat model` 0.002. Removing `year` alone takes R² from 0.890
to 0.775.

**Affordability sweep** (1,534 profiles, HDB concessionary loan, 25% downpayment):

| Monthly household income | Max affordable price | Profiles in reach |
|---:|---:|---:|
| S$3,000 | S$264,510 | 0 / 1,534 (0.0%) |
| S$5,000 | S$440,850 | 313 / 1,534 (20.4%) |
| S$8,000 | S$705,359 | 788 / 1,534 (51.4%) |
| S$12,000 | S$1,058,039 | 1,358 / 1,534 (88.5%) |
| S$20,000 | S$1,763,398 | 1,534 / 1,534 (100%) |

---

## The honest finding

A temporal split shows what a random split hides. **Out of distribution, our 90%
prediction intervals collapse:**

| | in-sample (≤2023) | out-of-sample (2024–2026) |
|---|---:|---:|
| Coverage of the nominal 90% interval | 90.16% | **46.71%** |

The failure has a direction, which is the useful part: **52.48%** of real 2024–2026 sales
printed *above* our 95th percentile and only **0.81%** below our 5th, with a **−7.2%**
median bias. The model under-predicts in a rising market, because it was trained before
that market existed and trees cannot extrapolate past the last `year` they saw.

We did not tune this away. It is stated on the poster, on ST7 of the site, and in a
permanent disclosure line above the valuation form.

### The CPI repair

The same investigation turned up a real data defect. Singapore's official CPI series in
`data/raw/CPI.csv` originally ended at **2020-09**, and the preprocessor forward-filled
every month after it — which froze the deflator and quietly made
`real_price = resale_price / cpi × 100` equal to the *nominal* price for everything from
2021 onward, exactly the years in the test set.

We restored the full **1961-01 → 2026-05** series and re-ran the entire chain. The payoff,
measured rather than asserted:

| | before repair | after repair |
|---|---:|---:|
| XGBoost test R² | 0.827 | **0.890** |
| XGBoost test RMSE | S$83,623 | **S$66,009** |
| Ablation drop for `year` | 0.274 | **0.115** |

The last row is the one that matters: the model had been leaning on `year` to absorb an
artifact of the deflator. With a correct CPI series, `year`'s outsized influence falls by
more than half — the model is now learning economics instead of a data bug.

---

## Architecture

```
data/raw/                       preprocess_reference.py            build_dataset.py
  HDB resale 1990-2026  ┐                    │                            │
  CPI 1961-2026         ├──►  transaction wide table  ─────►  data/hdb_dataset.csv
  6 amenity coordinate  ┘      + geodesic amenity distances      981,450 x 29
    sets (MRT, school,           and 2 km counts                 pure numeric,
    hawker, park, mall,          + CPI adjustment                no missing values
    supermarket)
                                             │
                    ┌────────────────────────┴────────────────────────┐
                    ▼                                                 ▼
       src/models/  — temporal split                     src/affordability/
         run_all.py        6 models                        MSR 30% · TDSR 55% · LTV 75%
         quantile_interval q05/q50/q95                     progressive BSD
         shap_analysis     TreeSHAP                        annuity inversion + bisection
       src/experiment/ablation.py  11 groups               dual constraint: loan & cash
                    │                                                 │
                    └────────────────────────┬────────────────────────┘
                                             ▼
                              src/export_frontend_data.py
                        7 precomputed JSON files (~1.6 MB total)
                                             ▼
                    web/  —  static scrollytelling site, 8 stations
              no build step · no server · no model call at runtime · runs offline
```

**Why a static site and not Streamlit + FastAPI.** The course brief allows "other tools",
and three facts pushed us off the default: the Random Forest artifact is 16 GB (nothing
hosted will load it), the expo demo must survive flaky conference wifi, and a scrollytelling
narrative is not something Streamlit can express. Because the valuation space is a finite
grid, we precompute it once and ship JSON — the browser does the interpolation, the
affordability maths, and the rendering. The original Streamlit spec is kept at
`docs/streamlit_interface.md` for provenance; it is the interface contract the exported
JSON still honours.

### The site

Eight stations on the "HDBrain Line": **ST0** departure · **ST1** the three questions ·
**ST2** budget (rules engine + map) · **ST3** valuation (estimate, interval, SHAP
waterfall, comparables) · **ST4** the 99-year clock (scrolling *is* time) · **ST5** market
pulse · **ST6** the arena (six models raced) · **ST7** home (Responsible AI + the report
writer). Vanilla ES modules, no framework, no bundler.

---

## Repository layout

```text
HDBrain/
├── src/
│   ├── data/                  preprocess_reference.py, build_dataset.py
│   ├── models/                6 model scripts + metrics, quantile intervals, TreeSHAP, viz
│   ├── experiment/            ablation.py (11 feature groups)
│   ├── affordability/         calculator, user_profile, mapper, scenarios, viz
│   ├── run_pipeline.py        train everything + quantile + SHAP + ablation
│   ├── run_affordability.py   affordability map, income scenarios, plots
│   ├── run_explain.py         SHAP + ablation only (post-training)
│   └── export_frontend_data.py   models + outputs  ->  web/static/data/*.json
├── web/                       the static product (see "The site" above)
│   ├── js/engine/             JS ports of the valuation query + affordability maths
│   ├── js/stations/           st0.js … st7.js
│   ├── js/report/             LLM providers + deterministic fallback
│   ├── parity_test.html       JS engine vs Python engine, 15 assertions
│   └── SMOKE.md               manual acceptance walkthrough
├── poster/                    A1 conference poster (HTML/CSS source + export + PDF)
├── docs/                      literature review, data lineage, interface spec, master doc
├── tests/                     pytest suite for the affordability engine
├── data/ · models/ · outputs/     generated locally, not tracked (see below)
├── environment.yml · requirements.txt
└── README.md
```

**Not tracked by Git**, because of size — all three are produced by the commands below:

| Directory | Contents | Size |
|---|---|---|
| `data/` | raw + processed CSVs, `hdb_dataset.csv` | ~660 MB |
| `models/` | 7 `.joblib` artifacts (Random Forest alone is ~16 GB) | ~16 GB |
| `outputs/` | metrics JSON, comparison CSVs, SHAP/ablation/affordability plots | ~1.6 MB |

---

## Quickstart

### Just look at it

Nothing to install: open the [live product](https://hasson827.github.io/HDBrain/) or watch
the [six-minute walkthrough](https://hasson827.github.io/HDBrain/demo.html).

### Run the site locally

The exported JSON is committed, so the site runs without training anything. It must be
served over HTTP — ES modules and `fetch()` are blocked under `file://`.

```bash
git clone https://github.com/hasson827/HDBrain.git
cd HDBrain/web
python -m http.server 8770     # or double-click web/start.bat on Windows
```

Then open <http://localhost:8770/>.

### Reproduce the full pipeline

Requires ~20 GB of free disk (the Random Forest artifact dominates) and the raw CSVs in
`data/raw/` — the five HDB resale price files from data.gov.sg, `CPI.csv`, and the
amenity coordinate sets listed under [Data sources](#data-sources-cleaning-and-licensing).

```bash
conda env create -f environment.yml
conda activate HDBrain

# 1. raw CSVs -> transaction wide table -> pure-numeric ML dataset
python src/data/preprocess_reference.py
python src/data/build_dataset.py

# 2. train 6 models + quantile intervals + TreeSHAP + 11-group ablation   (~9 min)
python src/run_pipeline.py

# 3. affordability map, income scenarios, plots                          (~3 min)
python src/run_affordability.py

# 4. regenerate the 7 JSON files the web product reads
python src/export_frontend_data.py

# 5. tests
pytest
```

Timings are from a many-core desktop CPU with `n_jobs=-1`; expect longer on fewer cores.
Artifacts land in `models/`, metrics and plots in `outputs/`, site data in
`web/static/data/`.

---

## Data sources, cleaning, and licensing

All data is public and open.

| Source | Used for | Licence |
|---|---|---|
| [data.gov.sg](https://data.gov.sg) — HDB resale flat prices, 1990-01 → 2026-07 (5 files) | 981,450 transactions, the target variable | Singapore Open Data Licence |
| [data.gov.sg](https://data.gov.sg) — Consumer Price Index, 1961-01 → 2026-05 | Inflation adjustment (`real_price`) | Singapore Open Data Licence |
| data.gov.sg / OneMap — MRT, school, hawker centre, park, mall, supermarket locations | 6 nearest-distance + 6 count-within-2 km features | Singapore Open Data Licence |
| [geoBoundaries](https://www.geoboundaries.org/) | Singapore outline for the ST2 map | CC BY 4.0 |
| MAS / HDB / IRAS published rules | MSR, TDSR, LTV, Buyer's Stamp Duty schedule | Public regulation |

**Cleaning** (full lineage in [`docs/data_processing.md`](docs/data_processing.md)):
storey ranges are ordinal-encoded, remaining lease is reconstructed from
`lease_commence_date`, flat models are collapsed into 5 classes, towns into 5 regions,
month into `sin`/`cos` pairs, and amenity distances use a Haversine coarse filter followed
by an exact geodesic distance. Missing amenity distances are imputed with the town median.
The result is **981,450 rows × 29 numeric features**, no missing values, target
`real_price`.

**Provenance note.** The amenity coordinate sets and the preprocessing logic reproduce the
open-source reference project
[`teyang-lau/HDB_Resale_Prices`](https://github.com/teyang-lau/HDB_Resale_Prices); our
adaptations (updated resale files, extended date range, the CPI repair, `LIM CHU KANG`
region mapping, and the split into two scripts) are itemised in `docs/data_processing.md` §5.
No personal or sensitive data is used anywhere in this project — every transaction record
is already aggregated and anonymised at source.

---

## Testing

| What | How | Status |
|---|---|---|
| Affordability engine maths | `pytest` — 15 cases in `tests/test_affordability.py` | 15/15 |
| **JS ↔ Python parity** | open `web/parity_test.html` — same 15 expectations against `js/engine/affordability.js` | 15/15 |
| Product walkthrough | `web/SMOKE.md` — a scripted manual pass over all 8 stations | documented |
| Model sanity | 5 real 2025 transactions run through the live app, recorded in `web/SMOKE.md` §3 | all land in the documented −8% to −17% band |

The parity test exists because the affordability rules are implemented **twice** — in
Python for the offline pipeline and in JavaScript for the browser. Any drift between them
turns the product into a liar, so both are pinned to the same expectations.

---

## Deployment

The site is published to GitHub Pages by
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) on every push to `main` that
touches `web/`. Pages' branch mode can only serve `/` or `/docs`, so the workflow uploads
`web/` as an artifact instead. Every asset path in the site is relative, which is what lets
it work equally from `https://hasson827.github.io/HDBrain/`, from `localhost`, and from a
laptop with no network at all.

One-time setup is admin-only: **Settings → Pages → Source = "GitHub Actions"**. A workflow
cannot switch this on for itself — `actions/configure-pages` with `enablement: true` is
refused with *"Resource not accessible by integration"*.

---

## Responsible AI, and what this is not

- **This is decision support, not a licensed valuation.** No figure here should be used as
  the basis of an offer, a loan application, or a legal document.
- **Training data ends in 2023.** On 2024–2026 sales the model under-predicts by about 7%
  at the median, and its 90% intervals cover only 46.7% of outcomes. This is disclosed in
  the product, next to the estimate, not buried in a footnote.
- **Intervals are calibrated on the in-sample distribution.** Treat them as a spread
  indicator, not a guarantee.
- **The LLM never produces a number.** It writes prose around figures the deterministic
  engine computed; unrecognised money figures are rejected. If the model is unreachable,
  a template provider generates the same report offline. The product does not degrade.
- **Flat icons are schematic silhouettes**, not photographs of real units.
- **Known gaps**, all recorded rather than hidden: no random-split control, no
  hyperparameter search, no per-town/flat-type fairness audit of residuals, no conformal
  recalibration of the intervals, and the affordability engine does not yet model the
  bank-loan rule that at least 5% of the downpayment must be cash.

---

## How this maps to the course brief

| Requirement | Where it lives |
|---|---|
| Frontend | `web/` — a static scrollytelling product; rationale for not using Streamlit above |
| Backend | No runtime server by design; `src/export_frontend_data.py` is the offline build step that replaces it |
| ≥ 2 AI techniques | Three pairings: Random Forest + XGBoost · Explainable AI (TreeSHAP) + Prediction · ML + LLM (guarded report writer) |
| Literature review | 31 papers in [`docs/literature_review.md`](docs/literature_review.md) — approaches, strengths, limitations, gaps; citation list under [References](#references) |
| Experimental evaluation | 6-model arena on a temporal split, 11-group ablation, quantile calibration, SHAP global + local |
| Poster | [`poster/`](poster/) — A1, built as HTML/CSS and exported to vector PDF |
| QR targets | Repository · [live site](https://hasson827.github.io/HDBrain/) · [demo video](https://hasson827.github.io/HDBrain/demo.html) |
| Bonus: explainable AI, cloud deployment, open-source release | TreeSHAP throughout · GitHub Pages · Apache 2.0 |

---

## Licence

[Apache License 2.0](LICENSE).


## References

Full list from [`literature_review.md`](docs/literature_review.md), which also
records how each paper informed the design (approaches, strengths, limitations,
gaps). Entries marked ★ are the five surfaced on the poster and in the site's
"Further reading".

Course minimum vs. what is here: 8 papers → **31**; 5 from the last five years →
**25**; 2 from reputable publishers → Springer ×5, IEEE ×4, ACM ×2, Elsevier ×1,
Oxford UP ×1, University of Chicago Press ×1; 1 survey → **5**.

- An, S., Song, Y., Jang, H., & Ahn, K. (2025). Toward transparent and accurate housing price appraisal: Hedonic price models versus machine learning algorithms. *Financial Innovation*, 11. Springer. https://doi.org/10.1186/s40854-025-00874-w
- Angelopoulos, A. N., & Bates, S. (2023). Conformal prediction: A gentle introduction. *Foundations and Trends in Machine Learning*, 16(4), 494–591. https://doi.org/10.1561/2200000158
- Bellotti, T. (2017). Reliable region predictions for automated valuation models. *Annals of Mathematics and Artificial Intelligence*, 81(1–2), 71–84. Springer. https://doi.org/10.1007/s10472-016-9534-6
- Das, S. S. S., Ali, M. E., Li, Y.-F., Kang, Y.-B., & Sellis, T. (2021). Boosting house price predictions using geo-spatial network embedding. *Data Mining and Knowledge Discovery*, 35(6), 2221–2250. Springer. https://doi.org/10.1007/s10618-021-00789-x
- Deng, L., et al. (2025). Boosting the accuracy of property valuation with ensemble learning and explainable artificial intelligence: The case of Hong Kong. *The Annals of Regional Science*. Springer. https://doi.org/10.1007/s00168-025-01365-7
- Durai, S. A., & Wang, Z. (2023). Resale HDB price prediction considering COVID-19 through sentiment analysis. In *Proceedings of the 10th European Conference on Social Media (ECSM 2023)*, 10(1), 276–285. ACI. https://doi.org/10.34190/ecsm.10.1.1020
- ★ El Jaouhari, A., Samadhiya, A., Kumar, A., Šešplaukis, A., & Raslanas, S. (2024). Mapping the landscape: A systematic literature review on automated valuation models and strategic applications in real estate. *International Journal of Strategic Property Management*, 28(5), 286–301. https://doi.org/10.3846/ijspm.2024.22251
- Ezennia, I. S., & Hoskara, S. O. (2019). Methodological weaknesses in the measurement approaches and concept of housing affordability used in housing research: A qualitative study. *PLOS ONE*, 14(8), e0221246. https://doi.org/10.1371/journal.pone.0221246
- Geerts, M., vanden Broucke, S., & De Weerdt, J. (2023). A survey of methods and input data types for house price prediction. *ISPRS International Journal of Geo-Information*, 12(5), 200. MDPI. https://doi.org/10.3390/ijgi12050200
- Giglio, S., Maggiori, M., & Stroebel, J. (2015). Very long-run discount rates. *The Quarterly Journal of Economics*, 130(1), 1–53. Oxford University Press. https://doi.org/10.1093/qje/qju032
- Hjort, A. (2022). House price prediction with confidence: Empirical results from the Norwegian market. In *Proceedings of the Eleventh Symposium on Conformal and Probabilistic Prediction with Applications (COPA 2022)*, PMLR 179, 251–265.
- Krasovytskyi, D., & Stavytskyy, A. (2024). Predicting mortgage loan defaults using machine learning techniques. *Ekonomika*, 103(2), 140–160. Vilnius University Press. https://doi.org/10.15388/Ekon.2024.103.2.8
- Lee, J., Stevens, N., Han, S. C., & Song, M. (2024). A survey of large language models in finance (FinLLMs). *arXiv preprint* arXiv:2402.02315.
- ★ Li, B., Gao, F., & Tan, S. (2023). Aging like fine wine: A Singapore public housing story. *International Real Estate Review*, 26(1), 95–126.
- Liu, X.-Y., Yang, H., Gao, J., & Wang, C. D. (2021). FinRL: Deep reinforcement learning framework to automate trading in quantitative finance. In *Proceedings of the 2nd ACM International Conference on AI in Finance (ICAIF '21)*, Article 3, 1–9. ACM. https://doi.org/10.1145/3490354.3494366
- Lundberg, S. M., & Lee, S.-I. (2017). A unified approach to interpreting model predictions. In *Advances in Neural Information Processing Systems 30 (NeurIPS 2017)*.
- Peng, H., Li, J., Wang, Z., Yang, R., Liu, M., Zhang, M., Yu, P. S., & He, L. (2023). Lifelong property price prediction: A case study for the Toronto real estate market. *IEEE Transactions on Knowledge and Data Engineering*, 35(3), 2765–2780. https://doi.org/10.1109/TKDE.2021.3112749
- Rico-Juan, J. R., & Taltavull de La Paz, P. (2021). Machine learning with explainability or spatial hedonics tools? An analysis of the asking prices in the housing market in Alicante, Spain. *Expert Systems with Applications*, 171, 114590. Elsevier. https://doi.org/10.1016/j.eswa.2021.114590
- Romano, Y., Patterson, E., & Candès, E. J. (2019). Conformalized quantile regression. In *Advances in Neural Information Processing Systems 32 (NeurIPS 2019)*, 3543–3553.
- ★ Rosen, S. (1974). Hedonic prices and implicit markets: Product differentiation in pure competition. *Journal of Political Economy*, 82(1), 34–55. University of Chicago Press. https://doi.org/10.1086/260169
- Sia, X. R. S. (2022). Lease decay and the prices of private residential properties in Singapore. *International Real Estate Review*, 25(3), 401–421.
- Tapia, J., Chavez-Garzon, N., Pezoa, R., Suarez-Aldunate, P., & Pilleux, M. (2025). Comparing automated valuation models for real estate assessment in the Santiago Metropolitan Region: A study on machine learning algorithms and hedonic pricing with spatial adjustments. *PLOS ONE*, 20(3), e0318701. https://doi.org/10.1371/journal.pone.0318701
- ★ Tekouabou, S. C. K., Gherghina, Ș. C., Kameni, E. D., Filali, Y., & Idrissi Gartoumi, K. (2024). AI-based on machine learning methods for urban real estate prediction: A systematic survey. *Archives of Computational Methods in Engineering*, 31(2), 1079–1095. Springer. https://doi.org/10.1007/s11831-023-10010-5
- Teoh, E. Z., Yau, W.-C., Ong, T. S., & Connie, T. (2023). Explainable housing price prediction with determinant analysis. *International Journal of Housing Markets and Analysis*, 16(5), 1021–1045. Emerald. https://doi.org/10.1108/IJHMA-02-2022-0025
- ★ Trindade Neves, F., Aparício, M., & de Castro Neto, M. (2024). The impacts of open data and explainable AI on real estate price predictions in smart cities. *Applied Sciences*, 14(5), 2209. MDPI. https://doi.org/10.3390/app14052209
- Wang, P.-Y., Chen, C.-T., Su, J.-W., Wang, T.-Y., & Huang, S.-H. (2021). Deep learning model for house price prediction using heterogeneous data analysis along with joint self-attention mechanism. *IEEE Access*, 9, 55244–55259. https://doi.org/10.1109/ACCESS.2021.3071306
- Xiong, C., Cheung, K. S., & Filippova, O. (2021). Understanding the spatial effects of unaffordable housing using the commuting patterns of workers in the New Zealand Integrated Data Infrastructure. *ISPRS International Journal of Geo-Information*, 10(7), 457. MDPI. https://doi.org/10.3390/ijgi10070457
- Yang, H., Liu, X.-Y., & Wang, C. D. (2023). FinGPT: Open-source financial large language models. *FinLLM Symposium at IJCAI 2023*. arXiv:2306.06031.
- Yang, Z., Hong, Z., Zhou, R., & Ai, H. (2022). Graph convolutional network-based model for megacity real estate valuation. *IEEE Access*, 10, 104811–104828. https://doi.org/10.1109/ACCESS.2022.3210281
- Zhang, B., Yang, H., Zhou, T., Babar, M. A., & Liu, X.-Y. (2023). Enhancing financial sentiment analysis via retrieval augmented large language models. In *Proceedings of the 4th ACM International Conference on AI in Finance (ICAIF '23)*. ACM. https://doi.org/10.1145/3604237.3626866
- Zhang, X., Zhang, T., Hou, L., Liu, X., Guo, Z., Tian, Y., & Liu, Y. (2025). Data-driven loan default prediction: A machine learning approach for enhancing business process management. *Systems*, 13(7), 581. MDPI. https://doi.org/10.3390/systems13070581
