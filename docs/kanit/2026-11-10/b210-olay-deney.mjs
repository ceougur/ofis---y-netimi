// Odaktaki (değeri değişmiş) arama kutusu DOM'dan kaldırılınca tarayıcı hangi olayları verir? (tanı; test değil)
// b210 (CI #864 / #1056): eski kodda "fill" ve "tutar" kiplerinde listenin süzülüp kutunun boş kalmasının nedeni — Chromium, yeniden çizimde
// (innerHTML) sökülen odaktaki değişmiş alana eş zamanlı "change" verir (eski düğüm o an hâlâ bağlı); hof-bank.js onChange süzgeci uygular.
// Kullanım: DEPO_KOK=<depo kökü> [TARAYICI_ARG="--enable-blink-features=OmitBlurEventOnElementRemoval"] node docs/kanit/2026-11-10/b210-olay-deney.mjs
// Çıktı: docs/kanit/2026-11-10/b210-olay-deney.txt (yerel Chromium 153; CI'nin Chromium'u (playwright 1.56 → 1194) burada YOK — denenmedi).
import { createRequire } from "node:module";
const require = createRequire(`${process.env.DEPO_KOK}/package.json`);
const { chromium } = require("playwright");
const browser = await chromium.launch({ args: process.env.TARAYICI_ARG ? process.env.TARAYICI_ARG.split(" ") : [] });
console.log("tarayıcı argümanı:", process.env.TARAYICI_ARG || "(yok)");
console.log("tarayıcı sürümü:", browser.version());
const page = await browser.newPage();
await page.setContent('<div id="dlg"><div id="root"><input type="search" data-mv="q" value=""></div></div>');
await page.evaluate(() => {
  window.log = [];
  for (const type of ["input", "change", "blur", "focusout", "focusin"]) document.getElementById("dlg").addEventListener(type, event => window.log.push(`${type}:${event.target.tagName}:"${event.target.value}":bağlı=${event.target.isConnected}:kökteki="${document.querySelector("#root input")?.value}"`), true);
});
await page.fill('[data-mv="q"]', "BNK-1");
await page.evaluate(() => {
  window.log.push("--innerHTML--");
  document.getElementById("root").innerHTML = '<input type="search" data-mv="q" value="">';
  window.log.push("--bitti--");
});
await page.waitForTimeout(200);
console.log((await page.evaluate(() => window.log)).join("\n"));
console.log("odak:", await page.evaluate(() => document.activeElement.tagName));
await browser.close();
