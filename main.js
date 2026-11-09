/* Lyric Home: built by scripts/build.mjs from src/. Do not edit. */
"use strict";
const __m = {};
__m["core"] = (function(){ const module = { exports: {} }; // Lyric Home core: pure rules that turn notes into a dashboard model. No Obsidian, no DOM, no AI.
// A note is { path, name, folder, fm, body, ctime, mtime } (body without frontmatter).

const DAY = 86400000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = n => String(n).padStart(2, "0");

function dayKey(d) {
  d = d instanceof Date ? d : new Date(d);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function keyToDate(k) {
  const [y, m, d] = String(k).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - y0) / DAY + 1) / 7) };
}
function startOfIsoWeek(now) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// ---- properties ----
function linkName(v) {
  const s = String(v ?? "").trim();
  const m = s.match(/^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/);
  return (m ? m[1] : s).split("/").pop().trim();
}
const list = v => (v == null || v === "" ? [] : Array.isArray(v) ? v : [v]).map(linkName).filter(Boolean);
const catsOf = n => list(n.fm && n.fm.categories);
const topicsOf = n => list(n.fm && n.fm.topics);
const hasCat = (n, c) => catsOf(n).includes(c);
function createdKey(n) {
  const c = n.fm && n.fm.created;
  if (c && /^\d{4}-\d{2}-\d{2}/.test(String(c))) return String(c).slice(0, 10);
  return dayKey(n.ctime);
}
const isOwn = n => !/^(Templates|Wiki|Raw|Categories|Topics|Attachments)(\/|$)/.test(n.folder);

// ---- text ----
function stripMarkdown(t) {
  return String(t || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[\[[^\]]*\]\]/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[-*+]\s+\[.\]\s*/gm, "")
    .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s*/gm, "")
    .replace(/[*_`~=]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function wordCount(t) {
  const s = stripMarkdown(t);
  return s ? s.split(" ").filter(w => /[\p{L}\p{N}]/u.test(w)).length : 0;
}
function excerpt(t, max = 220) {
  const s = stripMarkdown(t);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "") + "…";
}
function safeTitle(t) {
  return String(t).replace(/[\\/:*?"<>|#^\[\]]+/g, " ").replace(/\s+/g, " ").trim();
}

// ---- tasks ----
const TASK = /^\s*[-*+]\s+\[( |x|X)\]\s*(.*)$/;
function firstOpenTask(body) {
  const lines = String(body || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TASK);
    if (m && m[1] === " " && m[2].trim()) return { text: m[2].trim(), line: i };
  }
  return null;
}
function weekTodos(review) {
  if (!review) return [];
  const lines = String(review.body || "").split("\n");
  const out = [];
  let inside = false;
  lines.forEach((l, i) => {
    if (/^#{1,6}\s/.test(l)) { inside = /to-?dos?/i.test(l); return; }
    if (!inside) return;
    const m = l.match(TASK);
    if (m && m[2].trim()) out.push({ text: m[2].trim(), done: m[1] !== " ", line: i });
  });
  return out;
}

// ---- dashboard pieces ----
function inbox(notes) {
  return notes
    .filter(n => n.folder === "" && hasCat(n, "Journal") && topicsOf(n).length === 0 && !(n.fm && n.fm.sorted))
    .sort((a, b) => a.ctime - b.ctime);
}
function header(now, inboxCount) {
  const { week } = isoWeek(now);
  const tail = inboxCount === 0 ? "inbox clear" : `${inboxCount} thing${inboxCount === 1 ? "" : "s"} to sort`;
  return { kicker: `Week ${week} · ${tail}`, title: `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}` };
}
function currentReview(notes, now) {
  const start = dayKey(startOfIsoWeek(now)), end = dayKey(new Date(startOfIsoWeek(now).getTime() + 6 * DAY));
  const revs = notes
    .filter(n => hasCat(n, "Reviews") && String((n.fm && n.fm.period) || "week") === "week")
    .filter(n => { const k = createdKey(n); return k >= start && k <= end; })
    .sort((a, b) => createdKey(b).localeCompare(createdKey(a)));
  return revs[0] || null;
}
const isActive = n => (hasCat(n, "Goals") || hasCat(n, "Projects")) && !["done", "dropped", "paused"].includes(String((n.fm && n.fm.status) || "").toLowerCase());

function rhythm(notes, now, review) {
  const ts = trackers(notes);
  const habits = ts.filter(x => x.kind === "habit");
  const streaks = habits.map(h => streak(h, now));
  const weekStart = dayKey(startOfIsoWeek(now));
  const entries = ts.reduce((s, x) => s + x.entries.filter(en => en.date >= weekStart && en.date <= dayKey(now)).length, 0);
  const todos = weekTodos(review);
  return [
    { id: "habits", value: streaks.filter(s => s.doneToday).length, goal: habits.length, label: "habits today" },
    { id: "streak", value: Math.max(0, ...streaks.map(s => s.current)), goal: 7, label: "best streak" },
    { id: "entries", value: entries, goal: ts.length, label: "logged this week" },
    { id: "tasks", value: todos.filter(x => x.done).length, goal: todos.length, label: "week to-dos" },
  ];
}

// ---- trackers ----
const ENTRY = /^\s*[-*+]\s+(\d{4}-\d{2}-\d{2})\s*:{1,2}\s*(.*?)\s*$/;
const YES = /^(yes|y|done|x|1|true|✓|✔)$/i;
function parseEntries(body) {
  const by = new Map();
  for (const l of String(body || "").split("\n")) { const m = l.match(ENTRY); if (m) by.set(m[1], m[2]); }
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, raw]) => ({ date, raw }));
}
function tracker(n) {
  const fm = n.fm || {};
  const kind = String(fm.kind || "habit").toLowerCase() === "number" ? "number" : "habit";
  const raw = parseEntries(n.body);
  const entries = kind === "habit"
    ? raw.map(e => Object.assign(e, { done: YES.test(e.raw) }))
    : raw.map(e => Object.assign(e, { value: parseFloat(e.raw) })).filter(e => Number.isFinite(e.value));
  const aliases = (Array.isArray(fm.aliases) ? fm.aliases : fm.aliases ? [fm.aliases] : []).map(a => String(a).toLowerCase().trim()).filter(Boolean);
  const goal = fm.goal === undefined || fm.goal === null || fm.goal === "" ? null : Number(fm.goal);
  return { name: n.name, path: n.path, note: n, kind, unit: fm.unit ? String(fm.unit) : "", goal: Number.isFinite(goal) ? goal : null,
    color: fm.color ? String(fm.color) : "", names: [n.name.toLowerCase(), ...aliases], entries };
}
function trackers(notes) {
  return notes.filter(n => hasCat(n, "Trackers") && !/^Templates(\/|$)/.test(n.folder)).map(tracker).sort((a, b) => a.name.localeCompare(b.name));
}
function doneSet(t) { return new Set(t.entries.filter(e => e.done).map(e => e.date)); }
function streak(t, now) {
  const done = doneSet(t);
  const today = dayKey(now);
  const doneToday = done.has(today);
  let cur = 0, d = doneToday ? now : new Date(now.getTime() - DAY);
  while (done.has(dayKey(d))) { cur++; d = new Date(d.getTime() - DAY); }
  let best = 0, run = 0, prev = null;
  for (const k of [...done].sort()) {
    run = prev && Math.round((keyToDate(k) - keyToDate(prev)) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = k;
  }
  return { current: cur, best, doneToday };
}
function lastDays(t, now, n = 7) {
  const done = doneSet(t), out = [];
  for (let i = n - 1; i >= 0; i--) { const k = dayKey(new Date(now.getTime() - i * DAY)); out.push({ key: k, done: done.has(k) }); }
  return out;
}
function heatmap(habits, now, weeks = 26) {
  const sets = habits.map(doneSet);
  const today = dayKey(now);
  const start = new Date(startOfIsoWeek(now).getTime() - (weeks - 1) * 7 * DAY);
  const out = [];
  let total = 0;
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const k = dayKey(new Date(start.getTime() + (w * 7 + i) * DAY + 12 * 3600000));
      const count = sets.filter(s => s.has(k)).length;
      if (k <= today) total += count;
      col.push({ key: k, count, future: k > today, level: k > today || !sets.length ? 0 : Math.ceil((count / sets.length) * 4) });
    }
    out.push(col);
  }
  return { weeks: out, total, habits: habits.length };
}
function series(t, now, days = 90) {
  const from = dayKey(new Date(now.getTime() - days * DAY));
  const points = t.entries.filter(e => e.date >= from && e.date <= dayKey(now)).map(e => ({ date: e.date, value: e.value }));
  const all = t.entries;
  const last = all.length ? all[all.length - 1].value : null;
  const prev = all.length > 1 ? all[all.length - 2].value : null;
  const vals = points.map(p => p.value).concat(t.goal !== null ? [t.goal] : []);
  return { points, last, delta: last !== null && prev !== null ? Math.round((last - prev) * 100) / 100 : null,
    min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 0, from, to: dayKey(now) };
}
function matchTracker(text, ts) {
  const low = text.toLowerCase().replace(/\s+/g, " ").trim();
  let best = null;
  for (const t of ts) for (const nm of t.names) {
    if ((low === nm || low.startsWith(nm + " ")) && (!best || nm.length > best.nm.length)) best = { t, nm };
  }
  if (!best) return null;
  const rest = text.trim().slice(best.nm.length).trim();
  if (best.t.kind === "habit") {
    if (!rest || YES.test(rest)) return { kind: "entry", tracker: best.t.name, raw: "yes", title: `${best.t.name}: done today` };
    if (/^(no|n|skip|skipped|0)$/i.test(rest)) return { kind: "entry", tracker: best.t.name, raw: "no", title: `${best.t.name}: not today` };
    return null;
  }
  if (/^-?\d+(\.\d+)?\s*[a-z%]*$/i.test(rest)) return { kind: "entry", tracker: best.t.name, raw: rest, title: `${best.t.name}: ${rest}` };
  return null;
}

function agoText(fromKey, now) {
  const days = Math.round((keyToDate(dayKey(now)) - keyToDate(fromKey)) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30.44)} months ago`;
  const y = Math.floor(days / 365);
  return `${y} year${y === 1 ? "" : "s"} ago`;
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function dueLetters(notes, now) {
  const today = dayKey(now);
  return notes
    .filter(n => hasCat(n, "Letters") && !(n.fm && n.fm.opened) && n.fm && n.fm.deliver && String(n.fm.deliver).slice(0, 10) <= today)
    .sort((a, b) => String(a.fm.deliver).localeCompare(String(b.fm.deliver)));
}
function pastYou(notes, now) {
  const letter = dueLetters(notes, now)[0];
  if (letter) return { kind: "letter", note: letter, excerpt: excerpt(letter.body, 400), written: createdKey(letter), ago: agoText(createdKey(letter), now) };
  const cutoff = dayKey(new Date(now.getTime() - 30 * DAY));
  const pool = notes
    .filter(n => isOwn(n) && !hasCat(n, "Letters") && !hasCat(n, "Reviews") && !hasCat(n, "Trackers") && createdKey(n) <= cutoff && wordCount(n.body) >= 8)
    .sort((a, b) => a.path.localeCompare(b.path));
  if (!pool.length) return null;
  const n = pool[hash(dayKey(now)) % pool.length];
  return { kind: "memory", note: n, excerpt: excerpt(n.body), written: createdKey(n), ago: agoText(createdKey(n), now) };
}

function hidden(id, state, today) {
  const s = state.snooze && state.snooze[id], k = state.skip && state.skip[id];
  return (s && s > today) || k === today;
}
function nextSteps(notes, now, state = {}) {
  const today = dayKey(now);
  const out = [];
  const box = inbox(notes);
  if (box.length) {
    const old = box.filter(n => (now.getTime() - n.ctime) > 14 * DAY).length;
    out.push({ id: "inbox", kind: "inbox", title: `Sort ${box.length} captured thought${box.length === 1 ? "" : "s"}`,
      sub: `${old ? `${old} older than two weeks · ` : ""}Give each one a topic. About two minutes.`, action: "Sort them" });
  }
  const left = trackers(notes).filter(x => x.kind === "habit" && !streak(x, now).doneToday);
  if (left.length) {
    out.push({ id: "checkin", kind: "checkin", title: `${left.length} habit${left.length === 1 ? "" : "s"} left today`,
      sub: left.map(x => x.name).join(" · "), action: "Check in" });
  }
  for (const l of dueLetters(notes, now)) {
    out.push({ id: `letter:${l.path}`, kind: "letter", note: l, title: "A letter from past you has arrived",
      sub: `Written ${agoText(createdKey(l), now)}: "${excerpt(l.body, 60)}"`, action: "Read it" });
  }
  const active = notes.filter(isActive).sort((a, b) => b.mtime - a.mtime);
  for (const n of active) {
    const t = firstOpenTask(n.body);
    if (!t) continue;
    const topic = topicsOf(n)[0];
    out.push({ id: `task:${n.path}`, kind: hasCat(n, "Goals") ? "goal" : "project", note: n, line: t.line, title: t.text,
      sub: `From ${n.name}${topic ? ` · ${topic}` : ""}`, action: "Start" });
  }
  if (!currentReview(notes, now)) {
    out.push({ id: "review", kind: "review", title: "Write this week's review",
      sub: now.getDay() === 0 ? "It's Sunday. Ten minutes, then the week is closed." : "No review yet this week. Ten minutes.", action: "Review" });
  }
  return out.filter(s => !hidden(s.id, state, today));
}

// ---- goals & research ----
function goals(notes) {
  const order = { active: 0, idea: 1, paused: 2 };
  return notes
    .filter(n => (hasCat(n, "Goals") || hasCat(n, "Projects")) && !/^Templates(\/|$)/.test(n.folder))
    .map(n => {
      const status = String((n.fm && n.fm.status) || "active").toLowerCase();
      const boxes = String(n.body || "").split("\n").map(l => l.match(TASK)).filter(m => m && m[2].trim());
      const p = Number(n.fm && n.fm.progress);
      const progress = Number.isFinite(p) && n.fm.progress !== "" && n.fm.progress !== null
        ? Math.max(0, Math.min(100, Math.round(p)))
        : boxes.length ? Math.round(100 * boxes.filter(m => m[1] !== " ").length / boxes.length) : 0;
      const nt = firstOpenTask(n.body);
      return { name: n.name, path: n.path, note: n, kind: hasCat(n, "Goals") ? "goal" : "project", status, progress,
        next: nt ? nt.text : "", topic: topicsOf(n)[0] || "", mtime: n.mtime };
    })
    .filter(g => !["done", "dropped"].includes(g.status))
    .sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.name.localeCompare(b.name));
}
const STAGES = [["question", "Questions"], ["to-read", "To read"], ["reading", "Reading"], ["done", "Done"]];
function nextStage(s) { const i = STAGES.findIndex(x => x[0] === s); return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1][0] : null; }
function researchBoard(notes) {
  const items = notes
    .filter(n => hasCat(n, "Research") && !/^(Templates|Wiki|Raw)(\/|$)/.test(n.folder))
    .map(n => {
      const s = String((n.fm && n.fm.stage) || "question").toLowerCase();
      return { name: n.name, path: n.path, note: n, stage: STAGES.some(x => x[0] === s) ? s : "question",
        source: n.fm && n.fm.source ? String(n.fm.source) : "", conclusion: n.fm && n.fm.conclusion ? String(n.fm.conclusion) : "",
        topic: topicsOf(n)[0] || "" };
    });
  return STAGES.map(([id, label]) => ({ id, label, items: items.filter(i => i.stage === id).sort((a, b) => a.name.localeCompare(b.name)) }));
}

function parseCapture(raw, ts = []) {
  const t = String(raw || "").trim();
  if (!t) return null;
  const entry = matchTracker(t, ts);
  if (entry) return entry;
  const q = t.match(/^\?\s*(.+)$/);
  if (q) return { kind: "question", text: q[1].trim(), title: q[1].trim() };
  const m = t.match(/^(?:todo\b[:\s]*|\[\s?\]\s*|-\s*\[\s?\]\s*)(.+)$/i);
  if (m) { const text = m[1].trim(); return { kind: "task", text, title: text }; }
  const title = safeTitle(t.replace(/[.,!?;:]/g, " ")).split(" ").slice(0, 5).join(" ");
  return { kind: "thought", text: t, title };
}

function calendar(now, keys) {
  const first = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const start = new Date(first.getTime() - ((first.getDay() + 6) % 7) * DAY);
  const today = dayKey(now), weeks = [];
  let d = start;
  while (weeks.length < 6) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      const k = dayKey(d);
      row.push({ day: d.getDate(), key: k, inMonth: d.getMonth() === now.getMonth(), hasNote: keys.has(k), today: k === today });
      d = new Date(d.getTime() + DAY);
    }
    weeks.push(row);
    if (d.getMonth() !== now.getMonth() && weeks.length >= 4) break;
  }
  return { label: `${MONTHS[now.getMonth()]} ${now.getFullYear()}`, weeks };
}

// The whole dashboard in one call.
function model(notes, now, state = {}) {
  const review = currentReview(notes, now);
  const box = inbox(notes);
  return {
    header: header(now, box.length),
    inbox: box,
    rhythm: rhythm(notes, now, review),
    pastYou: pastYou(notes, now),
    steps: nextSteps(notes, now, state),
    review,
    todos: weekTodos(review),
    calendar: calendar(now, new Set(trackers(notes).flatMap(x => x.entries.filter(e => x.kind === "number" || e.done).map(e => e.date)))),
    goals: goals(notes),
    research: researchBoard(notes),
    ...(() => {
      const ts = trackers(notes);
      const hs = ts.filter(x => x.kind === "habit");
      return {
        trackers: ts,
        habits: hs.map(h => Object.assign({}, h, { streak: streak(h, now), days: lastDays(h, now, 7),
          rate: Math.round(100 * lastDays(h, now, 30).filter(d => d.done).length / 30) })),
        numbers: ts.filter(x => x.kind === "number").map(x => Object.assign({}, x, { series: series(x, now) })),
        heatmap: heatmap(hs, now, 26),
      };
    })(),
    topics: [...new Set(notes.filter(n => n.folder === "Topics").map(n => n.name))].sort(),
    today: dayKey(now),
  };
}

module.exports = {
  dayKey, isoWeek, header, catsOf, topicsOf, inbox, createdKey, wordCount, stripMarkdown, excerpt,
  firstOpenTask, weekTodos, currentReview, rhythm, agoText, pastYou, nextSteps, parseCapture, safeTitle,
  calendar, model, startOfIsoWeek, parseEntries, tracker, trackers, streak, lastDays, heatmap, series, matchTracker, goals, researchBoard, nextStage, STAGES,
};

 return module.exports; })();
__m["view"] = (function(){ const module = { exports: {} }; // Lyric Home view: draws the dashboard model into a DOM element. Plain DOM, works in Obsidian and in a browser.
// render(root, model, actions, ui) — `actions` are callbacks supplied by the plugin (or the demo),
// `ui` is { collapsed: {sectionId: true}, onUi(ui) } so collapsed sections survive a re-render.

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  journal: '<path d="M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2z"/><path d="M6 19a2 2 0 0 1 2-2h11"/>',
  review: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M9 14.5l2 2 4-4"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/>',
  box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  sparkle: '<path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  chevron: '<path d="M7 10l5 5 5-5"/>',
  shuffle: '<path d="M4 7h3c4 0 6 10 10 10h3M4 17h3c1.6 0 2.8-1.6 3.9-3.6M14.1 9.6C15.2 8 16.4 7 18 7h2"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.3 3.6-8.3.4 1.9 1.4 3 2.6 3.6.2-2.9 1.5-5 3.3-6.6.1 3.4 3.5 5.8 3.5 10.5 0 3.9-2.7 7-6.5 7z"/>',
  chart: '<path d="M4 19h16"/><path d="M5 15l4-5 4 3 6-7"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5z"/>',
};
function icon(name, cls = "") {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("class", "lh-icon " + cls);
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = ICONS[name] || "";
  return s;
}
function el(tag, cls, kids = [], attrs = {}) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v);
  }
  for (const k of [].concat(kids)) if (k != null) e.append(k);
  return e;
}
const btn = (label, cls, onclick, ic, title) => el("button", "lh-btn " + cls, [ic ? icon(ic) : null, label ? el("span", "", [], { text: label }) : null], { onclick, type: "button", title, "aria-label": title || label });

const STEP_ICON = { checkin: ["check", "tone-green"], inbox: ["inbox", "tone-sand"], letter: ["mail", "tone-sand"], goal: ["target", "tone-green"], project: ["box", "tone-blue"], review: ["review", "tone-rose"] };
const RING = { habits: ["check", "var(--lh-green)"], streak: ["flame", "var(--lh-gold)"], entries: ["chart", "var(--lh-blue)"], tasks: ["review", "var(--lh-rose)"], words: ["pen", "var(--lh-gold)"], captures: ["sparkle", "var(--lh-rose)"], goals: ["target", "var(--lh-blue)"] };

function ring(r) {
  const pct = r.goal > 0 ? Math.min(1, r.value / r.goal) : 0;
  const C = 2 * Math.PI * 16;
  const [ic, color] = RING[r.id] || ["check", "var(--lh-ink)"];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 40 40");
  svg.setAttribute("class", "lh-ring-svg");
  svg.innerHTML = `<circle cx="20" cy="20" r="16" class="lh-ring-track"/><circle cx="20" cy="20" r="16" class="lh-ring-fill" style="stroke:${color};stroke-dasharray:${(pct * C).toFixed(2)} ${C.toFixed(2)}"/>`;
  return el("div", "lh-ring", [
    el("div", "lh-ring-dial", [svg, icon(ic, "lh-ring-icon")]),
    el("div", "lh-ring-num", [el("b", "", [], { text: String(r.value) }), el("span", "", [], { text: ` / ${r.goal || "–"}` })]),
    el("div", "lh-ring-label", [], { text: r.label }),
  ], { title: `${r.value} of ${r.goal} ${r.label}` });
}

function section(id, ui, tone, ic, label, meta, body, right) {
  const closed = !!(ui.collapsed && ui.collapsed[id]);
  const toggle = () => { ui.collapsed = Object.assign({}, ui.collapsed, { [id]: !closed }); ui.onUi && ui.onUi(ui); };
  return el("section", `lh-card lh-sec tone-${tone}${closed ? " is-closed" : ""}`, [
    el("header", "lh-sec-head", [
      icon(ic, "lh-sec-icon"),
      el("span", "lh-sec-label", [], { text: label }),
      meta ? el("span", "lh-sec-meta", [], { text: meta }) : null,
      el("span", "lh-grow"),
      right || null,
      el("button", "lh-chev", [icon("chevron")], { type: "button", onclick: toggle, "aria-label": closed ? `Show ${label}` : `Hide ${label}` }),
    ]),
    closed ? null : el("div", "lh-sec-body", [].concat(body)),
  ]);
}

function capture(actions, core, ts) {
  const hint = el("div", "lh-capture-hint", [], { text: "Enter saves a thought. Start with todo to add a to-do for this week." });
  const input = el("input", "lh-capture-input", [], { type: "text", placeholder: "Log kata, blitz 1012, todo call Sam, or a thought", "aria-label": "Capture" });
  input.addEventListener("input", () => {
    const p = core.parseCapture(input.value, ts || []);
    hint.textContent = !p ? "Enter saves a thought. Start with todo to add a to-do for this week."
      : p.kind === "entry" ? `Logs ${p.title}` : p.kind === "task" ? `Adds to this week's to-dos: “${p.text}”` : `Saves a new thought: “${p.title}”`;
  });
  input.addEventListener("keydown", async e => {
    if (e.key !== "Enter" || !input.value.trim()) return;
    const v = input.value; input.value = ""; hint.textContent = "Saved.";
    await actions.capture(v);
  });
  return el("div", "lh-capture", [el("label", "lh-capture-box", [icon("plus"), input]), hint]);
}

function nextBest(m, actions, ui) {
  const steps = m.steps;
  const i = steps.length ? (ui.stepIndex || 0) % steps.length : 0;
  const s = steps[i];
  const [ic, tone] = s ? STEP_ICON[s.kind] || ["flag", "tone-sand"] : ["check", "tone-green"];
  const other = () => { ui.stepIndex = i + 1; ui.onUi && ui.onUi(ui); };
  return el("div", "lh-col", [
    el("section", "lh-card lh-best", [
      el("div", `lh-tile ${tone}`, [icon(ic)]),
      el("div", "lh-best-text", [
        el("div", "lh-kicker", [], { text: "Next best step" }),
        el("div", "lh-best-title", [], { text: s ? s.title : "Nothing waiting. Enjoy the quiet." }),
        el("div", "lh-best-sub", [], { text: s ? s.sub : "Log something above, or ask a research question with ?" }),
      ]),
      el("div", "lh-best-actions", s ? [
        btn(s.action, "is-dark", () => actions.step(s)),
        steps.length > 1 ? btn("Something else", "is-link", other) : null,
      ] : [btn("Check in", "is-dark", actions.checkIn)]),
    ]),
    el("div", "lh-under", [
      el("button", "lh-under-link", [], { type: "button", text: "Revisit a random note", onclick: actions.randomNote }),
      el("span", "lh-dot", [], { text: "·" }),
      el("button", "lh-under-link", [], { type: "button", text: "Check in", onclick: actions.checkIn }),
    ]),
  ]);
}

function rhythmCard(m, actions) {
  const h = m.rhythm.find(r => r.id === "habits");
  const done = h && h.goal ? { value: h.value } : null;
  return el("section", "lh-card lh-rhythm", [
    el("div", "lh-rhythm-head", [
      el("span", "lh-sec-label", [], { text: "Today's rhythm" }),
      done ? el("span", "lh-chip tone-blue", [], { text: done.value === h.goal ? "all habits done" : `${h.goal - done.value} to go today` }) : null,
      el("span", "lh-grow"),
      el("button", "lh-under-link", [], { type: "button", text: "Goals", onclick: () => actions.openPath("Categories/Goals.md") }),
    ]),
    el("div", "lh-rings", m.rhythm.map(ring)),
  ]);
}

function pastCard(m, actions, ui) {
  const p = m.pastYou;
  if (!p) return null;
  const letter = p.kind === "letter";
  const fmt = k => { const [y, mo, d] = k.split("-").map(Number); return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mo - 1]} ${y}`; };
  return section("past", ui, "sand", "mail", "From past you", letter ? "a letter has arrived" : `a note from ${p.ago}`, [
    el("blockquote", "lh-quote", [], { text: p.excerpt }),
    el("div", "lh-quote-foot", [
      el("span", "lh-muted", [], { text: `Written ${fmt(p.written)} · ${p.ago}` }),
      el("span", "lh-grow"),
      letter ? btn("Reply to past me", "is-outline", () => actions.letter(p.note), "pen") : btn("Write to future me", "is-outline", () => actions.letter(null), "pen"),
      letter ? btn("Keep", "is-link", () => actions.keepLetter(p.note)) : btn("Open", "is-link", () => actions.open(p.note)),
    ]),
  ], el("span", "lh-sec-right", [], { text: "Future me" }));
}

function stepsCard(m, actions, ui) {
  const rows = m.steps.map(s => {
    const [ic, tone] = STEP_ICON[s.kind] || ["flag", "tone-sand"];
    const sel = el("select", "lh-snooze", [
      el("option", "", [], { value: "", text: "Snooze" }),
      el("option", "", [], { value: "1", text: "1 day" }),
      el("option", "", [], { value: "3", text: "3 days" }),
      el("option", "", [], { value: "7", text: "1 week" }),
    ], { "aria-label": `Snooze ${s.title}` });
    sel.addEventListener("change", () => sel.value && actions.snooze(s, Number(sel.value)));
    return el("div", "lh-step", [
      el("div", `lh-tile is-small ${tone}`, [icon(ic)]),
      el("div", "lh-step-text", [el("div", "lh-step-title", [], { text: s.title }), el("div", "lh-step-sub", [], { text: s.sub })]),
      el("div", "lh-step-actions", [btn(s.action, "is-dark is-fixed", () => actions.step(s)), sel, btn("Not today", "is-link", () => actions.skip(s))]),
    ]);
  });
  return section("steps", ui, "rose", "flag", "Next steps", m.steps.length ? `${m.steps.length} thing${m.steps.length === 1 ? "" : "s"}, most useful first` : "all clear",
    rows.length ? rows : [el("div", "lh-empty", [], { text: "Nothing waiting. Add a next step to a goal or project and it shows up here." })]);
}

function weekCard(m, actions, ui) {
  const add = el("input", "lh-add", [], { type: "text", placeholder: "Add a to-do for this week", "aria-label": "Add a to-do for this week" });
  add.addEventListener("keydown", async e => { if (e.key === "Enter" && add.value.trim()) { const v = add.value; add.value = ""; await actions.addTodo(v); } });
  const items = m.todos.map(t => el("label", `lh-todo${t.done ? " is-done" : ""}`, [
    el("input", "", [], { type: "checkbox", checked: t.done, onchange: () => actions.toggleTodo(t) }),
    el("span", "", [], { text: t.text }),
  ]));
  return section("week", ui, "green", "check", "This week's outcomes", m.header.kicker.split(" · ")[0].toLowerCase(), [
    items.length ? el("div", "lh-todos", items) : el("div", "lh-empty", [], { text: m.review ? "No to-dos in this week's review yet." : "No weekly review yet. Adding a to-do creates it." }),
    add,
  ], m.review ? el("button", "lh-under-link", [], { type: "button", text: "Open review", onclick: () => actions.open(m.review) }) : null);
}

function calendarCard(m, actions, ui) {
  const c = m.calendar;
  const head = ["M", "T", "W", "T", "F", "S", "S"].map(d => el("div", "lh-cal-dow", [], { text: d }));
  const cells = c.weeks.flat().map(d => el("div", `lh-cal-day${d.inMonth ? "" : " is-out"}${d.today ? " is-today" : ""}${d.hasNote ? " has-note" : ""}`,
    [el("span", "", [], { text: String(d.day) })], { title: `${d.key}${d.hasNote ? ": logged" : ""}` }));
  return section("cal", ui, "plain", "calendar", "Calendar", `${c.label} · dots = days you logged`, [el("div", "lh-cal", head.concat(cells))]);
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const svg = (w, h, inner, cls) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("class", cls); s.innerHTML = inner; return s; };

function habitsCard(m, actions, ui) {
  const hs = m.habits || [];
  if (!hs.length) return section("habits", ui, "green", "flame", "Habits", "none yet", [el("div", "lh-empty", [], { text: "Make a habit tracker with New tracker, then check in here every day." })]);
  const doneN = hs.filter(h => h.streak.doneToday).length;
  const rows = hs.map(h => {
    const on = h.streak.doneToday;
    return el("div", `lh-habit${on ? " is-on" : ""}`, [
      el("button", "lh-check", [icon("check")], { type: "button", "aria-pressed": on ? "true" : "false", title: on ? `Undo ${h.name} today` : `Done ${h.name} today`, onclick: () => actions.toggleHabit(h) }),
      el("div", "lh-habit-text", [
        el("button", "lh-habit-name", [], { type: "button", text: h.name, onclick: () => actions.open(h.note) }),
        el("div", "lh-habit-sub", [
          icon("flame", h.streak.current ? "is-hot" : ""),
          el("span", "", [], { text: h.streak.current ? `${h.streak.current} day streak` : "no streak" }),
          el("span", "lh-dot", [], { text: "·" }), el("span", "", [], { text: `best ${h.streak.best}` }),
          el("span", "lh-dot", [], { text: "·" }), el("span", "", [], { text: `${h.rate}% this month` }),
        ]),
      ]),
      el("div", "lh-week", h.days.map(d => el("div", `lh-day${d.done ? " is-done" : ""}${d.key === m.today ? " is-today" : ""}`, [
        el("span", "lh-day-dot"), el("span", "lh-day-dow", [], { text: DOW[new Date(d.key + "T12:00").getDay()] }),
      ], { title: `${d.key}: ${d.done ? "done" : "not done"}` }))),
    ]);
  });
  const hm = m.heatmap;
  const grid = el("div", "lh-heat", hm.weeks.map(w => el("div", "lh-heat-col", w.map(d =>
    el("div", `lh-heat-cell l${d.level}${d.future ? " is-future" : ""}`, [], { title: `${d.key}: ${d.count} of ${hm.habits}` })))));
  return section("habits", ui, "green", "flame", "Habits", `${doneN} of ${hs.length} today`, [
    el("div", "lh-habits", rows),
    el("div", "lh-heat-wrap", [
      el("div", "lh-heat-head", [el("span", "lh-sec-label", [], { text: "Last 6 months" }), el("span", "lh-muted", [], { text: `${hm.total} check-ins` }), el("span", "lh-grow"),
        el("span", "lh-heat-key", [el("span", "lh-muted", [], { text: "less" }), ...[0, 1, 2, 3, 4].map(l => el("span", `lh-heat-cell l${l}`)), el("span", "lh-muted", [], { text: "more" })])]),
      grid,
    ]),
  ]);
}

function chart(t) {
  const s = t.series, W = 300, H = 76, P = 6;
  if (!s.points.length) return el("div", "lh-chart-empty", [], { text: "No entries in the last 90 days" });
  const t0 = new Date(s.from + "T12:00").getTime(), t1 = new Date(s.to + "T12:00").getTime();
  const span = s.max - s.min || 1, lo = s.min - span * 0.12, hi = s.max + span * 0.12;
  const x = d => P + (W - 2 * P) * ((new Date(d + "T12:00").getTime() - t0) / (t1 - t0 || 1));
  const y = v => P + (H - 2 * P) * (1 - (v - lo) / (hi - lo));
  const pts = s.points.map(p => [x(p.date), y(p.value)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;
  const goal = t.goal !== null ? `<line x1="0" x2="${W}" y1="${y(t.goal).toFixed(1)}" y2="${y(t.goal).toFixed(1)}" class="lh-chart-goal"/>` : "";
  const last = pts[pts.length - 1];
  return svg(W, H, `${goal}<path d="${area}" class="lh-chart-area"/><path d="${line}" class="lh-chart-line" vector-effect="non-scaling-stroke"/>` +
    pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.6" class="lh-chart-pt"/>`).join("") +
    `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.2" class="lh-chart-last"/>`, "lh-chart");
}

function numbersCard(m, actions, ui) {
  const ns = m.numbers || [];
  if (!ns.length) return "";
  const tiles = ns.map(t => {
    const s = t.series;
    const inp = el("input", "lh-log", [], { type: "text", inputmode: "decimal", placeholder: "Log today", "aria-label": `Log ${t.name}` });
    inp.addEventListener("keydown", async e => { if (e.key === "Enter" && inp.value.trim()) { const v = inp.value.trim(); inp.value = ""; await actions.logNumber(t, v); } });
    const up = s.delta > 0, down = s.delta < 0;
    const toGoal = t.goal !== null && s.last !== null ? t.goal - s.last : null;
    return el("div", "lh-num", [
      el("div", "lh-num-head", [
        el("button", "lh-habit-name", [], { type: "button", text: t.name, onclick: () => actions.open(t.note) }),
        el("span", "lh-grow"),
        s.delta !== null && s.delta !== 0 ? el("span", `lh-chip ${up ? "tone-green" : "tone-rose"}`, [], { text: `${up ? "▲" : "▼"} ${Math.abs(s.delta)}` }) : null,
      ]),
      el("div", "lh-num-value", [el("b", "", [], { text: s.last === null ? "–" : String(s.last) }), t.unit ? el("span", "", [], { text: " " + t.unit }) : null]),
      el("div", "lh-num-goal", [], { text: t.goal === null ? "no goal set" : toGoal > 0 ? `${toGoal} to go · goal ${t.goal}` : `goal ${t.goal} reached` }),
      chart(t),
      inp,
    ]);
  });
  return section("numbers", ui, "blue", "chart", "Numbers", "last 90 days", [el("div", "lh-nums", tiles)]);
}

function goalsCard(m, actions, ui) {
  const gs = m.goals || [];
  const rows = gs.map(g => el("div", "lh-goal", [
    el("div", `lh-tile is-small ${g.kind === "goal" ? "tone-green" : "tone-blue"}`, [icon(g.kind === "goal" ? "target" : "box")]),
    el("div", "lh-goal-text", [
      el("div", "lh-goal-top", [
        el("button", "lh-habit-name", [], { type: "button", text: g.name, onclick: () => actions.open(g.note) }),
        g.status !== "active" ? el("span", "lh-chip tone-plain", [], { text: g.status }) : null,
        el("span", "lh-grow"),
        el("span", "lh-goal-pct", [], { text: `${g.progress}%` }),
      ]),
      el("div", "lh-bar-track", [el("div", "lh-bar-fill", [], { style: `width:${g.progress}%` })], { role: "progressbar", "aria-valuenow": String(g.progress), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": `${g.name} progress` }),
      el("div", "lh-step-sub", [], { text: [g.next ? `Next: ${g.next}` : "No next step yet", g.topic].filter(Boolean).join(" · ") }),
    ]),
    el("div", "lh-goal-actions", [
      btn("−", "is-outline is-icon", () => actions.bumpProgress(g, -10), null, `Less progress on ${g.name}`),
      btn("+", "is-outline is-icon", () => actions.bumpProgress(g, 10), null, `More progress on ${g.name}`),
    ]),
  ]));
  return section("goals", ui, "sand", "target", "Goals & projects", gs.length ? `${gs.filter(g => g.status === "active").length} active` : "none yet", [
    rows.length ? el("div", "lh-goals", rows) : el("div", "lh-empty", [], { text: "Make a goal or project from a template (Alt+T). Progress comes from its checkboxes, or set a progress number." }),
    el("div", "lh-sec-foot", [btn("New goal", "is-outline", () => actions.newGoal("goal"), "target"), btn("New project", "is-outline", () => actions.newGoal("project"), "box")]),
  ]);
}

function researchCard(m, actions, ui) {
  const cols = m.research || [];
  const total = cols.reduce((s, c) => s + c.items.length, 0);
  const NEXT = { question: "Find a source", "to-read": "Start reading", reading: "Mark done" };
  const board = el("div", "lh-board", cols.map(c => el("div", `lh-col-stage stage-${c.id}`, [
    el("div", "lh-col-head", [el("span", "lh-sec-label", [], { text: c.label }), el("span", "lh-muted", [], { text: String(c.items.length) })]),
    ...c.items.map(i => el("div", "lh-rcard", [
      el("button", "lh-rcard-title", [], { type: "button", text: i.name, onclick: () => actions.open(i.note) }),
      i.conclusion ? el("div", "lh-rcard-conc", [], { text: i.conclusion }) : null,
      i.topic || i.source ? el("div", "lh-step-sub", [], { text: [i.topic, i.source ? "has source" : ""].filter(Boolean).join(" · ") }) : null,
      NEXT[i.stage] ? el("button", "lh-under-link lh-rcard-move", [], { type: "button", text: `${NEXT[i.stage]} →`, onclick: () => actions.moveStage(i) }) : null,
    ])),
    c.items.length ? null : el("div", "lh-col-empty", [], { text: c.id === "question" ? "Type ? and a question in the capture box" : "–" }),
  ])));
  return section("research", ui, "rose", "sparkle", "Research", total ? `${total} item${total === 1 ? "" : "s"}` : "start with a question", [board]);
}

function render(root, m, actions, ui = {}, core) {
  root.replaceChildren();
  root.classList.add("lh");
  const bar = el("div", "lh-bar", [
    btn("Weekly review", "is-outline", actions.openReview, "review"),
    btn("Search", "is-outline", actions.search, "search"),
    btn("Log something", "is-outline", actions.log, "plus"),
    btn("New note", "is-outline", actions.newNote, "plus"),
    btn("New tracker", "is-outline", actions.newTracker, "flame"),
    btn("Research question", "is-outline", actions.newQuestion, "sparkle"),
    btn("Letter to future me", "is-outline", () => actions.letter(null), "mail"),
  ]);
  root.append(
    el("div", "lh-top", [
      el("div", "lh-title", [el("div", "lh-kicker", [], { text: m.header.kicker }), el("h1", "lh-h1", [], { text: m.header.title })]),
      capture(actions, core, m.trackers),
    ]),
    bar,
    m.topics && m.topics.length ? el("nav", "lh-areas", [el("span", "lh-areas-label", [], { text: "Areas" })].concat(
      m.topics.map(tp => el("button", "lh-area", [], { type: "button", text: tp, onclick: () => actions.openPath(`Topics/${tp}.md`) })))) : "",
    el("div", "lh-grid-a", [nextBest(m, actions, ui), rhythmCard(m, actions)]),
    habitsCard(m, actions, ui),
    numbersCard(m, actions, ui),
    goalsCard(m, actions, ui),
    researchCard(m, actions, ui),
    pastCard(m, actions, ui) || "",
    stepsCard(m, actions, ui),
    el("div", "lh-grid-b", [weekCard(m, actions, ui), calendarCard(m, actions, ui)]),
  );
}

module.exports = { render };

 return module.exports; })();
// Lyric Home plugin: Obsidian glue. Reads notes, renders the ```lyric-home``` block, and runs the buttons.
// Rules: it only creates new notes or makes the single change a button names. It never edits notes in bulk.
const { Plugin, Modal, Notice, MarkdownRenderChild, normalizePath } = require("obsidian");
const core = __m.core;
const view = __m.view;

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

  // ---- trackers ----
  // Set (raw) or clear (null) one day's entry in a tracker note. Entries are plain lines: "- YYYY-MM-DD: value".
  async writeEntry(path, date, raw) {
    const f = this.file(path);
    if (!f) return;
    await this.app.vault.process(f, src => {
      const re = new RegExp(`^\\s*[-*+]\\s+${date}\\s*:{1,2}.*$`);
      const lines = src.replace(/\s+$/, "").split("\n").filter(l => !re.test(l));
      if (raw !== null) {
        let at = lines.length;
        for (let i = lines.length - 1; i >= 0; i--) if (/^\s*[-*+]\s+\d{4}-\d{2}-\d{2}\s*:/.test(lines[i])) { at = i + 1; break; }
        lines.splice(at, 0, `- ${date}: ${raw}`);
      }
      return lines.join("\n") + "\n";
    });
  }
  async toggleHabit(h) {
    const today = core.dayKey(new Date());
    const done = core.streak(h, new Date()).doneToday;
    await this.writeEntry(h.path, today, done ? null : "yes");
  }
  async logNumber(t, raw) {
    if (!Number.isFinite(parseFloat(raw))) { new Notice(`"${raw}" isn't a number`); return; }
    await this.writeEntry(t.path, core.dayKey(new Date()), String(raw).trim());
    new Notice(`${t.name}: ${raw}`);
  }
  newTracker() {
    new TrackerModal(this.app, async (name, kind, unit, goal) => {
      const fm = ["---", "categories:", '  - "[[Trackers]]"', `kind: ${kind}`, `created: ${core.dayKey(new Date())}`,
        unit ? `unit: ${unit}` : null, goal ? `goal: ${goal}` : null, "aliases: []", "---"].filter(x => x !== null).join("\n");
      const f = await this.create(`Trackers/${core.safeTitle(name)}.md`, `${fm}\n${kind === "habit" ? "Check in from Home, or type the name in the capture box." : "Log from Home, or type the name and a number in the capture box."}\n\n`);
      new Notice(`Tracker made: ${f.basename}`);
    }).open();
  }

  // ---- research & goals ----
  async createQuestion(text) {
    const q = String(text || "").trim().replace(/^\?\s*/, "");
    if (!q) return;
    const now = new Date();
    const fm = `---\ncategories:\n  - "[[Research]]"\nstage: question\ncreated: ${core.dayKey(now)}\nsource:\nconclusion:\ntopics: []\n---\n`;
    const f = await this.create(`${core.safeTitle(q).slice(0, 80) || "Question"}.md`, `${fm}## Question\n${q}\n\n## Sources\n\n## What I found\n`);
    new Notice(`Research question: ${f.basename}`);
  }
  async moveStage(item) {
    const next = core.nextStage(item.stage);
    if (!next) return;
    await this.setProp(item, "stage", next);
    if (next === "done") new Notice("Done. Write the answer in its conclusion property.");
  }
  async bumpProgress(g, d) { await this.setProp(g, "progress", Math.max(0, Math.min(100, (g.progress || 0) + d))); }
  newGoal(kind) {
    new TextModal(this.app, kind === "goal" ? "New goal" : "New project", "", async name => {
      name = core.safeTitle(name.trim().split("\n")[0]);
      if (!name) return;
      const f = await this.create(`${name}.md`, await this.template(kind === "goal" ? "Goal Template" : "Project Template", name));
      this.openFile(f);
    }).open();
  }

  // ---- actions ----
  async capture(text) {
    const ts = core.trackers(await this.collect());
    const c = core.parseCapture(text, ts);
    if (!c) return;
    if (c.kind === "entry") {
      const tr = ts.find(x => x.name === c.tracker);
      await this.writeEntry(tr.path, core.dayKey(new Date()), c.raw);
      new Notice(c.title);
      return;
    }
    if (c.kind === "task") return this.addTodo(c.text);
    if (c.kind === "question") return this.createQuestion(c.text);
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
      toggleHabit: h => this.toggleHabit(h),
      logNumber: (tr, v) => this.logNumber(tr, v),
      newTracker: () => this.newTracker(),
      newQuestion: () => new TextModal(this.app, "A research question", "", v => this.createQuestion(v)).open(),
      moveStage: i => this.moveStage(i),
      bumpProgress: (g, d) => this.bumpProgress(g, d),
      newGoal: k => this.newGoal(k),
      checkIn: () => { const el = block.containerEl.querySelector(".lh-habits"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); },
      step: async s => {
        if (s.kind === "inbox") return this.sortInbox();
        if (s.kind === "checkin") { const el = block.containerEl.querySelector(".lh-habits"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
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
class TrackerModal extends Modal {
  constructor(app, done) { super(app); this.done = done; }
  onOpen() {
    this.titleEl.setText("New tracker");
    let kind = "habit";
    const row = this.contentEl.createDiv({ cls: "lh-modal-row" });
    const b1 = row.createEl("button", { text: "Habit (yes / no)", cls: "mod-cta" });
    const b2 = row.createEl("button", { text: "Number (Elo, reps, kg…)" });
    const name = this.contentEl.createEl("input", { type: "text", cls: "lh-modal-input", attr: { placeholder: "Name, e.g. Kata or Blitz Elo" } });
    const extra = this.contentEl.createDiv({ cls: "lh-modal-row" });
    const unit = extra.createEl("input", { type: "text", attr: { placeholder: "Unit (Elo, kg)" } });
    const goal = extra.createEl("input", { type: "text", attr: { placeholder: "Goal (optional)" } });
    extra.hide();
    b1.onclick = () => { kind = "habit"; b1.addClass("mod-cta"); b2.removeClass("mod-cta"); extra.hide(); name.focus(); };
    b2.onclick = () => { kind = "number"; b2.addClass("mod-cta"); b1.removeClass("mod-cta"); extra.show(); name.focus(); };
    const go = this.contentEl.createDiv({ cls: "lh-modal-row" }).createEl("button", { text: "Create", cls: "mod-cta" });
    const submit = () => { if (!name.value.trim()) return; this.done(name.value.trim(), kind, unit.value.trim(), goal.value.trim()); this.close(); };
    go.onclick = submit;
    name.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
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
