/**
 * ST7 Home / report station (README_XCH §7.3 ST7 / §8 S2 task 4): styled report
 * generator + Responsible AI disclosure cards + footer credit. The pinned
 * "Welcome home" finale (planet/ground scrub) and the "One more thing" fireworks
 * easter egg were removed per XCH (2026-07-18) — the finale glitched entering
 * ST7 and its pin is gone with it.
 */
import { journeyState } from "../state.js";
import { TemplateProvider, LLMProvider, loadLLMConfig } from "../report/providers.js";
import { renderMarkdown } from "../markdown.js";
import { revealOnce } from "../motion.js";
import { scrollFloat } from "../scroll-float.js";

// One simplified "otter" easter egg (README §7.9.1 "水獭一家"), appearing
// once here rather than in every station's corner (XCH's 2026-07-17 call:
// the full multi-pose per-station version is real scope, not worth it for
// a single course-project flourish). Same flat line-art stroke language as
// flat-icons.js — a body, a rounded head, a raised paw.
const OTTER_SVG = `
  <svg class="otter-icon" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
    <path d="M14 46 C14 34 20 26 30 26 C40 26 46 34 46 44 C46 50 41 54 34 54 L22 54 C17 54 14 51 14 46 Z"/>
    <circle cx="30" cy="20" r="8"/>
    <circle cx="26" cy="19" r="1.4" fill="currentColor"/>
    <circle cx="34" cy="19" r="1.4" fill="currentColor"/>
    <path d="M30 22 L28 24 M30 22 L32 24" />
    <path d="M40 30 C46 26 50 28 50 22" />
  </svg>
`;

// The five papers the project leans on most, in the order they matter to it:
// the hedonic theory that licenses reading SHAP values as implicit prices, the
// Singapore lease-decay study, two systematic reviews of automated valuation,
// and the open-data + XAI result closest to our own method. The full review of
// all is in the repository; this is a reading list, not a bibliography, so it
// sits collapsed behind a <details> the way ST5 and ST6 hide their own detail.
const READING = [
  {
    cite: `Rosen, S. (1974). Hedonic prices and implicit markets: Product differentiation in pure competition. <i>Journal of Political Economy</i>, 82(1), 34&ndash;55.`,
    doi: "https://doi.org/10.1086/260169",
  },
  {
    cite: `Li, B., Gao, F., &amp; Tan, S. (2023). Aging like fine wine: A Singapore public housing story. <i>International Real Estate Review</i>, 26(1), 95&ndash;126.`,
  },
  {
    cite: `El Jaouhari, A., Samadhiya, A., Kumar, A., &Scaron;e&scaron;plaukis, A., &amp; Raslanas, S. (2024). Mapping the landscape: A systematic literature review on automated valuation models and strategic applications in real estate. <i>International Journal of Strategic Property Management</i>, 28(5), 286&ndash;301.`,
    doi: "https://doi.org/10.3846/ijspm.2024.22251",
  },
  {
    cite: `Tekouabou, S. C. K., Gherghina, &Scedil;. C., Kameni, E. D., Filali, Y., &amp; Idrissi Gartoumi, K. (2024). AI-based on machine learning methods for urban real estate prediction: A systematic survey. <i>Archives of Computational Methods in Engineering</i>, 31(2), 1079&ndash;1095.`,
    doi: "https://doi.org/10.1007/s11831-023-10010-5",
  },
  {
    cite: `Trindade Neves, F., Apar&iacute;cio, M., &amp; de Castro Neto, M. (2024). The impacts of open data and explainable AI on real estate price predictions in smart cities. <i>Applied Sciences</i>, 14(5), 2209.`,
    doi: "https://doi.org/10.3390/app14052209",
  },
];

const DISCLOSURES = [
  {
    title: "Not a licensed valuation",
    body: "HDBrain is a statistical estimate from historical resale transactions, not a professional appraisal or a substitute for one.",
  },
  {
    title: "Training data ends in 2023",
    body: "The model learns from sales up to 2023 and cannot extrapolate the 2024–2026 upswing. On unseen 2024+ sales it under-predicts by about 7% at the median, so an actual transaction may print above this estimate.",
  },
  {
    title: "Prediction intervals are optimistic",
    body: "The 90% interval's measured coverage on 2024–2026 data is well below 90% — see the Model Arena for the exact figures.",
  },
  {
    title: "Icons are schematic, not photos",
    body: "Flat-model silhouettes and the town map represent categories, not the specific unit or building you searched for.",
  },
  {
    title: "Built to degrade gracefully",
    body: "An optional LLM writer (gpt-oss-20b via OpenRouter) drafts the report's prose, but every figure comes from the deterministic engines — and when the LLM is unreachable or unconfigured, the report falls back to a zero-dependency template. The product never depends on the LLM.",
  },
];

// Ordered alphabetically by surname (Lin, Xu, Zhang, Zhao) — noted explicitly
// on the page per XCH's ask (2026-07-17), since it's not the order she first
// listed the names in and the page should say so rather than leave it to guess.
const TEAM = [
  { name: "Lin Hali", school: "ZJU" },
  { name: "Xu Chuhao", school: "UIUC" },
  { name: "Zhang Zherui", school: "UIUC" },
  { name: "Zhao Hongshuo", school: "ZJU" },
];

export function initSt7() {
  const root = document.getElementById("st7-home");
  if (!root) return;

  root.innerHTML = `
    <div class="station-inner">
      <h2>ST7 &middot; Home</h2>
      <p class="lede">Everything you checked this session, assembled into one report.</p>

      <div class="card st7-report-card">
        <div class="cluster">
          <button type="button" id="st7-generate">Generate my report</button>
          <button type="button" class="btn-ghost btn-sm" id="st7-download" hidden>Download as Markdown</button>
          <button type="button" class="btn-ghost btn-sm" id="st7-print" hidden
            title="Opens your browser's print dialog; choose 'Save as PDF' as the destination.">Download as PDF</button>
        </div>
        <div id="st7-report" class="st7-report-body"></div>
        <p class="disclosure" id="st7-report-meta" hidden></p>
      </div>

      <h3>Responsible AI</h3>
      <div class="grid-cards grid-cards-5">
        ${DISCLOSURES.map((d) => `
          <div class="card">
            <h3>${d.title}</h3>
            <p>${d.body}</p>
          </div>`).join("")}
      </div>

      <footer class="st7-footer">
        <p class="disclosure">Data: data.gov.sg HDB resale flat prices. Policy references: MAS, MoneySense.
           Built for an NUS course project.</p>
        <div class="st7-otter" aria-hidden="true">${OTTER_SVG}</div>
        <h3>Team</h3>
        <ul class="team-list">
          ${TEAM.map((m) => `<li>${m.name} <span class="team-school">(${m.school})</span></li>`).join("")}
        </ul>
        <p class="disclosure">Listed alphabetically by surname.</p>

        <details class="disclosure-block card">
          <summary>Further reading</summary>
          <ol class="ref-list">
            ${READING.map((r) => `
              <li>${r.cite}${r.doi ? ` <a href="${r.doi}" target="_blank" rel="noopener">${r.doi.replace("https://doi.org/", "doi:")}</a>` : ""}</li>`).join("")}
          </ol>
          <p class="disclosure">Five of the papers behind this project. The full
             literature review ships with the repository.</p>
        </details>
        <div class="cluster">
          <a class="btn-ghost btn-sm" href="https://github.com/hasson827/HDBrain" target="_blank" rel="noopener">GitHub</a>
          <a class="btn-ghost btn-sm" href="#st0-departure">Back to the top &uarr;</a>
        </div>
      </footer>
    </div>
  `;

  let lastMarkdown = "";
  const generateBtn = document.getElementById("st7-generate");
  generateBtn.addEventListener("click", async () => {
    const metaEl = document.getElementById("st7-report-meta");
    let meta = "Rules-based summary (deterministic template).";
    lastMarkdown = "";

    // Provider selection per §7.9.5: LLM when llm-config.js resolves to a key,
    // seamless fallback to the template otherwise or on any LLM failure.
    generateBtn.disabled = true;
    const cfg = await loadLLMConfig();
    if (cfg) {
      generateBtn.textContent = "Drafting your report…";
      try {
        lastMarkdown = await new LLMProvider(cfg).generate(journeyState);
        meta = `Drafted by ${cfg.model} via OpenRouter — every figure comes from the deterministic engines.`;
      } catch (err) {
        console.warn("LLM report failed, falling back to template:", err);
        meta = "LLM unreachable just now — showing the rules-based summary instead.";
      }
    }
    if (!lastMarkdown) lastMarkdown = new TemplateProvider().generate(journeyState);

    document.getElementById("st7-report").innerHTML = renderMarkdown(lastMarkdown);
    metaEl.textContent = meta;
    metaEl.hidden = false;
    document.getElementById("st7-download").hidden = false;
    document.getElementById("st7-print").hidden = false;
    generateBtn.disabled = false;
    generateBtn.textContent = "Regenerate my report";
  });

  document.getElementById("st7-download").addEventListener("click", () => {
    const blob = new Blob([lastMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hdbrain-report.md";
    a.click();
    URL.revokeObjectURL(url);
  });

  // "Download / Print PDF (CSS print stylesheet 实现，零依赖)" — §7.9.5 as designed.
  // The report is re-rendered into a dedicated light-on-white print sheet; while
  // body.print-report is set, print CSS hides the whole dark app and shows only
  // the sheet. Organic Ctrl+P (no class) still prints the page unchanged.
  document.getElementById("st7-print").addEventListener("click", () => {
    let sheet = document.getElementById("print-sheet");
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.id = "print-sheet";
      sheet.setAttribute("aria-hidden", "true");
      document.body.appendChild(sheet);
    }
    const date = new Date().toLocaleDateString("en-SG", { year: "numeric", month: "long", day: "numeric" });
    sheet.innerHTML = `
      <header class="print-header">
        <h1>Your HDBrain Report</h1>
        <p>${date} &middot; HDB resale advisor, NUS course project</p>
      </header>
      ${renderMarkdown(lastMarkdown)}
    `;
    document.body.classList.add("print-report");
    window.addEventListener("afterprint", () => document.body.classList.remove("print-report"), { once: true });
    window.print();
  });

  // Same title/intro entrance as ST2-ST4 (XCH 2026-07-20).
  scrollFloat(root.querySelector(".station-inner > h2"));
  scrollFloat(root.querySelector(".station-inner > .lede"));

  // "情绪高点之后是克制的落幕" (§7.11.2) — everything after the finale settles
  // in quietly as it scrolls into view, not all at once on page load.
  revealOnce(document.querySelector(".st7-report-card"));
  revealOnce(document.querySelector(".grid-cards-5"));
  revealOnce(document.querySelector(".st7-otter"));
  revealOnce(document.querySelector(".st7-footer"));
}
