/**
 * ST2 Budget Stop (README_XCH §7.3 ST2 / §8 S1 task 6). S1 scope: form -> max
 * affordable price + a plain-text 27-town affordability table. No map, no
 * gauges, no colors — those are S2/S3.
 */
import { forHdbLoan, forBankLoan, maxAffordablePrice } from "../engine/affordability.js";
import { computeTownAffordability } from "../engine/valuation.js";
import { recordBudget } from "../state.js";

const TIER_LABELS = {
  plenty: "Plenty of room (4-room+)",
  cosy: "Cosy options (up to 3-room)",
  foothold: "A foothold (1-2 room)",
  none: "Out of reach for now",
};

export function initSt2() {
  const root = document.getElementById("st2-budget");
  if (!root) return;

  root.innerHTML = `
    <h2>ST2 &middot; Budget Stop &middot; What can we afford?</h2>
    <form id="st2-form">
      <label>Monthly household income (SGD)
        <input type="number" name="monthlyIncome" value="8000" min="0" required />
      </label>
      <label>Cash savings (SGD, required to check the upfront-budget constraint)
        <input type="number" name="cashSavings" value="60000" min="0" required />
      </label>
      <label>CPF (OA) available (SGD)
        <input type="number" name="cpfAvailable" value="0" min="0" />
      </label>
      <label>Existing monthly debts (SGD)
        <input type="number" name="existingDebtMonthly" value="0" min="0" />
      </label>
      <label>Loan type
        <select name="loanType">
          <option value="hdb">HDB concessionary (2.6%)</option>
          <option value="bank">Bank loan (3.5%)</option>
        </select>
      </label>
      <label>Downpayment %
        <input type="number" name="downpaymentPct" value="25" min="5" max="100" />
      </label>
      <label>Loan tenure (years)
        <input type="number" name="tenureYears" value="25" min="5" max="35" />
      </label>
      <button type="submit">Calculate</button>
    </form>
    <div id="st2-result"></div>
  `;

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
    recordBudget(profile, maxPrice, tiers);

    renderResult(maxPrice, tiers);
  });
}

function renderResult(maxPrice, tiers) {
  const result = document.getElementById("st2-result");
  const rows = tiers
    .map((t) => `<tr><td>${t.town}</td><td>${TIER_LABELS[t.tier]}</td></tr>`)
    .join("");
  const counts = tiers.reduce((acc, t) => {
    acc[t.tier] = (acc[t.tier] ?? 0) + 1;
    return acc;
  }, {});

  result.innerHTML = `
    <p><strong>Maximum affordable price: S$${Math.round(maxPrice).toLocaleString("en-SG")}</strong></p>
    <p>${tiers.length} towns checked &mdash;
       ${counts.plenty ?? 0} plenty, ${counts.cosy ?? 0} cosy, ${counts.foothold ?? 0} foothold,
       ${counts.none ?? 0} out of reach.</p>
    <table border="1" cellpadding="4">
      <thead><tr><th>Town</th><th>Affordability tier</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
