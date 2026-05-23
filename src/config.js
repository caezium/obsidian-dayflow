/**
 * Centralized configuration with env var + CLI flag layering.
 * No secrets, no network. All paths resolve locally.
 */
import path from 'path';
import os from 'os';

export const DEFAULTS = {
  dbPath: path.join(
    os.homedir(),
    'Library/Application Support/Dayflow/chunks.sqlite'
  ),
  outputDir: './dayflow-vault',
  dailySubdir: 'Daily',
  weeklySubdir: 'Weekly',
  rawSubdir: 'Raw',
  observationsSubdir: 'Observations',
  days: 7,
  dayBoundaryHour: 4,       // Dayflow's 4 AM boundary
  includeDeleted: false,
  force: false,
  emitRaw: false,
  emitObservations: false,
  emitWeekly: true,
  noteTag: 'dayflow',
  categoryWikilinks: true,  // [[Work]] vs plain "Work"
};

export function resolveConfig(cliOpts) {
  return {
    dbPath:
      cliOpts.db || process.env.DAYFLOW_DB_PATH || DEFAULTS.dbPath,
    outputDir: path.resolve(
      cliOpts.output || process.env.OBSIDIAN_DAYFLOW_VAULT || DEFAULTS.outputDir
    ),
    dailySubdir: process.env.OBSIDIAN_DAYFLOW_DAILY_DIR || DEFAULTS.dailySubdir,
    weeklySubdir: process.env.OBSIDIAN_DAYFLOW_WEEKLY_DIR || DEFAULTS.weeklySubdir,
    rawSubdir: process.env.OBSIDIAN_DAYFLOW_RAW_DIR || DEFAULTS.rawSubdir,
    observationsSubdir:
      process.env.OBSIDIAN_DAYFLOW_OBS_DIR || DEFAULTS.observationsSubdir,
    days: cliOpts.days !== undefined ? parseInt(cliOpts.days, 10) : DEFAULTS.days,
    includeDeleted:
      cliOpts.includeDeleted !== undefined
        ? parseInt(cliOpts.includeDeleted, 10) === 1
        : DEFAULTS.includeDeleted,
    force: Boolean(cliOpts.force),
    emitRaw: Boolean(cliOpts.raw),
    emitObservations: Boolean(cliOpts.observations),
    emitWeekly: cliOpts.weekly !== false,
    noteTag: DEFAULTS.noteTag,
    categoryWikilinks: DEFAULTS.categoryWikilinks,
    dayBoundaryHour: DEFAULTS.dayBoundaryHour,
  };
}
