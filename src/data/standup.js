import { hasTable } from '../db.js';

/**
 * daily_standup_entries stores a `payload_json` blob shaped like:
 *   {
 *     highlightsTitle, highlights: [{id, text}, ...],
 *     tasksTitle, tasks: [{id, text, done?}, ...],
 *     blockersTitle, blockersBody,
 *     generation: { generatedAt, provider, runtime, modelOrTool }
 *   }
 */
export function fetchStandup(db, dayString) {
  if (!hasTable(db, 'daily_standup_entries')) return null;
  const row = db
    .prepare(
      'SELECT standup_day, payload_json, created_at, updated_at FROM daily_standup_entries WHERE standup_day = ?'
    )
    .get(dayString);
  if (!row) return null;
  let payload = {};
  try {
    payload = JSON.parse(row.payload_json);
  } catch {
    /* return raw if unparseable */
  }
  return {
    day: row.standup_day,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payload,
  };
}
