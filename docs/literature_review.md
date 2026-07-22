# Literature Review — HDBrain

**Project:** HDBrain — An Interpretable ML-based Automated Valuation and Affordability Advisory System for Singapore HDB Resale Flats
**Course:** SWS3022 AI/ML in Financial Services, NUS Summer Workshop 2026
**Date:** 2026-07-22

---

## 1. Introduction and Scope

This review surveys the research landscape relevant to HDBrain, a system that (i) predicts Singapore HDB resale prices with ensemble machine learning, (ii) explains each valuation with SHAP, (iii) quantifies price uncertainty with quantile regression and prediction intervals, and (iv) inverts the valuation problem into an affordability advisory ("given your finances, what and where can you buy?"), with LLM-generated narrative reports.

We organise the literature into seven streams: (1) theoretical foundations of hedonic pricing and automated valuation models (AVMs); (2) machine learning for house price prediction, including three recent systematic surveys; (3) the Singapore housing market and the lease-decay problem; (4) explainable AI (XAI) in property valuation; (5) deep learning and spatial methods; (6) large language models and retrieval-augmented generation (RAG) in finance; (7) housing affordability measurement and data-driven serviceability modelling; and (8) uncertainty quantification for price prediction. For each stream we identify current approaches, their strengths and limitations, and close with the research gaps that position HDBrain's contribution.

---

## 2. Theoretical Foundations: Hedonic Pricing and Automated Valuation

**Current approaches.** The theoretical basis of all property valuation modelling is the hedonic price theory of Rosen (1974), which establishes that the price of a heterogeneous good equals the sum of the implicit prices of its attributes, with buyers and sellers reaching equilibrium along the attribute bid/offer functions. This justifies decomposing an HDB resale price into contributions from floor area, storey, remaining lease, and locational amenities, and it provides the economic rationale for interpreting ML feature attributions (e.g., SHAP values) as estimated implicit prices. The theory's strength is its generality and its role as the anchor of every hedonic regression; its limitations are equally well known: it is a pure equilibrium theory with no empirical content, its second-stage identification suffers from endogeneity, and the linear OLS implementations derived from it cannot capture non-linearities or spatial dependence — precisely the gap that machine learning fills.

On the applied side, El Jaouhari et al. (2024) provide a systematic literature review (652 papers screened down to 97) of *automated valuation models* and their strategic applications across development, investment, land management and taxation. They conclude that AVMs materially improve valuation efficiency and market transparency, and identify data integration, ethics, and hybrid models (traditional methods plus advanced analytics) as the main future directions. The review's strength is its application-and-governance perspective on AVMs as decision-support products rather than mere algorithms; its limitation is shallow algorithmic detail and no discussion of Asian public-housing markets.

**Implication for HDBrain.** HDBrain is, in these terms, an ML-based hedonic AVM extended with an affordability-constraint layer — a "strategic application" of AVMs of exactly the kind El Jaouhari et al. (2024) call for.

---

## 3. Machine Learning for House Price Prediction: What the Surveys Say

Three recent systematic reviews map this stream.

**Geerts, vanden Broucke & De Weerdt (2023)** systematically reviewed 93 house-price-prediction papers from 1992–2021, scoring each on model novelty and input-data novelty and clustering the field. They find that traditional methods (hedonic regression, classical ML) with traditional structured inputs still dominate, but the field is slowly moving towards deep learning and unstructured/spatial data; they flag text, imagery and custom deep models as future opportunities. Strengths: large sample, 30-year span, quantitative scoring methodology, and dual coverage of models *and* data types. Limitations: the search window ends in 2021, pre-dating the XGBoost/SHAP/LLM wave; it offers a taxonomy rather than a performance meta-analysis.

**Tekouabou et al. (2024)** conducted a PRISMA systematic survey (Springer, *Archives of Computational Methods in Engineering*) of roughly 70 papers on AI/ML for urban real-estate prediction. They catalogue algorithm families (regression, tree ensembles, SVM, ANN/deep learning, hybrids), data sources and metrics, and conclude that ensemble and hybrid models perform best overall, while **interpretability and cross-region generalisation remain open problems**. Strengths: PRISMA rigour, an authoritative review journal, and an explicit statement of the interpretability gap. Limitations: little attention to policy-regulated markets such as Singapore public housing, and no coverage of generative AI.

**Rico-Juan & Taltavull de La Paz (2021)** (Elsevier, *Expert Systems with Applications*) is the most instructive empirical comparison for our purposes: on asking prices in Alicante, Random Forest achieved valuation errors below 2%, clearly beating spatial hedonic regression, and revealed three types of non-linearity in price–attribute relationships; quantile tools further showed that these non-linearities differ across price quantiles. The authors explicitly advocate **combining** the two families — ML for accuracy, hedonic tools for robustness and interpretability. Strengths: direct evidence on the accuracy-vs-interpretability trade-off, and a method stack (RF + quantile analysis) nearly identical to ours. Limitations: asking rather than transacted prices, a single-city sample, and variable-importance (not SHAP) explainability.

More recently, **An, Song, Jang & Ahn (2025)** (SpringerOpen, *Financial Innovation*) compared hedonic price models with RF and DNNs on Korean apartment appraisals, showing that RF dominated on RMSE/R²/MAE/MAPE at ~13% of the DNN's compute time, and that RF+SHAP explanations agreed in sign with hedonic regression coefficients on nearly all variables — statistical evidence that ML explanations remain economically coherent. **Tapia et al. (2025)** (PLOS ONE) compared LightGBM with spatially adjusted hedonic models (SAR, GWR) in Santiago, adding CNN-derived visual variables; TreeSHAP gave both global and individual (waterfall) explanations, and most distance variables showed non-linear price effects. Their caution — ML outputs are excellent for prediction but must be used carefully for inference — is a caveat we adopt.

**Gap.** The surveys converge on two open problems: interpretability of accurate models, and transfer to regulated, non-standard markets. HDBrain addresses both: SHAP explanations validated against hedonic theory, applied to the policy-regulated Singapore HDB market.

---

## 4. The Singapore Housing Market and Lease Decay

Singapore's 99-year leasehold structure makes *remaining lease* a first-order price determinant and gives this market a distinctive research literature.

**Giglio, Maggiori & Stroebel (2015)** (*Quarterly Journal of Economics*) exploited the coexistence of freehold and leasehold (99–999 years) property in the UK and Singapore to estimate very-long-run discount rates: 100-year leaseholds trade at a 10–15% discount to comparable freeholds, implying discount rates below 2.6% for cash flows beyond 100 years. This is the field's anchor study — top-journal, high-citation, and estimated directly on Singapore transactions (1995–2013). Its limitations for our purposes: the target is discount rates rather than price prediction, the framework is linear hedonic, and the data end in 2013.

**Li, Gao & Tan (2023)** (*International Real Estate Review*) studied HDB resale directly: using the full 1990–2020 transaction record from data.gov.sg, they find a significant, **non-linear (inverted-U) lease premium**, with a marked discount for flats with under 60 years of remaining lease that persists even in mature towns. Strengths: full-population HDB data, long sample, and a quantified non-linear threshold consistent with the industry's "Bala's Table" intuition. Limitations: OLS/fixed-effects only, no unit-level attributes (renovation, orientation), and residual age–lease collinearity.

**Sia (2022)** (*International Real Estate Review*, NUS) separated lease decay from physical ageing for private leasehold condos: each additional 1% of remaining lease raises price by ~1.46%, and the decay effect is asymmetric between freehold and leasehold. This warns modellers (us included) to treat flat age and remaining lease as distinct constructs even though they are highly collinear in HDB data.

On the prediction side, **Durai & Wang (2023)** (ECSM, SMU) showed that COVID-19 Twitter sentiment (VADER scores) added predictive power over traditional structural and neighbourhood features for resale HDB prices — evidence that unstructured, event-driven signals complement hedonic features, though the venue and the dictionary-based NLP method are modest.

**Gap.** No published work systematically applies modern ensemble ML with explainability and uncertainty quantification to the *full* HDB resale record while exploiting the lease-decay structure; existing academic work is linear-hedonic, and existing ML work on HDB lives in course projects and GitHub repositories rather than peer-reviewed venues. HDBrain sits in this gap.

---

## 5. Explainable AI in Property Valuation

**Lundberg & Lee (2017)** (NeurIPS) unified six existing attribution methods into SHAP (SHapley Additive exPlanations) and proved Shapley values are the unique additive feature-attribution satisfying local accuracy, missingness and consistency; the companion TreeSHAP algorithm (Lundberg et al., 2020, *Nature Machine Intelligence*) makes exact Shapley computation tractable for tree ensembles. This is the methodological basis of our explainability layer; its known caveat is that attributions can mislead under strong feature correlation (e.g., age vs. remaining lease — see Section 4).

Three applied studies validate SHAP for valuation. **Deng et al. (2025)** (Springer, *The Annals of Regional Science*) built a three-level ensemble (RF/Extra Trees/XGBoost/LightGBM with bagging/stacking/voting) for Hong Kong housing and explained it with PFI, PDP, ALE, ICE and SHAP; flat age, geographic coordinates and MRT accessibility dominated — a market and a method stack highly comparable to ours, though without transaction-level uncertainty or affordability analysis. **Trindade Neves, Aparício & de Castro Neto (2024)** (MDPI *Applied Sciences*) showed that augmenting XGBoost with **open government data** (bank assessments, cultural amenities, metro distance, macro indicators) significantly improves price prediction, with SHAP attributing the largest effects to floor area and location — direct evidence for our data.gov.sg/OneMap feature strategy, though on asking prices. **Teoh, Yau, Ong & Connie (2023)** (Emerald, *International Journal of Housing Markets and Analysis*) demonstrated SHAP-based determinant analysis across Ames and Melbourne datasets, explicitly framing explanations as decision support for homebuyers and policymakers — the same framing as our advisory reports, albeit on teaching datasets.

**Gap.** Applied SHAP studies stop at feature attribution; none evaluate whether explanations actually help end users make decisions, and none connect explanations to an affordability recommendation. HDBrain's LLM report writer operationalises SHAP output into buyer-facing narratives — a step beyond the current literature.

---

## 6. Deep Learning and Spatial Methods

Deep models push accuracy on heterogeneous and spatial data. **Wang et al. (2021)** (IEEE Access) fused structural attributes, POI data and satellite imagery with a joint self-attention mechanism on Taipei transactions, beating XGBoost and RF baselines — but as a black box without attribution. **Das, Ali, Li, Kang & Sellis (2021)** (Springer, *Data Mining and Knowledge Discovery*) introduced geo-spatial network embedding (GSNE), learning neighbourhood representations from house–POI graphs that capture effects hedonic models cannot express — relevant to Singapore's amenity-driven price surface, at the cost of interpretability. **Yang, Hong, Zhou & Ai (2022)** (IEEE Access) applied graph convolutional networks to megacity (Beijing) valuation, modelling spatial dependence and submarkets explicitly; GCN smoothing and hand-built adjacency remain weaknesses. **Peng et al. (2023)** (IEEE TKDE) addressed temporal drift with *lifelong* property price prediction (Toronto), continually adapting without forgetting — a direct response to the "train once, obsolete immediately" criticism of static models.

**Gap and design choice.** These studies trade interpretability and simplicity for accuracy. Given that (a) surveys find ensemble trees competitive or superior on tabular housing data, (b) An et al. (2025) found RF beats DNNs at a fraction of the cost, and (c) our product requires per-flat explanations, HDBrain deliberately uses gradient-boosted/random-forest ensembles with SHAP rather than deep models, and handles drift through honest temporal evaluation (training on 2017–2023, reporting degraded 2024 coverage) rather than lifelong learning — a documented limitation and future direction.

---

## 7. Financial LLMs and Retrieval-Augmented Generation

The AI4Finance ecosystem defines this space. **Yang, Liu & Wang (2023)** (FinGPT, FinLLM Symposium at IJCAI 2023) argue for data-centric, open-source financial LLMs with lightweight LoRA adaptation instead of monolithic pretraining, listing robo-advising as a primary application. **Liu, Yang, Gao & Wang (2021)** (FinRL, ACM ICAIF '21) provide a three-layer (environment–agent–application) deep-RL framework for automated trading whose modular, reproducible, tutorial-driven engineering is a useful template for any financial ML system. Most directly, **Zhang et al. (2023)** (ACM ICAIF '23) showed that retrieval-augmented LLMs — instruction tuning plus external context retrieval — beat FinBERT and general LLMs by 15–48% on financial sentiment tasks, the earliest rigorous evidence that injecting retrieved domain context fixes generic-LLM failures in finance.

**Lee, Stevens, Han & Song (2024)** survey financial LLMs end-to-end (models, data, fine-tuning, benchmarks, challenges); their discussion of **hallucination and privacy risks** in consumer-facing FinLLMs is especially pertinent (we note this source is an arXiv preprint, not peer-reviewed).

**Design consequence.** HDBrain does not let an LLM produce numbers. Valuation, intervals and affordability thresholds come from the ML/rule engine; the LLM only narrates constrained, structured inputs (SHAP attributions, comparable transactions, policy parameters) — the mitigation that both Zhang et al. (2023) and Lee et al. (2024) motivate. FinGPT-style domain fine-tuning and FinRL-style decision agents are identified as future work rather than current components.

---

## 8. Housing Affordability: Measurement and Data-Driven Modelling

**Ezennia & Hoskara (2019)** (PLOS ONE) qualitatively reviewed 98 affordability-measurement studies, classifying approaches into ratio (income-ratio), residual-income, composite, behavioural, subjective and emerging (MCDM, Gini, mobility-probability) methods. Their central criticism — that ratio methods are unidimensional, the 30% threshold is arbitrary, and housing quality and non-housing costs are ignored — directly informs metric choice; they note mortgage-repayment-to-income measures outperform crude price-to-income ratios.

Two data-driven studies show the direction. **Xiong, Cheung & Filippova (2021)** (MDPI ISPRS IJGI) used New Zealand's individual-level administrative data to build a *modified median multiple* — replacing price-to-income with parameterised mortgage repayments (rate, term, LTV) — and mapped regional unaffordability against commuting distortion. This is exactly the construction we adapt to Singapore rules (HDB concessionary loan, 75% LTV, 30% MSR, 55% TDSR) for our town-level affordability maps, though their study is descriptive, not predictive. On the lending side, **Krasovytskyi & Stavytskyy (2024)** (*Ekonomika*, Vilnius University Press) predicted mortgage defaults from credit-registry data, finding RF and XGBoost superior to logistic regression and the **debt-service-to-income ratio the strongest single predictor** — empirical support for MSR/TDSR-style serviceability constraints and for tree ensembles on affordability-linked outcomes. **Zhang et al. (2025)** (MDPI *Systems*) add a full pipeline (SMOTE/class-weighting, tuned XGBoost/LightGBM, SHAP, cost-sensitive thresholds) for loan default, emphasising explainability for regulatory audit.

**Gap.** ML work concentrates on default/credit risk; affordability *measurement* remains formula-based and static; and no work couples a price AVM to an affordability engine in a closed, buyer-facing loop ("what can this household buy, where, at what confidence?"). This closed loop is HDBrain's primary claimed novelty.

---

## 9. Uncertainty Quantification for Price Prediction

Honest valuation requires intervals, not points. **Angelopoulos & Bates (2023)** (*Foundations and Trends in Machine Learning*) is the standard tutorial survey of conformal prediction — distribution-free, model-agnostic, finite-sample coverage — and defines the vocabulary (calibration sets, nonconformity scores, coverage guarantees) we adopt. Methodologically, **Romano, Patterson & Candès (2019)** (NeurIPS) proposed Conformalized Quantile Regression (CQR): fit conditional quantiles, then calibrate interval width on held-out data for finite-sample marginal coverage with input-adaptive widths — the standard wrapper for boosting quantile models, limited to marginal (not conditional) coverage and vulnerable under distribution shift.

For property specifically, **Bellotti (2017)** (Springer, *Annals of Mathematics and Artificial Intelligence*) first applied conformal prediction to AVMs on London transactions, showing Gaussian-assumption intervals are unreliable for house prices while CP intervals retain validity, with interval width as a second performance metric. **Hjort (2022)** (PMLR, COPA) compared split-conformal, CQR and Mondrian CQR on ~30,000 Oslo transactions with a Random Forest AVM: all met nominal 90% coverage, but CQR produced substantially narrower, property-adaptive intervals — evidence that AVM errors scale with price, so constant-width intervals are wrong.

**Design consequence and gap.** HDBrain currently ships quantile-regression intervals and reports their degradation under 2024 price drift; the literature gives a concrete upgrade path (CQR calibration, per Hjort's evaluation protocol of coverage + interval width), which we list as near-term future work. Drift-robust intervals for policy-shocked markets remain an open research problem (cf. Peng et al., 2023).

---

## 10. Research Gaps and Positioning of HDBrain

Synthesising Sections 2–9, the literature establishes: (i) ensemble tree models are the accuracy–cost sweet spot for tabular housing data, but interpretability and generalisation are open (Tekouabou et al., 2024; An et al., 2025); (ii) Singapore HDB research is rich on lease decay but linear and non-predictive (Giglio et al., 2015; Li et al., 2023); (iii) SHAP is validated for valuation but never wired into buyer decisions (Deng et al., 2025); (iv) financial LLMs need retrieval/constraint to be safe (Zhang et al., 2023; Lee et al., 2024); (v) affordability is measured statically, never fused with AVMs (Ezennia & Hoskara, 2019; Xiong et al., 2021); and (vi) uncertainty is rarely quantified honestly in deployed AVMs (Bellotti, 2017; Hjort, 2022).

HDBrain's contribution is the **integration**: an interpretable ensemble AVM for the full HDB resale record, with SHAP explanations checked against hedonic/lease-decay economics, quantile-based uncertainty with drift-aware evaluation, an inverted affordability query engine parameterised by MAS/HDB lending rules, and a retrieval-constrained LLM that turns model outputs into buyer-facing advice. To our knowledge, no published system combines valuation × affordability × explanation × uncertainty for a regulated public-housing market.

---

## 11. Compliance with Course Literature Requirements

| Requirement | Status |
|---|---|
| ≥ 8 research papers | ✅ 31 papers reviewed |
| ≥ 5 published within the last five years (2021–2026) | ✅ 25 of 31 (all except Rosen 1974; Giglio et al. 2015; Lundberg & Lee 2017; Bellotti 2017; Romano et al. 2019; Ezennia & Hoskara 2019) |
| ≥ 2 from reputable publishers (IEEE, ACM, Springer, Elsevier, Nature, …) | ✅ Springer (Tekouabou 2024; An 2025; Deng 2025; Das 2021; Bellotti 2017); Elsevier (Rico-Juan & Taltavull 2021); IEEE (Wang 2021; Yang 2022; Peng 2023); ACM (Liu 2021; Zhang 2023); Emerald (Teoh 2023); Oxford UP (Giglio 2015); UChicago Press (Rosen 1974) |
| ≥ 1 survey paper | ✅ 5 surveys: Geerts et al. (2023); Tekouabou et al. (2024); El Jaouhari et al. (2024); Lee et al. (2024, preprint); Angelopoulos & Bates (2023); plus qualitative review Ezennia & Hoskara (2019) |
| Identifies approaches, strengths, limitations, gaps, opportunities | ✅ Per-stream strengths/limitations and consolidated gap analysis (Section 10) |

*Note:* Lee et al. (2024) is an arXiv preprint (not peer-reviewed) and is used only as a supplementary survey; the survey requirement is independently satisfied by the four peer-reviewed reviews above.

---

## 12. References

An, S., Song, Y., Jang, H., & Ahn, K. (2025). Toward transparent and accurate housing price appraisal: Hedonic price models versus machine learning algorithms. *Financial Innovation*, 11. Springer. https://doi.org/10.1186/s40854-025-00874-w

Angelopoulos, A. N., & Bates, S. (2023). Conformal prediction: A gentle introduction. *Foundations and Trends in Machine Learning*, 16(4), 494–591. https://doi.org/10.1561/2200000158

Bellotti, T. (2017). Reliable region predictions for automated valuation models. *Annals of Mathematics and Artificial Intelligence*, 81(1–2), 71–84. Springer. https://doi.org/10.1007/s10472-016-9534-6

Das, S. S. S., Ali, M. E., Li, Y.-F., Kang, Y.-B., & Sellis, T. (2021). Boosting house price predictions using geo-spatial network embedding. *Data Mining and Knowledge Discovery*, 35(6), 2221–2250. Springer. https://doi.org/10.1007/s10618-021-00789-x

Deng, L., et al. (2025). Boosting the accuracy of property valuation with ensemble learning and explainable artificial intelligence: The case of Hong Kong. *The Annals of Regional Science*. Springer. https://doi.org/10.1007/s00168-025-01365-7

Durai, S. A., & Wang, Z. (2023). Resale HDB price prediction considering COVID-19 through sentiment analysis. In *Proceedings of the 10th European Conference on Social Media (ECSM 2023)*, 10(1), 276–285. ACI. https://doi.org/10.34190/ecsm.10.1.1020

El Jaouhari, A., Samadhiya, A., Kumar, A., Šešplaukis, A., & Raslanas, S. (2024). Mapping the landscape: A systematic literature review on automated valuation models and strategic applications in real estate. *International Journal of Strategic Property Management*, 28(5), 286–301. https://doi.org/10.3846/ijspm.2024.22251

Ezennia, I. S., & Hoskara, S. O. (2019). Methodological weaknesses in the measurement approaches and concept of housing affordability used in housing research: A qualitative study. *PLOS ONE*, 14(8), e0221246. https://doi.org/10.1371/journal.pone.0221246

Geerts, M., vanden Broucke, S., & De Weerdt, J. (2023). A survey of methods and input data types for house price prediction. *ISPRS International Journal of Geo-Information*, 12(5), 200. MDPI. https://doi.org/10.3390/ijgi12050200

Giglio, S., Maggiori, M., & Stroebel, J. (2015). Very long-run discount rates. *The Quarterly Journal of Economics*, 130(1), 1–53. Oxford University Press. https://doi.org/10.1093/qje/qju032

Hjort, A. (2022). House price prediction with confidence: Empirical results from the Norwegian market. In *Proceedings of the Eleventh Symposium on Conformal and Probabilistic Prediction with Applications (COPA 2022)*, PMLR 179, 251–265.

Krasovytskyi, D., & Stavytskyy, A. (2024). Predicting mortgage loan defaults using machine learning techniques. *Ekonomika*, 103(2), 140–160. Vilnius University Press. https://doi.org/10.15388/Ekon.2024.103.2.8

Lee, J., Stevens, N., Han, S. C., & Song, M. (2024). A survey of large language models in finance (FinLLMs). *arXiv preprint* arXiv:2402.02315.

Li, B., Gao, F., & Tan, S. (2023). Aging like fine wine: A Singapore public housing story. *International Real Estate Review*, 26(1), 95–126.

Liu, X.-Y., Yang, H., Gao, J., & Wang, C. D. (2021). FinRL: Deep reinforcement learning framework to automate trading in quantitative finance. In *Proceedings of the 2nd ACM International Conference on AI in Finance (ICAIF '21)*, Article 3, 1–9. ACM. https://doi.org/10.1145/3490354.3494366

Lundberg, S. M., & Lee, S.-I. (2017). A unified approach to interpreting model predictions. In *Advances in Neural Information Processing Systems 30 (NeurIPS 2017)*.

Peng, H., Li, J., Wang, Z., Yang, R., Liu, M., Zhang, M., Yu, P. S., & He, L. (2023). Lifelong property price prediction: A case study for the Toronto real estate market. *IEEE Transactions on Knowledge and Data Engineering*, 35(3), 2765–2780. https://doi.org/10.1109/TKDE.2021.3112749

Rico-Juan, J. R., & Taltavull de La Paz, P. (2021). Machine learning with explainability or spatial hedonics tools? An analysis of the asking prices in the housing market in Alicante, Spain. *Expert Systems with Applications*, 171, 114590. Elsevier. https://doi.org/10.1016/j.eswa.2021.114590

Romano, Y., Patterson, E., & Candès, E. J. (2019). Conformalized quantile regression. In *Advances in Neural Information Processing Systems 32 (NeurIPS 2019)*, 3543–3553.

Rosen, S. (1974). Hedonic prices and implicit markets: Product differentiation in pure competition. *Journal of Political Economy*, 82(1), 34–55. University of Chicago Press. https://doi.org/10.1086/260169

Sia, X. R. S. (2022). Lease decay and the prices of private residential properties in Singapore. *International Real Estate Review*, 25(3), 401–421.

Tapia, J., Chavez-Garzon, N., Pezoa, R., Suarez-Aldunate, P., & Pilleux, M. (2025). Comparing automated valuation models for real estate assessment in the Santiago Metropolitan Region: A study on machine learning algorithms and hedonic pricing with spatial adjustments. *PLOS ONE*, 20(3), e0318701. https://doi.org/10.1371/journal.pone.0318701

Tekouabou, S. C. K., Gherghina, Ș. C., Kameni, E. D., Filali, Y., & Idrissi Gartoumi, K. (2024). AI-based on machine learning methods for urban real estate prediction: A systematic survey. *Archives of Computational Methods in Engineering*, 31(2), 1079–1095. Springer. https://doi.org/10.1007/s11831-023-10010-5

Teoh, E. Z., Yau, W.-C., Ong, T. S., & Connie, T. (2023). Explainable housing price prediction with determinant analysis. *International Journal of Housing Markets and Analysis*, 16(5), 1021–1045. Emerald. https://doi.org/10.1108/IJHMA-02-2022-0025

Trindade Neves, F., Aparício, M., & de Castro Neto, M. (2024). The impacts of open data and explainable AI on real estate price predictions in smart cities. *Applied Sciences*, 14(5), 2209. MDPI. https://doi.org/10.3390/app14052209

Wang, P.-Y., Chen, C.-T., Su, J.-W., Wang, T.-Y., & Huang, S.-H. (2021). Deep learning model for house price prediction using heterogeneous data analysis along with joint self-attention mechanism. *IEEE Access*, 9, 55244–55259. https://doi.org/10.1109/ACCESS.2021.3071306

Xiong, C., Cheung, K. S., & Filippova, O. (2021). Understanding the spatial effects of unaffordable housing using the commuting patterns of workers in the New Zealand Integrated Data Infrastructure. *ISPRS International Journal of Geo-Information*, 10(7), 457. MDPI. https://doi.org/10.3390/ijgi10070457

Yang, H., Liu, X.-Y., & Wang, C. D. (2023). FinGPT: Open-source financial large language models. *FinLLM Symposium at IJCAI 2023*. arXiv:2306.06031.

Yang, Z., Hong, Z., Zhou, R., & Ai, H. (2022). Graph convolutional network-based model for megacity real estate valuation. *IEEE Access*, 10, 104811–104828. https://doi.org/10.1109/ACCESS.2022.3210281

Zhang, B., Yang, H., Zhou, T., Babar, M. A., & Liu, X.-Y. (2023). Enhancing financial sentiment analysis via retrieval augmented large language models. In *Proceedings of the 4th ACM International Conference on AI in Finance (ICAIF '23)*. ACM. https://doi.org/10.1145/3604237.3626866

Zhang, X., Zhang, T., Hou, L., Liu, X., Guo, Z., Tian, Y., & Liu, Y. (2025). Data-driven loan default prediction: A machine learning approach for enhancing business process management. *Systems*, 13(7), 581. MDPI. https://doi.org/10.3390/systems13070581
