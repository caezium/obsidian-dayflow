/**
 * Optional per-day observations note.
 *
 * Observations are the granular pre-summary snippets (one per 15-ish-minute
 * analysis batch). They can be noisy, so this exporter is opt-in via the
 * --observations flag. The note is markdown so it stays searchable in
 * Obsidian, but it's separate from the main daily note to keep that clean.
 */
import path from 'path';
import { fetchObservations } from '../data/observations.js';
import { frontmatter } from '../formatters/frontmatter.js';
import { writeIfChanged, readCreatedAt } from '../util/io.js';
import { dayLink } from '../formatters/wikilinks.js';
import { format } from 'date-fns';

export async function exportObservationsNote(db, dayString, cfg) {
  const dir = path.join(cfg.outputDir, cfg.observationsSubdir);
  const filePath = path.join(dir, `Dayflow_obs_${dayString}.md`);

  const rows = fetchObservations(db, dayString);
  if (rows.length === 0) return { path: filePath, status: 'no-data' };

  const fm = frontmatter({
    dayflow_day: dayString,
    kind: 'observations',
    count: rows.length,
    created_at: (await readCreatedAt(filePath)) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [cfg.noteTag, 'observations'],
  });

  const body = [
    `# Dayflow observations · ${dayString}`,
    '',
    `*Day note:* ${dayLink(dayString)}`,
    '',
    `Granular pre-summary observations (${rows.length} total). These are the atomic snippets the LLM produced before being rolled up into timeline cards.`,
    '',
    '---',
    '',
  ];

  for (const r of rows) {
    const t = new Date(r.start_ts * 1000);
    body.push(`### ${format(t, 'HH:mm')} · batch ${r.batch_id}${r.llm_model ? ` · _${r.llm_model}_` : ''}`);
    body.push('');
    body.push(r.observation || '');
    body.push('');
  }
  const res = await writeIfChanged(filePath, fm + '\n' + body.join('\n'));
  return { ...res, status: res.written ? (res.created ? 'created' : 'updated') : 'unchanged' };
}
