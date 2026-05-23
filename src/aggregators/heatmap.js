/**
 * Focus heatmap: 24 hourly buckets × N days.
 *
 * For each card, distribute its minutes into the 1-hour buckets it spans.
 * Returns a 2D matrix indexed by [dayIndex][hour] where hour is 0..23 in
 * local time. dayIndex maps to `days[dayIndex]`.
 */
export function focusHeatmap(cards, days) {
  // days is in chronological order, oldest first.
  const dayIdx = new Map(days.map((d, i) => [d, i]));
  const grid = days.map(() => new Array(24).fill(0));

  for (const c of cards) {
    if (!c.day || !dayIdx.has(c.day)) continue;
    const row = dayIdx.get(c.day);
    const s = new Date(c.start_ts * 1000);
    const e = new Date(c.end_ts * 1000);
    let cursor = new Date(s);
    while (cursor < e) {
      const hour = cursor.getHours();
      const nextHour = new Date(cursor);
      nextHour.setHours(hour + 1, 0, 0, 0);
      const segmentEnd = nextHour < e ? nextHour : e;
      const minutes = Math.max(0, (segmentEnd - cursor) / 60000);
      grid[row][hour] += minutes;
      cursor = nextHour;
    }
  }
  // Round to keep SVG compact.
  return grid.map((row) => row.map((v) => Math.round(v)));
}
