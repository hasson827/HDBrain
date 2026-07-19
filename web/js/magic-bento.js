/**
 * Cursor glow + global spotlight — a vanilla take on React Bits' "MagicBento"
 * (README §7.6), extended from ST2's input cards to EVERY card on the page
 * (XCH 2026-07-18). Two of the component's layers are kept:
 *   - border glow: each card's masked ::after brightens where the cursor is,
 *     with intensity driven by PROXIMITY (glows as the cursor approaches, not
 *     only on direct hover) — the CSS reads --glow-x/-y/-intensity set here.
 *   - global spotlight: one soft coral light element that follows the cursor.
 * The tilt / magnetism / particle / click-ripple layers are intentionally left
 * out: cards that tilt or drift under the cursor fight typing into the forms
 * they hold, and particles are exactly the per-frame cost we just removed.
 *
 * Skipped under reduced motion and on coarse-pointer / narrow devices (there's
 * no hovering cursor to follow) — cards then simply stay unglowed. Everything
 * runs off ONE pointermove handler, rAF-throttled, reading each card's rect
 * fresh so cards added later (ST3's result + comparables) are picked up with no
 * re-init. The glow writes are paint-only custom properties (no layout), so the
 * batched rect reads stay cheap.
 */
import { prefersReducedMotion } from "./motion.js";

const CARD_SELECTOR = ".card, .bento-card, .glass-surface";
const RADIUS = 300;
const PROXIMITY = RADIUS * 0.5;   // full glow within this gap to a card edge
const FADE = RADIUS * 0.75;       // glow fades to 0 by here

export function initMagicBento() {
  if (prefersReducedMotion()) return;
  if (window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 768) return;

  const spotlight = document.createElement("div");
  spotlight.className = "magic-spotlight";
  spotlight.setAttribute("aria-hidden", "true");
  document.body.appendChild(spotlight);

  let mx = 0, my = 0, scheduled = false;

  function update() {
    scheduled = false;
    const cards = [...document.querySelectorAll(CARD_SELECTOR)];
    // Read all rects first, then write all custom props — the writes are
    // paint-only, so keeping reads and writes in separate passes avoids any
    // layout thrash.
    const rects = cards.map((c) => c.getBoundingClientRect());
    let minDist = Infinity;

    cards.forEach((card, i) => {
      const r = rects[i];
      if (r.width === 0 || r.height === 0) {
        card.style.setProperty("--glow-intensity", "0");
        return;
      }
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.max(0, Math.hypot(mx - cx, my - cy) - Math.max(r.width, r.height) / 2);
      minDist = Math.min(minDist, dist);

      let intensity = 0;
      if (dist <= PROXIMITY) intensity = 1;
      else if (dist <= FADE) intensity = (FADE - dist) / (FADE - PROXIMITY);

      card.style.setProperty("--glow-x", `${((mx - r.left) / r.width) * 100}%`);
      card.style.setProperty("--glow-y", `${((my - r.top) / r.height) * 100}%`);
      card.style.setProperty("--glow-intensity", intensity.toFixed(3));
    });

    spotlight.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    const spot = minDist <= PROXIMITY ? 1 : minDist <= FADE ? (FADE - minDist) / (FADE - PROXIMITY) : 0;
    spotlight.style.opacity = (spot * 0.9).toFixed(3);
  }

  window.addEventListener("pointermove", (e) => {
    mx = e.clientX;
    my = e.clientY;
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  // Pointer left the window entirely — drop the spotlight and every card glow.
  document.addEventListener("pointerleave", () => {
    spotlight.style.opacity = "0";
    document.querySelectorAll(CARD_SELECTOR).forEach((c) => c.style.setProperty("--glow-intensity", "0"));
  });
}
