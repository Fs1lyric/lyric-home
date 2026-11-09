// Lyric Home view: draws the dashboard model into a DOM element. Plain DOM, works in Obsidian and in a browser.
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

const STEP_ICON = { inbox: ["inbox", "tone-sand"], letter: ["mail", "tone-sand"], goal: ["target", "tone-green"], project: ["box", "tone-blue"], review: ["review", "tone-rose"] };
const RING = { words: ["pen", "var(--lh-gold)"], captures: ["sparkle", "var(--lh-rose)"], tasks: ["check", "var(--lh-green)"], goals: ["target", "var(--lh-blue)"] };

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

function capture(actions, core) {
  const hint = el("div", "lh-capture-hint", [], { text: "Enter saves a thought. Start with todo to add a to-do for this week." });
  const input = el("input", "lh-capture-input", [], { type: "text", placeholder: "Capture a thought, or a task: todo call Sam", "aria-label": "Capture" });
  input.addEventListener("input", () => {
    const p = core.parseCapture(input.value);
    hint.textContent = !p ? "Enter saves a thought. Start with todo to add a to-do for this week."
      : p.kind === "task" ? `Adds to this week's to-dos: “${p.text}”` : `Saves a new thought: “${p.title}”`;
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
        el("div", "lh-best-sub", [], { text: s ? s.sub : "Capture a thought above, or write in today's note." }),
      ]),
      el("div", "lh-best-actions", s ? [
        btn(s.action, "is-dark", () => actions.step(s)),
        steps.length > 1 ? btn("Something else", "is-link", other) : null,
      ] : [btn("Open today", "is-dark", actions.openDaily)]),
    ]),
    el("div", "lh-under", [
      el("button", "lh-under-link", [], { type: "button", text: "Revisit a random note", onclick: actions.randomNote }),
      el("span", "lh-dot", [], { text: "·" }),
      el("button", "lh-under-link", [], { type: "button", text: "Close the day", onclick: actions.openDaily }),
    ]),
  ]);
}

function rhythmCard(m, actions) {
  const done = m.rhythm.find(r => r.id === "captures");
  return el("section", "lh-card lh-rhythm", [
    el("div", "lh-rhythm-head", [
      el("span", "lh-sec-label", [], { text: "Today's rhythm" }),
      done && done.value ? el("span", "lh-chip tone-blue", [], { text: `${done.value} thought${done.value === 1 ? "" : "s"} today` }) : null,
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
  const cells = c.weeks.flat().map(d => el("button", `lh-cal-day${d.inMonth ? "" : " is-out"}${d.today ? " is-today" : ""}${d.hasNote ? " has-note" : ""}`,
    [el("span", "", [], { text: String(d.day) })], { type: "button", title: d.key, onclick: () => actions.openDay(d.key) }));
  return section("cal", ui, "plain", "calendar", "Calendar", c.label, [el("div", "lh-cal", head.concat(cells))]);
}

function render(root, m, actions, ui = {}, core) {
  root.replaceChildren();
  root.classList.add("lh");
  const bar = el("div", "lh-bar", [
    btn("Journal", "is-outline", actions.openDaily, "journal"),
    btn("Weekly review", "is-outline", actions.openReview, "review"),
    btn("Search", "is-outline", actions.search, "search"),
    btn("Log something", "is-outline", actions.log, "plus"),
    btn("New note", "is-outline", actions.newNote, "plus"),
    btn("Letter to future me", "is-outline", () => actions.letter(null), "mail"),
  ]);
  root.append(
    el("div", "lh-top", [
      el("div", "lh-title", [el("div", "lh-kicker", [], { text: m.header.kicker }), el("h1", "lh-h1", [], { text: m.header.title })]),
      capture(actions, core),
    ]),
    bar,
    m.topics && m.topics.length ? el("nav", "lh-areas", [el("span", "lh-areas-label", [], { text: "Areas" })].concat(
      m.topics.map(tp => el("button", "lh-area", [], { type: "button", text: tp, onclick: () => actions.openPath(`Topics/${tp}.md`) })))) : "",
    el("div", "lh-grid-a", [nextBest(m, actions, ui), rhythmCard(m, actions)]),
    pastCard(m, actions, ui) || "",
    stepsCard(m, actions, ui),
    el("div", "lh-grid-b", [weekCard(m, actions, ui), calendarCard(m, actions, ui)]),
  );
}

module.exports = { render };
