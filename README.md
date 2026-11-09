# Lyric Home

A calm home dashboard for Obsidian that reads your own notes. Everything on it is decided by plain rules; there is no AI.


- **Capture:** one box. Text becomes a timestamped journal note; `todo …` adds a to-do to this week's review.
- **Next best step:** the most useful thing to do now (sort captured thoughts, read a letter, a goal's next step, the weekly review).
- **Today's rhythm:** words written today, thoughts captured, this week's to-dos, and goals touched.
- **From past you:** letters to future you arrive on the date you chose; otherwise an old note of yours resurfaces.
- **Next steps:** the first open checkbox of every active goal and project, with Snooze and Not today.
- **This week's outcomes** and a **calendar** of your daily notes.

It never edits notes in bulk. Buttons only create new notes or make the one change they name.

## Expected vault shape
Notes carry `categories` (`[[Journal]]`, `[[Goals]]`, `[[Projects]]`, `[[Reviews]]`, `[[Letters]]`, `[[Daily]]`) and optional `topics`. Daily notes go in `Daily/YYYY-MM-DD.md`; templates are in `Templates/` (`Journal Template`, `Daily Note Template`, `Weekly Review Template`, `Book/Video/Person Template`). Goals and projects use `status` (`idea`, `active`, `paused`, `done`, `dropped`).

## Install
Copy `main.js`, `manifest.json` and `styles.css` to `<vault>/.obsidian/plugins/lyric-home/`, enable it, then put this in a note:

````
```lyric-home
```
````

Add `cssclasses: [lh-home]` to that note's properties for a full-width page.

## Develop
`node --test test/*.test.mjs` runs the rule tests. `node scripts/build.mjs` builds `main.js` and `styles.css` from `src/` (fonts get inlined). CI renders `demo/notes.mjs`, an invented vault, to screenshots.

Fonts: Newsreader and Inter, both SIL Open Font License (see `fonts/`).
