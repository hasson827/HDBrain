/**
 * ST4 Time Stop / Lease Decay Lab (README_XCH §7.3 ST4 / §8 S1 task 6). S1 scope:
 * a plain <input type="range"> and a default-theme ECharts line chart. No scroll
 * hijack, no scrub, no fading visuals — those are S3.
 */
import { listTowns, listFlatTypes, queryLeaseCurve } from "../engine/valuation.js";
import { recordLeaseExperiment } from "../state.js";

export function initSt4() {
  const root = document.getElementById("st4-lease");
  if (!root) return;

  const towns = listTowns();
  const flatTypes = listFlatTypes();

  root.innerHTML = `
    <h2>ST4 &middot; Time Stop &middot; The 99-Year Clock</h2>
    <label>Town
      <select id="st4-town">${towns.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
    </label>
    <label>Flat type
      <select id="st4-flat-type">${flatTypes.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
    </label>
    <label>Remaining lease: <span id="st4-lease-value">70</span> years
      <input type="range" id="st4-lease-slider" min="30" max="99" value="70" />
    </label>
    <div id="st4-chart" style="width: 100%; height: 360px;"></div>
    <p id="st4-note"></p>
  `;

  const chartEl = document.getElementById("st4-chart");
  const chart = window.echarts.init(chartEl);

  const townSelect = document.getElementById("st4-town");
  const flatTypeSelect = document.getElementById("st4-flat-type");
  const slider = document.getElementById("st4-lease-slider");
  const valueLabel = document.getElementById("st4-lease-value");
  const note = document.getElementById("st4-note");

  function render() {
    const town = townSelect.value;
    const flatType = flatTypeSelect.value;
    const lease = Number(slider.value);
    valueLabel.textContent = lease;

    const curve = queryLeaseCurve({ town, flatType });
    if (!curve) {
      chart.clear();
      note.textContent = "No lease curve for this combination.";
      return;
    }

    const leases = curve.remaining_lease;
    const prices = curve.predicted_price;
    const idx = leases.indexOf(lease);

    // A vertical markLine at the slider's current position is the whole point of this
    // chart ("watch the curve as you drag time") — without it, dragging the slider only
    // changes the text below, and the chart itself looks frozen (real bug found during
    // S1 manual testing: the chart's own series data never depended on `lease` at all).
    chart.setOption({
      xAxis: { type: "category", data: leases, name: "Remaining lease (years)", inverse: true },
      yAxis: { type: "value", name: "Predicted price (SGD)" },
      series: [
        {
          type: "line", data: prices, name: "Predicted price",
          markLine: idx >= 0 ? {
            symbol: "none",
            silent: true,
            label: { formatter: () => `${lease}y` },
            lineStyle: { color: "#666" },
            data: [{ xAxis: idx }],
          } : undefined,
        },
        { type: "line", data: curve.q05, name: "q05", lineStyle: { type: "dashed" } },
        { type: "line", data: curve.q95, name: "q95", lineStyle: { type: "dashed" } },
      ],
      tooltip: { trigger: "axis" },
      legend: {},
    });

    const priceAt = idx >= 0 ? prices[idx] : null;
    note.textContent = priceAt != null
      ? `At ${lease} years remaining: S$${Math.round(priceAt).toLocaleString("en-SG")}.`
      : "";

    recordLeaseExperiment({ town, flatType, remainingLease: lease });
  }

  townSelect.addEventListener("change", render);
  flatTypeSelect.addEventListener("change", render);
  slider.addEventListener("input", render);
  render();
}
