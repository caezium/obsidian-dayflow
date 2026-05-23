/**
 * Escaping for SVG and markdown contexts.
 *
 * These are strict — we treat all DB content as untrusted (it came from an
 * LLM) and the resulting markdown will be read inside Obsidian's HTML
 * preview.
 */
const XML_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function xml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => XML_MAP[c]);
}

// Escape pipe + backslash for markdown table cells
export function tableCell(s) {
  if (s == null) return '';
  return String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

// Strip wikilink-breaking chars from a wikilink target.
export function wikilinkSafe(s) {
  if (s == null) return '';
  return String(s).replace(/[\[\]|#^]/g, '');
}
