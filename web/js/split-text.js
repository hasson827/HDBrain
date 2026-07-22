/**
 * Vanilla-JS "split into characters, stagger-reveal with GSAP" — no React or
 * build step here (README §7.6), and no ScrollTrigger threshold/rootMargin
 * props: the ST0 headline is visible at load, so the reveal just runs once
 * boot finishes.
 */
import { getGsap, DURATION, EASE, STAGGER, prefersReducedMotion } from "./motion.js";

/** Wraps each character of `el`'s text in its own <span class="split-char">,
 * preserving any existing child elements (e.g. an inner <span class="accent">)
 * so their styling still applies per-character. Spaces stay as plain text
 * nodes (not wrapped) so normal word-wrapping/whitespace collapsing still
 * works between the inline-block char spans. Exported on its own because not
 * every caller wants `splitTextReveal`'s built-in time-based fromTo — ST0's
 * intro composition drives its own chars off a scroll-scrubbed timeline. */
export function wrapChars(node) {
  const chars = [];
  [...node.childNodes].forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      for (const ch of child.textContent) {
        if (ch === " ") {
          frag.appendChild(document.createTextNode(" "));
        } else {
          const span = document.createElement("span");
          span.className = "split-char";
          span.textContent = ch;
          frag.appendChild(span);
          chars.push(span);
        }
      }
      node.replaceChild(frag, child);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      chars.push(...wrapChars(child));
    }
  });
  return chars;
}

/** Splits `el`'s text into per-character spans and reveals them with a GSAP
 * stagger. Values come from the site's one motion spec table (js/motion.js),
 * not ad-hoc numbers, unless the caller overrides them. Gated on GSAP and
 * reduced-motion like every other S3 effect: skipped entirely leaves the
 * text exactly as it was (already visible, unsplit) — never the only path
 * to seeing the headline. */
export function splitTextReveal(el, opts = {}) {
  if (!el) return;
  const gsap = getGsap();
  if (!gsap || prefersReducedMotion()) return;

  const chars = wrapChars(el);
  if (!chars.length) return;

  gsap.fromTo(
    chars,
    { opacity: 0, y: 24 },
    {
      opacity: 1,
      y: 0,
      duration: opts.duration ?? DURATION.slow,
      ease: opts.ease ?? EASE,
      stagger: opts.stagger ?? STAGGER,
      onComplete: opts.onComplete,
    }
  );
}
