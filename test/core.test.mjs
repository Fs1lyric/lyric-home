import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const core = createRequire(import.meta.url)("../src/core.js");

const NOW = new Date(2026, 10, 9, 18, 0); // Sun 9 Nov 2026, local time
const day = (y, m, d) => new Date(y, m - 1, d, 12).getTime();
const note = (path, fm = {}, body = "", ctime = day(2026, 11, 1), mtime = ctime) => {
  const file = path.split("/").pop().replace(/\.md$/, "");
  const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  return { path, name: file, folder, fm, body, ctime, mtime };
};

test("isoWeek: 9 Nov 2026 is week 45, 1 Jan 2026 is week 1", () => {
  assert.deepEqual(core.isoWeek(NOW), { year: 2026, week: 45 });
  assert.deepEqual(core.isoWeek(new Date(2026, 0, 1)), { year: 2026, week: 1 });
  assert.deepEqual(core.isoWeek(new Date(2027, 0, 1)), { year: 2026, week: 53 });
});

test("dayKey uses local YYYY-MM-DD", () => {
  assert.equal(core.dayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("header: week kicker and long date", () => {
  assert.deepEqual(core.header(NOW, 3), { kicker: "Week 45 · 3 things to sort", title: "Sunday, 9 November" });
  assert.equal(core.header(NOW, 1).kicker, "Week 45 · 1 thing to sort");
  assert.equal(core.header(NOW, 0).kicker, "Week 45 · inbox clear");
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
  const old = note("2026-11-01 Weekly Review.md", { categories: ["[[Reviews]]"], period: "week", created: "2026-11-01" });
  const cur = note("2026-11-03 Weekly Review.md", { categories: ["[[Reviews]]"], period: "week", created: "2026-11-03" });
  const month = note("2026-11-05 Monthly Review.md", { categories: ["[[Reviews]]"], period: "month", created: "2026-11-05" });
  assert.equal(core.currentReview([old, cur, month], NOW).name, "2026-11-03 Weekly Review");
  assert.equal(core.currentReview([old], NOW), null);
});

test("rhythm: words and captures today, tasks this week, goals touched", () => {
  const today = day(2026, 11, 9);
  const notes = [
    note("Daily/2026-11-09.md", { categories: ["[[Daily]]"], created: "2026-11-09" }, "one two three", today),
    note("2026-11-09 1000 idea.md", { categories: ["[[Journal]]"] }, "four five", today),
    note("old.md", { categories: ["[[Journal]]"], created: "2026-11-01" }, "many words here", day(2026, 11, 1), today),
    note("Goal A.md", { categories: ["[[Goals]]"], status: "active" }, "", day(2026, 10, 1), day(2026, 11, 7)),
    note("Goal B.md", { categories: ["[[Goals]]"] }, "", day(2026, 10, 1), day(2026, 10, 2)),
    note("Done P.md", { categories: ["[[Projects]]"], status: "done" }, "", day(2026, 10, 1), today),
  ];
  const review = { body: "## This week's to-dos\n- [x] a\n- [ ] b\n- [x] c" };
  const r = Object.fromEntries(core.rhythm(notes, NOW, review).map(x => [x.id, [x.value, x.goal]]));
  assert.deepEqual(r, { words: [5, 300], captures: [1, 3], tasks: [2, 3], goals: [1, 2] });
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
