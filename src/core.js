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
  const today = dayKey(now);
  const weekStart = startOfIsoWeek(now).getTime();
  const madeToday = notes.filter(n => isOwn(n) && createdKey(n) === today);
  const words = madeToday.reduce((s, n) => s + wordCount(n.body), 0);
  const captures = madeToday.filter(n => hasCat(n, "Journal")).length;
  const todos = weekTodos(review);
  const active = notes.filter(isActive);
  const touched = active.filter(n => n.mtime >= weekStart).length;
  return [
    { id: "words", value: words, goal: 300, label: "words today" },
    { id: "captures", value: captures, goal: 3, label: "thoughts captured" },
    { id: "tasks", value: todos.filter(t => t.done).length, goal: todos.length, label: "week to-dos" },
    { id: "goals", value: touched, goal: active.length, label: "goals touched" },
  ];
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
    .filter(n => isOwn(n) && !hasCat(n, "Letters") && !hasCat(n, "Reviews") && createdKey(n) <= cutoff && wordCount(n.body) >= 8)
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

function parseCapture(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;
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
    calendar: calendar(now, new Set(notes.filter(n => n.folder === "Daily").map(n => n.name))),
    topics: [...new Set(notes.filter(n => n.folder === "Topics").map(n => n.name))].sort(),
    today: dayKey(now),
  };
}

module.exports = {
  dayKey, isoWeek, header, catsOf, topicsOf, inbox, createdKey, wordCount, stripMarkdown, excerpt,
  firstOpenTask, weekTodos, currentReview, rhythm, agoText, pastYou, nextSteps, parseCapture, safeTitle,
  calendar, model, startOfIsoWeek,
};
