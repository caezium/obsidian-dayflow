import { minutesBetween } from '../util/time.js';

export function categoryBreakdown(cards) {
  const byCat = new Map();
  let total = 0;
  for (const c of cards) {
    const mins = minutesBetween(c.start_ts, c.end_ts);
    total += mins;
    const key = c.category || 'Uncategorized';
    if (!byCat.has(key)) byCat.set(key, { category: key, minutes: 0, cards: 0, subcats: new Map() });
    const bucket = byCat.get(key);
    bucket.minutes += mins;
    bucket.cards += 1;
    if (c.subcategory) {
      const subKey = c.subcategory;
      bucket.subcats.set(subKey, (bucket.subcats.get(subKey) || 0) + mins);
    }
  }
  const result = [...byCat.values()]
    .map((b) => ({
      category: b.category,
      minutes: b.minutes,
      cards: b.cards,
      pct: total > 0 ? b.minutes / total : 0,
      subcategories: [...b.subcats.entries()]
        .map(([name, minutes]) => ({ name, minutes }))
        .sort((a, b) => b.minutes - a.minutes),
    }))
    .sort((a, b) => b.minutes - a.minutes);
  return { totalMinutes: total, categories: result };
}
