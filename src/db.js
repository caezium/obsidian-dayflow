/**
 * Read-only Dayflow SQLite handle.
 *
 * Privacy guarantee: opens the database with { readonly: true } so this tool
 * cannot mutate Dayflow's data even by accident. No network calls anywhere
 * in this module.
 */
import Database from 'better-sqlite3';
import fs from 'fs';

export function openReadOnly(dbPath) {
  if (!fs.existsSync(dbPath)) {
    const err = new Error(`Dayflow database not found at ${dbPath}`);
    err.code = 'DB_NOT_FOUND';
    throw err;
  }
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  // Smoke test — confirm the schema we expect is here.
  db.prepare('SELECT COUNT(*) FROM timeline_cards').get();
  return db;
}

/**
 * Returns the set of tables present in this DB. Useful for graceful
 * degradation when running against an older Dayflow that lacks newer tables
 * (day_goals, daily_standup_entries, etc.).
 */
export function listTables(db) {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all();
  return new Set(rows.map((r) => r.name));
}

export function hasTable(db, name) {
  return listTables(db).has(name);
}
