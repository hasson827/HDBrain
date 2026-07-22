/**
 * Vanilla "glass surface" — reduced to a single class toggle (README §7.6).
 * Originally a port of React Bits' <GlassSurface /> with a per-element SVG
 * feDisplacementMap refraction filter, but that Chrome-only filter recomputed
 * on every scroll frame and caused visible jank, so per XCH (2026-07-18) every
 * glass module now uses one unified frosted look (backdrop-filter blur, defined
 * by `.glass-surface` in css/stations.css). All this helper does is add that
 * class to a dynamically-rendered module; static markup can add the class
 * directly instead.
 */
export function applyGlassSurface(el) {
  if (!el) return;
  el.classList.add("glass-surface");
}
