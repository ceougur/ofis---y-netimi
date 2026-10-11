// Senaryo Banka 2.1.0 — yargıç + eleştirmen (11.10.2026) B1/B2 EKRANDAN: hesapların açılışından önceki eski havale (plan §3.5 kural 1).
// Gerçek kullanıcı gibi tıklanır; görünen metin okunur, ekran görüntüsü alınır; her adımdan sonra veri tabanı (API) okunur:
//  1. İki banka hesabı (Ziraat ve Garanti, ikisi de 01.10.2026 açılışlı) ve hesap yokken (eski sürüm gibi) girilmiş 10.09 hesapsız havale.
//  2. Cari kartı → eski havaleyi Düzelt: tutar 1.000 → 1.200 (Banka Hesabı alanı "Atanmamış (Eski Hareket)") → kaydedilir, satır hesapsız kalır
//     (önceden 409 "açılışından önce"; Gerçek Banka değişmez, Hesabı Atanmamış 1.200).
//  3. Cari kartı → Tahsilat → Havale/EFT → Banka Hesabı seçicisinde son seçenek "Hesapsız (Açılıştan Önce)"; tarih 15.09 → kaydedilir, hesapsız.
//  4. Nasıl bozarım: tarih bugün + "Hesapsız (Açılıştan Önce)" → kaydedilmez, formda neden görünür ("açılışından önceki"), satır yazılmaz.
//  5. Kurulum Sihirbazı (Devir Kapanışı) yapılmış eski havalenin tutarı → kaydedilmez, formda Kurulum Geçmişi yolu görünür (Y1).
// Çalıştırma: npm run test:senaryo-banka-210-eski-satir (ekran görüntüleri artifacts/senaryo-banka-210-eski-satir/).
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-banka-210-eski-satir");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-banka-210-eski-satir-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, maxCompanies: 2, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f42" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const errors = [];

let passed = 0;
let failed = 0;
let shotNo = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
let page = null;
const shot = async name => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const pause = ms => page.waitForTimeout(ms);
const closeAll = async () => {
  for (let index = 0; index < 6 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await pause(300);
  }
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    await shot("hata").catch(() => null);
    await closeAll().catch(() => null);
  }
};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const textOf = selector => page.$eval(selector, node => node.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const entriesOf = async id => (await must("cari", api.get(`/api/workspace/accounts/${id}`))).entries.filter(entry => entry.kind === "in");
const summary = () => must("özet", api.get("/api/workspace/bank/summary"));

const ctx = {};
try {
  await api.login("admin", PASS);
  await must("sihirbazı kapat", api.post("/api/workspace/bank/setup/dismiss", {}));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await pause(800);

  await step("1. Hazırlık (API): hesap yokken 10.09 hesapsız havale 1.000; sonra Ziraat ve Garanti 01.10 açılışla", async () => {
    ctx.abc = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    ctx.oldId = (await must("eski havale", api.post(`/api/workspace/accounts/${ctx.abc.id}/entries`, { kind: "in", method: "bank", date: "2026-09-10", amount: "1.000" }))).entryId;
    ctx.ziraat = await must("Ziraat", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
    ctx.garanti = await must("Garanti", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } }));
    const view = await summary();
    ok(view.realBank.minor === 15_000_000 && view.unassigned.bankMinor === 100_000, `Gerçek Banka ${view.realBank.minor / 100}, Hesabı Atanmamış ${view.unassigned.bankMinor / 100}`);
  });

  const openAbc = async () => {
    await page.click('#hof-sidecard [data-action="accounts"]');
    await page.waitForSelector(`.hof-accounts-modal tr[data-account="${ctx.abc.id}"]`, { timeout: 10000 });
    await page.click(`.hof-accounts-modal tr[data-account="${ctx.abc.id}"]`);
    await page.waitForSelector('.hof-accounts-modal [data-entry="in"]', { timeout: 10000 });
  };

  await step("2. Eski havaleyi Düzelt: 1.000 → 1.200 (Atanmamış (Eski Hareket)) → kaydedilir, hesapsız kalır (B1)", async () => {
    await openAbc();
    await page.click(`.hof-accounts-modal [data-edit-entry="${ctx.oldId}"]`);
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    const pick = await page.$$eval(`${form} select[name="bankAccountId"] option`, nodes => nodes.map(node => node.textContent.trim())).catch(() => []);
    ok(pick[0] === "Atanmamış (Eski Hareket)" && pick.includes("Hesapsız (Açılıştan Önce)"), `Banka Hesabı seçicisi: ${pick.join(" | ")}`);
    await page.fill(`${form} input[name="amount"]`, "1.200");
    await pause(300);
    await shot("eski-havale-duzelt");
    await page.click(`${form} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible .hof-form input[name="amount"]'), null, { timeout: 10000 }).catch(() => null);
    await pause(500);
    const error = await textOf(`${form} .hof-form-error`);
    const row = (await entriesOf(ctx.abc.id)).find(entry => entry.id === ctx.oldId);
    ok(!error && row?.amount === 1200 && row?.finRef === "", `düzeltildi: tutar ${row?.amount}, hesap “${row?.finRef}”${error ? `, hata “${error}”` : ""}`);
    const view = await summary();
    ok(view.realBank.minor === 15_000_000 && view.unassigned.bankMinor === 120_000, `Gerçek Banka ${view.realBank.minor / 100} (değişmedi), Hesabı Atanmamış ${view.unassigned.bankMinor / 100}`);
    await closeAll();
  });

  await step("3. Tahsilat → Havale/EFT → \"Hesapsız (Açılıştan Önce)\", tarih 15.09 → kaydedilir, hesapsız (B1, çok hesap)", async () => {
    await openAbc();
    await page.click('.hof-accounts-modal [data-entry="in"]');
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await page.fill(`${form} input[name="amount"]`, "300");
    await page.selectOption(`${form} select[name="method"]`, "bank");
    await page.waitForSelector(`${form} [data-bank-pick]:not([hidden]) select[name="bankAccountId"]`, { timeout: 8000 });
    const options = await page.$$eval(`${form} select[name="bankAccountId"] option`, nodes => nodes.map(node => node.textContent.trim()));
    ok(options.length === 4 && options[0] === "Hesap Seçin" && options[3] === "Hesapsız (Açılıştan Önce)", `seçenekler: ${options.join(" | ")}`);
    await page.fill(`${form} input[name="date"]`, "2026-09-15");
    await page.selectOption(`${form} select[name="bankAccountId"]`, "none");
    await pause(300);
    await shot("tahsilat-hesapsiz-acilistan-once");
    const before = (await entriesOf(ctx.abc.id)).length;
    await page.click(`${form} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible .hof-form input[name="amount"]'), null, { timeout: 10000 }).catch(() => null);
    await pause(500);
    const list = await entriesOf(ctx.abc.id);
    const added = list.find(entry => entry.amount === 300 && entry.date === "2026-09-15");
    ok(list.length === before + 1 && added?.finRef === "", `kaydedildi: ${list.length - before} satır, hesap “${added?.finRef}”`);
    const view = await summary();
    ok(view.realBank.minor === 15_000_000 && view.unassigned.bankMinor === 150_000, `Gerçek Banka ${view.realBank.minor / 100}, Hesabı Atanmamış ${view.unassigned.bankMinor / 100}`);
    await closeAll();
  });

  await step("4. Nasıl bozarım: bugünkü tarihle \"Hesapsız (Açılıştan Önce)\" → kaydedilmez, neden formda", async () => {
    await openAbc();
    await page.click('.hof-accounts-modal [data-entry="in"]');
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await page.fill(`${form} input[name="amount"]`, "77");
    await page.selectOption(`${form} select[name="method"]`, "bank");
    await page.waitForSelector(`${form} [data-bank-pick]:not([hidden]) select[name="bankAccountId"]`, { timeout: 8000 });
    await page.selectOption(`${form} select[name="bankAccountId"]`, "none");
    const before = (await entriesOf(ctx.abc.id)).length;
    await page.click(`${form} button[type="submit"]`);
    await pause(800);
    const error = await textOf(`${form} .hof-form-error`);
    await shot("hesapsiz-bugun-reddedildi");
    ok(/açılışından önceki/.test(error) && (await entriesOf(ctx.abc.id)).length === before, `kaydedilmedi: “${error}”`);
    await closeAll();
  });

  await step("5. Devir Kapanışı yapılmış eski havalenin tutarı → kaydedilmez, Kurulum Geçmişi yolu formda (Y1)", async () => {
    // Tek hesaplı kurulum: Garanti pasife alınmaz; sihirbaz Ziraat'te Devir Kapanışı'yla (eski havaleler 102.00'dan 500'e kapanır).
    const run = await must("sihirbaz", api.post("/api/workspace/bank/setup", { accountId: ctx.ziraat.id, carryClose: true, assign: "all" }));
    ok(run.carry.bankMinor === 150_000, `Devir Kapanışı ${run.carry.bankMinor / 100}`);
    await openAbc();
    await page.click(`.hof-accounts-modal [data-edit-entry="${ctx.oldId}"]`);
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await page.fill(`${form} input[name="amount"]`, "1.250");
    await page.click(`${form} button[type="submit"]`);
    await pause(800);
    const error = await textOf(`${form} .hof-form-error`);
    await shot("devir-kapanisi-satiri-reddedildi");
    const row = (await entriesOf(ctx.abc.id)).find(entry => entry.id === ctx.oldId);
    ok(/Kurulum Geçmişi/.test(error) && row?.amount === 1200, `kaydedilmedi (tutar ${row?.amount}): “${error}”`);
    const view = await summary();
    ok(view.unassigned.bankMinor === 0, `Hesabı Atanmamış ${view.unassigned.bankMinor / 100} (takılı artık yok)`);
    await closeAll();
  });
} catch (error) {
  failed += 1;
  console.log(`✗ kurulum hatası: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-banka-210-eski-satir: ${passed} geçti, ${failed} kaldı · ekran görüntüleri ${OUT}`);
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
