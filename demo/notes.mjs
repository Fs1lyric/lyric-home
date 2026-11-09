// An invented demo vault for screenshots. Nothing here is real.
const d = (y, m, day, h = 12) => new Date(y, m - 1, day, h).getTime();
const n = (path, fm, body, ctime, mtime = ctime) => {
  const name = path.split("/").pop().replace(/\.md$/, "");
  const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  return { path, name, folder, fm, body, ctime, mtime };
};
export const NOW = new Date(2026, 10, 9, 18, 5);
const days = (from, to, pick) => { const out = []; for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 864e5)) { const k = d.toISOString().slice(0, 10); const v = pick(d, out.length); if (v !== null) out.push(`- ${k}: ${v}`); } return out.join("\n"); };
const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
const habitBody = (seed, p, last) => { const r = seeded(seed); return days(new Date(2026, 4, 12, 12), new Date(2026, 10, last, 12), () => r() < p ? "yes" : null); };
const T = (name, fm, body) => n(`Trackers/${name}.md`, Object.assign({ categories: ["[[Trackers]]"] }, fm), body, d(2026, 5, 1));
const elo = (seed, start, gain) => { const r = seeded(seed); let v = start; return days(new Date(2026, 7, 12, 12), new Date(2026, 10, 9, 12), (dd, i) => (dd.getDay() % 3 === 0 ? (v = Math.round(v + gain + (r() - 0.45) * 30)) : null)); };
export const notes = [
  T("Kata", { kind: "habit" }, habitBody(7, 0.78, 9)),
  T("Painting", { kind: "habit" }, habitBody(11, 0.45, 8)),
  T("Reading", { kind: "habit" }, habitBody(23, 0.62, 9)),
  T("Coding", { kind: "habit" }, habitBody(31, 0.7, 7)),
  T("Bangla handwriting", { kind: "habit", aliases: ["handwriting"] }, habitBody(41, 0.35, 6)),
  T("Blitz Elo", { kind: "number", unit: "Elo", goal: 1000, aliases: ["blitz"] }, elo(5, 760, 3)),
  T("Rapid Elo", { kind: "number", unit: "Elo", goal: 1000, aliases: ["rapid"] }, elo(9, 790, 2.5)),
  T("Bullet Elo", { kind: "number", unit: "Elo", goal: 700, aliases: ["bullet"] }, elo(13, 560, 0.5)),
  n("Topics/Chess.md", {}, "", d(2026, 9, 1)), n("Topics/Karate.md", {}, "", d(2026, 9, 1)), n("Topics/Art.md", {}, "", d(2026, 9, 1)),
  n("Daily/2026-11-09.md", { categories: ["[[Daily]]"], created: "2026-11-09" }, "Morning kata before school. Painted a small study of the window light, still muddy in the shadows. Chess: two rapid wins, one blunder in the endgame I should have seen.", d(2026, 11, 9, 8)),
  n("Daily/2026-11-08.md", { categories: ["[[Daily]]"], created: "2026-11-08" }, "Rest day.", d(2026, 11, 8)),
  n("Daily/2026-11-04.md", { categories: ["[[Daily]]"], created: "2026-11-04" }, "Exam prep.", d(2026, 11, 4)),
  n("Daily/2026-11-02.md", { categories: ["[[Daily]]"], created: "2026-11-02" }, "Grading went well.", d(2026, 11, 2)),
  n("2026-11-09 1612 shadows need colour.md", { categories: ["[[Journal]]"], created: "2026-11-09" }, "Shadows are never grey. Mix the complement in, not black.", d(2026, 11, 9, 16)),
  n("2026-11-09 1130 endgame patience.md", { categories: ["[[Journal]]"], created: "2026-11-09" }, "Endgames reward patience more than tricks.", d(2026, 11, 9, 11)),
  n("2026-10-20 2210 app idea.md", { categories: ["[[Journal]]"], created: "2026-10-20" }, "A tiny app that tracks kata practice streaks.", d(2026, 10, 20, 22)),
  n("Chess goals.md", { categories: ["[[Goals]]"], topics: ["[[Chess]]"], status: "active" }, "## Next step\n- [ ] Review the endgame blunder from Sunday's game\n", d(2026, 9, 23), d(2026, 11, 9)),
  n("Black belt grading.md", { categories: ["[[Goals]]"], topics: ["[[Karate]]"], status: "active" }, "## Next step\n- [ ] Run the full kata sequence twice, slowly\n", d(2026, 9, 26), d(2026, 11, 9, 10)),
  n("Portfolio site.md", { categories: ["[[Projects]]"], topics: ["[[Tech]]"], status: "active" }, "- [x] Pick a font\n- [ ] Write the about section in three sentences\n", d(2026, 10, 6), d(2026, 10, 30)),
  n("Painting practice.md", { categories: ["[[Goals]]"], topics: ["[[Art]]"], status: "active" }, "## Next step\n- [ ] Paint one value study a day for a week\n", d(2026, 9, 23), d(2026, 10, 1)),
  n("2026-05-03 Letter to future me.md", { categories: ["[[Letters]]"], created: "2026-05-03", deliver: "2026-11-09" }, "Dear future me. By now the exams are over and the grading is close. I hope you still do kata before breakfast, and that you finally finished one painting you are proud of. Be kind about the chess rating.", d(2026, 5, 3)),
  n("2026-11-09 Weekly Review.md", { categories: ["[[Reviews]]"], period: "week", created: "2026-11-09" }, "## Wins\n\n## This week's to-dos\n- [x] Finish the maths revision sheet\n- [x] Two rapid games a day\n- [ ] Book the grading slot\n- [ ] Clean up the art folder\n", d(2026, 11, 9, 9)),
];
