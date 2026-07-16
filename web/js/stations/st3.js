/**
 * ST3 Valuation Stop (README_XCH §7.3 ST3 / §8 S2 tasks 4/6a). S2 scope: glass
 * form + result card, a CSS interval "bracket" replacing the plain text range,
 * static SHAP bars, and a comparables card flow using the 6 flat-model icons
 * (§7.12) instead of a text table. The blueprint SVG that redraws on every
 * form change, and the animated SHAP fly-in, are S3 (§8 S3 task 6).
 */
import { listTowns, listFlatTypes, listStoreyOptions, queryValuation, queryShapTop6, queryComparables, queryGridBase } from "../engine/valuation.js";
import { recordValuation } from "../state.js";
import { flatIconSvg } from "../flat-icons.js";
import { highlightTown } from "../map.js";

export function initSt3() {
  const root = document.getElementById("st3-valuation");
  if (!root) return;

  const towns = listTowns();
  const flatTypes = listFlatTypes();

  root.innerHTML = `
    <div class="station-inner st3-layout">
      <div class="card glass st3-form-card">
        <h2>ST3 &middot; Valuation Stop &middot; What is this flat worth?</h2>
        <p class="disclosure">Estimates are based on training data up to 2023; recent (2025) resale
          prices ran 9&ndash;16% above these estimates during the upside market (see the Model Arena
          for details).</p>
        <form id="st3-form">
          <label>Town
            <select name="town">${towns.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
          </label>
          <label>Flat type
            <select name="flatType">${flatTypes.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
          </label>
          <label>Storey range
            <select name="storeyRangeCode"></select>
          </label>
          <label>Floor area (sqm)
            <input type="number" name="floorAreaSqm" min="20" max="300" step="any" required />
          </label>
          <label>Remaining lease (years)
            <input type="number" name="remainingLease" min="30" max="99" step="any" required />
          </label>
          <button type="submit">Value this flat</button>
        </form>
      </div>
      <div class="stack">
        <div id="st3-result" class="card"><p class="lede">Fill in the form to value a flat.</p></div>
        <div id="st3-comparables"></div>
      </div>
    </div>
  `;

  const form = document.getElementById("st3-form");
  const townSelect = form.querySelector('[name="town"]');
  const flatTypeSelect = form.querySelector('[name="flatType"]');
  const storeySelect = form.querySelector('[name="storeyRangeCode"]');
  const floorAreaInput = form.querySelector('[name="floorAreaSqm"]');
  const remainingLeaseInput = form.querySelector('[name="remainingLease"]');

  function refreshBaseDefaults() {
    const base = queryGridBase({
      town: townSelect.value, flatType: flatTypeSelect.value,
      storeyRangeCode: Number(storeySelect.value),
    });
    if (base) {
      floorAreaInput.value = base.floor_area_sqm;
      remainingLeaseInput.value = Math.round(base.remaining_lease);
    }
  }

  function refreshStoreyOptions() {
    const options = listStoreyOptions(townSelect.value, flatTypeSelect.value);
    storeySelect.innerHTML = options.map((o) => `<option value="${o.code}">${o.label}</option>`).join("");
    refreshBaseDefaults();
  }
  townSelect.addEventListener("change", refreshStoreyOptions);
  flatTypeSelect.addEventListener("change", refreshStoreyOptions);
  storeySelect.addEventListener("change", refreshBaseDefaults);
  refreshStoreyOptions();

  // Cross-station link from ST2's map click-through (§7.9.2 "预填镇名跳 ST3").
  window.addEventListener("hdbrain:focus-town", (e) => {
    townSelect.value = e.detail.town;
    refreshStoreyOptions();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const query = {
      town: fd.get("town"),
      flatType: fd.get("flatType"),
      storeyRangeCode: Number(fd.get("storeyRangeCode")),
      floorAreaSqm: Number(fd.get("floorAreaSqm")),
      remainingLease: Number(fd.get("remainingLease")),
    };
    const result = queryValuation(query);
    if (!result) {
      document.getElementById("st3-result").innerHTML = "<p>No grid data for this combination.</p>";
      return;
    }
    recordValuation(result);
    const shapTop6 = queryShapTop6(query);
    const comparables = queryComparables(query);
    renderResult(result, shapTop6);
    renderComparables(query.town, comparables);
  });
}

function renderResult(result, shapTop6) {
  const { predictedPrice, q05, q95 } = result;
  const pct = q95 > q05 ? ((predictedPrice - q05) / (q95 - q05)) * 100 : 50;
  const maxAbs = Math.max(...shapTop6.map((f) => Math.abs(f.value_sgd)), 1);

  const shapRows = shapTop6
    .map((f) => {
      const isPositive = f.value_sgd >= 0;
      const width = (Math.abs(f.value_sgd) / maxAbs) * 100;
      return `
        <li class="shap-row">
          <span class="shap-label">${f.feature}</span>
          <span class="shap-bar-track"><span class="shap-bar ${isPositive ? "is-positive" : "is-negative"}" style="width:${width}%"></span></span>
          <span class="shap-value ${isPositive ? "is-positive" : "is-negative"}">${isPositive ? "+" : "&minus;"}S$${Math.round(Math.abs(f.value_sgd)).toLocaleString("en-SG")}</span>
        </li>`;
    })
    .join("");

  document.getElementById("st3-result").innerHTML = `
    <p class="eyebrow">Estimated price</p>
    <p class="result-figure">S$${predictedPrice.toLocaleString("en-SG")}</p>
    <div class="interval-bar">
      <div class="interval-track"><span class="interval-point" style="left:${pct}%"></span></div>
      <div class="interval-labels">
        <span>S$${q05.toLocaleString("en-SG")}</span>
        <span class="interval-labels-mid">90% interval</span>
        <span>S$${q95.toLocaleString("en-SG")}</span>
      </div>
    </div>
    <h3>Top 6 contributing features (SHAP)</h3>
    <ul class="shap-bars">${shapRows || "<li>No SHAP data for this combination.</li>"}</ul>
  `;
}

function renderComparables(town, comparables) {
  const container = document.getElementById("st3-comparables");
  const cards = comparables
    .slice(0, 20)
    .map(
      (c) => `
      <div class="comp-card card">
        ${flatIconSvg(c.flat_model_group, "comp-icon")}
        <div>
          <p class="comp-price">S$${Math.round(c.resale_price).toLocaleString("en-SG")}</p>
          <p class="comp-meta">${c.storey_range} &middot; ${c.floor_area_sqm} sqm &middot; ${c.remaining_lease}y lease left</p>
          <p class="comp-meta">${c.month}</p>
        </div>
      </div>`
    )
    .join("");

  container.innerHTML = `
    <div class="cluster comp-header">
      <h3>Kopi talk: what nearby flats really sold for</h3>
      <button type="button" class="btn-ghost btn-sm" id="st3-view-on-map">View on map &rarr;</button>
    </div>
    <p class="disclosure">Icons are schematic representations by flat model, not photos of the actual unit.</p>
    <div class="comp-cards">${cards || '<p>No comparable transactions in the last 12 months for this group.</p>'}</div>
  `;

  document.getElementById("st3-view-on-map")?.addEventListener("click", () => {
    highlightTown(town);
    document.querySelector("#st2-budget")?.scrollIntoView({ behavior: "smooth" });
  });
}
