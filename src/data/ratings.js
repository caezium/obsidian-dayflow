import { hasTable } from '../db.js';

export function fetchRatings(db, dayString) {
  if (!hasTable(db, 'timeline_review_ratings')) return [];
  const start = Math.floor(new Date(`${dayString}T04:00:00`).getTime() / 1000);
  const end = start + 24 * 60 * 60;
  return db
    .prepare(
      `SELECT id, start_ts, end_ts, rating
         FROM timeline_review_ratings
        WHERE start_ts >= ? AND start_ts < ?
        ORDER BY start_ts ASC`
    )
    .all(start, end);
}
