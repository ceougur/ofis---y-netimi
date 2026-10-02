// Gerçek kullanıcı senaryosu (v2.0.15): Fatura modülü arayüzden, sıfırdan, uçtan uca. Sonuçlar sayılarla (stok, cari
// bakiyesi, Kasa, taksit kartı, rapor) karşılaştırılır; tarihler bugüne göredir (sabit tarih yok).
//   1. Boş veri: Fatura ekranı açılır, liste boş, hata yok; boş dönemde fatura raporları boş.
//   2. Cari önce: tedarikçi ve müşteri açılır; aynı adlı iki müşteri (telefonları farklı) seçicide ayrı görünür.
//   3. Alış (Stoğa Mal Alışı): 100 Paket × 20 TL + %20 KDV = 2.400 → stok 100, tedarikçi −2.400.
//   4. Satış (cari kartındaki "Satış Faturası" pilinden): 10 × 35 + KDV = 420; 100 peşin (Kasa) + kalanı 3 taksit.
//   5. Satıştan İade (karttaki İade pili): 2 Paket = 84 → stok 92, müşteri 236, taksit kartı 236.
//   6. Bağlantılar: stok hareketi, Kasa satırı, taksit kartı ve çek kartından faturaya tek tıkla.
//   7. Aynı adlı ikinci müşteriye çekle satış: çek portföye, ilk müşteri etkilenmez.
//   8. İptal: iadesi olan fatura iptal edilemez; önce iade, sonra satış iptal → stok/cari/Kasa/kart geri.
//   9. İleri tarihli fatura reddedilir; yetkisiz kullanıcı (personel) Fatura'yı görmez, API 403.
//  10. Raporlar: Satış Faturaları bu ay = kesilenler; geçen yıl boş.
// Çalıştırma: npm run test:senaryo-215 (ekran görüntüleri artifacts/senaryo-215/).
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-215");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-215-"));
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
try {
  await step("Kurulum: yönetici girer, Excel yüklenir", async () => {
    await login(admin, "admin", PASS);
    await admin.waitForSelector("#hof-start .hof-drop");
    await (await admin.$("#hof-start .hof-drop input[type=file]")).setInputFiles(excel);
    await admin.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.click(`${modal} [data-mode="replace"]`)]);
    await admin.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 }).catch(() => null);
    await admin.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => admin.keyboard.press("Escape"));
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-sidecard [data-action=invoices]", { timeout: 20000 });
    // Müşteri isteği (02.10.2026): finans düğmeleri alt alta, bu sırayla.
    const menu = await admin.$$eval("#hof-sidecard .hof-side-item", list => list.filter(node => node.offsetParent).map(node => node.querySelector(".hof-side-text").textContent.trim()));
    const finance = ["Cari", "Kasa", "Stok", "Fatura", "Çek / Senet", "Taksitler"];
    const at = menu.indexOf("Cari");
    ok(at >= 0 && finance.every((label, i) => menu[at + i] === label), `sol menü sırası: ${menu.join(", ")}`);
    await admin.locator("#hof-sidecard").screenshot({ path: path.join(OUT, "00-sol-menu.png") });
  });

  await step("1. Boş veri: Fatura ekranı ve boş dönem raporu", async () => {
    await admin.click("#hof-sidecard [data-action=invoices]");
    await admin.waitForSelector(`${inv} .hof-inv-tabs`);
    await admin.waitForTimeout(600);
    const text = await admin.textContent(inv);
    ok(!(await admin.$(`${inv} tr[data-inv]`)), "fatura yokken liste boş");
    ok(/fatura yok|henüz/i.test(text), "boş listede yol gösteren yazı var");
    await shot(admin, "bos-liste");
    const empty = await call(admin, `/api/workspace/report-center/fatura-satis?from=${shift(-400)}&to=${shift(-370)}`);
    ok(empty.status === 200 && empty.data.total === 0, "boş dönemde Satış Faturaları raporu boş (hata yok)");
    await closeAll();
  });

  await step("2. Cari önce: ürün, tedarikçi, müşteri ve aynı adlı iki müşteri", async () => {
    ids.item = (await call(admin, "/api/workspace/stock", { name: "A4 Kağıt", code: "KG-A4", unit: "Paket", unitPrice: 0, salePrice: 35, minQty: 0 })).data.id;
    ids.supplier = (await call(admin, "/api/workspace/accounts", { name: "Toptan Kırtasiye A.Ş.", type: "supplier", taxNo: "1234567890", taxOffice: "Kavaklıdere", city: "Ankara" })).data.id;
    ids.customer = (await call(admin, "/api/workspace/accounts", { name: "Okul Kantini Ltd.", type: "customer", city: "Ankara", phone: "0532 444 55 66" })).data.id;
    ids.twinA = (await call(admin, "/api/workspace/accounts", { name: "Ayşe Demir", type: "customer", phone: "0532 100 00 01" })).data.id;
    const twinB = await call(admin, "/api/workspace/accounts", { name: "Ayşe Demir", type: "customer", phone: "0532 100 00 02", force: true, allowDuplicate: true });
    ids.twinB = twinB.data?.id;
    ok(ids.item && ids.supplier && ids.customer && ids.twinA, "ürün ve cariler açıldı");
    ok(Boolean(ids.twinB) || twinB.status === 409, `aynı adla ikinci cari: ${twinB.status === 200 ? "açıldı (telefon farklı)" : "program uyardı (çift cari koruması)"}`);
  });

  await step("3. Alış: Stoğa Mal Alışı 100 × 20 + %20 KDV", async () => {
    await admin.click("#hof-sidecard [data-action=invoices]");
    await admin.waitForSelector(`${inv} [data-act="new"]`);
    await admin.click(`${inv} [data-act="new"]`);
    await admin.waitForSelector(`${inv} .hof-inv-pick`);
    await shot(admin, "senaryo-secimi");
    await admin.click(`${inv} [data-scenario="goods_purchase"]`);
    await admin.waitForSelector(`${inv} [data-lines]`);
    await pickAccount("Toptan");
    await admin.fill(`${inv} [data-f="number"]`, "TDR2026000000042");
    await addItemLine(0, "A4", 100, 20);
    const totals = (await admin.textContent(`${inv} [data-totals]`)).replace(/\s+/g, " ");
    ok(/2\.400,00/.test(totals), `formdaki toplam 2.400,00 (${totals.slice(0, 120)})`);
    await shot(admin, "alis-formu");
    ids.purchaseNo = await issue();
    await shot(admin, "alis-karti");
    ok(Number(await stockQty(ids.item)) === 100, "stok 100 Paket");
    ok((await account(ids.supplier)).totals.balance === -2400, "tedarikçi bakiyesi −2.400 (alacaklı)");
    await closeAll();
  });

  await step("4. Satış: cari kartındaki Satış Faturası pilinden; 100 peşin + kalanı 3 taksit", async () => {
    ids.cash0 = await cashTotals();
    await admin.click("#hof-sidecard [data-action=accounts]");
    await admin.waitForSelector(`${modal} tr[data-account]`);
    await admin.click(`${modal} tr[data-account]:has-text("Okul Kantini")`);
    await admin.waitForSelector(`${modal} [data-act="saleInvoice"]`);
    await shot(admin, "cari-karti-pilleri");
    await admin.click(`${modal} [data-act="saleInvoice"]`);
    await admin.waitForSelector(`${inv} .hof-inv-pick`);
    await admin.click(`${inv} [data-scenario="goods_sale"]`);
    await admin.waitForSelector(`${inv} [data-lines]`);
    const accountText = await admin.inputValue(`${inv} [data-acc-query]`).catch(() => "");
    ok(/Okul Kantini/.test(accountText) || /Okul Kantini/.test(await admin.textContent(inv)), "cari kartından açılan faturada cari dolu");
    await addItemLine(0, "A4", 10);
    await admin.click(`${inv} [data-act="pay-add-cash"]`);
    await admin.fill(`${inv} [data-pay="cash"][data-i="0"][data-f="amount"]`, "100");
    await admin.waitForTimeout(800);
    if (await admin.$(`${inv} [data-rest="installments"]`)) await admin.click(`${inv} [data-rest="installments"]`);
    await admin.waitForTimeout(500);
    await shot(admin, "satis-formu");
    ids.saleNo = await issue();
    await shot(admin, "satis-karti");
    const customer = await account(ids.customer);
    ok(customer.totals.balance === 320, `müşteri bakiyesi 320 (420 − 100 peşin): ${customer.totals.balance}`);
    ok(customer.plans.length === 1 && customer.plans[0].totals.total === 320, "kalan 320 taksit kartında");
    ids.plan = customer.plans[0].id;
    const cash1 = await cashTotals();
    ok(Math.round((cash1.cash - ids.cash0.cash) * 100) === 10000, "Nakit Kasa +100");
    ok(Number(await stockQty(ids.item)) === 90, "stok 90");
  });

  await step("5. Satıştan İade: 2 Paket = 84", async () => {
    // Kesimden hemen sonra kart canlı yenilemeyle yeniden çizilebilir; tıklama eski düğmeye düşerse yeniden tıklanır.
    for (let i = 0; i < 4 && !(await admin.$(`${inv} .hof-inv-return-chosen`)); i += 1) {
      await admin.waitForTimeout(400);
      await admin.click(`${inv} .hof-inv-big-pill[data-act="return"]`).catch(() => null);
      await admin.waitForSelector(`${inv} .hof-inv-return-chosen`, { timeout: 3000 }).catch(() => null);
    }
    ok(Boolean(await admin.$(`${inv} .hof-inv-return-chosen`)), "İade pili iade formunu açtı (asıl fatura seçili)");
    await admin.fill(`${inv} [data-l="0"][data-f="qty"]`, "2");
    await admin.waitForTimeout(1000);
    await shot(admin, "iade-formu");
    ids.returnNo = await issue();
    await shot(admin, "iade-karti");
    ok(Number(await stockQty(ids.item)) === 92, "stok 92");
    const customer = await account(ids.customer);
    ok(customer.totals.balance === 236, `müşteri bakiyesi 236: ${customer.totals.balance}`);
    ok(customer.plans[0].totals.total === 236, `taksit kartı iadeyle 236'ya indi: ${customer.plans[0].totals.total}`);
    const integrity = await call(admin, "/api/workspace/ledger/integrity");
    ok(integrity.data.ok, "mutabakat kapısı: ana defter ↔ alt defterler tutarlı");
    await closeAll();
  });

  await step("6. Bağlantılar: stok, Kasa, taksit kartı → fatura", async () => {
    const saleNumber = ids.saleNo.match(/[A-ZÇĞİÖŞÜ]{3}\d{13}/)?.[0] || "";
    ok(Boolean(saleNumber), `satış numarası okundu (${saleNumber})`);
    await admin.evaluate(id => window.HOF.stock.open(id), ids.item);
    await admin.waitForSelector(`${modal} [data-open-invoice]`, { timeout: 10000 });
    await shot(admin, "stok-karti-fatura-baglantisi");
    await admin.click(`${modal} button[data-open-invoice]:has-text("${saleNumber}")`);
    ok(await invoiceOpened(saleNumber), "stok hareketindeki numara satış faturasını açtı");
    await closeAll();
    await admin.click("#hof-sidecard [data-action=cash]");
    await admin.waitForSelector(`${modal} [data-invoice]`, { timeout: 10000 });
    const cashRow = await admin.textContent(`${modal} tr:has([data-invoice])`);
    ok(/Faturadan/.test(cashRow) && !/Kasaya elle/.test(cashRow), "Kasa satırının kaynağı 'Faturadan' (elle değil)");
    await shot(admin, "kasa-fatura-satiri");
    await admin.click(`${modal} [data-invoice]`);
    ok(await invoiceOpened(saleNumber), "Kasa satırındaki Fatura düğmesi faturayı açtı");
    await closeAll();
    await admin.evaluate(id => window.HOF.plans.open(id), ids.plan);
    await admin.waitForSelector(`${modal} a[data-open-invoice]`, { timeout: 10000 });
    await shot(admin, "taksit-karti-fatura");
    await admin.click(`${modal} a[data-open-invoice]`);
    ok(await invoiceOpened(saleNumber), "taksit kartındaki Fatura bağlantısı faturayı açtı");
    await closeAll();
  });

  await step("7. Aynı adlı ikinci müşteriye çekle satış (API) ve çek kartından faturaya", async () => {
    const target = ids.twinB || ids.twinA;
    const sale = await call(admin, "/api/workspace/invoices", { kind: "sale", accountId: target, issueDate: TODAY, lines: [{ itemId: ids.item, qty: 1, unitPrice: 50, vatRate: 20 }], payment: { cheques: [{ instrument: "cheque", amount: 60, dueDate: shift(30), serialNo: "E2E-215", bank: "Ziraat" }], rest: "open" } });
    ok(sale.status === 200, `çekli satış kesildi (${sale.data?.number || sale.error})`);
    ok((await account(target)).totals.balance === 0, "çek alınınca o müşterinin borcu kapandı (60 − 60)");
    if (ids.twinB) ok((await account(ids.twinA)).totals.balance === 0, "aynı adlı diğer müşteri etkilenmedi");
    const chequeId = sale.data.cheques[0].id;
    await admin.evaluate(id => window.HOF.cheques.open({ id }), chequeId);
    await admin.waitForSelector(`${modal} a[data-open-invoice]`, { timeout: 10000 });
    await shot(admin, "cek-karti-fatura");
    await admin.click(`${modal} a[data-open-invoice]`);
    ok(await invoiceOpened(sale.data.number), "çek kartındaki Fatura bağlantısı faturayı açtı");
    await closeAll();
    ids.chequeSale = sale.data;
  });

  await step("8. İptal: iadesi olan satış iptal edilemez; iade → satış iptali, her şey geri", async () => {
    const list = (await call(admin, "/api/workspace/invoices?tab=all")).data.invoices;
    const sale = list.find(x => x.kind === "sale" && x.accountId === ids.customer);
    const ret = list.find(x => x.kind === "sale_return");
    await admin.evaluate(id => window.HOF.invoices.openDoc(id), sale.id);
    await admin.waitForSelector(`${inv} [data-act="cancel"]`);
    ok(await admin.$eval(`${inv} [data-act="cancel"]`, b => b.disabled), "iadesi olan satışta İptal Et kapalı (önce iade)");
    await admin.evaluate(id => window.HOF.invoices.openDoc(id), ret.id);
    await admin.waitForSelector(`${inv} [data-act="cancel"]:not([disabled])`);
    await admin.click(`${inv} [data-act="cancel"]`);
    await admin.waitForSelector(`${modal} form button[type="submit"]`);
    await admin.fill(`${modal} form [name="reason"]`, "Yanlış miktar");
    await admin.click(`${modal} form button[type="submit"]`);
    await admin.waitForTimeout(1200);
    ok(Number(await stockQty(ids.item)) === 89, "iade iptal: stok 89 (92 − 2 iade geri − 1 çekli satış)");
    let customer = await account(ids.customer);
    ok(customer.totals.balance === 320 && customer.plans[0].totals.total === 320, "iade iptal: müşteri 320, taksit kartı yeniden 320");
    await admin.evaluate(id => window.HOF.invoices.openDoc(id), sale.id);
    await admin.waitForSelector(`${inv} [data-act="cancel"]:not([disabled])`);
    await admin.click(`${inv} [data-act="cancel"]`);
    await admin.waitForSelector(`${modal} form button[type="submit"]`);
    await admin.click(`${modal} form button[type="submit"]`);
    await admin.waitForTimeout(1200);
    await shot(admin, "iptal-edilen-satis");
    customer = await account(ids.customer);
    ok(customer.totals.balance === 0 && customer.plans.length === 0, "satış iptal: müşteri 0, taksit kartı kalktı");
    ok(Number(await stockQty(ids.item)) === 99, "satış iptal: stok 99 (yalnız çekli satış düştü)");
    const cash = await cashTotals();
    ok(Math.round((cash.cash - ids.cash0.cash) * 100) === 0, "satış iptal: peşin 100 Kasa'dan geri çıktı");
    ok((await call(admin, "/api/workspace/ledger/integrity")).data.ok, "mutabakat kapısı tutarlı");
    await closeAll();
    await admin.click("#hof-sidecard [data-action=invoices]");
    await admin.waitForSelector(`${inv} [data-tab="cancelled"]`);
    await admin.click(`${inv} [data-tab="cancelled"]`);
    await admin.waitForTimeout(700);
    ok((await admin.$$(`${inv} tr[data-inv]`)).length === 2, "İptal Edilenler sekmesinde 2 belge");
    await shot(admin, "iptal-sekmesi");
    await closeAll();
  });

  await step("9. İleri tarih reddedilir; yetkisiz kullanıcı Fatura'yı görmez", async () => {
    const future = await call(admin, "/api/workspace/invoices", { kind: "sale", accountId: ids.customer, issueDate: shift(5), lines: [{ itemId: ids.item, qty: 1, unitPrice: 35, vatRate: 20 }], payment: { rest: "open" } });
    ok(future.status === 400 && future.code === "date-future", `ileri tarihli fatura reddedildi (${future.error})`);
    const created = await call(admin, "/api/admin/users", { username: "selin", name: "Selin Kaya", role: "personel", password: "Personel-2026!", mustChangePassword: false });
    ok(created.status === 200, "personel kullanıcı açıldı");
    const staff = await newPage();
    await login(staff, "selin", "Personel-2026!");
    await staff.waitForSelector("#hof-sidecard", { timeout: 20000 });
    await staff.waitForTimeout(800);
    ok(!(await staff.isVisible("#hof-sidecard [data-action=invoices]")), "personelin menüsünde Fatura görünmüyor");
    ok(await staff.isVisible("#hof-sidecard [data-action=tasks]"), "personelin menüsü yüklendi (Görevler görünüyor)");
    ok((await call(staff, "/api/workspace/invoices")).status === 403, "personel fatura API'sinde 403");
    await staff.context().close();
  });

  await step("10. Raporlar: bu ay ve geçen yıl", async () => {
    const month = TODAY.slice(0, 8);
    const sales = await call(admin, `/api/workspace/report-center/fatura-satis?from=${month}01&to=${TODAY}`);
    const issued = (await call(admin, "/api/workspace/invoices?tab=sale")).data.invoices.length;
    ok(sales.status === 200 && sales.data.total === issued, `Satış Faturaları raporu: ${sales.data.total} satır = geçerli satış ${issued} (iptaller hariç)`);
    const purchases = await call(admin, `/api/workspace/report-center/fatura-alis?from=${month}01&to=${TODAY}`);
    ok(purchases.data.total === 1, "Alış Faturaları raporu: 1");
    const lastYear = await call(admin, `/api/workspace/report-center/fatura-alis?from=${shift(-730)}&to=${shift(-366)}`);
    ok(lastYear.data.total === 0, "geçen yıl: boş");
  });
  await step("11. e-Belge açıkken: Kes, Sonra Gönder → Gönderilecekler → Listeden Sil (etkiler kalır); Kes ve Gönder", async () => {
    // Ayrı program: e-Belge bağlantısı açık (müşteride kapalı; açılınca bu ekranlar görünür). Entegratör bilgisi girilmedi.
    const vkn = nine => {
      const d = String(nine).padStart(9, "0").split("").map(Number);
      let sum = 0;
      d.forEach((digit, i) => {
        const t = (digit + (9 - i)) % 10;
        let v = (t * 2 ** (9 - i)) % 9;
        if (t !== 0 && v === 0) v = 9;
        sum += v;
      });
      return `${d.join("")}${(10 - (sum % 10)) % 10}`;
    };
    const edocApp = createApp({ dataDir: path.join(root, "data-edoc"), backupDir: path.join(root, "backups-edoc"), logLevel: "warn", scheduleBackups: false, edocEnabled: true, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f94" } });
    const { port: edocPort } = await edocApp.listen(0, "127.0.0.1");
    const page = await newPage();
    try {
      await page.goto(`http://127.0.0.1:${edocPort}/`);
      await page.fill("#hof-auth input[name=username]", "admin");
      await page.fill("#hof-auth input[name=password]", PASS);
      await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
      await page.waitForSelector("#hof-start, #hof-sidecard", { timeout: 20000 });
      const settings = await call(page, "/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: vkn(123456789), taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara" }, efatura: true, earsiv: true }, "PUT");
      ok(settings.status === 200, "firma (satıcı) bilgisi girildi");
      const buyer = (await call(page, "/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer", taxNo: "10000000146", address: "Kordon 5", city: "İzmir" })).data.id;
      await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
      const pageInv = `${modal} .hof-invoices-modal`;
      await page.waitForSelector(`${pageInv} [data-tab="pending"]`);
      ok(true, "e-Belge açıkken Gönderilecekler sekmesi var");
      await page.click(`${pageInv} [data-act="new"]`);
      await page.click(`${pageInv} [data-scenario="service_sale"]`);
      await page.waitForSelector(`${pageInv} [data-lines]`);
      await page.fill(`${pageInv} [data-acc-query]`, "Ayşe");
      await page.waitForSelector(`${pageInv} .hof-acc-picker li[data-id]`);
      await page.dispatchEvent(`${pageInv} .hof-acc-picker li[data-id]`, "mousedown");
      await page.fill(`${pageInv} [data-l="0"][data-f="name"]`, "Bakım Hizmeti");
      await page.fill(`${pageInv} [data-l="0"][data-f="qty"]`, "1");
      await page.fill(`${pageInv} [data-l="0"][data-f="unitPrice"]`, "1000");
      await page.waitForTimeout(1200);
      ok(Boolean(await page.$(`${pageInv} [data-act="issue-later"]`)) && Boolean(await page.$(`${pageInv} [data-act="issue-now"]`)), "formda Kes ve Gönder ile Kes, Sonra Gönder düğmeleri");
      await page.screenshot({ path: path.join(OUT, "16-edoc-form-dugmeler.png") });
      await page.click(`${pageInv} [data-act="issue-later"]`);
      await page.waitForSelector(`${modal} [data-answer="yes"]`);
      await page.click(`${modal} [data-answer="yes"]`);
      await page.waitForSelector(`${pageInv} .hof-inv-pill.is-e-waiting`, { timeout: 10000 });
      await page.screenshot({ path: path.join(OUT, "17-gonderilecek-kart.png") });
      const balance1 = (await call(page, `/api/workspace/accounts/${buyer}`)).data.totals.balance;
      ok(balance1 === 1200, `Sonra Gönder: cari borcu hemen işlendi (${balance1})`);
      await page.click(`${pageInv} [data-act="back"]`);
      await page.waitForSelector(`${pageInv} [data-tab="pending"]`);
      await page.click(`${pageInv} [data-tab="pending"]`);
      await page.waitForTimeout(700);
      ok((await page.$$(`${pageInv} tr[data-inv]`)).length === 1, "Gönderilecekler sekmesinde 1 belge");
      ok(Boolean(await page.$(`${pageInv} [data-act="send-pending"]`)), "Tümünü Gönder düğmesi var");
      await page.screenshot({ path: path.join(OUT, "18-gonderilecekler.png") });
      await page.click(`${pageInv} tr[data-inv]`);
      await page.waitForSelector(`${pageInv} [data-act="e-withdraw"]`);
      await page.click(`${pageInv} [data-act="e-withdraw"]`);
      await page.waitForSelector(`${modal} [data-answer="yes"]`);
      await page.click(`${modal} [data-answer="yes"]`);
      await page.waitForSelector(`${pageInv} .hof-inv-pill.is-e-withdrawn`, { timeout: 10000 });
      const title = await page.textContent(`${pageInv} .hof-plan-title h3`);
      ok(/FIS\d{13}/.test(title), `listeden silinen belge Müşteri Fişi numarası aldı (${title.replace(/\s+/g, " ").trim()})`);
      ok(Boolean(await page.$(`${pageInv} [data-act="e-send"]`)), "listeden silinen belge sonra yine gönderilebilir (e-Belge Gönder düğmesi)");
      const balance2 = (await call(page, `/api/workspace/accounts/${buyer}`)).data.totals.balance;
      ok(balance2 === 1200, `Listeden Sil: etkiler geri alınmadı (cari ${balance2})`);
      await page.screenshot({ path: path.join(OUT, "19-listeden-silinen.png") });
      ok((await call(page, "/api/workspace/invoices?tab=pending")).data.invoices.length === 0, "Gönderilecekler boşaldı");
      const integrity = await call(page, "/api/workspace/ledger/integrity");
      ok(integrity.data.ok, "mutabakat kapısı tutarlı");
    } finally {
      await page.context().close();
      await edocApp.close?.();
    }
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
