/**
 * Per-ISO-week Obsidian note with treemap, heatmap, Sankey, and bar chart
 * over all days in the week. Links to each day's note.
 */
import path from 'path';
import { format } from 'date-fns';
import { fetchTimelineCardsRange } from '../data/timeline.js';
import { fetchDayGoals } from '../data/goals.js';
import { categoryBreakdown } from '../aggregators/category.js';
import { appBreakdown, appTransitions } from '../aggregators/apps.js';
import { focusHeatmap } from '../aggregators/heatmap.js';
import { renderTreemap } from '../viz/treemap.js';
import { renderHeatmap } from '../viz/heatmap.js';
import { renderSankey } from '../viz/sankey.js';
import { renderBars } from '../viz/bars.js';
import { frontmatter } from '../formatters/frontmatter.js';
import { dayLink, wikilink } from '../formatters/wikilinks.js';
import { writeIfChanged, readCreatedAt } from '../util/io.js';
import { fmtDuration, fmtHours, slugify } from '../util/time.js';
import { tableCell } from '../util/escape.js';
import { daysInWeek } from '../boundary.js';
import { buildColorMap } from '../util/colors.js';

export async function exportWeeklyNote(db, weekKey, cfg) {
  const dir = path.join(cfg.outputDir, cfg.weeklySubdir);
  const filename = `Dayflow_${weekKey}.md`;
  const filePath = path.join(dir, filename);

  const days = daysInWeek(weekKey);
  const fromDay = days[0];
  const toDay = days[days.length - 1];
  const cards = fetchTimelineCardsRange(db, fromDay, toDay, { includeDeleted: cfg.includeDeleted });

  if (cards.length === 0) return { path: filePath, status: 'no-data' };

  const breakdown = categoryBreakdown(cards);
  const apps = appBreakdown(cards);
  const transitions = appTransitions(cards);
  const heatmap = focusHeatmap(cards, days);

  // Color overrides from any of the week's day_goal_categories.
  const colorOverrides = {};
  for (const d of days) {
    const g = fetchDayGoals(db, d);
    if (!g) continue;
    for (const c of [...g.focusCategories, ...g.distractionCategories]) {
      colorOverrides[c.category_name] = c.category_color_hex;
    }
  }
  const colorMap = buildColorMap(breakdown.categories.map((c) => c.category), colorOverrides);

  const dayLabels = days.map((d) => format(new Date(`${d}T12:00:00`), 'EEE d'));

  const fm = frontmatter({
    dayflow_week: weekKey,
    from: fromDay,
    to: toDay,
    total_minutes: breakdown.totalMinutes,
    total_cards: cards.length,
    categories: breakdown.categories.map((c) => c.category),
    top_apps: apps.slice(0, 5).map((a) => a.app),
    created_at: (await readCreatedAt(filePath)) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [cfg.noteTag, 'weekly', ...breakdown.categories.map((c) => slugify(c.category))],
  });

  const treemap = renderTreemap(
    breakdown.categories.map((c) => ({ name: c.category, value: c.minutes, color: colorMap[c.category] })),
    { title: `Time by category — ${weekKey}` }
  );
  const bars = renderBars(
    breakdown.categories.map((c) => ({ name: c.category, value: c.minutes, color: colorMap[c.category] })),
    { title: 'Category totals' }
  );
  const heatmapSvg = renderHeatmap(heatmap, dayLabels, { title: 'Focus heatmap — minutes per hour' });
  const sankeySvg = renderSankey(transitions, { title: 'App transitions' });

  const body = `
# Dayflow week · ${weekKey}

*${fromDay} → ${toDay}*

## Summary

- ⏱️ ${fmtHours(breakdown.totalMinutes)}h tracked across ${breakdown.categories.length} categories
- 🧠 Top app: **${apps[0]?.app || '—'}** (${fmtDuration(apps[0]?.minutes || 0)})
- 📅 ${days.filter((d) => cards.some((c) => c.day === d)).length} active days

## Treemap

<div class="dayflow-treemap">
${treemap}
</div>

## Category totals

<div class="dayflow-bars">
${bars}
</div>

## Focus heatmap

<div class="dayflow-heatmap">
${heatmapSvg}
</div>

## App transitions

<div class="dayflow-sankey">
${sankeySvg}
</div>

## Top apps

| App | Sessions | Minutes |
| --- | --- | --- |
${apps.slice(0, 15).map((a) => `| ${tableCell(a.app)} | ${a.sessions} | ${a.minutes} |`).join('\n')}

## Categories

${breakdown.categories.map((c) => `- ${wikilink(c.category, { enabled: cfg.categoryWikilinks })} — ${fmtDuration(c.minutes)} (${Math.round(c.pct * 100)}%, ${c.cards} cards)`).join('\n')}

## Days

${days.map((d) => `- ${dayLink(d)}`).join('\n')}
`;

  const md = fm + body;
  const res = await writeIfChanged(filePath, md);
  return { ...res, status: res.written ? (res.created ? 'created' : 'updated') : 'unchanged' };
}
