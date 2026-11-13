// 2.5.0 Ç5-A tur 2 — Açılış Düzeni ekranları (docs/erp/C5-ACILIS-TASARIM.md §17). Kullanıcı gözüyle, gerçek tıklama + insan hızında (ders 12):
//   İş 0 (EY-1; D 12.11 15:57 (4)): kilitli dönemi olan ESKİ sürüm verisinde (programın kendi ürettiği fikstür surum-2.0.26-zincir; güncellemeden sonraki ilk açılış)
//        Yönetim › Sistem'in Mutabakat satırı "Kural Değişikliği Farkı"nı sapma diliyle / kırmızıyla DEĞİL, uyarı olarak ve ne yapılacağını söyleyerek gösterir; aynı verideki
//        eski sürümden kalan satır ayrı, eskisi gibi görünür.
// Önceden (c5a2-taban 7e8d3228): kırmızı "Mutabakat: 2 denetimde sapma var (Kural Değişikliği Farkı (Kilitli Dönem: 05.10.2026 ve Öncesi), İleri tarihli hareket …)".
// Saat sahte ve sabit (ders 13); lisans servisi yok (ders 30); pencere seçicisi son görünen pencere (ders 39). DEPO=<kopya> ile başka kod kopyasına karşı koşulur (eski kod).
// Çalıştırma: node test/e2e/senaryo-acilis-duzeni-250.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..", "..");
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { installPageClock } = await imp("test/helpers.mjs");
const { CURRENT, bootVersion } = await imp("test/guvenilirlik/surumler.mjs");
const { readFixture, unpackFixture } = await imp("test/guvenilirlik/fikstur.mjs");
const { ADMIN_PASSWORD } = await imp("test/helpers.mjs");

const OUT = path.join(HERE, "artifacts", "senaryo-acilis-duzeni-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const FIXTURE = "surum-2.0.26-zincir";
const meta = readFixture(FIXTURE);
const TODAY = meta.oncesi?.today || String(meta.now || "").slice(0, 10);
const fixture = unpackFixture(FIXTURE);
const root = path.dirname(fixture.dataDir);
const server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: { time: `${TODAY}T12:00:00+03:00`, fixed: true } });
const app = server.app;
const BASE = server.base;
const browser = await chromium.launch();
const errors = [];
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
let page = null;
let shotNo = 0;
const shot = async name => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), fullPage: true });
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    await shot("hata").catch(() => null);
  }
};
/** Yönetim › Sistem'in Mutabakat satırı: { text, warn, error }. Gerçek tıklamayla sekme açılır. */
async function systemLine() {
  await page.goto(`${BASE}/admin.html#system`, { waitUntil: "load" });
  await page.click('.adm-tabs [data-tab="system"]');
  await page.waitForFunction(() => /^Mutabakat/.test(document.querySelector("#adm-integrity-status")?.textContent || ""), null, { timeout: 60000 });
  await page.$eval("#adm-integrity-status", node => node.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const text = (await page.textContent("#adm-integrity-status")).replace(/\s+/g, " ").trim();
  const classes = await page.$eval("#adm-integrity-status", node => node.className);
  return { text, warn: /\badm-warn-text\b/.test(classes), error: /\badm-error-text\b/.test(classes) };
}

try {
  // Ürünün durumundan ön koşul (tur 1d kalıbı): açılışta bekleyen dondurma biter, ilk tarama koşar.
  await app.ledger.snapshots.runPending();
  await app.integrity.scanInBackground().catch(() => null);
  const logBefore = app.store.all("SELECT action, summary FROM integrity_log ORDER BY rowid");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  page = await context.newPage();
  await installPageClock(page, app.config.now);
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });

  await step("İş 0. Kilitli eski veride Yönetim › Sistem: Kural Değişikliği Farkı uyarıdır (sarı, ne yapılacağı yazılı); eski sürümden kalan satır ayrı", async () => {
    const integrity = app.integrity.run();
    const ruleDiff = integrity.failures.find(item => item.code === "ledger:rule-diff");
    ok(ruleDiff && ruleDiff.count > 0, `ön koşul: veride kural farkı var (${ruleDiff?.count ?? 0} madde)`);
    const legacy = integrity.failures.filter(item => item.code !== "ledger:rule-diff" && !item.notice);
    ok(legacy.length > 0 && legacy.every(item => item.legacy && item.legacy >= item.count), `ön koşul: başka sapma yalnız eski sürümden kalan satır (${legacy.map(item => `${item.name}: ${item.legacy}/${item.count}`).join(", ")})`);
    const line = await systemLine();
    await shot("yonetim-mutabakat");
    await page.locator("#adm-integrity-status").locator("xpath=ancestor::section[1]").screenshot({ path: path.join(OUT, "yonetim-donem-kilidi-karti.png") }).catch(() => null);
    console.log(`  satır: ${line.text}`);
    ok(!line.error, "satır kırmızı (hata) değil");
    ok(line.warn, "satır sarı (uyarı)");
    ok(!/denetimde sapma var/.test(line.text), "'denetimde sapma var' yazmıyor");
    const sapma = /^Mutabakat: (\d+) denetimde eski sürümden kalan satır var; yeni işlemler engellenmez \(([^)]*)\)/.exec(line.text);
    ok(sapma && Number(sapma[1]) === legacy.length && !/Kural Değişikliği/.test(sapma[2]), `eski sürümden kalan satır kendi cümlesinde, kural farkı onun içinde değil: "${sapma?.[0] || ""}"`);
    ok(line.text.includes(`Uyarı (yeni işlemleri engellemez): ${ruleDiff.name} — ${ruleDiff.count} madde`), "kural farkı ayrı uyarı cümlesinde, madde sayısıyla");
    ok(/fark Yönetim › Kural Farkı Düzeltme ile ilk açık güne alınır\./.test(line.text), "ne yapılacağı yazılı (Kural Farkı Düzeltme)");
  });

  await step("Mutabakat Günlüğü ekran açılınca değişmez (zil / günlük davranışı aynı)", async () => {
    const logAfter = app.store.all("SELECT action, summary FROM integrity_log ORDER BY rowid");
    ok(JSON.stringify(logAfter) === JSON.stringify(logBefore), `günlük satırları aynı (${logBefore.length} → ${logAfter.length})`);
  });
  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`✗ senaryo durdu: ${error.stack || error.message}`);
} finally {
  await browser.close();
  await server.close?.();
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız.`);
console.log(`\n# tests ${passed + failed}\n# pass ${passed}\n# fail ${failed}`);
process.exitCode = failed ? 1 : 0;
