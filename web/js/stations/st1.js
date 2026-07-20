/**
 * ST1 Three Questions motion (README §8 S3 task 4). Layout/copy frozen from
 * S2 (index.html) — this file adds: a stroke line-drawing animation on the 3
 * line-art icons ("笔画画出来" per §7.3 ST1) and a float-in on the question
 * cards as they scroll into view.
 *
 * Gated entirely on GSAP/ScrollTrigger being present: if they failed to load,
 * cards and icons are left at their normal CSS-visible state rather than
 * hidden-and-never-revealed (a JS-gated reveal must never be the only path to
 * visibility).
 */
import { getGsap, DURATION, EASE, STAGGER, prefersReducedMotion } from "../motion.js";
import { scrollFloat } from "../scroll-float.js";

export function initSt1() {
  const section = document.getElementById("st1-questions");
  if (!section) return;

  // Same title/intro entrance as ST2-ST4 (XCH 2026-07-20: every station header
  // gets the ScrollFloat reveal). Self-gated on GSAP/reduced-motion.
  scrollFloat(section.querySelector(".station-inner > h2"));
  scrollFloat(section.querySelector(".station-inner > .lede"));

  const gsap = getGsap();
  if (!gsap || !window.ScrollTrigger || prefersReducedMotion()) return;

  const cards = [...section.querySelectorAll(".question-card")];

  cards.forEach((card, i) => {
    const icon = card.querySelector(".question-icon");
    const shapes = icon ? [...icon.querySelectorAll("path, circle, rect")] : [];
    shapes.forEach((shape) => {
      const length = shape.getTotalLength ? shape.getTotalLength() : 100;
      shape.style.strokeDasharray = String(length);
      shape.style.strokeDashoffset = String(length);
    });

    gsap.set(card, { opacity: 0, y: 28 });

    window.ScrollTrigger.create({
      trigger: card,
      start: "top 85%",
      once: true,
      onEnter: () => {
        const tl = gsap.timeline({ defaults: { ease: EASE } });
        tl.to(card, { opacity: 1, y: 0, duration: DURATION.base, delay: i * STAGGER })
          .to(shapes, { strokeDashoffset: 0, duration: DURATION.slow, stagger: STAGGER }, "-=0.1");
      },
    });
  });
}
