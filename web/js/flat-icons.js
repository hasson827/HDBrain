/**
 * Six flat-model silhouette icons (README_XCH §7.12, corrected to 6 categories:
 * Model A / Standard / New Generation / Apartment / Maisonette / Special).
 * Flat, line-art, single stroke color (currentColor) — schematic diagrams of a
 * building shape, not photos or realistic illustrations, per the "Responsible
 * AI" framing in §7.12 ("these are not photos of the actual unit").
 */

const PATHS = {
  "Model A": `
    <rect x="16" y="18" width="32" height="36" rx="1"/>
    <path d="M14 18 H50" />
    <path d="M20 26h6v6h-6zM29 26h6v6h-6zM38 26h6v6h-6z" />
    <path d="M20 36h6v6h-6zM29 36h6v6h-6zM38 36h6v6h-6z" />
    <path d="M28 54v-8h8v8" />
  `,
  Standard: `
    <rect x="13" y="22" width="38" height="32" rx="1"/>
    <path d="M11 22 H53" />
    <path d="M19 29h7v7h-7zM38 29h7v7h-7z" />
    <path d="M19 42h7v7h-7zM38 42h7v7h-7z" />
  `,
  "New Generation": `
    <path d="M16 30 L16 54 L48 54 L48 30 L40 30 L40 20 L24 20 L24 30 Z" />
    <path d="M20 36h5v5h-5zM29 36h6v5h-6zM39 36h5v5h-5z" />
    <path d="M20 45h5v5h-5zM29 45h6v5h-6zM39 45h5v5h-5z" />
  `,
  Apartment: `
    <rect x="22" y="10" width="20" height="44" rx="1"/>
    <path d="M22 10 H42" />
    <path d="M26 17h4v4h-4zM34 17h4v4h-4z" />
    <path d="M26 25h4v4h-4zM34 25h4v4h-4z" />
    <path d="M26 33h4v4h-4zM34 33h4v4h-4z" />
    <path d="M26 41h4v4h-4zM34 41h4v4h-4z" />
    <path d="M17 22 H22 M17 22 V50 M42 30 H47 M47 30 V50" />
  `,
  Maisonette: `
    <path d="M14 40 L14 54 L32 54 L32 24 L50 24 L50 54" />
    <path d="M14 40 H32" />
    <path d="M18 45h6v5h-6zM24 45h0" />
    <path d="M36 30h6v6h-6zM36 40h6v6h-6z" />
    <path d="M14 40 L14 30 L22 30" />
  `,
  Special: `
    <path d="M14 54 V32 L32 18 L50 32 V54 Z" />
    <path d="M14 54 H50" />
    <path d="M26 54 V40 h12 v14" />
    <path d="M20 34h4v4h-4zM40 34h4v4h-4z" />
  `,
};

export const FLAT_MODEL_GROUPS = Object.keys(PATHS);

export function flatIconSvg(group, className = "flat-icon") {
  const inner = PATHS[group] ?? PATHS.Standard;
  return `<svg class="${className}" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;
}
