/**
 * Top navigation (README_XCH §7.11.1 "functional layer" + §8 S2 task 2): the
 * horizontal MRT line with a train marker. Station dots are evenly spaced
 * (this bar's job is efficiency/accessibility, not the winding geography of
 * the center track).
 *
 * The train's motion is continuous, not a discrete per-station snap — but the
 * percentage driving it is computed PER INTER-STATION SEGMENT, not against
 * the whole document's scroll height: within the segment between station i
 * and i+1, scrolling from i's top to i+1's top moves the train continuously
 * from stationPos(i) to stationPos(i+1). A short section completes that
 * traversal over a short scroll distance (train "drives past" quickly); a
 * long section (ST5/ST6 with lots of cards/tables) stretches the same
 * traversal over a long scroll distance (train moves slowly). See
 * `updateTrainByScroll()`.
 */
import { stations } from "./state.js";
import { scrollToTarget, getLenis } from "./scroll.js";
import { getGsap, DURATION, EASE, prefersReducedMotion } from "./motion.js";

// Dots (and the train) are inset a few % from the track's own edges so the
// rail line visibly runs past the first/last station rather than stopping
// exactly at them.
const EDGE_INSET = 4;

function stationPos(i) {
  return EDGE_INSET + (i / (stations.length - 1)) * (100 - EDGE_INSET * 2);
}

const BAND_TOP = 0.45, BAND_BOTTOM = 0.5; // keep in sync with the observer's rootMargin

let train = null;
let sectionTops = [];

// Real bug found while testing this: sections start at their CSS
// `min-height: 100dvh` and only reach their true (usually taller) height
// once each station's `initSt*()` fills in its cards/tables. `initNav()` runs
// before any of that content exists, so measuring section tops there alone
// baked in a stale, evenly-spaced 900px-per-station layout — every station
// past ST1 measured short by however much real content it later gained,
// which is why the train raced to nearly the end of a segment almost
// immediately. A `window.load` listener does NOT reliably fix this: `main()`
// awaits `loadAllData()` before calling `initNav()` at all, so the browser's
// real `load` event can fire (and be missed) before that listener even gets
// attached. `refreshNavTrack()` is the real fix — main.js calls it once after
// every station has actually rendered.
function measureSections() {
  sectionTops = stations.map((s) => {
    const el = document.querySelector(s.hash);
    const rect = el?.getBoundingClientRect();
    return (rect?.top ?? 0) + window.scrollY;
  });
}

function trainPositionFor(readerY) {
  const last = sectionTops.length - 1;
  if (readerY <= sectionTops[0]) return stationPos(0);
  for (let i = 0; i < last; i++) {
    const a = sectionTops[i], b = sectionTops[i + 1];
    if (readerY < b) {
      const t = b > a ? (readerY - a) / (b - a) : 1;
      return stationPos(i) + Math.min(Math.max(t, 0), 1) * (stationPos(i + 1) - stationPos(i));
    }
  }
  return stationPos(last);
}

function updateTrainByScroll() {
  if (!train || !sectionTops.length) return;
  const bandCenter = window.innerHeight * ((BAND_TOP + (1 - BAND_BOTTOM)) / 2);
  const readerY = window.scrollY + bandCenter;
  train.style.right = `${100 - trainPositionFor(readerY)}%`;
}

/** Call once after all stations have rendered their real content (main.js) —
 * see the comment above `measureSections()` for why this can't just be a
 * `window.load` listener. Safe to call again later too (e.g. if a future
 * station starts loading images that reflow its height).
 * Also the right place to refresh ScrollTrigger's cached trigger positions
 * (S3: other stations register pins/scrubs against real content height too —
 * same staleness problem as the train, same fix). */
export function refreshNavTrack() {
  // Refresh ScrollTrigger FIRST so every pin-spacer is (re)sized to the real
  // content height, THEN measure — otherwise measureSections() reads section
  // tops that a subsequent refresh() shifts down (by the pin-spacer growth),
  // leaving the train's cached positions stale.
  window.ScrollTrigger?.refresh();
  measureSections();
  updateTrainByScroll();
}

// A quick "docking jolt" (README §8 S3 task 2: "进站顿挫") — fires once per
// station arrival, whether the train got there by continuous scroll or by a
// click/keyboard jump (setActive() is the one place both paths converge).
// The "跳站加速追上再停下" half of that task needs no separate code: the train
// position is already a pure function of scroll position (trainPositionFor
// above), and scroll.js routes jumps through Lenis's own eased scrollTo, so
// the train visibly accelerates through intermediate stations and settles as
// a side effect of the scroll itself animating — adding a second, competing
// animation here would just fight it.
let joltedStationId = null;
function dockingJolt() {
  const gsap = getGsap();
  if (!gsap || !train || prefersReducedMotion()) return;
  gsap.fromTo(
    train,
    { scaleX: 1.05 },
    { scaleX: 1, duration: DURATION.fast, ease: EASE, transformOrigin: "right center", overwrite: true }
  );
}

export function initNav() {
  const nav = document.getElementById("top-nav");
  if (!nav) throw new Error("#top-nav not found in index.html");
  nav.classList.add("glass");

  // Full station name shown in a bubble tooltip on hover/focus (not the
  // shortened "ST0"), not an inline expand.
  const dots = stations
    .map((s, i) => {
      return `<a class="nav-dot" href="${s.hash}" data-station="${s.id}" style="--pos:${stationPos(i)}%">
        <span class="nav-dot-mark"></span>
        <span class="nav-dot-tooltip" role="tooltip">${s.name}</span>
      </a>`;
    })
    .join("");

  nav.innerHTML = `
    <div class="nav-inner">
      <a class="nav-brand" href="#st0-departure">HDBrain<span class="dot">.</span></a>
      <div class="nav-track">
        <div class="nav-line"></div>
        <div class="nav-train-clip">
          <img class="nav-train" id="nav-train" src="./static/img/mrt-train.png" alt="" aria-hidden="true" />
        </div>
        ${dots}
      </div>
      <div class="nav-actions">
        <a class="btn-ghost btn-sm" href="#st7-home">Generate report</a>
        <a class="btn-ghost btn-sm" href="https://github.com/hasson827/HDBrain" target="_blank" rel="noopener">GitHub</a>
      </div>
    </div>
  `;

  const links = new Map(
    [...nav.querySelectorAll("a[data-station]")].map((a) => [a.dataset.station, a])
  );
  train = document.getElementById("nav-train");

  function setActive(id) {
    for (const [stationId, link] of links) {
      link.setAttribute("aria-current", stationId === id ? "true" : "false");
    }
    if (id !== joltedStationId) {
      joltedStationId = id;
      dockingJolt();
    }
  }

  const sections = stations
    .map((s) => document.querySelector(s.hash))
    .filter(Boolean);

  // A thin detection band near the top of the viewport, rather than "which
  // section covers >=50% of its own area" (S2 real bug: once stations grew
  // past ~2x viewport height — st5/st6 with multiple cards and tables — they
  // could never reach a 0.5 ratio of their own total height, so the observer
  // never fired for them and aria-current stuck on whatever last crossed 0.5).
  // Fixed-size rootMargin bands don't care how tall the target is.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const station = stations.find((s) => s.hash === `#${entry.target.id}`);
        if (station) {
          setActive(station.id);
          history.replaceState(null, "", station.hash);
        }
      }
    },
    { rootMargin: `-${BAND_TOP * 100}% 0px -${BAND_BOTTOM * 100}% 0px`, threshold: 0 }
  );
  sections.forEach((sec) => observer.observe(sec));

  // Continuous train position, per inter-station segment (see `measureSections()`
  // / `updateTrainByScroll()` above) — re-measured for real once `refreshNavTrack()`
  // is called after every station has rendered (main.js), but wired up here too
  // so scrolling/resizing before that point still moves the train.
  // Driven off Lenis's own `scroll` event (same channel that already feeds
  // ScrollTrigger.update, so it stays RAF-batched and doesn't start a competing
  // loop). An earlier version used a whole-document ScrollTrigger, but its
  // `end: "bottom bottom"` hit progress 1 slightly before the true page bottom
  // and then stopped firing onUpdate, freezing the train short of the final
  // station. Lenis emits scroll across the entire range, so the train reaches
  // the last dot. Native `scroll` is the fallback when Lenis isn't running
  // (reduced motion / load failure), where plain scrolling is the baseline.
  const lenis = getLenis();
  if (lenis) {
    lenis.on("scroll", updateTrainByScroll);
  } else {
    window.addEventListener("scroll", updateTrainByScroll, { passive: true });
  }
  window.addEventListener("resize", refreshNavTrack);

  // A `resize` listener only covers the VIEWPORT changing — it never fires when
  // a station's own content reflows TALLER after an interaction: ST3's result +
  // "Kopi talk" comparables appearing on "Value this flat", ST2's detail panel
  // opening, ST5/ST6 expanding. Any such growth pushes every later station down,
  // but the train's cached `sectionTops` and every ScrollTrigger's start/end
  // (including the ST2–ST4 #city-bg backdrop handoff) stay pinned to the old,
  // higher positions — so the train races far ahead and the backdrop fades out
  // early ("runs out of height" before ST4 ends). Observing the body and
  // re-measuring on real height changes is the general fix, so no individual
  // interaction has to remember to call refreshNavTrack itself. Debounced so a
  // 0.9s grid transition settles before we measure, and gated on an actual
  // height delta so refresh()'s own pin-spacer resizing can't feed back into a
  // loop (once the height stops changing, the observer stops scheduling).
  let contentRefreshTimer = null;
  let lastBodyHeight = document.body.offsetHeight;
  const bodyObserver = new ResizeObserver(() => {
    if (Math.abs(document.body.offsetHeight - lastBodyHeight) <= 1) return;
    clearTimeout(contentRefreshTimer);
    contentRefreshTimer = setTimeout(() => {
      refreshNavTrack();
      lastBodyHeight = document.body.offsetHeight;
    }, 150);
  });
  bodyObserver.observe(document.body);

  measureSections();
  updateTrainByScroll();

  // Keyboard nav: up/down/PgUp/PgDn jump to the previous/next station (§7.5).
  document.addEventListener("keydown", (e) => {
    if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(e.key)) return;
    const currentHash = location.hash || stations[0].hash;
    const idx = stations.findIndex((s) => s.hash === currentHash);
    const dir = e.key === "ArrowUp" || e.key === "PageUp" ? -1 : 1;
    const next = stations[Math.min(Math.max(idx + dir, 0), stations.length - 1)];
    if (next) {
      e.preventDefault();
      scrollToTarget(next.hash);
    }
  });

  if (location.hash) {
    scrollToTarget(location.hash, { immediate: true });
  }
}
