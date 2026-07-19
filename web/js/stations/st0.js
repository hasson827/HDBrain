/**
 * ST0 Departure hero motion (README §8 S3 task 3). Layout/copy are frozen
 * from S2 (index.html) apart from the `.st0-intro` blurb; everything here is
 * scroll-bound behavior:
 *   - a per-character reveal on the headline, then the lede types in, then the
 *     bottom scroll-cue reveals character-by-character (a vanilla take on React
 *     Bits' SplitText: from {opacity:0,y:40} to {opacity:1,y:0}, power3.out) and
 *     its arrow floats up and down forever (see js/split-text.js / text-type.js
 *     — vanilla versions, no React/build step, README §7.6)
 *   - a pin + scrub "landing": the planet rotates and scales with scroll, then
 *     blurs into a frosted-glass disc as the skyline backdrop (#world-bg) fades
 *     in behind it, then a short intro composition pops in on the disc
 *   - the skyline is a FIXED layer, so as the pin releases and the planet +
 *     intro scroll away it STAYS put ("背景保留"); a second scrub then blurs and
 *     darkens it into ST1's backdrop (虚化 + 黑透) and fades it out before ST2
 *   - clicking the scroll-cue plays the landing to its final frame (not ST1)
 *   - mouse parallax on the planet
 * One timeline on one ScrollTrigger for the pin sequence, plus a couple of
 * standalone scrubs for the backdrop handoff — a single scrubbed pin range is
 * much less fragile than juggling separately-offset triggers (§7.13).
 */
import { getGsap, DURATION, EASE, prefersReducedMotion } from "../motion.js";
import { splitTextReveal, wrapChars } from "../split-text.js";
import { typeText, runSequence } from "../text-type.js";
import { scrollToTarget } from "../scroll.js";

export function initSt0() {
  const section = document.getElementById("st0-departure");
  const planet = document.getElementById("st0-planet-img");
  const worldBg = document.getElementById("world-bg");
  const worldImg = document.getElementById("world-bg-img");
  const scrim = document.getElementById("world-bg-scrim");
  const intro = document.getElementById("st0-intro");
  const cueLink = document.getElementById("st0-scroll-cue");
  if (!section || !planet) return;

  runHeroIntro(section);

  const gsap = getGsap();
  if (!gsap || !window.ScrollTrigger || prefersReducedMotion()) return;

  // The cue reveals at load (runHeroIntro) and fades the instant the landing
  // starts playing, back in only at the very top. Driven off the pin's own
  // progress (state-tracked so the tween fires on crossings, not every frame)
  // rather than a second trigger on the same pinned element, and it never
  // forces opacity at scroll 0, so it can't stomp the load-time reveal.
  let cueHidden = false;
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: "+=70%",
      pin: true,
      scrub: 0.5,
      onUpdate: (self) => {
        if (!cueLink) return;
        const hide = self.progress > 0.01;
        if (hide !== cueHidden) {
          cueHidden = hide;
          gsap.to(cueLink, { opacity: hide ? 0 : 1, duration: DURATION.base, overwrite: true });
        }
      },
    },
  });
  // Rotate + scale + blur all share the same 0->1 span and linear ease, so the
  // three read as one steady transform into a frosted-glass disc — not a sharp
  // planet that suddenly snaps blurry partway through.
  tl.to(planet, { rotate: 65, scale: 1.6, duration: 1 }, 0)
    .to(".st0-copy", { opacity: 0, y: -24, duration: 0.5 }, 0)
    .fromTo(planet, { filter: "blur(0px)" }, { filter: "blur(18px)", duration: 1 }, 0);
  if (worldBg) tl.to(worldBg, { opacity: 1, duration: 0.7 }, 0.3);
  if (intro) {
    // Per-character squash-and-stretch reveal (yPercent 120->0, scaleY 2.3->1,
    // scaleX 0.7->1), added to this timeline rather than a second ScrollTrigger.
    // It starts at position 1 — the instant the planet finishes turning — with
    // no gap, so the copy comes straight in once the rotation lands.
    const chars = wrapChars(intro.querySelector(".st0-intro-lines"));
    gsap.set(chars, { opacity: 0, yPercent: 120, scaleY: 2.3, scaleX: 0.7, transformOrigin: "50% 0%" });
    tl.set(intro, { opacity: 1 }, 1).to(
      chars,
      { opacity: 1, yPercent: 0, scaleY: 1, scaleX: 1, duration: 1.8, ease: "back.inOut(2)", stagger: 0.035 },
      1
    );
  }

  // Backdrop handoff into ST1: the fixed skyline stays put while the planet and
  // intro scroll away, and over ST1's entry it blurs and darkens (虚化 + 黑透),
  // then fades out before ST2 paints its own background.
  const st1 = document.getElementById("st1-questions");
  if (st1 && worldImg && scrim && worldBg) {
    gsap.fromTo(
      worldImg,
      { filter: "blur(0px)" },
      { filter: "blur(14px)", ease: "none", scrollTrigger: { trigger: st1, start: "top bottom", end: "top top", scrub: true } }
    );
    gsap.fromTo(
      scrim,
      { opacity: 0 },
      { opacity: 0.62, ease: "none", scrollTrigger: { trigger: st1, start: "top bottom", end: "top top", scrub: true } }
    );
    gsap.fromTo(
      worldBg,
      { opacity: 1 },
      { opacity: 0, ease: "none", immediateRender: false, scrollTrigger: { trigger: st1, start: "bottom bottom", end: "bottom top", scrub: true } }
    );
  }

  // Second fixed backdrop, handed off from #world-bg: the blurred Buildings2
  // skyline (#city-bg) rises in as ST2 enters — same "上面的背景不动, 下面的背景
  // 叠上去(虚化)" move as the ST0->ST1 handoff — and stays through ST2–ST6. It's
  // pre-blurred/scrimmed in CSS to the same params ST1 lands on, so the two
  // backdrops read as one continuous darkened skyline across ST1->ST6.
  const st2 = document.getElementById("st2-budget");
  const st7 = document.getElementById("st7-home");
  const cityBg = document.getElementById("city-bg");
  const endingBg = document.getElementById("ending-bg");
  if (cityBg && st2) {
    gsap.fromTo(
      cityBg,
      { opacity: 0 },
      { opacity: 1, ease: "none", scrollTrigger: { trigger: st2, start: "top bottom", end: "top top", scrub: true } }
    );
  }
  // ST6 -> ST7: #city-bg fades out while the Ending skyline (#ending-bg) fades
  // in over the SAME range — the same cross-fade handoff as ST1 -> ST2's
  // world->city, just onto the final station's own backdrop.
  if (cityBg && st7) {
    gsap.fromTo(
      cityBg,
      { opacity: 1 },
      { opacity: 0, ease: "none", immediateRender: false, scrollTrigger: { trigger: st7, start: "top bottom", end: "top top", scrub: true } }
    );
  }
  if (endingBg && st7) {
    gsap.fromTo(
      endingBg,
      { opacity: 0 },
      { opacity: 1, ease: "none", immediateRender: false, scrollTrigger: { trigger: st7, start: "top bottom", end: "top top", scrub: true } }
    );
  }

  // Clicking the cue plays the landing to its final frame (the skyline + blurred
  // planet + intro), not straight to ST1. stopPropagation keeps scroll.js's
  // generic hash handler from also firing and jumping to the ST1 anchor.
  if (cueLink && tl.scrollTrigger) {
    cueLink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Slow, eased scroll so the landing scrubs past unhurriedly — the point
      // is to show the animation, not jump to the end frame.
      scrollToTarget(tl.scrollTrigger.end, {
        duration: 2.8,
        easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      });
    });
  }

  // Mouse parallax — a few px of drift toward the cursor, smoothed with
  // GSAP's quickTo so it doesn't fight the scroll-driven rotate/scale above.
  const quickX = gsap.quickTo(planet, "x", { duration: DURATION.base, ease: "power3" });
  const quickY = gsap.quickTo(planet, "y", { duration: DURATION.base, ease: "power3" });
  section.addEventListener("mousemove", (e) => {
    const rect = section.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    quickX(px * 24);
    quickY(py * 16);
  });
  section.addEventListener("mouseleave", () => {
    quickX(0);
    quickY(0);
  });
}

/** Headline reveal, then the lede types in, then the bottom scroll-cue reveals
 * character-by-character and its arrow starts floating. Runs once at load,
 * independent of the scroll-driven pin sequence — the hero is visible
 * immediately, not scrolled into view later. */
async function runHeroIntro(section) {
  const gsap = getGsap();
  if (!gsap || prefersReducedMotion()) return; // static HTML text is already correct

  const h1 = section.querySelector(".st0-copy h1");
  const ledePre = document.getElementById("st0-lede-pre");
  const ledePost = document.getElementById("st0-lede-post");
  const countEl = document.getElementById("st0-count");
  const cueLink = document.getElementById("st0-scroll-cue");
  const cueText = section.querySelector(".scroll-cue-text");
  const cueArrow = section.querySelector(".scroll-cue-arrow");

  // Nothing below has run yet, so it's safe to clear now without a flash of the
  // full static text (the title's split-char reveal covers itself). The cue
  // waits hidden until the headline + lede have landed.
  if (ledePre) ledePre.textContent = "";
  if (ledePost) ledePost.textContent = "";
  if (countEl) countEl.textContent = "0";
  if (cueLink) gsap.set(cueLink, { opacity: 0 });

  await new Promise((resolve) => {
    // A one-off, slightly slower reveal pace for the hero headline — an
    // override here, not a change to the shared duration/stagger tokens.
    splitTextReveal(h1, { duration: DURATION.slow * 1.3, stagger: 0.045, onComplete: resolve });
    if (!h1?.textContent?.trim()) resolve();
  });

  await runSequence([
    () => typeText(ledePre, "HDBrain turns ", { showCursor: false }),
    () => runCountUp(countEl, 981450),
    () => typeText(ledePost, " real transactions into answers to the three questions every Singapore homebuyer asks.", { showCursor: false }),
  ]);

  // Scroll-cue entrance: reveal the link, then its text one character at a time
  // (React Bits SplitText recipe), then float the arrow up and down forever.
  if (cueLink) gsap.set(cueLink, { opacity: 1 });
  if (cueText) {
    const chars = wrapChars(cueText);
    gsap.set(chars, { opacity: 0, y: 40 });
    await new Promise((resolve) => {
      gsap.to(chars, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.05, onComplete: resolve });
    });
  }
  if (cueArrow) {
    gsap.set(cueArrow, { opacity: 0 });
    gsap.to(cueArrow, {
      opacity: 1,
      duration: DURATION.base,
      onComplete: () => {
        gsap.to(cueArrow, { y: 8, duration: 0.9, ease: "sine.inOut", repeat: -1, yoyo: true });
      },
    });
  }
}

function runCountUp(countEl, target) {
  return new Promise((resolve) => {
    const gsap = getGsap();
    if (!countEl || !gsap) {
      if (countEl) countEl.textContent = target.toLocaleString("en-SG");
      resolve();
      return;
    }
    const counter = { value: 0 };
    gsap.to(counter, {
      value: target,
      duration: DURATION.slow,
      ease: EASE,
      onUpdate: () => {
        countEl.textContent = Math.round(counter.value).toLocaleString("en-SG");
      },
      onComplete: resolve,
    });
  });
}
