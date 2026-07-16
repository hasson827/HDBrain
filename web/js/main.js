/**
 * S1 entry point: load the precomputed data, wire up navigation, then boot each
 * station module. No animation/scroll engine here yet — that is S3 (README_XCH §8).
 */
import { loadAllData } from "./engine/valuation.js";
import { initNav, refreshNavTrack } from "./nav.js";
import { registerEchartsTheme } from "./echarts-theme.js";
import { initSt2 } from "./stations/st2.js";
import { initSt3 } from "./stations/st3.js";
import { initSt4 } from "./stations/st4.js";
import { initSt5 } from "./stations/st5.js";
import { initSt6 } from "./stations/st6.js";
import { initSt7 } from "./stations/st7.js";

async function main() {
  await loadAllData();
  registerEchartsTheme();
  initNav();
  initSt2();
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
}

main().catch((err) => {
  console.error(err);
  const banner = document.createElement("p");
  banner.textContent = `Failed to initialize: ${err.message}`;
  banner.style.color = "red";
  document.body.prepend(banner);
});
