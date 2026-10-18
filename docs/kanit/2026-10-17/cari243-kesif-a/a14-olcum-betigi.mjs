// A14 zorla üretme denemesi: REPO=<kök> node cls.mjs — sessions isteği geciktirilir, şeridin geliş anı ve kaymalar yazılır.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const REPO = process.env.REPO;
const DELAY = Number(process.env.DELAY || 1500);
const { chromium } = await import(pathToFileURL(path.join(REPO, "node_modules/playwright/index.mjs")).href);
const { bootVersion, CURRENT } = await import(pathToFileURL(path.join(REPO, "test/guvenilirlik/surumler.mjs")).href);
const { ADMIN_PASSWORD } = await import(pathToFileURL(path.join(REPO, "test/helpers.mjs")).href);
const root = mkdtempSync(path.join(tmpdir(), "cari243-cls-"));
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
const api = await server.login();
await api.post("/api/workspace/bank/setup/dismiss", {});
for (let i = 0; i < 12; i++) await api.post("/api/workspace/records", { values: { "DOSYA NO": `2026/${100 + i}`, BORÇLU: `Kişi ${i}`, TUTAR: `${(i + 1) * 25000},00` }, caseKey: `2026/${100 + i}` });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "tr-TR" });
await ctx.addInitScript(() => {
  window.__shifts = [];
  new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ v: +e.value.toFixed(4), at: Math.round(e.startTime), src: (e.sources || []).map(s => String(s.node?.id || s.node?.className || s.node?.nodeName || "").slice(0, 30)) }); }).observe({ type: "layout-shift", buffered: true });
  new MutationObserver(() => { if (!window.__pagesAt && document.querySelector("#hof-pages .hof-page")) window.__pagesAt = Math.round(performance.now()); if (!window.__tableAt && document.querySelector(".dynamic-table tbody tr")) window.__tableAt = Math.round(performance.now()); }).observe(document, { childList: true, subtree: true });
});
const page = await ctx.newPage();
await page.goto(`${server.base}/`);
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
await page.waitForSelector(".dynamic-table tbody tr", { timeout: 30000 });
await page.waitForTimeout(2000);
let hits = 0;
await page.route("**/api/workspace/sessions*", async route => { hits++; await new Promise(r => setTimeout(r, DELAY)); await route.continue(); });
for (let n = 0; n < Number(process.env.N || 3); n++) {
  await page.reload();
  await page.waitForSelector("#hof-pages .hof-page", { timeout: 20000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({ pagesAt: window.__pagesAt, tableAt: window.__tableAt, shifts: window.__shifts, total: +window.__shifts.reduce((s, e) => s + e.v, 0).toFixed(4) }));
  console.log(JSON.stringify({ hits, ...r }));
}
await browser.close();
await server.close();
