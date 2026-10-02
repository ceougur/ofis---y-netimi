// Gerçek kullanıcı senaryosu (v2.0.17): müşterinin bildirdiği maddeler arayüzden, sıfırdan, uçtan uca. Tarihler bugüne
// göredir (sabit tarih yok). Her maddenin kanıtı bir kontrol ve ekran görüntüsüdür (artifacts/senaryo-217/).
//   5. Hayalet kısmi ödeme: aynı cariye satış 400 + alış 6.000 → alış "Açık" (ödenen 0); kartta "Bu Faturayı Kapatanlar";
//      Mahsup Et (satış ↔ alış) → "Mahsup" rozeti; cari kartından ödeme "Kapatılacak Fatura" ile → "Bağlı"; bakiye/Kasa aynı.
// Çalıştırma: npm run test:senaryo-217 (ekran görüntüleri artifacts/senaryo-217/).
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-217");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-217-"));
const excel = path.join(root, "musteriler.xlsx");
const COLS = ["Müşteri", "Telefon", "Kayıt Tarihi", "Tutar"];
writeFileSync(excel, buildXlsx([{ name: "Müşteriler", columns: COLS, rows: [{ Müşteri: "Ali Veli", Telefon: "0532 111 22 33", "Kayıt Tarihi": "01.01.2026", Tutar: "1.000,00" }] }], { title: "Müşteriler" }));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f93" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const errors = [];
const newPage = async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-bar{display:none !important}" }))));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
  });
  page.on("dialog", dialog => dialog.accept());
  return page;
};
const results = [];
let shotNo = 0;
const shot = async (page, name) => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const ok = (cond, msg) => {
  results.push({ ok: Boolean(cond), msg });
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) throw new Error(`BAŞARISIZ: ${msg}`);
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  await fn();
};
const call = (page, url, body, method = body ? "POST" : "GET") =>
  page.evaluate(
    async ([url, body, method]) => {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json().catch(() => ({}));
      return { status: response.status, ...json };
    },
    [url, body, method],
  );
const login = async (page, username, password) => {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
};
const modal = ".hof-modal-backdrop.is-visible";
const inv = `${modal} .hof-invoices-modal`;
const pad = value => String(value).padStart(2, "0");
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const shift = days => iso(new Date(Date.now() + days * 86_400_000));
const TODAY = iso(new Date());
const money = text => Number(String(text).replace(/[^\d,-]/g, "").replace(",", "."));
const admin = await newPage();
const closeAll = async () => {
  for (let i = 0; i < 8 && (await admin.$(modal)); i += 1) {
    await admin.keyboard.press("Escape");
    await admin.waitForTimeout(250);
  }
};
const confirmYes = async () => {
  await admin.waitForSelector(`${modal} [data-answer="yes"]`, { timeout: 8000 });
  await admin.click(`${modal} [data-answer="yes"]`);
};
const pickAccount = async (query, nth = 0) => {
  await admin.fill(`${inv} [data-acc-query]`, query);
  await admin.waitForSelector(`${inv} .hof-acc-picker li[data-id]`);
  const items = await admin.$$(`${inv} .hof-acc-picker li[data-id]`);
  await items[nth].dispatchEvent("mousedown");
};
const addItemLine = async (index, query, qty, price = null) => {
  await admin.click(`${inv} [data-l="${index}"][data-f="name"]`);
  await admin.keyboard.type(query);
  await admin.waitForSelector(`${inv} [data-hits="${index}"] li[data-item]`);
  await admin.click(`${inv} [data-hits="${index}"] li[data-item]`);
  await admin.fill(`${inv} [data-l="${index}"][data-f="qty"]`, String(qty));
  if (price !== null) await admin.fill(`${inv} [data-l="${index}"][data-f="unitPrice"]`, String(price));
  await admin.waitForTimeout(900);
};
const issue = async () => {
  await admin.click(`${inv} [data-act="issue"]`);
  await confirmYes();
  await admin.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 10000 });
  return (await admin.textContent(`${inv} .hof-plan-title h3`)).replace(/\s+/g, " ").trim();
};
const account = async id => (await call(admin, `/api/workspace/accounts/${id}`)).data;
const stockQty = async id => (await call(admin, `/api/workspace/stock/${id}`)).data.qty;
const cashTotals = async () => (await call(admin, "/api/workspace/cash")).data.byMethod;
const invoiceOpened = async number => {
  await admin.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 10000 });
  const title = await admin.textContent(`${inv} .hof-plan-title h3`);
  return title.includes(number);
};
const ids = {};
let exitCode = 0;
const cell = (text, label) => {
  const match = new RegExp(`${label}\\s*(-?₺?-?[\\d.]+,\\d{2})`).exec(text);
  return match ? money(match[1]) : null;
};
try {
  await step("Kurulum: yönetici girer, Excel yüklenir, cari/stok/Kasa hazırlanır", async () => {
    await login(admin, "admin", PASS);
    await admin.waitForSelector("#hof-start .hof-drop");
    await (await admin.$("#hof-start .hof-drop input[type=file]")).setInputFiles(excel);
    await admin.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.click(`${modal} [data-mode="replace"]`)]);
    await admin.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 }).catch(() => null);
    await admin.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => admin.keyboard.press("Escape"));
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-sidecard [data-action=invoices]", { timeout: 20000 });
    ids.party = (await call(admin, "/api/workspace/accounts", { name: "Mehmet Eren Demir", type: "customer", phone: "0532 444 55 66" })).data.id;
    ids.item = (await call(admin, "/api/workspace/stock", { name: "Fotokopi Kağıdı A4", code: "FK-A4", unit: "Paket", salePrice: 100 })).data.id;
    const opening = await call(admin, "/api/workspace/cash", { kind: "in", amount: 20000, date: shift(-20), description: "Açılış" });
    ok(ids.party && ids.item && opening.status === 200, "cari, stok kartı ve Kasa açılışı hazır");
  });

  await step("5. Hayalet kısmi ödeme: satış 400 + alış 6.000 → alış Açık; Mahsup Et; Kapatılacak Fatura; Bu Faturayı Kapatanlar", async () => {
    const sale = await call(admin, "/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.party, issueDate: shift(-6), lines: [{ itemId: ids.item, qty: 4, unitPrice: 100, vatRate: 0 }], payment: { rest: "open" }, force: true });
    const purchase = await call(admin, "/api/workspace/invoices", { scenario: "goods_purchase", accountId: ids.party, number: "ALS2026000000089", issueDate: shift(-5), lines: [{ itemId: ids.item, qty: 60, unitPrice: 100, vatRate: 0 }], payment: {} });
    ok(sale.status === 200 && purchase.status === 200, "aynı cariye satış 400 ve alış 6.000 kaydedildi");
    ids.sale = sale.data.id;
    ids.purchase = purchase.data.id;
    const before = { balance: (await account(ids.party)).totals.balance, cash: (await call(admin, "/api/workspace/cash")).data.totals.balance };
    await admin.evaluate(id => window.HOF.invoices.openDoc(id), ids.purchase);
    await admin.waitForSelector(`${inv} .hof-inv-closers`, { timeout: 10000 });
    let pay = (await admin.textContent(`${inv} .hof-inv-pay`)).replace(/\s+/g, " ");
    ok(/Açık: ₺?6\.000,00/.test(pay) && !/Kısmen|ödenen 400/.test(pay), `alış faturası Açık 6.000, kısmi ödeme yok (${pay.slice(0, 120)})`);
    ok(/Bu Faturayı Kapatanlar/.test(pay) && /Henüz kapatan yok/.test(pay), "kartta “Bu Faturayı Kapatanlar” bölümü ve açıklama");
    await shot(admin, "alis-faturasi-acik-kapatan-yok");
    // Mahsup Et: satış 400 ile karşılıklı kapama.
    await admin.click(`${inv} [data-act="offset"]`);
    await admin.waitForSelector(`${modal} select[name="counter"]`, { timeout: 8000 });
    const options = await admin.$$eval(`${modal} select[name="counter"] option`, nodes => nodes.map(node => node.textContent.trim()));
    ok(options.length === 1 && /Satış Faturası/.test(options[0]) && /açık ₺?400,00/.test(options[0]), `mahsup listesinde yalnız karşı yöndeki satış (${options[0]})`);
    ok((await admin.$eval(`${modal} input[name="amount"]`, node => node.value)) === "400", "mahsup tutarı karşı belgenin açığıyla dolu (400)");
    await shot(admin, "mahsup-formu");
    await admin.click(`${modal} form [type="submit"]`);
    await admin.waitForSelector(`${inv} [data-act="offset-remove"]`, { timeout: 8000 });
    pay = (await admin.textContent(`${inv} .hof-inv-pay`)).replace(/\s+/g, " ");
    ok(/Açık: ₺?5\.600,00/.test(pay) && /ödenen ₺?400,00/.test(pay) && /Mahsup · Satış FIS/.test(pay), `mahsup sonrası Açık 5.600 · ödenen 400 · kapatan “Mahsup” (${pay.slice(0, 160)})`);
    await shot(admin, "mahsup-sonrasi-kapatanlar");
    const saleDoc = (await call(admin, `/api/workspace/invoices/${ids.sale}`)).data;
    ok(saleDoc.payState === "paid" && saleDoc.closers[0]?.mode === "offset", "satış faturası Ödendi (mahsup)");
    await closeAll();
    // Cari kartından ödeme: "Kapatılacak Fatura" seçimi.
    await admin.evaluate(id => window.HOF.accounts.open(id), ids.party);
    await admin.waitForSelector(`${modal} [data-entry="out"]`, { timeout: 10000 });
    await admin.click(`${modal} [data-entry="out"]`);
    await admin.waitForSelector(`${modal} select[name="invoiceId"]`, { timeout: 8000 });
    const invoiceOptions = await admin.$$eval(`${modal} select[name="invoiceId"] option`, nodes => nodes.map(node => node.textContent.trim()));
    ok(invoiceOptions[0] === "Otomatik (En Eski Açık Fatura)" && invoiceOptions.some(text => /ALS2026000000089/.test(text)), `ödeme formunda “Kapatılacak Fatura” (${invoiceOptions.join(" | ")})`);
    await admin.selectOption(`${modal} select[name="invoiceId"]`, ids.purchase);
    await admin.fill(`${modal} input[name="amount"]`, "1000");
    await shot(admin, "odeme-kapatilacak-fatura");
    await admin.click(`${modal} form [type="submit"]`);
    await admin.waitForTimeout(1500);
    const ledger = (await admin.textContent(`${modal} .hof-accounts-modal, ${modal}`)).replace(/\s+/g, " ");
    ok(/Faturaya Bağlı/.test(ledger), "cari defterinde ödeme satırı “Faturaya Bağlı” rozetiyle");
    await shot(admin, "cari-defteri-faturaya-bagli");
    await closeAll();
    await admin.evaluate(id => window.HOF.invoices.openDoc(id), ids.purchase);
    await admin.waitForSelector(`${inv} .hof-inv-closers`, { timeout: 10000 });
    pay = (await admin.textContent(`${inv} .hof-inv-pay`)).replace(/\s+/g, " ");
    ok(/Açık: ₺?4\.600,00/.test(pay) && /Bağlı/.test(pay) && /Mahsup/.test(pay), `alış kartında kapatanlar: Mahsup 400 + Bağlı 1.000 → Açık 4.600 (${pay.slice(0, 200)})`);
    await shot(admin, "alis-faturasi-kapatanlar");
    await closeAll();
    const after = { balance: (await account(ids.party)).totals.balance, cash: (await call(admin, "/api/workspace/cash")).data.totals.balance };
    ok(after.balance === before.balance + 1000 && after.cash === before.cash - 1000, `mahsup bakiyeyi/Kasa'yı değiştirmedi; yalnız 1.000 ödeme düştü (bakiye ${before.balance} → ${after.balance}, Kasa ${before.cash} → ${after.cash})`);
  });
} catch (error) {
  console.error("\nHATA:", error.message);
  exitCode = 1;
  await shot(admin, "hata").catch(() => {});
}
if (errors.length) {
  console.log("\nSayfa hataları:", errors);
  exitCode = 1;
}
const passed = results.filter(item => item.ok).length;
console.log(`\n${passed} / ${results.length} kontrol geçti.`);
fs.writeFileSync(path.join(OUT, "sonuc.json"), JSON.stringify({ passed, total: results.length, results, errors }, null, 2));
await browser.close();
await app.close?.();
rmSync(root, { recursive: true, force: true });
process.exit(exitCode);
