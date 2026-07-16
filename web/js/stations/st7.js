/**
 * ST7 Home / report station (README_XCH §7.3 ST7, §7.9.5 / §8 S1 task 6). S1
 * scope: journeyState summary + TemplateProvider producing a plain-text report.
 * No print CSS, no train-arrival animation, no OllamaProvider — those are S3/S4.
 */
import { journeyState } from "../state.js";
import { TemplateProvider } from "../report/providers.js";

export function initSt7() {
  const root = document.getElementById("st7-home");
  if (!root) return;

  root.innerHTML = `
    <h2>ST7 &middot; Home</h2>
    <p>Everything you checked this session, assembled into one report.</p>
    <button id="st7-generate">Generate my report</button>
    <pre id="st7-report" style="white-space: pre-wrap;"></pre>
  `;

  document.getElementById("st7-generate").addEventListener("click", () => {
    const provider = new TemplateProvider();
    const markdown = provider.generate(journeyState);
    document.getElementById("st7-report").textContent = markdown;
  });
}
