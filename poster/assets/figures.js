/*
 * figures.js — SINGLE SOURCE OF TRUTH for every number printed on the poster.
 *
 * Why a .js file and not a .json fetch: the poster must open correctly from
 * file:// (no local server) and must survive Puppeteer's PDF pipeline. fetch()
 * of a local .json is blocked by CORS under file://, so the data ships as a
 * plain global instead. poster.html also hardcodes the same values as inline
 * fallbacks, so a JS failure degrades to a correct (just not auto-updated)
 * poster rather than a blank one. Change a number here, change it there too.
 *
 * Provenance: HDBrain/outputs/, from the full local rebuild of 2026-07-22 —
 * preprocess -> build_dataset -> run_pipeline -> run_affordability ->
 * export_frontend_data, all five stages green. The same run produced
 * web/static/data/*.json, so the poster and the website cannot disagree.
 *
 * Re-running any part of the backend invalidates every figure below. The chain
 * starts at preprocess_reference.py: run_pipeline.py alone will silently
 * reproduce whatever the last preprocessing pass left on disk.
 */
window.FIGURES = {
  _meta: {
    source: "HDBrain/outputs/",
    snapshot: "2026-07-22",
    warning: "Full chain re-run from CPI 1961-2026. Matches web/static/data/*.json.",
  },

  /* ---- dataset ---- */
  n_transactions: "981,450",
  date_from: "1990-01",
  date_to: "2026-07",
  n_features: "29",
  n_train: "915,353",
  n_test: "66,097",
  n_profiles: "1,534",

  /* ---- model arena (test set, temporal split >= 2024) ----
     Ordered worst to best: the poster reads this as a ladder from the agent's
     rule of thumb up to the champion, so the order is content, not sorting. */
  models: [
    { name: "Baseline (area unit price)", rmse: 226103, mae: 190406, r2: -0.296, mape: 28.51 },
    { name: "Linear Regression", rmse: 91038, mae: 61713, r2: 0.790, mape: 7.29 },
    { name: "Ridge (L2, a=1)", rmse: 91038, mae: 61713, r2: 0.790, mape: 7.29 },
    { name: "Lasso (L1, a=1)", rmse: 91040, mae: 61713, r2: 0.790, mape: 7.29 },
    { name: "Random Forest", rmse: 69854, mae: 52271, r2: 0.876, mape: 7.28 },
    { name: "XGBoost", rmse: 66009, mae: 51044, r2: 0.890, mape: 7.32, champion: true },
  ],
  champion_r2: "0.890",
  champion_rmse: "S$66,009",
  champion_mape: "7.32%",
  rf_r2: "0.876",
  /* Measured on disk: 16,089,879,089 B and 8,212,934 B, a ratio of 1,959. */
  rf_size: "15 GB",
  xgb_size: "7.8 MB",
  size_ratio: "2,000",
  /* U+2212 MINUS SIGN, not a hyphen — this one is typeset, not computed. */
  baseline_r2: "−0.296",

  /* ---- quantile calibration ----
     The asymmetry is the point: out-of-distribution misses are almost all on
     one side, which makes this directional bias rather than noise. */
  coverage_train: 90.16,
  coverage_test: 46.71,
  above_q95: 52.48,
  below_q05: 0.81,
  median_bias: "−7.2%",

  /* ---- SHAP global importance (mean |SHAP|, S$) ----
     `feat` is a display label, not the raw column name. The raw name is in the
     comment beside each row, and the labels are exactly what the product shows
     (web/js/feature-labels.js), so the poster and the site name the same
     feature the same way. */
  shap: [
    { feat: "Transaction year", val: 145241 },        // year
    { feat: "Floor area", val: 73149 },               // floor_area_sqm
    { feat: "Flat type", val: 41931 },                // flat_type_code
    { feat: "Distance to city centre", val: 37988 },  // dist_dhoby
    { feat: "Remaining lease", val: 29958 },          // remaining_lease
    { feat: "Storey (floor level)", val: 16351 },     // storey_range_code
    { feat: "Distance to hawker centre", val: 9678 }, // hawker_dist
    { feat: "Distance to MRT station", val: 9674 },   // mrt_dist
  ],

  /* ---- ablation (test R2 drop when the group is removed) ---- */
  ablation: [
    { grp: "year", drop: 0.1146 },
    { grp: "storey", drop: 0.0155 },
    { grp: "floor area", drop: 0.0053 },
    { grp: "amenity distance", drop: 0.0045 },
    { grp: "flat model", drop: 0.0017 },
  ],
  ablation_year_r2_after: "0.775",

  /* ---- affordability scenarios (of 1,534 profiles) ----
     max_affordable_price is set by income and the MAS rules alone, so it does
     not move when the model does; the counts do. */
  scenarios: [
    { income: 3000, price: 264510, count: 0, pct: 0.0 },
    { income: 5000, price: 440850, count: 313, pct: 20.4 },
    { income: 8000, price: 705359, count: 788, pct: 51.4, median: true },
    { income: 12000, price: 1058039, count: 1358, pct: 88.5 },
    { income: 15000, price: 1322549, count: 1489, pct: 97.1 },
    { income: 20000, price: 1763398, count: 1534, pct: 100 },
  ],
};

/* ---- Inject values into any [data-fig] element. -------------------------- */
(function inject() {
  var F = window.FIGURES;
  document.querySelectorAll("[data-fig]").forEach(function (el) {
    var v = F[el.dataset.fig];
    if (typeof v === "string" || typeof v === "number") el.textContent = v;
  });
})();
