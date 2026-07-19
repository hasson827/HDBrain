/**
 * Vanilla port of React Bits' <ScrollFloat /> (README §7.6: React Bits pieces
 * are reimplemented as plain JS/CSS, no React / build step). Splits an
 * element's text into per-character spans and drives a squash-and-stretch
 * reveal off a SCRUBBED ScrollTrigger — the characters float up as the element
 * passes through the viewport, tied to scroll position rather than a one-shot
 * onEnter (that scrubbing is the whole difference from split-text.js's
 * time-based splitTextReveal).
 *
 * The fromTo values are the component's own: opacity 0->1, yPercent 120->0,
 * scaleY 2.3->1, scaleX 0.7->1, transformOrigin '50% 0%', ease back.inOut(2),
 * stagger 0.03. Only the giant hero typography from the component's CSS is
 * dropped: our callers keep their existing type tokens (this adds motion to a
 * title/intro, it isn't a 10rem hero word).
 *
 * Gated on GSAP + ScrollTrigger + reduced-motion exactly like every other S3
 * effect: skipped leaves the text as normal, already-visible, unsplit markup —
 * a JS-gated reveal is never the only path to seeing the copy.
 */
import { getGsap, prefersReducedMotion } from "./motion.js";

/** Split `el`'s text into per-character spans, but GROUPED BY WORD: each word
 * is an inline-block, white-space:nowrap `.split-word` wrapper holding its
 * `.split-char` spans, with plain spaces between words. Grouping matters here
 * (unlike split-text.js's flat char split) because these titles/intros wrap
 * over several lines — a flat run of inline-block chars would let the line
 * break in the MIDDLE of a word ("W\nhat"). Assumes plain-text content (our
 * ST2/ST3/ST4 heads have no inline markup); returns the flat char array. */
function splitIntoWords(el) {
  const text = el.textContent;
  el.textContent = "";
  const chars = [];
  for (const part of text.split(/(\s+)/)) {
    if (part === "") continue;
    if (/^\s+$/.test(part)) {
      el.appendChild(document.createTextNode(part));
      continue;
    }
    const word = document.createElement("span");
    word.className = "split-word";
    for (const ch of part) {
      const c = document.createElement("span");
      c.className = "split-char";
      c.textContent = ch;
      word.appendChild(c);
      chars.push(c);
    }
    el.appendChild(word);
  }
  return chars;
}

/** Apply the ScrollFloat reveal to `el` (a heading or paragraph). Options
 * mirror the component's props; defaults are the component's defaults. */
export function scrollFloat(el, opts = {}) {
  if (!el) return;
  const gsap = getGsap();
  if (!gsap || !window.ScrollTrigger || prefersReducedMotion()) return;

  const chars = splitIntoWords(el);
  if (!chars.length) return;

  gsap.fromTo(
    chars,
    {
      willChange: "opacity, transform",
      opacity: 0,
      yPercent: 120,
      scaleY: 2.3,
      scaleX: 0.7,
      transformOrigin: "50% 0%",
    },
    {
      opacity: 1,
      yPercent: 0,
      scaleY: 1,
      scaleX: 1,
      duration: opts.animationDuration ?? 1,
      ease: opts.ease ?? "back.inOut(2)",
      stagger: opts.stagger ?? 0.03,
      scrollTrigger: {
        trigger: el,
        start: opts.scrollStart ?? "center bottom+=50%",
        end: opts.scrollEnd ?? "bottom bottom-=40%",
        scrub: true,
      },
    }
  );
}
