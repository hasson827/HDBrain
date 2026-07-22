# HDBrain

A tool for predicting Singapore HDB resale prices and providing home-buying affordability advice. This is the final project of our team in the NUS Summer Workshop.

## Large files

The following directories are **not tracked** by Git because they are too large for GitHub:

- `data/` — raw and processed CSVs (~ hundreds of MB)
- `models/` — trained model artifacts (the Random Forest model alone is ~16 GB)
- `outputs/` — metrics, plots, CSVs
- `reference/` — reference repository / external materials

These are generated locally by the scripts below.

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

### 3. Generate data and train models

Place the original HDB resale price CSVs into `data/raw/`, then run:

```bash
# Build processed dataset
python src/data/preprocess_reference.py
python src/data/build_dataset.py

# Train all models, SHAP, ablation, and quantile regression
python src/run_pipeline.py

# Run affordability engine
python src/run_affordability.py

# Run unit tests
pytest
```

After running, model artifacts will be in `models/` and all metrics/plots in `outputs/`.

## Project Structure

```text
HDBrain/
├── data/               # Raw and processed datasets (not tracked)
├── docs/               # Design docs, data processing docs, interface specs
├── models/             # Trained model artifacts (not tracked)
├── outputs/            # Generated outputs (not tracked)
├── reference/          # Reference materials (not tracked)
├── src/                # Source code
│   ├── affordability/  # Affordability engine
│   ├── data/           # Data preprocessing and dataset builder
│   ├── experiment/     # Feature ablation experiments
│   ├── models/         # Model training scripts
│   ├── run_affordability.py
│   ├── run_explain.py
│   └── run_pipeline.py
├── tests/              # Unit tests
├── environment.yml     # Conda environment
├── requirements.txt    # Python dependencies
└── README.md
```

## Notes

- The Random Forest model is very large due to full-depth trees. If disk space is a concern, consider reducing `n_estimators` or `max_depth` in `src/models/random_forest.py`.
- Prediction intervals from the quantile model are calibrated on the 2017–2023 distribution; coverage on 2024 data is low due to price inflation drift. See `docs/streamlit_interface.md` for the Streamlit app interface spec.
- The affordability engine uses a default 25% downpayment and a 30% Mortgage Servicing Ratio (MSR) limit, consistent with current HDB concessionary-loan rules. When `cash_savings` is provided on the `BuyerProfile`, the maximum affordable price is additionally capped by the upfront budget (downpayment + stamp duty must fit within cash + CPF). See `src/affordability/` for the full calculation logic.

## References

Full list from [`literature_review.md`](../literature_review.md), which also
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
