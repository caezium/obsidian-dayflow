/**
 * Per-day Obsidian note. Layout favors readability:
 *
 *   1. Header callout — at-a-glance hours, categories, goal progress
 *   2. Standup (only if non-empty)
 *   3. Intentions (only if recorded)
 *   4. Timeline (the main content)
 *   5. Reflection (only if recorded)
 *   6. Distractions (only if any)
 *   7. Top apps (capped at 8)
 *   8. Goal category assignments (if any)
 *   9. Week link footer
 *
 * Daily notes deliberately have NO charts — visualizations only make sense
 * at the weekly aggregate where there's enough data to see patterns.
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
import { frontmatter } from '../formatters/frontmatter.js';
import { wikilink, weekLink } from '../formatters/wikilinks.js';
import { writeIfChanged, readCreatedAt } from '../util/io.js';
import { fmtDuration, fmtHours, slugify } from '../util/time.js';
import { tableCell } from '../util/escape.js';
import { isoWeekKey, isDayComplete } from '../boundary.js';
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
    headerSection(dayString, breakdown, goalProg),
    standupSection(standup),
    journalIntentionsSection(journal),
    timelineSection(cards, ratings, cfg),
    journalReflectionsSection(journal),
    distractionsSection(cards),
    appsSection(apps),
    goalCategoriesSection(goals, cfg),
    relatedSection(dayString),
  ].filter(Boolean);

  const md = fm + '\n' + sections.join('\n');
  const res = await writeIfChanged(filePath, md);
  return { ...res, status: res.written ? (res.created ? 'created' : 'updated') : 'unchanged' };
}

function headerSection(dayString, breakdown, goalProg) {
  const date = new Date(`${dayString}T12:00:00`);
  const { totalMinutes, categories } = breakdown;
  const lines = [
    `# ${format(date, 'EEEE, MMMM d, yyyy')}`,
    '',
    `> [!info] Day at a glance`,
  ];

  if (totalMinutes === 0) {
    lines.push('> *No tracked activity for this day.*');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`> **${fmtHours(totalMinutes)}h** tracked · ${categories.reduce((s, c) => s + c.cards, 0)} cards · ${categories.length} categories`);

  const pcts = categories
    .slice(0, 5)
    .map((c) => `\`${c.category} ${Math.round(c.pct * 100)}%\``)
    .join(' ');
  if (pcts) lines.push(`> ${pcts}`);

  if (goalProg && !goalProg.isSkipped) {
    if (goalProg.focusTargetMinutes) {
      const pct = Math.round((goalProg.focusPct ?? 0) * 100);
      const hit = pct >= 100 ? ' ✅' : '';
      lines.push(`> 🎯 Focus: **${fmtDuration(goalProg.focusActualMinutes)}** / ${fmtDuration(goalProg.focusTargetMinutes)} (${pct}%)${hit}`);
    }
    if (goalProg.distractionLimitMinutes) {
      const pct = Math.round((goalProg.distractionPct ?? 0) * 100);
      const over = goalProg.distractionActualMinutes > goalProg.distractionLimitMinutes ? ' ⚠️' : '';
      lines.push(`> 🚫 Distractions: **${fmtDuration(goalProg.distractionActualMinutes)}** / ${fmtDuration(goalProg.distractionLimitMinutes)} limit (${pct}%)${over}`);
    }
  }
  lines.push('');
  return lines.join('\n');
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

function goalCategoriesSection(goals, cfg) {
  // Only emit this if goals have category assignments — the progress line is in the header.
  if (!goals || goals.isSkipped) return '';
  if (goals.focusCategories.length === 0 && goals.distractionCategories.length === 0) return '';
  const focus = goals.focusCategories.map((c) => wikilink(c.category_name, { enabled: cfg.categoryWikilinks })).join(', ');
  const distr = goals.distractionCategories.map((c) => wikilink(c.category_name, { enabled: cfg.categoryWikilinks })).join(', ');
  const lines = ['## Goal categories', ''];
  if (focus) lines.push(`- 🎯 Focus: ${focus}`);
  if (distr) lines.push(`- 🚫 Distraction: ${distr}`);
  lines.push('');
  return lines.join('\n');
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
  const top = apps.slice(0, 8);
  const rest = apps.length - top.length;
  const rows = top
    .map((a) => `| ${tableCell(a.app)} | ${a.sessions} | ${a.minutes} |`)
    .join('\n');
  const trailer = rest > 0 ? `\n*… and ${rest} more apps*\n` : '';
  return `## Top apps\n\n| App | Sessions | Minutes |\n| --- | --- | --- |\n${rows}\n${trailer}`;
}

function journalReflectionsSection(journal) {
  if (!journal) return '';
  const parts = [];
  if (journal.reflections) parts.push(`### Reflections\n${journal.reflections}`);
  if (journal.summary) parts.push(`### AI summary\n${journal.summary}`);
  if (!parts.length) return '';
  return `## Reflection\n\n${parts.join('\n\n')}\n`;
}

function relatedSection(dayString) {
  return `---\n\n*Week:* ${weekLink(isoWeekKey(dayString))}\n`;
}
