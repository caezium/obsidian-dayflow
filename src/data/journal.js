export function fetchJournalEntry(db, dayString) {
  const row = db
    .prepare(
      `SELECT id, day, intentions, notes, goals, reflections, summary, status,
              created_at, updated_at
         FROM journal_entries WHERE day = ?`
    )
    .get(dayString);
  return row || null;
}
