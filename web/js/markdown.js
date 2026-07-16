/**
 * Minimal markdown -> HTML renderer for ST7's generated report (README_XCH §7.9.5).
 * XCH's ask (2026-07-17): the report should look designed, not be a raw
 * unrendered markdown dump in a <pre>. This only needs to support the exact
 * subset TemplateProvider.generate() actually produces — "## N. Title"
 * headings, "- " bullet lists, "**bold**" spans, and plain paragraphs — it is
 * not a general-purpose markdown parser. All input is our own template
 * output (no user-supplied markdown ever reaches this), so escaping is a
 * belt-and-suspenders measure, not a hard security requirement.
 */

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/** Renders one "## N. Title" section (heading + following lines) into a
 * `<div class="report-section">` (deliberately not a bare `<section>` — that
 * tag collides with the global `section { min-height: 100dvh }` rule meant
 * for the 8 top-level stations), with the leading number pulled out into a
 * badge rather than left inline in the heading text. */
function renderSection(headingLine, bodyLines) {
  const match = headingLine.match(/^##\s*(?:(\d+)\.\s*)?(.+)$/);
  const number = match?.[1];
  const title = match ? match[2] : headingLine.replace(/^##\s*/, "");

  const blocks = [];
  let listBuffer = [];
  let paraBuffer = [];
  const flushList = () => {
    if (listBuffer.length) {
      blocks.push(`<ul>${listBuffer.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`);
      listBuffer = [];
    }
  };
  const flushPara = () => {
    if (paraBuffer.length) {
      blocks.push(`<p>${inline(paraBuffer.join(" "))}</p>`);
      paraBuffer = [];
    }
  };

  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      flushPara();
      continue;
    }
    if (trimmed.startsWith("- ")) {
      flushPara();
      listBuffer.push(trimmed.slice(2));
    } else {
      flushList();
      paraBuffer.push(trimmed);
    }
  }
  flushList();
  flushPara();

  return `
    <div class="report-section">
      <h3>${number ? `<span class="report-section-num">${number}</span>` : ""}${inline(title)}</h3>
      ${blocks.join("")}
    </div>
  `;
}

export function renderMarkdown(markdown) {
  const lines = markdown.split("\n");
  const sections = [];
  let currentHeading = null;
  let currentBody = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentHeading) sections.push(renderSection(currentHeading, currentBody));
      currentHeading = line;
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentHeading) sections.push(renderSection(currentHeading, currentBody));

  return sections.join("");
}
