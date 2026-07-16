/**
 * "City of Lights" map (README_XCH §7.9.2 / §8 S2 task 6, revised 2026-07-17
 * per XCH: "这个应该是一个新加坡的地图"). The island silhouette is the REAL
 * Singapore coastline — `static/data/sg_boundary.geojson`, sourced from
 * geoBoundaries.org (ODbL 1.0, traceable to data.gov.sg's URA Master Plan
 * boundary), vendored locally like every other static asset so the site stays
 * offline-capable. Town markers are projected from the same real lat/lon in
 * town_meta.json, using the exact same projection as the coastline so they
 * land in their true relative positions — not a hand-picked layout.
 *
 * S2 scope is an instant four-tier lighting toggle + hover tooltip + click-
 * through to ST3; the ripple/window-by-window lighting animation is S3 (§8 S3
 * task 6).
 */
import { listTowns, queryTownMeta } from "./engine/valuation.js";

const VIEW_W = 640;
const VIEW_H = 440;
const PAD = 36;

const TIER_LABELS = {
  plenty: "Plenty of room (4-room+)",
  cosy: "Cosy options (up to 3-room)",
  foothold: "A foothold (1-2 room)",
  none: "Out of reach for now",
};

/** One projection shared by the coastline and the town markers, so both are
 * drawn in the same coordinate space and towns land in their true position
 * relative to the real coastline (fit to the coastline's bounding box, which
 * is larger than the town-centroid bounding box — towns are inland reference
 * points, not the coastline's own extremes). */
function makeProjection(minLat, maxLat, minLon, maxLon) {
  const latRange = maxLat - minLat || 1;
  const lonRange = maxLon - minLon || 1;
  const scale = Math.min((VIEW_W - PAD * 2) / lonRange, (VIEW_H - PAD * 2) / latRange);
  const offsetX = (VIEW_W - lonRange * scale) / 2;
  const offsetY = (VIEW_H - latRange * scale) / 2;
  return (lon, lat) => ({
    x: offsetX + (lon - minLon) * scale,
    // lat increases northward; SVG y increases downward, so flip.
    y: VIEW_H - (offsetY + (lat - minLat) * scale),
  });
}

function ringToPath(ring, project) {
  return ring
    .map(([lon, lat], i) => {
      const { x, y } = project(lon, lat);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ") + " Z";
}

let markers = new Map(); // town -> { g, circle, tier, x, y }
let tooltipEl = null;
let onSelectTownCb = null;

export async function renderMap(container) {
  const towns = listTowns().map((name) => ({ name, ...queryTownMeta(name) }));
  const boundary = await fetch("./static/data/sg_boundary.geojson").then((r) => r.json());

  const polygons = boundary.features[0].geometry.coordinates; // MultiPolygon
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const poly of polygons) {
    for (const [lon, lat] of poly[0]) {
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
    }
  }
  const project = makeProjection(minLat, maxLat, minLon, maxLon);
  const islandPaths = polygons.map((poly) => ringToPath(poly[0], project));
  const projectedTowns = towns.map((t) => ({ ...t, ...project(t.lon, t.lat) }));

  container.innerHTML = `
    <div class="map-wrap">
      <svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" class="city-of-lights" role="img"
           aria-label="Map of Singapore's real coastline, with its 27 HDB towns lit up by affordability tier">
        ${islandPaths.map((d) => `<path class="island" d="${d}"></path>`).join("")}
        <g id="map-markers"></g>
      </svg>
      <div class="map-tooltip glass" id="map-tooltip" hidden></div>
      <ul class="map-legend">
        <li><span class="map-legend-dot tier-plenty"></span>Plenty of room (4-room+)</li>
        <li><span class="map-legend-dot tier-cosy"></span>Cosy options (up to 3-room)</li>
        <li><span class="map-legend-dot tier-foothold"></span>A foothold (1-2 room)</li>
        <li><span class="map-legend-dot tier-none"></span>Out of reach for now</li>
      </ul>
    </div>
  `;

  tooltipEl = container.querySelector("#map-tooltip");
  const markersG = container.querySelector("#map-markers");
  markers = new Map();

  for (const t of projectedTowns) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "map-marker tier-none");
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", `${t.name}: no budget entered yet`);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", t.x);
    circle.setAttribute("cy", t.y);
    circle.setAttribute("r", 6);
    g.appendChild(circle);

    const showTip = () => showTooltip(t);
    g.addEventListener("mouseenter", showTip);
    g.addEventListener("focus", showTip);
    g.addEventListener("mouseleave", hideTooltip);
    g.addEventListener("blur", hideTooltip);
    g.addEventListener("click", () => onSelectTownCb?.(t.name));
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelectTownCb?.(t.name);
      }
    });

    markersG.appendChild(g);
    markers.set(t.name, { g, circle, tier: "none", x: t.x, y: t.y });
  }
}

function showTooltip(town) {
  const m = markers.get(town.name);
  if (!tooltipEl || !m) return;
  tooltipEl.innerHTML = `
    <strong>${town.name}</strong><br/>
    <span>${TIER_LABELS[m.tier]}</span>
  `;
  const pct = (v, max) => `${(v / max) * 100}%`;
  tooltipEl.style.left = pct(town.x, VIEW_W);
  tooltipEl.style.top = pct(town.y, VIEW_H);
  tooltipEl.hidden = false;
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.hidden = true;
}

/** Called after computeTownAffordability() runs (README_XCH §7.9.2 four-tier
 * lighting). S2: instant class swap, no ripple/stagger — that is §8 S3 task 6. */
export function updateMapTiers(tiers) {
  for (const { town, tier } of tiers) {
    const m = markers.get(town);
    if (!m) continue;
    m.g.classList.remove("tier-plenty", "tier-cosy", "tier-foothold", "tier-none");
    m.g.classList.add(`tier-${tier}`);
    m.tier = tier;
    m.g.setAttribute("aria-label", `${town}: ${TIER_LABELS[tier]}`);
  }
}

export function onMapTownSelect(cb) {
  onSelectTownCb = cb;
}

/** Cross-station link the other direction (ST3 comparables card "View on map"
 * per §7.12): briefly highlight the marker so the click-through reads as a
 * real jump, not just a scroll. */
export function highlightTown(town) {
  const m = markers.get(town);
  if (!m) return;
  m.g.classList.add("is-highlighted");
  setTimeout(() => m.g.classList.remove("is-highlighted"), 1600);
}
