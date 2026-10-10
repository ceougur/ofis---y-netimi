// Senaryo Banka 2.1.0 — TEMEL SÜRÜM: ertelenen özellikler EKRANDA GÖRÜNMEZ (kullanıcı kararı 10.10.2026 "TEMEL SÜRÜME BAŞLA"; plan §12.1 "yarım
// özellik görünmez") ve Nakit Akış başlangıcı K10 (plan §8.9: "Bugünkü Nakit ve Banka" = Nakit Kasa + Gerçek Banka; Hesabı Atanmamış ayrı satır).
// Ertelenenler: döviz/kur/değerleme, Bankaya Tahsile Ver, K8 avans, faturanın bankalı iade/iptal ayrıntısı ve toplu kesim, kalan §8.10 raporları,
// Kasa açılış/devir; POS (2.2.0), ekstre ve mutabakat (2.3.0). API tarafı test/banka-210-ertelenen.test.mjs'te.
// Gerçek kullanıcı gibi tıklanır; her ekranda görünen metin ve seçenekler okunur, ekran görüntüsü alınır:
//  1. Banka penceresi sekmeleri: yalnız Genel Bakış · Hesaplar · Hareketler · Ayarlar (POS, Ekstre ve Mutabakat, Döviz yok).
//  2. Genel Bakış: Gerçek Banka; POS Bekleyen, Blokeli POS, Güncel Kurla, Eşleşmeyen, Değerleme yok; Hesabı Atanmamış ayrı satır.
//  3. Hesaplar → + Yeni Hesap: Hesap Türü'nde Döviz yok; Para Birimi ve Açılış Kuru alanı yok. Kurulum Sihirbazı'nın hesap formu da aynı.
//  4. Hesap Detayı: + Masraf, + Faiz, + Diğer İşlem, Transfer; Ekstre Yükle, Döviz Al/Sat, POS yok.
//  5. Hareketler: İşlem Türü süzgecinde Döviz, Kur Değerlemesi, POS, Tahsile Ver yok; Planlı İşlem formunda döviz/POS türü yok.
//  6. Ayarlar Temel ve Gelişmiş: POS, Ekstre, Döviz, Hareket (Kanal Alanı), Elle Banka Fişi, Bağdaştırıcılar, Kambiyo eşlemeleri yok.
//  7. Raporlar → Tüm Raporlar: Banka grubunda yalnız Banka Bakiye, Banka Hareket, Banka Masraf, Alt Hesap Mizanı.
//  8. Raporlar → Nakit Akış: "Bugünkü Nakit ve Banka" = Nakit 2.000 + Gerçek Banka 10.000 = 12.000; Hesabı Atanmamış (POS 900) ayrı kutu,
//     başlangıca girmez; tablonun Başlangıç satırı 12.000.
//  9. Çek/Senet kartı: Bankaya Tahsile Ver düğmesi yok.
// 10. İleri tarihli eski hesapsız havale (GERÇEK v2.0.23 verisi, ayrı sunucu): Hesabı Atanmamış 250 (ileri tarihli 1.000 ayrı bilgi); listede
//     "Tarihi Gelince Atanabilir", seçim kutusu pasif, nedeni görünür; sihirbaz geçmişi aktarır, ileri tarihliyi atlar ve söyler (409 yok);
//     saat 21.10.2026'ya alınınca Bu Hesaba Ata 200, Gerçek Banka 11.250, mutabakat temiz. (v2.0.23 etiketi gerekir: CI e2e işi etiketleri çeker.)
// Çalıştırma: npm run test:senaryo-banka-210-temel (ekran görüntüleri artifacts/senaryo-banka-210-temel/).
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock, moveClock } from "../helpers.mjs";
import { checkoutTag, tagCommit } from "../guvenilirlik/surumler.mjs";
import { fetchCutWatch } from "./tarayici-kesme.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-banka-210-temel");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-banka-210-temel-"));
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
let cutWatch = null;
const shot = async name => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const bankWin = ".hof-bank-modal";
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
const visibleText = selector => page.$$eval(selector, nodes => nodes.filter(node => node.offsetParent !== null).map(node => node.innerText.replace(/\s+/g, " ").trim()).join(" | ")).catch(() => "");
// Ertelenen özelliklerin ekranda görünebilecek adları (kalıplar büyük/küçük harf duyarlı: "Kurulum" ≠ "Kur").
const LATER = [/POS Bekleyen/, /Blokeli POS/, /POS Tanımla/, /\+ POS\b/, /Ekstre Yükle/, /Ekstre ve Mutabakat/, /Mutabakat Yap/, /Eşleşmeyen/, /Güncel Kurla/, /Döviz Al/, /Döviz Sat/, /Kur Değerleme/, /Değerleme Kuru/, /Kambiyo/, /Bankaya Tahsile Ver/, /Tahsildeki Çek/, /Sanal POS Bağlantısı/, /Açık Bankacılık/i, /Bağdaştırıcılar/, /Elle Banka Fişi/, /Kanal Alanı/, /Kasa Açılış/, /Avans/];
const laterIn = text => LATER.filter(pattern => pattern.test(text)).map(pattern => pattern.source);
const openBank = async () => {
  await page.click('#hof-sidecard [data-action="bank"]');
  await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 15000 });
  await pause(600);
};
const tab = async id => {
  await page.click(`${bankWin} .hof-bank-tabs [data-tab="${id}"]`);
  await pause(800);
};
const optionsOf = selector => page.$$eval(`${selector} option`, nodes => nodes.map(node => node.textContent.trim())).catch(() => []);
const money = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

// 10. İleri tarihli eski hesapsız havale (2.1.0 temel sürüm; plan A13 / karar 42). Veri GERÇEK v2.0.23 koduyla (git etiketi) girilir: alınan çek
// bankaya İLERİ TARİHLE (20.10.2026) tahsil + geçmiş havale tahsilat (06.10.2026). Güncel kod aynı klasörü sahte saat 08.10.2026 ile açar (ayrı
// sunucu, ayrı tarayıcı bağlamı; adım 1–9'un sayıları değişmez). Beklenen: Genel Bakış'ta Hesabı Atanmamış 250 (ileri tarihli 1.000 bu tutara
// girmez, ayrı yazılır); listede ileri tarihli satır "Tarihi Gelince Atanabilir", seçim kutusu pasif, nedeni görünür; sihirbaz önizlemesi ve
// sonucu atlanan satırı söyler (409 ledger-integrity YOK); saat 21.10.2026'ya alınınca satır seçilir, Bu Hesaba Ata 200, mutabakat temiz.
async function legacyFutureSection() {
  const OLD = "v2.0.23";
  if (!tagCommit(OLD)) {
    ok(false, `${OLD} etiketi bu depoda yok (git fetch --tags); ileri tarihli eski havale bölümü GERÇEK eski sürüm verisi olmadan koşulmaz`);
    return;
  }
  const root2 = mkdtempSync(path.join(tmpdir(), "destekofis-banka-210-ileri-eski-"));
  const dirs = { dataDir: path.join(root2, "data"), backupDir: path.join(root2, "backups") };
  const common = { ...dirs, logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f42" } };
  const mainPage = page;
  let app2 = null;
  let context2 = null;
  try {
    // Eski sürüm (gerçek saat; tarihler mutlak — 20.10.2026 ileri, 06.10.2026 geçmiş: eski sürüm ikisini de kabul eder).
    const { createApp: createOld } = await import(pathToFileURL(path.join(checkoutTag(OLD).dir, "server", "app.mjs")).href);
    const old = createOld({ ...common, startLicenseTimers: false });
    const oldAddress = await old.listen(0, "127.0.0.1");
    try {
      const oldApi = createClient(`http://127.0.0.1:${oldAddress.port}`);
      await oldApi.login("admin", PASS);
      const party = await must(`${OLD} cari`, oldApi.post("/api/workspace/accounts", { name: "Çekli Müşteri", type: "customer" }));
      const chq = await must(`${OLD} çek`, oldApi.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 1000, issueDate: "2026-10-05", dueDate: "2026-10-20", serialNo: "ILR-E2E", accountId: party.id }));
      await must(`${OLD} çek bankaya ileri tarihle tahsil`, oldApi.post(`/api/workspace/cheques/${chq.id}/actions`, { action: "collect", date: "2026-10-20", method: "bank", status: "portfolio" }));
      await must(`${OLD} geçmiş havale`, oldApi.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: 250, date: "2026-10-06", method: "bank" }));
    } finally {
      await old.close();
    }
    app2 = createApp({ ...common, now: NOW, maxCompanies: 2 });
    const { port: port2 } = await app2.listen(0, "127.0.0.1");
    const base2 = `http://127.0.0.1:${port2}`;
    const api2 = createClient(base2);
    await api2.login("admin", PASS);
    await must("sihirbazı kapat", api2.post("/api/workspace/bank/setup/dismiss", {}));
    const account = await must("Ziraat", api2.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } }));

    context2 = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
    await context2.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
    page = await context2.newPage();
    page.on("pageerror", error => errors.push(`pageerror (ileri tarihli eski) ${error.message}`));
    page.on("console", message => {
      if (message.type() === "error" && !/status of 40[0139]|api\/auth\/me|Failed to load resource/.test(`${message.text()} ${message.location().url}`)) errors.push(`console (ileri tarihli eski) ${message.text()}`);
    });
    await installPageClock(page, app2.config.now);
    await page.goto(`${base2}/`);
    await page.fill("#hof-auth input[name=username]", "admin");
    await page.fill("#hof-auth input[name=password]", PASS);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await pause(800);

    // Genel Bakış: Hesabı Atanmamış 250 (bugüne kadar); ileri tarihli 1.000 ayrı satır bilgisinde.
    await openBank();
    await page.waitForSelector(`${bankWin} [data-bank-unassigned]`, { timeout: 10000 });
    const row = await textOf(`${bankWin} [data-bank-unassigned]`);
    ok(row.includes(money(250)) && !row.includes(money(1250)), `Genel Bakış: Hesabı Atanmamış 250 (ileri tarihli 1.000 toplama girmez): ${row.slice(0, 220)}`);
    const later = await textOf(`${bankWin} [data-bank-unassigned-future]`);
    ok(/Tarihi gelmemiş 1 eski hareket/.test(later) && later.includes(money(1000)) && later.includes("20.10.2026"), `ileri tarihli satır ayrı bilgi: ${later}`);
    await shot("ileri-eski-genel-bakis");

    // Hesabı Atanmamış Eski Hareketler: ileri tarihli satır işaretli, seçilemez, nedeni görünür; geçmiş satır seçilebilir.
    await page.click(`${bankWin} [data-bank-unassigned] [data-act="legacy"]`);
    await page.waitForSelector(`${bankWin} .hof-bank-legacy tbody tr`, { timeout: 10000 });
    await page.waitForSelector(`${bankWin} [data-legacy-future]`, { timeout: 10000 });
    const futureRow = await page.$eval(`${bankWin} [data-legacy-future]`, node => node.closest("tr").innerText.replace(/\s+/g, " ").trim());
    ok(/Tarihi Gelince Atanabilir/.test(futureRow) && /Tarihi gelmedi \(20\.10\.2026\); o gün hesaba atanabilir/.test(futureRow), `ileri tarihli satır: ${futureRow}`);
    const reasonVisible = await page.$eval(`${bankWin} [data-legacy-future]`, node => {
      const why = node.parentElement.querySelector("small");
      return Boolean(why && why.offsetParent !== null && why.textContent.includes("20.10.2026"));
    });
    ok(reasonVisible, "neden görünür yazıyla (yalnız title değil)");
    const later2 = await page.$eval(`${bankWin} [data-legacy-future]`, node => {
      const box = node.closest("tr").querySelector('input[type="checkbox"]');
      return box ? { disabled: box.disabled, pick: box.hasAttribute("data-pick") } : null;
    });
    ok(later2 && later2.disabled && !later2.pick, `ileri tarihli satırın seçim kutusu pasif (${JSON.stringify(later2)})`);
    const pickable = await page.$$eval(`${bankWin} .hof-bank-legacy tbody input[data-pick]`, list => list.length);
    ok(pickable === 1, `seçilebilen satır yalnız geçmiş havale (${pickable})`);
    const stats = await textOf(`${bankWin} .hof-bank-stats`);
    ok(/Tarihi Gelince Atanabilir\s*1/.test(stats) && stats.includes(money(250)), `istatistikler: ${stats}`);
    await shot("ileri-eski-liste");

    // Kurulum Sihirbazı: önizleme ve sonuç atlanan ileri tarihli satırı söyler; 409 ledger-integrity yok.
    const wiz = ".hof-bank-wiz-modal";
    await page.click(`${bankWin} [data-act="wizard"]`);
    await page.waitForSelector(`${wiz} [data-wiz="skip"]`, { timeout: 10000 });
    await page.click(`${wiz} [data-wiz="skip"]`);
    await page.waitForSelector(`${wiz} [data-wiz-preview]`, { timeout: 10000 });
    const preview = await textOf(`${wiz} [data-wiz-preview]`);
    // Başlıklar (dt) CSS ile büyük harf gösterilir; adın kendisi textContent'ten okunur (yazım düzeni).
    const futureLine = await page.$eval(`${wiz} [data-wiz-future]`, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
    ok(/1 hareket · net \+₺250,00/.test(preview) && /^Tarihi Gelmemiş — Sonra Atanır ?1 hareket · net \+₺1\.000,00 · ilk 20\.10\.2026$/.test(futureLine), `sihirbaz önizlemesi: ${preview} | ${futureLine}`);
    await shot("ileri-eski-sihirbaz-onizleme");
    const setup = page.waitForResponse(response => response.url().includes("/api/workspace/bank/setup") && !response.url().includes("dryRun") && response.request().method() === "POST", { timeout: 30000 });
    await page.click(`${wiz} [data-wiz="transfer"]`);
    const setupResponse = await setup;
    ok(setupResponse.status() === 200, `Aktar: POST /bank/setup ${setupResponse.status()} (önceden 409 ledger-integrity)`);
    await page.waitForSelector(`${wiz} [data-wiz-done]`, { timeout: 10000 });
    const done = await textOf(`${wiz} [data-wiz-done]`);
    ok(done.includes("1 hareket hesaba bağlandı") && /Tarihi gelmemiş 1 eski hareket atlandı \(ilk 20\.10\.2026\)/.test(done), `sihirbaz sonucu: ${done.slice(0, 260)}`);
    await shot("ileri-eski-sihirbaz-sonuc");
    await page.click(`${wiz} [data-wiz="finish"]`);
    await pause(800);
    let summary = await must("özet", api2.get("/api/workspace/bank/summary"));
    ok(summary.realBank.minor === 1_025_000 && summary.unassigned.totalMinor === 0 && summary.unassigned.future?.count === 1, `sihirbazdan sonra: Gerçek Banka ${summary.realBank.minor / 100}, Hesabı Atanmamış ${summary.unassigned.totalMinor / 100}, ileri tarihli ${summary.unassigned.future?.count}`);

    // Tarih gelince (sahte saat 21.10.2026): satır seçilir, Bu Hesaba Ata 200, mutabakat temiz.
    await moveClock(app2.config.now, page, "2026-10-21T12:00:00+03:00");
    await closeAll();
    await openBank();
    await tab("accounts");
    await page.click(`${bankWin} [data-act="legacy"]`);
    await page.waitForSelector(`${bankWin} .hof-bank-legacy tbody input[data-pick]`, { timeout: 10000 });
    ok(!(await page.$(`${bankWin} [data-legacy-future]`)), "tarih gelince 'Tarihi Gelince Atanabilir' işareti kalktı");
    await page.check(`${bankWin} .hof-bank-legacy tbody input[data-pick]`);
    await pause(300);
    const assigned = page.waitForResponse(response => response.url().includes("/api/workspace/bank/legacy/assign") && response.request().method() === "POST", { timeout: 30000 });
    await page.click(`${bankWin} [data-act="assign"]`);
    await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
    await page.click(`${top} [data-answer="yes"]`);
    ok((await assigned).status() === 200, "tarih gelince Bu Hesaba Ata: POST /legacy/assign 200");
    await pause(600);
    await shot("ileri-eski-tarih-gelince-atandi");
    summary = await must("özet", api2.get("/api/workspace/bank/summary"));
    ok(summary.realBank.minor === 1_125_000 && summary.unassigned.totalMinor === 0 && !summary.unassigned.future?.count, `atandıktan sonra: Gerçek Banka ${summary.realBank.minor / 100} (10.000 + 250 + 1.000), Hesabı Atanmamış ${summary.unassigned.totalMinor / 100}`);
    const integrity = await must("Mutabakat Testi", api2.get("/api/workspace/ledger/integrity"));
    ok(integrity.ok === true, `mutabakat temiz${integrity.ok ? "" : `: ${JSON.stringify(integrity.failures).slice(0, 300)}`}`);
    ok(account.id && summary.accounts.count === 1, "tek hesap");
  } finally {
    await context2?.close().catch(() => null);
    page = mainPage;
    await app2?.close().catch(() => null);
    fs.rmSync(root2, { recursive: true, force: true });
  }
}

try {
  await api.login("admin", PASS);
  // ---------- Kurulum (API): Ziraat 10.000; nakit tahsilat 2.000; hesaba bağlanmamış POS tahsilatı 900 (Hesabı Atanmamış); bir alınan çek ----------
  await must("sihirbazı kapat", api.post("/api/workspace/bank/setup/dismiss", {}));
  const ziraat = await must("Ziraat", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } }));
  const abc = await must("ABC", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  await must("borç", api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "debt", amount: "5.000", date: "2026-10-02" }));
  await must("nakit tahsilat", api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "2.000", date: "2026-10-03", method: "cash" }));
  await must("POS tahsilatı (hesapsız)", api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "900", date: "2026-10-04", method: "card" }));
  const cheque = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-11-05", serialNo: "TMP-1", accountId: abc.id }));
  const summary = await must("banka özeti", api.get("/api/workspace/bank/summary"));
  ok(summary.realBank.minor === 1_000_000 && summary.unassigned.totalMinor === 90_000, `kurulum: Gerçek Banka ${summary.realBank.minor / 100}, Hesabı Atanmamış ${summary.unassigned.totalMinor / 100}`);

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  cutWatch = fetchCutWatch(page);
  page.on("console", message => {
    if (message.type() === "error" && !/status of 40[0139]|api\/auth\/me|Failed to load resource/.test(`${message.text()} ${message.location().url}`) && !cutWatch.defer(`console ${message.text()}`)) errors.push(`console ${message.text()}`);
  });
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await pause(800);

  await step("1. Banka penceresi sekmeleri: yalnız Genel Bakış · Hesaplar · Hareketler · Ayarlar", async () => {
    await openBank();
    const tabs = await page.$$eval(`${bankWin} .hof-bank-tabs [data-tab]`, nodes => nodes.map(node => node.textContent.trim()));
    ok(tabs.join("|") === "Genel Bakış|Hesaplar|Hareketler|Ayarlar", `sekmeler: ${tabs.join(", ")}`);
  });

  await step("2. Genel Bakış: Gerçek Banka 10.000; Hesabı Atanmamış ayrı satır (900); POS Bekleyen / Blokeli POS / Güncel Kurla / Eşleşmeyen yok", async () => {
    const text = await textOf(`${bankWin} [data-bank]`);
    ok(/Gerçek Banka/.test(text) && text.includes(money(10000)), "Gerçek Banka 10.000,00");
    ok(/Hesabı Atanmamış Eski Hareketler/.test(text) && text.includes(money(900)), "Hesabı Atanmamış Eski Hareketler 900,00 ayrı satırda");
    const later = laterIn(text);
    ok(!later.length, `ertelenen özellik görünmüyor${later.length ? `: ${later.join(", ")}` : ""}`);
    const heads = await page.$$eval(`${bankWin} .hof-bank-table thead th`, nodes => nodes.map(node => node.textContent.trim()));
    ok(!heads.some(head => /Güncel Kurla|Bekleyen|Eşleşmeyen|TL Karşılığı|Para Birimi/.test(head)), `Banka Hesapları sütunları (yalnız TL hesapta döviz sütunu yok): ${heads.join(", ")}`);
    ok(!/TL karşılığı/.test(await textOf(`${bankWin} [data-bank-real]`) + await textOf(`${bankWin} .hof-bank-real small`)), "Gerçek Banka kutusunda \"TL karşılığı\" notu yok (yalnız TL)");
    await shot("genel-bakis");
  });

  await step("3. Hesaplar → + Yeni Hesap: Hesap Türü'nde Döviz yok; Para Birimi ve Açılış Kuru yok (Vadesiz/Ticari/Vadeli/Kredi/Kart/Diğer)", async () => {
    await tab("accounts");
    const listText = await textOf(`${bankWin} [data-bank]`);
    ok(!laterIn(listText).length, `Hesaplar listesinde ertelenen özellik yok${laterIn(listText).length ? `: ${laterIn(listText).join(", ")}` : ""}`);
    await page.click(`${bankWin} [data-act="new"]`);
    const form = `${top} form.hof-bank-form`;
    await page.waitForSelector(`${form} select[name="kind"]`, { timeout: 10000 });
    await pause(300);
    const kinds = await optionsOf(`${form} select[name="kind"]`);
    ok(kinds.join("|") === "Vadesiz|Ticari|Vadeli|Kredi Hesabı|Kurumsal Kredi Kartı|Diğer", `Hesap Türü seçenekleri: ${kinds.join(", ")}`);
    ok(!(await page.$(`${form} [name="currency"]`)), "Para Birimi alanı yok (yalnız TL)");
    for (const kind of ["demand", "commercial", "time", "loan", "card", "other"]) {
      await page.selectOption(`${form} select[name="kind"]`, kind);
      await pause(150);
      const rate = await page.$eval(`${form} [name="openingRate"]`, node => node.closest(".hof-field")?.offsetParent !== null).catch(() => false);
      if (rate) ok(false, `${kind}: Açılış Kuru alanı görünüyor`);
    }
    ok(true, "hiçbir hesap türünde Açılış Kuru (TL) alanı görünmüyor");
    const formText = await visibleText(`${form} .hof-field`);
    ok(!/Döviz|Kur \(|USD|EUR|GBP/.test(formText), `formda döviz yok${/Döviz|USD|EUR/.test(formText) ? `: ${formText.slice(0, 200)}` : ""}`);
    await shot("yeni-hesap-formu");
    await closeAll();
  });

  await step("3b. Kurulum Sihirbazı: hesap adımında da Döviz türü ve Para Birimi yok", async () => {
    await openBank();
    await tab("accounts");
    await page.click(`${bankWin} [data-act="wizard"]`);
    await page.waitForSelector(`${top} [data-wiz-form] select[name="kind"]`, { timeout: 10000 }).catch(() => null);
    const kinds = await optionsOf(`${top} [data-wiz-form] select[name="kind"]`);
    if (kinds.length) {
      ok(!kinds.includes("Döviz"), `sihirbaz Hesap Türü: ${kinds.join(", ")}`);
      ok(!(await page.$(`${top} [data-wiz-form] [name="currency"]`)), "sihirbazda Para Birimi alanı yok");
    } else ok(!laterIn(await textOf(top)).length, "sihirbaz ekranında ertelenen özellik yok");
    await shot("kurulum-sihirbazi");
    await closeAll();
  });

  await step("4. Hesap Detayı: + Masraf, + Faiz, + Diğer İşlem, Transfer; Ekstre Yükle / Döviz Al-Sat / POS yok", async () => {
    await openBank();
    await tab("accounts");
    await page.click(`${bankWin} tr[data-account="${ziraat.id}"]`);
    await page.waitForSelector(`${bankWin} [data-bank-balance]`, { timeout: 10000 });
    await pause(400);
    const buttons = await page.$$eval(`${bankWin} .hof-chq-actions button`, nodes => nodes.map(node => node.textContent.trim()));
    ok(["+ Masraf", "+ Faiz", "+ Diğer İşlem", "Transfer"].every(label => buttons.includes(label)), `düğmeler: ${buttons.join(", ")}`);
    ok(!buttons.some(label => /Ekstre|Döviz|POS|Değerleme|Tahsile/.test(label)), "Ekstre Yükle, Döviz Al/Sat, POS, Değerleme düğmesi yok");
    const text = await textOf(`${bankWin} [data-bank]`);
    ok(!laterIn(text).length, `Hesap Detayı'nda ertelenen özellik yok${laterIn(text).length ? `: ${laterIn(text).join(", ")}` : ""}`);
    await shot("hesap-detayi");
  });

  await step("5. Hareketler: İşlem Türü süzgecinde ve Planlı İşlem formunda döviz, değerleme, POS, tahsile verme yok", async () => {
    await page.click(`${bankWin} [data-act="back"]`).catch(() => null);
    await tab("movements");
    await page.waitForSelector(`${bankWin} select[data-mv="type"]`, { timeout: 10000 });
    const types = await optionsOf(`${bankWin} select[data-mv="type"]`);
    ok(types.length > 5 && !types.some(label => /Döviz|Kur Değerleme|POS|Tahsile|Ekstre/.test(label)), `İşlem Türü: ${types.join(", ")}`);
    const buttons = await page.$$eval(`${bankWin} [data-bank] button`, nodes => nodes.map(node => node.textContent.trim()));
    ok(!buttons.some(label => /Ekstre|Döviz|POS|Değerleme|Mutabakat/.test(label)), `Hareketler düğmeleri: ${buttons.join(", ")}`);
    await shot("hareketler");
    const plan = await page.$(`${bankWin} [data-act="plan-new"]`);
    if (plan) {
      await plan.click();
      await page.waitForSelector("form.hof-bank-voucher select[name=\"type\"]", { timeout: 10000 });
      const voucherTypes = await optionsOf('form.hof-bank-voucher select[name="type"]');
      ok(!voucherTypes.some(label => /Döviz|Değerleme|POS|Tahsile/.test(label)), `Planlı İşlem türleri: ${voucherTypes.join(", ")}`);
      await shot("planli-islem-formu");
      await page.keyboard.press("Escape");
      await pause(400);
    }
    await page.click(`${bankWin} [data-act="v-other"]`).catch(() => null);
    if (await page.waitForSelector("form.hof-bank-voucher", { timeout: 5000 }).catch(() => null)) {
      const formText = await visibleText("form.hof-bank-voucher .hof-field");
      ok(!laterIn(formText).length && !/\b646\b|\b656\b/.test(formText), `Diğer İşlem formunda Kambiyo/Elle Banka Fişi yok${laterIn(formText).length ? `: ${laterIn(formText).join(", ")}` : ""}`);
      await shot("diger-islem-formu");
      await page.keyboard.press("Escape");
      await pause(400);
    }
    await closeAll();
  });

  await step("6. Ayarlar: Temel ve Gelişmiş — POS, Ekstre, Döviz, Hareket (Kanal Alanı), Elle Banka Fişi, Bağdaştırıcılar, Kambiyo yok", async () => {
    await openBank();
    await tab("settings");
    await page.waitForSelector(`${bankWin} [data-settings]`, { timeout: 10000 });
    const basic = await page.$$eval(`${bankWin} .hof-bank-set:not([hidden]) legend`, list => list.filter(node => node.offsetParent).map(node => node.textContent.trim()));
    ok(basic.join("|") === "Hesap|Eksi Bakiye|Mükerrer|Masraf|Tatil", `Temel bölümler: ${basic.join(", ")}`);
    ok(!laterIn(await textOf(`${bankWin} [data-settings]`)).length, "Temel ayarlarda ertelenen özellik yok");
    await shot("ayarlar-temel");
    await page.click(`${bankWin} [data-act="advanced"]`);
    await pause(400);
    const all = await page.$$eval(`${bankWin} .hof-bank-set legend`, list => list.filter(node => node.offsetParent).map(node => node.textContent.trim()));
    ok(!all.some(name => ["POS", "Ekstre", "Döviz", "Hareket"].includes(name)), `bütün görünen bölümler: ${all.join(", ")}`);
    // Bölüm, kalem adı ve yardım metinleri (açılır listelerin seçenekleri hariç: Diğer Gelir / Diğer Gider eşlemesinin seçeneklerinde plan §3.11
    // beyaz listesindeki 646 Kambiyo Kârları ve 656 Kambiyo Zararları bulunur — Banka Fişi'nin karşı hesabıdır, döviz modülü değildir).
    const advancedText = await page.$eval(`${bankWin} [data-advanced]`, node => {
      const copy = node.cloneNode(true);
      copy.querySelectorAll("select").forEach(item => item.remove());
      return copy.textContent.replace(/\s+/g, " ").trim();
    });
    const later = laterIn(advancedText);
    ok(!later.length, `Gelişmiş ayarlarda ertelenen özellik yok${later.length ? `: ${later.join(", ")}` : ""}`);
    const incomeGl = await page.$$eval(`${bankWin} [data-set="gl.otherIncome"] option`, nodes => nodes.map(node => node.value)).catch(() => []);
    ok(incomeGl.length > 0 && incomeGl.every(code => ["642", "646", "649"].includes(code)), `Diğer Gelir eşlemesi plan beyaz listesinden (${incomeGl.join(", ")})`);
    for (const key of ["pos.valorDays", "posAdvanced.blockDays", "statement.toleranceDays", "fx.source", "fxAdvanced.exchangeTaxPermille", "movement.channel", "other.manualVoucher", "other.adapters", "gl.fxGain", "gl.fxLoss", "account.defaultPosId", "holidayAdvanced.shift"]) {
      if (await page.$(`${bankWin} [data-set="${key}"]`)) ok(false, `${key} görünüyor`);
    }
    ok(true, "gizli ayar kalemlerinin hiçbiri ekranda yok");
    await shot("ayarlar-gelismis");
    await closeAll();
  });

  await step("7. Raporlar → Tüm Raporlar: Banka grubunda yalnız Banka Bakiye, Banka Hareket, Banka Masraf, Alt Hesap Mizanı", async () => {
    await page.click('#hof-sidecard [data-action="analytics"]');
    await page.waitForSelector(`${modal} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
    await page.click(`${modal} .hof-rep-tab[data-tab="all"]`);
    await page.waitForSelector(`${modal} [data-rc-list] [data-report]`, { timeout: 15000 });
    const items = await page.$$eval(`${modal} .hof-rc-group`, nodes => nodes.filter(node => node.querySelector("p").textContent.trim().endsWith("Banka")).flatMap(node => [...node.querySelectorAll("[data-report]")].map(item => item.textContent.trim())));
    ok(items.join("|") === "Banka Bakiye Raporu|Banka Hareket Raporu|Banka Masraf Raporu|Alt Hesap Mizanı", `Banka raporları: ${items.join(", ")}`);
    const all = await page.$$eval(`${modal} [data-rc-list] [data-report]`, nodes => nodes.map(node => node.textContent.trim()));
    const later = all.filter(title => /POS Satış|POS Komisyon|POS Bekleyen|POS Valör|Mutabakat Raporu|Kur Değerleme|Tahsildeki|Banka Nakit Akış|Günlük Banka|Aylık Banka|Bankalar Arası Transfer Raporu|Faturası Beklenen/.test(title));
    ok(!later.length, `ertelenen §8.10 raporu listede yok${later.length ? `: ${later.join(", ")}` : ""}`);
    await shot("tum-raporlar-banka");
  });

  await step("8. Raporlar → Nakit Akış: Bugünkü Nakit ve Banka 12.000 (Nakit 2.000 + Gerçek Banka 10.000); Hesabı Atanmamış 900 ayrı, başlangıca girmez", async () => {
    await page.click(`${modal} .hof-rep [data-tab="flow"]`);
    await page.waitForSelector(`${modal} [data-chart] svg`, { timeout: 15000, state: "attached" });
    await pause(500);
    const tiles = await page.$$eval(`${modal} .hof-rep-stat`, nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ").trim()));
    const start = tiles.find(item => item.startsWith("Bugünkü Nakit ve Banka")) || "";
    const amountAfter = (label, value) => new RegExp(`${label} ₺?${money(value).replace(/\./g, "\\.")}`).test(start);
    ok(start.includes(money(12000)) && amountAfter("Nakit Kasa", 2000) && amountAfter("Gerçek Banka", 10000), `başlangıç kutusu: ${start}`);
    const loose = tiles.find(item => item.startsWith("Hesabı Atanmamış Eski Hareketler")) || "";
    ok(loose.includes(money(900)) && /Başlangıca girmez/.test(loose), `Hesabı Atanmamış kutusu: ${loose}`);
    ok(!tiles.some(item => item.startsWith("Bugünkü Kasa")), "eski 'Bugünkü Kasa' etiketi yok");
    // Adlar (2.1.0 temel sürüm): projeksiyonun bakiyesi Nakit Kasa + Gerçek Banka; kutular, tablo başlığı ve grafik "Nakit ve Banka" der.
    const names = await page.$$eval(`${modal} .hof-rep-stat > span, ${modal} .hof-rep-stat .hof-rep-stat-label, ${modal} .hof-rep-table thead th, ${modal} [data-chart] figcaption`, nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ").trim()));
    const joined = names.join(" | ");
    ok(/Tahmini Nakit ve Banka · /.test(joined) && /En Düşük Tahmini Nakit ve Banka/.test(joined) && names.includes("Beklenen Nakit ve Banka") && /Tahmini Nakit ve Banka · 08\.10\.2026/.test(joined), `Nakit Akış adları: ${joined}`);
    ok(!/Tahmini Kasa|Beklenen Kasa|Tahmini kasa|Dönem Sonu Kasa/.test(`${joined} ${await textOf(modal)}`), "eski 'kasa' adları yok (Tahmini Kasa, Beklenen Kasa, grafik)");
    const opening = await textOf(`${modal} .hof-rep-table tr.is-opening`);
    ok(opening.includes(money(12000)) && /Bugünkü nakit ve banka/.test(opening), `Başlangıç satırı: ${opening}`);
    const flow = await must("nakit akış", api.get("/api/workspace/overview/nakit-akisi?preset=next30"));
    const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    ok(flow.cashToday === 12000 && flow.cashToday === overview.cash.balance + overview.cash.bank.balance, `API: başlangıç ${flow.cashToday} = ANLIK DURUM Nakit ${overview.cash.balance} + Gerçek Banka ${overview.cash.bank.balance}`);
    await shot("nakit-akis");
    await closeAll();
  });

  await step("9. Çek/Senet kartı: Bankaya Tahsile Ver yok (Tahsil Edildi, Ciro Et, Karşılıksız / İade)", async () => {
    const opened = await page.evaluate(id => {
      if (typeof window.HOF?.cheques?.open === "function") {
        window.HOF.cheques.open({ id });
        return true;
      }
      return false;
    }, cheque.id);
    if (!opened) {
      await page.click('#hof-sidecard [data-action="cheques"]');
      await page.waitForSelector(`${modal} [data-cheque="${cheque.id}"], ${modal} [data-id="${cheque.id}"]`, { timeout: 10000 });
      await page.click(`${modal} [data-cheque="${cheque.id}"], ${modal} [data-id="${cheque.id}"]`);
    }
    await pause(1200);
    const text = await textOf(top);
    ok(/Tahsil/.test(text) && !/Tahsile Ver|Bankaya Tahsil/.test(text), `çek kartında Bankaya Tahsile Ver yok (${text.slice(0, 160)})`);
    await shot("cek-karti");
    await closeAll();
  });

  await step("10. İleri tarihli eski hesapsız havale (GERÇEK v2.0.23 verisi): liste 'Tarihi Gelince Atanabilir', sihirbaz atlar ve söyler, tarih gelince atanır", async () => {
    await legacyFutureSection();
  });
} catch (error) {
  failed += 1;
  console.log(`✗ kurulum hatası: ${error.stack || error.message}`);
} finally {
  if (cutWatch) errors.push(...cutWatch.unexplained());
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-banka-210-temel: ${passed} geçti, ${failed} kaldı · ekran görüntüleri ${OUT}`);
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
