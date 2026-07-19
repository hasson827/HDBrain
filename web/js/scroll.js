/**
 * Global scroll engine (README §8 S3 task 1): Lenis for inertia scrolling +
 * GSAP ScrollTrigger for scroll-bound animation, synced per GSAP's documented
 * Lenis integration (lenis "scroll" -> ScrollTrigger.update, lenis.raf driven
 * by gsap.ticker so there's one RAF loop, not two competing ones).
 *
 * Skipped entirely under prefers-reduced-motion — plain native scroll is the
 * correct "no motion" baseline here (README §8 S3 task 10), not a slowed-down
 * version of the smoothing.
 *
 * All internal `#hash` navigation (nav dots, ST1 question-card links, ST7
 * "back to top", and the programmatic scrollIntoView calls in nav.js/st2.js/
 * st3.js) is centralized here so it goes through Lenis's own scrollTo when
 * Lenis owns the scroll — letting native scrollIntoView run at the same time
 * as Lenis fights it for control and produces visible jank.
 */
import { prefersReducedMotion, getGsap } from "./motion.js";

let lenis = null;

export function initScrollEngine() {
  const gsap = getGsap();
  if (!gsap || !window.ScrollTrigger) return;

  if (prefersReducedMotion() || !window.Lenis) return;

  lenis = new window.Lenis({ duration: 1.0, smoothWheel: true });
  lenis.on("scroll", window.ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || link.getAttribute("href") === "#") return;
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    scrollToTarget(target);
  });
}

export function getLenis() {
  return lenis;
}

/** Use instead of `el.scrollIntoView(...)` anywhere in the app — routes
 * through Lenis when it's driving the scroll, falls back to native smooth
 * scroll otherwise (reduced-motion, or Lenis/GSAP failed to load). Accepts an
 * element, a selector, or a numeric scroll position (px). */
export function scrollToTarget(target, opts) {
  if (lenis) {
    lenis.scrollTo(target, opts);
    return;
  }
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (el && typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
  } else if (typeof target === "number") {
    window.scrollTo({ top: target, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }
}
