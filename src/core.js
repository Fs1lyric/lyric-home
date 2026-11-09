// Lyric Home core: pure rules that turn notes into a dashboard model. No Obsidian, no DOM, no AI.
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
