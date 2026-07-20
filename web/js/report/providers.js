/**
 * ReportProvider interface (README_XCH §7.9.5): generate(journeyState) -> markdown string.
 * Two implementations:
 *  - TemplateProvider: deterministic, zero dependencies, the permanent fallback and the
 *    only provider on static deployments (GitHub Pages) where no API key is present.
 *  - LLMProvider: cloud LLM via OpenRouter (replaces the originally planned OllamaProvider —
 *    same provider architecture, different transport). Enabled only when the gitignored
 *    llm-config.js exists (see loadLLMConfig below); async, throws on any failure so the
 *    caller can fall back to TemplateProvider.
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

/** Runtime detection (§7.9.5 "运行时探测"): the key file is gitignored, so on a clean
 * checkout / static deployment the dynamic import 404s and we return null → template path.
 * The browser logs that 404 in the console; that is expected, not a bug. Cached so the
 * ST3 explainer and ST7 report share one probe instead of re-importing per click. */
let llmConfigProbe = null;
export function loadLLMConfig() {
  llmConfigProbe ??= import("./llm-config.js")
    .then((mod) => {
      const cfg = mod.LLM_CONFIG;
      return cfg?.apiKey && !cfg.apiKey.includes("REPLACE_ME") ? cfg : null;
    })
    .catch(() => null);
  return llmConfigProbe;
}

/** Shared OpenRouter call: 60s timeout, fence-unwrapping, throws on any failure. */
async function chatComplete(config, systemPrompt, userContent) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  let res;
  try {
    res = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 4000,
        temperature: 0.4,
        reasoning: { effort: "low" },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  return text.replace(/^\s*```(?:markdown)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

/** Figure integrity: every S$ amount in the LLM text must exist verbatim in the
 * fact sheet. Catches both hallucinated numbers and the corrupted tokens the
 * free endpoint sometimes injects mid-figure. */
function assertFigures(facts, text) {
  // Must end on a digit — [\d,]+ alone would swallow a sentence comma right
  // after the amount ("S$120,000," ≠ "S$120,000") and false-reject good drafts.
  const moneyRe = /S\$[\d,]*\d/g;
  const allowed = new Set(facts.match(moneyRe) ?? []);
  for (const amount of text.match(moneyRe) ?? []) {
    if (!allowed.has(amount)) throw new Error(`LLM output contains a figure not in the fact sheet: ${amount}`);
  }
}

const SYSTEM_PROMPT = [
  "You are the report writer for HDBrain, a Singapore HDB resale flat advisor built as an NUS course project.",
  "You will receive a rules-based fact sheet in markdown summarising one user's session.",
  "Rewrite it into a warm, professional, personalised advisory report addressed to the reader as \"you\".",
  "",
  "Hard rules:",
  "- Use ONLY facts and numbers from the fact sheet. Copy every figure exactly as written; never invent, estimate, round differently, or extrapolate any number.",
  "- Keep exactly six sections with exactly these headings, in this order:",
  "  \"## 1. Your budget at a glance\", \"## 2. Towns within your reach\", \"## 3. Flats you valued\",",
  "  \"## 4. The 99-year clock: lease notes\", \"## 5. Market snapshot\", \"## 6. How to read this report\".",
  "- Formatting: only \"## \" headings, \"- \" bullet lines, plain paragraphs, and **bold** spans.",
  "  No tables, no code fences, no links, no italics, no other heading levels, no text before section 1 or after section 6.",
  "- Do not simply restate the fact sheet's bullet layout. Write mostly short paragraphs that interpret what the numbers mean for this reader — e.g., how the valued flat compares to their maximum affordable price, how to read the 90% interval, what the remaining lease implies. Use bullets only where a plain list (like town names) is clearly better.",
  "- Where the fact sheet says a station was not visited or data is missing, write one or two friendly sentences inviting the reader to visit that station, and nothing else. Never add suggestions of your own — no example towns, no price ranges, no market claims, no tips that are not in the fact sheet.",
  "- Section 6 must preserve every limitation from the fact sheet (not a licensed valuation; training data ends 2023; interval coverage; schematic icons). Do not soften them.",
  "- Total length 250-450 words.",
].join("\n");

export class LLMProvider {
  constructor(config) {
    this.config = config;
  }

  /** Async, unlike TemplateProvider.generate. Throws on network error, non-2xx,
   * timeout, or malformed/preamble-only output — callers catch and fall back. */
  async generate(journeyState) {
    // The template output doubles as the fact sheet: it already contains every
    // number the report is allowed to use, which is what makes "the LLM writes
    // the prose, the engines own the figures" enforceable.
    const templateBullet = "- Report drafted by: rules-based template (no LLM used).";
    const facts = new TemplateProvider().generate(journeyState).replace(templateBullet + "\n", "").replace(templateBullet, "");

    // The free gpt-oss-20b endpoint occasionally emits corrupted tokens; the
    // structure/figure validation in attempt() catches the bad drafts, so one
    // retry meaningfully raises the success rate before we fall back.
    try {
      return await this.attempt(facts);
    } catch (err) {
      console.warn("LLM draft rejected, retrying once:", err);
      return await this.attempt(facts);
    }
  }

  async attempt(facts) {
    let md = await chatComplete(this.config, SYSTEM_PROMPT, `Fact sheet for this session:\n\n${facts}`);

    // Drop any preamble before section 1 (renderMarkdown would silently eat it).
    const firstHeading = md.indexOf("## ");
    if (firstHeading > 0) md = md.slice(firstHeading);
    if ((md.match(/^## /gm) || []).length < 3) throw new Error("LLM reply is not a structured report");
    assertFigures(facts, md);

    return `${md}\n- Report drafted by: ${this.config.model} via OpenRouter. ` +
      "Every figure comes from HDBrain's rules-based engines; the LLM only wrote the prose.";
  }
}

const EXPLAIN_SYSTEM = [
  "You are the plain-language explainer for HDBrain, a Singapore HDB resale flat advisor built as an NUS course project.",
  "You will receive a fact sheet about one flat valuation: the estimated price, its 90% interval, and the SHAP factor",
  "contributions that pushed the estimate up or down versus the market-wide average.",
  "Write 2-4 plain sentences for a first-time buyer explaining what drove this estimate.",
  "",
  "Hard rules:",
  "- Use ONLY facts and numbers from the fact sheet. Copy every figure exactly as written; never invent or re-derive numbers.",
  "- Focus on the two or three largest factors by absolute value and the direction each pushed the price.",
  "- Plain sentences only: no headings, no bullet lists, no markdown formatting, no preamble.",
  "- Do not give buying advice or opinions on whether this is a good deal.",
].join("\n");

/** ST3 "explain this estimate" (the report's little sibling): same fact-sheet-in,
 * guarded-prose-out contract, scoped to a single valuation. Throws on any failure —
 * the caller shows a quiet inline fallback. */
export async function explainValuation(config, facts) {
  const text = await chatComplete(config, EXPLAIN_SYSTEM, `Valuation fact sheet:\n\n${facts}`);
  if (!text || text.includes("#")) throw new Error("LLM explanation is empty or misformatted");
  assertFigures(facts, text);
  return text;
}
