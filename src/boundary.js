/**
 * Replicates Dayflow's 4 AM day boundary.
 *
 * A "Dayflow day" runs from 04:00 local time to 03:59:59 the next calendar
 * day. Activity at 02:00 on Mar 15 belongs to Mar 14's note.
 *
 * The DB itself stores `day` as the post-boundary date for timeline_cards,
 * journal_entries, day_goals etc., so we honor that as the source of truth.
 */
import { format, subDays, addDays } from 'date-fns';

const BOUNDARY_HOUR = 4;

export function getDayInfo(date, boundaryHour = BOUNDARY_HOUR) {
  const ref = new Date(date);
  const boundary = new Date(ref);
  boundary.setHours(boundaryHour, 0, 0, 0);

  if (ref < boundary) {
    const start = subDays(boundary, 1);
    return {
      dayString: format(start, 'yyyy-MM-dd'),
      startOfDay: start,
      endOfDay: boundary,
    };
  }
  return {
    dayString: format(boundary, 'yyyy-MM-dd'),
    startOfDay: boundary,
    endOfDay: addDays(boundary, 1),
  };
}

export function lastNDays(n) {
  const out = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const info = getDayInfo(subDays(today, i));
    if (!out.includes(info.dayString)) out.push(info.dayString);
  }
  return out;
}

export function isDayComplete(dayString, boundaryHour = BOUNDARY_HOUR) {
  // Day is "done" once we're past the next day's boundary hour.
  const dayDate = new Date(`${dayString}T${String(boundaryHour).padStart(2, '0')}:00:00`);
  const nextBoundary = addDays(dayDate, 1);
  return new Date() >= nextBoundary;
}

/**
 * ISO week key (YYYY-Www) for a given day string. Week starts Monday.
 */
export function isoWeekKey(dayString) {
  const d = new Date(`${dayString}T12:00:00`);
  // ISO week calc per RFC 3339 / ISO 8601.
  const target = new Date(d.valueOf());
  const dayNum = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  target.setDate(target.getDate() - dayNum + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target) / 604800000);
  const year = new Date(firstThursday).getFullYear();
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function daysInWeek(weekKey) {
  // weekKey: "2026-W20" — return all 7 day-strings Mon..Sun.
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) throw new Error(`Invalid week key: ${weekKey}`);
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  // ISO week 1 contains Jan 4.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - jan4Day);
  const target = new Date(week1Mon);
  target.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(target);
    d.setUTCDate(target.getUTCDate() + i);
    out.push(format(d, 'yyyy-MM-dd'));
  }
  return out;
}
