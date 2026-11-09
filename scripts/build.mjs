// Concatenate src/ into the single main.js Obsidian loads, and inline fonts into styles.css.
import { readFileSync, writeFileSync } from "node:fs";
const r = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const mod = (name, src) => `__m[${JSON.stringify(name)}] = (function(){ const module = { exports: {} }; ${src}\n return module.exports; })();`;
let main = "/* Lyric Home: built by scripts/build.mjs from src/. Do not edit. */\n\"use strict\";\nconst __m = {};\n";
for (const f of ["core", "view"]) {
  try { main += mod(f, r(`src/${f}.js`)) + "\n"; } catch { main += `__m.${f} = {};\n`; }
}
try { main += r("src/plugin.js").replace(/require\("\.\/(core|view)(\.js)?"\)/g, (_, n) => `__m.${n}`); } catch {}
writeFileSync(new URL("../main.js", import.meta.url), main);
const inline = s => s.replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("data:font/woff2;base64,${readFileSync(new URL("../fonts/" + f, import.meta.url)).toString("base64")}")`);
writeFileSync(new URL("../styles.css", import.meta.url), inline(r("src/styles.css")));
writeFileSync(new URL("../theme/paper.css", import.meta.url), inline(r("theme/paper.src.css")));
