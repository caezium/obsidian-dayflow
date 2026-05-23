/**
 * timeline_cards — the AI-summarized activity cards that form the spine of
 * each Dayflow day. We also pull the nested `metadata` JSON which holds
 * primary/secondary app and per-card distractions.
 */
export function fetchTimelineCards(db, dayString, { includeDeleted = false } = {}) {
  const sql = `
    SELECT
      id, batch_id, start, end, start_ts, end_ts, day,
      title, summary, detailed_summary, category, subcategory,
      metadata, video_summary_url, created_at, is_deleted
    FROM timeline_cards
    WHERE day = ? ${includeDeleted ? '' : 'AND is_deleted = 0'}
    ORDER BY start_ts ASC
  `;
  const rows = db.prepare(sql).all(dayString);
  return rows.map(parseCard).filter(notFailedProcessing);
}

export function fetchTimelineCardsRange(db, fromDay, toDay, { includeDeleted = false } = {}) {
  const sql = `
    SELECT
      id, batch_id, start, end, start_ts, end_ts, day,
      title, summary, detailed_summary, category, subcategory,
      metadata, video_summary_url, created_at, is_deleted
    FROM timeline_cards
    WHERE day >= ? AND day <= ? ${includeDeleted ? '' : 'AND is_deleted = 0'}
    ORDER BY start_ts ASC
  `;
  const rows = db.prepare(sql).all(fromDay, toDay);
  return rows.map(parseCard).filter(notFailedProcessing);
}

function parseCard(row) {
  let meta = { appSites: {}, distractions: [] };
  if (row.metadata) {
    try {
      const parsed = JSON.parse(row.metadata);
      meta = {
        appSites: parsed.appSites || {},
        distractions: Array.isArray(parsed.distractions) ? parsed.distractions : [],
        ...parsed,
      };
    } catch {
      /* malformed metadata — keep defaults */
    }
  }
  return {
    ...row,
    appPrimary: meta.appSites?.primary || null,
    appSecondary: meta.appSites?.secondary || null,
    distractions: meta.distractions,
    meta,
  };
}

function notFailedProcessing(card) {
  if (card.category !== 'System') return true;
  const t = card.title || '';
  return !(t.includes('Processing failed') || t.includes('Error') || card.subcategory === 'Error');
}
