# obsidian-dayflow

Export every layer of [Dayflow](https://github.com/JerryZLiu/Dayflow) into an
Obsidian vault — daily notes, weekly notes with inline SVG **treemaps,
heatmaps, and Sankey** charts, plus optional raw JSON sidecars for building
your own dashboards.

This is **not a fork** of `zeroliu/dayflow-sync`. Same idea, broader scope:
all of Dayflow's tables (timeline, journal, standup, day goals, ratings,
observations) instead of just the two `dayflow-sync` covers, plus the
weekly visualizations Dayflow shows in-app but doesn't otherwise export.

## Why

Dayflow stores rich data the in-app UI surfaces as weekly charts, daily
standups, focus targets and per-card ratings — but its built-in export only
emits a flat markdown timeline. This tool reads the same SQLite database
**read-only** and writes the full picture into your Obsidian vault, where
you actually review your week.

## Privacy

- **Read-only DB handle** — cannot modify Dayflow's data
- **Zero network calls** — verify with
  `grep -RIE 'http|https|fetch|axios|request' src/`
- **No telemetry, no analytics** — single-file process, exits when done
- **Vault path is yours** — you pass `--output` or set
  `OBSIDIAN_DAYFLOW_VAULT`

## Install

### From source

```bash
git clone <this-repo> ~/code/obsidian-dayflow
cd ~/code/obsidian-dayflow
npm install
node src/index.js --days 7 --output ~/Documents/MyVault/Dayflow
```

### Requires

- macOS (Dayflow is macOS-only)
- Node.js ≥ 18
- Dayflow installed and active

## Usage

```bash
# Last 7 days into ./dayflow-vault
node src/index.js

# Into a real Obsidian vault folder
node src/index.js --output ~/Documents/MyVault/Dayflow --days 30

# Add raw JSON sidecars for custom dashboards (DuckDB, jq, pandas...)
node src/index.js --raw

# Also emit granular observations notes (verbose)
node src/index.js --observations

# Regenerate everything (ignores 'day complete' skip)
node src/index.js --force --days 14

# Skip weekly notes
node src/index.js --no-weekly
```

### Environment variables

| Var | Purpose |
| --- | --- |
| `OBSIDIAN_DAYFLOW_VAULT` | Default `--output` directory |
| `DAYFLOW_DB_PATH` | Override path to `chunks.sqlite` |
| `OBSIDIAN_DAYFLOW_DAILY_DIR` | Subfolder for daily notes (default `Daily`) |
| `OBSIDIAN_DAYFLOW_WEEKLY_DIR` | Subfolder for weekly notes (default `Weekly`) |
| `OBSIDIAN_DAYFLOW_RAW_DIR` | Subfolder for raw JSON (default `Raw`) |
| `OBSIDIAN_DAYFLOW_OBS_DIR` | Subfolder for observation notes (default `Observations`) |

## Output

```
<vault>/Daily/Dayflow_2026-05-21.md         ← daily note
<vault>/Weekly/Dayflow_2026-W20.md          ← weekly note with all charts
<vault>/Raw/Dayflow_2026-05-21.json         ← optional: full table dump
<vault>/Observations/Dayflow_obs_2026-05-21.md  ← optional: granular obs
```

### Daily note contents

Every relevant Dayflow table maps to a section:

| Section | Source table |
| --- | --- |
| Summary + goal progress | `day_goals`, `day_goal_categories`, `timeline_cards` |
| Standup (highlights/tasks/blockers) | `daily_standup_entries` |
| Journal intentions/goals/notes | `journal_entries` |
| Timeline (with 👍/👎 from ratings) | `timeline_cards`, `timeline_review_ratings` |
| Distractions log | `timeline_cards.metadata.distractions[]` |
| App usage table | `timeline_cards.metadata.appSites` |
| Reflections + AI summary | `journal_entries` |
| Inline SVG treemap | aggregated `timeline_cards` |

Frontmatter includes:

```yaml
dayflow_day: 2026-05-21
week: 2026-W20
total_minutes: 425
categories: [Work, Personal, Learning]
top_apps: [VS Code, Chrome, Slack]
focus_target_minutes: 240
focus_actual_minutes: 287
focus_pct: 120
tags: [dayflow, timeline, work, personal, learning]
```

Categories are written as `[[Wikilinks]]` for vault graph linking.

### Weekly note contents

- Inline **SVG treemap** (categories proportional to time)
- Inline **SVG bar chart** (category totals)
- Inline **SVG focus heatmap** (24h × 7 days, minutes per hour)
- Inline **SVG Sankey** (top 10 app→app transitions)
- App usage table (top 15)
- Linked list of each day's note

SVGs are embedded directly in the `.md`. No image files to manage, works
with Obsidian's default markdown renderer (HTML enabled).

### Raw JSON sidecar (`--raw`)

One file per day with every table's rows for that day:

```json
{
  "day": "2026-05-21",
  "exported_at": "...",
  "timeline_cards": [...],
  "journal": {...},
  "standup": {...},
  "day_goals": {...},
  "ratings": [...],
  "observations": null
}
```

Ideal for DuckDB:

```sql
CREATE TABLE cards AS
  SELECT day, unnest(timeline_cards, recursive := true) AS card
  FROM read_json('~/MyVault/Dayflow/Raw/Dayflow_*.json');
```

## Day boundary

Dayflow uses a **4:00 AM** day boundary. Activity at 02:30 on Mar 15 belongs
to Mar 14's note. We honor the `day` column in `timeline_cards`,
`journal_entries`, and `day_goals` directly, which Dayflow already writes
with that convention applied.

## Smart re-sync

By default the tool skips a day's note if:

1. The day is "complete" (we're past 04:00 of the next day), AND
2. A note already exists for it.

Pass `--force` to regenerate. Even without `--force`, all notes use
`writeIfChanged` — re-runs don't bump mtime if the content is identical.

## Automation (launchd)

Sync every day at 5:00 AM (after the previous Dayflow day has closed):

```bash
cp examples/launchd.plist.template ~/Library/LaunchAgents/com.obsidian-dayflow.plist
# edit paths inside the plist (node, project, vault)
launchctl load ~/Library/LaunchAgents/com.obsidian-dayflow.plist
launchctl start com.obsidian-dayflow
tail -f /tmp/obsidian-dayflow.log
```

## Inspiration

- [`JerryZLiu/Dayflow`](https://github.com/JerryZLiu/Dayflow) — the app
- [`zeroliu/dayflow-sync`](https://github.com/zeroliu/dayflow-sync) — the
  prior-art markdown sync we read while designing this one

## License

MIT
