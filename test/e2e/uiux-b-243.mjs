// 2.4.3 uzman UI / UX turu, B paketi (fatura ekranı; kullanıcı kararları 18.10.2026) — EKRANDAN, gerçek tıklama + Tab + insan hızında yazım;
// yazmadan sonra veri tabanı okunur (ders 3, 12). Sahte EDM (ağa çıkmaz), sahte saat (ders 13: 31.12 → 01.01, ayın 1'i ve yıl dönümü).
// Bulgular (docs/kanit/2026-10-18/uiux-b-243/):
//   UX2  tam iade Düzenle'de kaydedilemiyordu ("en çok 0 Adet").          UX28 iade düzenlemesinde müşteri no kutusunda iç numara.
//   UX3  gece yarısını geçen açık pencerede yeni fatura dünün tarihini alıyordu.
//   UX5  sunucu mükellefiyeti gönderimde düzeltince açık form e-Arşiv'de kalıyor, ileti seçili kutuyu bilmiyordu.
//   UX6  Kaydet ve Gönder onayı "Yanlışsa Düzenle ile düzeltilir" diyordu.  UX12 eski doğrulama iletisi alan değişince kalıyordu.
//   UI2  form hatası ayrıca bildirim olarak kalem alanlarını örtüyordu (3 kopya).   UI4  kod yazıp Tab: ürün seçilmiyordu.
//   UX23 "Stok eksiye düşecek" başlığı.   UX14 Tümünü Gönder iletisinde teknik kod + tekrarlanan neden.   UX26 Fatura Ayarları'nda Esc pencereyi kapatıyordu.
//   KÖ1  "Nihai Tüketici" hızlı seçeneği.  KÖ2  "Listeden Sil" → "Müşteri Fişi Olarak Bırak".
// Eski kodda (70edab7) kırmızıdır: DEPO=<eski kopya> ile koşulur. Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { MULTI_VKN, OUR_VKN, startMockEdm } from "../einvoice-mock.mjs";
import { escClose } from "./esc-kapat.mjs";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock, moveClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "Prova-Admin-2026!";
// Yıl sonu: bütün adımlar 31.12 akşamı; UX3 en sonda saat 01.01 00:01'e alınır. Sunucu ve tarayıcı aynı saat diliminde (yerel).
const NOW = "2026-12-31T23:20:00";
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-uiux-b-243-"));
const edm = await startMockEdm();
let edmOpen = true;
const NO_ENV_PROXY = { HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "", NO_PROXY: "", no_proxy: "" };
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, edocEnabled: true, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9", ...NO_ENV_PROXY }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f47" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
await api.login("admin", PASS);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const db = (sql, ...args) => app.store.get(sql, ...args);
const invoiceCount = () => db("SELECT COUNT(*) AS n FROM invoices").n;
globalThis.__escKapatEk = () => ({ fatura: invoiceCount(), cari: db("SELECT COUNT(*) AS n FROM accounts").n });

await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
// Kâğıt dönemden kalan satış ve tam iadesi (e-Belge açılmadan önce); sonra e-Belge açılır.
await must("firma bilgisi", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: false, earsiv: false }));
const ayse = await must("kişi cari", api.post("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", address: "Kordon 1", district: "Konak", city: "İzmir" }));
const iadeci = await must("iade carisi", api.post("/api/workspace/accounts", { name: "İade Müşterisi", type: "customer" }));
const multi = await must("çok kutulu cari", api.post("/api/workspace/accounts", { name: "Çoklu A.Ş.", type: "customer", taxNo: MULTI_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 1", district: "Çankaya", city: "Ankara", eInvoice: false, eAlias: "urn:mail:defaultpk@coklu.com.tr" }));
const stock = await must("stok", api.post("/api/workspace/stock", { code: "8690123456789", name: "Barkodlu Ürün", unit: "Adet", salePrice: "20" }));
const sale = await must("satış (kâğıt)", api.post("/api/workspace/invoices", { kind: "sale", accountId: iadeci.id, issueDate: "2026-12-20", profile: "KAGIT", lines: [{ name: "Kurulum", qty: 2, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" } }));
const fullReturn = await must("tam iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: sale.id, accountId: iadeci.id, issueDate: "2026-12-22", profile: "KAGIT", lines: [{ originLineId: sale.lines[0].id, qty: 2 }], payment: {} }));
await must("e-Belge ayarları", api.put("/api/workspace/invoices/settings", { efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));

const browser = await chromium.launch();
const errors = [];
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const TOP = ".hof-modal-backdrop.is-visible:last-of-type";
const INV = ".hof-invoices-modal";
const toasts = page => page.$$eval(".hof-toast-text", nodes => nodes.map(node => node.textContent)).catch(() => []);
const formError = page => page.$eval(`${INV} [data-form-error]`, node => node.textContent).catch(() => "");
const typeHuman = async (page, selector, text) => {
  await page.locator(selector).click();
  await page.keyboard.type(text, { delay: 35 });
};
const focused = page => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "BODY";
  return `${a.tagName}${a.dataset?.f ? `[f=${a.dataset.f}]` : ""}${a.dataset?.answer ? `[answer=${a.dataset.answer}]` : ""}|${(a.textContent || "").trim().slice(0, 30)}`;
});
const modalCount = page => page.$$eval(".hof-modal-backdrop.is-visible", nodes => nodes.length);
const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, timezoneId: TZ });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", error => errors.push(error.message));
await installPageClock(page, app.config.now);
await page.goto(`${BASE}/`);
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
await page.waitForFunction(() => window.HOF?.invoices?.open && window.HOF?.accounts?.open);

const closeAll = async () => {
  for (let index = 0; index < 8 && (await page.$(".hof-modal-backdrop.is-visible")); index += 1) {
    await escClose(page, { step: "pencereleri kapat" });
    await sleep(250);
  }
};
const part = async (name, run) => {
  try {
    await run();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ ${name} bölümü yarıda kaldı: ${String(error.message || error).split("\n")[0].slice(0, 220)}`);
  }
  await closeAll().catch(() => null);
};
const openForm = async (scenario, account = null) => {
  await page.evaluate(([s, a]) => window.HOF.invoices.open({ scenario: s, ...(a ? { account: a } : {}) }), [scenario, account]);
  await page.waitForSelector(`${INV} [data-lines] [data-l="0"][data-f="name"]`);
};
const fillServiceLine = async (name, price) => {
  await typeHuman(page, `${INV} [data-l="0"][data-f="name"]`, name);
  await page.locator(`${INV} [data-l="0"][data-f="unitPrice"]`).click();
  await page.keyboard.type(price, { delay: 35 });
  await page.keyboard.press("Tab");
  await sleep(1300);
};

try {
  console.log("A) UX2 + UX28: tam iade Düzenle'de kaydedilir; müşteri no kutusunda iç numara yok");
  await part("A", async () => {
    await page.evaluate(id => window.HOF.invoices.open({ id }), fullReturn.id);
    await page.waitForSelector(`${INV} [data-act="modify"]:not([disabled])`);
    await page.click(`${INV} [data-act="modify"]`);
    await page.waitForSelector(`${INV} textarea[data-f="note"]`);
    await sleep(1200);
    const numberBox = await page.$eval(`${INV} input[data-f="number"]`, node => ({ value: node.value, note: node.closest("label")?.querySelector("small")?.textContent || "" })).catch(() => ({ value: "?", note: "" }));
    ok(numberBox.value === "" && !numberBox.value.includes(fullReturn.number), `UX28: "Müşterinin İade Faturası No" kutusu boş (${JSON.stringify(numberBox.value)})`);
    ok(numberBox.note.includes(fullReturn.number), `UX28: iç numara açıklamada (${numberBox.note})`);
    await typeHuman(page, `${INV} textarea[data-f="note"]`, "Kutu hasarlı döndü");
    await page.click(`${INV} [data-act="issue"]`);
    const asked = await page.waitForSelector(`${TOP} [data-answer="yes"]`, { timeout: 6000 }).then(() => true, () => false);
    const err = await formError(page);
    ok(asked, `UX2: "Değişiklikleri Kaydet" onayı açıldı (form hatası: ${err || "yok"})`);
    ok(!/en çok 0/.test(err), "UX2: 'en çok 0 Adet iade edilebilir' hatası yok");
    if (asked) {
      await page.click(`${TOP} [data-answer="yes"]`);
      await page.waitForFunction(() => /düzenlendi/.test([...document.querySelectorAll(".hof-toast-text")].map(node => node.textContent).join(" ")), null, { timeout: 8000 }).catch(() => null);
    }
    const row = db("SELECT note, number, status FROM invoices WHERE id = ?", fullReturn.id);
    ok(row.note === "Kutu hasarlı döndü" && row.status === "issued" && row.number === fullReturn.number, `UX2: veri tabanında not yazıldı, numara aynı (${JSON.stringify({ ...row })})`);
    const lineQty = db("SELECT SUM(qty) AS q FROM invoice_lines WHERE invoice_id = ?", fullReturn.id).q;
    ok(Number(lineQty) === 2, `UX2: iade miktarı 2 kaldı (${lineQty})`);
  });

  console.log("B) UX6: Kaydet ve Gönder onayı gönderilen belgeyi Düzenle'ye yönlendirmez");
  await part("B", async () => {
    await openForm("service_sale", { id: ayse.id, name: ayse.name });
    await fillServiceLine("Danışmanlık", "1000");
    await page.click(`${INV} [data-act="issue-now"]`);
    await page.waitForSelector(`${TOP} .hof-modal-text`);
    const text = await page.$eval(`${TOP} .hof-modal-text`, node => node.textContent);
    ok(/Gönderildikten sonra düzenlenemez; yanlışsa iptal ya da iade gerekir\./.test(text), `onayda doğru yol (${text.slice(0, 160)}…)`);
    ok(!/Düzenle” ile düzeltilir/.test(text), "onay 'Düzenle ile düzeltilir' demiyor");
    const before = invoiceCount();
    await page.click(`${TOP} [data-answer="no"]`);
    await sleep(400);
    ok(invoiceCount() === before, "Vazgeç: belge kaydedilmedi (veri tabanı)");
    // Komşu: kâğıt/sonra gönder onayı Düzenle yolunu söylemeye devam eder.
    await page.click(`${INV} [data-act="issue-later"]`);
    await page.waitForSelector(`${TOP} .hof-modal-text`);
    const later = await page.$eval(`${TOP} .hof-modal-text`, node => node.textContent);
    ok(/Düzenle” ile düzeltilir/.test(later), "komşu: Kaydet, Sonra Gönder onayında Düzenle yolu yerinde");
    await page.click(`${TOP} [data-answer="no"]`);
  });

  console.log("C) UI2 + UX12: form hatası tek kopya (bildirim yok); alan değişince temizlenir");
  await part("C", async () => {
    await openForm("service_sale");
    await fillServiceLine("Bakım", "500");
    await page.click(`${INV} [data-act="issue-now"]`);
    await sleep(900);
    const err = await formError(page);
    const shown = await toasts(page);
    ok(/Müşteriyi \(cariyi\) seçin\./.test(err), `formda hata satırı (${err})`);
    ok(!shown.some(text => /Müşteriyi \(cariyi\) seçin/.test(text)), `aynı ileti ayrıca bildirim olarak çıkmadı (${JSON.stringify(shown).slice(0, 160)})`);
    await page.locator(`${INV} [data-l="0"][data-f="qty"]`).click({ clickCount: 3 });
    await page.keyboard.type("2", { delay: 35 });
    await sleep(300);
    ok((await formError(page)) === "", "UX12: kalem değişince eski ileti temizlendi");
    await page.click(`${INV} [data-act="issue-now"]`);
    await sleep(700);
    ok(/Müşteriyi/.test(await formError(page)), "ön koşul: ileti yeniden çıktı");
    await typeHuman(page, `${INV} [data-acc-query]`, "Ayşe");
    await page.waitForSelector(`${INV} .hof-acc-picker li[data-id]`);
    await page.dispatchEvent(`${INV} .hof-acc-picker li[data-id]`, "mousedown");
    await sleep(500);
    ok((await formError(page)) === "", "UX12: cari seçilince eski ileti temizlendi");
  });

  console.log("D) UI4 + UX23: kod yazıp Tab → ürün seçilir; eksi stok sorusu başlığı");
  await part("D", async () => {
    await openForm("goods_sale", { id: ayse.id, name: ayse.name });
    await typeHuman(page, `${INV} [data-l="0"][data-f="code"]`, "8690123456789");
    await page.keyboard.press("Tab");
    await sleep(1300);
    const line = await page.evaluate(sel => ({ name: document.querySelector(`${sel} [data-l="0"][data-f="name"]`)?.value, price: document.querySelector(`${sel} [data-l="0"][data-f="unitPrice"]`)?.value }), INV);
    ok(line.name === "Barkodlu Ürün", `Tab ile ürün seçildi (${JSON.stringify(line)})`);
    ok(line.price === "20" || line.price === "20,00", `fiyat stok kartından geldi (${line.price})`);
    const where = await focused(page);
    ok(/f=qty/.test(where), `odak Miktar'da (${where})`);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("3", { delay: 35 });
    await page.keyboard.press("Tab");
    await sleep(1300);
    const before = invoiceCount();
    await page.click(`${INV} [data-act="issue-later"]`);
    await page.waitForSelector(`${TOP} [data-answer="yes"]`);
    await page.click(`${TOP} [data-answer="yes"]`);
    const stockQuestion = await page.waitForSelector(`${TOP} .hof-modal-title`, { timeout: 8000 }).then(handle => handle.textContent()).catch(() => "");
    ok(stockQuestion === "Stok Eksiye Düşecek", `UX23: soru başlığı yazım düzeninde (${stockQuestion})`);
    await page.click(`${TOP} [data-answer="yes"]`);
    await page.waitForSelector(`${INV} [data-act="e-withdraw"]`, { timeout: 10000 });
    ok(invoiceCount() === before + 1, "fatura kaydedildi (veri tabanı)");
    const saved = db("SELECT i.id, l.item_id AS itemId, l.qty FROM invoices i JOIN invoice_lines l ON l.invoice_id = i.id WHERE i.account_id = ? ORDER BY i.created_at DESC LIMIT 1", ayse.id);
    ok(saved?.itemId === stock.id && Number(saved.qty) === 3, `kalem stok kartına bağlı, miktar 3 (${JSON.stringify({ ...saved })})`);
    globalThis.__waitingId = saved?.id;

    console.log("F) KÖ2: \"Müşteri Fişi Olarak Bırak\"");
    const label = await page.$eval(`${INV} [data-act="e-withdraw"]`, node => node.textContent.trim());
    ok(label === "Müşteri Fişi Olarak Bırak", `düğme adı (${label})`);
    await page.click(`${INV} [data-act="e-withdraw"]`);
    await page.waitForSelector(`${TOP} [data-answer="yes"]`);
    await sleep(250);
    const title = await page.$eval(`${TOP} .hof-modal-title`, node => node.textContent);
    const message = await page.$eval(`${TOP} .hof-modal-text`, node => node.textContent);
    ok(title === "Müşteri Fişi Olarak Bırakılsın mı?", `onay başlığı (${title})`);
    ok(/e-Belge gönderilmez; belge fiş numarasıyla Müşteri Fişi olarak kalır\./.test(message) && /etkileri geri alınmaz/.test(message), `onay metni (${message.slice(0, 120)}…)`);
    ok(/answer=no/.test(await focused(page)), `onayda odak Vazgeç'te (${await focused(page)})`);
    await page.click(`${TOP} [data-answer="yes"]`);
    await page.waitForSelector(`${INV} .hof-inv-pill.is-e-withdrawn`, { timeout: 10000 });
    const row = db("SELECT e_status AS e, number FROM invoices WHERE id = ?", saved.id);
    ok(row.e === "withdrawn" && /^FIS/.test(row.number), `veri tabanında Müşteri Fişi (${JSON.stringify({ ...row })})`);
    ok((await toasts(page)).some(text => /Müşteri Fişi olarak bırakıldı/.test(text)), "bildirim yeni adla");
  });

  console.log("E) UI4: eşleşmeyen kod → satırda \"Bu kodla ürün yok\"");
  await part("E", async () => {
    await openForm("goods_sale", { id: ayse.id, name: ayse.name });
    await typeHuman(page, `${INV} [data-l="0"][data-f="code"]`, "0000000000017");
    await page.keyboard.press("Tab");
    await sleep(1200);
    const note = await page.$eval(`${INV} [data-stock-note="0"]`, node => node.textContent).catch(() => "");
    ok(/Bu kodla ürün yok/.test(note), `satırda not (${note})`);
    const name = await page.$eval(`${INV} [data-l="0"][data-f="name"]`, node => node.value);
    ok(name === "", "ad boş kaldı (yanlış ürün seçilmedi)");
  });

  console.log("G) KÖ1: \"Nihai Tüketici\" tek cari; sınır üstü engel");
  await part("G", async () => {
    const accountsBefore = db("SELECT COUNT(*) AS n FROM accounts").n;
    await openForm("service_sale");
    const button = await page.$(`${INV} [data-act="retail-account"]`);
    ok(Boolean(button), "Nihai Tüketici düğmesi cari seçicinin yanında");
    await page.click(`${INV} [data-act="retail-account"]`);
    await page.waitForFunction(sel => document.querySelector(`${sel} [data-acc-query]`)?.value === "Nihai Tüketici", INV, { timeout: 8000 }).catch(() => null);
    const retail = db("SELECT id, name, city FROM accounts WHERE tax_no = '11111111111' AND deleted_at IS NULL");
    ok(retail?.name === "Nihai Tüketici" && db("SELECT COUNT(*) AS n FROM accounts").n === accountsBefore + 1, `ilk kullanımda tek cari açıldı (${JSON.stringify(retail ? { ...retail } : null)})`);
    await fillServiceLine("Perakende Satış", "1000");
    const before = invoiceCount();
    await page.click(`${INV} [data-act="issue-later"]`);
    await page.waitForSelector(`${TOP} [data-answer="yes"]`);
    await page.click(`${TOP} [data-answer="yes"]`);
    await page.waitForSelector(`${INV} [data-act="e-withdraw"]`, { timeout: 10000 });
    const inv = db("SELECT account_id AS accountId, e_profile AS profile FROM invoices ORDER BY created_at DESC LIMIT 1");
    ok(invoiceCount() === before + 1 && inv.accountId === retail?.id, `fatura Nihai Tüketici carisine kaydedildi (${JSON.stringify({ ...inv })})`);
    await closeAll();
    await openForm("service_sale");
    await page.click(`${INV} [data-act="retail-account"]`);
    await sleep(800);
    ok(db("SELECT COUNT(*) AS n FROM accounts WHERE tax_no = '11111111111'").n === 1, "ikinci kullanımda aynı cari (çift açılmadı)");
    await fillServiceLine("Perakende Büyük", "30000");
    const before2 = invoiceCount();
    await page.click(`${INV} [data-act="issue-now"]`);
    await sleep(1000);
    const err = await formError(page);
    ok(/30\.000 TL üstü e-Arşiv faturada nihai tüketicinin gerçek TC kimlik numarası/.test(err), `sınır üstü kaydetmeden durdu (${err.slice(0, 140)})`);
    ok(invoiceCount() === before2, "sınır üstü belge kaydedilmedi (veri tabanı)");
  });

  console.log("H) UX5: sunucu mükellefiyeti gönderimde düzeltince açık form e-Fatura'ya döner, seçili kutu korunur");
  await part("H", async () => {
    await openForm("service_sale", { id: multi.id, name: multi.name });
    await fillServiceLine("Danışmanlık", "2000");
    const nextBefore = await page.$eval(`${INV} [data-next]`, node => node.textContent).catch(() => "");
    ok(/TEA/.test(nextBefore), `ön koşul: form e-Arşiv numarası gösteriyor (${nextBefore.trim()})`);
    await page.click(`${INV} [data-act="issue-now"]`);
    await page.waitForSelector(`${TOP} [data-answer="yes"]`);
    await page.click(`${TOP} [data-answer="yes"]`);
    await page.waitForFunction(sel => /e-Fatura mükellefi/.test(document.querySelector(`${sel} [data-form-error]`)?.textContent || ""), INV, { timeout: 10000 }).catch(() => null);
    const err = await formError(page);
    ok(/Önceden seçtiğiniz posta kutusu \(urn:mail:defaultpk@coklu\.com\.tr\) korundu\./.test(err), `ileti korunan kutuyu söylüyor (${err.slice(0, 220)})`);
    await sleep(1500);
    const nextAfter = await page.$eval(`${INV} [data-next]`, node => node.textContent).catch(() => "");
    ok(/TEF/.test(nextAfter), `açık form yeniden hesaplandı: e-Fatura numarası (${nextAfter.trim()})`);
    const acc = db("SELECT e_invoice AS e, e_alias AS alias FROM accounts WHERE id = ?", multi.id);
    ok(acc.e === 1 && acc.alias === "urn:mail:defaultpk@coklu.com.tr", `cari işaretli, kutu korundu (${JSON.stringify({ ...acc })})`);
    const before = invoiceCount();
    await page.click(`${INV} [data-act="issue-now"]`);
    await page.waitForSelector(`${TOP} [data-answer="yes"]`);
    await page.click(`${TOP} [data-answer="yes"]`);
    await page.waitForSelector(`${INV} .hof-plan-title h3`, { timeout: 10000 });
    await sleep(1500);
    const inv = db("SELECT e_profile AS profile, number, account_id AS accountId FROM invoices ORDER BY created_at DESC LIMIT 1");
    ok(invoiceCount() === before + 1 && inv.accountId === multi.id && inv.profile !== "EARSIVFATURA" && /^TEF/.test(inv.number || ""), `yeniden kaydedince e-Fatura kesildi (${JSON.stringify({ ...inv })})`);
  });

  console.log("I) UX26: Fatura Ayarları'nda Esc listeye döner (pencere kapanmaz); değişiklik varsa sorar");
  await part("I", async () => {
    await page.evaluate(() => window.HOF.invoices.open({}));
    await page.waitForSelector(`${INV} [data-act="settings"]`);
    await page.click(`${INV} [data-act="settings"]`);
    await page.waitForFunction(sel => /Fatura Ayarları/.test(document.querySelector(`${sel} .hof-plan-title h3`)?.textContent || ""), INV);
    await page.keyboard.press("Escape");
    await sleep(600);
    const afterEsc = await page.evaluate(sel => ({ open: Boolean(document.querySelector(sel)?.closest(".hof-modal-backdrop.is-visible")), h3: document.querySelector(`${sel} .hof-plan-title h3`)?.textContent || "", list: Boolean(document.querySelector(`${sel} [data-act="new"]`)) }), INV);
    ok(afterEsc.open && afterEsc.list && !/Fatura Ayarları/.test(afterEsc.h3), `Esc: ayarlardan listeye döndü, pencere açık (${JSON.stringify(afterEsc)})`);
    await page.click(`${INV} [data-act="settings"]`);
    await page.waitForFunction(sel => /Fatura Ayarları/.test(document.querySelector(`${sel} .hof-plan-title h3`)?.textContent || ""), INV);
    const field = page.locator(`${INV} input[data-s]`).first();
    await field.click();
    await page.keyboard.type(" Ek", { delay: 35 });
    await page.keyboard.press("Escape");
    const asked = await page.waitForSelector(`${TOP} [data-answer="no"]`, { timeout: 4000 }).then(() => true, () => false);
    ok(asked, "değişiklik varken Esc: Kaydedilmemiş Değişiklik sorusu");
    if (asked) {
      await page.click(`${TOP} [data-answer="no"]`);
      await sleep(400);
      ok(/Fatura Ayarları/.test(await page.$eval(`${INV} .hof-plan-title h3`, node => node.textContent)), "Forma Dön: ayarlarda kalındı, yazılan duruyor");
      await page.keyboard.press("Escape");
      await page.waitForSelector(`${TOP} [data-answer="yes"]`, { timeout: 4000 });
      await page.click(`${TOP} [data-answer="yes"]`);
      await sleep(500);
      const end = await page.evaluate(sel => ({ open: Boolean(document.querySelector(sel)?.closest(".hof-modal-backdrop.is-visible")), list: Boolean(document.querySelector(`${sel} [data-act="new"]`)) }), INV);
      ok(end.open && end.list, `Kaydetmeden Kapat: listeye dönüldü, pencere açık (${JSON.stringify(end)})`);
    }
    await page.keyboard.press("Escape");
    await sleep(400);
    ok((await modalCount(page)) === 0, "listede Esc pencereyi kapatır (eski davranış yerinde)");
  });

  console.log("J) UX14: Tümünü Gönder iletisinde teknik kod ve tekrarlanan neden yok");
  await part("J", async () => {
    await must("bekleyen", api.post("/api/workspace/invoices", { kind: "sale", accountId: ayse.id, issueDate: "2026-12-31", lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
    await edm.close();
    edmOpen = false;
    await page.evaluate(() => window.HOF.invoices.open({ tab: "pending" }));
    await page.waitForSelector(`${INV} [data-act="send-pending"]`);
    await page.click(`${INV} [data-act="send-pending"]`);
    const asked = await page.waitForSelector(`${TOP} [data-answer="yes"]`, { timeout: 3000 }).then(() => true, () => false);
    if (asked) await page.click(`${TOP} [data-answer="yes"]`);
    await page.waitForFunction(() => /gönderildi/.test([...document.querySelectorAll(".hof-toast-text")].map(node => node.textContent).join(" ")), null, { timeout: 30000 }).catch(() => null);
    const text = (await toasts(page)).join(" | ");
    ok(/gönderildi/.test(text), `sonuç bildirimi geldi (${text.slice(0, 260)})`);
    ok(!/ECONN|UND_ERR|EPIPE|ENOTFOUND/.test(text), "bildirimde teknik kod yok");
    ok(!(/bağlanılamadı/.test(text) && /ulaşılamadı/.test(text)), "aynı neden iki kez yazılmadı");
  });

  console.log("K) UX3: gece yarısını geçen açık pencerede yeni fatura bugünün tarihini alır (31.12 → 01.01)");
  await part("K", async () => {
    await page.evaluate(() => window.HOF.invoices.open({}));
    await page.waitForSelector(`${INV} [data-act="new"]`);
    await moveClock(app.config.now, page, "2027-01-01T00:01:00");
    await page.click(`${INV} [data-act="new"]`);
    await page.waitForSelector(`${INV} [data-scenario="service_sale"]`);
    await page.click(`${INV} [data-scenario="service_sale"]`);
    await page.waitForSelector(`${INV} input[data-f="issueDate"]`);
    const date = await page.$eval(`${INV} input[data-f="issueDate"]`, node => ({ value: node.value, max: node.max }));
    ok(date.value === "2027-01-01", `yeni formun tarihi 01.01.2027 (${JSON.stringify(date)})`);
    ok(date.max === "2027-01-01", `tarih sınırı da bugün (${date.max})`);
  });
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} uiux-b-243: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  if (edmOpen) await edm.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
