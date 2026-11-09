# Next: rebuild second-brain as a tracking + research vault

**Status 2026-11-09 (late):** DONE: trackers (habits with check-ins, 7-day dots, streaks, 6-month heatmap; numbers with SVG line charts and goal lines;
capture logs `kata` / `blitz 1012`; New tracker modal; 41 tests green; screenshots OK). The vault has 5 habits and 3 Elo trackers in `Trackers/`.
**Left:** goals & projects with `progress` bars, the research board (question / to-read / reading / done), replacing the Journal and
"Close the day" buttons (journaling moved to vaulted), and updating the vault's `/daily` command into `/log`.

Written 2026-11-09 at the end of a long session. Start a fresh session with:
"Read ~/claude/lyric-home/PLAN.md and build it."

## Where things stand
- **Vault** `~/claude/second-brain` (private Fs1lyric/second-brain, git, Obsidian 1.15) is **empty on purpose**: the user restarted it.
  Left: `Home.md` (```lyric-home``` block), `Style Guide.md`, `CLAUDE.md` (AI writes only in `Wiki/` + `Raw/`),
  `Templates/` (+ `Templates/Bases/*.base`), `Categories/`, `Topics/`, empty `Wiki/index.md` + `log.md`.
  Journaling moved to the **vaulted** vault (`~/Info maxxer/vaulted`, `📓 Daily Journal`); do not bring it back.
- **Look:** dark Paper (`theme/paper.css` → vault `.obsidian/snippets/paper.css`), appearance `"theme": "obsidian"`.
  The user hates bright UIs, so keep everything dark.
- **Dashboard plugin**: this repo (public Fs1lyric/lyric-home). `src/core.js` holds the rules (tested), `src/view.js` the DOM,
  `src/plugin.js` the Obsidian glue, and `scripts/build.mjs` builds `main.js` and `styles.css` with fonts inlined. Install with `./install.sh ~/claude/second-brain`.
- **CI** (public repo, so Actions is free; private repos are billing-blocked) runs `node --test test/*.test.mjs`,
  a build-is-current check and Playwright screenshots of `demo/notes.mjs` → artifact `screenshots`.
  The last finished run failed only because the fake Obsidian in `test/plugin.test.mjs` lacked `.on()` and `window`;
  the fix is pushed (commit "Fake Obsidian: event hooks and window"), and that run was still queued. **Check it first.**
- Testing rule: never launch GUI apps or test suites on the user's PC. Use CI. Show the user the screenshots.

## What the user wants tracked (all four)
1. **Numbers over time**: chess Elo (blitz/rapid/bullet), reps, weight, anything with a value per day, as line charts.
2. **Habits & streaks**: daily yes/no habits (kata, painting, reading, coding), streaks and a year heatmap.
3. **Goals & projects**: status, next step, progress %.
4. **Research pipeline**: sources to-read → reading → done; open questions → conclusion.

## Proposed design (confirm briefly, then build)
- **Data in plain notes** (file over app):
  - one note per tracker in `Trackers/` (`categories: [[Trackers]]`, `kind: number|habit`, `unit`, `goal`, `topics`), with entries as lines in the body: `- 2026-11-09: 1012` / `- 2026-11-09: yes`.
  - Goals and Projects keep `status` and get `progress` (0-100).
  - Research items (`categories: [[Research]]`) get `stage: question|to-read|reading|done` and `conclusion`. Sources go in `Raw/`, AI summaries in `Wiki/`.
- **core.js** (tests first): `parseEntries`, `series` (for charts), `streak`/`longestStreak`, `heatmap(year)`, `researchBoard`,
  `goalProgress`. Replace the journal parts of the model (`pastYou`, journal `inbox`, words/captures rings) with tracker
  rings, but keep `nextSteps`, `weekTodos`, `calendar` and capture.
- **Capture box** rules: `elo 1012`, `kata yes` or `weight 61.5` appends today's entry to the matching tracker
  (matched by tracker name or alias); `todo …` adds a to-do; `? question` creates a research question; anything else saves a research note.
- **Home layout**: header + capture, today's check-ins (habit toggles), charts (inline SVG sparklines/line charts,
  no libraries), streaks + heatmap, goals & projects with progress bars, research board (3 columns), week to-dos, calendar.
- **Vault side**: add `Categories/Trackers.md`, `Templates/Tracker Template.md` and `Research Template.md`; update `Style Guide.md`
  (drop the Daily/journal rhythm, add a 2-minute check-in plus a weekly review of the charts); update `CLAUDE.md`'s `/daily`
  command into `/log` (append tracker entries) and keep `/ingest` `/ask` `/lint`. Remove the Daily note template and the Alt+D wording.
- Update `demo/notes.mjs` with invented trackers so the screenshots show the charts. Check the wide, narrow and dark screenshots before reporting.

## Open questions to ask the user (one AskUserQuestion)
- Which trackers to create on day one (the list above is from earlier chats: chess Elo goals 1000 blitz / 700 bullet /
  1000 rapid, kata, painting, reading, Bangla handwriting).
