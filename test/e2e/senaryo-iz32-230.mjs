// 2.3.0 İz 3.2 + 3.4 — EKRANDAN (sunucu kuralları test/banka-230-46-iade-iptal.test.mjs ve test/fatura-230-ayarlar-banka.test.mjs):
//   1 Fatura Ayarları → Banka Hesapları: hesap yokken eski liste düzenlenir (4 satır, IBAN A ve B dolu).
//   2 İlk banka hesabı (IBAN A, "IBAN Faturada Gösterilsin") açılınca: liste salt okunur, yalnız A; B "hesap olarak açılmamış" önerisinde; "Banka →
//     Hesaplar" düğmesi; Ayarları Kaydet eski listeyi (A, B) değiştirmez.
//   3 POS'lu satış faturasında İptal Et penceresi "POS İşlemi" (Müşteriye İade Edildi / Kayıt Hatası) sorar; Kayıt Hatası → POS satışı void, iade yok.
//     Nakit faturada alan yok. Sil penceresinde de alan.
//   4 Cari Tahsilat formu: Kredi Kartı yolunda "Kredi Kartına İade" kutusu; işaretsiz → POS alanı; işaretli → POS alanı gizli, kart seçicisi
//     (tek kartta bilgi satırı). Tedarikçiden 240 kart iadesi → satır karta bağlı, POS satışı yok, kart borcu 600 → 360.
//   5 Toplu kesim: Taslaklar sekmesinde 3 taslak seç → Seçilenleri Kaydet → 3 belge kaydedildi.
//   6 Toplu iptal: 2 POS'lu belge seç → Seçilenleri İptal Et → "POS İşlemi (2 belgede POS tahsilatı var)" → Müşteriye İade Edildi → provizyon içinde
//     void (komisyon yok).
// Sahte saat 08.10.2026 (ders 13). Ekran adları yazım düzeniyle denetlenir. Çalıştırma: npm run test:senaryo-iz32-230
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-iz32-230");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const BANK = "/api/workspace/bank";
const INV = "/api/workspace/invoices";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-iz32-230-"));
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
  if (name !== "hata") await auditLabels(name);
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const inv = `${modal} .hof-invoices-modal`;
const pause = ms => page.waitForTimeout(ms);
const closeAll = async () => {
  for (let index = 0; index < 8 && (await page.$(modal)); index += 1) {
    await escClose(page);
    await pause(300);
    const leave = await page.$(`${top} [data-answer="yes"]`);
    if (leave && /Kaydetmeden|Çık/.test((await leave.textContent()) || "")) await leave.click();
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
const visible = selector => page.$eval(selector, node => Boolean(node.offsetParent)).catch(() => false);
const typeInto = async (selector, value) => {
  await page.click(selector);
  await page.fill(selector, "");
  await page.type(selector, value, { delay: 35 });
};
const kurus = value => Math.round(Number(value) * 100);
const balanceOf = async id => (await must("hesap", api.get(`${BANK}/accounts/${id}`))).balanceMinor;
const sales = async (query = "") => (await must("POS işlemleri", api.get(`${BANK}/pos/sales${query}`))).sales;
const settingsOf = () => must("ayarlar", api.get(`${INV}/settings`));
const integrity = async label => {
  const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
  const bad = (result.checks || []).filter(item => !item.ok);
  ok(result.ok !== false && bad.length === 0, `${label}: Mutabakat Testi tamam${bad.length ? ` — ${bad.map(item => item.code).join(", ")}` : ""}`);
};
const submitTop = async () => {
  await page.click(`${top} .hof-form button[type="submit"]`);
  await pause(1000);
};
const openInvoices = async () => {
  await closeAll();
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="new"], ${inv} [data-act="settings"]`, { timeout: 15000 });
  await pause(500);
};
const openSettings = async () => {
  await openInvoices();
  await page.click(`${inv} [data-act="settings"]`);
  await page.waitForSelector(`${inv} [data-inv-banks]`, { timeout: 10000 });
  await pause(400);
};
const openDoc = async id => {
  await closeAll();
  await page.evaluate(docId => HOF.invoices.openDoc(docId), id);
  await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 15000 });
  await pause(500);
};
const posInvoice = (accountId, itemId, qty, unitPrice, extra = {}) =>
  must("POS'lu fatura", api.post(INV, { kind: "sale", accountId, issueDate: TODAY, pricesIncludeVat: true, lines: [{ itemId, name: "Ürün B", qty, unitPrice, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: qty * unitPrice, method: "card" }], cheques: [], endorse: [], rest: "open" }, force: true, similarOk: true, ...extra }));
const IBAN_A = "TR380001000000000001111111";
const IBAN_B = "TR050006200000000002222222";
const SMALL = new Set(["ve", "ile", "veya", "ya", "da", "de", "ki"]);
const labelProblems = new Map();
async function auditLabels(where) {
  const texts = await page.evaluate(() => {
    const visibleNode = node => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== "hidden";
    };
    const own = node => [...node.childNodes].filter(child => child.nodeType === 3).map(child => child.nodeValue).join(" ").replace(/\s+/g, " ").trim();
    const sentence = node => Boolean(node.closest("[data-sentence]") || node.closest("label")?.querySelector('input[type="checkbox"], input[type="radio"]'));
    const out = [];
    const take = (selector, read = own) => document.querySelectorAll(selector).forEach(node => visibleNode(node) && !sentence(node) && out.push(read(node)));
    take(".hof-modal-title, .hof-modal button:not(tbody button):not([data-open]), .hof-modal a.hof-button");
    take(".hof-modal thead th, .hof-modal .hof-field > span, .hof-modal label > span, .hof-modal legend, .hof-rep-stat > span");
    take(".hof-modal select option", node => node.textContent.trim());
    return out;
  });
  for (const raw of texts) {
    const text = String(raw || "").split(" · ")[0].replace(/\([^)]*\)/g, "").replace(/[“”"][^“”"]*[“”"]/g, "").trim();
    if (!text || text.length > 60 || /[.!?]\s|[.!?]$/.test(text) || /\d{2}\.\d{2}\.\d{4}/.test(text) || /₺/.test(text)) continue;
    const words = text.split(/\s+/).filter(word => /\p{L}/u.test(word));
    if (words.length < 2) continue;
    const bad = words.slice(1).filter(word => /^[a-zçğıöşü]/.test(word) && !SMALL.has(word.replace(/[^\p{L}]/gu, "")));
    if (bad.length) labelProblems.set(raw.trim(), where);
  }
}

const ctx = {};
try {
  await api.login("admin", PASS);
  await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
  await must("eski banka listesi", api.put(`${INV}/settings`, { seller: { banks: [{ name: "Ziraat Bankası", iban: IBAN_A }, { name: "Garanti BBVA", iban: IBAN_B }] } }));
  ctx.urunB = await must("Ürün B", api.post("/api/workspace/stock", { kind: "goods", code: "B", name: "Ürün B", unit: "Adet", openingQty: "100" }));
  ctx.abc = await must("ABC", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  ctx.supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Toptancı A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
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

  await step("1 Fatura Ayarları → Banka Hesapları: banka hesabı yokken eski liste düzenlenir (4 satır; A ve B dolu)", async () => {
    await openSettings();
    ok((await page.$eval(`${inv} [data-inv-banks]`, node => node.dataset.invBanks)) === "legacy", "bölüm eski liste kipinde");
    const ibans = await page.$$eval(`${inv} [data-inv-banks] input[data-k="iban"]`, nodes => nodes.map(node => node.value));
    ok(ibans.length === 4 && ibans[0] === IBAN_A && ibans[1] === IBAN_B, `4 düzenlenebilir satır; ilk ikisi A ve B: ${ibans.join(" | ")}`);
    ok(!(await page.$(`${inv} [data-act="open-bank"]`)), "hesap yokken Banka → Hesaplar düğmesi yok");
    await shot("ayarlar-eski-liste");
    await closeAll();
  });

  await step("2 İlk hesap (Ziraat, IBAN A, IBAN Faturada Gösterilsin) + POS + kredi kartı → Fatura Ayarları: salt okunur liste yalnız A; B öneride; Kaydet eski listeyi değiştirmez", async () => {
    ctx.ziraat = await must("Ziraat", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: IBAN_A, showOnInvoice: true, usePos: true, useCard: true, opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
    ctx.pos = (await must("POS", api.post(`${BANK}/pos`, { name: "Ziraat Fiziki POS", bankAccountId: ctx.ziraat.id, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", merchantNo: "123456789", terminalNo: "T001", validFrom: "2026-10-01", rates: [{ installments: 1, rate: "2,5" }, { installments: 3, rate: "3,5" }] }))).pos;
    ctx.kk = await must("kredi kartı", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "World", kind: "card", parentId: ctx.ziraat.id, creditLimit: "50.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } }));
    await openSettings();
    ok((await page.$eval(`${inv} [data-inv-banks]`, node => node.dataset.invBanks)) === "accounts", "bölüm hesap kipinde (salt okunur)");
    ok(!(await page.$(`${inv} [data-inv-banks] input[data-k="iban"]`)), "eski listenin giriş kutuları yok");
    const rows = await page.$$eval(`${inv} [data-inv-bank]`, nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ").trim()));
    ok(rows.length === 1 && /Ziraat Bankası/.test(rows[0]) && rows[0].replace(/\s/g, "").includes(IBAN_A), `basılacak hesap yalnız Ziraat / A: ${rows.join(" | ")}`);
    const suggest = (await textOf(`${inv} [data-inv-bank-suggest]`)).replace(/\s/g, "");
    ok(suggest.includes("Garanti") && suggest.includes(IBAN_B) && !suggest.includes(IBAN_A), "B eski listede hesap olarak açılmamış önerisinde (A değil)");
    ok(await visible(`${inv} [data-act="open-bank"]`), "Banka → Hesaplar düğmesi");
    await shot("ayarlar-hesap-listesi");
    await page.click(`${inv} [data-act="save-settings"]`);
    await pause(1200);
    const s = await settingsOf();
    ok(s.seller.banks.map(bank => bank.iban).join(",") === `${IBAN_A},${IBAN_B}`, `Ayarları Kaydet eski listeyi değiştirmedi: ${s.seller.banks.map(bank => bank.iban).join(",")}`);
    ok(s.bankAccounts.active === true && s.bankAccounts.accounts.length === 1 && s.bankAccounts.suggestions.length === 1, "sunucu: etkin, 1 hesap, 1 öneri");
    const doc = await must("fatura", api.post(INV, { kind: "sale", accountId: ctx.abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ itemId: ctx.urunB.id, name: "Ürün B", qty: 1, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
    const printed = (await must("belge", api.get(`${INV}/${doc.id}`))).seller.banks.map(bank => bank.iban);
    ok(printed.join(",") === IBAN_A, `belgeye yalnız A basılır: ${printed.join(",")}`);
    await closeAll();
  });

  await step("3 POS'lu faturada İptal Et → POS İşlemi seçimi (Kayıt Hatası → void, iade yok); nakit faturada alan yok; Sil penceresinde alan var", async () => {
    ctx.posDoc = await posInvoice(ctx.abc.id, ctx.urunB.id, 2, 1000);
    ctx.cashDoc = await must("nakit fatura", api.post(INV, { kind: "sale", accountId: ctx.abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ itemId: ctx.urunB.id, name: "Ürün B", qty: 1, unitPrice: 500, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: 500, method: "cash" }], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true, similarOk: true }));
    await openDoc(ctx.cashDoc.id);
    await page.click(`${inv} [data-act="cancel"]`);
    await page.waitForSelector(`${top} .hof-form input[name="reason"]`, { timeout: 8000 });
    ok(!(await page.$(`${top} .hof-form select[name="posOutcome"]`)), "nakit faturada POS İşlemi alanı yok");
    await page.click(`${top} [data-cancel]`);
    await pause(400);
    await openDoc(ctx.posDoc.id);
    await page.click(`${inv} [data-act="delete"]`);
    await page.waitForSelector(`${top} .hof-form input[name="reason"]`, { timeout: 8000 });
    ok(await visible(`${top} .hof-form select[name="posOutcome"]`), "Sil penceresinde POS İşlemi alanı");
    await page.click(`${top} [data-cancel]`);
    await pause(400);
    await page.click(`${inv} [data-act="cancel"]`);
    await page.waitForSelector(`${top} .hof-form select[name="posOutcome"]`, { timeout: 8000 });
    const options = await page.$$eval(`${top} .hof-form select[name="posOutcome"] option`, nodes => nodes.map(node => [node.value, node.textContent.trim()]));
    ok(options.length === 2 && options[0][0] === "refunded" && /Müşteriye İade Edildi/.test(options[0][1]) && options[1][0] === "entry-error" && /Kayıt Hatası/.test(options[1][1]), `seçenekler: ${options.map(item => item[1]).join(" / ")}`);
    ok((await page.$eval(`${top} .hof-form select[name="posOutcome"]`, node => node.value)) === "refunded", "varsayılan Müşteriye İade Edildi");
    await typeInto(`${top} .hof-form input[name="reason"]`, "Yanlış girildi");
    await page.selectOption(`${top} .hof-form select[name="posOutcome"]`, "entry-error");
    await shot("fatura-iptal-pos-islemi");
    await submitTop();
    for (let i = 0; i < 6; i += 1) {
      const yes = await page.$(`${top} [data-answer="yes"]`);
      if (!yes) break;
      await yes.click();
      await pause(600);
    }
    await pause(800);
    const sale = (await sales("?kind=sale&status=")).find(item => item.invoice?.id === ctx.posDoc.id);
    ok(sale?.status === "void", `POS satışı void (Kayıt Hatası): ${sale?.status}`);
    ok((await sales("?kind=refund")).length === 0, "iade kaydı yok");
    ok((await must("belge", api.get(`${INV}/${ctx.posDoc.id}`))).status === "cancelled", "belge İptal Edildi");
    await integrity("Kayıt Hatası iptali");
    await closeAll();
  });

  await step("4 Cari Tahsilat formu: Kredi Kartı yolunda \"Kredi Kartına İade\" kutusu → POS alanı yerine kart seçicisi; tedarikçiden 240 iade → karta bağlı, POS yok, kart borcu 600 → 360", async () => {
    await must("kartla ödeme 600", api.post(`/api/workspace/accounts/${ctx.supplier.id}/entries`, { kind: "out", method: "card", amount: "600", date: TODAY, bankAccountId: ctx.kk.id }));
    ok((await balanceOf(ctx.kk.id)) === -kurus(600), "kart borcu 600");
    await page.evaluate(id => HOF.accounts.open(id), ctx.supplier.id);
    await page.waitForSelector('.hof-accounts-modal [data-entry="in"]', { timeout: 10000 });
    await page.click('.hof-accounts-modal [data-entry="in"]');
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    ok(!(await visible(`${form} input[name="cardRefund"]`)), "Nakit yolunda kutu görünmez");
    await typeInto(`${form} input[name="amount"]`, "240");
    await page.selectOption(`${form} select[name="method"]`, "card");
    await page.waitForSelector(`${form} [data-pos-pick]:not([hidden])`, { timeout: 8000 });
    ok(await visible(`${form} input[name="cardRefund"]`), "Kredi Kartı yolunda Kredi Kartına İade kutusu görünür");
    ok(!(await visible(`${form} [data-bank-pick="card"]`)), "işaretsiz: kart seçicisi gizli (POS alanı açık)");
    await page.check(`${form} input[name="cardRefund"]`);
    await pause(500);
    ok(!(await visible(`${form} [data-pos-pick]`)), "işaretli: POS alanı gizli");
    ok(await visible(`${form} [data-bank-pick="card"]`), "işaretli: kart seçicisi görünür");
    ok(/kredi kartımıza iade/.test(await textOf(`${top} .hof-modal-text`)), "açıklama Kredi Kartına İade'ye göre");
    await shot("cari-kredi-kartina-iade");
    await submitTop();
    const rows = app.store.all("SELECT kind, amount, method, fin_ref AS finRef, event_id AS eventId FROM account_entries WHERE account_id = ? AND kind = 'in'", ctx.supplier.id);
    ok(rows.length === 1 && rows[0].method === "card" && rows[0].finRef === ctx.kk.id && rows[0].amount === 240, `satır karta bağlı: ${JSON.stringify(rows)}`);
    ok(rows.length === 1 && app.store.get("SELECT COUNT(*) AS n FROM pos_sales WHERE event_id = ?", rows[0].eventId).n === 0, "POS satışı oluşmadı");
    ok((await balanceOf(ctx.kk.id)) === -kurus(360), "kart borcu 360");
    await closeAll();
    // Karşılaştırma: ABC'den kartla tahsilat (kutu işaretsiz) POS satışıdır.
    await page.evaluate(id => HOF.accounts.open(id), ctx.abc.id);
    await page.waitForSelector('.hof-accounts-modal [data-entry="in"]', { timeout: 10000 });
    await page.click('.hof-accounts-modal [data-entry="in"]');
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await typeInto(`${form} input[name="amount"]`, "500");
    await page.selectOption(`${form} select[name="method"]`, "card");
    await page.waitForSelector(`${form} [data-pos-pick]:not([hidden])`, { timeout: 8000 });
    await typeInto(`${form} input[name="authCode"]`, "CARI77");
    await submitTop();
    const posSale = (await sales("?kind=sale")).find(item => item.authCode === "CARI77");
    ok(posSale && posSale.status === "active" && posSale.party?.id === ctx.abc.id, "işaretsiz kart tahsilatı POS satışı (CARI77)");
    await integrity("Kredi Kartına İade");
    await closeAll();
  });

  await step("5 Toplu kesim: Taslaklar'da 3 taslak seç → Seçilenleri Kaydet → 3 belge kaydedildi", async () => {
    const ids = [];
    for (const price of [110, 120, 130]) ids.push((await must("taslak", api.post(INV, { kind: "sale", accountId: ctx.abc.id, issueDate: TODAY, pricesIncludeVat: true, status: "draft", lines: [{ itemId: ctx.urunB.id, name: "Ürün B", qty: 1, unitPrice: price, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: price, method: "bank", bankAccountId: ctx.ziraat.id }], cheques: [], endorse: [], rest: "open" }, force: true }))).id);
    await openInvoices();
    await page.click(`${inv} [data-tab="drafts"]`);
    await pause(800);
    for (const id of ids) await page.check(`${inv} input[data-sel="${id}"]`);
    await pause(300);
    ok(await visible(`${inv} [data-act="bulk-issue"]`), "Seçilenleri Kaydet düğmesi");
    await shot("toplu-kesim-secim");
    await page.click(`${inv} [data-act="bulk-issue"]`);
    await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
    await page.click(`${top} [data-answer="yes"]`);
    await pause(1500);
    const issued = ids.filter(id => app.store.get("SELECT status FROM invoices WHERE id = ?", id).status === "issued").length;
    ok(issued === 3, `3 taslak kaydedildi: ${issued}`);
    await integrity("toplu kesim");
    await closeAll();
  });

  await step("6 Toplu iptal: 2 POS'lu belge seç → Seçilenleri İptal Et → POS İşlemi (2 belgede) → Müşteriye İade Edildi → provizyon içinde void", async () => {
    const a = await posInvoice(ctx.abc.id, ctx.urunB.id, 1, 1000, { payment: { cash: [{ amount: 1000, method: "card", authCode: "TOP1" }], cheques: [], endorse: [], rest: "open" } });
    const b = await posInvoice(ctx.abc.id, ctx.urunB.id, 3, 1000, { payment: { cash: [{ amount: 3000, method: "card", authCode: "TOP2" }], cheques: [], endorse: [], rest: "open" } });
    await openInvoices();
    await page.click(`${inv} [data-tab="sale"]`);
    await pause(800);
    await page.check(`${inv} input[data-sel="${a.id}"]`);
    await page.check(`${inv} input[data-sel="${b.id}"]`);
    await pause(300);
    await page.click(`${inv} [data-act="bulk-cancel"]`);
    await page.waitForSelector(`${top} .hof-form select[name="posOutcome"]`, { timeout: 8000 });
    const label = await page.$eval(`${top} .hof-form select[name="posOutcome"]`, node => node.closest("label")?.querySelector("span")?.textContent.trim() || "");
    ok(/POS İşlemi \(2 belgede POS tahsilatı var\)/.test(label), `toplu pencerede alan: “${label}”`);
    await typeInto(`${top} .hof-form input[name="reason"]`, "Müşteri vazgeçti");
    await shot("toplu-iptal-pos-islemi");
    await submitTop();
    await pause(1200);
    const statuses = (await sales("?kind=sale&status=")).filter(item => ["TOP1", "TOP2"].includes(item.authCode)).map(item => item.status).sort();
    ok(statuses.join(",") === "void,void", `iki satış void (Müşteriye İade Edildi, provizyon içinde): ${statuses.join(",")}`);
    ok((await sales("?kind=refund")).length === 0, "İptal İadesi oluşmadı (komisyon yok)");
    ok([a.id, b.id].every(id => app.store.get("SELECT status FROM invoices WHERE id = ?", id).status === "cancelled"), "iki belge İptal Edildi");
    await integrity("toplu iptal");
    await closeAll();
  });
} catch (error) {
  failed += 1;
  console.log(`✗ kurulum hatası: ${error.stack || error.message}`);
} finally {
  ok(labelProblems.size === 0, `ekranlarda yazım düzeni (her sözcüğün ilk harfi büyük)${labelProblems.size ? `: ${[...labelProblems].slice(0, 8).map(([label, where]) => `“${label}” (${where})`).join(", ")}` : ""}`);
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-iz32-230: ${passed} geçti, ${failed} kaldı · ekran görüntüleri ${OUT}`);
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
