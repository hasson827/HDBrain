/**
 * ST5 Lookout / Market Pulse (README_XCH §7.3 ST5 / §8 S1 task 6). S1 scope: a
 * town selector, a default-theme ECharts line chart of the town's median-price
 * series, and a plain-text ranking table. No multi-line all-town chart with
 * hover dimming, no cross-station click-through — those are S2/S3.
 */
import { listTowns, queryTownIndex } from "../engine/valuation.js";

export function initSt5() {
  const root = document.getElementById("st5-market");
  if (!root) return;

  const towns = listTowns();

  root.innerHTML = `
    <h2>ST5 &middot; Lookout &middot; Market Pulse</h2>
    <label>Town
      <select id="st5-town">${towns.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
    </label>
    <div id="st5-chart" style="width: 100%; height: 360px;"></div>
    <p id="st5-chart-note"></p>
    <h3>Latest median price by town</h3>
    <table id="st5-ranking" border="1" cellpadding="4"></table>
    <p>Note: LIM CHU KANG is excluded from this list &mdash; it has no recorded resale
       transactions after 2015 in this dataset.</p>
  `;

  const chart = window.echarts.init(document.getElementById("st5-chart"));
  const townSelect = document.getElementById("st5-town");
  const chartNote = document.getElementById("st5-chart-note");

  function renderChart() {
    const series = queryTownIndex(townSelect.value);
    if (!series) {
      chart.clear();
      chartNote.textContent = `No price history available for ${townSelect.value} (no recorded resale transactions after 2015).`;
      return;
    }
    chartNote.textContent = "";
    chart.setOption({
      xAxis: { type: "category", data: series.months },
      yAxis: { type: "value", name: "Median real price (SGD)" },
      series: [{ type: "line", data: series.median_real_price, name: townSelect.value }],
      tooltip: { trigger: "axis" },
    });
  }
  townSelect.addEventListener("change", renderChart);
  renderChart();

  renderRanking(towns);
}

function renderRanking(towns) {
  const latest = towns
    .map((town) => {
      const series = queryTownIndex(town);
      if (!series || !series.median_real_price.length) return null;
      const idx = series.median_real_price.length - 1;
      return { town, latestMonth: series.months[idx], price: series.median_real_price[idx] };
    })
    .filter(Boolean)
    .sort((a, b) => b.price - a.price);

  const rows = latest
    .map((r) => `<tr><td>${r.town}</td><td>${r.latestMonth}</td><td>S$${Math.round(r.price).toLocaleString("en-SG")}</td></tr>`)
    .join("");
  document.getElementById("st5-ranking").innerHTML =
    `<thead><tr><th>Town</th><th>Latest month</th><th>Median price</th></tr></thead><tbody>${rows}</tbody>`;
}
