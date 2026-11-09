// Render the dashboard from the demo vault in headless Chromium and save screenshots to shots/.
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { notes, NOW } from "../demo/notes.mjs";
const r = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const wrap = (name, src) => `window.__m=window.__m||{};__m.${name}=(function(){const module={exports:{}};${src}\nreturn module.exports;})();`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${r("styles.css")}
html,body{margin:0;background:#fbfaf6} .theme-dark body, body.theme-dark{background:#191816} .wrap{padding:28px 32px}</style></head>
<body><div class="wrap"><div id="root"></div></div><script>${wrap("core", r("src/core.js"))}${wrap("view", r("src/view.js"))}</script></body></html>`;
mkdirSync(new URL("../shots/", import.meta.url), { recursive: true });
const browser = await chromium.launch();
const shots = [["home-wide", 1220, false], ["home-narrow", 430, false], ["home-dark", 1220, true]];
let failed = 0;
for (const [name, width, dark] of shots) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  page.on("pageerror", e => { console.error(name, "page error:", e.message); failed++; });
  await page.setContent(html);
  await page.evaluate(({ notes, now, dark }) => {
    if (dark) document.body.classList.add("theme-dark");
    const m = __m.core.model(notes, new Date(now), {});
    const noop = () => {};
    const actions = new Proxy({}, { get: () => noop });
    __m.view.render(document.getElementById("root"), m, actions, { collapsed: {} }, __m.core);
  }, { notes, now: NOW.getTime(), dark });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) { console.error(name, "horizontal overflow:", overflow, "px"); failed++; }
  await page.screenshot({ path: `shots/${name}.png`, fullPage: true });
  console.log("saved", name);
}
await browser.close();
process.exit(failed ? 1 : 0);
