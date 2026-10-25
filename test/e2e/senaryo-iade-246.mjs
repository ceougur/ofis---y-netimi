// 2.4.6 madde 9 (DB1) + madde 10 — ekrandan, insan hızında (tıklama + Tab + gecikmeli yazım; ders 12), kayıttan sonra veri tabanı okunarak.
//   S1 Stok → ürün kartı → "↪ Tedarikçiye İade": miktar yazılır, Tab ile birim fiyat, İade Yolu klavyeyle Açık Hesap, tedarikçi seçicide yazıp Enter, Açıklama;
//      "İadeyi Kaydet" → stock_moves.reason 'preturn', tedarikçide Borç "Alış iadesi" 200, alış faturası P 500 → 300 açık (KS7 a), stok 2 azaldı.
//   S2 Tedarikçi kartı → Tahsilat: "Kapatılacak Fatura" seçeneklerinde bu iade ("İade Geri Ödemesi …", kalan 200; K-d / K-c); seçilir, tutar yazılır →
//      account_entries.refund_of = iade, invoice_id boş; P yeniden 500 açık.
//   S3 Müşteri (fatura B 500 + vadeli borç 300 + faturasız Satış İadesi 300) kartı → Ödeme: Kapatılacak Fatura'da iade klavyeyle seçilir → refund_of yazılır;
//      B 500 açık (önceden 200 — DB1); hareketlerde "İadeye Bağlı"; takvim B 500 + borç 300.
//   S4 bakiye ve Kasa: müşteri 800, tedarikçi −500; Kasa tahsilatla +200, ödemeyle −300.
// Çıkış: "N geçti, M kaldı" (kaldıysa çıkış kodu 1).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-iade-246-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, legacyCasePayments: false, legacyTableTransfer: false });
const api = await server.login();
const BASE = server.base;
const db = () => server.app.store;

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};

// ---------- Veri (programın kendi uçları; tarihler koşu gününe göre, ders 13) ----------
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
const goods = await must("ürün", api.post("/api/workspace/stock", { kind: "goods", code: "URN-E246", name: "Cam Panel E246", unit: "Adet", salePrice: "100", unitPrice: "100", openingQty: "50" }));
const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "E246 Tedarikçi", type: "supplier", phone: "0533 246 00 01", registeredOn: day(-200) }));
const purchase = await must("alış P", api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier.id, number: "E246-P1", issueDate: day(-20), pricesIncludeVat: false, lines: [{ name: "Malzeme", qty: 5, unitPrice: 100, vatRate: 0 }], payment: { rest: "open", dueDate: day(-10) } }));
const customer = await must("müşteri", api.post("/api/workspace/accounts", { name: "E246 Müşteri", type: "customer", phone: "0533 246 00 02", registeredOn: day(-200) }));
await must("fatura A", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: customer.id, issueDate: day(-60), lines: [{ itemId: goods.id, qty: 10, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(-50) } }));
await must("tahsilat", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "1000", date: day(-55), method: "cash" }));
const saleB = await must("fatura B", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: customer.id, issueDate: day(-30), lines: [{ itemId: goods.id, qty: 5, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(-20) } }));
await must("vadeli borç", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "debt", amount: "300", date: day(-25), dueDate: day(-10) }));
await must("faturasız Satış İadesi", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "3", unitPrice: "100", pay: "account", accountId: customer.id, date: day(-5) }));
const saleReturn = db().get("SELECT id FROM stock_moves WHERE account_id = ? AND reason = 'return'", customer.id).id;
const openOf = async id => (await must("fatura", api.get(`/api/workspace/invoices/${id}`))).open;
ok((await openOf(saleB.id)) === 200, `ön koşul (DB1): bağsız düzende B ${await openOf(saleB.id)} açık (iade B'yi kapattı)`);

const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const browser = await chromium.launch();
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", error => errors.push(error.message));
const typeSlow = text => page.keyboard.type(text, { delay: 70 });
// Kapalı <select> klavyeyle: odaktayken aşağı ok (Chromium seçimi değiştirir ve change yayar); hedefe varmazsa sayılır.
const pickByKeys = async (selector, value) => {
  for (let index = 0; index < 8; index += 1) {
    if ((await page.$eval(selector, node => node.value)) === value) return true;
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(90);
  }
  return (await page.$eval(selector, node => node.value)) === value;
};
const closeAll = async () => {
  for (let index = 0; index < 4 && (await page.$(MODAL)); index += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
try {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.evaluate(() => {
    localStorage.setItem(`hof-notices-off:${window.HOF.user.id}`, "true");
    document.querySelectorAll("#hof-notices .hof-notice").forEach(node => node.remove());
  });

  console.log("\n■ S1 Stok → Tedarikçiye İade (Açık Hesap), insan hızı + Tab");
  const qty0 = (await must("ürün", api.get(`/api/workspace/stock/${goods.id}`))).qty;
  await page.click("#hof-sidecard [data-action=stock]");
  await page.waitForSelector(`${MODAL} tr[data-item="${goods.id}"]`);
  await page.click(`${MODAL} tr[data-item="${goods.id}"]`);
  await page.waitForSelector(`${MODAL} [data-move="preturn"]`);
  ok(/Tedarikçiye İade/.test(await page.textContent(`${MODAL} [data-move="preturn"]`)), "ürün kartında “↪ Tedarikçiye İade” düğmesi");
  await page.click(`${MODAL} [data-move="preturn"]`);
  await page.waitForSelector(`${TOP} input[name="qty"]`);
  ok(/Tedarikçiye İade/.test(await page.textContent(`${TOP} .hof-modal-title`)), `form başlığı: ${(await page.textContent(`${TOP} .hof-modal-title`)).trim()}`);
  const payLabels = await page.$$eval(`${TOP} select[name="pay"] option`, nodes => nodes.map(node => node.textContent.trim()));
  ok(payLabels.length === 4 && !payLabels.some(label => /Kredi Kartı|POS/.test(label)), `İade Yolu seçenekleri (kart yok): ${payLabels.join(" | ")}`);
  await page.focus(`${TOP} input[name="qty"]`);
  await typeSlow("2");
  await page.keyboard.press("Tab");
  ok((await page.evaluate(() => document.activeElement?.name)) === "unitPrice", "Tab → İade Birim Fiyatı");
  await page.keyboard.press("Control+A");
  await typeSlow("100");
  await page.keyboard.press("Tab");
  ok((await page.evaluate(() => document.activeElement?.name)) === "pay", "Tab → İade Yolu");
  ok(await pickByKeys(`${TOP} select[name="pay"]`, "account"), "İade Yolu klavyeyle “Açık Hesap (tedarikçiye borcumuzdan düş)”");
  await page.keyboard.press("Tab");
  ok((await page.evaluate(() => document.activeElement?.hasAttribute("data-acc-query"))) === true, "Tab → Tedarikçi Carisi seçicisi");
  await typeSlow("E246 Ted");
  await page.waitForSelector(`${TOP} .hof-acc-picker li[data-id]`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  ok((await page.$eval(`${TOP} input[name="accountId"]`, node => node.value)) === supplier.id, "Enter ile tedarikçi seçildi");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  if ((await page.evaluate(() => document.activeElement?.name)) !== "note") await page.focus(`${TOP} input[name="note"]`);
  await typeSlow("kusurlu parti");
  await page.screenshot({ path: path.join(shots, "iade-246-tedarikciye-iade.png") }).catch(() => null);
  await page.click(`${TOP} button[type="submit"]`);
  await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible input[name="qty"]'), null, { timeout: 15000 });
  const move = db().get("SELECT id, kind, reason, pay, qty, amount, account_id AS accountId, note FROM stock_moves WHERE item_id = ? ORDER BY rowid DESC LIMIT 1", goods.id);
  ok(move && move.kind === "out" && move.reason === "preturn" && move.pay === "account" && move.amount === 200 && move.accountId === supplier.id && move.note === "kusurlu parti", `veri tabanı: ${JSON.stringify(move)}`);
  const entry = move && db().get("SELECT kind, amount, note FROM account_entries WHERE source = 'stock' AND source_id = ?", move.id);
  ok(entry?.kind === "debt" && entry.amount === 200 && /^Alış iadesi: Cam Panel E246 2 Adet/.test(entry.note), `tedarikçide Borç satırı: ${JSON.stringify(entry)}`);
  ok((await must("ürün", api.get(`/api/workspace/stock/${goods.id}`))).qty === qty0 - 2, "stok 2 azaldı");
  ok((await openOf(purchase.id)) === 300, `alış faturası P: 500 → ${await openOf(purchase.id)} açık (bağsız ödeme, en eski)`);
  ok(/Tedarikçiye İade/.test(await page.textContent(MODAL)), "ürün kartının hareketlerinde “Tedarikçiye İade”");
  await closeAll();

  console.log("\n■ S2 Tedarikçi kartı → Tahsilat → Geri Ödenen İade");
  await page.click("#hof-sidecard [data-action=accounts]");
  await page.waitForSelector(`${MODAL} tr[data-account="${supplier.id}"]`);
  await page.click(`${MODAL} tr[data-account="${supplier.id}"]`);
  await page.waitForSelector(`${MODAL} [data-entry="in"]`);
  await page.click(`${MODAL} [data-entry="in"]`);
  await page.waitForSelector(`${TOP} select[name="invoiceId"]`);
  const supOptions = await page.$$eval(`${TOP} select[name="invoiceId"] option`, nodes => nodes.map(node => [node.value, node.textContent.trim()]));
  ok(supOptions.length === 2 && supOptions[1][0] === move.id && /^İade Geri Ödemesi · Alış İadesi \(Faturasız\) · Cam Panel E246 · \d\d\.\d\d\.\d{4} · ₺200,00 · kalan ₺200,00$/.test(supOptions[1][1]), `Kapatılacak Fatura seçenekleri: ${JSON.stringify(supOptions)}`);
  await page.focus(`${TOP} input[name="amount"]`);
  await typeSlow("200");
  await page.selectOption(`${TOP} select[name="invoiceId"]`, move.id);
  await page.click(`${TOP} button[type="submit"]`);
  await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible select[name="invoiceId"]'), null, { timeout: 15000 });
  const supEntry = db().get("SELECT kind, amount, refund_of AS refundOf, invoice_id AS invoiceId FROM account_entries WHERE account_id = ? AND source = '' ORDER BY rowid DESC LIMIT 1", supplier.id);
  ok(supEntry?.kind === "in" && supEntry.amount === 200 && supEntry.refundOf === move.id && supEntry.invoiceId === "", `veri tabanı: ${JSON.stringify(supEntry)}`);
  ok((await openOf(purchase.id)) === 500, `iade geri ödendi: P ${await openOf(purchase.id)} açık`);
  await closeAll();

  console.log("\n■ S3 Müşteri kartı → Ödeme → Geri Ödenen İade (DB1)");
  await page.click("#hof-sidecard [data-action=accounts]");
  await page.waitForSelector(`${MODAL} tr[data-account="${customer.id}"]`);
  await page.click(`${MODAL} tr[data-account="${customer.id}"]`);
  await page.waitForSelector(`${MODAL} [data-entry="out"]`);
  await page.click(`${MODAL} [data-entry="out"]`);
  await page.waitForSelector(`${TOP} select[name="invoiceId"]`);
  const cusOptions = await page.$$eval(`${TOP} select[name="invoiceId"] option`, nodes => nodes.map(node => node.value));
  ok(cusOptions.length === 2 && cusOptions[1] === saleReturn, `müşteriye Ödeme'de Kapatılacak Fatura: Otomatik + iade (${JSON.stringify(cusOptions)})`);
  await page.focus(`${TOP} input[name="amount"]`);
  await typeSlow("300");
  await page.keyboard.press("Tab");
  // Ödeme Yolu → (varsa banka hesabı) → Tarih → Kapatılacak Fatura: odak seçiciye gelene kadar Tab (en çok 6).
  for (let index = 0; index < 6 && (await page.evaluate(() => document.activeElement?.name)) !== "invoiceId"; index += 1) await page.keyboard.press("Tab");
  ok((await page.evaluate(() => document.activeElement?.name)) === "invoiceId", "Tab ile Kapatılacak Fatura");
  ok(await pickByKeys(`${TOP} select[name="invoiceId"]`, saleReturn), "Kapatılacak Fatura klavyeyle: İade Geri Ödemesi (faturasız Satış İadesi)");
  await page.screenshot({ path: path.join(shots, "iade-246-geri-odeme.png") }).catch(() => null);
  await page.click(`${TOP} button[type="submit"]`);
  // Kasa eksi / benzer işlem sorusu çıkarsa "Yine de Kaydet".
  await page.waitForTimeout(600);
  const confirm = await page.$(`${TOP} [data-answer="yes"]`);
  if (confirm) {
    console.log(`  · soru yanıtlandı: ${(await page.textContent(`${TOP} .hof-modal-text`).catch(() => "")).slice(0, 100)}`);
    await confirm.click();
  }
  await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible select[name="invoiceId"]'), null, { timeout: 15000 });
  const cusEntry = db().get("SELECT kind, amount, refund_of AS refundOf, invoice_id AS invoiceId FROM account_entries WHERE account_id = ? AND source = '' ORDER BY rowid DESC LIMIT 1", customer.id);
  ok(cusEntry?.kind === "out" && cusEntry.amount === 300 && cusEntry.refundOf === saleReturn && cusEntry.invoiceId === "", `veri tabanı: ${JSON.stringify(cusEntry)}`);
  ok((await openOf(saleB.id)) === 500, `B ${await openOf(saleB.id)} açık (DB1 öncesi 200)`);
  await page.waitForSelector(`${MODAL} [data-refund-of="${saleReturn}"]`, { timeout: 10000 }).catch(() => null);
  ok(Boolean(await page.$(`${MODAL} [data-refund-of="${saleReturn}"]`)), "hareketlerde “İadeye Bağlı” etiketi");
  const dues = (await must("takvim", api.get("/api/workspace/dues"))).items.filter(item => item.accountId === customer.id || item.person === customer.name).map(item => [item.source, item.amount]).sort();
  ok(JSON.stringify(dues) === JSON.stringify([["account", 300], ["invoice", 500]]), `takvim / zil: ${JSON.stringify(dues)}`);
  await closeAll();

  console.log("\n■ S4 bakiye");
  const cus = await must("müşteri", api.get(`/api/workspace/accounts/${customer.id}`));
  const sup = await must("tedarikçi", api.get(`/api/workspace/accounts/${supplier.id}`));
  ok(cus.totals.balance === 800 && sup.totals.balance === -500, `müşteri ${cus.totals.balance} (800), tedarikçi ${sup.totals.balance} (−500)`);
  ok(!errors.length, `sayfa hatası yok: ${errors.join(" | ")}`);
} catch (error) {
  ok(false, `senaryo yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
  await page.screenshot({ path: path.join(shots, "iade-246-hata.png") }).catch(() => null);
} finally {
  await browser.close().catch(() => null);
  await server.close().catch(() => null);
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
if (!process.env.EKRAN_DIR) {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    // temizlik hatası sonucu ezmez
  }
}
process.exit(failed ? 1 : 0);
