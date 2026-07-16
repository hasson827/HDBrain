/**
 * ST6 The Arena / Model Comparison (README_XCH §7.3 ST6 / §8 S1 task 6). S1
 * scope: a default-theme ECharts bar chart with a metric picker, plus plain
 * tables for the ablation experiment and global SHAP importance. No racing
 * animation, no flip card — those are S3.
 */
import { getArena } from "../engine/valuation.js";
import { recordArenaSnapshot } from "../state.js";

const METRICS = ["rmse", "mae", "r2", "mape"];

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
          ${METRICS.map((m, i) => `<button type="button" class="metric-tab" data-metric="${m}" aria-pressed="${i === 0}">${m.toUpperCase()}</button>`).join("")}
        </div>
        <div id="st6-chart" style="width: 100%; height: 380px;"></div>
      </div>

      <details class="disclosure-block card">
        <summary>Quantile interval coverage (90% target)</summary>
        <p class="disclosure">How often the 90% prediction interval actually contains the real price, by split.</p>
        <div style="overflow-x:auto;">
          <table>
            <thead><tr><th>Split</th><th>Coverage</th><th>Avg width</th><th>Median width</th></tr></thead>
            <tbody>
              ${arena.quantile_metrics.map((q) => `<tr><td>${q.split}</td><td>${(q.coverage_90 * 100).toFixed(1)}%</td><td>S$${Math.round(q.avg_width).toLocaleString("en-SG")}</td><td>S$${Math.round(q.median_width).toLocaleString("en-SG")}</td></tr>`).join("")}
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
              ${arena.ablation.map((a) => `<tr><td>${a.ablation}</td><td>S$${Math.round(a.test_rmse).toLocaleString("en-SG")}</td><td>${Math.round(a.rmse_drop).toLocaleString("en-SG")}</td><td>${a.r2_drop.toFixed(4)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </details>

      <details class="disclosure-block card">
        <summary>Why is the Baseline's R&sup2; negative?</summary>
        <p>The CPI file used to inflation-adjust prices ends in 2020-09; months after that are
           forward-filled, so from 2020-10 onward the adjusted price is effectively the nominal price
           during a genuine market upswing. The town&times;flat_type median baseline has no way to see
           that upswing, so it systematically underpredicts 2024-2026 and its R&sup2; goes negative.
           It's a real, explainable failure mode, not a bug.</p>
      </details>

      <details class="disclosure-block card">
        <summary>Global feature importance (mean absolute SHAP value, top 10)</summary>
        <p class="disclosure">Which features move the model's predictions the most, on average, across every flat.</p>
        <div style="overflow-x:auto;">
          <table>
            <thead><tr><th>Feature</th><th>Mean |SHAP|</th></tr></thead>
            <tbody>
              ${arena.shap_global_top10.map((s) => `<tr><td>${s.feature}</td><td>S$${Math.round(s.mean_abs_shap).toLocaleString("en-SG")}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  `;

  const chart = window.echarts.init(document.getElementById("st6-chart"), "hdbrain-dark");
  const tabs = [...document.querySelectorAll("#st6-metric-tabs .metric-tab")];

  function renderChart(metric) {
    chart.setOption({
      xAxis: { type: "category", data: arena.models.map((m) => m.model) },
      yAxis: { type: "value", name: metric.toUpperCase() },
      series: [
        { type: "bar", name: "train", data: arena.models.map((m) => m.train[metric]) },
        { type: "bar", name: "test", data: arena.models.map((m) => m.test[metric]) },
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
  renderChart(METRICS[0]);
}
