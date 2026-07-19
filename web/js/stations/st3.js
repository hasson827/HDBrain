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
import { featureLabel } from "../feature-labels.js";
import { highlightTown } from "../map.js";
import { scrollToTarget } from "../scroll.js";
import { getGsap, DURATION, EASE, STAGGER, prefersReducedMotion, revealOnce, popIn } from "../motion.js";
import { scrollFloat } from "../scroll-float.js";
import { applyGlassSurface } from "../glass-surface.js";

export function initSt3() {
  const root = document.getElementById("st3-valuation");
  if (!root) return;

  const towns = listTowns();
  const flatTypes = listFlatTypes();

  // Reworked per XCH (2026-07-18): title/intro separated onto their own head
  // (like ST2), and the form redesigned — Town on its own row (its option text
  // can be long), the four remaining inputs in a 2x2 grid at matching heights,
  // then Value. The form starts centred (no result column). On submit the
  // `data-valued` flag flips: the body grid animates the form to the left and
  // the result column widens in on the right (grid-template-columns transition,
  // same technique as ST2's explore panel).
  root.innerHTML = `
    <div class="station-inner st3-layout" data-valued="false">
      <div class="st3-head">
        <h2>ST3 &middot; Valuation Stop &middot; What is this flat worth?</h2>
        <p class="disclosure">Estimates are based on training data up to 2023; recent (2025) resale
          prices ran 9&ndash;16% above these estimates during the upside market (see the Model Arena
          for details).</p>
      </div>
      <div class="st3-body">
        <div class="card st3-form-card">
          <form id="st3-form" class="st3-form">
            <label class="st3-field-town">Town
              <select name="town">${towns.map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
            </label>
            <div class="st3-field-grid">
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
            </div>
            <button type="submit" class="st3-value-btn">Value this flat</button>
          </form>
        </div>
        <div class="stack st3-result-col">
          <div id="st3-result" class="card"><p class="lede">Fill in the form to value a flat.</p></div>
          <div id="st3-comparables"></div>
        </div>
      </div>
    </div>
  `;

  const layout = root.querySelector(".st3-layout");
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

  revealOnce(root.querySelector(".st3-form-card"));

  scrollFloat(root.querySelector(".st3-head h2"));
  scrollFloat(root.querySelector(".st3-head .disclosure"));
  applyGlassSurface(root.querySelector(".st3-form-card"));
  applyGlassSurface(document.getElementById("st3-result"));

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
    // Flip the layout from centred-form to form-left / result-right (CSS
    // animates the grid columns). Idempotent — re-valuing just re-renders.
    layout.dataset.valued = "true";
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
      // Friendly label for display; the raw column name stays in `title` so the
      // full/original wording survives the CSS ellipsis on narrow columns.
      const label = featureLabel(f.feature);
      return `
        <li class="shap-row">
          <span class="shap-label" title="${label} (${f.feature})">${label}</span>
          <span class="shap-bar-track"><span class="shap-bar ${isPositive ? "is-positive" : "is-negative"}" data-width="${width}"></span></span>
          <span class="shap-value ${isPositive ? "is-positive" : "is-negative"}">${isPositive ? "+" : "&minus;"}S$${Math.round(Math.abs(f.value_sgd)).toLocaleString("en-SG")}</span>
        </li>`;
    })
    .join("");

  const panel = document.getElementById("st3-result");
  panel.innerHTML = `
    <p class="eyebrow">Estimated price</p>
    <p class="result-figure">S$${predictedPrice.toLocaleString("en-SG")}</p>
    <div class="interval-bar">
      <div class="interval-track"><span class="interval-point" data-left="${pct}"></span></div>
      <div class="interval-labels">
        <span>S$${q05.toLocaleString("en-SG")}</span>
        <span class="interval-labels-mid">90% interval</span>
        <span>S$${q95.toLocaleString("en-SG")}</span>
      </div>
    </div>
    <h3>What moved this estimate</h3>
    <ul class="shap-bars">${shapRows || "<li>No SHAP data for this combination.</li>"}</ul>
    <p class="disclosure">The 90% interval is the range where the model expects 9 in 10 similar
       flats to sell. The bars above (SHAP values &mdash; a standard way of attributing a
       prediction to its inputs) show how much each attribute pushed this estimate up (green)
       or down (red) versus the market-wide average.</p>
  `;
  animateResult(panel);
}

/** README §8 S3 task 6: the interval "bracket" resolves into place (the point
 * slides in from center rather than appearing pre-positioned) and SHAP bars
 * fly in one by one. Falls back to setting the final CSS values directly
 * when GSAP/reduced-motion means no animation is going to run. */
function animateResult(panel) {
  const point = panel.querySelector(".interval-point");
  const bars = [...panel.querySelectorAll(".shap-bar")];
  const gsap = getGsap();

  // Bars animate via scaleX (a transform), not width — their final width is
  // set directly from data-width and never touched again, only the scale is
  // tweened, so this stays off the layout-thrashing width/left path.
  bars.forEach((b) => (b.style.width = `${b.dataset.width}%`));

  if (!gsap || prefersReducedMotion()) {
    if (point) point.style.left = `${point.dataset.left}%`;
    popIn(panel);
    return;
  }

  if (point) {
    gsap.fromTo(point, { left: "50%", opacity: 0 }, { left: `${point.dataset.left}%`, opacity: 1, duration: DURATION.base, ease: EASE });
  }
  gsap.fromTo(
    bars,
    { scaleX: 0, transformOrigin: "left center" },
    { scaleX: 1, duration: DURATION.base, ease: EASE, stagger: STAGGER }
  );
  popIn(panel);
}

function renderComparables(town, comparables) {
  const container = document.getElementById("st3-comparables");
  const cards = comparables
    .slice(0, 20)
    .map(
      (c) => `
      <div class="comp-card card glass-surface">
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
    scrollToTarget("#st2-budget");
  });

  const gsap = getGsap();
  if (gsap && !prefersReducedMotion()) {
    const cardEls = [...container.querySelectorAll(".comp-card")];
    gsap.fromTo(
      cardEls,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: DURATION.base, ease: EASE, stagger: STAGGER }
    );
  }
}
