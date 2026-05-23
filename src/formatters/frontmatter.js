import yaml from 'js-yaml';

/**
 * Build a frontmatter block as a string (including the `---` fences).
 * Keys with `null`/`undefined` values are dropped — Obsidian shows empty
 * keys as visual noise.
 */
export function frontmatter(obj) {
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    clean[k] = v;
  }
  return '---\n' + yaml.dump(clean, { lineWidth: 120 }) + '---\n';
}
