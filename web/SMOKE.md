# S1 Smoke Test

Manual walkthrough for the S1 skeleton (README_XCH.md §8 S1). Run via Live Server or
`python -m http.server` from `web/`, then open `index.html`. No build step, no backend
server — if this doesn't work offline, something in S1 is broken.

Prerequisite: `python src/export_frontend_data.py` (from the `HDBrain` repo root, in the
`HDBrain` conda env) has been run at least once, so `web/static/data/*.json` exist.

## 0. Load check

- [ ] Open `web/index.html`. No console errors except the harmless `favicon.ico 404`
      (no favicon yet — that's an S5 polish item).
- [ ] Top nav shows exactly 8 links (ST0-ST7).
- [ ] Clicking a nav link jumps to that section; the URL hash updates; scrolling updates
      which nav link has `aria-current="true"`.
- [ ] Up/Down/PageUp/PageDown keys jump between stations.

## 1. Parity test

- [ ] Open `web/parity_test.html`. Must show **15/15 passed** (mirrors the 15 pytest
      functions in `HDBrain/tests/test_affordability.py`). Any red line means the JS
      engine (`js/engine/affordability.js`) has drifted from the Python source
      (`src/affordability/calculator.py` + `user_profile.py`) — fix before proceeding.

## 2. Wei Ling walkthrough (IDEA5 narrative script)

Scenario: a household with S$8,000/month income, S$60,000 cash savings, no CPF, no
existing debt, HDB loan, evaluating an ANG MO KIO 4-room flat.

**ST2 Budget Stop**

1. Enter monthly income `8000`, cash savings `60000`, leave the rest at defaults, submit.
2. Expected: **Maximum affordable price: S$228,889** (this is lower than the
   loan-only-bound S$705,359 documented in README_XCH §4.9, because the S$60,000 cash
   savings caps the upfront budget well below what the mortgage alone would allow — this
   is the cash-savings constraint from PR #4, working as intended).
3. All 27 towns should show "Out of reach for now" at this income/savings level (expected:
   S$228,889 is below the cheapest grid price for every flat type on the island).
4. Try cash savings `250000` instead: several towns should now show a tier better than
   "Out of reach for now" for smaller flat types.

**ST3 Valuation Stop**

1. Leave defaults (ANG MO KIO, 1 ROOM) or pick any town/flat type — floor area and
   remaining lease auto-fill from the grid's representative row for that group (don't
   leave them at some arbitrary fixed number; a 1-ROOM flat and an EXECUTIVE flat have
   very different realistic floor areas).
2. Submit. Expect a point estimate, a 90% interval where q05 < estimate < q95, a list of
   6 SHAP features, and (if available) up to 20 recent comparable transactions.
3. The disclosure line above the form ("Estimates are based on training data up to
   2023...") must be visible.

**ST4 Time Stop**

1. Pick a town/flat type, then hover along the lease-decay curve (the slider was removed
   2026-07-18 — hovering is the interaction now). The "At N years remaining" note below
   the chart must update live as the pointer moves.

**ST5 Lookout**

1. Switch the town selector; the line chart must redraw for the new town.
2. The ranking table lists towns by latest median price, descending.

**ST6 Arena**

1. Switch the metric tabs (RMSE / MAE / R² / Median APE); the bar chart must redraw.
2. Quantile coverage, ablation, and global SHAP tables must all be populated (not empty).

**ST7 Home**

1. Click "Generate my report". The report must include: the budget from step ST2, the
   town tiers, any valuations viewed in ST3, the lease experiment from ST4, an arena
   snapshot, and the fixed "How to read this report" disclosures.

## 3. Real-transaction anchors (model sanity check)

These are 5 real, randomly sampled 2025 transactions (`data/processed/hdb_resale_model_dataset.csv`,
`random_state=7`), run through the live app's ST3 form. The app is grid + interpolation
based (not per-transaction), so these are **ballpark checks**, not exact-match checks —
what matters is that the app's estimate lands in the same underestimate band documented
in README_XCH §4.4/§4.8 (roughly 8-16% below actual for 2025 sales), not that it matches
to the dollar.

Verified via a headless-browser run against this exact build (2026-07-16):

| Month | Town | Flat type | Storey | Area | Lease | Actual | App estimate | Diff |
|---|---|---|---|---|---|---|---|---|
| 2025-03 | PUNGGOL | 5 ROOM | 10 TO 12 | 110 sqm | 77.0y | S$660,888 | S$606,331 | -8.3% |
| 2025-07 | CHOA CHU KANG | 5 ROOM | 16 TO 18 | 110 sqm | 76.8y | S$600,000 | S$549,828 | -8.4% |
| 2025-07 | TAMPINES | 4 ROOM | 01 TO 03 | 103 sqm | 69.8y | S$620,000 | S$535,204 | -13.7% |
| 2025-09 | TAMPINES | EXECUTIVE | 01 TO 03 | 149 sqm | 62.4y | S$1,000,000 | S$826,870 | -17.3% |
| 2025-12 | TAMPINES | 5 ROOM | 07 TO 09 | 121 sqm | 62.4y | S$740,000 | S$639,561 | -13.6% |

(Updated 2026-07-17 after fixing a real bug in `queryValuation()`: the lease-curve
adjustment used to *replace* the storey-specific base price outright, which silently
discarded the storey signal — two different storeys for the same town/flat type came
back nearly identical once a remaining_lease was supplied. Fixed to apply the lease
adjustment as a *ratio* on top of the storey-specific base price instead. See the git
diff on `js/engine/valuation.js` for the exact change; numbers above are post-fix.)

All 5 land in the -8% to -17% band — consistent with the documented systematic
underestimate, not a sign of a broken pipeline. If a re-run of this table produces wildly
different numbers (e.g. positive, or beyond -30%), re-check the model files and the
export script before blaming the model.

**To reproduce**: enter each row's town/flat type/storey/area/lease into the ST3 form and
compare the "Estimated price" to the actual column above.

## 4. Known gotcha (fixed, keep this here so it doesn't regress)

`<input type="number">` defaults to `step="1"`; without an explicit `step="any"`, a
decimal value (e.g. `remaining_lease = 69.8`) fails native browser validation and
`form.requestSubmit()` silently does nothing — no console error, no visible feedback in
a scripted/headless context. Both `floorAreaSqm` and `remainingLease` in `st3.js` must
keep `step="any"`. This was caught during S1 headless-browser testing (five real
transactions all have decimal remaining_lease values) and is exactly the kind of bug that
never shows up if you only ever type whole numbers in by hand.
