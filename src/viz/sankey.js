/**
 * Simple two-column Sankey: source app -> target app, link width = count.
 *
 * Not a full multi-stage Sankey — Dayflow's flow is pairwise transitions
 * so we render it as a two-column flow diagram which is sufficient and
 * compact for an Obsidian preview.
 */
import { xml } from '../util/escape.js';
import { colorFor } from '../util/colors.js';

const W = 720;
const H = 460;
const PAD = 24;
const NODE_W = 14;
const MAX_NODES = 10;

export function renderSankey(transitions, opts = {}) {
  const { title = 'App transitions' } = opts;
  if (!transitions || transitions.length === 0) {
    return empty(title, 'No transitions recorded');
  }

  // Aggregate per-node totals to rank and trim.
  const sources = new Map();
  const targets = new Map();
  for (const t of transitions) {
    sources.set(t.source, (sources.get(t.source) || 0) + t.count);
    targets.set(t.target, (targets.get(t.target) || 0) + t.count);
  }
  const topSources = topKeys(sources, MAX_NODES);
  const topTargets = topKeys(targets, MAX_NODES);
  const filtered = transitions.filter(
    (t) => topSources.includes(t.source) && topTargets.includes(t.target)
  );
  if (filtered.length === 0) return empty(title, 'No transitions in top apps');

  const leftX = PAD;
  const rightX = W - PAD - NODE_W;
  const totalLeft = topSources.reduce((s, k) => s + sources.get(k), 0);
  const totalRight = topTargets.reduce((s, k) => s + targets.get(k), 0);

  const leftYs = layoutColumn(topSources, sources, totalLeft);
  const rightYs = layoutColumn(topTargets, targets, totalRight);

  const links = filtered
    .map((t) => {
      const sy = leftYs.get(t.source);
      const ty = rightYs.get(t.target);
      const w = Math.max(1, (t.count / Math.max(totalLeft, totalRight)) * (H - 2 * PAD));
      const sMid = sy.y + sy.h / 2;
      const tMid = ty.y + ty.h / 2;
      const c1x = leftX + NODE_W + (rightX - leftX - NODE_W) * 0.4;
      const c2x = leftX + NODE_W + (rightX - leftX - NODE_W) * 0.6;
      const color = colorFor(t.source);
      return `<path d="M ${leftX + NODE_W} ${sMid} C ${c1x} ${sMid}, ${c2x} ${tMid}, ${rightX} ${tMid}" stroke="${color}" stroke-opacity="0.35" stroke-width="${w}" fill="none"><title>${xml(t.source)} → ${xml(t.target)} (${t.count})</title></path>`;
    })
    .join('');

  const leftNodes = renderNodes(topSources, sources, leftYs, leftX, 'end', -8);
  const rightNodes = renderNodes(topTargets, targets, rightYs, rightX, 'start', NODE_W + 8);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="App transitions Sankey"><text x="${PAD}" y="18" font-family="-apple-system, system-ui, sans-serif" font-size="14" font-weight="600" fill="#1f2937">${xml(title)}</text>${links}${leftNodes}${rightNodes}</svg>`;
}

function topKeys(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

function layoutColumn(keys, totals, total) {
  const avail = H - 2 * PAD;
  const gap = 4;
  const usable = avail - gap * (keys.length - 1);
  const positions = new Map();
  let y = PAD + 8;
  for (const k of keys) {
    const h = Math.max(8, (totals.get(k) / total) * usable);
    positions.set(k, { y, h });
    y += h + gap;
  }
  return positions;
}

function renderNodes(keys, totals, yMap, x, anchor, labelOffset) {
  return keys
    .map((k) => {
      const { y, h } = yMap.get(k);
      const color = colorFor(k);
      const labelX = anchor === 'end' ? x + labelOffset : x + labelOffset;
      return `<g><rect x="${x}" y="${y}" width="${NODE_W}" height="${h}" rx="2" fill="${color}"></rect><text x="${labelX}" y="${y + h / 2 + 4}" text-anchor="${anchor}" fill="#1f2937" font-family="-apple-system, system-ui, sans-serif" font-size="11">${xml(k)} (${totals.get(k)})</text></g>`;
    })
    .join('');
}

function empty(title, msg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%"><text x="${PAD}" y="18" font-family="-apple-system, system-ui, sans-serif" font-size="14" font-weight="600" fill="#1f2937">${xml(title)}</text><text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#9ca3af" font-family="-apple-system, system-ui, sans-serif" font-size="14">${xml(msg)}</text></svg>`;
}
