// Gözden geçirme 2.4.3 (gg243 #3, ORTA — ortak çekirdek): arka planda giden yazma isteği (kritik stok "bildirildi" POST'u, background) açık formun
// kirli taslağını "kaydedildi" sayıyordu (hof-core sendApi → writeOrigin → noteWrite → modal.wrote): Esc formu SORUSUZ kapatıyor, yazılanlar
// kayboluyordu. Artık taslağı yalnız kullanıcının başlattığı yazma kapatır. GERÇEK tarayıcıda:
//  1. Yeni Cari formuna insan hızında yazılır; arka plan yazması (kritik stok bildirimi) gider → form hâlâ kaydedilmemiş; Esc "Kaydedilmemiş Değişiklik"
//     sorar; "Forma Dön" ile yazılanlar yerinde.
//  2. İşaretsiz (background'suz) ama KULLANICI HAREKETİ OLMADAN giden yazma (zamanlayıcı; son düğme tıklamasından 15 sn sonra) da taslağa dokunmaz.
//  3. Karşı sınama: kullanıcının kendi Kaydet'i taslağı kapatır (pencere sorusuz kapanır, cari açılır).
// Eski kodda (52bacd3) 1. adım kırmızıdır; DEPO=<eski kopya> ile koşulur. Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-gg243-arka-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f44" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const api = createClient(BASE);
await api.login("admin", PASS);
await api.post("/api/workspace/bank/setup/dismiss", {});
// Kritik stokta bir ürün (bildirim yazması gitsin).
await api.post("/api/workspace/stock", { kind: "goods", code: "K-1", name: "Kritik Ürün", unit: "Adet", minQty: "10", unitPrice: "5", openingQty: "2", openingPay: "none" });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const writes = [];
page.on("request", request => {
  if (request.method() !== "GET" && request.url().includes("/api/")) writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
});
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const visible = ".hof-modal-backdrop.is-visible";
const question = () => page.locator(visible, { hasText: "Kaydedilmemiş Değişiklik" });
async function openNewAccount() {
  await page.evaluate(() => window.HOF.accounts.open());
  await page.waitForSelector(`${visible} [data-act="new"]`);
  await page.click(`${visible} [data-act="new"]`);
  const dialog = page.locator(`${visible} .hof-modal`).last();
  await dialog.locator('input[name="name"]').waitFor();
  return dialog;
}
async function typeInto(dialog, name, value) {
  await dialog.locator(`input[name="${name}"]`).click();
  await page.keyboard.type(value, { delay: 25 });
}
async function escKeepsForm(label, dialog, expected) {
  await page.keyboard.press("Escape");
  const asked = await question().waitFor({ timeout: 3000 }).then(() => true, () => false);
  ok(asked, `${label}: Esc "Kaydedilmemiş Değişiklik" sordu`);
  if (asked) {
    await question().locator('[data-answer="no"]').click();
    await question().waitFor({ state: "detached", timeout: 3000 }).catch(() => null);
  }
  const values = await Promise.all(Object.keys(expected).map(name => dialog.locator(`input[name="${name}"]`).inputValue().catch(() => "(yok)")));
  ok(Object.values(expected).every((value, index) => values[index] === value), `${label}: yazılanlar yerinde (${values.join(" | ")})`);
}

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForFunction(() => window.HOF?.accounts?.open && window.HOF?.stock?.refreshAlerts, null, { timeout: 60000 });
  await sleep(2500); // açılıştaki kritik stok bildirimi (günün ilki) geçsin

  console.log("1) yazarken arka plan yazması (kritik stok bildirimi, background)");
  let dialog = await openNewAccount();
  await typeInto(dialog, "name", "Yazılmış Ama Kaydedilmemiş Cari");
  await typeInto(dialog, "phone", "0533 111 22 33");
  ok(await page.evaluate(() => window.HOF.hasDirtyModal()), "ön koşul: form kaydedilmemiş sayılıyor");
  const before = writes.length;
  // Ertesi günün ilk stok uyarısı / tarayıcı kaydı silinmiş (gizli pencere): istemci "bildirildi" POST'unu gönderir.
  await page.evaluate(() => {
    try {
      localStorage.removeItem("hof.stock.alerted");
    } catch {}
    window.HOF.stock.refreshAlerts();
  });
  for (let i = 0; i < 40 && !writes.slice(before).some(item => item.endsWith("/stock/alerts/notified")); i += 1) await sleep(100);
  await sleep(500);
  ok(writes.slice(before).some(item => item.endsWith("/stock/alerts/notified")), `ön koşul: arka plan yazması gitti (${JSON.stringify(writes.slice(before))})`);
  ok(await page.evaluate(() => window.HOF.hasDirtyModal()), "arka plan yazmasından sonra form hâlâ kaydedilmemiş");
  await escKeepsForm("1", dialog, { name: "Yazılmış Ama Kaydedilmemiş Cari", phone: "0533 111 22 33" });

  console.log("2) kullanıcı hareketi olmadan giden işaretsiz yazma (son düğme tıklamasından 15 sn sonra)");
  await typeInto(dialog, "email", "deneme@ornek.com");
  const since = await page.evaluate(() => window.HOF.__commitWindow?.since?.() ?? null);
  const wait = since === null ? 16000 : Math.max(0, 15500 - since);
  await sleep(wait);
  const before2 = writes.length;
  // Zamanlayıcıyla giden işaretsiz yazma (kullanıcı formda yazıyor; düğmeye basmadı).
  await page.evaluate(() => window.HOF.api("/api/workspace/stock/alerts/notified", { method: "POST", body: {} }).catch(() => null));
  await sleep(400);
  ok(writes.length > before2, "ön koşul: işaretsiz yazma gitti");
  ok(await page.evaluate(() => window.HOF.hasDirtyModal()), "form hâlâ kaydedilmemiş");
  await escKeepsForm("2", dialog, { name: "Yazılmış Ama Kaydedilmemiş Cari", phone: "0533 111 22 33", email: "deneme@ornek.com" });

  console.log("3) karşı sınama: kullanıcının Kaydet'i taslağı kapatır");
  await dialog.locator('button[type="submit"]').first().click();
  const saved = await page.waitForFunction(() => !window.HOF.hasDirtyModal(), null, { timeout: 8000 }).then(() => true, () => false);
  ok(saved, "Kaydet'ten sonra kaydedilmemiş değişiklik yok");
  await page.keyboard.press("Escape");
  ok(!(await question().waitFor({ timeout: 1500 }).then(() => true, () => false)), "Kaydet'ten sonra Esc soru sormaz");
  const accounts = await api.get("/api/workspace/accounts?q=Yaz%C4%B1lm%C4%B1%C5%9F");
  const list = accounts.data?.data?.accounts || accounts.data?.data?.items || accounts.data?.data || [];
  ok(JSON.stringify(list).includes("Yazılmış Ama Kaydedilmemiş Cari"), "cari kaydedildi (sunucudan okundu)");
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} gg243-arka-plan-yazma: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
