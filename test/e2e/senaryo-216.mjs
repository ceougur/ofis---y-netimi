// Gerçek kullanıcı senaryosu (v2.0.16): müşterinin bildirdiği 11 madde arayüzden, sıfırdan, uçtan uca. Tarihler bugüne
// göredir (sabit tarih yok). Her maddenin kanıtı bir kontrol ve ekran görüntüsüdür (artifacts/senaryo-216/).
//   1. Stok kartı: Stok Kodu en üstte; aynı kod ikinci ürüne verilmez.
//   2. Alış formu: Stok Kodu kolonu + barkod (kod yazıp Enter) ürünü seçer; öneri listesi kırpılmaz (tam görünür);
//      KDV kutusunda "%20" sığar; "Tüm Kalemlere KDV"; stokta olmayan ada "+ Yeni Stok Kartı" (kart kayıtla açılır);
//      düğme "Faturayı Kaydet" (kes yok); kartta Stok Kodu kolonu, "Alış Faturası - PDF".
//   3. Satış: KDV dahil 2.000, %10 iskonto → Toplam 1.666,67 − İskonto 166,67 = Ara Toplam 1.500; KDV 300; 1.800.
//      İskontosuz KDV dahil 16.500 → Toplam 16.500 · Ara Toplam 13.750 · KDV 2.750. Tahsilat yolunda "POS" (kredi kartı yok).
//   4. Düzenle: kaydedilmiş satış kartında Düzenle → miktar değişir → Değişiklikleri Kaydet; numara aynı, cari ve stok yeni.
//   5. Cari kartı: "Cari Ekstre - PDF"; tahsilatta POS, ödemede Kredi Kartı.
//   6. Raporlar: HER rapor arayüzden açılır (ön izleme), PDF ve Excel bağlantısı gerçek dosya döndürür; yalnız Cari Ekstre
//      cari ister (seçince açılır). Fatura raporları cari seçmeden açılır (müşterinin kritik bildirimi).
// Çalıştırma: npm run test:senaryo-216
// Çalıştırma: npm run test:senaryo-216 (ekran görüntüleri artifacts/senaryo-216/).
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-216");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-216-"));
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
    ids.supplier = (await call(admin, "/api/workspace/accounts", { name: "Toptan Kırtasiye A.Ş.", type: "supplier", taxNo: "1234567890", taxOffice: "Kavaklıdere" })).data.id;
    ids.customer = (await call(admin, "/api/workspace/accounts", { name: "Okul Kantini Ltd.", type: "customer", phone: "0532 444 55 66" })).data.id;
    ok(ids.supplier && ids.customer, "tedarikçi ve müşteri açıldı");
  });

  await step("1. Stok kartı: Stok Kodu en üstte; aynı kod ikinci ürüne verilmez", async () => {
    await admin.click("#hof-sidecard [data-action=stock]");
    await admin.waitForSelector(`${modal} [data-act="new"]`);
    ok(/Stok Kodu/.test(await admin.textContent(`${modal} .hof-plans-filters`).catch(() => "")) || /Stok Kodu/.test(await admin.getAttribute(`${modal} [data-filter="q"]`, "placeholder")), "stok aramasında Stok Kodu");
    await admin.click(`${modal} [data-act="new"]`);
    await admin.waitForSelector(`${modal} [name="code"]`);
    const order = await admin.$$eval(`${modal} form [name]`, nodes => nodes.map(node => node.name));
    ok(order.indexOf("code") >= 0 && order.indexOf("code") < order.indexOf("name"), `Stok Kodu ürün adından önce (${order.slice(0, 4).join(", ")})`);
    const label = await admin.$eval(`${modal} [name="code"]`, node => node.closest("label, .hof-field")?.textContent || "");
    ok(/Stok Kodu/.test(label), "alan adı “Stok Kodu”");
    await admin.fill(`${modal} [name="code"]`, "FK-A4");
    await admin.fill(`${modal} [name="name"]`, "Fotokopi Kağıdı A4");
    await admin.fill(`${modal} [name="salePrice"]`, "150");
    await shot(admin, "stok-karti-formu");
    await admin.click(`${modal} form [type="submit"]`);
    await admin.waitForTimeout(1200);
    const items = (await call(admin, "/api/workspace/stock")).data.items;
    ids.item = items.find(item => item.code === "FK-A4")?.id;
    ok(Boolean(ids.item), "ürün Stok Kodu ile açıldı");
    const twin = await call(admin, "/api/workspace/stock", { name: "Fotokopi Kağıdı A3", code: "fk-a4", unit: "Paket" });
    ok(twin.status === 409 && /Stok Kodu/.test(twin.error || ""), `aynı kod ikinci ürüne verilmez (${twin.error})`);
    await closeAll();
  });

  await step("2. Alış formu: barkod, kırpılmayan öneri listesi, KDV kutusu, Tüm Kalemlere KDV, + Yeni Stok Kartı, Faturayı Kaydet", async () => {
    await admin.click("#hof-sidecard [data-action=invoices]");
    await admin.waitForSelector(`${inv} [data-act="new"]`);
    await admin.click(`${inv} [data-act="new"]`);
    await admin.click(`${inv} [data-scenario="goods_purchase"]`);
    await admin.waitForSelector(`${inv} [data-lines]`);
    await pickAccount("Toptan");
    await admin.fill(`${inv} [data-f="number"]`, "TDR2026000000099");
    ok(/Stok Kodu/.test(await admin.textContent(`${inv} .hof-inv-lines thead`)), "kalem tablosunda Stok Kodu kolonu");
    // Barkod okuyucu: kodu yazar ve Enter'a basar.
    await admin.click(`${inv} [data-l="0"][data-f="code"]`);
    await admin.keyboard.type("fk-a4");
    await admin.keyboard.press("Enter");
    await admin.waitForFunction(selector => document.querySelector(selector)?.value === "Fotokopi Kağıdı A4", `${inv} [data-l="0"][data-f="name"]`, { timeout: 5000 });
    ok((await admin.$eval(`${inv} [data-l="0"][data-f="code"]`, node => node.value)) === "FK-A4", "Stok Kodu + Enter (barkod) ürünü seçti; kutuda kartın kodu (FK-A4)");
    ok(!/\$\{/.test(await admin.textContent(`${inv} .hof-inv-lines-wrap`)), "kalem bölümünde ham kod yazısı yok");
    await admin.fill(`${inv} [data-l="0"][data-f="qty"]`, "100");
    await admin.fill(`${inv} [data-l="0"][data-f="unitPrice"]`, "90");
    // Çok kalemli fatura: öneri listesi tablonun altında kesilmemeli.
    for (let i = 1; i <= 5; i += 1) await admin.click(`${inv} [data-act="add-line"]`);
    await admin.click(`${inv} [data-l="5"][data-f="name"]`);
    await admin.keyboard.type("Zımba Teli 24/6");
    await admin.waitForSelector(`${inv} [data-hits="5"] li[data-new-item]`, { timeout: 5000 });
    const vis = await admin.$eval(`${inv} [data-hits="5"]`, list => {
      const box = list.getBoundingClientRect();
      const last = list.lastElementChild.getBoundingClientRect();
      const hit = document.elementFromPoint(last.left + 10, last.top + last.height / 2);
      return { inView: box.top >= 0 && box.bottom <= window.innerHeight, lastOnTop: list.contains(hit), height: box.height };
    });
    ok(vis.inView && vis.lastOnTop && vis.height > 20, `öneri listesi tam görünür, son satırı üstte (${JSON.stringify(vis)})`);
    await shot(admin, "oneri-listesi-kirpilmiyor");
    await admin.click(`${inv} [data-hits="5"] li[data-new-item]`);
    await admin.waitForSelector(`${inv} .hof-inv-newitem`);
    ok(/Yeni Stok Kartı Açılacak/.test(await admin.textContent(`${inv} [data-line="5"]`)), "kalemde “Yeni Stok Kartı Açılacak”");
    await admin.fill(`${inv} [data-l="5"][data-f="code"]`, "ZT-246");
    await admin.fill(`${inv} [data-l="5"][data-f="unit"]`, "Kutu");
    await admin.fill(`${inv} [data-l="5"][data-f="qty"]`, "40");
    await admin.fill(`${inv} [data-l="5"][data-f="unitPrice"]`, "20");
    await admin.fill(`${inv} [data-l="5"][data-f="newSalePrice"]`, "35");
    // KDV kutusu: "%20" ve ok işareti sığar.
    const vat = await admin.$eval(`${inv} [data-l="0"][data-f="vatRate"]`, node => ({ width: node.offsetWidth, text: node.options[node.selectedIndex].text }));
    ok(vat.width >= 80, `KDV kutusu ${vat.width}px (“${vat.text}” sığar)`);
    await admin.selectOption(`${inv} [data-f="allVat"]`, "10");
    await admin.waitForTimeout(400);
    const rates = await admin.$$eval(`${inv} [data-f="vatRate"]`, nodes => nodes.map(node => node.value));
    ok(rates.every(rate => rate === "10"), `Tüm Kalemlere KDV %10: ${rates.join(",")}`);
    await admin.click(`${inv} [data-act="add-line"]`);
    ok((await admin.$eval(`${inv} [data-l="6"][data-f="vatRate"]`, node => node.value)) === "10", "yeni eklenen kalem de %10");
    const button = (await admin.textContent(`${inv} [data-act="issue"]`)).trim();
    ok(button === "Faturayı Kaydet", `düğme “${button}”`);
    ok(!/\bKes\b/.test(await admin.textContent(`${inv} .hof-actions`)), "form düğmelerinde “Kes” yok");
    await admin.waitForTimeout(900);
    await shot(admin, "alis-formu");
    await admin.click(`${inv} [data-act="issue"]`);
    const confirmText = await admin.textContent(`${modal} .hof-modal:last-of-type`).catch(() => "");
    await confirmYes();
    await admin.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 10000 });
    ok(!/\bkes/i.test(confirmText.replace(/iade kesilir/g, "")), "onay penceresinde “kes” yok");
    const card = await admin.textContent(`${inv}`);
    ok(/Stok Kodu/.test(await admin.textContent(`${inv} .hof-inv-doc-lines thead`)) && /ZT-246/.test(card) && /FK-A4/.test(card), "kartta Stok Kodu kolonu (FK-A4, ZT-246)");
    ok(/Alış Faturası - PDF/.test(card), "kartta “Alış Faturası - PDF”");
    ok(Boolean(await admin.$(`${inv} [data-act="modify"]`)), "kartta Düzenle düğmesi");
    await shot(admin, "alis-karti");
    const items = (await call(admin, "/api/workspace/stock")).data.items;
    const staple = items.find(item => item.code === "ZT-246");
    ok(staple && Number(staple.qty) === 40 && staple.unit === "Kutu" && Number(staple.salePrice) === 35, `yeni stok kartı kayıtla açıldı (${staple?.name} ${staple?.qty} ${staple?.unit})`);
    ok(Number(items.find(item => item.id === ids.item).qty) === 100, "barkodla seçilen ürün stoğa 100 girdi");
    await closeAll();
  });

  await step("3. Satış: KDV dahil iskonto ve Toplamlar düzeni; tahsilat yolunda POS", async () => {
    await admin.click("#hof-sidecard [data-action=invoices]");
    await admin.waitForSelector(`${inv} [data-act="new"]`);
    await admin.click(`${inv} [data-act="new"]`);
    await admin.click(`${inv} [data-scenario="goods_sale"]`);
    await admin.waitForSelector(`${inv} [data-lines]`);
    await pickAccount("Okul");
    await admin.check(`${inv} [data-f="pricesIncludeVat"]`);
    await addItemLine(0, "Fotokopi", 1, 2000);
    await admin.fill(`${inv} [data-l="0"][data-f="discountRate"]`, "10");
    await admin.waitForTimeout(1200);
    let totals = (await admin.textContent(`${inv} [data-totals]`)).replace(/\s+/g, " ");
    ok(cell(totals, "Toplam") === 1666.67 && cell(totals, "İskonto") === -166.67 && cell(totals, "Ara Toplam") === 1500 && cell(totals, "KDV %20") === 300 && cell(totals, "Genel Toplam") === 1800, `iskontolu: ${totals.slice(0, 160)}`);
    await shot(admin, "toplamlar-iskontolu");
    await admin.fill(`${inv} [data-l="0"][data-f="discountRate"]`, "");
    await admin.fill(`${inv} [data-l="0"][data-f="qty"]`, "8.25".replace(".", ","));
    await admin.waitForTimeout(1200);
    totals = (await admin.textContent(`${inv} [data-totals]`)).replace(/\s+/g, " ");
    ok(cell(totals, "Toplam") === 16500 && cell(totals, "Ara Toplam") === 13750 && cell(totals, "KDV %20") === 2750 && cell(totals, "Genel Toplam") === 16500, `iskontosuz KDV dahil: ${totals.slice(0, 160)}`);
    await shot(admin, "toplamlar-iskontosuz");
    // 2 adet olarak kaydet; 500 TL POS'la peşin.
    await admin.fill(`${inv} [data-l="0"][data-f="qty"]`, "2");
    await admin.waitForTimeout(900);
    await admin.click(`${inv} [data-act="pay-add-cash"]`);
    const methods = await admin.$$eval(`${inv} [data-pay="cash"][data-f="method"] option`, nodes => nodes.map(node => node.textContent.trim()));
    ok(methods.includes("POS") && !methods.includes("Kredi Kartı"), `satışta tahsilat yolları: ${methods.join(", ")}`);
    await admin.selectOption(`${inv} [data-pay="cash"][data-f="method"]`, "card");
    await admin.fill(`${inv} [data-pay="cash"][data-i="0"][data-f="amount"]`, "500");
    await admin.waitForTimeout(900);
    ids.saleNo = await issue();
    ids.sale = (await call(admin, "/api/workspace/invoices?tab=sale")).data.invoices[0].id;
    ok(/POS/.test(await admin.textContent(`${inv} .hof-inv-paylist`)), "kartta ödeme “POS”");
    ok((await account(ids.customer)).totals.balance === 4000 - 500, "müşteri bakiyesi 3.500");
    await closeAll();
  });

  await step("4. Düzenle: kaydedilmiş satış düzeltilir; numara aynı, stok ve cari yeni hale göre", async () => {
    const stock0 = Number(await stockQty(ids.item));
    await admin.click("#hof-sidecard [data-action=invoices]");
    await admin.waitForSelector(`${inv} tr[data-inv]`);
    await admin.click(`${inv} tr[data-inv="${ids.sale}"]`);
    await admin.waitForSelector(`${inv} [data-act="modify"]:not([disabled])`);
    await admin.click(`${inv} [data-act="modify"]`);
    await admin.waitForSelector(`${inv} [data-lines]`);
    ok(/Düzenleme:/.test(await admin.textContent(`${inv} .hof-plan-title h3`)), "form başlığı “Düzenleme: …”");
    await admin.fill(`${inv} [data-l="0"][data-f="qty"]`, "3");
    await admin.waitForTimeout(1000);
    ok((await admin.textContent(`${inv} [data-act="issue"]`)).trim() === "Değişiklikleri Kaydet", "düğme “Değişiklikleri Kaydet”");
    await shot(admin, "duzenleme-formu");
    await admin.click(`${inv} [data-act="issue"]`);
    await confirmYes();
    await admin.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 10000 });
    const doc = (await call(admin, `/api/workspace/invoices/${ids.sale}`)).data;
    ok(doc.number && ids.saleNo.includes(doc.number), `numara aynı (${doc.number})`);
    ok(doc.payableTotal === 6000, `yeni tutar 6.000 (${doc.payableTotal})`);
    ok(Number(await stockQty(ids.item)) === stock0 - 1, "stok bir adet daha düştü");
    ok((await account(ids.customer)).totals.balance === 6000 - 500, "müşteri bakiyesi 5.500");
    await shot(admin, "duzenlenmis-kart");
    await closeAll();
  });

  await step("5. Cari kartı: Cari Ekstre - PDF; tahsilatta POS, ödemede Kredi Kartı", async () => {
    await admin.click("#hof-sidecard [data-action=accounts]");
    await admin.waitForSelector(`${modal} tr[data-account]`);
    await admin.click(`${modal} tr[data-account="${ids.customer}"]`);
    await admin.waitForSelector(`${modal} [data-entry="in"]`);
    ok(/Cari Ekstre - PDF/.test(await admin.textContent(modal)), "cari kartında “Cari Ekstre - PDF”");
    await shot(admin, "cari-karti");
    const options = async kind => {
      await admin.click(`${modal} [data-entry="${kind}"]`);
      await admin.waitForSelector(`${modal} select[name="method"]`);
      const list = await admin.$$eval(`${modal} select[name="method"] option`, nodes => nodes.map(node => node.textContent.trim()));
      await admin.keyboard.press("Escape");
      await admin.waitForTimeout(300);
      return list;
    };
    const incoming = await options("in");
    ok(incoming.includes("POS") && !incoming.includes("Kredi Kartı"), `tahsilat yolları: ${incoming.join(", ")}`);
    if (await admin.$(`${modal} [data-entry="out"]`)) {
      const outgoing = await options("out");
      ok(outgoing.includes("Kredi Kartı") && !outgoing.includes("POS"), `ödeme yolları: ${outgoing.join(", ")}`);
    }
    await closeAll();
  });

  await step("6. Raporlar: her rapor arayüzden açılır; PDF ve Excel gerçek dosya; yalnız Cari Ekstre cari ister", async () => {
    const catalog = (await call(admin, "/api/workspace/report-center")).data.reports;
    await admin.click("#hof-sidecard [data-action=analytics]");
    await admin.waitForSelector(`${modal} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
    await admin.click(`${modal} .hof-rep-tab[data-tab="all"]`);
    await admin.waitForSelector(`${modal} [data-rc-list] [data-report]`, { timeout: 15000 });
    const idsInUi = await admin.$$eval(`${modal} [data-rc-list] [data-report]`, nodes => nodes.map(node => node.dataset.report));
    ok(idsInUi.length === catalog.length && catalog.length >= 42, `arayüzde ${idsInUi.length} rapor (katalog ${catalog.length})`);
    const failed = [];
    for (const report of catalog) {
      await admin.click(`${modal} [data-rc-list] [data-report="${report.id}"]`);
      if (report.accountRequired) {
        await admin.waitForSelector(`${modal} [data-rc-main] .hof-empty`);
        const empty = await admin.textContent(`${modal} [data-rc-main] .hof-empty`);
        if (!/Önce cariyi seçin/.test(empty)) failed.push(`${report.id}: cari istemedi`);
        await admin.fill(`${modal} [data-account-slot] [data-acc-query]`, "Okul");
        await admin.waitForSelector(`${modal} [data-account-slot] li[data-id]`);
        await (await admin.$(`${modal} [data-account-slot] li[data-id]`)).dispatchEvent("mousedown");
      }
      const shown = await admin.waitForSelector(`${modal} [data-rc-main] .hof-rc-summary, ${modal} [data-rc-main] .hof-rc-table`, { timeout: 15000 }).then(() => true).catch(() => false);
      const main = await admin.textContent(`${modal} [data-rc-main]`);
      if (!shown || /Önce cariyi seçin/.test(main)) {
        failed.push(`${report.id}: ön izleme açılmadı (${main.replace(/\s+/g, " ").slice(0, 80)})`);
        continue;
      }
      const links = await admin.$$eval(`${modal} [data-rc-main] .hof-rep-out`, nodes => nodes.map(node => node.getAttribute("href")));
      const files = await admin.evaluate(async hrefs => {
        const out = [];
        for (const href of hrefs) {
          const response = await fetch(href);
          const head = new Uint8Array((await response.arrayBuffer()).slice(0, 4));
          out.push({ href, status: response.status, magic: String.fromCharCode(...head) });
        }
        return out;
      }, links);
      const pdf = files.find(file => /\/pdf\?|\/pdf$/.test(file.href));
      const xlsx = files.find(file => /\/xlsx/.test(file.href));
      if (!pdf || pdf.status !== 200 || pdf.magic !== "%PDF") failed.push(`${report.id}: PDF ${pdf?.status} ${pdf?.magic}`);
      if (!xlsx || xlsx.status !== 200 || !xlsx.magic.startsWith("PK")) failed.push(`${report.id}: Excel ${xlsx?.status}`);
      if (report.id === "fatura-satis") await shot(admin, "rapor-fatura-satis");
    }
    ok(!failed.length, `${catalog.length} raporun hepsi arayüzden açıldı, PDF ve Excel indi${failed.length ? `: ${failed.join(" | ")}` : ""}`);
    const sales = catalog.filter(report => /^fatura|fatura/.test(report.id)).map(report => report.id);
    ok(sales.length >= 3, `fatura raporları katalogda ve açıldı (${sales.join(", ")})`);
    await closeAll();
  });
  await step("7. Öbür ekranlar: Taksit ve Kasa formlarında POS / Kredi Kartı, stok satışında POS; fatura PDF, Excel ve raporda Stok Kodu", async () => {
    // Taksit kartı → + Tahsilat: POS; − Ödeme / İade: Kredi Kartı.
    const plan = (await call(admin, "/api/workspace/plans", { accountId: ids.customer, name: "Okul Kantini Ltd.", total: 900, count: 3, firstDue: shift(30), everyMonths: 1 })).data;
    if (plan?.id) {
      await admin.click("#hof-sidecard [data-action=plans]");
      await admin.waitForSelector(`${modal} tr[data-plan]`);
      await admin.click(`${modal} tr[data-plan="${plan.id}"]`);
      await admin.waitForSelector(`${modal} [data-act="pay"]`);
      const opts = async act => {
        await admin.click(`${modal} [data-act="${act}"]`);
        await admin.waitForSelector(`${modal} select[name="method"]`);
        const list = await admin.$$eval(`${modal} select[name="method"] option`, nodes => nodes.map(node => node.textContent.trim()));
        await admin.keyboard.press("Escape");
        await admin.waitForTimeout(300);
        return list;
      };
      const payIn = await opts("pay");
      ok(payIn.includes("POS") && !payIn.includes("Kredi Kartı"), `taksit tahsilatı yolları: ${payIn.join(", ")}`);
      const payOut = await opts("refund");
      ok(payOut.includes("Kredi Kartı") && !payOut.includes("POS"), `taksit ödeme/iade yolları: ${payOut.join(", ")}`);
      await closeAll();
    } else ok(false, "taksit kartı açılamadı");
    // v2.0.17 (müşteri): Kasa yalnız nakit — tahsilat/ödeme formunda yol seçilmez, sabit "Nakit"; yol sekmesi yok.
    await admin.click("#hof-sidecard [data-action=cash]");
    await admin.waitForSelector(`${modal} [data-add="in"]`);
    ok(!(await admin.$(`${modal} [data-methods]`)), "Kasa'da yol sekmesi yok");
    const kasa = async kind => {
      await admin.click(`${modal} [data-add="${kind}"]`);
      await admin.waitForSelector(`${modal} input[name="methodLabel"]`);
      const value = await admin.inputValue(`${modal} input[name="methodLabel"]`);
      const readonly = await admin.$eval(`${modal} input[name="methodLabel"]`, node => node.readOnly);
      ok(!(await admin.$(`${modal} select[name="method"]`)), `Kasa ${kind} formunda yol seçici yok`);
      await admin.keyboard.press("Escape");
      await admin.waitForTimeout(300);
      return { value, readonly };
    };
    const kasaIn = await kasa("in");
    ok(kasaIn.value === "Nakit" && kasaIn.readonly, `Kasa tahsilat yolu sabit Nakit (${kasaIn.value})`);
    const kasaOut = await kasa("out");
    ok(kasaOut.value === "Nakit" && kasaOut.readonly, `Kasa ödeme yolu sabit Nakit (${kasaOut.value})`);
    await closeAll();
    // Stok → − Çıkış (satış): POS; + Giriş (alım): Kredi Kartı.
    await admin.click("#hof-sidecard [data-action=stock]");
    await admin.waitForSelector(`${modal} tr[data-item]`).catch(() => null);
    await admin.click(`${modal} tr[data-item="${ids.item}"]`).catch(async () => admin.click(`${modal} tr:has-text("Fotokopi Kağıdı A4")`));
    await admin.waitForSelector(`${modal} [data-move="out"]`);
    const stockOpts = async kind => {
      await admin.click(`${modal} [data-move="${kind}"]`);
      await admin.waitForSelector(`${modal} select[name="pay"]`);
      const list = await admin.$$eval(`${modal} select[name="pay"] option`, nodes => nodes.map(node => node.textContent.trim()));
      await admin.keyboard.press("Escape");
      await admin.waitForTimeout(300);
      return list;
    };
    const sell = await stockOpts("out");
    ok(sell.some(label => /^POS \(/.test(label)) && !sell.some(label => /Kredi Kartı/.test(label)), `stok satış yolları: ${sell.join(" | ")}`);
    const buy = await stockOpts("in");
    ok(buy.some(label => /^Kredi Kartı \(/.test(label)) && !buy.some(label => /^POS/.test(label)), `stok alım yolları: ${buy.join(" | ")}`);
    await closeAll();
    // Fatura PDF'inde ayrı "Stok Kodu" kolonu; Excel'de "Stok Kodu" başlığı; Ürün Bazında Satış raporunda Stok Kodu kolonu.
    const pdf = await admin.evaluate(async id => {
      const response = await fetch(`/api/workspace/invoices/${id}/fatura.pdf`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { status: response.status, size: bytes.length, head: String.fromCharCode(...bytes.slice(0, 4)) };
    }, ids.sale);
    ok(pdf.status === 200 && pdf.head === "%PDF" && pdf.size > 5000, `satış faturası PDF'i indi (${pdf.size} bayt)`);
    const pdfText = await call(admin, `/api/workspace/invoices/${ids.sale}`);
    ok(pdfText.data.lines.every(line => line.code === "FK-A4"), "kart kaleminde Stok Kodu FK-A4 (PDF aynı veriden basılır)");
    const xlsx = await admin.evaluate(async () => {
      const response = await fetch("/api/workspace/invoices/export.xlsx");
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { status: response.status, head: String.fromCharCode(...bytes.slice(0, 2)), size: bytes.length };
    });
    ok(xlsx.status === 200 && xlsx.head === "PK", `fatura Excel'i indi (${xlsx.size} bayt)`);
    const report = await call(admin, "/api/workspace/report-center/urun-satis-karlilik?preset=all");
    ok(report.status === 200 && report.data.headers[0] === "Stok Kodu" && report.data.rows.some(row => row[0] === "FK-A4"), `Ürün Bazında Satış raporunda Stok Kodu kolonu (${report.data.headers[0]}; ${report.data.rows.length} satır)`);
    const stockReport = await call(admin, "/api/workspace/report-center/stok-durumu");
    ok(stockReport.status === 200 && stockReport.data.headers[0] === "Stok Kodu", `stok raporunda Stok Kodu kolonu (${stockReport.data.headers[0]})`);
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
