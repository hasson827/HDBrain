/**
 * ST4 Time Stop / The 99-Year Clock (README_XCH §7.3 ST4). Reworked per XCH
 * (2026-07-18): the scroll-hijacked scrub, the manual "remaining lease" slider,
 * and the left-hand house/sky scene + Skip button are all gone. The station is
 * now a single centred module — pick a town + flat type and read the whole
 * lease-decay curve by HOVERING it (ECharts axis tooltip). The title/intro sit
 * on their own above the module (ScrollFloat), and the module carries the
 * GlassSurface material over the Buildings backdrop.
 */
import { listTowns, listFlatTypes, queryLeaseCurve } from "../engine/valuation.js";
import { recordLeaseExperiment } from "../state.js";
import { scrollFloat } from "../scroll-float.js";
import { applyGlassSurface } from "../glass-surface.js";

export function initSt4() {
  const root = document.getElementById("st4-lease");
  if (!root) return;

  const towns = listTowns();
  const flatTypes = listFlatTypes();

  root.innerHTML = `
    <div class="station-inner st4-layout">
      <div class="st4-head">
        <h2>ST4 &middot; Time Stop &middot; The 99-Year Clock</h2>
        <p class="lede">Everything else held fixed, watch the estimate move as the lease clock
          runs down. Hover the curve to read the estimated price at any remaining-lease year.</p>
      </div>
      <div class="st4-panel">
        <div class="card st4-controls cluster">
          <label>Town
            <select id="st4-town">${towns.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
          </label>
          <label>Flat type
            <select id="st4-flat-type">${flatTypes.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
          </label>
        </div>
        <div class="card st4-chart-card">
          <div id="st4-chart" style="width: 100%; height: 380px;"></div>
          <p class="disclosure" id="st4-note"></p>
        </div>
      </div>
    </div>
  `;

  const chartEl = document.getElementById("st4-chart");
  const chart = window.echarts.init(chartEl, "hdbrain-dark");

  const townSelect = document.getElementById("st4-town");
  const flatTypeSelect = document.getElementById("st4-flat-type");
  const note = document.getElementById("st4-note");

  const HOVER_HINT = "Hover over the curve to read the estimated price at a given remaining lease.";

  // Current curve in closure so the hover handler (bound once, below) can read
  // the price at whatever lease the pointer is over.
  let current = null;

  function render() {
    const town = townSelect.value;
    const flatType = flatTypeSelect.value;

    const curve = queryLeaseCurve({ town, flatType });
    if (!curve) {
      chart.clear();
      current = null;
      note.textContent = "No lease curve for this combination.";
      return;
    }

    const leases = curve.remaining_lease;
    const prices = curve.predicted_price;
    current = { town, flatType, leases, prices };

    chart.setOption({
      grid: { top: 60, left: 70, right: 30, bottom: 70 },
      xAxis: {
        type: "category", data: leases, inverse: true,
        name: "Remaining lease (years)", nameLocation: "middle", nameGap: 32,
      },
      yAxis: {
        type: "value", name: "Estimated price (S$)",
        nameLocation: "middle", nameGap: 55,
      },
      // The dashed bounds are the model's q05/q95 quantiles — named in plain
      // words here since the legend/tooltip is user-facing.
      series: [
        { type: "line", data: prices, name: "Estimated price" },
        { type: "line", data: curve.q05, name: "Lower bound (5th pct)", lineStyle: { type: "dashed" } },
        { type: "line", data: curve.q95, name: "Upper bound (95th pct)", lineStyle: { type: "dashed" } },
      ],
      tooltip: { trigger: "axis" },
      legend: {},
    }, true);

    note.textContent = HOVER_HINT;
    // Record a reference lease (the freshest year on the curve) so the ST7
    // report has a value even before the user hovers; hovering updates it.
    const refLease = Math.max(...leases);
    recordLeaseExperiment({ town, flatType, remainingLease: refLease });
  }

  // Hover readout: the pointer's lease year becomes the "explored" lease — the
  // hover-only replacement for the old slider. Bound once; reads `current`.
  chart.on("updateAxisPointer", (event) => {
    if (!current) return;
    const info = (event.axesInfo || []).find((a) => a.axisDim === "x");
    if (!info) return;
    const idx = info.value;
    const lease = current.leases[idx];
    const price = current.prices[idx];
    if (lease == null || price == null) return;
    note.textContent = `At ${lease} years remaining: S$${Math.round(price).toLocaleString("en-SG")}.`;
    recordLeaseExperiment({ town: current.town, flatType: current.flatType, remainingLease: lease });
  });

  townSelect.addEventListener("change", render);
  flatTypeSelect.addEventListener("change", render);
  render();

  scrollFloat(root.querySelector(".st4-head h2"));
  scrollFloat(root.querySelector(".st4-head .lede"));
  applyGlassSurface(root.querySelector(".st4-controls"));
  applyGlassSurface(root.querySelector(".st4-chart-card"));
}
