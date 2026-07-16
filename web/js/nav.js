/**
 * Functional top navigation (S1 version, README_XCH §8 S1 task 4): plain anchor
 * links + IntersectionObserver highlighting + hash sync + keyboard nav. No train
 * marker, no center track, no styling beyond what's needed to prove the wiring
 * works — those are S2/S3 concerns per §7.11.1.
 */
import { stations } from "./state.js";

export function initNav() {
  const nav = document.getElementById("top-nav");
  if (!nav) throw new Error("#top-nav not found in index.html");

  nav.innerHTML = stations
    .map((s) => `<a href="${s.hash}" data-station="${s.id}">${s.name}</a>`)
    .join(" | ");

  const links = new Map(
    [...nav.querySelectorAll("a[data-station]")].map((a) => [a.dataset.station, a])
  );

  function setActive(id) {
    for (const [stationId, link] of links) {
      link.setAttribute("aria-current", stationId === id ? "true" : "false");
    }
  }

  const sections = stations
    .map((s) => document.querySelector(s.hash))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const id = visible.target.id;
        const station = stations.find((s) => s.hash === `#${id}`);
        if (station) {
          setActive(station.id);
          history.replaceState(null, "", station.hash);
        }
      }
    },
    { threshold: [0.5] }
  );
  sections.forEach((sec) => observer.observe(sec));

  // Keyboard nav: up/down/PgUp/PgDn jump to the previous/next station (§7.5).
  document.addEventListener("keydown", (e) => {
    if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(e.key)) return;
    const currentId = stations.find(
      (s) => document.querySelector(s.hash)?.getAttribute("aria-current") === "true"
    )?.id;
    const currentHash = location.hash || stations[0].hash;
    const idx = stations.findIndex((s) => s.hash === currentHash);
    const dir = e.key === "ArrowUp" || e.key === "PageUp" ? -1 : 1;
    const next = stations[Math.min(Math.max(idx + dir, 0), stations.length - 1)];
    if (next) {
      e.preventDefault();
      document.querySelector(next.hash)?.scrollIntoView({ behavior: "smooth" });
    }
  });

  if (location.hash) {
    const target = document.querySelector(location.hash);
    target?.scrollIntoView({ behavior: "auto" });
  }
}
