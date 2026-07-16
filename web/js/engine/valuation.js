/**
 * Loads the precomputed JSON grids (web/static/data/*.json, produced by
 * src/export_frontend_data.py) and answers valuation / SHAP / comparables /
 * town-index / arena / town-meta queries against them. Pure data-layer module,
 * no DOM. Interpolation here is intentionally simple for S1 (nearest categorical
 * match + linear adjustment for lease/area); S2 can refine without changing the
 * function signatures below.
 */

const DATA_DIR = "./static/data";

let cache = null;

/** Fetch and cache all 7 precomputed JSON files. Call once at station init. */
export async function loadAllData() {
  if (cache) return cache;

  const names = [
    "grid_valuation", "shap_local", "lease_curves",
    "town_index", "arena", "comparables", "town_meta",
  ];
  const payloads = await Promise.all(
    names.map((n) => fetch(`${DATA_DIR}/${n}.json`).then((r) => {
      if (!r.ok) throw new Error(`failed to load ${n}.json: HTTP ${r.status}`);
      return r.json();
    }))
  );

  cache = Object.fromEntries(names.map((n, i) => [n, payloads[i]]));

  // Index grid rows by "town|flat_type|storey_range_code" for O(1) exact lookup.
  cache.gridIndex = new Map();
  for (const row of cache.grid_valuation.rows) {
    cache.gridIndex.set(`${row.town}|${row.flat_type}|${row.storey_range_code}`, row);
  }
  cache.shapIndex = new Map();
  for (const row of cache.shap_local.rows) {
    cache.shapIndex.set(`${row.town}|${row.flat_type}|${row.storey_range_code}`, row);
  }
  cache.leaseIndex = new Map();
  for (const row of cache.lease_curves.rows) {
    cache.leaseIndex.set(`${row.town}|${row.flat_type}`, row);
  }

  return cache;
}

function requireCache() {
  if (!cache) throw new Error("valuation data not loaded yet — call loadAllData() first");
  return cache;
}

/** All distinct towns present in the grid, sorted alphabetically. */
export function listTowns() {
  const c = requireCache();
  return [...new Set(c.grid_valuation.rows.map((r) => r.town))].sort();
}

/** All distinct flat types present in the grid, in the grid's natural (label-encoded) order. */
export function listFlatTypes() {
  const c = requireCache();
  return [...new Set(c.grid_valuation.rows.map((r) => r.flat_type))];
}

/** Storey range options available for a given (town, flat_type). */
export function listStoreyOptions(town, flatType) {
  const c = requireCache();
  return c.grid_valuation.rows
    .filter((r) => r.town === town && r.flat_type === flatType)
    .map((r) => ({ code: r.storey_range_code, label: r.storey_range }))
    .sort((a, b) => a.code - b.code);
}

/** Raw base grid row for an exact (town, flat_type, storey_range_code), e.g. to
 * prefill a form with realistic floor_area_sqm / remaining_lease defaults. */
export function queryGridBase({ town, flatType, storeyRangeCode }) {
  const c = requireCache();
  return c.gridIndex.get(`${town}|${flatType}|${storeyRangeCode}`) ?? null;
}

/**
 * Look up a valuation for an exact (town, flat_type, storey_range_code), then
 * adjust for the user's actual remaining_lease and floor_area_sqm.
 *
 * The lease curve (lease_curves.json) is built from a single representative
 * storey per (town, flat_type) — it does not vary by storey. So the lease
 * adjustment must be applied as a *relative* ratio (curve value at the target
 * lease / curve value at the base row's own lease), scaling the storey-specific
 * base price — never as an absolute replacement, which would silently discard
 * the storey signal entirely (a real bug found during S1 manual testing: two
 * different storeys for the same town/flat_type were coming back with almost
 * the same price once a remaining_lease was supplied, even though SHAP shows
 * storey_range_code as a real contributing feature).
 */
export function queryValuation({ town, flatType, storeyRangeCode, floorAreaSqm, remainingLease }) {
  const c = requireCache();
  const base = c.gridIndex.get(`${town}|${flatType}|${storeyRangeCode}`);
  if (!base) return null;

  let { predicted_price: price, q05, q50, q95 } = base;

  if (remainingLease != null && remainingLease !== base.remaining_lease) {
    const curve = c.leaseIndex.get(`${town}|${flatType}`);
    if (curve) {
      const atBase = interpolateLeaseCurve(curve, base.remaining_lease);
      const atTarget = interpolateLeaseCurve(curve, remainingLease);
      if (atBase && atTarget && atBase.predicted_price > 0) {
        const priceRatio = atTarget.predicted_price / atBase.predicted_price;
        const q05Ratio = atBase.q05 > 0 ? atTarget.q05 / atBase.q05 : priceRatio;
        const q95Ratio = atBase.q95 > 0 ? atTarget.q95 / atBase.q95 : priceRatio;
        price *= priceRatio;
        q50 *= priceRatio;
        q05 *= q05Ratio;
        q95 *= q95Ratio;
      }
    }
  }

  if (floorAreaSqm != null && base.floor_area_sqm > 0) {
    const scale = floorAreaSqm / base.floor_area_sqm;
    price *= scale; q05 *= scale; q50 *= scale; q95 *= scale;
  }

  return {
    town, flatType, storeyRangeCode, storeyRange: base.storey_range,
    predictedPrice: Math.round(price), q05: Math.round(q05), q50: Math.round(q50), q95: Math.round(q95),
    baseFloorAreaSqm: base.floor_area_sqm, baseRemainingLease: base.remaining_lease,
  };
}

function interpolateLeaseCurve(curve, remainingLease) {
  const leases = curve.remaining_lease; // descending, e.g. [99, 98, ..., 30]
  if (remainingLease >= leases[0]) return {
    predicted_price: curve.predicted_price[0], q05: curve.q05[0], q95: curve.q95[0],
  };
  const last = leases.length - 1;
  if (remainingLease <= leases[last]) return {
    predicted_price: curve.predicted_price[last], q05: curve.q05[last], q95: curve.q95[last],
  };

  // leases is descending; find the bracketing pair.
  for (let i = 0; i < leases.length - 1; i++) {
    const hi = leases[i], lo = leases[i + 1];
    if (remainingLease <= hi && remainingLease >= lo) {
      const t = hi === lo ? 0 : (hi - remainingLease) / (hi - lo);
      const lerp = (a, b) => a + (b - a) * t;
      return {
        predicted_price: lerp(curve.predicted_price[i], curve.predicted_price[i + 1]),
        q05: lerp(curve.q05[i], curve.q05[i + 1]),
        q95: lerp(curve.q95[i], curve.q95[i + 1]),
      };
    }
  }
  return null;
}

/** Top-6 SHAP contributions for an exact (town, flat_type, storey_range_code). */
export function queryShapTop6({ town, flatType, storeyRangeCode }) {
  const c = requireCache();
  const row = c.shapIndex.get(`${town}|${flatType}|${storeyRangeCode}`);
  return row ? row.top_features : [];
}

/** Raw lease-decay curve for a (town, flat_type), for charting (ST4). */
export function queryLeaseCurve({ town, flatType }) {
  const c = requireCache();
  return c.leaseIndex.get(`${town}|${flatType}`) ?? null;
}

/** Recent comparable transactions for a (town, flat_type). */
export function queryComparables({ town, flatType }) {
  const c = requireCache();
  return c.comparables.groups[`${town}|${flatType}`] ?? [];
}

/** Town x month median real_price series. */
export function queryTownIndex(town) {
  const c = requireCache();
  return c.town_index.towns[town] ?? null;
}

/** Town metadata: region, transaction count, median amenity distances, centroid. */
export function queryTownMeta(town) {
  const c = requireCache();
  return c.town_meta.towns[town] ?? null;
}

/** Full model-arena bundle (6-model metrics, quantile coverage, ablation, global SHAP). */
export function getArena() {
  return requireCache().arena;
}

/**
 * Tier classification per README_XCH §7.9.2: for every town, find the highest
 * flat-type "tier" whose cheapest grid price (across storeys) is within maxPrice.
 * Tiers, in ascending order: none, foothold (1-2 room), cosy (up to 3 room),
 * plenty (4 room and up).
 */
const TIER_FLAT_TYPES = {
  plenty: ["4 ROOM", "5 ROOM", "EXECUTIVE", "MULTI GENERATION"],
  cosy: ["3 ROOM"],
  foothold: ["1 ROOM", "2 ROOM"],
};

export function computeTownAffordability(maxPrice) {
  const c = requireCache();
  const minPriceByTownType = new Map();
  for (const row of c.grid_valuation.rows) {
    const key = `${row.town}|${row.flat_type}`;
    const cur = minPriceByTownType.get(key);
    if (cur == null || row.predicted_price < cur) minPriceByTownType.set(key, row.predicted_price);
  }

  const towns = listTowns();
  return towns.map((town) => {
    const cheapestByTier = {};
    for (const [tier, flatTypes] of Object.entries(TIER_FLAT_TYPES)) {
      const prices = flatTypes
        .map((ft) => minPriceByTownType.get(`${town}|${ft}`))
        .filter((p) => p != null);
      cheapestByTier[tier] = prices.length ? Math.min(...prices) : null;
    }

    let tier = "none";
    if (cheapestByTier.plenty != null && cheapestByTier.plenty <= maxPrice) tier = "plenty";
    else if (cheapestByTier.cosy != null && cheapestByTier.cosy <= maxPrice) tier = "cosy";
    else if (cheapestByTier.foothold != null && cheapestByTier.foothold <= maxPrice) tier = "foothold";

    return { town, tier, cheapestByTier };
  });
}
