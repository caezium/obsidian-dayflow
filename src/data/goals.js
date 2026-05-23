import { hasTable } from '../db.js';

export function fetchDayGoals(db, dayString) {
  if (!hasTable(db, 'day_goals')) return null;
  const goal = db
    .prepare(
      `SELECT day, focus_target_minutes, distraction_limit_minutes, is_skipped,
              created_at, updated_at
         FROM day_goals WHERE day = ?`
    )
    .get(dayString);
  if (!goal) return null;

  let categories = [];
  if (hasTable(db, 'day_goal_categories')) {
    categories = db
      .prepare(
        `SELECT day, kind, category_id, category_name, category_color_hex, sort_order
           FROM day_goal_categories
          WHERE day = ?
          ORDER BY kind, sort_order`
      )
      .all(dayString);
  }
  return {
    ...goal,
    isSkipped: Boolean(goal.is_skipped),
    focusCategories: categories.filter((c) => c.kind === 'focus'),
    distractionCategories: categories.filter((c) => c.kind === 'distraction'),
  };
}
