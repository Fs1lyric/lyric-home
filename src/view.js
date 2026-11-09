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
