/**
 * Per-day Obsidian note. Pulls every relevant table, generates frontmatter
 * with tags + category wikilinks, then a structured body covering:
 *
 *   1. Daily summary + goal progress
 *   2. Standup (highlights / tasks / blockers)
 *   3. Journal (intentions / goals / notes)
 *   4. Timeline cards (each with app, duration, ratings if any)
 *   5. Distractions log
 *   6. App usage table
 *   7. Reflections + AI summary
 *   8. Per-day treemap (inline SVG)
 */
import path from 'path';
import { fetchTimelineCards } from '../data/timeline.js';
import { fetchJournalEntry } from '../data/journal.js';
import { fetchStandup } from '../data/standup.js';
import { fetchDayGoals } from '../data/goals.js';
import { fetchRatings } from '../data/ratings.js';
import { categoryBreakdown } from '../aggregators/category.js';
import { appBreakdown } from '../aggregators/apps.js';
import { goalProgress } from '../aggregators/goals.js';
import { renderTreemap } from '../viz/treemap.js';
import { frontmatter } from '../formatters/frontmatter.js';
import { wikilink, weekLink } from '../formatters/wikilinks.js';
import { writeIfChanged, readCreatedAt } from '../util/io.js';
import { fmtDuration, fmtHours, slugify } from '../util/time.js';
import { tableCell } from '../util/escape.js';
import { isoWeekKey, isDayComplete } from '../boundary.js';
import { buildColorMap } from '../util/colors.js';
import { format } from 'date-fns';

export async function exportDailyNote(db, dayString, cfg) {
  const dir = path.join(cfg.outputDir, cfg.dailySubdir);
  const filename = `Dayflow_${dayString}.md`;
  const filePath = path.join(dir, filename);

  if (!cfg.force && isDayComplete(dayString)) {
    const existingCreated = await readCreatedAt(filePath);
    if (existingCreated) {
      // Day is complete and we already wrote the note — skip unless --force.
      return { path: filePath, status: 'skipped-complete' };
    }
  }

  const cards = fetchTimelineCards(db, dayString, { includeDeleted: cfg.includeDeleted });
  const journal = fetchJournalEntry(db, dayString);
  const standup = fetchStandup(db, dayString);
  const goals = fetchDayGoals(db, dayString);
  const ratings = fetchRatings(db, dayString);

  if (cards.length === 0 && !journal && !standup && !goals) {
    return { path: filePath, status: 'no-data' };
  }

  const breakdown = categoryBreakdown(cards);
  const apps = appBreakdown(cards);
  const goalProg = goalProgress(cards, goals);

  // Color overrides from day_goal_categories (focus categories get app-defined colors).
  const colorOverrides = {};
  if (goals) {
    for (const c of [...goals.focusCategories, ...goals.distractionCategories]) {
      colorOverrides[c.category_name] = c.category_color_hex;
    }
  }
  const colorMap = buildColorMap(breakdown.categories.map((c) => c.category), colorOverrides);

  const fm = frontmatter({
    dayflow_day: dayString,
    week: isoWeekKey(dayString),
    day_boundary: '4am',
    total_minutes: breakdown.totalMinutes,
    total_cards: cards.length,
    categories: breakdown.categories.map((c) => c.category),
    top_apps: apps.slice(0, 5).map((a) => a.app),
    focus_target_minutes: goalProg?.focusTargetMinutes ?? null,
    focus_actual_minutes: goalProg?.focusActualMinutes ?? null,
    focus_pct: goalProg?.focusPct != null ? Number((goalProg.focusPct * 100).toFixed(0)) : null,
    distraction_limit_minutes: goalProg?.distractionLimitMinutes ?? null,
    distraction_actual_minutes: goalProg?.distractionActualMinutes ?? null,
    has_journal: Boolean(journal),
    journal_status: journal?.status ?? null,
    has_standup: Boolean(standup),
    ratings_count: ratings.length,
    created_at: (await readCreatedAt(filePath)) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [cfg.noteTag, 'timeline', ...breakdown.categories.map((c) => slugify(c.category))],
  });

  const sections = [
    headerSection(dayString),
    summarySection(breakdown, goalProg),
    standupSection(standup),
    journalIntentionsSection(journal),
    goalSection(goalProg, goals, cfg),
    timelineSection(cards, ratings, cfg),
    distractionsSection(cards),
    appsSection(apps),
    journalReflectionsSection(journal),
    treemapSection(breakdown, colorMap),
    relatedSection(dayString),
  ].filter(Boolean);

  const md = fm + '\n' + sections.join('\n');
  const res = await writeIfChanged(filePath, md);
  return { ...res, status: res.written ? (res.created ? 'created' : 'updated') : 'unchanged' };
}

function headerSection(dayString) {
  const date = new Date(`${dayString}T12:00:00`);
  return `# Dayflow · ${format(date, 'EEEE, MMMM d, yyyy')}\n\n*Week:* ${weekLink(isoWeekKey(dayString))}\n`;
}

function summarySection(breakdown, goalProg) {
  const { totalMinutes, categories } = breakdown;
  if (totalMinutes === 0) return '## Summary\n\n*No tracked time.*\n';
  const pcts = categories
    .slice(0, 6)
    .map((c) => `**${c.category}** ${Math.round(c.pct * 100)}%`)
    .join(' · ');
  let goalLine = '';
  if (goalProg && !goalProg.isSkipped) {
    if (goalProg.focusTargetMinutes) {
      const pct = Math.round((goalProg.focusPct ?? 0) * 100);
      goalLine += `\n- 🎯 Focus: ${fmtDuration(goalProg.focusActualMinutes)} / ${fmtDuration(goalProg.focusTargetMinutes)} (${pct}%)`;
    }
    if (goalProg.distractionLimitMinutes) {
      const pct = Math.round((goalProg.distractionPct ?? 0) * 100);
      const over = goalProg.distractionActualMinutes > goalProg.distractionLimitMinutes ? ' ⚠️' : '';
      goalLine += `\n- 🚫 Distractions: ${fmtDuration(goalProg.distractionActualMinutes)} / ${fmtDuration(goalProg.distractionLimitMinutes)} limit (${pct}%)${over}`;
    }
  }
  return `## Summary\n\n- ⏱️ ${fmtHours(totalMinutes)}h tracked across ${breakdown.categories.length} categories, ${breakdown.categories.reduce((s, c) => s + c.cards, 0)} cards\n- 📊 ${pcts}${goalLine}\n`;
}

function standupSection(standup) {
  if (!standup) return '';
  const p = standup.payload || {};
  const hasHighlights = Array.isArray(p.highlights) && p.highlights.length > 0;
  const hasTasks = Array.isArray(p.tasks) && p.tasks.length > 0;
  const hasBlockers = Boolean(p.blockersBody && p.blockersBody.trim());
  if (!hasHighlights && !hasTasks && !hasBlockers) return '';

  const out = ['## Standup'];
  if (hasHighlights) {
    out.push(`### ${p.highlightsTitle || "Yesterday's highlights"}`);
    out.push(...p.highlights.map((h) => `- ${h.text || ''}`));
  }
  if (hasTasks) {
    out.push(`\n### ${p.tasksTitle || "Today's tasks"}`);
    out.push(...p.tasks.map((t) => `- [${t.done ? 'x' : ' '}] ${t.text || ''}`));
  }
  if (hasBlockers) {
    out.push(`\n### ${p.blockersTitle || 'Blockers'}\n${p.blockersBody}`);
  }
  out.push('');
  return out.join('\n');
}

function journalIntentionsSection(journal) {
  if (!journal) return '';
  const parts = [];
  if (journal.intentions) parts.push(`### Intentions\n${journal.intentions}`);
  if (journal.goals) parts.push(`### Goals\n${journal.goals}`);
  if (journal.notes) parts.push(`### Notes\n${journal.notes}`);
  if (!parts.length) return '';
  return `## Journal\n\n${parts.join('\n\n')}\n`;
}

function goalSection(goalProg, goals, cfg) {
  if (!goals) return '';
  if (goals.isSkipped) return `## Day goals\n\n*Skipped for this day.*\n`;
  const focus = goals.focusCategories.map((c) => wikilink(c.category_name, { enabled: cfg.categoryWikilinks })).join(', ');
  const distr = goals.distractionCategories.map((c) => wikilink(c.category_name, { enabled: cfg.categoryWikilinks })).join(', ');
  return `## Day goals\n\n- Focus categories: ${focus || '_none_'}\n- Distraction categories: ${distr || '_none_'}\n`;
}

function timelineSection(cards, ratings, cfg) {
  if (cards.length === 0) return '## Timeline\n\n*No timeline cards.*\n';
  // Index ratings by overlapping window so we can annotate cards.
  const ratingByCard = new Map();
  for (const r of ratings) {
    for (const c of cards) {
      if (r.start_ts < c.end_ts && r.end_ts > c.start_ts) {
        ratingByCard.set(c.id, r.rating);
      }
    }
  }
  const out = ['## Timeline'];
  for (const c of cards) {
    const cat = wikilink(c.category, { enabled: cfg.categoryWikilinks });
    const sub = c.subcategory ? ` · ${c.subcategory}` : '';
    const rating = ratingByCard.get(c.id);
    const ratingBadge = rating === 'up' ? ' 👍' : rating === 'down' ? ' 👎' : '';
    out.push(`\n### ${c.start} – ${c.end} · ${cat}${sub}${ratingBadge}`);
    out.push(`**${c.title}**`);
    if (c.detailed_summary) out.push(`\n${c.detailed_summary}`);
    else if (c.summary) out.push(`\n${c.summary}`);
    const apps = [c.appPrimary, c.appSecondary].filter(Boolean);
    const meta = [];
    if (apps.length) meta.push(`*Apps:* ${apps.join(', ')}`);
    meta.push(`*Duration:* ${Math.round((c.end_ts - c.start_ts) / 60)} min`);
    if (c.video_summary_url) {
      const url = 'file://' + c.video_summary_url.replace(/ /g, '%20');
      meta.push(`[Video summary](${url})`);
    }
    out.push(`\n${meta.join(' · ')}`);
  }
  out.push('');
  return out.join('\n');
}

function distractionsSection(cards) {
  const all = [];
  for (const c of cards) {
    for (const d of c.distractions || []) {
      all.push({ ...d, cardStart: c.start, cardEnd: c.end });
    }
  }
  if (all.length === 0) return `## Distractions\n\n*No distractions recorded.* ✨\n`;
  const items = all
    .map((d) => `- **${d.startTime || ''} – ${d.endTime || ''}** ${d.title || ''}${d.summary ? `\n  ${d.summary}` : ''}`)
    .join('\n');
  return `## Distractions\n\n${items}\n`;
}

function appsSection(apps) {
  if (apps.length === 0) return '';
  const rows = apps
    .slice(0, 20)
    .map((a) => `| ${tableCell(a.app)} | ${a.sessions} | ${a.minutes} |`)
    .join('\n');
  return `## App usage\n\n| App | Sessions | Minutes |\n| --- | --- | --- |\n${rows}\n`;
}

function journalReflectionsSection(journal) {
  if (!journal) return '';
  const parts = [];
  if (journal.reflections) parts.push(`### Reflections\n${journal.reflections}`);
  if (journal.summary) parts.push(`### AI summary\n${journal.summary}`);
  if (!parts.length) return '';
  return `## Reflection\n\n${parts.join('\n\n')}\n`;
}

function treemapSection(breakdown, colorMap) {
  if (breakdown.categories.length === 0) return '';
  const items = breakdown.categories.map((c) => ({
    name: c.category,
    value: c.minutes,
    color: colorMap[c.category],
  }));
  const svg = renderTreemap(items, { title: 'Time by category' });
  return `## Treemap\n\n<div class="dayflow-treemap">\n${svg}\n</div>\n`;
}

function relatedSection(dayString) {
  return `## Related\n\n- Week note: ${weekLink(isoWeekKey(dayString))}\n`;
}
