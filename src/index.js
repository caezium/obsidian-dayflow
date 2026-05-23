#!/usr/bin/env node
/**
 * obsidian-dayflow — Export Dayflow data into an Obsidian vault.
 *
 * Privacy: opens the Dayflow SQLite database in READ-ONLY mode. Makes ZERO
 * network calls. Writes only to the directory you pass via --output. Run
 *   grep -RIE 'http|https|fetch|axios|request' src/
 * to verify before each release.
 */
import { Command } from 'commander';
import path from 'path';
import { openReadOnly } from './db.js';
import { resolveConfig } from './config.js';
import { lastNDays, isoWeekKey } from './boundary.js';
import { exportDailyNote } from './exporters/daily-note.js';
import { exportWeeklyNote } from './exporters/weekly-note.js';
import { exportRawDay } from './exporters/raw-dump.js';
import { exportObservationsNote } from './exporters/observations-note.js';
import { ensureDir } from './util/io.js';

function validatePlatform() {
  if (process.platform !== 'darwin') {
    console.error('\n❌ Dayflow is macOS-only. This tool requires the Dayflow SQLite database at:');
    console.error('   ~/Library/Application Support/Dayflow/chunks.sqlite\n');
    process.exit(1);
  }
}

const program = new Command();
program
  .name('obsidian-dayflow')
  .description('Export Dayflow data into an Obsidian vault — daily notes, weekly notes with treemap/heatmap/Sankey, optional raw JSON dump.')
  .version('0.1.0')
  .option('-d, --days <number>', 'Days back to sync (1-365)', '7')
  .option('-o, --output <path>', 'Vault directory (default: ./dayflow-vault)')
  .option('--db <path>', 'Custom path to chunks.sqlite')
  .option('--includeDeleted <0|1>', 'Include deleted timeline cards', '0')
  .option('-f, --force', 'Regenerate complete days even if note exists', false)
  .option('--no-weekly', 'Skip weekly notes')
  .option('--raw', 'Also emit Raw/Dayflow_YYYY-MM-DD.json sidecars (all tables)', false)
  .option('--observations', 'Also emit Observations/ notes with granular pre-summary snippets', false)
  .parse(process.argv);

const cfg = resolveConfig(program.opts());

async function main() {
  console.log('┌─────────────────────────────────────────────┐');
  console.log('│  obsidian-dayflow                           │');
  console.log('└─────────────────────────────────────────────┘\n');
  validatePlatform();

  console.log('Configuration:');
  console.log(`  Database:  ${cfg.dbPath}`);
  console.log(`  Vault:     ${cfg.outputDir}`);
  console.log(`  Days:      ${cfg.days}`);
  console.log(`  Weekly:    ${cfg.emitWeekly ? 'yes' : 'no'}`);
  console.log(`  Raw JSON:  ${cfg.emitRaw ? 'yes' : 'no'}`);
  console.log(`  Obs notes: ${cfg.emitObservations ? 'yes' : 'no'}`);
  console.log(`  Force:     ${cfg.force ? 'yes' : 'no'}\n`);

  const db = openReadOnly(cfg.dbPath);
  console.log('✓ Database connected (read-only)\n');

  await ensureDir(path.join(cfg.outputDir, cfg.dailySubdir));
  if (cfg.emitWeekly) await ensureDir(path.join(cfg.outputDir, cfg.weeklySubdir));
  if (cfg.emitRaw) await ensureDir(path.join(cfg.outputDir, cfg.rawSubdir));
  if (cfg.emitObservations) await ensureDir(path.join(cfg.outputDir, cfg.observationsSubdir));

  const days = lastNDays(cfg.days);
  const weeks = new Set(days.map((d) => isoWeekKey(d)));

  console.log(`Syncing ${days.length} days (${days[days.length - 1]} → ${days[0]})\n`);

  const counts = { created: 0, updated: 0, unchanged: 0, skipped: 0, noData: 0, errors: 0 };

  for (const day of days) {
    process.stdout.write(`  ${day}  daily`);
    try {
      const r = await exportDailyNote(db, day, cfg);
      logStatus(r.status, counts);
      if (cfg.emitRaw) {
        process.stdout.write('     raw');
        const rr = await exportRawDay(db, day, cfg);
        logStatus(rr.status, counts);
      }
      if (cfg.emitObservations) {
        process.stdout.write('     obs');
        const ro = await exportObservationsNote(db, day, cfg);
        logStatus(ro.status, counts);
      }
    } catch (err) {
      counts.errors += 1;
      console.log(` ✗ ${err.message}`);
    }
  }

  if (cfg.emitWeekly) {
    console.log('');
    for (const week of [...weeks].sort()) {
      process.stdout.write(`  ${week}  weekly`);
      try {
        const r = await exportWeeklyNote(db, week, cfg);
        logStatus(r.status, counts);
      } catch (err) {
        counts.errors += 1;
        console.log(` ✗ ${err.message}`);
      }
    }
  }

  db.close();

  console.log('\n┌─────────────────────────────────────────────┐');
  console.log('│  Sync complete                              │');
  console.log('└─────────────────────────────────────────────┘');
  console.log(`  Created:   ${counts.created}`);
  console.log(`  Updated:   ${counts.updated}`);
  console.log(`  Unchanged: ${counts.unchanged}`);
  console.log(`  Skipped:   ${counts.skipped}`);
  console.log(`  No data:   ${counts.noData}`);
  if (counts.errors) console.log(`  Errors:    ${counts.errors}`);
  console.log(`\n  Output:    ${cfg.outputDir}\n`);
}

function logStatus(status, counts) {
  if (status === 'created') { counts.created++; console.log(' ✓ created'); }
  else if (status === 'updated') { counts.updated++; console.log(' ✓ updated'); }
  else if (status === 'unchanged') { counts.unchanged++; console.log(' · unchanged'); }
  else if (status === 'skipped-complete') { counts.skipped++; console.log(' ⊘ skipped (day complete)'); }
  else if (status === 'no-data') { counts.noData++; console.log(' ∅ no data'); }
  else { console.log(` ? ${status}`); }
}

try {
  await main();
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  if (err.code === 'DB_NOT_FOUND') {
    console.error('Solutions:');
    console.error('  1. Install Dayflow and let it record activity for a few minutes');
    console.error('  2. Pass --db /custom/path/to/chunks.sqlite\n');
  }
  process.exit(1);
}
