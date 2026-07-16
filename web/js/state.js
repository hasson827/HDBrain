/**
 * Single source of truth for the 8-station config (README_XCH §7.11) and the
 * journeyState object the ST7 report reads from (§7.9.5). The top nav consumes
 * `stations` — do not fork a second copy. (The central winding track that used
 * to also consume this config was removed 2026-07-17 per XCH's call — see
 * README_XCH §7.13 — so there is no `trackAnchor` field here anymore.)
 */
export const stations = [
  { id: "st0", hash: "#st0-departure", name: "ST0 · Departure · All Aboard", accentColor: "#FF6B6B" },
  { id: "st1", hash: "#st1-questions", name: "ST1 · Three Questions", accentColor: "#FFD166" },
  { id: "st2", hash: "#st2-budget", name: "ST2 · Budget Stop · What can we afford?", accentColor: "#06D6A0" },
  { id: "st3", hash: "#st3-valuation", name: "ST3 · Valuation Stop · What is this flat worth?", accentColor: "#118AB2" },
  { id: "st4", hash: "#st4-lease", name: "ST4 · Time Stop · The 99-Year Clock", accentColor: "#FFD166" },
  { id: "st5", hash: "#st5-market", name: "ST5 · Lookout · Market Pulse", accentColor: "#06D6A0" },
  { id: "st6", hash: "#st6-arena", name: "ST6 · The Arena · Six models, one truth", accentColor: "#118AB2" },
  { id: "st7", hash: "#st7-home", name: "ST7 · Home", accentColor: "#FF6B6B" },
];

/**
 * Journey state: each station silently writes what the user did here; ST7's
 * TemplateProvider reads it to assemble "Your HDBrain Report" (§7.9.5).
 */
export const journeyState = {
  budgetProfile: null,     // BuyerProfile-shaped object from ST2
  maxAffordablePrice: null,
  townTiers: null,         // computeTownAffordability() result from ST2
  valuationsViewed: [],    // list of queryValuation() results from ST3
  leaseExperiment: null,   // { town, flatType, remainingLease } from ST4
  arenaSnapshot: null,     // champion-model test metrics from ST6
  townsVisited: new Set(),
};

export function recordBudget(profile, maxAffordablePrice, townTiers) {
  journeyState.budgetProfile = profile;
  journeyState.maxAffordablePrice = maxAffordablePrice;
  journeyState.townTiers = townTiers;
}

export function recordValuation(result) {
  journeyState.valuationsViewed.push(result);
  journeyState.townsVisited.add(result.town);
}

export function recordLeaseExperiment(experiment) {
  journeyState.leaseExperiment = experiment;
}

export function recordArenaSnapshot(snapshot) {
  journeyState.arenaSnapshot = snapshot;
}

/**
 * Cross-station link (README_XCH §7.9.2 "click → ... 'Value a flat here' 按钮
 * 预填镇名跳 ST3"): the map's click-through doesn't reach into st3.js's module
 * scope directly, so it broadcasts a town choice and ST3 listens.
 */
export function requestTownFocus(town) {
  window.dispatchEvent(new CustomEvent("hdbrain:focus-town", { detail: { town } }));
}
