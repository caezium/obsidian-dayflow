/**
 * Raw JSON sidecars for custom dashboards.
 *
 * Per day we dump every relevant table — timeline_cards, journal,
 * standup, day_goals, observations, ratings — as a single newline-delimited
 * JSON file at Raw/Dayflow_YYYY-MM-DD.json.
 *
 * The shape is stable; downstream tools (DuckDB, jq, pandas) can read it
 * directly without a schema migration tracker.
 */
import path from 'path';
import { fetchTimelineCards } from '../data/timeline.js';
import { fetchJournalEntry } from '../data/journal.js';
import { fetchStandup } from '../data/standup.js';
import { fetchDayGoals } from '../data/goals.js';
import { fetchRatings } from '../data/ratings.js';
import { fetchObservations } from '../data/observations.js';
import { writeIfChanged } from '../util/io.js';

export async function exportRawDay(db, dayString, cfg) {
  const dir = path.join(cfg.outputDir, cfg.rawSubdir);
  const filePath = path.join(dir, `Dayflow_${dayString}.json`);

  const payload = {
    day: dayString,
    exported_at: new Date().toISOString(),
    timeline_cards: fetchTimelineCards(db, dayString, { includeDeleted: true }),
    journal: fetchJournalEntry(db, dayString),
    standup: fetchStandup(db, dayString),
    day_goals: fetchDayGoals(db, dayString),
    ratings: fetchRatings(db, dayString),
    observations: cfg.emitObservations ? fetchObservations(db, dayString) : null,
  };

  const json = JSON.stringify(payload, null, 2);
  const res = await writeIfChanged(filePath, json);
  return { ...res, status: res.written ? (res.created ? 'created' : 'updated') : 'unchanged' };
}
