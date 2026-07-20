/**
 * ST6 The Arena / Model Comparison (README_XCH §7.3 ST6 / §8 S1 task 6). S1
 * scope: a default-theme ECharts bar chart with a metric picker, plus plain
 * tables for the ablation experiment and global SHAP importance. No racing
 * animation, no flip card — those are S3.
 */
import { getArena } from "../engine/valuation.js";
import { recordArenaSnapshot } from "../state.js";
import { getGsap, DURATION, prefersReducedMotion } from "../motion.js";
import { scrollFloat } from "../scroll-float.js";
import { featureLabel } from "../feature-labels.js";

const METRICS = ["rmse", "mae", "r2", "mape"];

// Display names for the raw data keys. Two are not just prettified casing:
// the arena.json "mape" is actually the MEDIAN absolute percentage error
// (README_XCH §2.3 #3 — same yardstick SRX X-Value publishes, and it must be
// labelled Median APE, not MAPE), and "r2" needs its superscript.
const METRIC_LABELS = { rmse: "RMSE", mae: "MAE", r2: "R²", mape: "Median APE" };
const METRIC_AXIS = { rmse: "RMSE (S$)", mae: "MAE (S$)", r2: "R²", mape: "Median APE (%)" };

// Model keys as exported from Python -> names a visitor can read.
const MODEL_LABELS = {
  baseline: "Baseline (group median)",
  linear_regression: "Linear Regression",
  lasso_regression: "Lasso",
  ridge_regression: "Ridge",
  random_forest: "Random Forest",
  xgboost: "XGBoost",
};

const SPLIT_LABELS = { train: "Train (up to 2023)", test: "Test (2024 onwards)" };

// Feature-ablation group keys -> what was actually dropped.
const ABLATION_LABELS = {
  year: "Transaction year",
  storey: "Storey (floor level)",
  amenity_distance: "Amenity distances (6 types)",
  floor_area: "Floor area",
  dist_dhoby: "Distance to city centre",
  amenity_count: "Amenity counts (within 2 km)",
  flat_model: "Flat model",
  region: "Region",
  flat_type: "Flat type",
  lease: "Remaining lease",
  month_cycle: "Month of year (seasonality)",
};

export function initSt6() {
  const root = document.getElementById("st6-arena");
  if (!root) return;

  const arena = getArena();
  const xgboost = arena.models.find((m) => m.model === "xgboost");
  if (xgboost) {
    recordArenaSnapshot({ test_r2: xgboost.test.r2, test_mape: xgboost.test.mape });
  }

  root.innerHTML = `
    <div class="station-inner">
      <h2>ST6 &middot; The Arena &middot; Six models, one truth</h2>
      <p class="lede">Trained on transactions up to 2023, tested on 2024 onward &mdash; the model never sees the
         future it is judged on.</p>
      <div class="card">
        <div class="metric-tabs" id="st6-metric-tabs" role="tablist">
          ${METRICS.map((m, i) => `<button type="button" class="metric-tab" data-metric="${m}" aria-pressed="${i === 0}">${METRIC_LABELS[m]}</button>`).join("")}
        </div>
        <div id="st6-chart" style="width: 100%; height: 380px;"></div>
        <p class="disclosure">RMSE / MAE &mdash; typical prediction error in S$ (lower is better).
           R&sup2; &mdash; share of price variation the model explains (1 is perfect; below 0 means
           worse than always guessing the average). Median APE &mdash; the typical error as a
           percentage of the actual price (lower is better).</p>
      </div>

      <details class="disclosure-block card">
        <summary>Quantile interval coverage (90% target)</summary>
        <p class="disclosure">How often the 90% prediction interval actually contains the real price, by split.</p>
        <div style="overflow-x:auto;">
          <table>
            <thead><tr><th>Split</th><th>Coverage</th><th>Avg width</th><th>Median width</th></tr></thead>
            <tbody>
              ${arena.quantile_metrics.map((q) => `<tr><td>${SPLIT_LABELS[q.split] ?? q.split}</td><td>${(q.coverage_90 * 100).toFixed(1)}%</td><td>S$${Math.round(q.avg_width).toLocaleString("en-SG")}</td><td>S$${Math.round(q.median_width).toLocaleString("en-SG")}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </details>

      <details class="disclosure-block card">
        <summary>Feature ablation: what happens if we drop a feature group</summary>
        <p class="disclosure">Test-set impact of removing each feature group before retraining &mdash; the biggest
           jump is the real story (see the Arena chart above for context).</p>
        <div style="overflow-x:auto;">
          <table>
            <thead><tr><th>Dropped</th><th>Test RMSE</th><th>RMSE increase</th><th>R&sup2; drop</th></tr></thead>
            <tbody>
              ${arena.ablation.map((a) => `<tr data-ablation="${a.ablation}"><td>${ABLATION_LABELS[a.ablation] ?? a.ablation}</td><td>S$${Math.round(a.test_rmse).toLocaleString("en-SG")}</td><td>S$${Math.round(a.rmse_drop).toLocaleString("en-SG")}</td><td>${a.r2_drop.toFixed(4)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </details>

      <details class="disclosure-block card">
        <summary>Why is the Baseline's R&sup2; negative?</summary>
        <p>The CPI (Consumer Price Index) file used to inflation-adjust prices ends in 2020-09; months after that are
           forward-filled, so from 2020-10 onward the adjusted price is effectively the nominal price
           during a genuine market upswing. The town&times;flat_type median baseline has no way to see
           that upswing, so it systematically underpredicts 2024-2026 and its R&sup2; goes negative.
           It's a real, explainable failure mode, not a bug.</p>
      </details>

      <details class="disclosure-block card">
        <summary>Global feature importance (mean absolute SHAP value, top 10)</summary>
        <p class="disclosure">Which attributes move the model's predictions the most, on average,
           across every flat &mdash; measured as the mean absolute SHAP value, i.e. the average
           number of dollars each attribute shifts an estimate by, in either direction.</p>
        <div style="overflow-x:auto;">
          <table>
            <thead><tr><th>Feature</th><th>Avg impact on price</th></tr></thead>
            <tbody>
              ${arena.shap_global_top10.map((s) => `<tr><td title="${s.feature}">${featureLabel(s.feature)}</td><td>S$${Math.round(s.mean_abs_shap).toLocaleString("en-SG")}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  `;

  // Same title/intro entrance as ST2-ST4 (XCH 2026-07-20).
  scrollFloat(root.querySelector(".station-inner > h2"));
  scrollFloat(root.querySelector(".station-inner > .lede"));

  const chart = window.echarts.init(document.getElementById("st6-chart"), "hdbrain-dark");
  const tabs = [...document.querySelectorAll("#st6-metric-tabs .metric-tab")];

  // "6根条从左向右竞速生长, XGBoost最先撞线" (README §8 S3 task 6) — real ranking,
  // not a scripted one: rank by actual test RMSE (lower = better), and give
  // the best-ranked model the shortest bar-growth duration so it visibly
  // finishes first. Only matters on the very first render (`race`); metric
  // switches afterward use ECharts' normal update transition.
  const rankByRmse = [...arena.models]
    .sort((a, b) => a.test.rmse - b.test.rmse)
    .reduce((acc, m, i) => ({ ...acc, [m.model]: i }), {});
  const raceDuration = (dataIndex) => {
    if (prefersReducedMotion()) return 0;
    const rank = rankByRmse[arena.models[dataIndex].model] ?? 0;
    return DURATION.slow * 1000 * (1 + rank * 0.18);
  };

  function renderChart(metric, { race = false } = {}) {
    chart.setOption({
      // The readable model names are longer than the raw keys were — force every
      // label to render (no auto-skipping) and tilt them so all six fit, with
      // extra bottom grid room for the tilt.
      grid: { bottom: 80 },
      xAxis: {
        type: "category",
        data: arena.models.map((m) => MODEL_LABELS[m.model] ?? m.model),
        axisLabel: { interval: 0, rotate: 20 },
      },
      yAxis: { type: "value", name: METRIC_AXIS[metric] },
      series: [
        { type: "bar", name: SPLIT_LABELS.train, data: arena.models.map((m) => m.train[metric]) },
        {
          type: "bar",
          name: SPLIT_LABELS.test,
          data: arena.models.map((m) => m.test[metric]),
          animationDuration: race ? raceDuration : undefined,
          animationEasing: "cubicOut",
        },
      ],
      tooltip: { trigger: "axis" },
      legend: {},
    });
  }
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.setAttribute("aria-pressed", "false"));
      tab.setAttribute("aria-pressed", "true");
      renderChart(tab.dataset.metric);
    });
  });

  // Don't render (and burn the race animation) until the station is actually
  // in view — ECharts animates once on first `setOption`, and that moment
  // needs to be "user just scrolled here", not "page just loaded".
  if (!window.IntersectionObserver || prefersReducedMotion()) {
    renderChart(METRICS[0]);
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          renderChart(METRICS[0], { race: true });
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(document.getElementById("st6-chart"));
  }

  emphasizeAblationRow(root);
}

/** README §8 S3 task 6: "消融实验瀑布(year那根0.27的柱子做强调动画)" — the
 * ablation experiment is still a plain table (S3 froze layout, no new chart),
 * so the "emphasis" is a highlight pulse on the year row when its <details>
 * opens, not a bar animation. */
function emphasizeAblationRow(root) {
  const gsap = getGsap();
  if (!gsap || prefersReducedMotion()) return;
  const details = [...root.querySelectorAll(".disclosure-block")].find((d) =>
    d.querySelector("summary")?.textContent.includes("ablation")
  );
  // Matched on the raw data key (data-ablation), not the displayed label text,
  // so renaming the visible label can't silently break the highlight.
  const yearRow = details?.querySelector('tbody tr[data-ablation="year"]');
  if (!details || !yearRow) return;

  let played = false;
  details.addEventListener("toggle", () => {
    if (!details.open || played) return;
    played = true;
    gsap.fromTo(
      yearRow,
      { backgroundColor: "rgba(255,107,107,0.35)" },
      { backgroundColor: "rgba(255,107,107,0)", duration: DURATION.slow, delay: 0.15 }
    );
  });
}
