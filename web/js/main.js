/**
 * Entry point: load the precomputed data, wire up navigation + the scroll
 * engine, then boot each station module (README_XCH §8, now covering S3's
 * motion/scroll-engine wiring too).
 */
import { loadAllData } from "./engine/valuation.js";
import { initNav, refreshNavTrack } from "./nav.js";
import { initScrollEngine } from "./scroll.js";
import { initMagicBento } from "./magic-bento.js";
import { registerEchartsTheme } from "./echarts-theme.js";
import { initSt0 } from "./stations/st0.js";
import { initSt1 } from "./stations/st1.js";
import { initSt2 } from "./stations/st2.js";
import { initSt3 } from "./stations/st3.js";
import { initSt4 } from "./stations/st4.js";
import { initSt5 } from "./stations/st5.js";
import { initSt6 } from "./stations/st6.js";
import { initSt7 } from "./stations/st7.js";

async function main() {
  await loadAllData();
  registerEchartsTheme();
  initScrollEngine();
  initNav();
  initSt0();
  initSt1();
  // Awaited: ST2's map renders asynchronously (fetches the coastline GeoJSON),
  // and refreshNavTrack() below must measure section positions only after that
  // ~630px of map has laid out, or every station below ST2 is measured short.
  await initSt2();
  initSt3();
  initSt4();
  initSt5();
  initSt6();
  initSt7();
  // Stations are all rendered now (real heights, not the min-height:100dvh
  // placeholder initNav() saw), so this is the first correct moment to
  // measure each station's document position for the nav's per-segment
  // train animation — see the comment above measureSections() in nav.js.
  refreshNavTrack();
  // Cursor glow + spotlight across every card (re-queries the DOM each frame,
  // so cards rendered later — ST3's result + comparables — are covered too).
  initMagicBento();
  document.getElementById("boot-loader")?.classList.add("is-hidden");
}

main().catch((err) => {
  console.error(err);
  document.getElementById("boot-loader")?.classList.add("is-hidden");
  const banner = document.createElement("p");
  banner.textContent = `Failed to initialize: ${err.message}`;
  banner.style.color = "red";
  document.body.prepend(banner);
});
