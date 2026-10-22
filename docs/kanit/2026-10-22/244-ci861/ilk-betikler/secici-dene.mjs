// Playwright'ın seçici motoru "son görünür pencere" için hangi CSS biçimlerini kabul ediyor (uygulamasız, boş sayfa).
import path from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(path.join(process.cwd(), "node_modules", "playwright", "index.mjs")).href);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<div class="m v"><h2 class="t">A</h2></div><div class="m v"><h2 class="t">B</h2></div><div class="m"><h2 class="t">C (görünmez)</h2></div><div id="sonra"></div>`);
const tries = {
  "last-of-type": ".m.v:last-of-type .t",
  "nth-last-child(1 of)": ".m.v:nth-last-child(1 of .m.v) .t",
  "not(:has(~))": ".m.v:not(:has(~ .m.v)) .t",
};
for (const [ad, sel] of Object.entries(tries)) {
  const native = await page.evaluate(s => { try { return document.querySelector(s)?.textContent ?? null; } catch (e) { return "HATA " + e.message; } }, sel);
  const pw = await page.$eval(sel, n => n.textContent).catch(e => "HATA " + String(e.message).split("\n")[0].slice(0, 120));
  const loc = await page.locator(sel).textContent({ timeout: 1000 }).catch(e => "HATA " + String(e.message).split("\n")[0].slice(0, 120));
  console.log(`${ad.padEnd(22)} yerel=${native} | $eval=${pw} | locator=${loc}`);
}
await browser.close();
