// Gerçek kullanıcı senaryosu (v2.0.11): müşterinin 8 düzeltmesi sıfır kurulumdan, arayüzden ve modüller arası
// rakamlarla. Her adımda bir modülde yapılan iş, bağlı olduğu diğer modüllerde (Cari, Taksitler, Kasa, Çek/Senet, Stok,
// Raporlar, ANLIK DURUM) aynı sayıyla görünüyor mu diye denetlenir. Çalıştırma: npm run test:senaryo-211
// (ekran görüntüleri artifacts/senaryo-211/).
//   A. Ayarlar kullanıcı kartının altında (m8); arama kutusunun her noktası yazmayı başlatır (m1).
//   B. Taksitler: boş görünen grup (m4) → Cari Seç → toplu taksitlendir, ön izleme ve onay (m3); cari bakiyesi, Taksitler,
//      Cari Listesi raporu ve ANLIK DURUM aynı toplamı gösterir.
//   C. Taksit tahsilatı → Kasa, cari bakiyesi, Cari Bazında Tahsilat raporu aynı.
//   D. Kasa açıkken: Kasa'dan açılan çek kartında ödeme geri alınır, başka bilgisayarda stok alımı Kasa'dan ödenir;
//      Kasa kapatılıp açılmadan yenilenir (m6).
//   E. Stok birimleri baş harfi büyük ve tekrarsız; seçilen birim her yerde aynı yazılır (m5).
//   F. Veri Sağlığı: Yok Say ile puan %100, yeni yüklemede korunur, Geri Al (m2).
//   G. Başlık yazımı: gezilen her ekrandaki başlık, düğme, sekme, kolon ve gösterge adı denetlenir (m7).
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { okulServisiXlsx } from "../fixtures/okul-servisi-ornek.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-211");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-211-"));
const excel = path.join(root, "okul-servisi-ornek.xlsx");
writeFileSync(excel, okulServisiXlsx());
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f93" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const errors = [];
const newPage = async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR", acceptDownloads: true });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
  });
  return page;
};
const results = [];
let shotNo = 0;
const shot = async (page, name, options = {}) => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), ...options });
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
const top = `${modal}:last-of-type`;
const pad = value => String(value).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const tl = value => `₺${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
const closeTop = async page => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
};

// ---------- Başlık yazımı denetçisi (m7) ----------
// Programın ürettiği adlar (pencere başlığı, düğme, sekme, kolon başlığı, gösterge, form alanı, menü) her sözcüğün ilk
// harfi büyük yazılmalı; bağlaçlar küçük, parantez içi ve "·"dan sonraki ayrıntı serbest. Kullanıcının verisi (tablo
// kolonları, kayıt satırları, cari adları) denetlenmez.
const SMALL = new Set(["ve", "ile", "veya", "ya", "da", "de", "ki"]);
const labelProblems = new Map();
async function auditLabels(page, where) {
  const texts = await page.evaluate(() => {
    const visible = node => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== "hidden";
    };
    const own = node => [...node.childNodes].filter(child => child.nodeType === 3).map(child => child.nodeValue).join(" ").replace(/\s+/g, " ").trim();
    // Onay kutusu ve seçenek düğmesi metinleri cümledir (arayüz kurallarında cümle düzeni); denetlenmez.
    const sentence = node => Boolean(node.closest("[data-sentence]") || node.closest("label")?.querySelector('input[type="checkbox"], input[type="radio"]'));
    const out = [];
    const take = (selector, read = own) => document.querySelectorAll(selector).forEach(node => visible(node) && !sentence(node) && out.push(read(node)));
    take(".hof-modal-title, .hof-side-text, .hof-summary-label, .hof-sidecard .hof-side-settings span");
    take(".hof-modal button:not(tbody button):not(.hof-record-list button):not([data-open]), .hof-modal a.hof-button");
    take(".hof-modal thead th, .hof-kpis span, .hof-modal .hof-field > span, .hof-modal label > span");
    take(".hof-modal select:not([data-pick=group]):not([data-pick=subgroup]):not([data-filter=group]):not([data-filter=subgroup]):not([data-filter=category]) option", node => node.textContent.trim());
    take(".hof-rc-nav button, .hof-rep-tab");
    // Yönetim paneli (admin.html): sekmeler, başlıklar, tablo başlıkları, düğmeler, form alanları.
    take(".adm-tabs button, main h2, main h3, main thead th, main button:not(tbody button), main .hof-field > span, main label > span");
    return out;
  });
  for (const raw of texts) {
    const text = String(raw || "").split(" · ")[0].replace(/\([^)]*\)/g, "").replace(/[“”"][^“”"]*[“”"]/g, "").trim();
    if (!text || text.length > 60 || /[.!?]\s|[.!?]$/.test(text) || /\d{2}\.\d{2}\.\d{4}/.test(text)) continue;
    const words = text.split(/\s+/).filter(word => /\p{L}/u.test(word));
    if (words.length < 2) continue;
    const bad = words.slice(1).filter(word => /^[a-zçğıöşü]/.test(word) && !SMALL.has(word.replace(/[^\p{L}]/gu, "")));
    if (bad.length) labelProblems.set(raw.trim(), where);
  }
}

const admin = await newPage();
let other = null;
let exitCode = 0;
const sums = { taksit: 0, kasa: 0 };
try {
  await step("Kurulum: yönetici girer, okul servisi Excel'i yüklenir, sektör önerisi uygulanır", async () => {
    await login(admin, "admin", PASS);
    await admin.waitForSelector("#hof-start .hof-drop");
    await (await admin.$("#hof-start .hof-drop input[type=file]")).setInputFiles(excel);
    await admin.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.click(`${modal} [data-mode="replace"]`)]);
    await admin.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
    await admin.click(".hof-analysis-result [data-apply]");
    await admin.waitForTimeout(1200);
    await admin.reload();
    await admin.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
    ok((await admin.$$eval(".dynamic-table tbody tr", rows => rows.length)) === 6, "6 öğrenci kaydı tabloda");
    await auditLabels(admin, "ana ekran");
  });

  await step("A. Ayarlar yeri (m8) ve arama kutusu (m1)", async () => {
    const place = await admin.evaluate(() => {
      const box = selector => document.querySelector(selector)?.getBoundingClientRect();
      const settings = box("#hof-side-settings");
      return { settings: Boolean(settings), belowUser: settings && settings.top >= box("#hof-sidecard .hof-user").bottom, aboveSync: settings && settings.bottom <= box(".sidebar-bottom").top, oldHidden: [...document.querySelectorAll(".sidebar .nav-item")].every(node => getComputedStyle(node).display === "none"), text: document.querySelector("#hof-side-settings")?.textContent.trim() };
    });
    ok(place.settings && place.belowUser && place.aboveSync && place.oldHidden && place.text === "Ayarlar", "m8: Ayarlar kullanıcı kartının altında, Senkron kartının üstünde; üstteki eski düğme yok");
    await shot(admin, "kenar-cubugu", { clip: { x: 0, y: 0, width: 262, height: 1000 } });
    await admin.click("#hof-side-settings");
    await admin.waitForSelector(`${modal} .hof-modal-title`);
    ok((await admin.textContent(`${modal} .hof-modal-title`)).trim() === "Veri ve Eşitleme", "m8: Ayarlar Veri ve Eşitleme penceresini açar");
    await auditLabels(admin, "Ayarlar");
    await closeTop(admin);
    const field = await (await admin.$(".search-field")).boundingBox();
    const points = [[field.x + 6, field.y + field.height - 4, "sol alt köşe"], [field.x + field.width / 2, field.y + field.height - 5, "alttaki ipucu"], [field.x + field.width - 8, field.y + 5, "sağ üst köşe"], [field.x + 14, field.y + field.height / 2, "büyüteç"]];
    const focused = [];
    for (const [x, y, name] of points) {
      await admin.mouse.click(600, 60);
      await admin.mouse.click(x, y);
      if (await admin.evaluate(() => document.activeElement?.matches(".search-field input"))) focused.push(name);
    }
    ok(focused.length === points.length, `m1: arama kutusunun her noktası yazmayı başlatır (${focused.join(", ")})`);
    await admin.keyboard.type("Can Öztürk");
    await admin.keyboard.press("Enter");
    await admin.waitForTimeout(800);
    ok((await admin.$eval(".dynamic-table tbody tr.selected", row => row.textContent).catch(() => "")).includes("Can Öztürk"), "m1: yazılan ad Enter ile kayda gider");
    await admin.fill(".search-field input", "");
  });

  let group = null;
  const accounts = {};
  await step("B. Taksitler: boş görünen grup → Cari Seç → toplu taksitlendirme (m3, m4)", async () => {
    // Müşterinin durumu: cariler plaka gruplarında (Excel'den ya da Cari'den), henüz taksit kartı yok.
    for (const [name, plate] of [["Ali Çelik", "42 C 0079"], ["Mehmet Demir", "42 C 0079"], ["Zeynep Kara", "42 C 0079"], ["Elif Şahin", "42 C 0348"]]) {
      const created = await call(admin, "/api/workspace/accounts", { name, type: "customer", groupName: plate, phone: "0533 111 22 33" });
      ok(created.status === 200, `cari açıldı: ${name} (${plate})`);
      accounts[name] = created.data;
    }
    await call(admin, "/api/workspace/plans/groups", { name: "34 AB 111" });
    await admin.click('#hof-sidecard [data-action="plans"]');
    await admin.waitForSelector('select[data-filter="group"]');
    const options = await admin.$$eval('select[data-filter="group"] option', list => list.map(option => option.textContent));
    ok(options.includes("42 C 0079 · 0 kart · 3 cari") && options.includes("42 C 0348 · 0 kart · 1 cari") && options.includes("34 AB 111 · 0 kart · boş"), `m4: grup süzgecinde kart ve cari sayısı (${options.slice(1).join(" | ")})`);
    group = await admin.$eval('select[data-filter="group"]', select => [...select.options].find(option => option.textContent.startsWith("42 C 0079")).value);
    await admin.selectOption('select[data-filter="group"]', group);
    await admin.waitForSelector(".hof-plan-empty-group");
    ok((await admin.textContent(".hof-plan-empty-group")).includes("3 cari var; hiçbirinin taksit kartı yok"), "m4: kartsız grupta boş liste yerine ne yapılacağı yazar");
    await auditLabels(admin, "Taksitler");
    await shot(admin, "taksitler-bos-grup");
    await admin.click('.hof-plan-empty-group [data-act="pick"]');
    await admin.waitForSelector("[data-pick-row]");
    await admin.waitForTimeout(300);
    const rows = await admin.$$eval("[data-pick-row]", list => list.map(row => row.querySelector("b").textContent));
    ok(rows.length === 3 && ["Ali Çelik", "Mehmet Demir", "Zeynep Kara"].every(name => rows.includes(name)), `m3: Cari Seç o gruptaki carileri listeler (${rows.join(", ")})`);
    await admin.click("[data-pick-head]");
    ok((await admin.textContent("[data-pick-go]")).includes("(3)"), "m3: başlıktaki kutu üçünü seçer");
    await auditLabels(admin, "Cari Seç");
    await shot(admin, "cari-sec");
    await admin.click("[data-pick-go]");
    await admin.waitForSelector(`${top} input[name="count"]`);
    await admin.selectOption(`${top} select[name="amountMode"]`, "fixed").catch(() => {});
    await admin.fill(`${top} input[name="total"]`, "9000");
    await admin.fill(`${top} input[name="count"]`, "3");
    await admin.fill(`${top} input[name="firstDue"]`, today());
    await auditLabels(admin, "Toplu taksit formu");
    await admin.click(`${top} button[type="submit"]`);
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-modal-title")].some(node => node.textContent.includes("Taksit Kartları Açılsın mı?")));
    const confirmText = await admin.$$eval(".hof-modal-backdrop.is-visible", list => list.at(-1).innerText.replace(/\s+/g, " "));
    ok(confirmText.includes("3 cariye taksit kartı açılacak") && confirmText.includes(tl(27000)) && confirmText.includes("3 taksit"), `m3: ön izleme — ${confirmText.slice(confirmText.indexOf("3 cariye"), confirmText.indexOf("her ay") + 6)}`);
    const beforeConfirm = (await call(admin, "/api/workspace/plans?status=all")).data.plans.length;
    ok(beforeConfirm === 0, "m3: ön izleme hiçbir kart açmadı");
    await shot(admin, "toplu-onizleme");
    await admin.getByRole("button", { name: /3 Kartı Aç/ }).click();
    await admin.waitForFunction(() => document.querySelectorAll("[data-plan]").length === 3, null, { timeout: 10000 });
    const after = await admin.$$eval('select[data-filter="group"] option', list => list.map(option => option.textContent));
    ok(after.includes("42 C 0079 · 3 kart · 3 cari"), "m4: kartlar açılınca grup sayısı 3 kart · 3 cari");
    const kpi = await admin.textContent(".hof-plans-kpis .hof-cash-balance strong");
    ok(kpi.trim() === tl(27000), `Taksitler: Kalan Alacak ${kpi.trim()}`);
    await shot(admin, "taksitler-kartlar");
    // İkinci kez: hepsinin kartı var → seçilecek cari yok (çift kart açılmaz).
    await admin.waitForTimeout(400);
    await admin.click('.hof-plans-filters [data-act="pick"]');
    await admin.waitForFunction(() => { const list = document.querySelector("[data-pick-list]"); return list && !/Yükleniyor/.test(list.textContent); }, null, { timeout: 8000 });
    ok((await admin.textContent("[data-pick-list]")).includes("taksit kartı olmayan cari yok"), "m3: ikinci kez seçimde kartı olan cari gelmez (çift kart yok)");
    await closeTop(admin);
    // Bağlı modüller aynı sayıyı söyler.
    for (const name of ["Ali Çelik", "Mehmet Demir", "Zeynep Kara"]) {
      const card = (await call(admin, `/api/workspace/accounts/${accounts[name].id}`)).data;
      ok(card.totals.balance === 9000 && card.plans.length === 1, `Cari kartı ${name}: bakiye ${tl(card.totals.balance)} borçlu, 1 taksit kartı`);
    }
    const listReport = (await call(admin, "/api/workspace/report-center/cari-listesi")).data;
    const balanceCol = listReport.headers.findIndex(header => /Bakiye/.test(header));
    const reportSum = listReport.rows.filter(row => ["Ali Çelik", "Mehmet Demir", "Zeynep Kara"].some(name => row.includes(name))).length;
    ok(reportSum === 3 && balanceCol >= 0, "Raporlar › Cari Listesi ve Bakiyeler: üç cari listede");
    const overview = (await call(admin, "/api/workspace/overview")).data;
    ok(overview.receivable.accounts === 27000, `ANLIK DURUM toplam alacak (cari) ${tl(overview.receivable.accounts)} = Taksitler kalan alacak`);
    sums.taksit = 27000;
  });

  await step("C. Taksit tahsilatı → Kasa, cari bakiyesi, Cari Bazında Tahsilat raporu", async () => {
    await admin.click('[data-plan]:has-text("Ali Çelik")');
    await admin.waitForSelector("[data-pay-item]");
    await auditLabels(admin, "Taksit kartı");
    await admin.click("[data-pay-item]");
    await admin.waitForSelector(`${top} input[name="amount"]`);
    ok((await admin.textContent(`${top} .hof-modal-title`)).trim() === "Tahsilat Gir", "tahsilat penceresi başlığı: Tahsilat Gir");
    await admin.fill(`${top} input[name="amount"]`, "3000");
    await auditLabels(admin, "Tahsilat Gir");
    await admin.click(`${top} button[type="submit"]`);
    await admin.waitForTimeout(1200);
    await closeTop(admin);
    await admin.waitForTimeout(300);
    const ali = (await call(admin, `/api/workspace/accounts/${accounts["Ali Çelik"].id}`)).data;
    ok(ali.totals.balance === 6000, `Cari kartı Ali Çelik: 9.000 − 3.000 = ${tl(ali.totals.balance)}`);
    const plans = (await call(admin, "/api/workspace/plans?status=all")).data;
    ok(plans.totals.remaining === 24000 && plans.totals.paid === 3000, `Taksitler: kalan ${tl(plans.totals.remaining)}, tahsil edilen ${tl(plans.totals.paid)}`);
    await admin.click('#hof-sidecard [data-action="cash"]');
    await admin.waitForSelector(".hof-cash-table tbody tr[data-kind]");
    const cash = await admin.textContent(".hof-cash-balance strong");
    ok(cash.trim() === tl(3000), `Kasa: güncel kasa ${cash.trim()} (taksit tahsilatı Kasa'ya düştü)`);
    ok((await admin.textContent(".hof-cash-table")).includes("Taksit tahsilatı · Ali Çelik"), "Kasa satırı: Taksit tahsilatı · Ali Çelik");
    await auditLabels(admin, "Kasa");
    await closeTop(admin);
    const collect = (await call(admin, "/api/workspace/report-center/cari-tahsilat?preset=all")).data;
    ok(JSON.stringify(collect.rows).includes("Ali Çelik") && JSON.stringify(collect.summary).includes("3.000,00"), "Raporlar › Cari Bazında Tahsilat: Ali Çelik 3.000,00");
    const overview = (await call(admin, "/api/workspace/overview")).data;
    ok(overview.cash.balance === 3000 && overview.receivable.accounts === 24000, `ANLIK DURUM: kasa ${tl(overview.cash.balance)}, alacak ${tl(overview.receivable.accounts)}`);
    sums.kasa = 3000;
  });

  await step("D. Kasa açıkken bağlı hareketler değişir; Kasa kendini yeniler (m6)", async () => {
    const supplier = (await call(admin, "/api/workspace/accounts", { name: "Akaryakıt Ltd.", type: "supplier" })).data;
    const cheque = (await call(admin, "/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: 2000, dueDate: today(), issueDate: today(), accountId: supplier.id, serialNo: "V-211", bank: "Ziraat" })).data;
    const supplierAfterIssue = (await call(admin, `/api/workspace/accounts/${supplier.id}`)).data.totals.balance;
    const paid = await call(admin, `/api/workspace/cheques/${cheque.id}/actions`, { action: "pay", method: "cash", date: today(), status: cheque.status }); // nakit kasadan (bankada bakiye yok)
    ok(paid.status === 200, "verilen çek ödendi (Kasa'dan 2.000 çıktı)");
    await admin.click('#hof-sidecard [data-action="cash"]');
    await admin.waitForSelector(".hof-cash-table tbody tr[data-kind]");
    const balance = async () => (await admin.textContent(".hof-cash-balance strong")).trim();
    ok((await balance()) === tl(1000), `Kasa: 3.000 − 2.000 = ${await balance()}`);
    await shot(admin, "kasa-cek-odendi");
    // Müşterinin adımı: Kasa'daki ↗ ile çek kartı, ödeme geri alınır, kart kapatılır; Kasa kapatılıp açılmaz.
    await admin.click(".hof-cash-table button[data-cheque]");
    await admin.waitForSelector('[data-act="undo"]');
    await auditLabels(admin, "Çek kartı");
    await admin.click('[data-act="undo"]');
    await admin.getByRole("button", { name: "Geri Al", exact: true }).last().click();
    await admin.waitForTimeout(900);
    await closeTop(admin);
    await admin.waitForFunction(value => document.querySelector(".hof-cash-balance strong")?.textContent.trim() === value, tl(3000), { timeout: 5000 });
    ok(!(await admin.textContent(".hof-cash-table")).includes("Çek ödemesi"), `m6: Kasa kapatılıp açılmadan ${await balance()}; çek satırı kalktı`);
    // Başka bilgisayar: stok alımı Kasa'dan ödenir → açık Kasa yenilenir.
    other = await newPage();
    await login(other, "admin", PASS);
    const stock = await call(other, "/api/workspace/stock", { name: "Motor Yağı", unit: "lt", unitPrice: "250", openingQty: "2", openingPay: "cash", openingDate: today() });
    ok(stock.status === 200 && stock.data.unit === "Lt", "başka bilgisayarda stok alımı (2 Lt × 250, Kasa'dan)");
    await admin.waitForFunction(value => document.querySelector(".hof-cash-balance strong")?.textContent.trim() === value, tl(2500), { timeout: 8000 });
    ok((await admin.textContent(".hof-cash-table")).includes("Stok"), `m6: başka bilgisayardaki gider açık Kasa'ya düştü: ${await balance()}`);
    await shot(admin, "kasa-canli");
    await closeTop(admin);
    const overview = (await call(admin, "/api/workspace/overview")).data;
    ok(overview.cash.balance === 2500, `ANLIK DURUM kasa ${tl(overview.cash.balance)} = Kasa ekranı`);
    const report = (await call(admin, "/api/workspace/report-center/kasa-hareketleri?preset=all")).data;
    ok(JSON.stringify(report.summary).includes("2.500,00"), "Raporlar › Kasa hareketleri güncel kasa 2.500,00");
    const supplierCard = (await call(admin, `/api/workspace/accounts/${supplier.id}`)).data;
    const chequeState = (await call(admin, `/api/workspace/cheques/${cheque.id}`)).data;
    ok(supplierCard.totals.balance === supplierAfterIssue && chequeState.status === "pending", `çek ödemesi geri alınınca evrak yine "ödenecek", tedarikçi bakiyesi değişmedi (${tl(supplierCard.totals.balance)})`);
    sums.kasa = 2500;
  });

  await step("E. Stok birimleri baş harfi büyük, tekrarsız; seçilen birim her yerde aynı (m5)", async () => {
    await admin.click('#hof-sidecard [data-action="stock"]');
    await admin.waitForSelector(".hof-stock-modal [data-act=new]");
    const seen = await admin.waitForFunction(() => document.querySelector(".hof-stock-modal")?.textContent.includes("Motor Yağı"), null, { timeout: 8000 }).then(() => true, () => false);
    ok(seen, "Stok listesinde başka bilgisayarın ürünü");
    await auditLabels(admin, "Stok");
    await admin.click(".hof-stock-modal [data-act=new]");
    await admin.waitForSelector(`${top} select[name="unit"]`);
    // Boş seçenek ("— Birim Seçin —") ve "Başka bir değer yaz…" birim değildir.
    const units = await admin.$$eval(`${top} select[name="unit"] option`, list => list.map(option => option.value).filter(value => value && !value.startsWith("\u0001")));
    const firstUpper = units.filter(unit => !unit.startsWith("—")).every(unit => /^[A-ZÇĞİÖŞÜ]/.test(unit));
    const unique = new Set(units.map(unit => unit.toLocaleLowerCase("tr-TR"))).size === units.length;
    ok(firstUpper && unique && ["Adet", "Kg", "Lt", "M²", "Şişe", "Çuval"].every(unit => units.includes(unit)), `m5: ${units.length} birim, hepsi büyük harfle ve tekrarsız (${units.slice(0, 8).join(", ")}…)`);
    await auditLabels(admin, "Yeni Ürün");
    await shot(admin, "birimler");
    await admin.fill(`${top} input[name="name"]`, "Çay");
    await admin.selectOption(`${top} select[name="unit"]`, "Kg");
    await admin.fill(`${top} input[name="unitPrice"]`, "100");
    await admin.click(`${top} button[type="submit"]`);
    await admin.waitForTimeout(1000);
    const items = (await call(admin, "/api/workspace/stock")).data.items;
    ok(items.find(item => item.name === "Çay")?.unit === "Kg" && items.find(item => item.name === "Motor Yağı")?.unit === "Lt", "m5: ürünler Kg ve Lt olarak kaydedildi");
    const stockReport = (await call(admin, "/api/workspace/report-center/stok-durumu")).data;
    ok(JSON.stringify(stockReport.rows).includes('"Kg"') || JSON.stringify(stockReport.rows).includes("Kg"), "m5: stok raporunda aynı yazım (Kg)");
    await closeTop(admin);
    await closeTop(admin);
  });

  await step("G. Başlık yazımı: raporlar ve menü (m7)", async () => {
    const menu = await admin.$$eval("#hof-sidecard .hof-side-text", list => list.map(node => node.textContent.trim()));
    // v2.0.15: "Yeni Kayıt" sol menüden kalktı (ana listede "Dışa Aktar"ın yanında); menüye "Fatura" geldi.
    ok(["Görev Ata", "Fatura", "Personel Raporu", "Kullanım Kılavuzu"].every(label => menu.includes(label)) && !menu.includes("Yeni Kayıt"), `m7: menü (${menu.join(", ")})`);
    await admin.click('#hof-sidecard [data-action="analytics"]');
    await admin.waitForSelector(".hof-rep-tab");
    await auditLabels(admin, "Raporlar");
    await admin.click('.hof-rep-tab[data-tab="all"]');
    await admin.waitForSelector(".hof-rc-nav button");
    const names = await admin.$$eval(".hof-rc-nav button", list => list.map(node => node.textContent.trim()));
    ok(["Cari Listesi ve Bakiyeler", "Tüm Cari Hareketleri", "Cari Bazında Tahsilat", "Taksit Kartları"].every(name => names.some(item => item.startsWith(name))), "m7: müşterinin örnekleri — Cari Listesi ve Bakiyeler, Tüm Cari Hareketleri, Cari Bazında Tahsilat, Taksit Kartları");
    await auditLabels(admin, "Tüm Raporlar");
    await shot(admin, "raporlar");
    await closeTop(admin);
    const pdf = await admin.evaluate(async () => {
      const response = await fetch("/api/workspace/report-center/cari-listesi/pdf");
      return { status: response.status, type: response.headers.get("content-type") };
    });
    ok(pdf.status === 200 && /pdf/.test(pdf.type), "Cari Listesi ve Bakiyeler PDF üretildi");
  });

  await step("F. Veri Sağlığı: Yok Say ile %100; yeni yüklemede korunur; Geri Al (m2)", async () => {
    const rows = [["Öğrenci No", "Adı", "Soyadı", "Unvan", "Telefonu"]];
    for (let i = 0; i < 20; i += 1) rows.push([i < 15 ? String(20260100 + i) : "", ["Ahmet", "Ayşe", "Mehmet", "Fatma", "Ali"][i % 5], ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin"][(i * 3) % 5], "Dr.", i % 7 === 3 ? "0532 12" : `0532 ${100 + i} 11 ${10 + i}`]);
    const load = async (name, mode) => {
      const staged = await call(admin, "/api/workspace/dataset/stage", { kind: "excel", fileName: name, sheets: [{ name: "TÜM REHBER", matrix: rows }] });
      const committed = await call(admin, "/api/workspace/dataset/commit", { stageId: staged.data.stageId, mode });
      // Yeni oturum açılınca program kendini yeni veriye yeniler; ekran baştan açılır (sonraki istekler yarıda kalmasın).
      await admin.waitForTimeout(1500);
      await admin.goto(`${BASE}/`, { waitUntil: "load" });
      await admin.waitForSelector("#hof-sidecard", { timeout: 20000 });
      return committed.status;
    };
    ok((await load("rehber.xlsx", "session")) === 200, "rehber yeni oturuma yüklendi");
    // Yeni veri gelince program kendisi de yenilenebilir; açılışı baştan yapmak çakışmayı önler.
    await admin.waitForTimeout(1500);
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector('#hof-summary [data-kpi="quality"]', { timeout: 20000 });
    const before = (await admin.textContent('#hof-summary [data-kpi="quality"] .hof-summary-value')).trim();
    ok(/Orta|Zayıf/.test(before), `Veri Sağlığı başta: ${before}`);
    await admin.click('#hof-summary [data-kpi="quality"]');
    await admin.waitForSelector(`${modal} .hof-issue[data-issue]`);
    const first = await admin.$eval(`${modal} .hof-issue[data-issue] .hof-record-list li b`, node => node.textContent);
    ok(/^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+ [A-ZÇĞİÖŞÜ][a-zçğıöşü]+$/.test(first), `kayıt adı Adı + Soyadı'ndan: ${first}`);
    await auditLabels(admin, "Veri Sağlığı");
    await shot(admin, "saglik-once");
    for (let i = 0; i < 6; i += 1) {
      const button = await admin.$(`${modal} .hof-issue[data-issue] [data-ignore]`);
      if (!button) break;
      await button.click();
      await admin.waitForTimeout(1200);
    }
    const title = (await admin.textContent(`${modal} .hof-modal-title`)).trim();
    ok(title === "Veri Sağlığı: İyi (%100)", `m2: Yok Say sonrası ${title}`);
    await shot(admin, "saglik-yuzde-100");
    await closeTop(admin);
    await admin.waitForFunction(() => document.querySelector('#hof-summary [data-kpi="quality"] .hof-summary-value')?.textContent.includes("%100"), null, { timeout: 5000 });
    ok(true, "m2: özet kartı İyi · %100");
    // Başka bilgisayar da %100 görür; yeni yüklemede (yeni oturum) kararlar korunur, yeni hatalı kayıt uyarır.
    const otherQuality = (await call(other, "/api/workspace/insight")).data.analysis.quality;
    ok(otherQuality.score === 100, "m2: kararlar ofis geneli (başka bilgisayarda da %100)");
    rows.push(["", "Yeni", "Kişi", "Dr.", "0532 99"]);
    ok((await load("rehber-2.xlsx", "session")) === 200, "aynı rehber bir satır eklenerek yeniden yüklendi");
    const again = (await call(admin, "/api/workspace/insight")).data.analysis.quality;
    ok(again.issues.every(issue => issue.count === 1) && again.issues.length === 2, `m2: yalnız yeni hatalı kayıt uyarır (${again.issues.map(issue => issue.title).join(" | ")})`);
    // Yeni veri gelince program kendisi de yenilenebilir; açılışı baştan yapmak çakışmayı önler.
    await admin.waitForTimeout(1500);
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector('#hof-summary [data-kpi="quality"]', { timeout: 20000 });
    await admin.click('#hof-summary [data-kpi="quality"]');
    await admin.waitForSelector(`${modal} .hof-issue.is-ignored`);
    await admin.click(`${modal} .hof-issue.is-ignored summary`);
    await admin.click(`${modal} [data-restore]`);
    await admin.waitForTimeout(1300);
    const restored = (await call(admin, "/api/workspace/insight")).data.analysis.quality;
    ok(restored.ignored.length === 1 && restored.score < again.score, `m2: Geri Al ile uyarı döner (puan ${again.score} → ${restored.score})`);
    await closeTop(admin);
  });

  await step("G. Tüm ekranlar gezintisi: her modül, her form, raporların her sekmesi, Yönetim paneli (m7)", async () => {
    const open = async (action, where, extra = async () => {}) => {
      await admin.click(`#hof-sidecard [data-action="${action}"]`);
      await admin.waitForTimeout(700);
      await auditLabels(admin, where);
      await extra();
      await closeTop(admin);
      await closeTop(admin);
    };
    const form = async (selector, where) => {
      const button = await admin.$(selector);
      if (!button) return;
      await button.click();
      await admin.waitForTimeout(500);
      await auditLabels(admin, where);
      await closeTop(admin);
    };
    await open("accounts", "Cari", async () => {
      await form('[data-act="new"]', "Yeni Cari");
      await admin.click("tr[data-account]").catch(() => {});
      await admin.waitForTimeout(600);
      await auditLabels(admin, "Cari kartı");
      await form('[data-act="newPlan"]', "Cariye taksit planı");
    });
    await open("plans", "Taksitler", async () => {
      await form('[data-act="new"]', "Yeni Taksit Kartı");
      await form('[data-act="groups"]', "Gruplar");
    });
    await open("stock", "Stok");
    await open("cheques", "Çek / Senet", async () => {
      await form('[data-act="new-in"]', "Çek / Senet Al");
    });
    await open("cash", "Kasa", async () => {
      await form('[data-add="in"]', "Kasaya Tahsilat Ekle");
    });
    await open("tasks", "Görevler");
    await open("newTask", "Görev Ata");
    await open("reports", "Personel Raporu");
    await admin.click('#hof-sidecard [data-action="analytics"]');
    await admin.waitForSelector(".hof-rep-tab");
    for (const tab of await admin.$$eval(".hof-rep-tab", list => list.map(node => node.dataset.tab))) {
      await admin.click(`.hof-rep-tab[data-tab="${tab}"]`);
      await admin.waitForTimeout(700);
      await auditLabels(admin, `Raporlar › ${tab}`);
    }
    await closeTop(admin);
    await admin.goto(`${BASE}/admin.html`, { waitUntil: "load" });
    await admin.waitForSelector(".adm-tabs button");
    for (const tab of await admin.$$eval(".adm-tabs button", list => list.filter(node => node.offsetParent).map(node => node.dataset.tab))) {
      await admin.click(`.adm-tabs button[data-tab="${tab}"]`);
      await admin.waitForTimeout(600);
      await auditLabels(admin, `Yönetim › ${tab}`);
    }
    await shot(admin, "yonetim");
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-sidecard");
    ok(true, "tüm modüller, formlar, rapor sekmeleri ve Yönetim paneli gezildi");
  });

  await step("G. Gezilen ekranlarda başlık yazımı denetimi (m7)", async () => {
    const problems = [...labelProblems.entries()].map(([text, where]) => `${where}: “${text}”`);
    ok(problems.length === 0, problems.length ? `küçük harfle başlayan ad kaldı: ${problems.join(" ; ")}` : "m7: gezilen tüm ekranlarda başlık, düğme, sekme, kolon ve gösterge adları başlık yazımıyla");
  });

  await step("Tarayıcı hataları", async () => {
    ok(errors.length === 0, errors.length ? `tarayıcı hataları: ${errors.join(" | ")}` : "hiçbir ekranda tarayıcı hatası yok");
  });
} catch (error) {
  exitCode = 1;
  console.error(error);
  await shot(admin, "hata").catch(() => {});
} finally {
  const passed = results.filter(item => item.ok).length;
  console.log(`\n${passed}/${results.length} denetim geçti. Ekran görüntüleri: ${OUT}`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exit(exitCode);
}
