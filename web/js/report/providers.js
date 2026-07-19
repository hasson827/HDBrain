/**
 * ReportProvider interface (README_XCH §7.9.5): generate(journeyState) -> markdown string.
 * TemplateProvider is the only implementation in S1 (deterministic, zero dependencies,
 * the permanent fallback for the static GitHub Pages deployment). OllamaProvider (local-LLM
 * enhancement with runtime detection + graceful fallback) is an S4 task — not implemented here.
 */

function fmtMoney(n) {
  if (n == null || !isFinite(n)) return "n/a";
  return `S$${Math.round(n).toLocaleString("en-SG")}`;
}

export class TemplateProvider {
  generate(journeyState) {
    const sections = [
      this.budgetSection(journeyState),
      this.townsSection(journeyState),
      this.valuationsSection(journeyState),
      this.leaseSection(journeyState),
      this.marketSection(journeyState),
      this.howToReadSection(),
    ];
    return sections.join("\n\n");
  }

  budgetSection(js) {
    const p = js.budgetProfile;
    if (!p) return "## 1. Your budget at a glance\n\nNo budget profile was entered yet.";
    return [
      "## 1. Your budget at a glance",
      "",
      `- Monthly household income: ${fmtMoney(p.monthlyIncome)}`,
      `- Loan type: ${p.loanType === "hdb" ? "HDB concessionary (2.6%)" : "Bank loan"}`,
      `- Downpayment: ${(p.downpaymentPct * 100).toFixed(0)}%`,
      `- MSR (Mortgage Servicing Ratio) limit: ${(p.msrLimit * 100).toFixed(0)}% of income / ` +
      `TDSR (Total Debt Servicing Ratio) limit: ${(p.tdsrLimit * 100).toFixed(0)}% of income`,
      p.cashSavings != null
        ? `- Cash savings: ${fmtMoney(p.cashSavings)} (upfront-budget constraint applied)`
        : "- Cash savings: not provided (upfront-budget constraint not applied)",
      `- **Maximum affordable price: ${fmtMoney(js.maxAffordablePrice)}**`,
    ].join("\n");
  }

  townsSection(js) {
    if (!js.townTiers) return "## 2. Towns within your reach\n\nRun the Budget Stop first to see this.";
    const byTier = { plenty: [], cosy: [], foothold: [], none: [] };
    for (const t of js.townTiers) byTier[t.tier].push(t.town);
    const line = (label, towns) => `- ${label}: ${towns.length ? towns.join(", ") : "none"}`;
    return [
      "## 2. Towns within your reach",
      "",
      line("Plenty of room (4-room and up)", byTier.plenty),
      line("Cosy options (up to 3-room)", byTier.cosy),
      line("A foothold (1-2 room)", byTier.foothold),
      line("Out of reach for now", byTier.none),
    ].join("\n");
  }

  valuationsSection(js) {
    if (!js.valuationsViewed.length) {
      return "## 3. Flats you valued\n\nYou did not value any specific flat this session.";
    }
    const rows = js.valuationsViewed.map((v) =>
      `- ${v.town}, ${v.flatType}, ${v.storeyRange}: ${fmtMoney(v.predictedPrice)} ` +
      `(90% interval ${fmtMoney(v.q05)} to ${fmtMoney(v.q95)})`
    );
    return [
      "## 3. Flats you valued",
      "",
      ...rows,
      "",
      "Note: the model is trained on data up to 2023 and recent (2025) transactions ran " +
      "9-16% above these estimates during the upside market. See section 6.",
    ].join("\n");
  }

  leaseSection(js) {
    const exp = js.leaseExperiment;
    if (!exp) return "## 4. The 99-year clock: lease notes\n\nYou did not run the lease experiment.";
    return [
      "## 4. The 99-year clock: lease notes",
      "",
      `You explored ${exp.town}, ${exp.flatType} at ${exp.remainingLease} years remaining lease.`,
      "Remember: bank loans and CPF usage face additional restrictions as remaining lease " +
      "falls below 60 and 30 years respectively.",
    ].join("\n");
  }

  marketSection(js) {
    const arena = js.arenaSnapshot;
    if (!arena) return "## 5. Market snapshot\n\nNo market data captured this session.";
    return [
      "## 5. Market snapshot",
      "",
      `Champion model: XGBoost — R² ${arena.test_r2?.toFixed(3) ?? "n/a"} on unseen 2024+ sales ` +
      `(share of price variation explained; 1 is perfect), with a median error of ` +
      `${arena.test_mape?.toFixed(1) ?? "n/a"}% of the actual price (median APE).`,
    ].join("\n");
  }

  howToReadSection() {
    return [
      "## 6. How to read this report",
      "",
      "- This is not a licensed valuation. It is a statistical estimate from historical resale transactions.",
      "- Training data ends in 2023; the 90% prediction interval has measured coverage well below 90% " +
      "on 2024-2026 data (see the Model Arena for exact figures) because of a CPI-adjustment limitation.",
      "- Comparable-flat icons are schematic silhouettes by flat type, not photos of the actual unit.",
      "- Report drafted by: rules-based template (no LLM used).",
    ].join("\n");
  }
}
