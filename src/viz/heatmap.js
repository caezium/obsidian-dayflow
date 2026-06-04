/**
 * Focus heatmap: rows = days, cols = hours (0..23).
 * grid is a 2D array of minutes (0..60) at [dayIdx][hour].
 *
 * The markdown `## Focus heatmap` heading labels the chart, so we omit
 * the redundant title inside the SVG and use the top margin for breathing
 * room instead.
 */
import { xml } from '../util/escape.js';

const CELL = 22;
const PAD_LEFT = 64;
const PAD_TOP = 22;
const PAD_BOTTOM = 16;
const PAD_RIGHT = 16;
const COLOR_LOW = [241, 245, 249];     // slate-100
const COLOR_HIGH = [79, 70, 229];      // indigo-600

export function renderHeatmap(grid, dayLabels, _opts = {}) {
  const rows = grid.length;
  const cols = 24;
  const max = Math.max(1, ...grid.flat());
  const w = PAD_LEFT + cols * CELL + PAD_RIGHT;
  const h = PAD_TOP + rows * CELL + PAD_BOTTOM;

  const headers = Array.from({ length: cols }, (_, hour) => {
    if (hour % 3 !== 0 && hour !== 23) return '';
    const x = PAD_LEFT + hour * CELL + CELL / 2;
    return `<text x="${x}" y="${PAD_TOP - 6}" text-anchor="middle" fill="currentColor" opacity="0.6" font-family="-apple-system, system-ui, sans-serif" font-size="10">${hour}</text>`;
  }).join('');

  const rowSvgs = grid.map((row, i) => {
    const yLabel = `<text x="${PAD_LEFT - 8}" y="${PAD_TOP + i * CELL + CELL * 0.7}" text-anchor="end" fill="currentColor" font-family="-apple-system, system-ui, sans-serif" font-size="11">${xml(dayLabels[i])}</text>`;
    const cells = row
      .map((v, hour) => {
        const intensity = v / max;
        const color = lerpColor(COLOR_LOW, COLOR_HIGH, intensity);
        const x = PAD_LEFT + hour * CELL;
        const y = PAD_TOP + i * CELL;
        return `<rect x="${x + 1}" y="${y + 1}" width="${CELL - 2}" height="${CELL - 2}" rx="3" fill="${color}"><title>${xml(dayLabels[i])} ${hour}:00 — ${v} min</title></rect>`;
      })
      .join('');
    return yLabel + cells;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Focus heatmap">${headers}${rowSvgs}</svg>`;
}

function lerpColor(a, b, t) {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * Math.min(1, Math.max(0, t))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
