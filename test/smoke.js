#!/usr/bin/env node
/**
 * Smoke test: exercises the boundary math, color hashing, and SVG
 * generators with synthetic data. Run with `node test/smoke.js`.
 *
 * Not a full test suite — just enough to catch a broken build at install
 * time before pointing at a live Dayflow DB.
 */
import assert from 'node:assert/strict';
import { getDayInfo, lastNDays, isoWeekKey, daysInWeek } from '../src/boundary.js';
import { colorFor } from '../src/util/colors.js';
import { fmtDuration, slugify } from '../src/util/time.js';
import { renderTreemap } from '../src/viz/treemap.js';
import { renderHeatmap } from '../src/viz/heatmap.js';
import { renderSankey } from '../src/viz/sankey.js';
import { renderBars } from '../src/viz/bars.js';
import { categoryBreakdown } from '../src/aggregators/category.js';
import { appBreakdown, appTransitions } from '../src/aggregators/apps.js';
import { focusHeatmap } from '../src/aggregators/heatmap.js';

let passed = 0;
function ok(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('Boundary math:');
ok('4 AM boundary moves 02:00 to previous day', () => {
  const info = getDayInfo(new Date('2026-05-21T02:00:00'));
  assert.equal(info.dayString, '2026-05-20');
});
ok('4 AM boundary keeps 10:00 in same day', () => {
  const info = getDayInfo(new Date('2026-05-21T10:00:00'));
  assert.equal(info.dayString, '2026-05-21');
});
ok('lastNDays returns unique sorted days', () => {
  const ds = lastNDays(3);
  assert.equal(ds.length, 3);
  assert.equal(new Set(ds).size, 3);
});
ok('isoWeekKey returns YYYY-Www format', () => {
  const k = isoWeekKey('2026-01-05');
  assert.match(k, /^\d{4}-W\d{2}$/);
});
ok('daysInWeek returns 7 days', () => {
  const days = daysInWeek('2026-W20');
  assert.equal(days.length, 7);
  for (const d of days) assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
});

console.log('\nUtilities:');
ok('colorFor is stable for same name', () => {
  assert.equal(colorFor('Work'), colorFor('Work'));
});
ok('colorFor accepts hex override', () => {
  assert.equal(colorFor('Work', '#ff0000'), '#ff0000');
});
ok('fmtDuration formats hours and minutes', () => {
  assert.equal(fmtDuration(0), '<1m');
  assert.equal(fmtDuration(45), '45m');
  assert.equal(fmtDuration(60), '1h');
  assert.equal(fmtDuration(125), '2h 5m');
});
ok('slugify handles caps and punctuation', () => {
  assert.equal(slugify('Deep Work!'), 'deep-work');
});

console.log('\nAggregators:');
const fakeCards = [
  { start_ts: 1700000000, end_ts: 1700003600, category: 'Work', subcategory: 'Dev', day: '2023-11-14', appPrimary: 'VS Code', appSecondary: 'Chrome', distractions: [] },
  { start_ts: 1700003600, end_ts: 1700007200, category: 'Personal', subcategory: null, day: '2023-11-14', appPrimary: 'Chrome', appSecondary: null, distractions: [] },
  { start_ts: 1700007200, end_ts: 1700010800, category: 'Work', subcategory: 'Review', day: '2023-11-14', appPrimary: 'Chrome', appSecondary: null, distractions: [] },
];
ok('categoryBreakdown sums and percentages', () => {
  const b = categoryBreakdown(fakeCards);
  assert.equal(b.totalMinutes, 180);
  assert.equal(b.categories[0].category, 'Work');
  assert.equal(b.categories[0].minutes, 120);
  assert.equal(Math.round(b.categories[0].pct * 100), 67);
});
ok('appBreakdown counts sessions and minutes', () => {
  const a = appBreakdown(fakeCards);
  assert.ok(a.some((x) => x.app === 'Chrome'));
});
ok('appTransitions detects A→B pairs', () => {
  const t = appTransitions(fakeCards);
  // VS Code -> Chrome happens, Chrome -> Chrome is skipped (same app)
  assert.ok(t.some((p) => p.source === 'VS Code' && p.target === 'Chrome'));
});
ok('focusHeatmap returns 24-col grid per day', () => {
  const grid = focusHeatmap(fakeCards, ['2023-11-14']);
  assert.equal(grid.length, 1);
  assert.equal(grid[0].length, 24);
});

console.log('\nViz (output is valid SVG):');
ok('renderTreemap returns <svg>', () => {
  const svg = renderTreemap([{ name: 'Work', value: 100 }, { name: 'Play', value: 50 }]);
  assert.match(svg, /^<svg /);
  assert.match(svg, /<\/svg>$/);
});
ok('renderTreemap handles empty input', () => {
  const svg = renderTreemap([]);
  assert.match(svg, /^<svg /);
});
ok('renderHeatmap returns <svg>', () => {
  const svg = renderHeatmap([[1, 2, 3, ...new Array(21).fill(0)]], ['Mon']);
  assert.match(svg, /^<svg /);
});
ok('renderSankey returns <svg>', () => {
  const svg = renderSankey([{ source: 'A', target: 'B', count: 3 }]);
  assert.match(svg, /^<svg /);
});
ok('renderBars returns <svg>', () => {
  const svg = renderBars([{ name: 'Work', value: 100 }]);
  assert.match(svg, /^<svg /);
});

console.log(`\n${passed} tests passed.`);
