/**
 * Stable, hash-based color assignment for category names.
 *
 * If a `day_goal_categories` row gave us an explicit hex, prefer that.
 * Otherwise pick from a curated, color-blind-aware palette via a hash.
 */
const PALETTE = [
  '#4F46E5', // indigo-600
  '#0EA5E9', // sky-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#14B8A6', // teal-500
  '#F97316', // orange-500
  '#84CC16', // lime-500
  '#06B6D4', // cyan-500
  '#A855F7', // purple-500
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function colorFor(name, override = null) {
  if (override && /^#[0-9a-fA-F]{6}$/.test(override)) return override;
  if (!name) return PALETTE[0];
  return PALETTE[hash(name) % PALETTE.length];
}

export function buildColorMap(categories, overrides = {}) {
  const map = {};
  for (const cat of categories) {
    map[cat] = colorFor(cat, overrides[cat]);
  }
  return map;
}
