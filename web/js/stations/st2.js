/**
 * ST2 Budget Stop (README_XCH §7.3 ST2 / §8 S2 tasks 4/6). S2 scope: glass form
 * card + "City of Lights" map replacing the S1 plain-text tier table, with a
 * click-through detail panel into ST3. Map ripple/window-lighting animation and
 * the pinned scrollytelling steps are S3 (§8 S3 task 5-6).
 */
import { forHdbLoan, forBankLoan, maxAffordablePrice } from "../engine/affordability.js";
import { computeTownAffordability } from "../engine/valuation.js";
import { recordBudget, requestTownFocus } from "../state.js";
import { renderMap, updateMapTiers, onMapTownSelect } from "../map.js";

const TIER_LABELS = {
  plenty: "Plenty of room (4-room+)",
  cosy: "Cosy options (up to 3-room)",
  foothold: "A foothold (1-2 room)",
  none: "Out of reach for now",
};

let latestTiers = [];

export function initSt2() {
  const root = document.getElementById("st2-budget");
  if (!root) return;

  root.innerHTML = `
    <div class="station-inner st2-layout">
      <div class="card glass st2-form-card">
        <h2>ST2 &middot; Budget Stop &middot; What can we afford?</h2>
        <form id="st2-form">
          <label>Monthly household income (SGD)
            <input type="number" name="monthlyIncome" value="8000" min="0" step="any" required />
          </label>
          <label>Cash savings (SGD, required to check the upfront-budget constraint)
            <input type="number" name="cashSavings" value="60000" min="0" step="any" required />
          </label>
          <label>CPF (OA) available (SGD)
            <input type="number" name="cpfAvailable" value="0" min="0" step="any" />
          </label>
          <label>Existing monthly debts (SGD)
            <input type="number" name="existingDebtMonthly" value="0" min="0" step="any" />
          </label>
          <label>Loan type
            <select name="loanType">
              <option value="hdb">HDB concessionary (2.6%)</option>
              <option value="bank">Bank loan (3.5%)</option>
            </select>
          </label>
          <label>Downpayment %
            <input type="number" name="downpaymentPct" value="25" min="5" max="100" step="any" />
          </label>
          <label>Loan tenure (years)
            <input type="number" name="tenureYears" value="25" min="5" max="35" step="any" />
          </label>
          <button type="submit">Calculate</button>
        </form>
      </div>

      <div class="stack">
        <div id="st2-result">
          <p class="lede">Enter your numbers to light up the map.</p>
        </div>
        <div id="st2-map" class="card"></div>
        <div id="st2-detail" class="card glass" hidden></div>
      </div>
    </div>
  `;

  const mapEl = document.getElementById("st2-map");
  renderMap(mapEl);
  onMapTownSelect(showTownDetail);

  const form = document.getElementById("st2-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const overrides = {
      monthlyIncome: Number(fd.get("monthlyIncome")),
      cashSavings: Number(fd.get("cashSavings")),
      cpfAvailable: Number(fd.get("cpfAvailable")),
      existingDebtMonthly: Number(fd.get("existingDebtMonthly")),
      downpaymentPct: Number(fd.get("downpaymentPct")) / 100,
      tenureYears: Number(fd.get("tenureYears")),
    };
    const loanType = fd.get("loanType");
    const profile = loanType === "hdb" ? forHdbLoan(overrides.monthlyIncome, overrides) : forBankLoan(overrides.monthlyIncome, overrides);

    const maxPrice = maxAffordablePrice(profile);
    const tiers = computeTownAffordability(maxPrice);
    latestTiers = tiers;
    recordBudget(profile, maxPrice, tiers);

    renderResult(maxPrice, tiers);
    updateMapTiers(tiers);
  });
}

function renderResult(maxPrice, tiers) {
  const result = document.getElementById("st2-result");
  const counts = tiers.reduce((acc, t) => {
    acc[t.tier] = (acc[t.tier] ?? 0) + 1;
    return acc;
  }, {});

  result.innerHTML = `
    <p class="eyebrow">Maximum affordable price</p>
    <p class="result-figure">S$${Math.round(maxPrice).toLocaleString("en-SG")}</p>
    <div class="tier-summary">
      <span><strong>${counts.plenty ?? 0}</strong> plenty</span>
      <span><strong>${counts.cosy ?? 0}</strong> cosy</span>
      <span><strong>${counts.foothold ?? 0}</strong> foothold</span>
      <span><strong>${counts.none ?? 0}</strong> out of reach</span>
      <span>&mdash; ${tiers.length} towns checked</span>
    </div>
  `;
}

function showTownDetail(town) {
  const panel = document.getElementById("st2-detail");
  const entry = latestTiers.find((t) => t.town === town);
  panel.hidden = false;

  const rows = entry
    ? Object.entries(entry.cheapestByTier)
        .map(([tier, price]) => `<tr><td>${TIER_LABELS[tier]}</td><td>${price != null ? `S$${Math.round(price).toLocaleString("en-SG")}` : "&mdash;"}</td></tr>`)
        .join("")
    : "";

  panel.innerHTML = `
    <h3>${town}</h3>
    ${entry ? `<p>${TIER_LABELS[entry.tier]}</p><table><tbody>${rows}</tbody></table>` : `<p>Enter your budget above to see how ${town} lights up.</p>`}
    <button type="button" class="btn-ghost btn-sm" id="st2-detail-jump">Value a flat here &rarr;</button>
  `;
  document.getElementById("st2-detail-jump").addEventListener("click", () => {
    requestTownFocus(town);
    document.querySelector("#st3-valuation")?.scrollIntoView({ behavior: "smooth" });
  });
}
