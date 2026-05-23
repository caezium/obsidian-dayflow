import { wikilinkSafe } from '../util/escape.js';

/**
 * Render a name as an Obsidian wikilink ([[Name]]) unless wikilinks are
 * disabled, in which case fall back to the bare name.
 */
export function wikilink(name, { enabled = true } = {}) {
  if (!name) return '';
  if (!enabled) return String(name);
  return `[[${wikilinkSafe(name)}]]`;
}

export function dayLink(dayString) {
  return `[[Dayflow_${dayString}|${dayString}]]`;
}

export function weekLink(weekKey) {
  return `[[Dayflow_${weekKey}|${weekKey}]]`;
}
