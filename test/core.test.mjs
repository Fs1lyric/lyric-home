import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const core = createRequire(import.meta.url)("../src/core.js");

const NOW = new Date(2026, 10, 9, 18, 0); // Mon 9 Nov 2026 (ISO week 46), local time
const day = (y, m, d) => new Date(y, m - 1, d, 12).getTime();
const note = (path, fm = {}, body = "", ctime = day(2026, 11, 1), mtime = ctime) => {
  const file = path.split("/").pop().replace(/\.md$/, "");
  const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  return { path, name: file, folder, fm, body, ctime, mtime };
};

test("isoWeek: 9 Nov 2026 is week 46, 1 Jan 2026 is week 1", () => {
  assert.deepEqual(core.isoWeek(NOW), { year: 2026, week: 46 });
  assert.deepEqual(core.isoWeek(new Date(2026, 0, 1)), { year: 2026, week: 1 });
  assert.deepEqual(core.isoWeek(new Date(2027, 0, 1)), { year: 2026, week: 53 });
});

test("dayKey uses local YYYY-MM-DD", () => {
  assert.equal(core.dayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("header: week kicker and long date", () => {
  assert.deepEqual(core.header(NOW, 3), { kicker: "Week 46 · 3 things to sort", title: "Monday, 9 November" });
  assert.equal(core.header(NOW, 1).kicker, "Week 46 · 1 thing to sort");
  assert.equal(core.header(NOW, 0).kicker, "Week 46 · inbox clear");
});

test("links in properties are normalised", () => {
  const n = note("a.md", { categories: ["[[Journal]]", "Goals"], topics: "[[Chess|chess]]" });
  assert.deepEqual(core.catsOf(n), ["Journal", "Goals"]);
  assert.deepEqual(core.topicsOf(n), ["Chess"]);
  assert.deepEqual(core.catsOf(note("b.md")), []);
});

test("inbox: root journal notes without topics, oldest first", () => {
  const notes = [
    note("2026-11-08 1200 b.md", { categories: ["[[Journal]]"] }, "x", day(2026, 11, 8)),
    note("2026-10-01 0900 a.md", { categories: ["[[Journal]]"] }, "x", day(2026, 10, 1)),
    note("tagged.md", { categories: ["[[Journal]]"], topics: ["[[Chess]]"] }),
    note("Daily/2026-11-09.md", { categories: ["[[Daily]]"] }),
    note("Wiki/x.md", { categories: ["[[Journal]]"] }),
    note("done.md", { categories: ["[[Journal]]"], sorted: true }),
  ];
  assert.deepEqual(core.inbox(notes).map(n => n.name), ["2026-10-01 0900 a", "2026-11-08 1200 b"]);
});

test("createdKey prefers the created property", () => {
  assert.equal(core.createdKey(note("a.md", { created: "2026-09-23" }, "", day(2026, 11, 1))), "2026-09-23");
  assert.equal(core.createdKey(note("a.md", {}, "", day(2026, 11, 2))), "2026-11-02");
});

test("wordCount ignores markdown, links keep their text", () => {
  assert.equal(core.wordCount("# Hi there\n- [ ] call [[Sam Smith|Sam]] now ![[img.png]]"), 5);
  assert.equal(core.wordCount(""), 0);
});

test("stripMarkdown keeps readable text", () => {
  assert.equal(core.stripMarkdown("**Bold** and [[Note|alias]] and [x](http://y) `c`\n> quote"), "Bold and alias and x c quote");
});

test("firstOpenTask finds the first unchecked box", () => {
  assert.deepEqual(core.firstOpenTask("- [x] done\n- [ ] ship it\n- [ ] later"), { text: "ship it", line: 1 });
  assert.equal(core.firstOpenTask("- [ ] \n- [x] a"), null);
});

test("weekTodos reads the to-do section of a review", () => {
  const body = "## Wins\n- [ ] not this\n## This week's to-dos\n<!-- hint -->\n- [x] Read 20 pages\n- [ ] Kata practice\n- [ ] \n## Delete or archive\n- [ ] nope";
  assert.deepEqual(core.weekTodos({ body }), [
    { text: "Read 20 pages", done: true, line: 4 },
    { text: "Kata practice", done: false, line: 5 },
  ]);
  assert.deepEqual(core.weekTodos(null), []);
});

test("currentReview: the weekly review created this ISO week", () => {
  const old = note("2026-11-08 Weekly Review.md", { categories: ["[[Reviews]]"], period: "week", created: "2026-11-08" });
  const cur = note("2026-11-09 Weekly Review.md", { categories: ["[[Reviews]]"], period: "week", created: "2026-11-09" });
  const month = note("2026-11-09 Monthly Review.md", { categories: ["[[Reviews]]"], period: "month", created: "2026-11-09" });
  assert.equal(core.currentReview([old, cur, month], NOW).name, "2026-11-09 Weekly Review");
  assert.equal(core.currentReview([old], NOW), null);
});

test("rhythm: habits today, best live streak, entries this week, week to-dos", () => {
  const notes = [
    note("Trackers/Kata.md", { categories: ["[[Trackers]]"], kind: "habit" }, "- 2026-11-07: yes\n- 2026-11-08: yes\n- 2026-11-09: yes"),
    note("Trackers/Reading.md", { categories: ["[[Trackers]]"], kind: "habit" }, "- 2026-11-08: yes"),
    note("Trackers/Blitz.md", { categories: ["[[Trackers]]"], kind: "number", goal: 1000 }, "- 2026-11-02: 900\n- 2026-11-09: 950"),
  ];
  const review = { body: "## This week's to-dos\n- [x] a\n- [ ] b\n- [x] c" };
  const r = Object.fromEntries(core.rhythm(notes, NOW, review).map(x => [x.id, [x.value, x.goal]]));
  assert.deepEqual(r, { habits: [1, 2], streak: [3, 7], entries: [2, 3], tasks: [2, 3] });
});

test("agoText", () => {
  assert.equal(core.agoText("2026-05-03", NOW), "6 months ago");
  assert.equal(core.agoText("2026-10-26", NOW), "2 weeks ago");
  assert.equal(core.agoText("2025-11-01", NOW), "1 year ago");
  assert.equal(core.agoText("2026-11-08", NOW), "yesterday");
});

test("pastYou: a due letter wins over memories", () => {
  const letter = note("Letter.md", { categories: ["[[Letters]]"], deliver: "2026-11-09", created: "2026-05-03" }, "Dear future me. Keep going.");
  const unopenedLater = note("L2.md", { categories: ["[[Letters]]"], deliver: "2027-01-01" }, "Not yet.");
  const opened = note("L3.md", { categories: ["[[Letters]]"], deliver: "2026-06-01", opened: true }, "Already read.");
  const mem = note("Daily/2026-09-23.md", { categories: ["[[Daily]]"], created: "2026-09-23" }, "I woke up at 8:00 am and ate breakfast before school.");
  const p = core.pastYou([unopenedLater, opened, mem, letter], NOW);
  assert.equal(p.kind, "letter");
  assert.equal(p.note.name, "Letter");
  assert.equal(p.ago, "6 months ago");
  assert.equal(p.excerpt, "Dear future me. Keep going.");
});

test("pastYou: otherwise a stable memory at least 30 days old", () => {
  const recent = note("Daily/2026-11-01.md", { created: "2026-11-01", categories: ["[[Daily]]"] }, "Recent enough words to count as a memory here.");
  const mem = note("Daily/2026-09-23.md", { created: "2026-09-23", categories: ["[[Daily]]"] }, "I woke up at 8:00 am and ate breakfast before school today.");
  const short = note("Daily/2026-09-01.md", { created: "2026-09-01", categories: ["[[Daily]]"] }, "tiny");
  const a = core.pastYou([recent, mem, short], NOW);
  assert.equal(a.kind, "memory");
  assert.equal(a.note.name, "2026-09-23");
  assert.deepEqual(core.pastYou([recent, mem, short], NOW), a, "same pick all day");
  assert.equal(core.pastYou([recent, short], NOW), null);
});

test("excerpt is trimmed on a word boundary", () => {
  const long = "word ".repeat(100);
  const e = core.excerpt(long, 40);
  assert.ok(e.length <= 41 && e.endsWith("…"), e);
});

test("nextSteps: inbox, letter, goal tasks, review; snooze and skip hide items", () => {
  const notes = [
    note("2026-10-01 0900 a.md", { categories: ["[[Journal]]"] }, "x", day(2026, 10, 1)),
    note("Chess goals.md", { categories: ["[[Goals]]"], topics: ["[[Chess]]"] }, "## Next step\n- [ ] Play 5 rapid games\n"),
    note("Paused.md", { categories: ["[[Projects]]"], status: "paused" }, "- [ ] nope"),
    note("Letter.md", { categories: ["[[Letters]]"], deliver: "2026-11-01", created: "2026-05-03" }, "Dear future me."),
  ];
  const ids = core.nextSteps(notes, NOW, {}).map(s => s.id);
  assert.deepEqual(ids, ["inbox", "letter:Letter.md", "task:Chess goals.md", "review"]);
  const goal = core.nextSteps(notes, NOW, {}).find(s => s.id === "task:Chess goals.md");
  assert.equal(goal.title, "Play 5 rapid games");
  assert.match(goal.sub, /Chess goals/);
  const hidden = core.nextSteps(notes, NOW, {
    snooze: { inbox: "2026-11-12" },
    skip: { "task:Chess goals.md": "2026-11-09", "review": "2026-11-08" },
  }).map(s => s.id);
  assert.deepEqual(hidden, ["letter:Letter.md", "review"]);
});

test("nextSteps: no review step once this week's review exists", () => {
  const rev = note("2026-11-09 Weekly Review.md", { categories: ["[[Reviews]]"], period: "week", created: "2026-11-09" });
  assert.ok(!core.nextSteps([rev], NOW, {}).some(s => s.id === "review"));
});

test("parseCapture: tasks vs thoughts", () => {
  assert.deepEqual(core.parseCapture("todo call Sam about karate"), { kind: "task", text: "call Sam about karate", title: "call Sam about karate" });
  assert.deepEqual(core.parseCapture("[] buy pens"), { kind: "task", text: "buy pens", title: "buy pens" });
  assert.deepEqual(core.parseCapture("- [ ] buy pens"), { kind: "task", text: "buy pens", title: "buy pens" });
  assert.deepEqual(core.parseCapture("  chess is about patience, not speed. really  "),
    { kind: "thought", text: "chess is about patience, not speed. really", title: "chess is about patience not" });
  assert.equal(core.parseCapture("   "), null);
});

test("safeTitle strips characters files can't hold", () => {
  assert.equal(core.safeTitle('a/b:c*?"<>|#^[]d'), "a b c d");
});

test("calendar: month grid starts Monday, marks notes and today", () => {
  const c = core.calendar(NOW, new Set(["2026-11-01", "2026-11-09"]));
  assert.equal(c.label, "November 2026");
  assert.equal(c.weeks[0][0].key, "2026-10-26");
  assert.equal(c.weeks[0][0].inMonth, false);
  const cells = c.weeks.flat();
  assert.equal(cells.find(x => x.key === "2026-11-01").hasNote, true);
  assert.equal(cells.find(x => x.key === "2026-11-09").today, true);
  assert.equal(cells.length % 7, 0);
});

// ---- trackers ----
const habit = (name, body, fm = {}) => note(`Trackers/${name}.md`, Object.assign({ categories: ["[[Trackers]]"], kind: "habit" }, fm), body);
const num = (name, body, fm = {}) => note(`Trackers/${name}.md`, Object.assign({ categories: ["[[Trackers]]"], kind: "number" }, fm), body);

test("parseEntries: dated lines, last one per day wins, sorted", () => {
  const body = "Notes about kata.\n- 2026-11-09: yes\n- 2026-11-07: no\n* 2026-11-08 :: 12.5 kg\n- 2026-11-09: 1\nnot an entry 2026-11-01: yes";
  assert.deepEqual(core.parseEntries(body), [
    { date: "2026-11-07", raw: "no" }, { date: "2026-11-08", raw: "12.5 kg" }, { date: "2026-11-09", raw: "1" },
  ]);
});

test("tracker: habit values become done flags; number values become numbers", () => {
  const h = core.tracker(habit("Kata", "- 2026-11-08: yes\n- 2026-11-09: no\n- 2026-11-07: done", { aliases: ["kata practice"] }));
  assert.deepEqual(h.entries.map(e => e.done), [true, true, false]);
  assert.deepEqual(h.names, ["kata", "kata practice"]);
  const n = core.tracker(num("Blitz Elo", "- 2026-11-08: 950\n- 2026-11-09: oops", { goal: 1000, unit: "Elo", aliases: "blitz" }));
  assert.deepEqual(n.entries.map(e => e.value), [950]);
  assert.equal(n.goal, 1000);
  assert.deepEqual(n.names, ["blitz elo", "blitz"]);
});

test("streak: counts back from today, or from yesterday if today isn't logged yet", () => {
  const t = core.tracker(habit("Kata", "- 2026-11-05: yes\n- 2026-11-06: yes\n- 2026-11-07: yes\n- 2026-11-08: yes"));
  assert.deepEqual(core.streak(t, NOW), { current: 4, best: 4, doneToday: false });
  const t2 = core.tracker(habit("Kata", "- 2026-11-01: yes\n- 2026-11-02: yes\n- 2026-11-03: yes\n- 2026-11-09: yes"));
  assert.deepEqual(core.streak(t2, NOW), { current: 1, best: 3, doneToday: true });
  assert.deepEqual(core.streak(core.tracker(habit("X", "")), NOW), { current: 0, best: 0, doneToday: false });
});

test("lastDays: done flags for the last 7 days, oldest first", () => {
  const t = core.tracker(habit("Kata", "- 2026-11-03: yes\n- 2026-11-09: yes\n- 2026-11-05: no"));
  assert.deepEqual(core.lastDays(t, NOW, 7).map(d => [d.key.slice(8), d.done]),
    [["03", true], ["04", false], ["05", false], ["06", false], ["07", false], ["08", false], ["09", true]]);
});

test("heatmap: Monday-first weeks, level = share of habits done that day", () => {
  const hs = [core.tracker(habit("A", "- 2026-11-09: yes\n- 2026-11-02: yes")), core.tracker(habit("B", "- 2026-11-09: yes"))];
  const h = core.heatmap(hs, NOW, 4);
  assert.equal(h.weeks.length, 4);
  assert.equal(h.weeks[3][0].key, "2026-11-09");
  assert.equal(h.weeks[3][0].level, 4);
  assert.equal(h.weeks[2][0].level, 2);
  assert.equal(h.weeks[3][1].future, true);
  assert.equal(h.total, 3);
});

test("series: number entries in a window, with change vs the previous entry", () => {
  const t = core.tracker(num("Blitz", "- 2026-08-01: 700\n- 2026-11-01: 900\n- 2026-11-08: 950", { goal: 1000 }));
  const s = core.series(t, NOW, 60);
  assert.deepEqual(s.points.map(p => p.value), [900, 950]);
  assert.equal(s.last, 950);
  assert.equal(s.delta, 50);
  assert.equal(s.min, 900);
  assert.equal(s.max, 1000, "max includes the goal so the goal line fits");
});

test("parseCapture with trackers: habit check-ins and number entries", () => {
  const ts = [core.tracker(habit("Kata", "")), core.tracker(num("Blitz Elo", "", { aliases: ["blitz", "elo"] })), core.tracker(habit("Bangla handwriting", "", { aliases: ["handwriting"] }))];
  assert.deepEqual(core.parseCapture("kata", ts), { kind: "entry", tracker: "Kata", raw: "yes", title: "Kata: done today" });
  assert.deepEqual(core.parseCapture("Kata no", ts), { kind: "entry", tracker: "Kata", raw: "no", title: "Kata: not today" });
  assert.deepEqual(core.parseCapture("blitz 1012", ts), { kind: "entry", tracker: "Blitz Elo", raw: "1012", title: "Blitz Elo: 1012" });
  assert.deepEqual(core.parseCapture("blitz elo 1012", ts), { kind: "entry", tracker: "Blitz Elo", raw: "1012", title: "Blitz Elo: 1012" });
  assert.deepEqual(core.parseCapture("bangla handwriting", ts).tracker, "Bangla handwriting");
  assert.equal(core.parseCapture("blitz is fun to play", ts).kind, "thought");
  assert.equal(core.parseCapture("kata was hard today", ts).kind, "thought");
});

test("model: trackers split into habits and numbers", () => {
  const m = core.model([habit("Kata", "- 2026-11-09: yes"), num("Blitz", "- 2026-11-09: 950"), note("Templates/Tracker Template.md", { categories: ["[[Trackers]]"], kind: "habit" })], NOW, {});
  assert.deepEqual(m.habits.map(h => [h.name, h.streak.current]), [["Kata", 1]]);
  assert.deepEqual(m.numbers.map(n => [n.name, n.series.last]), [["Blitz", 950]]);
  assert.equal(m.heatmap.weeks.length, 26);
});

test("nextSteps: a check-in step lists habits not done today", () => {
  const s = core.nextSteps([habit("Kata", "- 2026-11-09: yes"), habit("Reading", ""), habit("Painting", "- 2026-11-08: yes")], NOW, {});
  const c = s.find(x => x.id === "checkin");
  assert.equal(c.title, "2 habits left today");
  assert.equal(c.sub, "Painting · Reading");
});
