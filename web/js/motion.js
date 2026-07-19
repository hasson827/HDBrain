/**
 * JS mirror of the motion spec in css/tokens.css (README §8 S3 discipline:
 * one table, every animation reads from it). GSAP wants seconds, not ms.
 */
export const DURATION = { fast: 0.15, base: 0.3, slow: 0.6 };
export const STAGGER = 0.03;
export const EASE = "expo.out";

let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
window
  .matchMedia("(prefers-reduced-motion: reduce)")
  .addEventListener("change", (e) => {
    reduceMotion = e.matches;
  });

export function prefersReducedMotion() {
  return reduceMotion;
}

/** GSAP + ScrollTrigger are loaded as plain vendor scripts (index.html), not
 * ES modules — this is the one place that reaches into window for them, so
 * every station imports from here instead of touching globals directly. */
export function getGsap() {
  const gsap = window.gsap;
  if (gsap && window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
  return gsap;
}

/** Shared by ST2/ST3 (README §8 S3: their two-column layout is frozen from
 * S2, no scroll-hijack pin — see the note in st2.js) and any other station
 * that just needs "fade + slide up, once, as this scrolls into view". */
export function revealOnce(el, opts = {}) {
  const gsap = getGsap();
  if (!el || !gsap || !window.ScrollTrigger || prefersReducedMotion()) return;
  gsap.set(el, { opacity: 0, y: 24 });
  window.ScrollTrigger.create({
    trigger: el,
    start: "top 88%",
    once: true,
    onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: DURATION.base, ease: EASE, delay: opts.delay ?? 0 }),
  });
}

/** For content that changes after a user action (form submit, detail panel
 * opening) — a state-transition pop-in, not a scroll reveal. */
export function popIn(el) {
  const gsap = getGsap();
  if (!el || !gsap || prefersReducedMotion()) return;
  gsap.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: DURATION.base, ease: EASE });
}
