/**
 * Human-readable labels for the model's raw feature-column names (the 29-column
 * vector documented in docs/data_processing.md §3.7). The JSON exports carry the
 * raw names (`floor_area_sqm`, `dist_dhoby`, `model_Apartment`, ...) because they
 * are the data contract with the Python side — this module is the one place that
 * translates them for display (ST3's SHAP bars, ST6's global-importance table).
 * Unknown names fall through unchanged so a future new feature is shown raw
 * rather than hidden.
 */

const EXACT = {
  year: "Transaction year",
  floor_area_sqm: "Floor area",
  flat_type_code: "Flat type",
  storey_range_code: "Storey (floor level)",
  remaining_lease: "Remaining lease",
  dist_dhoby: "Distance to city centre",
  month_sin: "Month of year (seasonality)",
  month_cos: "Month of year (seasonality)",
};

// Amenity keys shared by the `*_dist` and `num_*_2km` column families.
const AMENITY = {
  mrt: "MRT station",
  hawker: "hawker centre",
  mall: "shopping mall",
  school: "school",
  park: "park",
  supermarket: "supermarket",
};

export function featureLabel(feature) {
  if (EXACT[feature]) return EXACT[feature];

  let m = feature.match(/^(\w+)_dist$/);
  if (m && AMENITY[m[1]]) return `Distance to nearest ${AMENITY[m[1]]}`;

  m = feature.match(/^num_(\w+)_2km$/);
  if (m && AMENITY[m[1]]) return `${capitalize(AMENITY[m[1]])}s within 2 km`;

  m = feature.match(/^region_(.+)$/);
  if (m) return `Region: ${m[1]}`;

  m = feature.match(/^model_(.+)$/);
  if (m) return `Flat model: ${m[1]}`;

  return feature;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
