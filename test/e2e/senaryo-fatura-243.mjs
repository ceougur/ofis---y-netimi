// 2.4.3 EKRANDAN — fatura / e-Belge bulguları (keşif B1, B2, B3, B6, B7, B8, B11, B12, B13; fatura hız testi H1, H8). Sahte EDM; ağa çıkmaz.
//   0 B1  Gönderilecekler → Tümünü Gönder (liste yeniden eskiye): eski tarihli belgeler önce numaralanır, üçü de gönderilir.
//   1 H8  Stok kartında KDV Oranı (%10) → satış faturasında ürün seçilince kalemin KDV'si %10; kalemde değiştirilebilir.
//   2 B8  Miktar stoğu aşınca satırda kayıttan ÖNCE eksi uyarısı.  B11 Uzun ürün adının tamamı kutunun ipucunda (title).
//   3 B12 Fiyatsız kalemde hesap isteği gönderilmez (konsolda 400 yok).  B13 "+ Yeni Stok Kartı"ndan sonra odak Miktar'da; sayı kutusu harf almaz.
//   4 B2  Çok kalemli faturada kısmi iade ekrandan: ikinci kalemin miktarı 0 → yalnız birinci kalem iade edilir.
//   5 B7  Kesimi kesin reddedilecek belgede (kimliksiz alıcı, e-Arşiv) numaralı onay penceresi açılmaz; neden yazılır, belge yazılmaz.
//   6 B6  Posta Kutusu Seçin penceresi Esc ile kapanınca etiket yazılmaz; ileti "seçilmedi", çift nokta yok.
//   7 H1  EDM'ye ulaşılamazken Kaydet ve Gönder: dar kontrol 2.4.3 (kâhin BEKLENEN-AG, beklenti BİLEREK değişti) — numara VERİLMEZ; bildirim
//         "numarasız Gönderilecekler'e eklendi" der; belge Gönderilecekler'de "Gönderilecek" rozetiyle; bağlantı düzelince Tümünü Gönder numara
//         verip bir kez gönderir.
//   8 B3  Taslaklar → Seçilenleri Kaydet: onay e-Belgeyi söyler; belge numarasız Gönderilecekler'e düşer.
// Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { MULTI_VKN, OUR_VKN, startMockEdm } from "../einvoice-mock.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-fatura-243-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const edm = await startMockEdm();
const NO_ENV_PROXY = { HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "", NO_PROXY: "", no_proxy: "", HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", edocEnabled: true, edocLive: true, edocStatusPollMs: [50, 50], env: NO_ENV_PROXY });
const admin = await server.login();
const BASE = server.base;
const DEAD = "http://127.0.0.1:9/EFaturaEDM21ea/EFaturaEDM.svc";
const integrator = baseUrl => must("entegratör", admin.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
await must("firma", admin.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true }));
await integrator(edm.url);
const today = (await must("bugün", admin.get("/api/workspace/ledger/lock"))).today;
const day = offset => {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};
const person = (name, taxNo) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ").slice(1).join(" "), taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
const ayse = await must("cari", admin.post("/api/workspace/accounts", person("Ayşe Kaya", "10000000146")));
const mehmet = await must("cari", admin.post("/api/workspace/accounts", person("Mehmet Demir", "12345678950")));
const zeynep = await must("cari", admin.post("/api/workspace/accounts", person("Zeynep Şahin", "11223344550")));
const perakende = await must("cari", admin.post("/api/workspace/accounts", { name: "Kimliksiz Perakende", type: "customer", partyKind: "person", firstName: "Kimliksiz", familyName: "Perakende" }));
const multi = await must("cari", admin.post("/api/workspace/accounts", { name: "Çok Kutulu Holding", type: "customer", taxNo: MULTI_VKN, taxOffice: "Kavaklıdere", address: "Cinnah 1", district: "Çankaya", city: "Ankara" }));
await must("tedarikçi", admin.post("/api/workspace/accounts", { name: "Toptancı Kırtasiye", type: "supplier", taxNo: "1234567890", taxOffice: "Merkez", address: "A", district: "B", city: "Ankara" }));
const LONG = "Çok Uzun Adlı Paslanmaz Çelik Endüstriyel Mutfak Tezgâhı 180x70 cm Raflı ve Ayaklı Model";
const defter = await must("stok", admin.post("/api/workspace/stock", { name: "Defter Kareli", code: "DF1", unit: "Adet", unitPrice: "20", salePrice: "35", vatRate: "10", openingQty: "5" }));
const tezgah = await must("stok", admin.post("/api/workspace/stock", { name: LONG, code: "TZ1", unit: "Adet", unitPrice: "9000", salePrice: "12000", openingQty: "3" }));
const row = id => server.app.store.get("SELECT number, status, e_status AS eStatus, profile, kind, try_payable AS payable FROM invoices WHERE id = ?", id);
const count = () => server.app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
const lastId = () => server.app.store.get("SELECT id FROM invoices ORDER BY rowid DESC LIMIT 1")?.id;

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const browser = await chromium.launch();
const errors = [];
const calc400 = [];
const modal = ".hof-modal-backdrop.is-visible";
const pageInv = `${modal} .hof-invoices-modal`;
const dialog = ".hof-modal-backdrop.is-visible:last-of-type";
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`) }).catch(() => null);
const toasts = page => page.$$eval(".hof-toast-text", nodes => nodes.map(node => node.textContent)).catch(() => []);
const closeAll = async page => {
  for (let index = 0; index < 6 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const yes = await page.$(`${modal} [data-answer="yes"]`);
    if (yes) await yes.click();
  }
};
// Her adım bağımsız: bir adımın hatası (ör. eski kodda olmayan alan) sonrakileri durdurmaz; bulgu başına kırmızı görülür.
async function step(title, fn) {
  console.log(title);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ adım tamamlanamadı: ${String(error?.message || error).split("\n")[0]}`);
  }
  await closeAll(currentPage).catch(() => null);
}
let currentPage = null;
async function newForm(page, scenario, who) {
  await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
  await page.waitForSelector(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-scenario="${scenario}"]`);
  await page.waitForSelector(`${pageInv} [data-lines]`);
  await page.click(`${pageInv} [data-acc-query]`);
  await page.keyboard.type(who, { delay: 60 });
  await page.waitForSelector(`${pageInv} .hof-acc-picker li[data-id]`);
  await page.dispatchEvent(`${pageInv} .hof-acc-picker li[data-id]`, "mousedown");
  await page.waitForTimeout(300);
}
async function pickItem(page, index, query, id) {
  await page.click(`${pageInv} [data-l="${index}"][data-f="name"]`);
  await page.keyboard.type(query, { delay: 50 });
  await page.waitForSelector(`${pageInv} [data-hits="${index}"] li[data-item="${id}"]`);
  await page.click(`${pageInv} [data-hits="${index}"] li[data-item="${id}"]`);
  await page.waitForTimeout(400);
}

try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => {
    if (response.url().includes("/api/workspace/invoices/calc") && response.status() === 400) calc400.push(response.url());
  });
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open && window.HOF?.stock?.open), null, { timeout: 20000 });

  await step("■ 0 B1 Tümünü Gönder tarih sırasıyla (bugün henüz TEA numarası verilmeden; liste yeniden eskiye)", async () => {
    const w0 = await must("bekleyen", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ayse.id, issueDate: day(0), lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
    const w2 = await must("bekleyen", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: mehmet.id, issueDate: day(-2), lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
    const w1 = await must("bekleyen", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: zeynep.id, issueDate: day(-1), lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
    await page.evaluate(() => window.HOF.invoices.open({ tab: "pending" }));
    await page.waitForSelector(`${pageInv} [data-act="send-pending"]`);
    ok(/Tümünü Gönder \(3\)/.test(await textOf(page, `${pageInv} [data-act="send-pending"]`)), "düğme 3 belge");
    await page.click(`${pageInv} [data-act="send-pending"]`);
    await page.waitForSelector(`${dialog} [data-answer="yes"]`);
    await page.click(`${dialog} [data-answer="yes"]`);
    await page.waitForTimeout(3000);
    const nums = [w2, w1, w0].map(doc => row(doc.id).number);
    const seqs = nums.map(number => Number(String(number).slice(7)));
    ok(nums.every(number => /^TEA/.test(number)) && seqs[1] === seqs[0] + 1 && seqs[2] === seqs[1] + 1, `eski önce numaralandı, üçü de gönderildi: ${nums.join(", ")}`);
  });

  await step("\n■ 1 H8 Stok kartında KDV Oranı → faturada kalemin KDV'si", async () => {
    await page.evaluate(id => window.HOF.stock.open(id), defter.id || defter.item?.id);
    await page.waitForSelector(`${modal} [data-act="edit"]`);
    await page.click(`${modal} [data-act="edit"]`);
    await page.waitForSelector(`${dialog} select[name="vatRate"]`);
    ok((await page.$eval(`${dialog} select[name="vatRate"]`, node => node.value)) === "10", "kartın KDV Oranı alanı %10 gösterir");
    await page.selectOption(`${dialog} select[name="vatRate"]`, "1");
    await page.click(`${dialog} button[type="submit"]`);
    await page.waitForTimeout(800);
    ok(server.app.store.get("SELECT vat_rate AS v FROM stock_items WHERE name = 'Defter Kareli'").v === 1, "ekrandan %1 kaydedildi");
    await closeAll(page);
    await newForm(page, "goods_sale", "Ayşe");
    await pickItem(page, 0, "Defter", defter.id || defter.item?.id);
    ok((await page.$eval(`${pageInv} [data-l="0"][data-f="vatRate"]`, node => node.value)) === "1", "ürün seçilince kalemin KDV'si %1 (karttan)");
  });

  await step("\n■ 2 B8 eksi stok uyarısı kayıttan önce; B11 uzun ad ipucu", async () => {
    await newForm(page, "goods_sale", "Ayşe");
    await pickItem(page, 0, "Defter", defter.id || defter.item?.id);
    await page.click(`${pageInv} [data-l="0"][data-f="qty"]`, { clickCount: 3 });
    await page.keyboard.type("8", { delay: 80 });
    await page.waitForTimeout(300);
    const note = await textOf(page, `${pageInv} [data-stock-note="0"]`);
    ok(/Stokta 5 Adet/.test(note) && /-3 Adet \(eksi\)/.test(note), `satır uyarısı: ${note}`);
    await page.click(`${pageInv} [data-l="0"][data-f="qty"]`, { clickCount: 3 });
    await page.keyboard.type("2", { delay: 80 });
    await page.waitForTimeout(300);
    ok(!/eksi/.test(await textOf(page, `${pageInv} [data-stock-note="0"]`)), "miktar düzelince uyarı kalkar");
    await page.click(`${pageInv} [data-act="add-line"]`);
    await pickItem(page, 1, "Paslanmaz", tezgah.id || tezgah.item?.id);
    ok((await page.$eval(`${pageInv} [data-l="1"][data-f="name"]`, node => node.title)) === LONG, "uzun adın tamamı ipucunda");
    await shot(page, "fatura-243-2-uyari");
  });

  await step("\n■ 3 B12 fiyatsız kalemde 400 yok; B13 yeni kartta odak Miktar, sayı kutusu harf almaz", async () => {
    calc400.length = 0;
    await newForm(page, "goods_purchase", "Toptancı");
    await page.click(`${pageInv} [data-l="0"][data-f="name"]`);
    await page.keyboard.type("Yepyeni Zımba", { delay: 60 });
    await page.waitForSelector(`${pageInv} [data-hits="0"] li[data-new-item]`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    ok(await page.evaluate(() => document.activeElement?.dataset?.f === "qty"), `odak Miktar'da (${await page.evaluate(() => document.activeElement?.dataset?.f || document.activeElement?.tagName)})`);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("3x", { delay: 80 });
    ok((await page.$eval(`${pageInv} [data-l="0"][data-f="qty"]`, node => node.value)) === "3", "Miktar kutusu harfi almadı");
    await page.waitForTimeout(900);
    ok(!calc400.length, `fiyatsız kalemde hesap 400'ü yok (${calc400.length})`);
    ok(/Birim fiyat yazılınca/.test(await textOf(page, `${pageInv} [data-totals]`)), "toplam kutusu fiyat ister");
  });

  await step("\n■ 4 B2 çok kalemli faturada kısmi iade ekrandan", async () => {
    const twoLine = await must("satış", admin.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: mehmet.id, lines: [{ itemId: defter.id || defter.item?.id, name: "Defter Kareli", qty: 2, unitPrice: 35, vatRate: 1 }, { name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, eSend: "now" }));
    await page.evaluate(id => window.HOF.invoices.open({ id }), twoLine.id);
    await page.waitForSelector(`${pageInv} [data-act="return"]`);
    await page.click(`${pageInv} [data-act="return"]`);
    await page.waitForSelector(`${pageInv} [data-l="1"][data-f="qty"]`);
    await page.click(`${pageInv} [data-l="1"][data-f="qty"]`, { clickCount: 3 });
    await page.keyboard.type("0", { delay: 80 });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(800);
    const before = count();
    await page.click(`${pageInv} [data-form-actions] .hof-button:not(.hof-button-ghost)`);
    const asked = await page.waitForSelector(`${dialog} [data-answer="yes"]`, { timeout: 5000 }).then(() => true).catch(() => false);
    ok(asked, "iade onayı soruldu (miktarı 0 olan kalem engel olmadı)");
    if (asked) await page.click(`${dialog} [data-answer="yes"]`);
    await page.waitForTimeout(1200);
    const ret = row(lastId());
    const retLines = server.app.store.all("SELECT name, qty FROM invoice_lines WHERE invoice_id = ?", lastId());
    ok(count() === before + 1 && ret.kind === "sale_return", `iade yazıldı (${ret.kind})`);
    ok(retLines.length === 1 && retLines[0].name === "Defter Kareli" && retLines[0].qty === 2, `yalnız birinci kalem iade edildi (${JSON.stringify(retLines)})`);
    ok(Math.abs(ret.payable - 70.7) < 0.005, `iade tutarı 2 × 35 + %1 = 70,70 (${ret.payable})`);
  });

  await step("\n■ 5 B7 reddedilecek belgede numaralı onay açılmaz", async () => {
    await newForm(page, "service_sale", "Kimliksiz");
    await page.click(`${pageInv} [data-l="0"][data-f="name"]`);
    await page.keyboard.type("Hizmet", { delay: 40 });
    await page.keyboard.press("Tab");
    await page.click(`${pageInv} [data-l="0"][data-f="unitPrice"]`, { clickCount: 3 });
    await page.keyboard.type("100", { delay: 60 });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(1200);
    const n5 = count();
    const sendButton = await page.$(`${pageInv} [data-act="issue-now"]`);
    if (sendButton) await sendButton.click();
    else await page.click(`${pageInv} [data-act="issue"]`);
    const confirmShown = await page.waitForSelector(`${dialog} [data-answer="yes"]`, { timeout: 2000 }).then(() => true).catch(() => false);
    ok(!confirmShown, "numaralı onay penceresi açılmadı");
    if (confirmShown) await page.click(`${dialog} [data-answer="no"]`).catch(() => null);
    const said = `${await textOf(page, `${pageInv} [data-form-error]`)} ${(await toasts(page)).join(" ")}`;
    ok(/kaydedilemez/.test(said) && /VKN ya da TCKN/.test(said), `neden yazıldı: ${said.slice(0, 140)}`);
    ok(count() === n5, "belge yazılmadı");
  });

  await step("\n■ 6 B6 Posta Kutusu Seçin → Esc: etiket yazılmaz", async () => {
    await page.evaluate(() => window.HOF.accounts.open?.());
    await page.waitForTimeout(500);
    await closeAll(page);
    await page.evaluate(id => window.HOF.accounts.open(id), multi.id);
    await page.waitForTimeout(800);
    const editBtn = await page.$(`${modal} [data-act="edit"]`);
    if (editBtn) await editBtn.click();
    await page.waitForSelector(`${dialog} input[name="eAlias"]`);
    await page.click(`${dialog} button.hof-button-small:has-text("Mükellef Sorgula")`);
    await page.waitForSelector(`${dialog} select[name="alias"]`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    ok((await page.$eval(`${modal} input[name="eAlias"]`, node => node.value).catch(() => "?")) === "", "Esc sonrası posta kutusu boş kaldı");
    const pkToasts = (await toasts(page)).join(" | ");
    ok(/seçilmedi/.test(pkToasts) && !/yazıldı/.test(pkToasts), `ileti "seçilmedi" (${pkToasts.slice(0, 160)})`);
    ok(!/A\.Ş\.\./.test(pkToasts), "çift nokta yok");
  });

  await step("\n■ 7 H1 EDM'ye ulaşılamazken Kaydet ve Gönder", async () => {
    await integrator(DEAD);
    await newForm(page, "service_sale", "Zeynep");
    await page.click(`${pageInv} [data-l="0"][data-f="name"]`);
    await page.keyboard.type("Bakım", { delay: 40 });
    await page.keyboard.press("Tab");
    await page.click(`${pageInv} [data-l="0"][data-f="unitPrice"]`, { clickCount: 3 });
    await page.keyboard.type("300", { delay: 60 });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(1200);
    await page.click(`${pageInv} [data-act="issue-now"]`);
    await page.waitForSelector(`${dialog} [data-answer="yes"]`);
    await page.click(`${dialog} [data-answer="yes"]`);
    await page.waitForTimeout(2500);
    const unsentId = lastId();
    const unsent = row(unsentId);
    const h1 = (await toasts(page)).join(" | ");
    ok(unsent.number === "" && unsent.eStatus === "waiting", `numara verilmedi, Gönderilecekler'de (${unsent.number || "numarasız"} ${unsent.eStatus})`);
    ok(h1.includes("EDM'ye ulaşılamadı; belge numarasız Gönderilecekler'e eklendi, bağlantı gelince Tümünü Gönder ile gönderin."), `bildirim numarasız Gönderilecekler der: ${h1.slice(0, 200)}`);
    await shot(page, "fatura-243-7-h1");
    await closeAll(page);
    await integrator(edm.url);
    await page.evaluate(() => window.HOF.invoices.open({ tab: "pending" }));
    await page.waitForSelector(`${pageInv} [data-act="send-pending"]`);
    const pendingRow = await textOf(page, `${pageInv} tr[data-inv="${unsentId}"]`);
    ok(/Gönderilecek/.test(pendingRow), `belge Gönderilecekler'de "Gönderilecek" rozetiyle (${pendingRow.slice(0, 120)})`);
    ok(/Tümünü Gönder \(1\)/.test(await textOf(page, `${pageInv} [data-act="send-pending"]`)), "düğme 1 belge");
    await page.click(`${pageInv} [data-act="send-pending"]`);
    await page.waitForSelector(`${dialog} [data-answer="yes"]`);
    await page.click(`${dialog} [data-answer="yes"]`);
    await page.waitForTimeout(2500);
    const sentNo = row(unsentId).number;
    ok(["processing", "sent"].includes(row(unsentId).eStatus) && /^TEA/.test(sentNo), `bağlantı düzelince numara alıp gönderildi (${sentNo} ${row(unsentId).eStatus})`);
    ok(edm.state.sent.filter(item => item.id === sentNo).length === 1, "EDM'ye bir kez");
  });

  await step("\n■ 8 B3 Seçilenleri Kaydet → Gönderilecekler (numarasız)", async () => {
    const draft = await must("taslak", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ayse.id, lines: [{ name: "Taslak Hizmet", qty: 1, unitPrice: 250, vatRate: 20 }], payment: { rest: "open" }, status: "draft" }));
    await page.evaluate(() => window.HOF.invoices.open({ tab: "drafts" }));
    await page.waitForSelector(`${pageInv} input[data-sel="${draft.id}"]`);
    await page.click(`${pageInv} input[data-sel="${draft.id}"]`);
    await page.click(`${pageInv} [data-act="bulk-issue"]`);
    await page.waitForSelector(`${dialog} [data-answer="yes"]`);
    const bulkText = await textOf(page, dialog);
    ok(/Gönderilecekler'de bekler/.test(bulkText), `onay e-Belgeyi söyler: ${bulkText.slice(0, 200)}`);
    await page.click(`${dialog} [data-answer="yes"]`);
    await page.waitForTimeout(1500);
    ok(row(draft.id).status === "issued" && row(draft.id).eStatus === "waiting" && !row(draft.id).number, `numarasız bekliyor (${JSON.stringify(row(draft.id))})`);
  });
  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ beklenmeyen hata: ${error.stack || error}`);
} finally {
  await browser.close();
  await server.close();
  await edm.close();
  console.log(`\n${passed} geçti, ${failed} kaldı`);
  if (!process.env.EKRAN_DIR) rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
