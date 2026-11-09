// Tests the built main.js against a fake, in-memory Obsidian.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";

class Notice { constructor(msg) { Notice.last = msg; } }
class Plugin { constructor(app) { this.app = app; this._data = null; } async loadData() { return this._data; } async saveData(d) { this._data = JSON.parse(JSON.stringify(d)); }
  registerMarkdownCodeBlockProcessor(lang, fn) { this.blockLang = lang; } registerEvent() {} registerInterval() {} addCommand(c) { (this.cmds ||= []).push(c.id); } }
class Modal { constructor(app) { this.app = app; } open() { Modal.opened = this.constructor.name; } close() {} }
class MarkdownRenderChild { constructor(el) { this.containerEl = el; } }
const obsidian = { Plugin, Modal, Notice, MarkdownRenderChild, normalizePath: p => p.replace(/\/+/g, "/").replace(/^\//, "") };
const origLoad = Module._load;
Module._load = function (req, ...rest) { return req === "obsidian" ? obsidian : origLoad.call(this, req, ...rest); };
globalThis.window = { setInterval: () => 0 }; // the plugin's refresh timer must not keep node alive
const LyricHome = createRequire(import.meta.url)("../main.js");

const WEEKLY = `---
categories:
  - "[[Reviews]]"
created: {{date}}
period: week
---
## Wins


## This week's to-dos
<!-- The one to-do list for the week. -->
- [ ]

## Delete or archive
`;
const JOURNAL = `---
categories:
  - "[[Journal]]"
topics: []
created: {{date}}
---
`;

function fakeApp(files) {
  const store = new Map(Object.entries(files).map(([p, v]) => [p, typeof v === "string" ? { content: v, fm: {} } : v]));
  const tfile = p => { const name = p.split("/").pop(); const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "/";
    return { path: p, basename: name.replace(/\.md$/, ""), extension: "md", parent: { path: dir }, stat: { ctime: Date.now(), mtime: Date.now() } }; };
  const folders = new Set();
  const opened = [];
  const parseFm = c => { const m = c.match(/^---\n([\s\S]*?)\n---\n?/); return m ? { end: m[0].length } : null; };
  const app = {
    opened, store, ran: [],
    vault: {
      on: () => ({}),
      getMarkdownFiles: () => [...store.keys()].filter(p => p.endsWith(".md")).map(tfile),
      getAbstractFileByPath: p => store.has(p) ? tfile(p) : folders.has(p) ? { path: p } : null,
      cachedRead: async f => store.get(f.path).content,
      read: async f => store.get(f.path).content,
      create: async (p, c) => { if (store.has(p)) throw new Error("exists " + p); store.set(p, { content: c, fm: {} }); return tfile(p); },
      createFolder: async p => folders.add(p),
      process: async (f, fn) => { const s = store.get(f.path); s.content = fn(s.content); return s.content; },
    },
    metadataCache: { on: () => ({}), getFileCache: f => { const s = store.get(f.path); const fm = parseFm(s.content);
      return { frontmatter: s.fm, frontmatterPosition: fm ? { end: { offset: fm.end } } : undefined }; } },
    fileManager: { processFrontMatter: async (f, fn) => fn(store.get(f.path).fm) },
    workspace: { getLeaf: () => ({ openFile: async f => opened.push(f.path) }) },
    commands: { commands: { "zk-prefixer": 1, "global-search:open": 1 }, executeCommandById: id => app.ran.push(id) },
  };
  return app;
}
async function setup(files) {
  const app = fakeApp(Object.assign({ "Templates/Weekly Review Template.md": WEEKLY, "Templates/Journal Template.md": JOURNAL, "Templates/Daily Note Template.md": "---\ncreated: {{date}}\n---\n" }, files));
  const p = new LyricHome(app);
  await p.onload();
  const block = { draw: () => { block.drawn = (block.drawn || 0) + 1; } };
  return { app, p, a: p.actions(block), block };
}
const at = () => { mock.timers.reset(); mock.timers.enable({ apis: ["Date"], now: new Date(2026, 10, 9, 18, 5).getTime() }); };

test("onload registers the code block and commands", async () => {
  const { p } = await setup({});
  assert.equal(p.blockLang, "lyric-home");
  assert.deepEqual(p.cmds, ["capture", "letter", "sort-inbox"]);
});

test("capture: a thought becomes a timestamped journal note in the root", async () => {
  at();
  const { app, a } = await setup({});
  await a.capture("Shadows are never grey, mix the complement");
  const path = "2026-11-09 1805 Shadows are never grey mix.md"; // title = first five words
  assert.ok(app.store.has(path), [...app.store.keys()].join("\n"));
  const c = app.store.get(path).content;
  assert.match(c, /categories:\n  - "\[\[Journal\]\]"/);
  assert.match(c, /created: 2026-11-09/);
  assert.ok(c.endsWith("Shadows are never grey, mix the complement\n"));
  mock.timers.reset();
});

test("capture: same minute twice does not overwrite", async () => {
  at();
  const { app, a } = await setup({});
  await a.capture("same idea");
  await a.capture("same idea");
  assert.ok(app.store.has("2026-11-09 1805 same idea.md") && app.store.has("2026-11-09 1805 same idea 2.md"));
  mock.timers.reset();
});

test("capture: todo creates this week's review and fills the empty to-do line", async () => {
  at();
  const { app, a } = await setup({});
  await a.capture("todo book the grading slot");
  const r = app.store.get("2026-11-09 Weekly Review.md").content;
  assert.match(r, /## This week's to-dos\n<!-- The one to-do list for the week. -->\n- \[ \] book the grading slot\n\n## Delete/);
  await a.addTodo("clean the art folder");
  assert.match(app.store.get("2026-11-09 Weekly Review.md").content, /- \[ \] book the grading slot\n- \[ \] clean the art folder\n/);
  mock.timers.reset();
});

test("toggleTodo flips only that line", async () => {
  at();
  const rev = { content: "---\ncreated: 2026-11-09\n---\n## This week's to-dos\n- [ ] a (b)\n- [ ] c\n", fm: { categories: ["[[Reviews]]"], period: "week", created: "2026-11-09" } };
  const { app, a } = await setup({ "2026-11-09 Weekly Review.md": rev });
  await a.toggleTodo({ text: "a (b)", done: false });
  assert.match(app.store.get("2026-11-09 Weekly Review.md").content, /- \[x\] a \(b\)\n- \[ \] c/);
  await a.toggleTodo({ text: "a (b)", done: true });
  assert.match(app.store.get("2026-11-09 Weekly Review.md").content, /- \[ \] a \(b\)\n/);
  mock.timers.reset();
});

test("collect strips frontmatter and reads folders", async () => {
  const { p } = await setup({ "Daily/2026-11-09.md": { content: "---\ncreated: 2026-11-09\n---\n\nHello there", fm: { created: "2026-11-09" } } });
  const n = (await p.collect()).find(x => x.path === "Daily/2026-11-09.md");
  assert.equal(n.body, "Hello there");
  assert.equal(n.folder, "Daily");
  assert.equal(n.name, "2026-11-09");
  assert.equal((await p.collect()).find(x => x.path === "Templates/Journal Template.md").folder, "Templates");
});

test("snooze and not-today are saved and hide the step", async () => {
  at();
  const { p, a, block } = await setup({});
  await a.snooze({ id: "inbox" }, 3);
  await a.skip({ id: "review" });
  assert.equal(p._data.snooze.inbox, "2026-11-12");
  assert.equal(p._data.skip.review, "2026-11-09");
  assert.equal(block.drawn, 2);
  mock.timers.reset();
});

test("openDay opens or creates the daily note; keepLetter marks it opened", async () => {
  at();
  const { app, a } = await setup({ "L.md": { content: "Dear me", fm: { categories: ["[[Letters]]"] } } });
  await a.openDay("2026-11-09");
  assert.ok(app.store.has("Daily/2026-11-09.md"));
  assert.match(app.store.get("Daily/2026-11-09.md").content, /created: 2026-11-09/);
  assert.deepEqual(app.opened, ["Daily/2026-11-09.md"]);
  await a.keepLetter({ path: "L.md" });
  assert.equal(app.store.get("L.md").fm.opened, true);
  mock.timers.reset();
});

test("buttons fall back to built-in commands", async () => {
  const { app, a } = await setup({});
  a.search(); a.newNote();
  assert.deepEqual(app.ran, ["global-search:open", "zk-prefixer"]);
});

test("toggleHabit adds today's yes, then removes it", async () => {
  at();
  const k = { content: "---\nkind: habit\n---\nNotes.\n- 2026-11-08: yes\n", fm: { categories: ["[[Trackers]]"], kind: "habit" } };
  const { app, a } = await setup({ "Trackers/Kata.md": k });
  const core = createRequire(import.meta.url)("../src/core.js");
  const h = () => core.tracker({ path: "Trackers/Kata.md", name: "Kata", folder: "Trackers", fm: k.fm, body: app.store.get("Trackers/Kata.md").content });
  await a.toggleHabit(h());
  assert.equal(app.store.get("Trackers/Kata.md").content, "---\nkind: habit\n---\nNotes.\n- 2026-11-08: yes\n- 2026-11-09: yes\n");
  await a.toggleHabit(h());
  assert.equal(app.store.get("Trackers/Kata.md").content, "---\nkind: habit\n---\nNotes.\n- 2026-11-08: yes\n");
  mock.timers.reset();
});

test("logNumber replaces today's value; capture logs tracker entries", async () => {
  at();
  const b = { content: "---\nkind: number\n---\n- 2026-11-08: 950\n\nSome notes below.\n", fm: { categories: ["[[Trackers]]"], kind: "number", aliases: ["blitz"] } };
  const { app, a } = await setup({ "Trackers/Blitz Elo.md": b });
  await a.logNumber({ path: "Trackers/Blitz Elo.md", name: "Blitz Elo" }, "1001");
  await a.logNumber({ path: "Trackers/Blitz Elo.md", name: "Blitz Elo" }, "1012");
  assert.equal(app.store.get("Trackers/Blitz Elo.md").content, "---\nkind: number\n---\n- 2026-11-08: 950\n- 2026-11-09: 1012\n\nSome notes below.\n");
  await a.logNumber({ path: "Trackers/Blitz Elo.md", name: "Blitz Elo" }, "abc");
  assert.match(app.store.get("Trackers/Blitz Elo.md").content, /2026-11-09: 1012\n/);
  await a.capture("blitz 1020");
  assert.match(app.store.get("Trackers/Blitz Elo.md").content, /- 2026-11-09: 1020\n\nSome/);
  assert.ok(![...app.store.keys()].some(p => p.startsWith("2026-11-09 1805")), "an entry is not saved as a thought");
  mock.timers.reset();
});
