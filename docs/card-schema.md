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
| `today` | object, optional | `date` and `cleared` (0 to 5): how many of today's five daily quests are done. A number only, no quest text. Drives "Pass the flame": each person's fire grows with it, the two fires link when both have 3+ on the same day, and burn violet at 5 each. A card older than a day just shows a quiet ember |
| `now` | array of strings | Up to 3 short lines the owner wrote under "Working on" |
| `asks` | array | Up to 5 open help-board items the owner wrote: `date`, `status`, `text` |
| `lanterns` | array, optional | Up to 3 one-line notes the owner wrote to a friend in the last 7 days: `date`, `to` (the friend's `id`), `text`. The plaza floats each one across the **recipient's** half and fades it after a week. Like everything on a card, the text is public once published, so write it as if it were |

Text fields have angle brackets removed and are cut to 140 characters. The portal must still treat every string as untrusted text (set `textContent`, never `innerHTML`).

## Planned additions (not in v1)
- `replies`: answers to help-board asks (stored on the sender's own card).
- `challenge`: self-reported progress for the weekly head-to-head.
- `scores`: high scores from the mini-games.
- `gift`: a cosmetic item sent to the other person.
