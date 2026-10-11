// 2.1.0 — Aşama 2, Dilim 1: sahte saat arayüzde (sunucu config.now ↔ Playwright page.clock eşlemesi).
// Kabul testinin "saat 12.10.2026 → kuyruk" gibi adımları ekrandan koşacak; bunun için tarayıcının bugünü (form tarihleri, "Bu Ay")
// ile sunucunun bugünü (varsayılan tarih, ileri tarih denetimi, mutabakat kapısı) aynı sahte günde olmalı.
//  1. Sunucu sahte saatle (gerçek günden farklı: 04.01.2027 Pazartesi) açılır; sayfanın saati installPageClock ile bağlanır.
//  2. Tarayıcıda new Date() sunucunun bugünüyle aynı gün; Kasa → + Tahsilat formunda Tarih sahte gün.
//  3. Form kaydedilir → sunucu satırı sahte günle yazar (ileri tarih saymaz).
//  4. moveClock ile iki gün ilerletilir → formun tarihi yeni gün; kaydedilir → 200, satır yeni günde; mutabakat ok.
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/banka-210-saat.mjs
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock, moveClock } from "../helpers.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "banka-210-saat");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const T = "2027-01-04T10:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-210-saat-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: T, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f26" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const clock = app.config.now;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "en-US" });
await context.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
page.on("console", message => {
  if (message.type() === "error" && !/status of 401/.test(message.text())) errors.push(`console ${message.text()}`);
});
let passed = 0;
let failed = 0;
let shotNo = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const shot = async name => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const api = createClient(BASE);
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const browserDay = () => page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
});
const addCashFromUi = async description => {
  await page.click(`${modal} [data-add="in"]`);
  await page.waitForSelector(`${top} form input[name="date"]`, { timeout: 10000 });
  const formDay = await page.$eval(`${top} form input[name="date"]`, input => input.value);
  await page.fill(`${top} form input[name="amount"]`, "125");
  await page.fill(`${top} form input[name="description"]`, description);
  const response = page.waitForResponse(res => res.url().includes("/api/workspace/cash") && res.request().method() === "POST", { timeout: 15000 });
  await page.click(`${top} form button[type="submit"]`);
  const res = await response;
  const body = await res.json().catch(() => ({}));
  return { formDay, status: res.status(), id: body?.data?.id || "", error: body?.error || "" };
};

try {
  await api.login("admin", PASS);
  await installPageClock(page, clock);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector('#hof-sidecard [data-action="cash"]', { timeout: 60000 });
  await page.waitForTimeout(800);

  console.log("\n■ 1–3. Sahte gün (04.01.2027): tarayıcı ve sunucu aynı gün; Kasa formu kaydedilir");
  const day0 = clock.today();
  ok(day0 === "2027-01-04", `sunucunun bugünü sahte gün (${day0})`);
  ok((await browserDay()) === day0, "tarayıcının bugünü sunucuyla aynı");
  await page.click('#hof-sidecard [data-action="cash"]');
  await page.waitForSelector(`${modal} [data-add="in"]`, { timeout: 15000 });
  const first = await addCashFromUi("Saat eşlemesi 1");
  ok(first.formDay === day0, `formun Tarih alanı sahte gün (${first.formDay})`);
  ok(first.status === 200, `sunucu kaydetti (${first.status} ${first.error})`);
  const row1 = app.store.get("SELECT date FROM cash_entries WHERE id = ?", first.id);
  ok(row1?.date === day0, `satırın tarihi ${row1?.date}`);
  await shot("sahte-gun");

  console.log("\n■ 4. Saat iki gün ilerler (moveClock): form yeni günü önerir, sunucu kabul eder");
  await moveClock(clock, page, { days: 2 });
  const day2 = clock.today();
  ok(day2 === "2027-01-06", `sunucunun bugünü ${day2}`);
  ok((await browserDay()) === day2, "tarayıcı da ilerledi");
  await page.waitForTimeout(400);
  const second = await addCashFromUi("Saat eşlemesi 2");
  ok(second.formDay === day2, `formun Tarih alanı yeni gün (${second.formDay})`);
  ok(second.status === 200, `ileri tarih sayılmadı (${second.status} ${second.error})`);
  ok(app.store.get("SELECT date FROM cash_entries WHERE id = ?", second.id)?.date === day2, "satır yeni günde");
  const integrity = unwrap(await api.get("/api/workspace/ledger/integrity"));
  ok(integrity?.ok === true, "mutabakat ok");
  await shot("iki-gun-sonra");
  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`✗ senaryo durdu: ${error.stack || error.message}`);
  await shot("hata").catch(() => null);
} finally {
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
}
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız.`);
process.exitCode = failed ? 1 : 0;
