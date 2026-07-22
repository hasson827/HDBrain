/**
 * ST2 Budget Stop (README_XCH §7.3 ST2 / §8 S2 tasks 4/6). S2 scope: glass form
 * card + "City of Lights" map replacing the S1 plain-text tier table, with a
 * click-through detail panel into ST3. Map ripple/window-lighting animation and
 * the pinned scrollytelling steps are S3 (§8 S3 task 5-6).
 */
import {
  forHdbLoan, forBankLoan, maxAffordablePrice,
  maxMonthlyPayment, maxLoanFromPayment, maxPriceFromUpfrontBudget, stampDuty,
} from "../engine/affordability.js";
import { computeTownAffordability, queryTownMeta } from "../engine/valuation.js";
import { loadLLMConfig, explainBudget } from "../report/providers.js";
import { recordBudget, requestTownFocus } from "../state.js";
import { renderMap, updateMapTiers, onMapTownSelect } from "../map.js";
import { scrollToTarget } from "../scroll.js";
import { revealOnce, popIn } from "../motion.js";
import { scrollFloat } from "../scroll-float.js";
import { applyGlassSurface } from "../glass-surface.js";

const TIER_LABELS = {
  plenty: "Plenty of room (4-room+)",
  cosy: "Cosy options (up to 3-room)",
  foothold: "A foothold (1-2 room)",
  none: "Out of reach for now",
};

// Row labels for the detail panel's price list — there each tier's number is
// "the cheapest estimated price for that flat-size band in this town", which
// the tier-status wording above doesn't say on its own.
const TIER_PRICE_LABELS = {
  plenty: "Cheapest 4-room or larger (est.)",
  cosy: "Cheapest 3-room (est.)",
  foothold: "Cheapest 1-2 room (est.)",
};

let latestTiers = [];

export async function initSt2() {
  const root = document.getElementById("st2-budget");
  if (!root) return;

  root.innerHTML = `
    <div class="station-inner st2-layout">
      <div class="st2-head">
        <h2>ST2 &middot; Budget Stop &middot; What can we afford?</h2>
        <p class="lede">Tell us your finances and we'll work out your maximum HDB budget
           under MSR/TDSR rules, then light up every town you can reach.</p>
      </div>

      <form id="st2-form">
        <div class="st2-modules">
          <div class="bento-card st2-mod-income">
            <p class="bento-card__label">Household income</p>
            <div class="bento-card__fields bento-card__fields--pair">
              <label>Monthly household income (SGD)
                <input type="number" name="monthlyIncome" value="8000" min="0" step="any" required />
              </label>
              <label>Existing monthly debts (SGD)
                <input type="number" name="existingDebtMonthly" value="0" min="0" step="any" />
              </label>
            </div>
          </div>

          <div class="bento-card st2-mod-savings">
            <p class="bento-card__label">Cash &amp; CPF</p>
            <div class="bento-card__fields bento-card__fields--pair">
              <label>Cash savings (SGD)
                <input type="number" name="cashSavings" value="60000" min="0" step="any" required />
              </label>
              <label>CPF Ordinary Account (OA) savings (SGD)
                <input type="number" name="cpfAvailable" value="0" min="0" step="any" />
              </label>
            </div>
          </div>

          <div class="bento-card st2-mod-loan">
            <p class="bento-card__label">Loan terms</p>
            <div class="bento-card__fields">
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
            </div>
          </div>
        </div>

        <p class="disclosure">MSR &mdash; Mortgage Servicing Ratio: home-loan instalments are capped
           at 30% of gross monthly income. TDSR &mdash; Total Debt Servicing Ratio: all monthly debt
           repayments combined are capped at 55%. Your budget takes the stricter of the two, and is
           further capped by the cash + CPF you can actually put down upfront (downpayment +
           Buyer's Stamp Duty).</p>

        <div class="st2-calc-row">
          <button type="submit">Calculate</button>
        </div>
      </form>

      <div id="st2-result" class="st2-result">
        <p class="lede">Enter your numbers to light up the map.</p>
      </div>

      <div class="st2-explore" data-detail-open="false">
        <div id="st2-map" class="card st2-map"></div>
        <aside id="st2-detail" class="st2-detail-panel glass-surface" aria-hidden="true"></aside>
      </div>
    </div>
  `;

  const mapEl = document.getElementById("st2-map");
  // Await the map's async render (it fetches the coastline GeoJSON before it
  // fills in ~630px of SVG). main.js awaits initSt2 before refreshNavTrack, so
  // the nav's section measuring and ScrollTrigger.refresh both run against the
  // settled height — otherwise every station below ST2 measured ~630px short,
  // which raced the train ahead and put ST4's pin at the wrong scroll position.
  await renderMap(mapEl);
  onMapTownSelect(showTownDetail);
  revealOnce(root.querySelector(".st2-modules"));
  revealOnce(mapEl, { delay: 0.08 });

  scrollFloat(root.querySelector(".st2-head h2"));
  scrollFloat(root.querySelector(".st2-head .lede"));
  // Frosted glass over the Buildings backdrop on the input bento cards and the
  // map (the detail panel carries the .glass-surface class directly in its
  // template instead).
  root.querySelectorAll(".bento-card").forEach((c) => applyGlassSurface(c));
  applyGlassSurface(mapEl);

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

    renderResult(maxPrice, tiers, profile);
    updateMapTiers(tiers);
  });
}

function renderResult(maxPrice, tiers, profile) {
  const result = document.getElementById("st2-result");
  const counts = tiers.reduce((acc, t) => {
    acc[t.tier] = (acc[t.tier] ?? 0) + 1;
    return acc;
  }, {});

  result.innerHTML = `
    <p class="eyebrow">Maximum affordable price</p>
    <p class="result-figure">S$${Math.round(maxPrice).toLocaleString("en-SG")}</p>
    <div class="tier-summary">
      <span><strong>${counts.plenty ?? 0}</strong> plenty (4-room+)</span>
      <span><strong>${counts.cosy ?? 0}</strong> cosy (3-room)</span>
      <span><strong>${counts.foothold ?? 0}</strong> foothold (1-2 room)</span>
      <span><strong>${counts.none ?? 0}</strong> out of reach</span>
      <span><strong>${tiers.length}</strong> towns checked</span>
    </div>
    <div class="llm-explain" hidden>
      <button type="button" class="btn-ghost btn-sm" id="st2-explain-btn">Explain my budget</button>
      <p class="llm-explain-text" hidden></p>
    </div>
  `;
  wireBudgetExplain(result, maxPrice, tiers, profile);
  popIn(result);
}

/** Same guarded-LLM contract as ST3/ST7 (§7.9.5), applied to the budget: the
 * affordability engine's own decomposition (MSR/TDSR caps, loan-implied price
 * ceiling, upfront-budget ceiling, binding constraint) doubles as the fact
 * sheet, so the LLM only phrases arithmetic the engine already did. Hidden
 * entirely when the LLM config doesn't resolve. */
function wireBudgetExplain(result, maxPrice, tiers, profile) {
  const container = result.querySelector(".llm-explain");
  const btn = result.querySelector("#st2-explain-btn");
  const out = result.querySelector(".llm-explain-text");

  loadLLMConfig().then((cfg) => {
    if (!cfg) return;
    container.hidden = false;

    const money = (n) => `S$${Math.round(n).toLocaleString("en-SG")}`;
    const pct = (x) => `${(x * 100).toFixed(0)}%`;
    const msrCap = profile.monthlyIncome * profile.msrLimit;
    const tdsrCap = profile.monthlyIncome * profile.tdsrLimit - profile.existingDebtMonthly;
    const maxMonthly = maxMonthlyPayment(profile);
    const maxLoan = maxLoanFromPayment(maxMonthly, profile.interestRate, profile.tenureYears);
    const priceCapLoan = maxLoan / (1 - profile.downpaymentPct);
    const upfrontBudget = profile.cashSavings + profile.cpfAvailable;
    const priceCapUpfront = maxPriceFromUpfrontBudget(upfrontBudget, profile.downpaymentPct);
    const bindingConstraint = priceCapUpfront < priceCapLoan ? "the upfront cash + CPF budget" : "the monthly repayment cap";
    const reachable = tiers.filter((t) => t.tier !== "none").length;

    const facts = [
      `Profile: monthly household income ${money(profile.monthlyIncome)}; existing monthly debts ${money(profile.existingDebtMonthly)}; ` +
      `${profile.loanType === "hdb" ? "HDB concessionary" : "bank"} loan at ${(profile.interestRate * 100).toFixed(1)}% interest over ` +
      `${profile.tenureYears} years; downpayment ${pct(profile.downpaymentPct)}; cash savings ${money(profile.cashSavings)} plus CPF (OA) ${money(profile.cpfAvailable)}.`,
      `Monthly repayment caps: MSR (${pct(profile.msrLimit)} of income) allows ${money(msrCap)} per month; ` +
      `TDSR (${pct(profile.tdsrLimit)} of income minus existing debts) allows ${money(tdsrCap)} per month; ` +
      `the stricter rule is ${msrCap <= tdsrCap ? "MSR" : "TDSR"}, so the cap is ${money(maxMonthly)} per month.`,
      `Loan maths: ${money(maxMonthly)} per month over ${profile.tenureYears} years at ${(profile.interestRate * 100).toFixed(1)}% supports a loan of ${money(maxLoan)}; ` +
      `with a ${pct(profile.downpaymentPct)} downpayment that implies a price ceiling of ${money(priceCapLoan)}.`,
      `Upfront budget: cash + CPF = ${money(upfrontBudget)} must cover the ${pct(profile.downpaymentPct)} downpayment plus Buyer's Stamp Duty (BSD); ` +
      `that caps the price at ${money(priceCapUpfront)} (BSD at that price is ${money(stampDuty(priceCapUpfront))}).`,
      `Final maximum affordable price: ${money(maxPrice)}; the binding constraint is ${bindingConstraint}.`,
      `Towns: ${reachable} of ${tiers.length} towns have at least one flat-size band within this budget.`,
    ].join("\n");

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Reading the rules…";
      try {
        const text = await explainBudget(cfg, facts);
        out.textContent = text;
        out.hidden = false;
        btn.hidden = true;
      } catch (err) {
        console.warn("Budget explainer failed:", err);
        out.textContent = `The explainer is unreachable right now. The short version: ${bindingConstraint} is what limits your budget here.`;
        out.hidden = false;
        btn.disabled = false;
        btn.textContent = "Try explaining again";
      }
    });
  });
}

// Town -> Wikipedia article title for the names where the bare town would hit
// the wrong article (Queenstown -> New Zealand, Clementi -> the composer,
// Bishan / Woodlands -> disambiguation pages) or a qualified title. These were
// verified against the live articles while sourcing the town photos (the
// redirect-resolved titles in static/img/towns/_manifest.json). Every other
// town is just its Title Case name.
const WIKI_TITLES = {
  "KALLANG/WHAMPOA": "Kallang",
  "CENTRAL AREA": "Central Area, Singapore",
  "BISHAN": "Bishan, Singapore",
  "CLEMENTI": "Clementi, Singapore",
  "QUEENSTOWN": "Queenstown, Singapore",
  "WOODLANDS": "Woodlands, Singapore",
};

function titleCase(town) {
  return town.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
function townSlug(town) {
  return town.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function townInitials(town) {
  return town.split(/[\s/]+/).map((w) => w[0]).join("").slice(0, 3);
}
function wikiUrl(town) {
  return `https://en.wikipedia.org/wiki/${(WIKI_TITLES[town] ?? titleCase(town)).replace(/ /g, "_")}`;
}
function gmapUrl(meta) {
  return `https://www.google.com/maps/search/?api=1&query=${meta.lat},${meta.lon}`;
}

function showTownDetail(town) {
  const panel = document.getElementById("st2-detail");
  const explore = panel.closest(".st2-explore");
  const meta = queryTownMeta(town);
  const entry = latestTiers.find((t) => t.town === town);

  const priceRows = entry
    ? Object.entries(entry.cheapestByTier)
        .filter(([, price]) => price != null)
        .map(([tier, price]) => `<div class="st2-detail-price"><span>${TIER_PRICE_LABELS[tier]}</span><strong>S$${Math.round(price).toLocaleString("en-SG")}</strong></div>`)
        .join("")
    : "";

  panel.innerHTML = `
    <button type="button" class="st2-detail-close" id="st2-detail-close" aria-label="Close ${titleCase(town)}">&times;</button>
    <figure class="st2-detail-media" data-region="${meta?.region ?? ""}">
      <span class="st2-detail-media-mark" aria-hidden="true">${townInitials(town)}</span>
      <img class="st2-detail-img" src="./static/img/towns/${townSlug(town)}.jpg" alt="${titleCase(town)}"
           loading="lazy"
           onerror="this.closest('.st2-detail-media').classList.add('is-missing'); this.remove();" />
    </figure>
    <div class="st2-detail-body">
      ${meta?.region ? `<p class="st2-detail-region">${meta.region} region</p>` : ""}
      <h3>${titleCase(town)}</h3>
      ${entry
        ? `<p class="st2-detail-tier tier-${entry.tier}">${TIER_LABELS[entry.tier]}</p>`
        : `<p class="st2-detail-hint">Enter your budget above to light up ${titleCase(town)}.</p>`}
      ${meta?.n_transactions != null ? `<p class="st2-detail-meta">${meta.n_transactions.toLocaleString("en-SG")} resale transactions on record</p>` : ""}
      ${priceRows ? `<div class="st2-detail-prices">${priceRows}</div>` : ""}
      <div class="st2-detail-links">
        <a class="btn-ghost btn-sm" href="${wikiUrl(town)}" target="_blank" rel="noopener noreferrer">Wikipedia &nearr;</a>
        ${meta ? `<a class="btn-ghost btn-sm" href="${gmapUrl(meta)}" target="_blank" rel="noopener noreferrer">Google Maps &nearr;</a>` : ""}
      </div>
      <button type="button" class="btn-primary btn-sm" id="st2-detail-jump">Value a flat here &rarr;</button>
    </div>
  `;

  if (explore) explore.dataset.detailOpen = "true";
  panel.setAttribute("aria-hidden", "false");

  document.getElementById("st2-detail-close").addEventListener("click", () => {
    if (explore) explore.dataset.detailOpen = "false";
    panel.setAttribute("aria-hidden", "true");
  });
  document.getElementById("st2-detail-jump").addEventListener("click", () => {
    requestTownFocus(town);
    scrollToTarget("#st3-valuation");
  });
}
