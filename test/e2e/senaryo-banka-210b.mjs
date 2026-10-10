// Senaryo Banka 2.1.0 — B: modül ekranlarında hesap seçimi ve banka işlemlerinin eksik kalan arayüz yolları (plan §12.3 Aşama 5–9 "Çalışıyor Mu /
// Nasıl Bozarım", §12.4; docs/2.1.0-PLAN-TEST-ESLEME.md). senaryo-banka-210'un kapsamadığı yollar gerçek kullanıcı gibi tıklanır; her adımın
// beklenen sayısı adımın başında okunan bakiyeye testin KENDİ farkı eklenerek bulunur (bağımsız beklenen), sonda bütün farkların toplamı
// başlangıçla karşılaştırılır (birikimli model) ve Mutabakat Testi + Alt Hesap Mizanı + Hesap Planı Mizanı (102) denetlenir.
//  1. Kayıt tahsilatı (tablodaki kayıt → Tahsilat) Havale/EFT + Ziraat; hesap seçilmeden kaydedilmez.
//  2. Stok çıkışı peşin Havale/EFT + Garanti (stok 10 → 8).
//  3. Verilen çekin ödemesi (Çek/Senet → Öde) Banka + Ziraat.
//  4. Fatura Düzenle'de peşinin hesabını Ziraat'ten Garanti'ye taşıma (numara aynı, tek işlem).
//  5. Toplu kesim (Seçilenleri Kaydet): iki taslağın peşini kendi hesaplarına (Ziraat, Garanti).
//  6. Cari tahsilatını Düzelt (hesap Ziraat → Garanti) ve Sil.
//  7. Banka transferini Düzelt (10.000 → 12.000).
//  8. Planlı transfer: Planla (bakiye değişmez) → Gerçekleştir.
//  9. Vadeli hesaba transfer (Ziraat → Vadeli); Gerçek Banka değişmez.
// 10. Transfer formunda Eksi Bakiye sorusu (Vazgeç yazmaz) ve Benzer İşlem sorusu (Yine de Kaydet tek ikinci kayıt).
// 11. Silinenler'den geri yükleme: Engelle politikasında açık neden (geri yüklenmez), pasif hesapta açık neden; Uyar'da "Yine de Geri Yükle".
// 12. Taksit kartı geri yükleme: havale tahsilatı ve kart silinir; önce tahsilat geri yüklenmeye çalışılır (kart yokken), sonra kart, sonra tahsilat.
// 13. Toplu silme: bankayı eksiye düşüren iki belge için TEK soru ("Yine de Sil").
// 14. Son durum: birikimli model, Alt Hesap Mizanı, Hesap Planı Mizanı 102, Mutabakat Testi.
// Çalıştırma: npm run test:senaryo-banka-210b (ekran görüntüleri artifacts/senaryo-banka-210b/).
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-banka-210b");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-banka-210b-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, maxCompanies: 2, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f41" } });
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
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    await shot("hata").catch(() => null);
    await closeAll().catch(() => null); // açık pencere sonraki adımı kilitlemesin
  }
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const bankWin = ".hof-bank-modal";
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const textOf = selector => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const has = (text, needle) => String(text).includes(needle);
const pause = ms => page.waitForTimeout(ms);
const closeAll = async () => {
  for (let index = 0; index < 6 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await pause(300);
  }
};
const lastToast = async pattern => {
  for (let i = 0; i < 24; i += 1) {
    const texts = await page.$$eval(".hof-toast .hof-toast-text", nodes => nodes.map(n => n.textContent.trim()));
    const hit = texts.find(t => pattern.test(t));
    if (hit) return hit;
    await pause(250);
  }
  return "";
};
// Soru penceresi (Eksi Bakiye, Benzer İşlem, Stok…): metni okunur, cevaplanır.
const answer = async (reply, timeout = 8000) => {
  await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout });
  const question = await textOf(`${top} .hof-modal-text`);
  const yes = await textOf(`${top} [data-answer="yes"]`);
  await pause(300);
  await page.click(`${top} [data-answer="${reply}"]`);
  await pause(700);
  return { question, yes };
};
// Kalan bütün soruları "evet" ile geçer (stok, benzer işlem; adımın konusu olmayanlar).
const yesToAll = async (rounds = 10) => {
  for (let i = 0; i < rounds; i += 1) {
    await pause(500);
    const yes = await page.$(`${modal} [data-answer="yes"]`);
    if (!yes) return;
    await yes.click();
  }
};
const openBank = async () => {
  await page.click('#hof-sidecard [data-action="bank"]');
  await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 15000 });
  await pause(500);
};
const tab = async id => {
  await page.click(`${bankWin} .hof-bank-tabs [data-tab="${id}"]`);
  await pause(700);
};
const fillVoucher = async values => {
  for (const [name, value] of Object.entries(values)) {
    const selector = `form.hof-bank-voucher [name="${name}"]`;
    const tag = await page.$eval(selector, node => node.tagName.toLowerCase());
    if (tag === "select") await page.selectOption(selector, String(value));
    else await page.fill(selector, String(value));
  }
  await pause(250);
};
const voucherClosed = () => page.waitForSelector("form.hof-bank-voucher", { state: "detached", timeout: 10000 });
const openTransferForm = async () => {
  await tab("movements");
  await page.waitForSelector(`${bankWin} [data-act="v-transfer"]`, { timeout: 10000 });
  await page.click(`${bankWin} [data-act="v-transfer"]`);
  await page.waitForSelector('form.hof-bank-voucher select[name="toAccountId"]', { timeout: 10000 });
  await pause(300);
};
const moveRows = () =>
  page.$$eval(`${bankWin} .hof-bank-moves tbody tr[data-event]`, list => list.map(node => ({ id: node.dataset.event, no: node.dataset.no, type: node.dataset.type, status: node.dataset.state, signed: Number(node.dataset.signed), text: node.textContent.replace(/\s+/g, " ").trim() })));

// ---------- Banka sayıları ve bağımsız model ----------
const ACC = {};
const balances = async () => {
  const list = (await must("hesaplar", api.get("/api/workspace/bank/accounts?status=all"))).accounts;
  return Object.fromEntries(Object.entries(ACC).map(([key, acc]) => [key, (list.find(item => item.id === acc.id)?.balanceMinor ?? NaN) / 100]));
};
const kasa = async () => (await must("Kasa", api.get("/api/workspace/cash"))).byMethod.cash;
const model = { z: 0, g: 0, v: 0 };
const total = {}; // birikimli farklar (adım sonunda eklenir)
const expectDelta = async (before, delta, label) => {
  const now = await balances();
  const want = Object.fromEntries(Object.keys(before).map(key => [key, Math.round((before[key] + (delta[key] || 0)) * 100) / 100]));
  const off = Object.keys(want).filter(key => Math.abs(now[key] - want[key]) > 0.001);
  ok(!off.length, `${label}: ${Object.keys(want).map(key => `${key} ${now[key]}${off.includes(key) ? ` (beklenen ${want[key]})` : ""}`).join(", ")}`);
  for (const [key, value] of Object.entries(delta)) total[key] = Math.round(((total[key] || 0) + value) * 100) / 100;
  return now;
};

try {
  await api.login("admin", PASS);
  // ---------- Kurulum (API): iki vadesiz hesap + vadeli hesap, iki cari, ürün, tablo kaydı ----------
  await must("sihirbazı kapat", api.post("/api/workspace/bank/setup/dismiss", {}));
  ACC.z = await must("Ziraat", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
  ACC.g = await must("Garanti", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } }));
  ACC.v = await must("Vadeli", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Vadeli", kind: "time", opening: { date: "2026-10-01", amount: "0", confirmed: true } }));
  const abc = await must("ABC", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  const xyz = await must("XYZ", api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
  const item = await must("Ürün A", api.post("/api/workspace/stock", { name: "Ürün A", unit: "Adet", unitPrice: "500", salePrice: "1.000", openingQty: "10", openingDate: "2026-10-01" }));
  const start = await balances();
  ok(start.z === 100000 && start.g === 50000 && start.v === 0, `başlangıç Ziraat ${start.z}, Garanti ${start.g}, Vadeli ${start.v}`);
  Object.assign(model, start);
  const startCash = 0;

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/status of 40[0139]|api\/auth\/me|Failed to load resource/.test(`${message.text()} ${message.location().url}`)) errors.push(`console ${message.text()}`);
  });
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await pause(800);
  // Tablo: tek kayıt (2026/501 Ayşe Kaya). Yükleme tarayıcının oturumuyla (sayfa yenilenir).
  const call = (url, body) => page.evaluate(async ([u, b]) => (await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json(), [url, body]);
  const staged = await call("/api/workspace/dataset/stage", { kind: "excel", fileName: "Dosyalar.xlsx", sheets: [{ name: "Dosyalar", matrix: [["Dosya No", "Ad Soyad", "Telefon"], ["2026/501", "Ayşe Kaya", "05321112233"]] }] });
  const committed = await call("/api/workspace/dataset/commit", { stageId: staged.data.stageId, mode: "replace" });
  ok(committed.ok === true, "tablo yüklendi (1 kayıt)");
  await pause(1500);
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector("#hof-sidecard", { timeout: 30000 });
  await pause(1000);

  await step("1. Kayıt tahsilatı: tablodaki kayıt → Tahsilat 1.500 Havale/EFT → Banka Hesabı Ziraat (seçilmeden kaydedilmez) → Ziraat +1.500, Kasa aynı", async () => {
    const before = await balances();
    const cashBefore = await kasa();
    ok(await page.evaluate(() => window.HOF.revealRecord("2026/501")), "kayıt tabloda açıldı");
    await page.waitForFunction(() => window.HOF.selectedCase()?.key === "2026/501", null, { timeout: 8000 });
    await page.click('.hof-case-actions [data-case-action="payment"]');
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    ok(!(await page.$(`${form} [data-bank-pick]:not([hidden])`)), "Nakit seçiliyken Banka Hesabı görünmez");
    await page.fill(`${form} input[name="amount"]`, "1.500");
    await page.selectOption(`${form} select[name="method"]`, "bank");
    await page.waitForSelector(`${form} [data-bank-pick]:not([hidden]) select[name="bankAccountId"]`, { timeout: 8000 });
    const options = await page.$$eval(`${form} select[name="bankAccountId"] option`, nodes => nodes.map(node => node.textContent.trim()));
    ok(options[0] === "Hesap Seçin" && options.length === 3 && !options.some(text => text.includes("Vadeli")), `seçicide iki vadesiz hesap, vadeli yok: ${options.join(" | ")}`);
    await page.selectOption(`${form} select[name="bankAccountId"]`, "");
    await page.click(`${form} button[type="submit"]`);
    await pause(600);
    const error = await textOf(`${form} .hof-form-error`);
    ok(has(error, "Banka Hesabı") && (await balances()).z === before.z, `hesap seçilmeden kaydedilmedi: “${error}”`);
    await page.selectOption(`${form} select[name="bankAccountId"]`, ACC.z.id);
    await pause(500);
    await shot("kayit-tahsilati-ziraat");
    await page.click(`${form} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible input[name="amount"]'), null, { timeout: 10000 });
    await pause(700);
    await expectDelta(before, { z: 1500 }, "Ziraat +1.500");
    ok((await kasa()) === cashBefore, `Kasa değişmedi (${await kasa()})`);
    const moves = (await must("hareketler", api.get(`/api/workspace/bank/movements?account=${ACC.z.id}`))).rows;
    ok(moves.some(row => row.signedMinor === 150_000 && /Kayıt|Tahsilat/i.test(`${row.typeLabel} ${row.description} ${row.source || ""}`)), `Ziraat hareketlerinde kayıt tahsilatı: ${moves.map(row => `${row.typeLabel} ${row.signedMinor / 100}`).join(" | ")}`);
  });

  await step("2. Stok çıkışı 2 Adet × 1.000 peşin Havale/EFT → Garanti → Garanti +2.000, Ürün A 8", async () => {
    const before = await balances();
    await page.evaluate(id => window.HOF.stock.open(id), item.id);
    await page.waitForSelector('.hof-modal [data-move="out"]', { timeout: 10000 });
    await page.click('.hof-modal [data-move="out"]');
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} input[name="qty"]`, { timeout: 8000 });
    await page.fill(`${form} input[name="qty"]`, "2");
    await page.fill(`${form} input[name="unitPrice"]`, "1.000");
    await page.selectOption(`${form} select[name="pay"]`, "bank");
    await page.waitForSelector(`${form} [data-bank-pick]:not([hidden]) select[name="bankAccountId"]`, { timeout: 8000 });
    await page.selectOption(`${form} select[name="bankAccountId"]`, ACC.g.id);
    await pause(500);
    await shot("stok-pesini-garanti");
    await page.click(`${form} button[type="submit"]`);
    await yesToAll(3);
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible input[name="qty"]'), null, { timeout: 10000 });
    await pause(700);
    await expectDelta(before, { g: 2000 }, "Garanti +2.000");
    const stock = (await must("stok", api.get("/api/workspace/stock"))).items.find(row => row.id === item.id);
    ok(stock.qty === 8, `Ürün A ${stock.qty}`);
    await closeAll();
  });

  await step("3. Verilen çek 5.000 (XYZ) → Öde → Banka (Havale / EFT) → Ziraat → Ziraat −5.000; çek Ödendi", async () => {
    const before = await balances();
    const cheque = await must("verilen çek", api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "5.000", issueDate: TODAY, dueDate: "2026-12-31", accountId: xyz.id, serialNo: "V-210B", bank: "Ziraat Bankası" }));
    await page.evaluate(id => window.HOF.cheques.open({ id }), cheque.id);
    await page.waitForSelector('.hof-cheques-modal [data-action="pay"]', { timeout: 10000 });
    await page.click('.hof-cheques-modal [data-action="pay"]');
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} select[name="method"]`, { timeout: 8000 });
    if ((await page.$eval(`${form} select[name="method"]`, node => node.value)) !== "bank") await page.selectOption(`${form} select[name="method"]`, "bank");
    await page.waitForSelector(`${form} [data-bank-pick]:not([hidden]) select[name="bankAccountId"]`, { timeout: 8000 });
    await page.selectOption(`${form} select[name="bankAccountId"]`, ACC.z.id);
    await pause(500);
    await shot("cek-odeme-ziraat");
    await page.click(`${form} button[type="submit"]`);
    await yesToAll(3);
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible .hof-form select[name="bankAccountId"]'), null, { timeout: 10000 });
    await pause(700);
    const detail = await must("çek", api.get(`/api/workspace/cheques/${cheque.id}`));
    const pay = detail.events.find(event => event.kind === "pay");
    ok(detail.status === "paid" && pay?.method === "bank" && pay?.finRef === ACC.z.id, `çek ${detail.status}; ödeme Ziraat'e bağlı (${pay?.finRef === ACC.z.id})`);
    await expectDelta(before, { z: -5000 }, "Ziraat −5.000");
    await closeAll();
  });

  let movedDoc = null;
  await step("4. Fatura Düzenle: peşin 3.000 Havale/EFT Ziraat → Garanti'ye taşı; numara aynı; Ziraat −3.000, Garanti +3.000", async () => {
    movedDoc = await must("peşinli satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 3000, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: "3.000", method: "bank", bankAccountId: ACC.z.id }], cheques: [], endorse: [], rest: "open" }, force: true }));
    const before = await balances();
    const inv = `${modal} .hof-invoices-modal`;
    await page.evaluate(id => window.HOF.invoices.openDoc(id), movedDoc.id);
    await page.waitForSelector(`${inv} [data-act="modify"]:not([disabled])`, { timeout: 10000 });
    await page.click(`${inv} [data-act="modify"]`);
    const bankSel = `${inv} [data-bank-cell="0"] select`;
    await page.waitForSelector(bankSel, { timeout: 10000 });
    ok((await page.$eval(bankSel, node => node.value)) === ACC.z.id, "Düzenle formunda peşin satırı Ziraat'le açıldı");
    await page.selectOption(bankSel, ACC.g.id);
    await pause(800);
    // D2 (bu turda bulundu): Düzenle formu "Kaydedilince Verilecek No" diye SIRADAKİ numarayı gösteriyordu; düzenleme numarayı değiştirmez.
    const noText = await page.$eval(`${inv} [data-next]`, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
    ok(!noText.includes("Kaydedilince Verilecek") && noText.includes(movedDoc.number), `Düzenle formunda belgenin kendi numarası (${noText || "boş"}; beklenen ${movedDoc.number})`);
    await shot("fatura-duzenle-hesap-tasima");
    await page.click(`${inv} [data-act="issue"]`);
    await yesToAll(6);
    await pause(800);
    const doc = await must("fatura", api.get(`/api/workspace/invoices/${movedDoc.id}`));
    ok(doc.number === movedDoc.number && doc.payments?.[0]?.finRef === ACC.g.id && doc.payment?.cash?.[0]?.bankAccountId === ACC.g.id, `numara aynı (${doc.number}); peşin Garanti'ye bağlı`);
    await expectDelta(before, { z: -3000, g: 3000 }, "Ziraat −3.000, Garanti +3.000");
    await closeAll();
  });

  await step("5. Toplu kesim: iki taslak (peşin 1.000 Ziraat, 2.000 Garanti) → Seçilenleri Kaydet → peşinler kendi hesaplarında", async () => {
    const draft = (amount, bankAccountId) => must("taslak", api.post("/api/workspace/invoices", { status: "draft", kind: "sale", accountId: abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: `Hizmet ${amount}`, qty: 1, unitPrice: amount, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: String(amount), method: "bank", bankAccountId }], cheques: [], endorse: [], rest: "open" } }));
    const before = await balances();
    const a = await draft(1000, ACC.z.id);
    const b = await draft(2000, ACC.g.id);
    const drafted = await balances();
    ok(drafted.z === before.z && drafted.g === before.g, "taslak bakiyeyi değiştirmez");
    const inv = `${modal} .hof-invoices-modal`;
    await page.click("#hof-sidecard [data-action=invoices]");
    await page.waitForSelector(`${inv} [data-tab]`, { timeout: 10000 });
    const draftsTab = await page.$(`${inv} [data-tab="drafts"]`);
    if (draftsTab) {
      await draftsTab.click();
      await pause(800);
    }
    await page.waitForSelector(`${inv} [data-sel="${a.id}"]`, { timeout: 10000 });
    await page.click(`${inv} [data-sel="${a.id}"]`);
    await page.click(`${inv} [data-sel="${b.id}"]`);
    await page.waitForSelector(`${inv} [data-act="bulk-issue"]`, { timeout: 8000 });
    await page.click(`${inv} [data-act="bulk-issue"]`);
    await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
    await shot("toplu-kesim-sorusu");
    await page.click(`${top} [data-answer="yes"]`);
    await pause(1500);
    const docA = await must("A", api.get(`/api/workspace/invoices/${a.id}`));
    const docB = await must("B", api.get(`/api/workspace/invoices/${b.id}`));
    ok(docA.status === "issued" && docB.status === "issued" && docA.payments?.[0]?.finRef === ACC.z.id && docB.payments?.[0]?.finRef === ACC.g.id, `iki taslak Kaydedildi; peşinler Ziraat / Garanti (${docA.payments?.[0]?.finRef === ACC.z.id}/${docB.payments?.[0]?.finRef === ACC.g.id})`);
    await expectDelta(before, { z: 1000, g: 2000 }, "Ziraat +1.000, Garanti +2.000");
    await closeAll();
  });

  await step("6. Cari tahsilatı Düzelt (Ziraat → Garanti) ve Sil: ABC 4.000 Havale/EFT", async () => {
    const created = await must("tahsilat", api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "4.000", method: "bank", bankAccountId: ACC.z.id, date: TODAY, note: "düzelt-sil denemesi" }));
    const before = await balances();
    await page.click('#hof-sidecard [data-action="accounts"]');
    await page.waitForSelector(`.hof-accounts-modal tr[data-account="${abc.id}"]`, { timeout: 10000 });
    await page.click(`.hof-accounts-modal tr[data-account="${abc.id}"]`);
    await page.waitForSelector(`.hof-accounts-modal [data-edit-entry="${created.entryId}"]`, { timeout: 10000 });
    await page.click(`.hof-accounts-modal [data-edit-entry="${created.entryId}"]`);
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} select[name="bankAccountId"]`, { timeout: 8000 });
    ok((await page.$eval(`${form} select[name="bankAccountId"]`, node => node.value)) === ACC.z.id, "düzelt formu Ziraat'le açıldı");
    await page.selectOption(`${form} select[name="bankAccountId"]`, ACC.g.id);
    await pause(400);
    await shot("cari-tahsilat-duzelt-garanti");
    await page.click(`${form} button[type="submit"]`);
    await yesToAll(3);
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible .hof-form select[name="bankAccountId"]'), null, { timeout: 10000 });
    await pause(700);
    const mid = await expectDelta(before, { z: -4000, g: 4000 }, "Düzelt: Ziraat −4.000, Garanti +4.000");
    const entry = (await must("ABC", api.get(`/api/workspace/accounts/${abc.id}`))).entries.find(row => row.id === created.entryId);
    ok(entry?.finRef === ACC.g.id && entry?.amount === 4000, `hareket Garanti'ye bağlı, tutar ${entry?.amount}`);
    await page.waitForSelector(`.hof-accounts-modal [data-delete-entry="${created.entryId}"]`, { timeout: 10000 });
    await page.click(`.hof-accounts-modal [data-delete-entry="${created.entryId}"]`);
    await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
    await page.click(`${top} [data-answer="yes"]`);
    await yesToAll(3);
    await pause(900);
    await expectDelta(mid, { g: -4000 }, "Sil: Garanti −4.000");
    await closeAll();
  });

  await step("7. Banka transferini Düzelt: Ziraat → Garanti 10.000 → İşlem Kartı → Düzelt 12.000 → ters kayıt + yeni işlem", async () => {
    const transfer = await must("transfer", api.post("/api/workspace/bank/transfers", { accountId: ACC.z.id, toAccountId: ACC.g.id, amount: "10.000", date: TODAY, feeAmount: "0" }));
    const before = await balances();
    await openBank();
    await tab("movements");
    await page.waitForSelector(`${bankWin} [data-moves]`);
    const rows = await moveRows();
    const row = rows.find(item => item.no === transfer.no && item.signed < 0) || rows.find(item => item.type === "transfer" && item.signed < 0);
    await page.click(`${bankWin} .hof-bank-moves tbody tr[data-event="${row.id}"]`);
    await page.waitForSelector(`${bankWin} [data-act="ev-correct"]:not([disabled])`, { timeout: 10000 });
    await page.click(`${bankWin} [data-act="ev-correct"]`);
    await page.waitForSelector('form.hof-bank-voucher input[name="amount"]', { timeout: 10000 });
    ok((await page.$eval('form.hof-bank-voucher select[name="toAccountId"]', node => node.value)) === ACC.g.id, "Düzelt formu alıcı Garanti'yle dolu");
    await fillVoucher({ amount: "12.000" });
    await shot("transfer-duzelt");
    await page.click('form.hof-bank-voucher button[type="submit"]');
    await yesToAll(3);
    await voucherClosed();
    await pause(800);
    const old = (await must("hareketler", api.get(`/api/workspace/bank/movements?status=all&type=transfer&limit=200`))).rows.filter(item => item.no === transfer.no);
    ok(old.length >= 1 && old.every(item => item.status !== "active"), `eski transfer (${transfer.no}) ters kaydedildi`);
    await expectDelta(before, { z: -2000, g: 2000 }, "Ziraat −2.000, Garanti +2.000 (10.000 → 12.000)");
    await closeAll();
  });

  await step("8. Planlı transfer Ziraat → Garanti 5.000: Planla → bakiye değişmez → Gerçekleştir → Ziraat −5.000, Garanti +5.000", async () => {
    const before = await balances();
    await openBank();
    await tab("movements");
    await page.waitForSelector(`${bankWin} [data-act="plan-new"]`, { timeout: 10000 });
    await page.click(`${bankWin} [data-act="plan-new"]`);
    await page.waitForSelector("form.hof-bank-voucher select[name=\"type\"]", { timeout: 10000 });
    await fillVoucher({ type: "transfer" });
    await fillVoucher({ accountId: ACC.z.id });
    await fillVoucher({ toAccountId: ACC.g.id, amount: "5.000", plannedDate: TODAY, description: "Planlı aktarım" });
    await shot("planli-transfer-formu");
    await page.click('form.hof-bank-voucher button[type="submit"]');
    await voucherClosed();
    await pause(900);
    const plans = (await must("planlar", api.get("/api/workspace/bank/plans"))).plans || [];
    const plan = plans.find(item => item.kind === "transfer" && item.amountMinor === 500_000);
    ok(Boolean(plan) && plan.toAccountId === ACC.g.id, `plan yazıldı (${plan?.typeLabel || "yok"})`);
    await expectDelta(before, {}, "Planla: bakiyeler aynı");
    await page.waitForSelector(`${bankWin} [data-act="plan-run"][data-plan="${plan.id}"]`, { timeout: 10000 });
    await page.click(`${bankWin} [data-act="plan-run"][data-plan="${plan.id}"]`);
    await page.waitForSelector(`${top} form button[type="submit"]`, { timeout: 8000 });
    await page.click(`${top} form button[type="submit"]`);
    await yesToAll(3);
    await pause(1000);
    await expectDelta(before, { z: -5000, g: 5000 }, "Gerçekleştir: Ziraat −5.000, Garanti +5.000");
    await closeAll();
  });

  await step("9. Vadeli hesaba transfer: Ziraat → Ziraat Bankası · Vadeli 20.000 → Ziraat −20.000, Vadeli +20.000; Gerçek Banka aynı", async () => {
    const before = await balances();
    const realBefore = (await must("özet", api.get("/api/workspace/bank/summary"))).realBank.minor;
    await openBank();
    await openTransferForm();
    await fillVoucher({ accountId: ACC.z.id });
    const targets = await page.$$eval('form.hof-bank-voucher select[name="toAccountId"] option', list => list.map(node => node.value));
    ok(targets.includes(ACC.v.id), "Alıcı Hesap listesinde vadeli hesap var");
    await fillVoucher({ toAccountId: ACC.v.id, amount: "20.000" });
    await shot("vadeli-hesaba-transfer");
    await page.click('form.hof-bank-voucher button[type="submit"]');
    await yesToAll(3);
    await voucherClosed();
    await pause(800);
    await expectDelta(before, { z: -20000, v: 20000 }, "Ziraat −20.000, Vadeli +20.000");
    ok((await must("özet", api.get("/api/workspace/bank/summary"))).realBank.minor === realBefore, "Gerçek Banka değişmedi (iç transfer)");
    await closeAll();
  });

  await step("10. Transfer formunda Eksi Bakiye sorusu (Vazgeç yazmaz) ve Benzer İşlem sorusu (Yine de Kaydet ikinci kayıt)", async () => {
    const before = await balances();
    await openBank();
    await openTransferForm();
    await fillVoucher({ accountId: ACC.g.id });
    await fillVoucher({ toAccountId: ACC.z.id, amount: String(Math.round((before.g + 1000) * 100) / 100).replace(".", ",") });
    await page.click('form.hof-bank-voucher button[type="submit"]');
    const neg = await answer("no");
    ok(has(neg.question, "Garanti BBVA · Ana TL Hesabı") && /eksi/i.test(neg.question), `Eksi Bakiye sorusu: ${neg.question.slice(0, 160)}`);
    await shot("transfer-eksi-bakiye-vazgec");
    await expectDelta(before, {}, "Vazgeç: bakiyeler aynı");
    await closeAll();
    await openBank();
    await openTransferForm();
    await fillVoucher({ accountId: ACC.z.id });
    await fillVoucher({ toAccountId: ACC.g.id, amount: "1.000" });
    await page.click('form.hof-bank-voucher button[type="submit"]');
    await yesToAll(2);
    await voucherClosed();
    await pause(700);
    const first = await expectDelta(before, { z: -1000, g: 1000 }, "ilk transfer 1.000");
    await openTransferForm();
    await fillVoucher({ accountId: ACC.z.id });
    await fillVoucher({ toAccountId: ACC.g.id, amount: "1.000" });
    await page.click('form.hof-bank-voucher button[type="submit"]');
    const similar = await answer("no");
    ok(/benzer/i.test(similar.question) && has(similar.question, "BNK-"), `Benzer İşlem sorusu: ${similar.question.slice(0, 160)}`);
    await expectDelta(first, {}, "Benzer İşlem'de Vazgeç yazmaz");
    await page.click('form.hof-bank-voucher button[type="submit"]');
    const again = await answer("yes");
    ok(again.yes === "Yine de Kaydet", `onay düğmesi “${again.yes}”`);
    await voucherClosed();
    await pause(700);
    await expectDelta(first, { z: -1000, g: 1000 }, "Yine de Kaydet: tek ikinci transfer");
    await closeAll();
  });

  await step("11. Silinenler: XYZ ödemesi (Garanti) geri yüklenirken Engelle → açık neden, geri yüklenmez; pasif hesapta açık neden; Uyar'da Yine de Geri Yükle", async () => {
    const g0 = (await balances()).g;
    const out = await must("ödeme", api.post(`/api/workspace/accounts/${xyz.id}/entries`, { kind: "out", amount: String(g0).replace(".", ","), method: "bank", bankAccountId: ACC.g.id, date: TODAY, note: "geri yüklenecek büyük ödeme", negativeOk: true }));
    await must("sil", api.del(`/api/workspace/accounts/${xyz.id}/entries/${out.entryId}`));
    await must("transfer", api.post("/api/workspace/bank/transfers", { accountId: ACC.g.id, toAccountId: ACC.z.id, amount: String(g0 - 6000).replace(".", ","), date: TODAY, feeAmount: "0", similarOk: true }));
    const before = await balances();
    ok(before.g === 6000, `Garanti 6.000 (${before.g})`);
    await must("Engelle", api.put(`/api/workspace/bank/accounts/${ACC.g.id}`, { negativePolicy: "block" }));
    const company = (await must("şirketler", api.get("/api/companies"))).companies.find(item => item.code === "001");
    await page.goto(`${BASE}/admin.html?sirket=${encodeURIComponent(company.id)}#trash`, { waitUntil: "load" });
    const row = '#adm-trash tr[data-id]:has-text("geri yüklenecek büyük ödeme")';
    await page.waitForSelector(`${row} [data-restore]`, { timeout: 15000 });
    await page.click(`${row} [data-restore]`);
    await pause(500);
    if (await page.$(`${top} [data-answer="yes"]`)) await page.click(`${top} [data-answer="yes"]`);
    const blocked = await lastToast(/eksi bakiyeye izin verilmiyor/);
    ok(Boolean(blocked), `Engelle: açık neden “${blocked.slice(0, 160)}”`);
    await shot("silinenler-engelle");
    await expectDelta(before, {}, "Engelle: geri yüklenmedi");
    await must("Uyar", api.put(`/api/workspace/bank/accounts/${ACC.g.id}`, { negativePolicy: "warn" }));
    await must("pasif", api.post(`/api/workspace/bank/accounts/${ACC.g.id}/status`, { status: "passive" }));
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(`${row} [data-restore]`, { timeout: 15000 });
    await page.click(`${row} [data-restore]`);
    await pause(500);
    if (await page.$(`${top} [data-answer="yes"]`)) await page.click(`${top} [data-answer="yes"]`);
    const passive = await lastToast(/pasif/);
    ok(Boolean(passive), `pasif hesap: açık neden “${passive.slice(0, 160)}”`);
    await shot("silinenler-pasif");
    await expectDelta(before, {}, "pasif: geri yüklenmedi");
    await must("etkin", api.post(`/api/workspace/bank/accounts/${ACC.g.id}/status`, { status: "active" }));
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(`${row} [data-restore]`, { timeout: 15000 });
    await page.click(`${row} [data-restore]`);
    const q = await answer("yes");
    ok(q.yes === "Yine de Geri Yükle", `Uyar: “${q.yes}”`);
    await pause(800);
    await expectDelta(before, { g: -g0 }, `Yine de Geri Yükle: Garanti −${g0}`);
    // Bu adımın kurulum transferi (Garanti → Ziraat) birikimli modele eklenir.
    total.g = Math.round(((total.g || 0) - (g0 - 6000)) * 100) / 100;
    total.z = Math.round(((total.z || 0) + (g0 - 6000)) * 100) / 100;
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await pause(700);
  });

  await step("12. Taksit kartı geri yükleme: kart (ABC 6.000/3) + havale tahsilatı 2.000 Ziraat → tahsilat ve kart silinir → önce tahsilat (kart yokken) → kart → tahsilat", async () => {
    const plan = await must("kart", api.post("/api/workspace/plans", { accountId: abc.id, name: "Kart Geri Yükleme", total: "6.000", mode: "auto", count: 3, firstDue: "2026-11-01" }));
    const entry = await must("tahsilat", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "2.000", method: "bank", bankAccountId: ACC.z.id, date: TODAY, note: "kart tahsilatı geri yükleme" }));
    const entryId = entry.entryId || entry.entry?.id || (await must("kart", api.get(`/api/workspace/plans/${plan.id}`))).entries.find(row => row.kind === "in")?.id;
    const before = await balances();
    await must("tahsilatı sil", api.del(`/api/workspace/plans/${plan.id}/entries/${entryId}`));
    await must("kartı sil", api.del(`/api/workspace/plans/${plan.id}`));
    const mid = await expectDelta(before, { z: -2000 }, "silmeler: Ziraat −2.000");
    const company = (await must("şirketler", api.get("/api/companies"))).companies.find(item => item.code === "001");
    await page.goto(`${BASE}/admin.html?sirket=${encodeURIComponent(company.id)}#trash`, { waitUntil: "load" });
    const entryRow = '#adm-trash tr[data-id]:has-text("kart tahsilatı geri yükleme")';
    const cardRow = '#adm-trash tr[data-id]:has-text("Kart Geri Yükleme"):has-text("Taksit kartı")';
    await page.waitForSelector(`${entryRow} [data-restore]`, { timeout: 15000 });
    await page.click(`${entryRow} [data-restore]`);
    await pause(500);
    if (await page.$(`${top} [data-answer="yes"]`)) await page.click(`${top} [data-answer="yes"]`);
    const why = await lastToast(/kart|Kart/);
    const afterTry = await balances();
    ok(afterTry.z === mid.z, `kart yokken tahsilat geri yüklenmedi (Ziraat ${afterTry.z}); neden “${why.slice(0, 160)}”`);
    await shot("silinenler-kart-yokken-tahsilat");
    await page.click(`${cardRow} [data-restore]`);
    await pause(500);
    if (await page.$(`${top} [data-answer="yes"]`)) await page.click(`${top} [data-answer="yes"]`);
    await pause(900);
    const card = await must("kart", api.get(`/api/workspace/plans/${plan.id}`));
    ok(card.status === "active" && card.totals.remaining === 6000, `kart geri geldi; kalan ${card.totals.remaining}`);
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(`${entryRow} [data-restore]`, { timeout: 15000 });
    await page.click(`${entryRow} [data-restore]`);
    await pause(500);
    if (await page.$(`${top} [data-answer="yes"]`)) await page.click(`${top} [data-answer="yes"]`);
    await pause(900);
    const back = await must("kart", api.get(`/api/workspace/plans/${plan.id}`));
    const restored = back.entries.find(row => row.kind === "in");
    ok(back.totals.remaining === 4000 && restored?.finRef === ACC.z.id, `tahsilat geri geldi, Ziraat'e bağlı; kalan ${back.totals.remaining}`);
    await expectDelta(mid, { z: 2000 }, "geri yükleme: Ziraat +2.000");
    await shot("silinenler-kart-ve-tahsilat");
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await pause(700);
  });

  await step("13. Toplu silme: Garanti'yi eksiye düşüren iki peşinli belge için TEK soru (“Yine de Sil”); onayla ikisi silinir", async () => {
    const sale = amount => must("peşinli satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: `Toplu Sil ${amount}`, qty: 1, unitPrice: amount, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: String(amount), method: "bank", bankAccountId: ACC.g.id }], cheques: [], endorse: [], rest: "open" }, force: true, similarOk: true }));
    const a = await sale(1000);
    const b = await sale(2000);
    const before = await balances();
    ok(before.g < 3000, `Garanti ${before.g} (silme eksiye düşürür)`);
    const inv = `${modal} .hof-invoices-modal`;
    await page.click("#hof-sidecard [data-action=invoices]");
    await page.waitForSelector(`${inv} [data-sel="${a.id}"]`, { timeout: 10000 });
    await page.click(`${inv} [data-sel="${a.id}"]`);
    await page.click(`${inv} [data-sel="${b.id}"]`);
    await page.waitForSelector(`${inv} [data-act="bulk-delete"]`, { timeout: 8000 });
    await page.click(`${inv} [data-act="bulk-delete"]`);
    const form = `${modal} .hof-form:has([name="reason"])`;
    await page.waitForSelector(`${form} [name="reason"]`, { timeout: 8000 });
    await page.fill(`${form} [name="reason"]`, "toplu silme denemesi");
    await page.click(`${form} button[type="submit"]`);
    const q = await answer("yes");
    ok(/2 belge/.test(q.question) && q.yes === "Yine de Sil", `tek soru: ${q.question.slice(0, 160)} · “${q.yes}”`);
    await pause(800);
    ok((await page.$$(`${modal} [data-answer="yes"]`)).length === 0, "ikinci soru gelmedi");
    await pause(800);
    const gone = async id => (await api.get(`/api/workspace/invoices/${id}`)).status !== 200;
    ok((await gone(a.id)) && (await gone(b.id)), "iki belge silindi");
    await expectDelta(before, { g: -3000 }, "Garanti −3.000");
    // Bu adımın kurulum satışları (+3.000) birikimli modele eklenir.
    total.g = Math.round(((total.g || 0) + 3000) * 100) / 100;
    await shot("toplu-silme-sonrasi");
    await closeAll();
  });

  await step("14. Son durum: birikimli bağımsız model, Alt Hesap Mizanı, Hesap Planı Mizanı 102, Mutabakat Testi", async () => {
    // API kurulumları birikimliye: 4 (+3.000 Ziraat), 6 (+4.000 Ziraat), 7 (−10.000 Ziraat, +10.000 Garanti), 12 (+2.000 Ziraat).
    const setup = { z: 3000 + 4000 - 10000 + 2000, g: 10000 };
    const want = Object.fromEntries(Object.keys(model).map(key => [key, Math.round((model[key] + (total[key] || 0) + (setup[key] || 0)) * 100) / 100]));
    const now = await balances();
    ok(Object.keys(want).every(key => Math.abs(now[key] - want[key]) < 0.001), `birikimli model: ${Object.keys(want).map(key => `${key} ${now[key]} / ${want[key]}`).join(", ")}`);
    const subs = Object.fromEntries((await must("alt hesap", api.get("/api/workspace/bank/sub-trial"))).rows.map(row => [row.sub, Math.round(row.balance * 100)]));
    const sub = code => subs[code] || 0;
    ok(sub(ACC.z.glSub) === Math.round(want.z * 100) && sub(ACC.g.glSub) === Math.round(want.g * 100) && sub(ACC.v.glSub) === Math.round(want.v * 100), `Alt Hesap Mizanı: ${ACC.z.glSub} ${sub(ACC.z.glSub) / 100}, ${ACC.g.glSub} ${sub(ACC.g.glSub) / 100}, ${ACC.v.glSub} ${sub(ACC.v.glSub) / 100}`);
    const trial = Object.fromEntries((await must("mizan", api.get("/api/workspace/ledger"))).trial.accounts.map(row => [row.code, Math.round(row.balance * 100)]));
    ok(trial["102"] === Math.round((want.z + want.g + want.v) * 100), `Hesap Planı Mizanı 102 = ${trial["102"] / 100} (model ${want.z + want.g + want.v})`);
    ok((await kasa()) === startCash, "Kasa hiç değişmedi (bütün işlemler banka)");
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    ok(integrity.ok === true, `Mutabakat Testi ${integrity.ok ? "tutarlı" : JSON.stringify(integrity.checks.filter(item => !item.ok)).slice(0, 300)}`);
    await openBank();
    await shot("son-durum-genel-bakis");
    await closeAll();
  });
} catch (error) {
  failed += 1;
  console.log(`✗ kurulum hatası: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-banka-210b: ${passed} geçti, ${failed} kaldı · ekran görüntüleri ${OUT}`);
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
