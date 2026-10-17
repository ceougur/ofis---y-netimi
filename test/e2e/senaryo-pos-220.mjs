// Senaryo POS 2.2.0 — İz 3 EKRANDAN (docs/2.2.0-IS-LISTESI.md İz 3; plan §4, §8.7, §8.9, kabul 17–28). Gerçek kullanıcı gibi tıklanır, Tab ile
// ilerlenir, insan hızında yazılır (ders 12); her adımdan sonra sayılar sunucudan (API) okunur. Beklenen sayılar planın önceden yazılmış kabul
// tablosundan (§12.5; program kodundan türetilmez). Ekran görüntüleri artifacts/senaryo-pos-220/.
//  Ön koşul (API; 2.1.0 kabul 1–16 ekrandan senaryo-banka-210'da): Ürün A 10, Ürün B 25; Ziraat 100.000 ve Garanti 50.000 (Bakiye Doğrulandı);
//  ABC Ltd.; 20.000 fatura + Ziraat'e havale tahsilatı; Kasa'ya 10.000; Garanti'ye 20.000 transfer → Ziraat 90.000.
//  17–19  POS bankanın içinden: Ziraat → Düzenle → "POS Kullan" → "+ POS Ekle" (Ziraat Fiziki POS, Banka, BSMV Dahil, Tek Çekim %2,5, 3 Taksit
//         %3,5, valör 2 iş günü, her ay, provizyon aynı gün). NASIL BOZARIM: işaretsiz hesapta POS bölümü yok; API'den 400 pos-account-flag.
//  20–22  Satış Faturası Ürün B 10 × 1.000 peşin "+ POS" Tek Çekim (önizleme: 250 komisyon, 9.750, valör 12.10) → Ürün B 15, ABC 0, Ziraat 90.000,
//         POS Bekleyen 10.000 / 9.750; POS Ödeme Takvimi 12.10 9.750; POS İşlemleri'nde İptal Et pasif + nedeni (fatura).
//  23–24  Saat 12.10 → Şimdi Aktar → Ziraat 99.750; POS Bekleyen 0; 653 = 250; İşlem Kartı "12.10.2026 (08.10 Perşembe + 2 iş günü)"; Hareketler'de
//         POS süzgeci.
//  25–26  12.10 Satış Faturası 12 × 1.000 "+ POS" 3 Taksit (önizleme 3.860 × 3) → Ürün B 3; takvim 12.11 · 14.12 · 12.01.2027 × 3.860.
//  27–28  13.10 Satıştan İade (asıl: adım 20) 3 Adet = 3.000 "+ POS İadesi", Asıl POS İşlemi önerisi → Ürün B 6; ABC 0; iade valörü 15.10; saat
//         15.10 → Ziraat 96.750.
//  Formlar: cari tahsilatı POS (önizleme, provizyon, son 4) → POS İşlemleri'nden İptal Et (aynı gün, komisyonsuz void); POS pasifken stok satışında
//  "POS Tanımla" (form kapanmadan, kaydedilen POS seçili gelir) ve yetkisiz kullanıcıda "POS tanımlı değil, yöneticinize başvurun."; iki POS'ta
//  taksit tahsilatında seçim zorunlu; fatura Düzenle'de yalnız provizyon değişimi kayda geçer (bilinen hata, İz 3.6). Banka Ayarları'nda POS.
//  Rapor Merkezi (ders 11): POS Ödeme Takvimi her Tür, her POS ve her dönem düğmesiyle (TOPLAM = satırlar; Tüm Zamanlar ileri valörü keser
//  miydi — kesmez), PDF ve Excel TOPLAM; Banka Masraf Raporu'nda POS komisyonu (653, matrah + BSMV); Faturası Beklenen Komisyonlar boş.
// Çalıştırma: npm run test:senaryo-pos-220
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { pdfText, xlsxSheets } from "../banka-210-ortak.mjs";
import { createClient, installPageClock, moveClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-pos-220");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const BANK = "/api/workspace/bank";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-pos-220-"));
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
// Her ekran görüntüsünde o ekranın adları yazım düzenine göre de denetlenir (sonuç en sonda tek denetim).
const shot = async name => {
  if (name !== "hata") await auditLabels(name);
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const bankWin = ".hof-bank-modal";
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
/** İnsan hızında yazım (ders 12): alanı tıkla, temizle, harf harf yaz. */
const typeInto = async (selector, value) => {
  await page.click(selector);
  await page.fill(selector, "");
  await page.type(selector, value, { delay: 35 });
};
const kurus = value => Math.round(Number(value) * 100);
const balanceOf = async id => (await must("hesap", api.get(`${BANK}/accounts/${id}`))).balanceMinor;
const summary = () => must("özet", api.get(`${BANK}/summary`));
const qtyOf = async id => (await must("stok", api.get(`/api/workspace/stock/${id}`))).qty;
const partyBalance = async id => (await must("cari", api.get(`/api/workspace/accounts/${id}`))).totals.balance;
const sales = async (query = "") => (await must("POS işlemleri", api.get(`${BANK}/pos/sales${query}`))).sales;
const calendar = () => must("takvim", api.get(`${BANK}/pos/calendar`));
const integrity = async label => {
  const result = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
  const bad = (result.checks || []).filter(item => !item.ok);
  ok(result.ok !== false && bad.length === 0, `${label}: Mutabakat Testi tamam${bad.length ? ` — ${bad.map(item => item.code).join(", ")}` : ""}`);
};
const setClock = async iso => moveClock(app.config.now, page, `${iso}T10:00:00+03:00`);
const openBank = async () => {
  if (!(await page.$(`${bankWin} [data-bank] .hof-bank-tabs`))) {
    await page.click('#hof-sidecard [data-action="bank"]');
    await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 15000 });
  }
  await pause(500);
};
const bankTab = async id => {
  await openBank();
  await page.click(`${bankWin} .hof-bank-tabs [data-tab="${id}"]`);
  await pause(900);
};
const openBankAccount = async id => {
  await bankTab("accounts");
  await page.click(`${bankWin} .hof-bank-accounts tr[data-account="${id}"]`);
  await page.waitForSelector(`${bankWin} [data-confirm-line]`, { timeout: 10000 });
  await pause(700);
};
const posSub = async sub => {
  await bankTab("pos");
  await page.click(`${bankWin} [data-pos-sub="${sub}"]`);
  await pause(900);
};
const submitTop = async () => {
  await page.click(`${top} .hof-form button[type="submit"]`);
  await pause(1000);
};
/** Fatura formunu kaydeder (çıkan soruları onaylar); kaydedilen faturanın kartı açılana kadar bekler. */
const issueInvoice = async () => {
  await page.click(`${inv} [data-act="issue"]`);
  for (let i = 0; i < 20; i += 1) {
    await pause(400);
    const yes = await page.$(`${modal} [data-answer="yes"]`);
    if (yes) {
      await yes.click();
      continue;
    }
    if (await page.$(`${inv} .hof-inv-pills`)) return true;
  }
  return false;
};
const newSaleForm = async () => {
  await closeAll();
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="new"]`, { timeout: 15000 });
  await page.click(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-scenario="goods_sale"]`);
  await page.waitForSelector(`${inv} [data-lines]`, { timeout: 10000 });
  await page.fill(`${inv} [data-acc-query]`, "ABC");
  await page.waitForSelector(`${inv} .hof-acc-picker li[data-id="${ctx.abc.id}"]`, { timeout: 8000 });
  await (await page.$(`${inv} .hof-acc-picker li[data-id="${ctx.abc.id}"]`)).dispatchEvent("mousedown");
  if (!(await page.$eval(`${inv} [data-f="pricesIncludeVat"]`, node => node.checked))) await page.click(`${inv} [data-f="pricesIncludeVat"]`);
  // Ürün seçici yarışı (13.10.2026, CI #684 bc36256 "Ürün B 15/3/6/5" kırmızı — ders 20 ile zorla üretildi): yavaş koşucuda tuş aralığı
  // 180 ms debounce'u aşınca "Ürün" araması [Ürün A, Ürün B] listeler, son aramanın yanıtı gecikir; "ilk satıra bas" Ürün A'yı seçerdi (tutar,
  // cari ve banka doğru, yalnız stok yanlış). Seçim KİMLİKLE yapılır ve satırın stok kartına bağlandığı ("Stokta …") okunur.
  // POS220_YARIS=1: ön koşul zorla kurulur (son aramanın yanıtı 1,5 sn gecikir, tuş aralığı 260 ms) — düzeltmenin yeşili bu kipte de görülür.
  if (YARIS && !ctx.yarisRoute) {
    ctx.yarisRoute = true;
    await page.route(/\/api\/workspace\/invoices\/items\?q=/, async route => {
      const q = decodeURIComponent(new URL(route.request().url()).searchParams.get("q") || "");
      if (q === "Ürün B") await new Promise(resolve => setTimeout(resolve, 1500));
      await route.continue();
    });
  }
  await page.click(`${inv} [data-l="0"][data-f="name"]`);
  await page.keyboard.type("Ürün B", { delay: YARIS ? 260 : 35 });
  await page.waitForSelector(`${inv} [data-hits="0"] li[data-item="${ctx.urunB.id}"]`, { timeout: 8000 });
  await page.click(`${inv} [data-hits="0"] li[data-item="${ctx.urunB.id}"]`);
  await page.waitForFunction(({ sel }) => /Stokta/.test(document.querySelector(sel)?.closest("td")?.querySelector("small")?.textContent || ""), { sel: `${inv} [data-l="0"][data-f="name"]` }, { timeout: 8000 });
};

// Yazım düzeni ekranda (senaryo-211'in denetçisiyle aynı kural): POS ekranlarında programın ürettiği adlar her sözcüğün ilk harfi büyük.
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

const YARIS = process.env.POS220_YARIS === "1";
const ctx = {};
try {
  await api.login("admin", PASS);
  await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
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

  await step("Ön koşul (API): stok, Ziraat 100.000 + Garanti 50.000, ABC, tahsilat, Kasa'ya 10.000, transfer → Ziraat 90.000", async () => {
    ctx.urunA = await must("Ürün A", api.post("/api/workspace/stock", { kind: "goods", code: "A", name: "Ürün A", unit: "Adet", openingQty: "10" }));
    ctx.urunB = await must("Ürün B", api.post("/api/workspace/stock", { kind: "goods", code: "B", name: "Ürün B", unit: "Adet", openingQty: "25" }));
    ctx.ziraat = await must("Ziraat", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
    ctx.garanti = await must("Garanti", api.post(`${BANK}/accounts`, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } }));
    ctx.abc = await must("ABC", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
    await must("fatura A", api.post("/api/workspace/invoices", { kind: "sale", accountId: ctx.abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ itemId: ctx.urunA.id, name: "Ürün A", qty: 1, unitPrice: 20000, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
    await must("tahsilat", api.post(`/api/workspace/accounts/${ctx.abc.id}/entries`, { kind: "in", amount: "20.000", method: "bank", bankAccountId: ctx.ziraat.id, date: TODAY }));
    await must("Kasa'ya", api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "10.000", date: TODAY, bankAccountId: ctx.ziraat.id }));
    await must("transfer", api.post(`${BANK}/transfers`, { accountId: ctx.ziraat.id, toAccountId: ctx.garanti.id, amount: "20.000", date: TODAY, channel: "virman" }));
    ok((await balanceOf(ctx.ziraat.id)) === kurus(90000) && (await balanceOf(ctx.garanti.id)) === kurus(70000), "Ziraat 90.000, Garanti 70.000");
  });

  // ---------- 17–19 POS bankanın içinden ----------
  await step("17–19 Ziraat → Düzenle → \"POS Kullan\"; işaretsiz hesapta POS bölümü yok; API'den işaretsiz hesaba POS 400 pos-account-flag", async () => {
    await openBankAccount(ctx.ziraat.id);
    ok(!(await page.$(`${bankWin} [data-bank-pos]`)), "işaretsizken POS'lar bölümü yok");
    const res = await api.post(`${BANK}/pos`, { name: "Deneme", bankAccountId: ctx.ziraat.id, rates: [{ installments: 1, rate: "2" }] });
    ok(res.status === 400 && res.data?.code === "pos-account-flag", `işaretsiz hesaba POS: ${res.status} ${res.data?.code}`);
    await page.click(`${bankWin} [data-act="edit"]`);
    await page.waitForSelector(`${top} .hof-form input[name="usePos"]`, { timeout: 8000 });
    await page.check(`${top} .hof-form input[name="usePos"]`);
    await submitTop();
    await page.waitForSelector(`${bankWin} [data-bank-pos="${ctx.ziraat.id}"] [data-pos-act="add"]`, { timeout: 10000 });
    ok((await must("hesap", api.get(`${BANK}/accounts/${ctx.ziraat.id}`))).usePos === true, "Ziraat: POS Kullan işaretli (sunucu)");
    ok(/Bu hesaba bağlı POS yok/.test(await textOf(`${bankWin} [data-bank-pos="${ctx.ziraat.id}"]`)), "POS'lar bölümü: henüz POS yok");
    await shot("pos-kullan-bolum");
  });

  await step("17–19 \"+ POS Ekle\": Ziraat Fiziki POS, Banka, BSMV Dahil, valör 2 iş günü, Tek Çekim %2,5 + 3 Taksit %3,5 (Tab ile) → 108.01", async () => {
    await page.click(`${bankWin} [data-bank-pos="${ctx.ziraat.id}"] [data-pos-act="add"]`);
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} input[name="name"]`, { timeout: 8000 });
    await typeInto(`${form} input[name="name"]`, "Ziraat Fiziki POS");
    await typeInto(`${form} input[name="merchantNo"]`, "123456789");
    await page.keyboard.press("Tab");
    await page.keyboard.type("T001", { delay: 35 });
    ok((await page.$eval(`${form} select[name="providerKind"]`, node => node.value)) === "bank" && (await page.$eval(`${form} select[name="tax"]`, node => node.value)) === "bsmv_incl", "standart: Banka, BSMV Dahil");
    ok(await page.$eval(`${form} .hof-acc-picker`, node => node.hidden).catch(() => true), "BSMV kipinde Sağlayıcı Carisi gizli");
    // Ödeme Kuruluşu seçilince KDV Hariç ve Sağlayıcı Carisi görünür; geri Banka'ya.
    await page.selectOption(`${form} select[name="providerKind"]`, "payment_institution");
    ok((await page.$eval(`${form} select[name="tax"]`, node => node.value)) === "vat_excl" && !(await page.$eval(`${form} .hof-acc-picker`, node => node.hidden)), "Ödeme Kuruluşu → KDV Hariç, Sağlayıcı Carisi görünür");
    await page.selectOption(`${form} select[name="providerKind"]`, "bank");
    await typeInto(`${form} input[name="valorDays"]`, "2");
    ok((await page.$eval(`${form} select[name="installmentPayout"]`, node => node.value)) === "monthly" && (await page.$eval(`${form} input[name="provisionDays"]`, node => node.value)) === "0", "Taksit Taksit (Her Ay), provizyon 0 (aynı gün)");
    const rate0 = `${modal}:last-of-type [data-rate-row]:nth-child(1) [data-rate="rate"]`;
    await typeInto(rate0, "2,5");
    // "+ Oran Satırı": imleç yeni satırın oranında; Shift+Tab ile Taksit kutusuna, ↓ ile 2 → 3 Taksit, Tab ile orana, "3,5".
    await page.click(`${modal}:last-of-type [data-rate-add]`);
    await pause(200);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await page.keyboard.type("3,5", { delay: 35 });
    const second = await page.$eval(`${modal}:last-of-type [data-rate-row]:nth-child(2)`, row => [row.querySelector('[data-rate="installments"]').value, row.querySelector('[data-rate="rate"]').value]);
    ok(second.join("|") === "3|3,5", `ikinci oran satırı klavyeyle: ${second.join(" · ")}`);
    // NASIL BOZARIM: valör günü yazılıp oranı boş bırakılan satır sessizce düşmez.
    await page.click(`${modal}:last-of-type [data-rate-add]`);
    await pause(200);
    await page.keyboard.press("Tab");
    await page.keyboard.type("5", { delay: 35 });
    await submitTop();
    const error = await textOf(`${top} .hof-form-error`);
    ok(/oranını girin/.test(error) && (await must("POS listesi", api.get(`${BANK}/pos`))).pos.length === 0, `oransız satır: “${error}”, POS açılmadı`);
    await page.click(`${modal}:last-of-type [data-rate-row]:nth-child(3) [data-rate-remove]`);
    await shot("pos-ekle-formu");
    await submitTop();
    const list = (await must("POS listesi", api.get(`${BANK}/pos`))).pos;
    ctx.pos = list[0];
    ok(list.length === 1 && ctx.pos.glSub === "108.01" && ctx.pos.bankAccountId === ctx.ziraat.id, `POS 108.01, Ziraat'e bağlı (${list.length})`);
    ok(ctx.pos && [ctx.pos.providerKind, ctx.pos.tax, ctx.pos.valorRule, ctx.pos.valorDays, ctx.pos.installmentPayout, ctx.pos.provisionDays, ctx.pos.merchantNo, ctx.pos.terminalNo].join("|") === "bank|bsmv_incl|business|2|monthly|0|123456789|T001", `POS kuralları: ${ctx.pos && [ctx.pos.providerKind, ctx.pos.tax, ctx.pos.valorDays, ctx.pos.merchantNo, ctx.pos.terminalNo].join("|")}`);
    ok(JSON.stringify(ctx.pos?.rates?.map(rate => [rate.installments, rate.ratePpm])) === JSON.stringify([[1, 25000], [3, 35000]]), `oranlar: ${JSON.stringify(ctx.pos?.rates?.map(rate => [rate.installments, rate.ratePpm]))}`);
    await page.waitForSelector(`${bankWin} [data-pos-row="${ctx.pos.id}"]`, { timeout: 8000 });
    const row = await textOf(`${bankWin} [data-pos-row="${ctx.pos.id}"]`);
    ok(/Ziraat Fiziki POS/.test(row) && /Tek Çekim %2,50/.test(row) && /3 Taksit %3,50/.test(row) && /2 İş Günü/.test(row), `hesap ayrıntısında POS satırı: “${row}”`);
    await shot("pos-tanimli");
  });

  // ---------- 20–22 Satış Faturası peşin POS Tek Çekim ----------
  await step("20–22 Satış Faturası Ürün B 10 × 1.000 \"+ POS\" Tek Çekim: önizleme 250 · 9.750 · valör 12.10; provizyon ve son 4 Tab ile → Ürün B 15, ABC 0, Ziraat 90.000, POS Bekleyen 10.000 / 9.750", async () => {
    await newSaleForm();
    await typeInto(`${inv} [data-l="0"][data-f="qty"]`, "10");
    await typeInto(`${inv} [data-l="0"][data-f="unitPrice"]`, "1000");
    await pause(1200);
    await page.click(`${inv} [data-act="pay-add-cash"][data-method="card"]`);
    await page.waitForSelector(`${inv} [data-pos-cell="0"] [data-f="posInstallments"]`, { timeout: 8000 });
    ok(/Ziraat Fiziki POS POS'una yazılır/.test(await textOf(`${inv} [data-pos-cell="0"]`)), "tek POS: bilgi satırı");
    const options = await page.$$eval(`${inv} [data-pos-cell="0"] [data-f="posInstallments"] option`, nodes => nodes.map(node => node.textContent.trim()));
    ok(options.join(",") === "Tek Çekim,3 Taksit", `yalnız tanımlı taksitler: ${options.join(",")}`);
    await typeInto(`${inv} [data-pay="cash"][data-i="0"][data-f="amount"]`, "10.000");
    await page.keyboard.press("Tab"); // POS Taksit Sayısı
    await page.keyboard.press("Tab"); // Provizyon No
    await page.keyboard.type("PRV001", { delay: 35 });
    await page.keyboard.press("Tab");
    await page.keyboard.type("1234", { delay: 35 });
    await pause(900);
    const preview = await textOf(`${inv} [data-pos-cell="0"] [data-pos-preview]`);
    ok(/Komisyon %2,50 \(₺250,00\)/.test(preview) && /Bankaya Geçecek ₺9\.750,00/.test(preview) && /Valör 12\.10\.2026/.test(preview), `önizleme: “${preview}”`);
    await shot("fatura-pos-tek-cekim");
    ok(await issueInvoice(), "fatura kaydedildi");
    const sale = (await sales("?kind=sale")).find(item => item.grossMinor === kurus(10000));
    ctx.sale20 = sale;
    ctx.invoice20 = sale?.invoice?.id || "";
    ok(sale && sale.authCode === "PRV001" && sale.cardLast4 === "1234" && sale.installments === 1, `POS satışı: provizyon ${sale?.authCode}, son 4 ${sale?.cardLast4}`);
    ctx.q20 = [await qtyOf(ctx.urunB.id), await partyBalance(ctx.abc.id), await balanceOf(ctx.ziraat.id)];
    ok(ctx.q20[0] === 15 && ctx.q20[1] === 0 && ctx.q20[2] === kurus(90000), `Ürün B 15; ABC 0; Ziraat 90.000 (satış anında banka +0) — gelen: ${ctx.q20.join(" / ")}`);
    const s = await summary();
    ok(s.posPending.grossMinor === kurus(10000) && s.posPending.netMinor === kurus(9750), `POS Bekleyen ${s.posPending.grossMinor / 100} brüt / ${s.posPending.netMinor / 100} net`);
    await closeAll();
  });

  await step("21–22 Banka → POS: Ödeme Takvimi 12.10.2026 · ₺9.750,00; POS İşlemleri'nde faturanın satışı — İptal Et pasif, nedeni yazılı; Ayarlar'da POS", async () => {
    await posSub("calendar");
    const cal = await textOf(`${bankWin} .hof-pos-calendar`);
    ok(/12\.10\.2026/.test(cal) && /₺9\.750,00/.test(cal), `takvim: “${cal.slice(0, 160)}”`);
    ok(/POS Bekleyen \(Net\) ₺9\.750,00/.test(await textOf(`${bankWin} [data-pos-totals]`)), "POS Bekleyen (Net) kutusu 9.750");
    ok(await page.$eval(`${bankWin} [data-pos-act="settle"]`, node => node.disabled), "valör gelmeden Şimdi Aktar pasif");
    ok(/valörü gelmiş, aktarılmamış kalem yok/.test(await textOf(`${bankWin} [data-pos-settle-why]`)), "Şimdi Aktar'ın nedeni yazılı");
    await shot("pos-odeme-takvimi");
    await posSub("sales");
    const row = `${bankWin} tr[data-pos-sale="${ctx.sale20.id}"]`;
    ok(await page.$eval(`${row} [data-pos-act="void"]`, node => node.disabled), "fatura peşinde İptal Et pasif");
    ok(/Faturadan iptal edilir/.test(await textOf(`${row} [data-pos-why="void"]`)), `neden: “${await textOf(`${row} [data-pos-why="void"]`)}”`);
    await shot("pos-islemleri");
    await bankTab("settings");
    ok(await visible(`${bankWin} [data-section="pos"]`), "Banka Ayarları: POS bölümü görünür");
    const valor = await page.$eval(`${bankWin} [data-set="pos.valorRule"]`, node => node.value).catch(() => "");
    ok(valor === "business", `POS valör standardı İş Günü (${valor})`);
  });

  // ---------- 23–24 Valör günü ----------
  await step("23–24 saat 12.10 → Şimdi Aktar → Ziraat 99.750; POS Bekleyen 0; 653 = 250; İşlem Kartı valör açıklaması; Hareketler POS süzgeci", async () => {
    await closeAll();
    await setClock("2026-10-12");
    await posSub("calendar");
    ok(!(await page.$eval(`${bankWin} [data-pos-act="settle"]`, node => node.disabled)), "valörü gelince Şimdi Aktar etkin");
    ok(/Valörü Gelmiş, Aktarılmadı: 1 kalem, ₺9\.750,00/.test(await textOf(`${bankWin} [data-pos-due]`)), "Valörü Gelmiş, Aktarılmadı bilgisi");
    await page.click(`${bankWin} [data-pos-act="settle"]`);
    await pause(1500);
    ok((await balanceOf(ctx.ziraat.id)) === kurus(99750), `Ziraat ${(await balanceOf(ctx.ziraat.id)) / 100} (beklenen 99.750)`);
    const s = await summary();
    ok(s.posPending.netMinor === 0 && s.posPending.grossMinor === 0, "POS Bekleyen 0");
    const ledger = await must("mizan", api.get("/api/workspace/ledger"));
    const c653 = ledger.trial.accounts.find(row => row.code === "653")?.balance;
    ok(kurus(c653) === kurus(250), `653 = ${c653} (BSMV 11,90 dahil)`);
    await posSub("sales");
    await page.click(`${bankWin} tr[data-pos-sale="${ctx.sale20.id}"] [data-event-link]`);
    await page.waitForSelector(`${bankWin} [data-event-pos]`, { timeout: 8000 });
    const explain = await textOf(`${bankWin} [data-event-pos] [data-pos-explain]`);
    ok(explain === "12.10.2026 (08.10 Perşembe + 2 iş günü)", `İşlem Kartı valör: “${explain}”`);
    ok(/PRV001/.test(await textOf(`${bankWin} [data-event-pos]`)), "İşlem Kartı: provizyon PRV001");
    await shot("islem-karti-pos");
    await bankTab("movements");
    await page.waitForSelector(`${bankWin} [data-mv="pos"]`, { timeout: 8000 });
    await page.selectOption(`${bankWin} [data-mv="pos"]`, ctx.pos.id);
    await pause(1200);
    const rows = await page.$$eval(`${bankWin} [data-moves="main"] tr[data-event]`, nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ")));
    ok(rows.length === 1 && /9\.750,00/.test(rows[0]), `Hareketler POS süzgeci: ${rows.length} satır ${rows[0] || ""}`);
    await shot("hareketler-pos-suzgec");
    await integrity("23–24");
  });

  // ---------- 25–26 Taksitli POS ----------
  await step("25–26 12.10 Satış Faturası 12 × 1.000 \"+ POS\" 3 Taksit: önizleme 3.860 × 3 · İlk Valör 12.11.2026 → Ürün B 3; takvim 12.11 · 14.12 · 12.01.2027", async () => {
    await newSaleForm();
    await typeInto(`${inv} [data-l="0"][data-f="qty"]`, "12");
    await typeInto(`${inv} [data-l="0"][data-f="unitPrice"]`, "1000");
    await pause(1200);
    await page.click(`${inv} [data-act="pay-add-cash"][data-method="card"]`);
    await page.waitForSelector(`${inv} [data-pos-cell="0"] [data-f="posInstallments"]`, { timeout: 8000 });
    await typeInto(`${inv} [data-pay="cash"][data-i="0"][data-f="amount"]`, "12.000");
    await page.selectOption(`${inv} [data-pos-cell="0"] [data-f="posInstallments"]`, "3");
    await pause(900);
    const preview = await textOf(`${inv} [data-pos-cell="0"] [data-pos-preview]`);
    ok(/Komisyon %3,50 \(₺420,00\)/.test(preview) && /Bankaya Geçecek ₺3\.860,00 × 3/.test(preview) && /İlk Valör 12\.11\.2026/.test(preview), `önizleme: “${preview}”`);
    await shot("fatura-pos-3-taksit");
    ok(await issueInvoice(), "fatura kaydedildi");
    ctx.q25 = await qtyOf(ctx.urunB.id);
    ok(ctx.q25 === 3, `Ürün B 3 — gelen ${ctx.q25}`);
    const cal = await calendar();
    ok(JSON.stringify(cal.rows.map(row => [row.valueDate, row.netMinor])) === JSON.stringify([["2026-11-12", kurus(3860)], ["2026-12-14", kurus(3860)], ["2027-01-12", kurus(3860)]]), `takvim: ${JSON.stringify(cal.rows.map(row => [row.valueDate, row.netMinor / 100]))}`);
    const s = await summary();
    ok(s.posPending.netMinor === kurus(11580) && s.posPending.grossMinor === kurus(12000), `bekleyen net ${s.posPending.netMinor / 100} (11.580), brüt ${s.posPending.grossMinor / 100} (12.000)`);
    await closeAll();
  });

  // ---------- 27–28 Satıştan İade, POS İadesi ----------
  await step("27–28 13.10 Satıştan İade (asıl: adım 20) Ürün B 3 Adet = 3.000 \"+ POS İadesi\", Asıl POS İşlemi önerisi → Ürün B 6; ABC 0; iade valörü 15.10", async () => {
    await setClock("2026-10-13");
    await page.evaluate(id => HOF.invoices.openDoc(id), ctx.invoice20);
    await page.waitForSelector(`${inv} [data-act="return"]`, { timeout: 10000 });
    await page.click(`${inv} [data-act="return"]`);
    await page.waitForSelector(`${inv} [data-l="0"][data-f="qty"]`, { timeout: 10000 });
    await typeInto(`${inv} [data-l="0"][data-f="qty"]`, "3");
    await pause(1200);
    const add = await page.$(`${inv} [data-act="pay-add-cash"][data-method="card"]`);
    ok(add && (await add.textContent()).trim() === "+ POS İadesi", `düğme: “${add ? (await add.textContent()).trim() : "yok"}”`);
    await add.click();
    await page.waitForSelector(`${inv} [data-pos-cell="0"] [data-f="posRefundOf"]`, { timeout: 8000 });
    await typeInto(`${inv} [data-pay="cash"][data-i="0"][data-f="amount"]`, "3.000");
    await pause(800);
    const origins = await page.$$eval(`${inv} [data-pos-cell="0"] [data-f="posRefundOf"] option`, nodes => nodes.map(node => [node.value, node.textContent.trim()]));
    const suggestion = origins.find(([value]) => value === ctx.sale20.id);
    ok(Boolean(suggestion) && /₺10\.000,00/.test(suggestion?.[1] || ""), `asıl işlem önerisi: ${JSON.stringify(origins.map(item => item[1]))}`);
    await page.selectOption(`${inv} [data-pos-cell="0"] [data-f="posRefundOf"]`, ctx.sale20.id);
    await shot("satistan-iade-pos-iadesi");
    ok(await issueInvoice(), "iade faturası kaydedildi");
    ctx.q27 = [await qtyOf(ctx.urunB.id), await partyBalance(ctx.abc.id)];
    ok(ctx.q27[0] === 6 && ctx.q27[1] === 0, `Ürün B 6; ABC 0 — gelen ${ctx.q27.join(" / ")}`);
    const refund = (await sales("?kind=refund")).find(item => item.origin?.id === ctx.sale20.id);
    ok(refund && refund.grossMinor === kurus(3000) && refund.items.some(item => item.valueDate === "2026-10-15"), `iade: ${refund?.grossMinor / 100}, valör ${refund?.items?.map(item => item.valueDate).join(",")}`);
    const origin = (await sales("?kind=sale")).find(item => item.id === ctx.sale20.id);
    ok(origin.refundedMinor === kurus(3000) && origin.grossMinor >= origin.refundedMinor, "Σ iade 3.000 ≤ 10.000");
    await closeAll();
    await setClock("2026-10-15");
    await posSub("calendar");
    await page.click(`${bankWin} [data-pos-act="settle"]`);
    await pause(1500);
    ok((await balanceOf(ctx.ziraat.id)) === kurus(96750), `15.10 Ziraat ${(await balanceOf(ctx.ziraat.id)) / 100} (beklenen 96.750)`);
    await integrity("27–28");
  });

  // ---------- Cari tahsilatı POS + İptal Et (void) ----------
  await step("Cari tahsilatı 500 POS (önizleme, provizyon, son 4) → POS İşlemleri → İptal Et (aynı gün, komisyonsuz void) → ABC bakiyesi geri döner", async () => {
    await closeAll();
    const before = await partyBalance(ctx.abc.id);
    await page.evaluate(id => HOF.accounts.open(id), ctx.abc.id);
    await page.waitForSelector('.hof-accounts-modal [data-entry="in"]', { timeout: 10000 });
    await page.click('.hof-accounts-modal [data-entry="in"]');
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await typeInto(`${form} input[name="amount"]`, "500");
    await page.selectOption(`${form} select[name="method"]`, "card");
    await page.waitForSelector(`${form} [data-pos-pick]:not([hidden]) select[name="posInstallments"]`, { timeout: 8000 });
    await typeInto(`${form} input[name="authCode"]`, "CARI77");
    await page.keyboard.press("Tab");
    await page.keyboard.type("9876", { delay: 35 });
    await pause(900);
    const preview = await textOf(`${form} [data-pos-preview]`);
    ok(/Komisyon %2,50 \(₺12,50\)/.test(preview) && /Bankaya Geçecek ₺487,50/.test(preview) && /Valör 19\.10\.2026/.test(preview), `önizleme: “${preview}”`);
    await shot("cari-tahsilat-pos");
    await submitTop();
    const sale = (await sales("?kind=sale")).find(item => item.authCode === "CARI77");
    ok(sale && sale.cardLast4 === "9876" && sale.party?.id === ctx.abc.id && sale.status === "active", "cari POS satışı (provizyon CARI77, son 4 9876)");
    ok((await partyBalance(ctx.abc.id)) === before - 500, "ABC 500 alacaklandı");
    await closeAll();
    await posSub("sales");
    const row = `${bankWin} tr[data-pos-sale="${sale.id}"]`;
    await page.waitForSelector(row, { timeout: 8000 });
    ok(!(await page.$eval(`${row} [data-pos-act="void"]`, node => node.disabled)), "provizyon içinde İptal Et etkin");
    await page.click(`${row} [data-pos-act="void"]`);
    await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
    await page.click(`${top} [data-answer="yes"]`);
    await pause(1500);
    const voided = (await sales("?kind=sale&status=")).find(item => item.id === sale.id);
    ok(voided?.status === "void", `durum: ${voided?.status}`);
    ok((await partyBalance(ctx.abc.id)) === before, "ABC bakiyesi eski hâline döndü (cari tahsilatı silindi)");
    // Bankaya geçmiş satışta (adım 20) İptal Et pasif ve nedeni: "Bankaya geçti; POS İadesi yapın." (süzgeç Etkin; iptal edilen listeden çıktı)
    ok(!(await page.$(row)), "iptal edilen satış Etkin süzgecinde yok");
    ok(/Bankaya geçti/.test(await textOf(`${bankWin} tr[data-pos-sale="${ctx.sale20.id}"] [data-pos-why="void"]`)), "bankaya geçmiş satışta İptal Et nedeni");
    await integrity("cari void");
  });

  // ---------- POS Tanımla (form kapanmadan) ve yetkisiz yazısı ----------
  await step("Ziraat Fiziki POS → Pasife Al; yetkisiz (avukat) cari tahsilatında POS: \"POS tanımlı değil, yöneticinize başvurun.\" (düğme yok)", async () => {
    await closeAll();
    await openBankAccount(ctx.ziraat.id);
    await page.click(`${bankWin} [data-pos-row="${ctx.pos.id}"] [data-pos-act="status"]`);
    await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
    await page.click(`${top} [data-answer="yes"]`);
    await pause(1200);
    ok((await must("POS", api.get(`${BANK}/pos/${ctx.pos.id}`))).status === "passive", "POS pasif");
    ok(/Sil kapalı: POS kullanılmış/.test(await textOf(`${bankWin} [data-bank-pos="${ctx.ziraat.id}"] [data-pos-blocks]`)), "kullanılmış POS'ta Sil'in nedeni yazılı");
    await must("avukat", api.post("/api/admin/users", { username: "avukat-pos", name: "Avukat POS", role: "avukat", password: "Avukat-2026!", mustChangePassword: false }));
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
    const other = await context2.newPage();
    other.on("pageerror", error => errors.push(`pageerror (avukat) ${error.message}`));
    await installPageClock(other, app.config.now);
    await other.goto(`${BASE}/`);
    await other.fill("#hof-auth input[name=username]", "avukat-pos");
    await other.fill("#hof-auth input[name=password]", "Avukat-2026!");
    await Promise.all([other.waitForEvent("load"), other.click('#hof-auth button[type="submit"]')]);
    await other.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await other.waitForTimeout(800);
    await other.evaluate(id => HOF.accounts.open(id), ctx.abc.id);
    await other.waitForSelector('.hof-accounts-modal [data-entry="in"]', { timeout: 10000 });
    await other.click('.hof-accounts-modal [data-entry="in"]');
    const form = `${top} .hof-form`;
    await other.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await other.selectOption(`${form} select[name="method"]`, "card");
    await other.waitForSelector(`${form} [data-bank-define-missing="pos"]`, { timeout: 8000 });
    ok((await other.$eval(`${form} [data-bank-define-missing="pos"]`, node => node.textContent.trim())) === "POS tanımlı değil, yöneticinize başvurun.", "yetkisiz yazısı");
    ok(!(await other.$(`${form} [data-bank-define="pos"]`)), "POS Tanımla düğmesi yok");
    await other.screenshot({ path: path.join(OUT, "00-avukat-pos-tanimli-degil.png") });
    await context2.close();
  });

  await step("Stok satışı (Ürün B 1 × 1.000) → POS: \"POS Tanımla\" → Vazgeç (form aynen) → tanımla (Ziraat Mobil POS) → seçili gelir → kaydet → satış yeni POS'ta", async () => {
    await closeAll();
    await page.evaluate(id => HOF.stock.open(id), ctx.urunB.id);
    await page.waitForSelector('[data-move="out"]', { timeout: 10000 });
    await page.click('[data-move="out"]');
    const form = `${modal} .hof-form:has(select[name="pay"])`;
    await page.waitForSelector(`${form} input[name="qty"]`, { timeout: 8000 });
    await typeInto(`${form} input[name="qty"]`, "1");
    await typeInto(`${form} input[name="unitPrice"]`, "1.000");
    await page.selectOption(`${form} select[name="pay"]`, "card");
    await page.waitForSelector(`${form} [data-bank-define="pos"]`, { timeout: 8000 });
    await shot("stok-pos-tanimla");
    await page.click(`${form} [data-bank-define="pos"]`);
    await page.waitForSelector(`${top} .hof-form input[name="name"]`, { timeout: 8000 });
    ok(/POS Tanımla/.test(await textOf(`${top} .hof-modal-title`)), "üstte POS Tanımla penceresi");
    await page.click(`${top} [data-cancel]`);
    await pause(500);
    ok((await page.$eval(`${form} input[name="qty"]`, node => node.value)) === "1" && (await page.$eval(`${form} select[name="pay"]`, node => node.value)) === "card", "Vazgeç: stok formu aynen");
    await page.click(`${form} [data-bank-define="pos"]`);
    await page.waitForSelector(`${top} .hof-form input[name="name"]`, { timeout: 8000 });
    await typeInto(`${top} .hof-form input[name="name"]`, "Ziraat Mobil POS");
    await page.selectOption(`${top} .hof-form select[name="kind"]`, "mobile");
    await typeInto(`${modal}:last-of-type [data-rate-row]:nth-child(1) [data-rate="rate"]`, "2");
    await submitTop();
    await page.waitForSelector(`${form} [data-pos-pick] [data-pos-single]`, { timeout: 8000 });
    ok(/Ziraat Mobil POS POS'una yazılır/.test(await textOf(`${form} [data-pos-pick]`)), "kaydedilen POS formda seçili (tek etkin POS)");
    ok((await page.$eval(`${form} input[name="qty"]`, node => node.value)) === "1", "tanımdan sonra miktar yerinde");
    await page.click(`${form} button[type="submit"]`);
    await pause(1500);
    const mobile = (await must("POS listesi", api.get(`${BANK}/pos`))).pos.find(item => item.name === "Ziraat Mobil POS");
    ctx.mobile = mobile;
    const sale = (await sales(`?pos=${mobile?.id || "-"}`))[0];
    ok(mobile?.glSub === "108.02" && sale?.grossMinor === kurus(1000) && sale.items[0]?.valueDate === "2026-10-16", `stok satışı Ziraat Mobil POS'ta (108.02): ${sale?.grossMinor / 100}, valör ${sale?.items?.[0]?.valueDate}`);
    ctx.q508 = await qtyOf(ctx.urunB.id);
    ok(ctx.q508 === 5, `Ürün B 5 — gelen ${ctx.q508}`);
    await closeAll();
  });

  await step("İki etkin POS: Ziraat Fiziki POS → Etkinleştir; taksit tahsilatı (POS seçimi zorunlu, 3 Taksit önizleme) → seçilen POS'a", async () => {
    await openBankAccount(ctx.ziraat.id);
    await page.click(`${bankWin} [data-pos-row="${ctx.pos.id}"] [data-pos-act="status"]`);
    await pause(1200);
    ok((await must("POS", api.get(`${BANK}/pos/${ctx.pos.id}`))).status === "active", "Ziraat Fiziki POS etkin");
    await closeAll();
    const plan = await must("kart", api.post("/api/workspace/plans", { accountId: ctx.abc.id, name: "ABC Ltd.", total: "6.000", mode: "auto", count: 2, firstDue: "2026-11-15" }));
    await page.evaluate(id => HOF.plans.open(id), plan.id);
    await page.waitForSelector('.hof-plans-modal [data-act="pay"]', { timeout: 10000 });
    await page.click('.hof-plans-modal [data-act="pay"]');
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await typeInto(`${form} input[name="amount"]`, "3.000");
    await page.selectOption(`${form} select[name="method"]`, "card");
    await page.waitForSelector(`${form} [data-pos-pick]:not([hidden]) select[name="posId"]`, { timeout: 8000 });
    const posOptions = await page.$$eval(`${form} select[name="posId"] option`, nodes => nodes.map(node => node.textContent.trim()));
    ok(posOptions.some(label => /Ziraat Fiziki POS/.test(label)) && posOptions.some(label => /Ziraat Mobil POS/.test(label)), `POS seçenekleri: ${posOptions.join(" | ")}`);
    await page.selectOption(`${form} select[name="posId"]`, ctx.pos.id);
    await page.selectOption(`${form} select[name="posInstallments"]`, "3");
    await pause(900);
    const preview = await textOf(`${form} [data-pos-preview]`);
    ok(/Komisyon %3,50 \(₺105,00\)/.test(preview) && /Bankaya Geçecek ₺965,00 × 3/.test(preview), `önizleme: “${preview}”`);
    await shot("taksit-tahsilat-pos");
    await submitTop();
    const card = await must("kart", api.get(`/api/workspace/plans/${plan.id}`));
    const entry = card.entries.find(item => item.kind === "in");
    const sale = (await sales(`?row=${encodeURIComponent(`plan_entries:${entry?.id}`)}`))[0];
    ok(entry?.method === "card" && entry?.finRef === ctx.pos.id && sale?.installments === 3 && card.totals.remaining === 3000, `taksit tahsilatı Ziraat Fiziki POS'ta, 3 taksit; kalan ${card.totals.remaining}`);
    await closeAll();
    await integrity("iki POS");
  });

  await step("Bilinen hata (İz 3.6) ekrandan: fatura Düzenle'de yalnız provizyon (PRV001 → PRV009) değişince POS kaydı güncellenir", async () => {
    await closeAll();
    // Taksitli fatura (adım 25) bekliyor: Düzenle serbest; provizyonu girilmemişti → PRV009.
    const sale = (await sales("?kind=sale")).find(item => item.installments === 3 && item.invoice);
    await page.evaluate(id => HOF.invoices.openDoc(id), sale.invoice.id);
    await page.waitForSelector(`${inv} [data-act="modify"], ${inv} [data-act="edit"]`, { timeout: 10000 });
    await page.click(`${inv} [data-act="modify"], ${inv} [data-act="edit"]`);
    await page.waitForSelector(`${inv} [data-pos-cell="0"] [data-f="authCode"]`, { timeout: 10000 });
    ok((await page.$eval(`${inv} [data-pos-cell="0"] [data-f="posInstallments"]`, node => node.value)) === "3", "Düzenle: POS Taksit Sayısı 3 dolu geldi");
    await typeInto(`${inv} [data-pos-cell="0"] [data-f="authCode"]`, "PRV009");
    await pause(600);
    ok(await issueInvoice(), "düzenleme kaydedildi");
    const after = (await sales("?kind=sale")).filter(item => item.invoice?.id === sale.invoice.id && item.status === "active");
    ok(after.length === 1 && after[0].authCode === "PRV009" && after[0].installments === 3 && after[0].id === sale.id, `POS kaydı: ${JSON.stringify(after.map(item => [item.authCode, item.installments, item.id === sale.id]))}`);
    await closeAll();
    await integrity("provizyon düzeltmesi");
  });

  // ---------- Rapor Merkezi (ders 11: her süzgeç, her seçenek; TOPLAM = satırlar; PDF ve Excel) ----------
  // Bağımsız beklenen (plan oranlarıyla elle): Fiziki 12.000 / 3 Taksit %3,5 → 3 × 4.000 brüt, 3 × 3.860 net (12.11 · 14.12 · 12.01.2027);
  // Fiziki taksit tahsilatı 3.000 / 3 Taksit %3,5 → 3 × 1.000 brüt, 3 × 965 net (ilki 1 ay sonra: 15.11 Pazar → 16.11, 15.12, 15.01.2027);
  // Mobil 1.000 Tek Çekim %2 → 980 net, valör 16.10. Bekleyen: brüt 16.000, net 15.455 (Fiziki 14.475, Mobil 980). Blokeli ve Komisyon Tahsili yok.
  // Banka Masraf Raporu: adım 23–24'te 653'e giden 250 (BSMV Dahil %5: matrah 238,10 + BSMV 11,90); iade "İade Edilmez" → değişmez.
  const num = text => Number(String(text || "").replace(/[^\d,-]/g, "").replace(",", "."));
  const rcPreview = () =>
    page.evaluate(selector => {
      const main = document.querySelector(`${selector} [data-rc-main]`);
      const text = node => node.textContent.replace(/\s+/g, " ").trim();
      return {
        heads: [...(main?.querySelectorAll("thead th") || [])].map(text),
        rows: [...(main?.querySelectorAll("tbody tr") || [])].map(row => [...row.querySelectorAll("td")].map(text)).filter(cells => cells.length > 1),
        footer: main?.querySelector("tfoot tr") ? [...main.querySelectorAll("tfoot td")].map(text) : null,
        links: [...(main?.querySelectorAll(".hof-rep-out") || [])].map(link => link.getAttribute("href")),
        text: main ? text(main) : "",
      };
    }, modal);
  const waitRc = async (check, ms = 8000) => {
    const deadline = Date.now() + ms;
    let last = await rcPreview();
    while (!check(last) && Date.now() < deadline) {
      await pause(250);
      last = await rcPreview();
    }
    return last;
  };
  const download = async href => {
    const got = await page.evaluate(async url => {
      const response = await fetch(window.HOF.apiUrl ? window.HOF.apiUrl(url) : url);
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
      return { status: response.status, base64: btoa(binary) };
    }, href);
    return { status: got.status, buffer: Buffer.from(got.base64, "base64") };
  };
  await step("Raporlar → POS Ödeme Takvimi: 7 satır, TOPLAM brüt 16.000 / net 15.455 = satırlar; her Tür ve POS seçeneği; PDF ve Excel TOPLAM", async () => {
    await closeAll();
    await page.click('#hof-sidecard [data-action="analytics"]');
    await page.waitForSelector(`${modal} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
    await page.click(`${modal} .hof-rep-tab[data-tab="all"]`);
    await page.waitForSelector(`${modal} [data-rc-list] [data-report="pos-odeme-takvimi"]`, { timeout: 15000 });
    await page.click(`${modal} [data-rc-list] [data-report="pos-odeme-takvimi"]`);
    let data = await waitRc(view => view.rows.length === 7 && view.footer);
    const col = header => data.heads.indexOf(header);
    const sum = (rows, header) => Math.round(rows.reduce((total, cells) => total + num(cells[col(header)]), 0) * 100);
    ok(data.rows.length === 7 && data.rows.map(cells => cells[col("Valör Günü")]).join(",") === "16.10.2026,12.11.2026,16.11.2026,14.12.2026,15.12.2026,12.01.2027,15.01.2027", `valör günleri: ${data.rows.map(cells => cells[col("Valör Günü")]).join(", ")}`);
    ok(Math.round(num(data.footer?.[col("Brüt")]) * 100) === kurus(16000) && Math.round(num(data.footer?.[col("Net (Bankaya Geçecek)")]) * 100) === kurus(15455), `TOPLAM: ${data.footer?.join(" | ")}`);
    ok(sum(data.rows, "Brüt") === kurus(16000) && sum(data.rows, "Net (Bankaya Geçecek)") === kurus(15455), "TOPLAM = satırların toplamı (brüt ve net)");
    await shot("rapor-pos-odeme-takvimi");
    const [pdfHref, xlsxHref] = data.links;
    const pdf = await download(pdfHref);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    ok(pdf.status === 200 && text.includes("POS Ödeme Takvimi") && text.includes("15.455,00") && text.includes("16.000,00"), "PDF: başlık ve TOPLAM tutarları");
    const xlsx = await download(xlsxHref);
    const book = Object.values(xlsxSheets(xlsx.buffer))[0];
    const sheet = book.slice(Math.max(0, book.findIndex(row => row.length > 1)));
    const last = sheet.at(-1) || [];
    ok(xlsx.status === 200 && last[0] === "TOPLAM" && Math.round(Number(last[sheet[0].indexOf("Net (Bankaya Geçecek)")]) * 100) === kurus(15455), `Excel TOPLAM: ${last.join(" | ")}`);
    // Her Tür seçeneği: POS (7 satır), Blokeli POS ve Komisyon Tahsili (boş, TOPLAM yok ya da 0), Tümü (7 satır).
    for (const [value, rows, net] of [["pos", 7, 15455], ["blocked", 0, 0], ["fee", 0, 0], ["", 7, 15455]]) {
      await page.selectOption(`${modal} [data-param="posKind"]`, value);
      data = await waitRc(view => view.rows.length === rows);
      const footNet = data.footer ? Math.round(num(data.footer[col("Net (Bankaya Geçecek)")]) * 100) : 0;
      ok(data.rows.length === rows && footNet === kurus(net) && sum(data.rows, "Net (Bankaya Geçecek)") === kurus(net), `Tür “${value || "Tümü"}”: ${data.rows.length} satır, TOPLAM net ${footNet / 100}`);
    }
    // Her POS seçeneği: Tüm POS'lar 15.455; Fiziki 6 satır 14.475; Mobil 1 satır 980.
    const posOptions = await page.$$eval(`${modal} [data-param="posTerminal"] option`, nodes => nodes.map(node => [node.value, node.textContent.trim()]));
    ok(posOptions.length === 3 && posOptions[0][1] === "Tüm POS'lar", `POS seçenekleri: ${posOptions.map(item => item[1]).join(" | ")}`);
    for (const [value, rows, net] of [[ctx.pos.id, 6, 14475], [ctx.mobile?.id || "-", 1, 980], ["", 7, 15455]]) {
      await page.selectOption(`${modal} [data-param="posTerminal"]`, value);
      data = await waitRc(view => view.rows.length === rows);
      ok(data.rows.length === rows && Math.round(num(data.footer?.[col("Net (Bankaya Geçecek)")]) * 100) === kurus(net) && sum(data.rows, "Net (Bankaya Geçecek)") === kurus(net), `POS “${posOptions.find(item => item[0] === value)?.[1]}”: ${data.rows.length} satır, TOPLAM net ${num(data.footer?.[col("Net (Bankaya Geçecek)")])}`);
    }
    // Her dönem düğmesi (bugün 15.10.2026; aralık valör gününe göre): Bu Ay 16.10 → 980; Geçen Ay ve Son 30 Gün (bugünle biter) boş;
    // Bu Yıl 5 satır (16.10 … 15.12) 10.630; Tüm Zamanlar bütün bekleyenler 15.455 (ileri valör bugünle kesilmez).
    for (const [preset, rows, net] of [["thisMonth", 1, 980], ["lastMonth", 0, 0], ["last30", 0, 0], ["thisYear", 5, 10630], ["all", 7, 15455]]) {
      await page.click(`${modal} [data-rc-main] [data-preset="${preset}"]`);
      data = await waitRc(view => view.rows.length === rows);
      const footNet = data.footer ? Math.round(num(data.footer[col("Net (Bankaya Geçecek)")]) * 100) : 0;
      ok(data.rows.length === rows && footNet === kurus(net) && sum(data.rows, "Net (Bankaya Geçecek)") === kurus(net), `dönem ${preset}: ${data.rows.length} satır, TOPLAM net ${footNet / 100}`);
    }
  });

  await step("Raporlar → POS Satış Raporu ve POS Komisyon Raporu (İz 5.3): satırlar = POS işlemleri, TOPLAM = satırlar, iki raporun Net'i aynı; Tür ve Dönem süzgeçleri; PDF ve Excel", async () => {
    await page.click(`${modal} [data-rc-list] [data-report="pos-satis"]`);
    let data = await waitRc(view => view.rows.length >= 1 && view.footer);
    let col = header => data.heads.indexOf(header);
    const sumOf = (rows, header) => Math.round(rows.reduce((total, cells) => total + num(cells[col(header)]), 0) * 100);
    const satisNet = Math.round(num(data.footer[col("Net")]) * 100);
    ok(sumOf(data.rows, "Net") === satisNet && sumOf(data.rows, "Brüt") === Math.round(num(data.footer[col("Brüt")]) * 100), `POS Satış: TOPLAM = satırlar (net ${satisNet / 100})`);
    ok(data.rows.every(cells => /^(POS Satışı|POS İadesi|POS İptal İadesi)$/.test(cells[col("Tür")]) && cells[col("Kip")] === "BSMV Dahil" && cells[col("POS")]), `satırlar: ${data.rows.map(cells => cells.join(" | ")).join("\n")}`);
    const satisRows = data.rows.filter(cells => cells[col("Tür")] === "POS Satışı").length;
    await page.selectOption(`${modal} [data-param="posSale"]`, "sale");
    data = await waitRc(view => view.rows.length === satisRows);
    ok(data.rows.length === satisRows && data.rows.every(cells => cells[col("Tür")] === "POS Satışı"), `Tür süzgeci yalnız satışlar (${data.rows.length})`);
    await page.selectOption(`${modal} [data-param="posSale"]`, "");
    await shot("rapor-pos-satis");
    const pdf = await download(data.links[0]);
    const xlsx = await download(data.links[1]);
    ok(pdf.status === 200 && pdfText(pdf.buffer).includes("POS Satış Raporu") && xlsx.status === 200, "POS Satış PDF ve Excel");
    await page.click(`${modal} [data-rc-list] [data-report="pos-komisyon"]`);
    data = await waitRc(view => view.rows.length >= 1 && view.footer);
    col = header => data.heads.indexOf(header);
    const komisyonNet = Math.round(num(data.footer[col("Net")]) * 100);
    ok(komisyonNet === satisNet && sumOf(data.rows, "Komisyon") === Math.round(num(data.footer[col("Komisyon")]) * 100) && data.footer[col("Kesinti %")] === "", `POS Komisyon: TOPLAM net ${komisyonNet / 100} = POS Satış net; oran toplanmaz`);
    ok(data.rows.every(cells => /^(Ekim|Kasım|Aralık|Eylül) \d{4}$/.test(cells[col("Dönem")])), `aylık dönem satırları: ${data.rows.map(cells => cells[col("Dönem")]).join(", ")}`);
    await page.selectOption(`${modal} [data-param="posPeriod"]`, "year");
    data = await waitRc(view => view.rows.length >= 1 && view.rows.every(cells => /^\d{4}$/.test(cells[0])));
    ok(data.rows.every(cells => cells[0] === "2026") && Math.round(num(data.footer[col("Net")]) * 100) === satisNet, `yıllık: ${data.rows.map(cells => cells.join(" | ")).join(" · ")}`);
    await shot("rapor-pos-komisyon");
    await auditLabels("POS Komisyon Raporu");
  });

  await step("Raporlar → Banka Masraf Raporu: POS komisyonu 653 · matrah 238,10 + BSMV 11,90 = 250; Faturası Beklenen Komisyonlar boş (KDV'li POS yok)", async () => {
    await page.click(`${modal} [data-rc-list] [data-report="banka-masraf"]`);
    let data = await waitRc(view => view.rows.length >= 1 && view.footer);
    const col = header => data.heads.indexOf(header);
    const posRow = data.rows.find(cells => /Ziraat Fiziki POS/.test(cells[col("Masraf Türü")] || ""));
    ok(posRow && posRow[col("Hesap Kodu")].startsWith("653") && num(posRow[col("Matrah")]) === 238.1 && num(posRow[col("BSMV")]) === 11.9 && num(posRow[col("Toplam")]) === 250, `POS komisyon satırı: ${posRow?.join(" | ")}`);
    ok(num(data.footer?.[col("Toplam")]) === 250 && data.rows.length === 1, `TOPLAM: ${data.footer?.join(" | ")}`);
    await shot("rapor-banka-masraf-pos");
    await page.click(`${modal} [data-rc-list] [data-report="faturasi-beklenen-komisyonlar"]`);
    data = await waitRc(view => /Faturası Beklenen Komisyonlar/.test(view.text) && view.rows.length === 0);
    ok(data.rows.length === 0, `Faturası Beklenen Komisyonlar: ${data.rows.length} satır (KDV'li POS yok)`);
    await closeAll();
  });

  await step("POS sekmesi: Onay Bekleyen ve Komisyon Faturaları boş durum metni; POS'lar listesi iki POS", async () => {
    await posSub("awaiting");
    ok(/Onay bekleyen geçiş yok/.test(await textOf(`${bankWin} [data-pos-body]`)), "Onay Bekleyen boş");
    await auditLabels("Onay Bekleyen");
    await posSub("commission");
    ok(/KDV'li \(faturalı\) komisyon kipinde POS yok/.test(await textOf(`${bankWin} [data-pos-body]`)), "Komisyon Faturaları: KDV'li POS yok");
    await auditLabels("Komisyon Faturaları");
    // Ekleme ve oran formları (aç → Vazgeç; hiçbir şey yazılmaz).
    await posSub("terminals");
    await page.click(`${bankWin} [data-pos-row="${ctx.pos.id}"] [data-pos-act="rates"]`);
    await page.waitForSelector(`${top} [data-rate-row]`, { timeout: 8000 });
    await auditLabels("Komisyon Oranları formu");
    await page.click(`${top} [data-cancel]`);
    await pause(400);
    await page.click(`${bankWin} [data-pos-row="${ctx.pos.id}"] [data-pos-act="edit"]`);
    await page.waitForSelector(`${top} .hof-form input[name="name"]`, { timeout: 8000 });
    await auditLabels("POS'u Düzenle formu");
    await page.click(`${top} [data-cancel]`);
    await pause(400);
    await posSub("terminals");
    const rows = await page.$$eval(`${bankWin} [data-pos-row]`, nodes => nodes.length);
    ok(rows === 2, `POS'lar: ${rows}`);
    await shot("pos-listesi");
    await closeAll();
  });
} catch (error) {
  failed += 1;
  console.log(`✗ kurulum hatası: ${error.stack || error.message}`);
} finally {
  ok(labelProblems.size === 0, `POS ekranlarında yazım düzeni (her sözcüğün ilk harfi büyük)${labelProblems.size ? `: ${[...labelProblems].slice(0, 8).map(([label, where]) => `“${label}” (${where})`).join(", ")}` : ""}`);
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-pos-220: ${passed} geçti, ${failed} kaldı · ekran görüntüleri ${OUT}`);
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
