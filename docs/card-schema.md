# Card schema (version 1)

One small JSON file per person, built by the Command Center's Share page. Under 8 KB. Everything below is the **complete** list of what can appear.

| Field | Type | Meaning |
|---|---|---|
| `schema` | number | Always `1` for now |
| `id` | string | Lowercase name used as the file name |
| `name` | string | First name as shown |
| `updated` | string | When the card was built (UTC, to the minute) |
| `avatar` | object | `hair`, `skin`, `shirt`, `trousers` as `#rrggbb` |
| `sanctum` | string | `beach` or `rooftop` (the scene behind their character) |
| `hunter` | object | `rank` (E–S), `title`, `level`, `xp`, `stats` (`STR INT SENSE GOLD CHA` numbers) |
| `shadows` | array, optional | Extracted habit shadows: `id`, `name`, `glyph`, `tier`, `days` (a total, never a streak) |
| `gate` | object | This week's gate: `name`, `path`, `status`, `done`, `total`, `cleared` (a count) |
| `week` | object, optional | Last 7 days: `questsCleared`, `xp`, `byTrack` (five numbers). Numbers only, no quest text |
| `now` | array of strings | Up to 3 short lines the owner wrote under "Working on" |
| `asks` | array | Up to 5 open help-board items the owner wrote: `date`, `status`, `text` |

Text fields have angle brackets removed and are cut to 140 characters. The portal must still treat every string as untrusted text (set `textContent`, never `innerHTML`).

## Planned additions (not in v1)
- `lantern` / `replies`: short notes to the other person (stored on the sender's own card).
- `challenge`: self-reported progress for the weekly head-to-head.
- `scores`: high scores from the mini-games.
- `gift`: a cosmetic item sent to the other person.
