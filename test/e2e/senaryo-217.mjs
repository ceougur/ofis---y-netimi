// Gerçek kullanıcı senaryosu (v2.0.17): müşterinin bildirdiği maddeler arayüzden, sıfırdan, uçtan uca. Tarihler bugüne
// göredir (sabit tarih yok). Her maddenin kanıtı bir kontrol ve ekran görüntüsüdür (artifacts/senaryo-217/).
//   5. Hayalet kısmi ödeme: aynı cariye satış 400 + alış 6.000 → alış "Açık" (ödenen 0); kartta "Bu Faturayı Kapatanlar";
//      Mahsup Et (satış ↔ alış) → "Mahsup" rozeti; cari kartından ödeme "Kapatılacak Fatura" ile → "Bağlı"; bakiye/Kasa aynı.
//   7. Eksi stok: soru "Kayıttan sonra stok: −15 Adet olacak"; rozet "Eksi Stok −20 Adet"; "Eksi Stoktakiler" süzgeci; Değer
//      eksi miktar × maliyet; ANLIK DURUM "Eksi stok: n ürün"; fatura kaleminde kırmızı; raporda "Eksi (−20 Adet)".
//  10. İade faturası düzenlenir (3 → 5 adet, aynı numara; kalan iade edilebilir kendi iadesi hariç); pasif düğmelerin
//      nedeni kartta yazılı; satıştan iadede karta iade "POS İadesi".
//   1. Fatura Sil: kartta Sil (kaydedilmiş belge; etkiler geri alınır), listede Seçilenleri Sil (n) (iptal edilmişler komple),
//      onay penceresinde sayı/tutar, Silinenler'de (Yönetim → Silinenler → Faturalar).
//   8. Çek ciro: cari seçici tür kısıtsız (Müşteri türündeki cari bulunur, tür rozeti), "+ Yeni Cari", boş sonuç metni.
//   2+3+13+6. Çoklu şirket: sol üst "Şirket · 001 · Unvan" seçici (oturum seçici kalktı), 002 sıfırdan açılır, ortada sayfa
//      şeridi ("+ Sayfa": Excel / Google Sheets / Boş Sayfa), Yönetim → Şirketler (liste, yetki, birleşik rapor, Verisini
//      Sıfırla kod + parola onayıyla), 001'e dönüşte sayılar aynı.
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
  await step("7. Eksi stok: 0 → −10 → −15 → −20 arayüzden; soru sonucu söyler; rozet, süzgeç, kart, ANLIK DURUM, fatura kalemi", async () => {
    ids.tea = (await call(admin, "/api/workspace/stock", { name: "Çay 1 Kg", code: "CAY-1", unit: "Adet", unitPrice: 50, salePrice: 80 })).data.id;
    await admin.evaluate(id => window.HOF.stock.open(id), ids.tea);
    await admin.waitForSelector(`${modal} [data-move="out"]`, { timeout: 10000 });
    for (const [qty, expected] of [["10", "-10"], ["5", "-15"], ["5", "-20"]]) {
      await admin.click(`${modal} [data-move="out"]`);
      await admin.waitForSelector(`${modal} form input[name="qty"]`, { timeout: 8000 });
      await admin.fill(`${modal} form input[name="qty"]`, qty);
      await admin.click(`${modal} form [type="submit"]`);
      await admin.waitForSelector(`${modal} [data-answer="yes"]`, { timeout: 8000 });
      const question = (await admin.$$eval(`${modal} .hof-modal-text`, nodes => nodes.map(node => node.textContent).join(" "))).replace(/\s+/g, " ").replace(/\u2212/g, "-");
      ok(new RegExp(`Kayıttan sonra stok: ${expected} Adet olacak`).test(question), `soru sonucu söyler: “Kayıttan sonra stok: ${expected} Adet olacak” (${question.slice(0, 120)})`);
      if (qty === "10") await shot(admin, "eksi-stok-sorusu");
      await admin.click(`${modal} [data-answer="yes"]`);
      await admin.waitForFunction(([selector, text]) => (document.querySelector(selector)?.textContent || "").replace(/\u2212/g, "-").includes(text), [`${modal} .hof-kpis`, `${expected} Adet`], { timeout: 8000 });
    }
    const card = (await admin.textContent(`${modal}`)).replace(/\s+/g, " ").replace(/\u2212/g, "-");
    ok(/Eksi Stok -20 Adet/.test(card) && /Mevcut \(Eksi Stok\)/.test(card), "kartta “Eksi Stok −20 Adet” rozeti ve Mevcut (Eksi Stok)");
    await shot(admin, "stok-karti-eksi");
    await admin.click(`${modal} [data-act="back"]`);
    await admin.waitForSelector(`${modal} [data-state="negative"]`, { timeout: 8000 });
    await admin.click(`${modal} [data-state="negative"]`);
    await admin.waitForFunction(selector => document.querySelector(selector)?.getAttribute("aria-pressed") === "true", `${modal} [data-state="negative"]`, { timeout: 8000 });
    await admin.waitForFunction(selector => document.querySelectorAll(selector).length === 1, `${modal} tbody tr[data-item]`, { timeout: 8000 });
    const rows = await admin.$$eval(`${modal} tbody tr[data-item]`, nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ").replace(/\u2212/g, "-")));
    ok(rows.length === 1 && /Eksi Stok -20 Adet/.test(rows[0]) && /[-\u2010-\u2015\u2212]₺?1\.000,00/.test(rows[0]), `“Eksi Stoktakiler” süzgeci: yalnız çay, rozet −20, Değer −1.000 (${rows.length} satır: ${rows.map(row => row.slice(0, 90)).join(" | ")})`);
    const kpi = (await admin.textContent(`${modal} .hof-kpis`)).replace(/\s+/g, " ");
    ok(/1 ?Eksi Stokta/.test(kpi), `liste göstergesi “Eksi Stokta: 1” (${kpi.slice(0, 80)})`);
    await shot(admin, "stok-listesi-eksi-suzgec");
    await closeAll();
    const pulse = (await admin.textContent("#hof-pulse [data-pulse-go='stock']")).replace(/\s+/g, " ");
    ok(/Eksi stok: 1 ürün/.test(pulse), `ANLIK DURUM: “Eksi stok: 1 ürün” (${pulse})`);
    // Fatura kaleminde eksi stok kırmızı yazar.
    await admin.click("#hof-sidecard [data-action=invoices]");
    await admin.waitForSelector(`${inv} [data-act="new"]`);
    await admin.click(`${inv} [data-act="new"]`);
    await admin.click(`${inv} [data-scenario="goods_sale"]`);
    await admin.waitForSelector(`${inv} [data-lines]`);
    await admin.click(`${inv} [data-l="0"][data-f="name"]`);
    await admin.keyboard.type("Çay");
    await admin.waitForSelector(`${inv} [data-hits="0"] li[data-item]`);
    const hit = await admin.$eval(`${inv} [data-hits="0"] li[data-item]`, node => ({ text: node.textContent.replace(/\s+/g, " ").replace(/\u2212/g, "-"), red: Boolean(node.querySelector(".hof-inv-warn")) }));
    ok(/Stokta -20 Adet/.test(hit.text) && hit.red, `fatura kalem önerisinde “Stokta −20 Adet” kırmızı (${hit.text.slice(0, 60)})`);
    await admin.click(`${inv} [data-hits="0"] li[data-item]`);
    await admin.waitForTimeout(600);
    const note = await admin.$eval(`${inv} [data-lines]`, node => ({ text: node.textContent.replace(/\s+/g, " ").replace(/\u2212/g, "-"), red: Boolean(node.querySelector(".hof-inv-warn")) }));
    ok(/Stokta -20 Adet \(eksi\)/.test(note.text) && note.red, "kalem satırında “Stokta −20 Adet (eksi)” kırmızı");
    await shot(admin, "fatura-kalemi-eksi-stok");
    await closeAll();
    const report = (await call(admin, "/api/workspace/report-center/stok-durumu?state=negative")).data;
    ok(report.rows.length === 1 && report.rows[0].at(-1) === "Eksi (-20 Adet)", `Stok Durumu raporunda durum “Eksi (−20 Adet)” (${report.rows[0].at(-1)})`);
  });

  await step("10. İade faturası düzenlenir; pasif düğme nedeni ekranda; karta iade 'POS İadesi'", async () => {
    const sale = await call(admin, "/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.party, issueDate: shift(-3), lines: [{ itemId: ids.item, qty: 10, unitPrice: 100, vatRate: 0 }], payment: { cash: [{ amount: 1000, method: "card" }], rest: "open" }, force: true });
    const ret = await call(admin, "/api/workspace/invoices", { kind: "sale_return", originalId: sale.data.id, issueDate: shift(-1), lines: [{ originLineId: sale.data.lines[0].id, qty: 3 }], payment: { cash: [{ amount: 300, method: "card" }], rest: "open" } });
    ok(sale.status === 200 && ret.status === 200, "satış 10 adet (POS 1.000) ve 3 adetlik satıştan iade (karta 300) kaydedildi");
    await admin.evaluate(id => window.HOF.invoices.openDoc(id), ret.data.id);
    await admin.waitForSelector(`${inv} [data-act="modify"]`, { timeout: 10000 });
    ok(!(await admin.$eval(`${inv} [data-act="modify"]`, node => node.disabled)), "iade kartında Düzenle AKTİF");
    const pay = (await admin.textContent(`${inv} .hof-inv-pay`)).replace(/\s+/g, " ");
    ok(/Ödeme \(POS İadesi\)/.test(pay), `karta iade satırı “Ödeme (POS İadesi)” (${pay.slice(0, 60)})`);
    await shot(admin, "iade-karti-duzenle-aktif");
    await admin.click(`${inv} [data-act="modify"]`);
    await admin.waitForSelector(`${inv} [data-l="0"][data-f="qty"]`, { timeout: 8000 });
    const title = (await admin.textContent(`${inv} .hof-inv-form-title, ${inv} h3`)).replace(/\s+/g, " ");
    ok(/Düzenleme/.test(title), `düzenleme formu açıldı (${title.slice(0, 60)})`);
    const hint = (await admin.textContent(`${inv} [data-lines]`)).replace(/\s+/g, " ");
    ok(/En çok 10 /.test(hint), `kalan iade edilebilir miktar kendi iadesi hariç (10) (${hint.slice(0, 100)})`);
    await admin.fill(`${inv} [data-l="0"][data-f="qty"]`, "5");
    await admin.waitForTimeout(900);
    const methods = await admin.$$eval(`${inv} [data-pay="cash"][data-f="method"] option`, nodes => nodes.map(node => node.textContent.trim()));
    ok(methods.includes("POS İadesi") && !methods.includes("Kredi Kartı"), `iade formunda yol seçenekleri: ${methods.join(" / ")}`);
    await shot(admin, "iade-duzenleme-formu");
    await admin.click(`${inv} [data-act="issue"]`);
    await confirmYes();
    await admin.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 10000 });
    const after = (await call(admin, `/api/workspace/invoices/${ret.data.id}`)).data;
    ok(after.lines[0].qty === 5 && after.number === ret.data.number, `iade 3 → 5 adet, numara aynı (${after.number})`);
    ok((await call(admin, `/api/workspace/invoices/${sale.data.id}`)).data.returnable[0].left === 5, "asıl faturanın iade edilebilir kalanı 5");
    await closeAll();
    // Asıl faturada Düzenle ve İptal Et kapalı; nedeni ekranda yazılı.
    await admin.evaluate(id => window.HOF.invoices.openDoc(id), sale.data.id);
    await admin.waitForSelector(`${inv} .hof-inv-blocks`, { timeout: 10000 });
    const blocks = (await admin.textContent(`${inv} .hof-inv-blocks`)).replace(/\s+/g, " ");
    ok(/Düzenle kapalı:.*iade faturası var/.test(blocks) && /İptal Et kapalı:/.test(blocks), `pasif düğmelerin nedeni ekranda (${blocks.slice(0, 140)})`);
    await shot(admin, "pasif-dugme-nedeni");
    await closeAll();
  });

  await step("1. Fatura Sil: kartta Sil; listede Seçilenleri Sil (n); iptal edilmişler komple silinir; Silinenler'de görünür", async () => {
    // Müşterinin ekranı: hepsi "İptal Edildi" 3 belge + 1 kaydedilmiş.
    const made = [];
    for (let i = 0; i < 3; i += 1) {
      const doc = await call(admin, "/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.party, issueDate: shift(-2), lines: [{ itemId: ids.item, qty: 1, unitPrice: 50, vatRate: 0 }], payment: { rest: "open" }, force: true });
      await call(admin, `/api/workspace/invoices/${doc.data.id}/cancel`, { reason: "deneme" });
      made.push(doc.data.id);
    }
    const keep = await call(admin, "/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.party, issueDate: shift(-1), lines: [{ itemId: ids.item, qty: 2, unitPrice: 50, vatRate: 0 }], payment: { rest: "open" }, force: true });
    ok(made.length === 3 && keep.status === 200, "3 iptal edilmiş + 1 kaydedilmiş satış hazır");
    const stock0 = await stockQty(ids.item);
    // Kartta Sil (kaydedilmiş belge): etkiler geri alınır.
    await admin.evaluate(id => window.HOF.invoices.openDoc(id), keep.data.id);
    await admin.waitForSelector(`${inv} [data-act="delete"]`, { timeout: 10000 });
    ok(!(await admin.$eval(`${inv} [data-act="delete"]`, node => node.disabled)) && (await admin.textContent(`${inv} [data-act="delete"]`)).trim() === "Sil", "kaydedilmiş belgenin kartında “Sil” düğmesi aktif");
    await admin.click(`${inv} [data-act="delete"]`);
    await admin.waitForSelector(`${modal} input[name="reason"]`, { timeout: 8000 });
    const intro = (await admin.textContent(`${modal} .hof-modal-text`)).replace(/\s+/g, " ");
    ok(/Bütün etkileri birlikte geri alınır/.test(intro) && /Silinenler/.test(intro), "silme penceresi etkileri ve Silinenler'i söyler");
    await shot(admin, "fatura-sil-penceresi");
    await admin.fill(`${modal} input[name="reason"]`, "yanlış belge");
    await admin.click(`${modal} form [type="submit"]`);
    await admin.waitForTimeout(1500);
    ok((await call(admin, `/api/workspace/invoices/${keep.data.id}`)).status === 404, "belge listeden kalktı (404)");
    ok((await stockQty(ids.item)) === stock0 + 2, "silinen satışın 2 adedi stoğa geri döndü");
    // Listede toplu: Tümü sekmesinde iptal edilmişleri seç → Seçilenleri Sil (3).
    await admin.waitForSelector(`${inv} [data-tab="all"]`, { timeout: 8000 });
    await admin.click(`${inv} [data-tab="all"]`);
    await admin.waitForTimeout(800);
    for (const id of made) {
      await admin.waitForSelector(`${inv} input[data-sel="${id}"]`, { timeout: 8000 });
      await admin.check(`${inv} input[data-sel="${id}"]`);
    }
    await admin.waitForSelector(`${inv} [data-act="bulk-delete"]`, { timeout: 8000 });
    const label = (await admin.textContent(`${inv} [data-act="bulk-delete"]`)).trim();
    ok(/Seçilenleri Sil \(3\)/.test(label), `seçim çubuğunda “${label}”`);
    await shot(admin, "secilenleri-sil");
    await admin.click(`${inv} [data-act="bulk-delete"]`);
    await admin.waitForSelector(`${modal} form [type="submit"]`, { timeout: 8000 });
    const bulkIntro = (await admin.textContent(`${modal} .hof-modal-text`)).replace(/\s+/g, " ");
    ok(/3 iptal edilmiş/.test(bulkIntro) && /toplam ₺?150,00/.test(bulkIntro), `onay penceresinde sayı ve tutar (${bulkIntro.slice(0, 80)})`);
    await admin.click(`${modal} form [type="submit"]`);
    await admin.waitForTimeout(1500);
    const left = (await call(admin, "/api/workspace/invoices?tab=all&limit=100")).data.invoices.filter(doc => made.includes(doc.id));
    ok(left.length === 0, "iptal edilmiş 3 belge komple silindi");
    const trash = (await call(admin, "/api/admin/trash")).data.filter(item => item.kind === "invoice");
    ok(trash.length >= 4 && trash.every(item => /Satış Faturası/.test(item.title)), `Silinenler'de ${trash.length} fatura (geri yüklenebilir)`);
    await closeAll();
    // Yönetim → Silinenler → Faturalar süzgeci.
    await admin.goto(`${BASE}/admin.html#trash`, { waitUntil: "load" });
    await admin.click('.adm-tabs [data-tab="trash"]').catch(() => null);
    await admin.waitForSelector("#adm-trash tr[data-id]", { timeout: 10000 });
    await admin.selectOption("#adm-trash-kind", "invoice");
    await admin.waitForTimeout(500);
    const rows = await admin.$$eval("#adm-trash tr[data-id]", nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ")));
    ok(rows.length >= 4 && rows.every(row => /Fatura/.test(row)), `Yönetim → Silinenler → Faturalar: ${rows.length} satır`);
    await shot(admin, "yonetim-silinenler-faturalar");
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-sidecard [data-action=invoices]", { timeout: 20000 });
  });

  await step("8. Çek ciro: yalnız Müşteri türünde carisi olan veride ciro seçicisi cariyi bulur; + Yeni Cari; ciro sonrası durum", async () => {
    ids.other = (await call(admin, "/api/workspace/accounts", { name: "Veli Market", type: "customer" })).data.id;
    const cheque = (await call(admin, "/api/workspace/cheques", { instrument: "cheque", direction: "in", accountId: ids.party, drawer: "Mehmet Eren Demir", amount: 3000, issueDate: TODAY, dueDate: shift(30), serialNo: "CK-217", bank: "Ziraat" })).data;
    ok(cheque?.status === "portfolio", "3.000 TL çek portföye alındı");
    await admin.evaluate(id => window.HOF.cheques.open({ id }), cheque.id);
    await admin.waitForSelector(`${modal} [data-action="endorse"]`, { timeout: 10000 });
    await admin.click(`${modal} [data-action="endorse"]`);
    await admin.waitForSelector(`${modal} .hof-acc-picker [data-acc-query]`, { timeout: 8000 });
    const label = (await admin.textContent(`${modal} .hof-acc-picker > span`)).replace(/\s+/g, " ").trim();
    ok(/^Ciro Edilen Cari/.test(label) && /Yeni Cari/.test(label), `etiket “Ciro Edilen Cari” + “+ Yeni Cari” (${label})`);
    await admin.fill(`${modal} .hof-acc-picker [data-acc-query]`, "Veli");
    // Arama sonucu gecikmeli gelir: "Veli Market" satırı listelenene kadar beklenir (ilk satır varsayılan liste olabilir).
    await admin.waitForFunction(sel => [...document.querySelectorAll(`${sel} .hof-acc-picker li[data-id]`)].some(li => /Veli Market/.test(li.textContent)), modal, { timeout: 8000 });
    const hit = (await admin.$$eval(`${modal} .hof-acc-picker li[data-id]`, nodes => nodes.map(li => li.textContent).find(text => /Veli Market/.test(text)) || "")).replace(/\s+/g, " ");
    ok(/Veli Market/.test(hit) && /Müşteri/.test(hit), `Müşteri türündeki cari listede, tür rozetiyle (${hit.slice(0, 80)})`);
    await shot(admin, "ciro-cari-secici");
    await admin.fill(`${modal} .hof-acc-picker [data-acc-query]`, "Olmayan Firma");
    await admin.waitForSelector(`${modal} .hof-acc-picker li.is-empty`, { timeout: 8000 });
    const empty = (await admin.textContent(`${modal} .hof-acc-picker li.is-empty`)).replace(/\s+/g, " ");
    ok(/Bu adla cari yok/.test(empty) && /Yeni Cari/.test(empty), `boş sonuçta “Bu adla cari yok — + Yeni Cari” (${empty})`);
    await admin.fill(`${modal} .hof-acc-picker [data-acc-query]`, "Veli");
    await admin.waitForSelector(`${modal} .hof-acc-picker li[data-id]`, { timeout: 8000 });
    await admin.evaluate(sel => [...document.querySelectorAll(`${sel} .hof-acc-picker li[data-id]`)].find(li => /Veli Market/.test(li.textContent))?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })), modal);
    await admin.click(`${modal} form [type="submit"]`);
    await admin.waitForTimeout(1500);
    const after = (await call(admin, `/api/workspace/cheques/${cheque.id}`)).data;
    ok(after.status === "endorsed" && after.endorseAccountId === ids.other, `çek “Ciro Edildi”, ciro edilen cari Veli Market (${after.statusLabel || after.status})`);
    ok((await account(ids.other)).totals.balance === 3000, "ciro edilen carinin bakiyesi 3.000 borçlu (borç ödemesi olarak düşer)");
    await shot(admin, "ciro-sonrasi");
    await closeAll();
  });
  await step("2+3+13+6. Çoklu şirket arayüzden: sol üst şirket seçici, 002 açılır (sıfırdan), sayfa şeridi, Yönetim → Şirketler (yetki, sıfırla), 001'e dönüş", async () => {
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-company [data-toggle]", { timeout: 20000 });
    const label = (await admin.textContent("#hof-company .hof-session-text strong")).trim();
    ok(/^001 · /.test(label), `sol üstte şirket seçici “${label}” (001 · unvan)`);
    ok(!(await admin.$("#hof-session")), "eski “Çalışma Oturumu” seçicisi yok");
    const pageWord = await admin.evaluate(() => document.querySelector(".sidebar")?.textContent || "");
    ok(!/Çalışma Oturumu|Oturumları Yönet|Yeni Oturum/.test(pageWord), "sol menüde “Çalışma Oturumu / Oturumları Yönet” kalmadı");
    // Sayfa şeridi ortada; "+ Sayfa" menüsünde Excel / Google Sheets / Boş Sayfa.
    await admin.waitForSelector("#hof-pages [data-add]", { timeout: 10000 });
    const pagesTop = await admin.$eval("#hof-pages", node => node.getBoundingClientRect().left);
    const sidebarRight = await admin.$eval(".sidebar", node => node.getBoundingClientRect().right);
    ok(pagesTop > sidebarRight, "sayfa şeridi orta alanda (kenar çubuğunun sağında)");
    await admin.click("#hof-pages [data-add]");
    const menuItems = await admin.$$eval("#hof-pages .hof-pages-menu [data-add-source] b", nodes => nodes.map(node => node.textContent));
    ok(menuItems.join("|") === "Excel'den Aktar|Google Sheets'ten Aktar|Boş Sayfa", `+ Sayfa menüsü: ${menuItems.join(" / ")}`);
    await shot(admin, "sayfa-seridi-menu");
    await admin.keyboard.press("Escape");
    const cashBefore = (await call(admin, "/api/workspace/cash")).data.totals.balance;
    const accountsBefore = (await call(admin, "/api/workspace/accounts")).data.accounts.length;
    // Yeni şirket seçiciden açılır ve seçilir; ekran o şirketle yeniden gelir.
    await admin.click("#hof-company [data-toggle]");
    await admin.waitForSelector("#hof-company .hof-session-menu:not([hidden])");
    await admin.click("#hof-company [data-new]");
    await admin.waitForSelector(`${modal} input[name="code"]`);
    ok((await admin.inputValue(`${modal} input[name="code"]`)) === "002", "sıradaki kod 002 önerildi");
    await admin.fill(`${modal} input[name="name"]`, "Gayri Resmi Ltd.");
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.click(`${modal} form [type="submit"]`)]);
    await admin.waitForSelector("#hof-company .hof-session-text strong", { timeout: 20000 });
    await admin.waitForFunction(() => /^002 · /.test(document.querySelector("#hof-company .hof-session-text strong")?.textContent || ""), null, { timeout: 10000 });
    ok(true, "002 · Gayri Resmi Ltd. seçildi; ekran yeniden açıldı");
    ok((await call(admin, "/api/workspace/accounts")).data.accounts.length === 0 && (await call(admin, "/api/workspace/cash")).data.totals.balance === 0, "002 sıfırdan: cari yok, Kasa 0");
    await admin.waitForSelector("#hof-start", { timeout: 15000 });
    ok(!(await admin.$("#hof-pages")), "002'de veri yok: başlangıç ekranı; sayfa şeridi boş veriyle gizli");
    await shot(admin, "sirket-002-bos");
    // Sol alttaki senkron kartında şirket satırı.
    const line = await admin.$eval(".sync-card .hof-company-line", node => node.textContent).catch(() => "");
    ok(/^002 · /.test(line), `senkron kartında şirket satırı “${line}”`);
    // Yönetim → Şirketler: liste, yetki tablosu, birleşik rapor, sıfırlama.
    await admin.goto(`${BASE}/admin.html#companies`, { waitUntil: "load" });
    await admin.waitForSelector('.adm-panel[data-panel="companies"]:not([hidden]) #adm-companies tr[data-company]', { timeout: 20000 });
    const codes = await admin.$$eval("#adm-companies tr[data-company] td:first-child", nodes => nodes.map(node => node.textContent.trim()));
    ok(codes.join(",") === "001,002", `Yönetim → Şirketler listesi: ${codes.join(", ")}`);
    await admin.waitForSelector("#adm-company-access thead th", { timeout: 10000 });
    await admin.click("#adm-company-report");
    await admin.waitForSelector("#adm-company-report-out tfoot", { timeout: 15000 });
    const foot = (await admin.textContent("#adm-company-report-out tfoot")).replace(/\s+/g, " ");
    ok(/TOPLAM/.test(foot) && cell(foot, "TOPLAM") !== null, `birleşik rapor toplam satırı (${foot.slice(0, 60)}…)`);
    await shot(admin, "yonetim-sirketler");
    // 002'de bir hareket girilir, "Verisini Sıfırla" ile silinir (onay kod + parola), 001 etkilenmez.
    await call(admin, "/api/workspace/cash", { kind: "in", amount: 777, date: TODAY, description: "002 deneme" });
    ok((await call(admin, "/api/workspace/cash")).data.totals.balance === 777, "002 Kasa 777");
    await admin.click('#adm-companies tr[data-company]:nth-child(2) [data-c-reset]');
    await admin.waitForSelector(`${modal} input[name="confirm"]`);
    await admin.fill(`${modal} input[name="confirm"]`, "002");
    await admin.fill(`${modal} input[name="password"]`, PASS);
    await admin.click(`${modal} form [type="submit"]`);
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => /sıfırlandı/.test(node.textContent)), null, { timeout: 15000 });
    ok((await call(admin, "/api/workspace/cash")).data.totals.balance === 0, "sıfırlama sonrası 002 Kasa 0");
    // 001'e dönüş: eski sayılar aynen.
    await admin.click('#adm-companies tr[data-company]:nth-child(1) [data-c-select]');
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => /geçildi/.test(node.textContent)), null, { timeout: 10000 });
    ok((await call(admin, "/api/workspace/cash")).data.totals.balance === cashBefore && (await call(admin, "/api/workspace/accounts")).data.accounts.length === accountsBefore, `001 verisi aynı (Kasa ${cashBefore}, ${accountsBefore} cari)`);
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForFunction(() => /^001 · /.test(document.querySelector("#hof-company .hof-session-text strong")?.textContent || ""), null, { timeout: 20000 });
    await admin.waitForSelector("#hof-pages .hof-page.is-current", { timeout: 10000 });
    await shot(admin, "sirket-001-geri");
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
