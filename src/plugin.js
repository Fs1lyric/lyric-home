// Lyric Home plugin: Obsidian glue. Reads notes, renders the ```lyric-home``` block, and runs the buttons.
// Rules: it only creates new notes or makes the single change a button names. It never edits notes in bulk.
const { Plugin, Modal, Notice, MarkdownRenderChild, normalizePath } = require("obsidian");
const core = require("./core");
const view = require("./view");

const pad = n => String(n).padStart(2, "0");
const hhmm = d => `${pad(d.getHours())}${pad(d.getMinutes())}`;
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const TPL = "Templates";

class HomeBlock extends MarkdownRenderChild {
  constructor(el, plugin) { super(el); this.plugin = plugin; }
  onload() { this.plugin.blocks.add(this); this.draw(); }
  onunload() { this.plugin.blocks.delete(this); }
  async draw() {
    const p = this.plugin;
    const now = new Date();
    const notes = await p.collect();
    const m = core.model(notes, now, p.state);
    this.model = m;
    const ui = { collapsed: p.state.collapsed, stepIndex: this.stepIndex || 0,
      onUi: u => { this.stepIndex = u.stepIndex; p.state.collapsed = u.collapsed; p.save(); view.render(this.containerEl, m, p.actions(this), ui, core); } };
    view.render(this.containerEl, m, p.actions(this), ui, core);
  }
}

module.exports = class LyricHome extends Plugin {
  async onload() {
    this.state = Object.assign({ snooze: {}, skip: {}, collapsed: {} }, await this.loadData());
    this.blocks = new Set();
    this.registerMarkdownCodeBlockProcessor("lyric-home", (src, el, ctx) => ctx.addChild(new HomeBlock(el, this)));
    let t = null;
    const refresh = () => { clearTimeout(t); t = setTimeout(() => this.blocks.forEach(b => b.draw()), 500); };
    this.registerEvent(this.app.metadataCache.on("changed", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));
    this.registerEvent(this.app.vault.on("rename", refresh));
    this.registerInterval(window.setInterval(refresh, 10 * 60 * 1000)); // the date rolls over
    this.addCommand({ id: "capture", name: "Capture a thought", callback: () => new TextModal(this.app, "Capture a thought", "", v => this.capture(v)).open() });
    this.addCommand({ id: "letter", name: "Write a letter to future me", callback: () => this.letter(null) });
    this.addCommand({ id: "sort-inbox", name: "Sort captured thoughts", callback: async () => this.sortInbox() });
  }
  save() { return this.saveData(this.state); }

  async collect() {
    const out = [];
    for (const f of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(f) || {};
      let body = await this.app.vault.cachedRead(f);
      const end = cache.frontmatterPosition && cache.frontmatterPosition.end;
      if (end) body = body.slice(end.offset).replace(/^\s*\n/, "");
      out.push({ path: f.path, name: f.basename, folder: f.parent && f.parent.path !== "/" ? f.parent.path : "", fm: cache.frontmatter || {}, body, ctime: f.stat.ctime, mtime: f.stat.mtime, file: f });
    }
    return out;
  }

  // ---- helpers ----
  file(path) { return this.app.vault.getAbstractFileByPath(normalizePath(path)); }
  async openFile(f) { if (f) await this.app.workspace.getLeaf("tab").openFile(f); }
  run(...ids) { for (const id of ids) if (this.app.commands.commands[id]) return this.app.commands.executeCommandById(id); new Notice("Command not available: " + ids[0]); }
  async template(name, title, now = new Date()) {
    const f = this.file(`${TPL}/${name}.md`);
    const raw = f ? await this.app.vault.read(f) : "";
    return raw.replace(/\{\{date(?::[^}]*)?\}\}/g, core.dayKey(now)).replace(/\{\{time(?::[^}]*)?\}\}/g, `${pad(now.getHours())}:${pad(now.getMinutes())}`).replace(/\{\{title\}\}/g, title);
  }
  async create(path, content) {
    path = normalizePath(path);
    const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (dir && !this.file(dir)) await this.app.vault.createFolder(dir);
    let p = path, i = 2;
    while (this.file(p)) p = path.replace(/\.md$/, ` ${i++}.md`);
    return this.app.vault.create(p, content);
  }
  async setProp(note, key, value) {
    await this.app.fileManager.processFrontMatter(note.file || this.file(note.path), fm => { fm[key] = value; });
  }
  async review(createIfMissing) {
    const notes = await this.collect();
    const r = core.currentReview(notes, new Date());
    if (r) return r;
    const now = new Date();
    // Obsidian's metadata cache can lag right after a create, so also look for today's review by name.
    const byName = this.file(`${core.dayKey(now)} Weekly Review.md`);
    if (byName) return { path: byName.path, file: byName, name: byName.basename };
    if (!createIfMissing) return null;
    const f = await this.create(`${core.dayKey(now)} Weekly Review.md`, await this.template("Weekly Review Template", "Weekly Review", now));
    return { path: f.path, file: f, name: f.basename };
  }

  // ---- actions ----
  async capture(text) {
    const c = core.parseCapture(text);
    if (!c) return;
    if (c.kind === "task") return this.addTodo(c.text);
    const now = new Date();
    const tpl = await this.template("Journal Template", c.title, now);
    const body = (tpl.trim() ? tpl.replace(/\s*$/, "\n") : `---\ncategories:\n  - "[[Journal]]"\ncreated: ${core.dayKey(now)}\n---\n`) + c.text + "\n";
    const f = await this.create(`${core.dayKey(now)} ${hhmm(now)} ${core.safeTitle(c.title) || "Thought"}.md`, body);
    new Notice(`Saved: ${f.basename}`);
  }
  async addTodo(text) {
    const r = await this.review(true);
    await this.app.vault.process(r.file || this.file(r.path), src => {
      const lines = src.split("\n");
      let head = lines.findIndex(l => /^#{1,6}\s.*to-?dos?/i.test(l));
      if (head < 0) { lines.push("", "## This week's to-dos"); head = lines.length - 1; }
      let at = head + 1, last = -1;
      for (let i = head + 1; i < lines.length && !/^#{1,6}\s/.test(lines[i]); i++) if (/^\s*[-*+]\s+\[.\]/.test(lines[i])) last = i;
      if (last >= 0) {
        if (/^\s*[-*+]\s+\[ \]\s*$/.test(lines[last])) { lines[last] = `- [ ] ${text}`; return lines.join("\n"); }
        at = last + 1;
      } else { while (at < lines.length && /^\s*<!--/.test(lines[at])) at++; }
      lines.splice(at, 0, `- [ ] ${text}`);
      return lines.join("\n");
    });
    new Notice("Added to this week's to-dos");
  }
  async toggleTodo(todo) {
    const r = await this.review(false);
    if (!r) return;
    const esc = todo.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^(\\s*[-*+]\\s+\\[)( |x|X)(\\]\\s*${esc}\\s*)$`, "m");
    await this.app.vault.process(r.file || this.file(r.path), src => src.replace(re, (_, a, b, c) => a + (b === " " ? "x" : " ") + c));
  }
  async openDay(key) {
    const f = this.file(`Daily/${key}.md`);
    if (f) return this.openFile(f);
    const d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)), 12);
    this.openFile(await this.create(`Daily/${key}.md`, await this.template("Daily Note Template", key, d)));
  }
  async letter(replyTo) {
    new LetterModal(this.app, replyTo, async (text, deliver) => {
      const now = new Date();
      const fm = `---\ncategories:\n  - "[[Letters]]"\ncreated: ${core.dayKey(now)}\ndeliver: ${deliver}\n${replyTo ? `reply-to: "[[${replyTo.name}]]"\n` : ""}---\n`;
      await this.create(`${core.dayKey(now)} Letter to future me.md`, fm + text.trim() + "\n");
      if (replyTo) await this.setProp(replyTo, "opened", true);
      new Notice(`Sealed until ${deliver}`);
    }).open();
  }
  async sortInbox() {
    const notes = await this.collect();
    const topics = notes.filter(n => n.folder === "Topics").map(n => n.name).sort();
    new SortModal(this.app, core.inbox(notes), topics, this).open();
  }
  logSomething() {
    new LogModal(this.app, async (kind, name) => {
      const tpl = { Book: "Book Template", Video: "Video Template", Person: "Person Template" }[kind];
      const f = await this.create(`References/${core.safeTitle(name)}.md`, await this.template(tpl, name));
      this.openFile(f);
    }).open();
  }

  actions(block) {
    const today = () => core.dayKey(new Date());
    return {
      open: n => this.openFile(n.file || this.file(n.path)),
      openPath: p => this.openFile(this.file(p)),
      openDaily: () => this.openDay(today()),
      openDay: k => this.openDay(k),
      openReview: async () => this.openFile((await this.review(true)).file),
      search: () => this.run("omnisearch:show-modal", "global-search:open"),
      newNote: () => this.run("zk-prefixer", "file-explorer:new-file"),
      randomNote: () => this.run("random-note:open-random-note", "random-note"),
      log: () => this.logSomething(),
      letter: n => this.letter(n),
      keepLetter: async n => { await this.setProp(n, "opened", true); new Notice("Kept. It stays in your vault."); },
      capture: v => this.capture(v),
      addTodo: v => this.addTodo(v),
      toggleTodo: t => this.toggleTodo(t),
      step: async s => {
        if (s.kind === "inbox") return this.sortInbox();
        if (s.kind === "review") return this.openFile((await this.review(true)).file);
        if (s.note) return this.openFile(s.note.file || this.file(s.note.path));
      },
      snooze: async (s, days) => { this.state.snooze[s.id] = core.dayKey(addDays(new Date(), days)); await this.save(); block.draw(); },
      skip: async s => { this.state.skip[s.id] = today(); await this.save(); block.draw(); },
    };
  }
};

// ---- modals ----
class TextModal extends Modal {
  constructor(app, title, value, done) { super(app); this.t = title; this.v = value; this.done = done; }
  onOpen() {
    this.titleEl.setText(this.t);
    const ta = this.contentEl.createEl("textarea", { cls: "lh-modal-text" });
    ta.value = this.v; ta.focus();
    const row = this.contentEl.createDiv({ cls: "lh-modal-row" });
    row.createEl("button", { text: "Save", cls: "mod-cta" }).onclick = () => { this.done(ta.value); this.close(); };
  }
  onClose() { this.contentEl.empty(); }
}
class LetterModal extends Modal {
  constructor(app, replyTo, done) { super(app); this.replyTo = replyTo; this.done = done; }
  onOpen() {
    this.titleEl.setText(this.replyTo ? "Reply to past you" : "A letter to future you");
    this.contentEl.createEl("p", { cls: "lh-modal-hint", text: "It stays sealed and comes back on Home on the date you pick." });
    const ta = this.contentEl.createEl("textarea", { cls: "lh-modal-text", attr: { placeholder: "Dear future me," } });
    const row = this.contentEl.createDiv({ cls: "lh-modal-row" });
    row.createSpan({ text: "Deliver on " });
    const d = row.createEl("input", { type: "date" });
    d.value = core.dayKey(addDays(new Date(), 182));
    row.createEl("button", { text: "Seal it", cls: "mod-cta" }).onclick = () => { if (ta.value.trim()) { this.done(ta.value, d.value); this.close(); } };
    ta.focus();
  }
  onClose() { this.contentEl.empty(); }
}
class LogModal extends Modal {
  constructor(app, done) { super(app); this.done = done; }
  onOpen() {
    this.titleEl.setText("Log something");
    let kind = "Book";
    const kinds = this.contentEl.createDiv({ cls: "lh-modal-row" });
    const btns = ["Book", "Video", "Person"].map(k => {
      const b = kinds.createEl("button", { text: k });
      b.onclick = () => { kind = k; btns.forEach(x => x.toggleClass("mod-cta", x === b)); name.focus(); };
      return b;
    });
    btns[0].addClass("mod-cta");
    const name = this.contentEl.createEl("input", { type: "text", cls: "lh-modal-input", attr: { placeholder: "Name or title" } });
    name.addEventListener("keydown", e => { if (e.key === "Enter" && name.value.trim()) { this.done(kind, name.value.trim()); this.close(); } });
    name.focus();
  }
  onClose() { this.contentEl.empty(); }
}
class SortModal extends Modal {
  constructor(app, items, topics, plugin) { super(app); this.items = items; this.topics = topics; this.plugin = plugin; }
  onOpen() {
    this.titleEl.setText(this.items.length ? `Sort ${this.items.length} thought${this.items.length === 1 ? "" : "s"}` : "Nothing to sort");
    this.contentEl.createEl("p", { cls: "lh-modal-hint", text: "Pick a topic for each. That's all sorting means here." });
    for (const n of this.items) {
      const row = this.contentEl.createDiv({ cls: "lh-sort-row" });
      const t = row.createDiv({ cls: "lh-sort-text" });
      t.createEl("a", { text: n.name, href: "#" }).onclick = e => { e.preventDefault(); this.plugin.openFile(n.file); };
      t.createDiv({ cls: "lh-sort-sub", text: core.excerpt(n.body, 120) });
      const chips = row.createDiv({ cls: "lh-sort-chips" });
      for (const topic of this.topics) {
        chips.createEl("button", { text: topic }).onclick = async () => { await this.plugin.setProp(n, "topics", [`[[${topic}]]`]); row.remove(); };
      }
      chips.createEl("button", { text: "No topic", cls: "mod-muted" }).onclick = async () => { await this.plugin.setProp(n, "sorted", true); row.remove(); };
    }
  }
  onClose() { this.contentEl.empty(); }
}
