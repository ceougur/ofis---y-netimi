// e2e (test/e2e/run.mjs) "dosyaya not eklenir; işlem geçmişinde işlemi yapanla görünür" adımının ara sıra kırmızısının
// (11.10.2026, yerel f395d4f: "Error: işlemi yapan görünmeli") zorla yeniden üretimi ve düzeltmenin denetimi (CLAUDE.md ders 20).
//
// İLK TAHMİN ÇÜRÜDÜ: notun yaydığı canlı olay (workspace.changed "activity") işlemi YAPAN kullanıcıya gitmez (routes/workspace.mjs
// changed → events.publish { except: user.id }); bu betiğin ilk sürümü 16 denemede notun ardından TEK activity isteği gördü.
//
// KÖK NEDEN (bu betik gösterir): run.mjs'te nottan hemen önceki adım Yeni Kayıt açar → HOF.refreshData() → "data-refresh" →
// hof-insight.js refreshInsightSoon(1500) → 1,5 sn sonra /api/workspace/insight → yanıttaki profil applyProfile → "profile" olayı
// → hof-workspace.js refreshActivity → renderActivity kutuyu "İŞLEM GEÇMİŞİ · Yükleniyor…" ile SİLİP geçmişi yeniden çeker.
// Bu yeniden yükleme, testin notu gördüğü an (waitForFunction) ile ayrı textContent okuması arasına düşerse okunan metinde
// "Ofis yöneticisi" yoktur. Aynı yol başka bilgisayardaki her tablo değişikliğinde de (live "records" → refreshInsightSoon) açık
// geçmişi bir an boşaltır: kullanıcı da titremeyi görür → ÜRÜN davranışı; düzeltme ürün (aynı kaydın yeniden yüklenmesinde eski
// liste yerinde kalır).
//
// Zorlama (MODE=forced): her denemede (run.mjs sırası) arayüzden Yeni Kayıt → analiz isteği (insight) yolda TUTULUR → başka
// satır seçilir → not eklenir → not geçmişte görünür (T1) → tutulan analiz bırakılır, onun tetiklediği activity isteği DELAY ms
// bekletilir → o istek başladıktan sonra okunur (T2). Ön koşul kayıttan okunur: okuma anında yığınında applyProfile olan
// (profil olayından gelen) bir activity isteği BAŞLAMIŞ ve BİTMEMİŞ olmalı. MODE=natural: tutma/bekletme yok, run.mjs gibi okunur.
//
//   node --disable-warning=ExperimentalWarning test/e2e/e2e-not-yaris.mjs
// Ortam: TRIALS (varsayılan 6), MODE natural|forced (varsayılan forced), DELAY ms (varsayılan 1500)
// Geçme ölçütü run.mjs ile aynı: notu gördükten sonra okunan #hof-activity metninde "Ofis yöneticisi".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { escClose } from "./esc-kapat.mjs";

const TRIALS = Number(process.env.TRIALS || 6);
const MODE = process.env.MODE || "forced";
const DELAY = Number(process.env.DELAY || 1500);
const PASS = "Test-Admin-2026!";
const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "..", "fixtures", "ornek-dosyalar.xlsx");
const root = mkdtempSync(path.join(tmpdir(), "destekofis-not-yaris-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f33" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let pass = 0;
let fail = 0;
let precondition = 0;
let passWithPrecondition = 0;
let failWithPrecondition = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
    const real = window.fetch.bind(window);
    window.__act = [];
    window.fetch = (...args) => {
      const url = String(args[0]?.url || args[0]);
      if (!/\/api\/workspace\/cases\/[^/]+\/activity/.test(url)) return real(...args);
      const stack = String(new Error().stack || "").split("\n").slice(2, 18).map(line => line.trim().replace(/^at /, "").replace(/ \(.*\)$/, "").replace(/ http.*$/, "")).join(" < ");
      const origin = /applyProfile/.test(stack) ? "profil olayı (data-refresh → insight → applyProfile → refreshActivity)" : /refreshActivity/.test(stack) ? "refreshActivity (başka)" : /afterCaseChange/.test(stack) ? "not formu (afterCaseChange)" : "seçim (renderActivity)";
      const entry = { t: performance.now(), end: null, origin, stack };
      window.__act.push(entry);
      const pending = real(...args);
      pending.then(() => (entry.end = performance.now()), () => (entry.end = performance.now()));
      return pending;
    };
  });
  const page = await context.newPage();
  await page.goto(BASE + "/");
  await page.waitForSelector("#hof-auth input[name=username]");
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load", { timeout: 15000 }), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-start .hof-drop", { timeout: 15000 });
  await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(fixture);
  await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-mapping", { timeout: 30000 });
  await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click('.hof-modal-backdrop.is-visible [data-mode="replace"]')]);
  // Yükleme sonrası analiz penceresi (senaryo-214 kalıbı): kapat, sayfayı yeniden aç.
  await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 }).catch(() => {});
  await page.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]", { timeout: 3000 }).catch(() => escClose(page));
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector(".sidebar #hof-sidecard", { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll(".dynamic-table tbody tr").length > 2, null, { timeout: 15000 });
  for (let i = 0; i < 5 && (await page.$(".hof-modal-backdrop.is-visible")); i += 1) {
    await escClose(page);
    await page.waitForTimeout(400);
  }
  const open = await page.$$eval(".hof-modal-backdrop.is-visible .hof-modal-title", nodes => nodes.map(node => node.textContent));
  if (open.length) throw new Error(`kapanmayan pencere: ${open.join(" | ")}`);
  await page.waitForTimeout(3000); // açılıştaki analiz yüklemesi bitsin

  // Analiz isteğini tutan ve (bırakıldıktan sonra) activity isteğini bekleten yollar.
  let holdInsight = false;
  const held = [];
  let delayActivity = false;
  await page.route("**/api/workspace/insight*", async route => {
    const url = new URL(route.request().url());
    if (holdInsight && route.request().method() === "GET" && url.pathname === "/api/workspace/insight") {
      held.push(route);
      return;
    }
    await route.continue();
  });
  await page.route("**/api/workspace/cases/*/activity*", async route => {
    if (delayActivity) await sleep(DELAY);
    await route.continue();
  });

  for (let trial = 1; trial <= TRIALS; trial += 1) {
    held.length = 0;
    holdInsight = MODE === "forced";
    delayActivity = false;
    // run.mjs: yeni kayıt açık sekmenin kolonlarıyla oluşturulur ve seçilir (HOF.refreshData → data-refresh).
    const key = `2026/9${String(trial).padStart(2, "0")}`;
    await page.click("#hof-toolbar-new");
    await page.waitForSelector(".hof-modal .hof-record-grid");
    await page.fill('.hof-modal input[name="c0"]', key);
    await page.fill('.hof-modal input[name="c1"]', `Yarış Borçlu ${trial}`);
    await page.click('.hof-modal button[type="submit"]');
    await page.waitForFunction(k => document.querySelector(".detail-panel")?.dataset.hofKey === k, key, { timeout: 10000 });
    // run.mjs: dosyaya not eklenir (ikinci satır).
    await page.locator(".dynamic-table tbody tr").nth(1).locator("td").first().click({ position: { x: 12, y: 10 } });
    await page.waitForFunction(k => document.querySelector(".detail-panel")?.dataset.hofKey && document.querySelector(".detail-panel").dataset.hofKey !== k, key, { timeout: 10000 });
    await page.evaluate(() => (window.__act = []));
    const text = `Not ${trial} ödeme sözü alındı ${Date.now()}`;
    await page.click('.hof-case-actions [data-case-action="note"]');
    await page.fill(".hof-modal textarea", text);
    await page.click('.hof-modal button[type="submit"]');
    await page.waitForFunction(needle => document.querySelector("#hof-activity")?.textContent.includes(needle), text, { timeout: 10000 });
    if (MODE === "forced") {
      // Analiz isteği (Yeni Kayıt'tan 1,5 sn sonra) yolda tutuluyor olmalı; bırakılınca profil olayı geçmişi yeniden yükler.
      const until = Date.now() + 10000;
      while (!held.length && Date.now() < until) await sleep(50);
      delayActivity = true;
      holdInsight = false;
      for (const route of held.splice(0)) await route.continue();
      await page.waitForFunction(() => window.__act.some(entry => /applyProfile/.test(entry.stack)), null, { timeout: 10000 }).catch(() => {});
    }
    const readAt = await page.evaluate(() => performance.now());
    const activity = await page.textContent("#hof-activity");
    const ok = activity.includes("Ofis yöneticisi");
    delayActivity = false;
    holdInsight = false;
    for (const route of held.splice(0)) await route.continue();
    await page.waitForTimeout(DELAY + 1500);
    const log = await page.evaluate(() => window.__act.map(entry => ({ t: Math.round(entry.t), end: entry.end == null ? null : Math.round(entry.end), origin: entry.origin })));
    const pre = log.some(entry => /profil/.test(entry.origin) && entry.t <= readAt && (entry.end == null || entry.end > readAt));
    if (pre) precondition += 1;
    if (ok) pass += 1;
    else fail += 1;
    if (ok && pre) passWithPrecondition += 1;
    if (!ok && pre) failWithPrecondition += 1;
    console.log(`  ${ok ? "✓" : "✗"} deneme ${trial}: okuma ${Math.round(readAt)} ms; ön koşul (okuma anında profil olayından gelen yükleme uçuşta) ${pre ? "OLUŞTU" : "oluşmadı"}; istekler ${JSON.stringify(log)}; okunan: "${activity.replace(/\s+/g, " ").slice(0, 110)}"`);
  }
} finally {
  await browser.close().catch(() => {});
  await app.close().catch(() => {});
  rmSync(root, { recursive: true, force: true });
}
console.log(`\nMODE=${MODE} DELAY=${DELAY}: ${pass} geçti, ${fail} kaldı; ön koşul ${precondition}/${TRIALS} denemede oluştu (ön koşullu: ${passWithPrecondition} geçti, ${failWithPrecondition} kaldı)`);
console.log(`# tests ${TRIALS}\n# pass ${pass}\n# fail ${fail}\n# cancelled 0\n# skipped 0\n# todo 0`);
// Zorla kipte ön koşul her denemede oluşmadıysa sonuç kanıt değildir (ders 20): çıkış 1.
process.exit(fail === 0 && (MODE !== "forced" || precondition === TRIALS) ? 0 : 1);
