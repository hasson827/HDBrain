/**
 * Single source of truth for the 8-station config (README_XCH §7.11.1) and the
 * journeyState object the ST7 report reads from (§7.9.5). Both the top nav and
 * the eventual S2/S3 center track consume `stations` — do not fork a second copy.
 */

// trackAnchor values are S1 placeholders (evenly spaced); S2 replaces them with
// real coordinates once the center-track SVG geometry is drawn (§8 S1 note).
export const stations = [
  { id: "st0", hash: "#st0-departure", name: "ST0 · Departure · The Little Red Dot", accentColor: "#FF6B6B", trackAnchor: 0 },
  { id: "st1", hash: "#st1-questions", name: "ST1 · Three Questions", accentColor: "#FFD166", trackAnchor: 14 },
  { id: "st2", hash: "#st2-budget", name: "ST2 · Budget Stop · What can we afford?", accentColor: "#06D6A0", trackAnchor: 28 },
  { id: "st3", hash: "#st3-valuation", name: "ST3 · Valuation Stop · What is this flat worth?", accentColor: "#118AB2", trackAnchor: 42 },
  { id: "st4", hash: "#st4-lease", name: "ST4 · Time Stop · The 99-Year Clock", accentColor: "#FFD166", trackAnchor: 56 },
  { id: "st5", hash: "#st5-market", name: "ST5 · Lookout · Market Pulse", accentColor: "#06D6A0", trackAnchor: 70 },
  { id: "st6", hash: "#st6-arena", name: "ST6 · The Arena · Six models, one truth", accentColor: "#118AB2", trackAnchor: 84 },
  { id: "st7", hash: "#st7-home", name: "ST7 · Home", accentColor: "#FF6B6B", trackAnchor: 100 },
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
