import { hasTable } from '../db.js';

/**
 * Granular per-batch observations — the pre-summary atomic data the LLM
 * produced before being rolled up into timeline_cards.
 *
 * We filter by start_ts falling inside the day's 4 AM..4 AM window rather
 * than relying on a `day` column (the table doesn't have one).
 */
export function fetchObservations(db, dayString) {
  if (!hasTable(db, 'observations')) return [];
  const start = Math.floor(new Date(`${dayString}T04:00:00`).getTime() / 1000);
  const end = start + 24 * 60 * 60;
  return db
    .prepare(
      `SELECT id, batch_id, start_ts, end_ts, observation, metadata, llm_model, created_at
         FROM observations
        WHERE start_ts >= ? AND start_ts < ?
        ORDER BY start_ts ASC`
    )
    .all(start, end);
}
