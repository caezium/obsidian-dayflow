import { minutesBetween } from '../util/time.js';

export function appBreakdown(cards) {
  const byApp = new Map();
  for (const c of cards) {
    const mins = minutesBetween(c.start_ts, c.end_ts);
    for (const app of [c.appPrimary, c.appSecondary].filter(Boolean)) {
      if (!byApp.has(app)) byApp.set(app, { app, minutes: 0, sessions: 0 });
      byApp.get(app).minutes += mins;
      byApp.get(app).sessions += 1;
    }
  }
  return [...byApp.values()].sort((a, b) => b.minutes - a.minutes);
}

/**
 * Sequential app→app transitions from primary apps in time order.
 * Result: [{ source, target, count }, ...]
 */
export function appTransitions(cards) {
  const ordered = cards
    .filter((c) => c.appPrimary)
    .sort((a, b) => a.start_ts - b.start_ts);
  const pairs = new Map(); // key: source||target -> { source, target, count }
  for (let i = 1; i < ordered.length; i++) {
    const source = ordered[i - 1].appPrimary;
    const target = ordered[i].appPrimary;
    if (source === target) continue;
    const key = `${source}␟${target}`;
    const existing = pairs.get(key);
    if (existing) existing.count += 1;
    else pairs.set(key, { source, target, count: 1 });
  }
  return [...pairs.values()].sort((a, b) => b.count - a.count);
}
