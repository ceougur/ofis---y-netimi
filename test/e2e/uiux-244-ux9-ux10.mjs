// 2.4.4 madde 11 (2.4.3'ten ertelenen uzman UX bulguları) — EKRANDAN, gerçek tıklama + Tab + insan hızında yazım; yazmadan sonra veri tabanı okunur
// (ders 3, 12). Sahte EDM (ağa çıkmaz), sahte saat (ders 13; sabit sahte gün, gerçek tarihe bağlı değil).
//   UX9  e-Belge zorunlu alanları (alıcının ili, e-Fatura'da tüzel alıcının vergi dairesi) eksikken faturadan düzeltme yolu yoktu (Taslak → Cari Kartı →
//        Düzenle → … ~8 adım). Şimdi Toplamlar'daki sorun listesinin altında "Cariyi Düzenle": cari formu faturanın üstünde açılır, eksik alanlar zorunlu
//        işaretli ve ilki odakta; kaydedince CARİ KARTI güncellenir (bildirimde söylenir), fatura formu kapanmaz, kalemler/ödeme yerinde kalır, sorun kalkar.
//        Kesilmiş belgelerin alıcı bilgisi (party_json) değişmez. Nihai Tüketici (paylaşılan 11111111111 carisi) düzenlenmez; yetkisiz kullanıcıda düğme yok.
//   UX10 Odak: "+ Yeni Fatura" senaryo ekranı, Hizmet Satışı ve İade formu açılınca odak body'deydi; faturadan yeni cari kaydedilince odak pencere
//        düğmesindeydi; "Müşteriyi seçin" hatasında odak düğmede kalıyordu. Şimdi: senaryo kartı / cari kutusu (liste açılmadan) / iade arama kutusu;
//        yeni cari kaydında ilk boş kalem adı; doğrulama hatasında hatalı alan (sunucunun "N. kalem" hatasında o kalemin alanı).
// Eski kodda kırmızıdır: DEPO=<eski kopya> ile koşulur. Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { OUR_VKN, BUYER_VKN, startMockEdm, vkn } from "../einvoice-mock.mjs";
import { escClose } from "./esc-kapat.mjs";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "Prova-Admin-2026!";
const STAFF = "Prova-Fatura-2026!";
const NOW = "2026-11-16T10:00:00";
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-uiux-244-ux9-"));
const edm = await startMockEdm();
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
const accountRow = id => db("SELECT name, city, tax_office AS taxOffice, phone, tax_no AS taxNo FROM accounts WHERE id = ?", id);
globalThis.__escKapatEk = () => ({ fatura: invoiceCount(), cari: db("SELECT COUNT(*) AS n FROM accounts").n });

await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
await must("firma bilgisi", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: false, earsiv: false }));
// İli yazılmamış tüzel alıcı (mükellef değil → e-Arşiv): e-Belgede "il zorunludur". Önce kâğıt dönemde bir satış kesilir (alıcı bilgisi o belgede donar).
const ilsiz = await must("ilsiz cari", api.post("/api/workspace/accounts", { name: "İlsiz Ticaret Ltd.", type: "customer", partyKind: "company", taxNo: vkn(111222333), address: "Gazi Cd. 5" }));
const paper = await must("kâğıt satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ilsiz.id, issueDate: "2026-11-10", profile: "KAGIT", lines: [{ name: "Eski Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } }));
const paperParty = db("SELECT party_json AS p FROM invoices WHERE id = ?", paper.id).p;
// e-Fatura mükellefi tüzel alıcı, vergi dairesi boş: "e-Fatura'da tüzel alıcının vergi dairesi zorunludur".
const vdsiz = await must("vergi dairesiz cari", api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", partyKind: "company", taxNo: BUYER_VKN, address: "Kızılay 3", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" }));
const ilsiz2 = await must("ilsiz cari 2", api.post("/api/workspace/accounts", { name: "İkinci İlsiz Ltd.", type: "customer", partyKind: "company", taxNo: vkn(333444555), address: "Bağdat Cd. 9" }));
const ilsiz3 = await must("ilsiz cari 3", api.post("/api/workspace/accounts", { name: "Üçüncü İlsiz Ltd.", type: "customer", partyKind: "company", taxNo: vkn(444555666), address: "Bağdat Cd. 10" }));
const stock = await must("hizmet kartı", api.post("/api/workspace/stock", { kind: "service", code: "DAN-1", name: "Danışmanlık", unit: "Adet", salePrice: "1500" }));
const sale = await must("e-Arşiv satış (iade için)", api.post("/api/workspace/invoices", { kind: "sale", accountId: vdsiz.id, issueDate: "2026-11-12", profile: "KAGIT", lines: [{ name: "Kurulum", qty: 2, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" } }));
await must("e-Belge ayarları", api.put("/api/workspace/invoices/settings", { efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
// Yetkisiz kullanıcı: fatura keser ama cari düzenleyemez (accounts.manage yok).
const role = await must("özel rol", api.post("/api/admin/roles", { name: "Yalnız Fatura", permissions: ["accounts.view", "invoices.view", "invoices.manage", "stock.view", "cash.view"] }));
await must("faturacı", api.post("/api/admin/users", { username: "faturaci", name: "Fatura Personeli", role: role.id, password: STAFF, mustChangePassword: false }));

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
const TOP = ".hof-modal-backdrop.is-visible:not(:has(~ .hof-modal-backdrop.is-visible))";
const INV = ".hof-invoices-modal";
const toasts = page => page.$$eval(".hof-toast-text", nodes => nodes.map(node => node.textContent)).catch(() => []);
const formError = page => page.$eval(`${INV} [data-form-error]`, node => node.textContent).catch(() => "");
const problems = page => page.$$eval(`${INV} [data-totals] .hof-inv-problems li`, nodes => nodes.map(node => node.textContent)).catch(() => []);
const typeHuman = async (page, selector, text) => {
  await page.locator(selector).click();
  await page.keyboard.type(text, { delay: 35 });
};
const focused = page => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "BODY";
  const tag = a.tagName;
  const bits = [a.dataset?.f ? `f=${a.dataset.f}` : "", a.dataset?.l !== undefined ? `l=${a.dataset.l}` : "", a.name ? `name=${a.name}` : "", a.hasAttribute("data-acc-query") ? "acc-query" : "", a.hasAttribute("data-return-q") ? "return-q" : "", a.dataset?.scenario ? `scenario=${a.dataset.scenario}` : "", a.classList.contains("hof-modal-close") ? "×" : ""].filter(Boolean);
  return `${tag}[${bits.join(",")}]|${(a.textContent || "").trim().slice(0, 30)}`;
});
const modalCount = page => page.$$eval(".hof-modal-backdrop.is-visible", nodes => nodes.length);
const newPage = async (user, pass) => {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, timezoneId: TZ });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", user);
  await page.fill("#hof-auth input[name=password]", pass);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.invoices?.open && window.HOF?.accounts?.open);
  return page;
};
const page = await newPage("admin", PASS);
const closeAll = async (p = page) => {
  for (let index = 0; index < 8 && (await p.$(".hof-modal-backdrop.is-visible")); index += 1) {
    await escClose(p, { step: "pencereleri kapat" });
    await sleep(250);
  }
};
const part = async (name, run, p = page) => {
  try {
    await run();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ ${name} bölümü yarıda kaldı: ${String(error.message || error).split("\n")[0].slice(0, 220)}`);
    if (process.env.EKRAN) await p.screenshot({ path: path.join(process.env.EKRAN, `hata-${name}.png`) }).catch(() => null);
  }
  await closeAll(p).catch(() => null);
};
const openForm = async (p, scenario, account = null) => {
  await p.evaluate(([s, a]) => window.HOF.invoices.open({ scenario: s, ...(a ? { account: a } : {}) }), [scenario, account]);
  await p.waitForSelector(`${INV} [data-lines] [data-l="0"][data-f="name"]`);
  await sleep(400);
};
// Kalem: ad (insan hızında) + birim fiyat + Tab; hesap dönene kadar beklenir.
const fillLine = async (p, index, name, price) => {
  await typeHuman(p, `${INV} [data-l="${index}"][data-f="name"]`, name);
  await sleep(400);
  await p.locator(`${INV} [data-l="${index}"][data-f="unitPrice"]`).click();
  await p.keyboard.press("Control+A");
  await p.keyboard.type(price, { delay: 35 });
  await p.keyboard.press("Tab");
  await sleep(1300);
};
// EKRAN=<klasör> verilirse kanıt ekran görüntüleri (UX9 düğmesi, cari formu, düzeltilmiş fatura).
const shot = async (p, name) => (process.env.EKRAN ? p.screenshot({ path: path.join(process.env.EKRAN, `${name}.png`) }).catch(() => null) : null);
const waitProblems = async (p, pattern, present = true) => {
  for (let index = 0; index < 30; index += 1) {
    const list = await problems(p);
    if (list.some(item => pattern.test(item)) === present) return list;
    await sleep(200);
  }
  return problems(p);
};

try {
  console.log("A) UX9: ili eksik e-Arşiv alıcısı — faturadan 'Cariyi Düzenle', il yazılır, cari kartı güncellenir, fatura kesilir");
  await part("A", async () => {
    await openForm(page, "service_sale", { id: ilsiz.id, name: ilsiz.name });
    await fillLine(page, 0, "Danışmanlık", "1500");
    const before = await waitProblems(page, /il zorunludur/);
    ok(before.some(item => /il zorunludur/.test(item)), `Toplamlar'da "il zorunludur" (${before.join(" | ")})`);
    const button = await page.$(`${INV} [data-totals] [data-act="edit-account"]`);
    ok(Boolean(button), "Toplamlar'da 'Cariyi Düzenle' düğmesi var");
    if (!button) return;
    ok(/Cariyi Düzenle/.test((await button.textContent()) || ""), "düğme adı 'Cariyi Düzenle'");
    await button.scrollIntoViewIfNeeded();
    await shot(page, "ux9-1-sorun-ve-cariyi-duzenle");
    await button.click();
    await page.waitForSelector(`${TOP} input[name="city"]`);
    await sleep(500);
    const title = await page.$eval(`${TOP} .hof-modal-title`, node => node.textContent);
    ok(/Cariyi Düzenle/.test(title), `cari formu açıldı (${title})`);
    ok(await page.$eval(`${TOP} input[name="city"]`, node => node.required), "İl alanı zorunlu işaretli");
    ok(!(await page.$eval(`${TOP} input[name="taxOffice"]`, node => node.required)), "e-Arşiv alıcısında Vergi Dairesi zorunlu değil");
    const focus = await focused(page);
    ok(/name=city/.test(focus), `odak eksik alanda: İl (${focus})`);
    const visible = await page.$eval(`${TOP} input[name="city"]`, node => {
      const box = node.getBoundingClientRect();
      const modal = node.closest(".hof-modal").getBoundingClientRect();
      return box.top >= modal.top && box.bottom <= modal.bottom && box.bottom <= window.innerHeight;
    });
    ok(visible, "odaktaki İl alanı ekranda görünür (aşağıda kalmadı)");
    ok((await modalCount(page)) === 2, "fatura penceresi arkada açık (2 pencere)");
    await shot(page, "ux9-2-cari-formu-il-zorunlu-odakta");
    // İnsan hızında: odak zaten İl'de; yaz, Enter ile kaydet.
    await page.keyboard.type("Ankara", { delay: 40 });
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelectorAll(".hof-modal-backdrop.is-visible").length === 1, null, { timeout: 8000 });
    await sleep(1500);
    ok(accountRow(ilsiz.id).city === "Ankara", `VERİ TABANI: carinin ili "Ankara" (${accountRow(ilsiz.id).city})`);
    ok(db("SELECT party_json AS p FROM invoices WHERE id = ?", paper.id).p === paperParty, "VERİ TABANI: önceden kesilmiş belgenin alıcı bilgisi değişmedi");
    const note = (await toasts(page)).join(" | ");
    ok(/cari kart/i.test(note) && /kesilmiş belge/i.test(note), `bildirim cari kartının güncellendiğini ve eski belgelerin değişmediğini söylüyor (${note.slice(0, 220)})`);
    const after = await waitProblems(page, /il zorunludur/, false);
    ok(!after.some(item => /il zorunludur/.test(item)), `sorun kalktı (${after.join(" | ") || "sorun yok"})`);
    await shot(page, "ux9-3-duzeltilmis-fatura");
    ok((await page.$eval(`${INV} [data-l="0"][data-f="name"]`, node => node.value)) === "Danışmanlık", "kalem adı yerinde");
    const price = await page.$eval(`${INV} [data-l="0"][data-f="unitPrice"]`, node => node.value);
    ok(/^1\.?500(,00)?$/.test(price), `birim fiyat yerinde (${price})`);
    ok((await page.$eval(`${INV} [data-acc-query]`, node => node.value)) === ilsiz.name, "cari seçili kaldı");
    const count = invoiceCount();
    await page.click(`${INV} [data-act="issue-now"]`);
    await page.waitForSelector(`${TOP} [data-answer="yes"]`, { timeout: 8000 });
    await page.click(`${TOP} [data-answer="yes"]`);
    await page.waitForFunction(n => window.HOF && document.querySelector(".hof-invoices-modal [data-act='modify'], .hof-invoices-modal .hof-inv-card, .hof-invoices-modal [data-doc]") !== null, count, { timeout: 15000 }).catch(() => null);
    await sleep(1500);
    ok(invoiceCount() === count + 1, `VERİ TABANI: fatura kaydedildi (${count} → ${invoiceCount()})`);
    const saved = db("SELECT party_json AS p, profile, e_status AS e FROM invoices ORDER BY rowid DESC LIMIT 1");
    ok(JSON.parse(saved.p).city === "Ankara" && saved.profile === "EARSIVFATURA", `VERİ TABANI: yeni e-Arşiv belgesinde alıcının ili Ankara (${saved.profile}, ${JSON.parse(saved.p).city})`);
  });

  console.log("B) UX9: e-Fatura tüzel alıcıda vergi dairesi — Vazgeç formu bozmaz; ikinci denemede yazılır");
  await part("B", async () => {
    await openForm(page, "service_sale", { id: vdsiz.id, name: vdsiz.name });
    await fillLine(page, 0, "Danışmanlık", "2000");
    const before = await waitProblems(page, /vergi dairesi zorunludur/);
    ok(before.some(item => /vergi dairesi zorunludur/.test(item)), `Toplamlar'da vergi dairesi sorunu (${before.join(" | ")})`);
    const button = await page.$(`${INV} [data-totals] [data-act="edit-account"]`);
    ok(Boolean(button), "'Cariyi Düzenle' var");
    if (!button) return;
    await button.click();
    await page.waitForSelector(`${TOP} input[name="taxOffice"]`);
    await sleep(500);
    ok(await page.$eval(`${TOP} input[name="taxOffice"]`, node => node.required), "Vergi Dairesi zorunlu işaretli");
    ok(/name=taxOffice/.test(await focused(page)), `odak Vergi Dairesi'nde (${await focused(page)})`);
    await page.click(`${TOP} [data-cancel]`);
    await sleep(800);
    ok((await modalCount(page)) === 1, "Vazgeç: yalnız fatura penceresi kaldı");
    ok((await page.$eval(`${INV} [data-l="0"][data-f="name"]`, node => node.value)) === "Danışmanlık", "Vazgeç: kalem yerinde");
    ok((await problems(page)).some(item => /vergi dairesi zorunludur/.test(item)), "Vazgeç: sorun hâlâ görünür (cari değişmedi)");
    ok(!accountRow(vdsiz.id).taxOffice, "VERİ TABANI: Vazgeç'te vergi dairesi yazılmadı");
    await page.click(`${INV} [data-totals] [data-act="edit-account"]`);
    await page.waitForSelector(`${TOP} input[name="taxOffice"]`);
    await sleep(500);
    await page.keyboard.type("Kavaklıdere", { delay: 40 });
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelectorAll(".hof-modal-backdrop.is-visible").length === 1, null, { timeout: 8000 });
    await sleep(1200);
    ok(accountRow(vdsiz.id).taxOffice === "Kavaklıdere", `VERİ TABANI: vergi dairesi "Kavaklıdere" (${accountRow(vdsiz.id).taxOffice})`);
    const after = await waitProblems(page, /vergi dairesi/, false);
    ok(!after.some(item => /vergi dairesi/.test(item)), `sorun kalktı (${after.join(" | ") || "sorun yok"})`);
    const profile = await page.$eval(`${INV} [data-profile-note]`, node => node.textContent).catch(() => "");
    ok(/e-Fatura kesilir/.test(profile), `belge türü e-Fatura olarak kaldı (${profile})`);
  });

  console.log("C) UX9: aynı cariyi başkası değiştirirse (UX1) fatura eski bilgiyle kalmaz; ikinci Kaydet iki değişikliği de korur");
  await part("C", async () => {
    await openForm(page, "service_sale", { id: ilsiz2.id, name: ilsiz2.name });
    await fillLine(page, 0, "Danışmanlık", "1000");
    await waitProblems(page, /il zorunludur/);
    const button = await page.$(`${INV} [data-totals] [data-act="edit-account"]`);
    ok(Boolean(button), "'Cariyi Düzenle' var");
    if (!button) return;
    await button.click();
    await page.waitForSelector(`${TOP} input[name="city"]`);
    await sleep(400);
    const current = await must("cari oku", api.get(`/api/workspace/accounts/${ilsiz2.id}`));
    await must("başkası telefonu yazar", api.put(`/api/workspace/accounts/${ilsiz2.id}`, { ...current, phone: "0312 555 11 22", updatedAt: current.updatedAt }));
    await page.keyboard.type("İzmir", { delay: 40 });
    await page.keyboard.press("Enter");
    await sleep(1500);
    const stale = await page.$eval(`${TOP} .hof-form-error`, node => node.textContent).catch(() => "");
    ok(/başka biri/.test(stale), `çakışma söylendi, cari formu açık (${stale.slice(0, 120)})`);
    ok((await problems(page)).some(item => /il zorunludur/.test(item)), "fatura henüz güncellenmedi (cari kaydedilmedi)");
    await page.click(`${TOP} button[type="submit"]`);
    await page.waitForFunction(() => document.querySelectorAll(".hof-modal-backdrop.is-visible").length === 1, null, { timeout: 8000 });
    await sleep(1200);
    const row = accountRow(ilsiz2.id);
    ok(row.city === "İzmir" && row.phone === "0312 555 11 22", `VERİ TABANI: il ve başkasının telefonu birlikte (${row.city}, ${row.phone})`);
    const after = await waitProblems(page, /il zorunludur/, false);
    ok(!after.some(item => /il zorunludur/.test(item)), "sorun kalktı");
  });

  console.log("D) UX9: Nihai Tüketici (paylaşılan 11111111111 carisi) faturadan düzenlenmez; gerçek cari seçme yolu yazılır");
  await part("D", async () => {
    await openForm(page, "service_sale");
    await page.click(`${INV} [data-act="retail-account"]`);
    await sleep(1200);
    await fillLine(page, 0, "Danışmanlık", "40000");
    const list = await waitProblems(page, /30\.000 TL üstü/);
    ok(list.some(item => /30\.000 TL üstü/.test(item)), `tutar sınırı sorunu (${list.join(" | ").slice(0, 160)})`);
    ok(!(await page.$(`${INV} [data-totals] [data-act="edit-account"]`)), "Nihai Tüketici'de 'Cariyi Düzenle' YOK");
    const hint = await page.$eval(`${INV} [data-totals] [data-party-hint]`, node => node.textContent).catch(() => "");
    ok(/gerçek/.test(hint) && /Yeni Cari/.test(hint), `yol yazılı (${hint})`);
  });

  console.log("E) UX9: cari düzenleme yetkisi olmayan kullanıcıda düğme yok (sorun yine görünür)");
  const staff = await newPage("faturaci", STAFF);
  await part("E", async () => {
    await openForm(staff, "service_sale", { id: ilsiz3.id, name: ilsiz3.name });
    await fillLine(staff, 0, "Danışmanlık", "1000");
    const list = await waitProblems(staff, /il zorunludur/);
    ok(list.some(item => /il zorunludur/.test(item)), "sorun görünür");
    ok(!(await staff.$(`${INV} [data-totals] [data-act="edit-account"]`)), "yetkisiz: 'Cariyi Düzenle' yok");
    const hint = await staff.$eval(`${INV} [data-totals] [data-party-hint]`, node => node.textContent).catch(() => "");
    ok(/yetki/.test(hint), `yetkisize ne yapacağı yazılı (${hint})`);
  }, staff);
  await staff.context().close();

  console.log("F) UX10: '+ Yeni Fatura' senaryo ekranında odak senaryo kartında; Enter formu açar, odak cari kutusunda (liste açılmadan)");
  await part("F", async () => {
    // account: {} — önceki bölümlerde cariden açılan pencerenin cari süzgeci (view.account) sıfırlanır (kapsam dışı bulgu, raporda).
    await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
    await page.waitForSelector(`${INV} [data-act="new"]`);
    await sleep(400);
    await page.click(`${INV} [data-act="new"]`);
    await page.waitForSelector(`${INV} [data-scenario="service_sale"]`);
    await sleep(400);
    const pickFocus = await focused(page);
    ok(/scenario=/.test(pickFocus), `senaryo ekranında odak bir senaryo kartında (${pickFocus})`);
    await page.focus(`${INV} [data-scenario="service_sale"]`);
    await page.keyboard.press("Enter");
    await page.waitForSelector(`${INV} [data-lines] [data-l="0"][data-f="name"]`);
    await sleep(800);
    const formFocus = await focused(page);
    ok(/acc-query/.test(formFocus), `Hizmet Satışı formunda odak cari kutusunda (${formFocus})`);
    const listOpen = await page.$eval(`${INV} .hof-acc-picker .hof-case-picker-list`, node => !node.hidden).catch(() => false);
    ok(!listOpen, "açılışta cari öneri listesi açılmadı (kalem alanlarını örtmez)");
    // Kaydet ve Gönder, cari seçilmeden: hata ve odak cari kutusuna.
    await page.click(`${INV} [data-act="issue-now"], ${INV} [data-act="issue"]`);
    await sleep(800);
    const err = await formError(page);
    ok(/cariyi\) seçin/.test(err), `"Müşteriyi (cariyi) seçin." (${err})`);
    const errFocus = await focused(page);
    ok(/acc-query/.test(errFocus), `hata sonrası odak cari kutusunda (${errFocus})`);
    // Yazınca liste açılır (odak sessizdi, arama çalışır).
    await page.keyboard.type("Alıcı", { delay: 40 });
    await sleep(700);
    ok(await page.$eval(`${INV} .hof-acc-picker .hof-case-picker-list`, node => !node.hidden).catch(() => false), "yazınca cari listesi açılıyor");
    await page.keyboard.press("Escape");
  });

  console.log("G) UX10: faturadan '+ Yeni Cari' kaydedilince odak ilk boş kalem adında");
  await part("G", async () => {
    await openForm(page, "service_sale");
    await page.click(`${INV} .hof-inv-account-new`);
    await page.waitForSelector(`${TOP} input[name="name"]`);
    await sleep(500);
    await page.keyboard.type("Odak Deneme Ltd.", { delay: 35 });
    await page.locator(`${TOP} input[name="city"]`).click();
    await page.keyboard.type("Bursa", { delay: 35 });
    await page.click(`${TOP} button[type="submit"]`);
    await page.waitForFunction(() => document.querySelectorAll(".hof-modal-backdrop.is-visible").length === 1, null, { timeout: 8000 });
    await sleep(1800);
    const focus = await focused(page);
    ok(/f=name,l=0/.test(focus), `odak ilk kalem adında (${focus})`);
    ok(Boolean(db("SELECT id FROM accounts WHERE name = 'Odak Deneme Ltd.' AND city = 'Bursa'")), "VERİ TABANI: yeni cari ili ile açıldı");
    await page.keyboard.type("Danışmanlık", { delay: 35 });
    ok((await page.$eval(`${INV} [data-l="0"][data-f="name"]`, node => node.value)).startsWith("Danışmanlık"), "klavyeyle yazılan kalem adına girdi");
  });

  console.log("H) UX10: iade formu açılınca odak iade edilecek fatura arama kutusunda; asıl fatura seçilince ilk kalemin miktarında");
  await part("H", async () => {
    await page.evaluate(() => window.HOF.invoices.open({ scenario: "sale_return" }));
    await page.waitForSelector(`${INV} [data-return-q]`);
    await sleep(700);
    const focus = await focused(page);
    ok(/return-q/.test(focus), `iade formunda odak arama kutusunda (${focus})`);
    await page.keyboard.type(sale.number.slice(-4), { delay: 50 });
    const hit = await page.waitForSelector(`${INV} [data-original="${sale.id}"]`, { timeout: 8000 }).catch(() => null);
    ok(Boolean(hit), "asıl fatura listede");
    if (!hit) return;
    await sleep(600);
    await page.locator(`${INV} [data-original="${sale.id}"]`).click();
    await page.waitForSelector(`${INV} [data-l="0"][data-f="qty"]`);
    await sleep(800);
    const after = await focused(page);
    ok(/f=qty,l=0/.test(after), `asıl fatura seçilince odak ilk kalemin miktarında (${after})`);
  });

  console.log("I) UX10: doğrulama hatasında odak hatalı alana (boş kalem; sunucunun 'N. kalem' hatası)");
  await part("I", async () => {
    await openForm(page, "service_sale", { id: ilsiz.id, name: ilsiz.name });
    await page.click(`${INV} [data-act="issue-now"], ${INV} [data-act="issue"]`);
    await sleep(700);
    ok(/En az bir kalem/.test(await formError(page)), `"En az bir kalem yazın." (${await formError(page)})`);
    ok(/f=name,l=0/.test(await focused(page)), `odak ilk kalem adında (${await focused(page)})`);
    // İki kalem: ilki boş bırakılıp ikinci satıra yazılır; ikinci satırın miktarı 0 → sunucu "1. kalem: miktar…" der (boş satır sayılmaz).
    await fillLine(page, 0, "Danışmanlık", "1000");
    await page.click(`${INV} [data-act="add-line"]`);
    await sleep(300);
    await fillLine(page, 1, "Kurulum", "500");
    await page.locator(`${INV} [data-l="0"][data-f="name"]`).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.locator(`${INV} [data-l="1"][data-f="qty"]`).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("0", { delay: 40 });
    await page.keyboard.press("Tab");
    await sleep(1300);
    await page.click(`${INV} [data-act="issue-now"], ${INV} [data-act="issue"]`);
    await sleep(1500);
    const err = await formError(page);
    ok(/kalem/.test(err) && /miktar/.test(err), `sunucu kalem hatası formda (${err})`);
    const focus = await focused(page);
    ok(/f=qty,l=1/.test(focus), `odak hatalı kalemin (2. satır) miktarında (${focus})`);
    const dup = (await toasts(page)).filter(text => /miktar sıfırdan/.test(text));
    ok(dup.length === 0, `aynı ileti ayrıca bildirim olarak çıkmadı (UI2; ${dup.length} bildirim)`);
  });

  // 31f U5 — Nihai Tüketici kimliğiyle (11111111111) açılmış, ili eksik cari; tutar sınırın (30.000 TL) çok altında. Önceden ipucu "Bu tutarda gerçek alıcı
  // gerekir" diyordu, "Cariyi Düzenle" çıkmıyordu. Cari bu bölümde açılır: D bölümündeki Nihai Tüketici düğmesi en eski 11111111111'li cariyi seçer (31f U1).
  console.log("J) 31f U5: 11111111111'li, ili eksik caride 600 TL — sorun 'il zorunludur', 'Cariyi Düzenle' var, tutar sınırı söylenmez; sınır aşılınca ipucu");
  await part("J", async () => {
    const anon = await must("ili eksik 11111111111 cari", api.post("/api/workspace/accounts", { name: "Eksik İl Danışmanlık", type: "customer", partyKind: "person", taxNo: "11111111111", address: "Gazi Cd. 7" }));
    await openForm(page, "service_sale", { id: anon.id, name: anon.name });
    await fillLine(page, 0, "Danışmanlık", "500");
    const list = await waitProblems(page, /il zorunludur/);
    ok(list.some(item => /il zorunludur/.test(item)), `asıl eksiklik söylendi (${list.join(" | ").slice(0, 160)})`);
    ok(!list.some(item => /30\.000 TL üstü/.test(item)), "600 TL'de tutar sınırı sorunu yok");
    const hint = await page.$eval(`${INV} [data-totals] [data-party-hint]`, node => node.textContent).catch(() => "");
    ok(!/gerçek alıcı/.test(hint), `"gerçek alıcı gerekir" ipucu yok (${hint || "ipucu yok"})`);
    const fix = await page.$(`${INV} [data-totals] [data-act="edit-account"]`);
    ok(Boolean(fix), "'Cariyi Düzenle' düğmesi var (UX9 yolu)");
    await shot(page, "31f-u5-cariyi-duzenle");
    if (fix) {
      await fix.click();
      await page.waitForSelector(`${TOP} input[name="city"]`);
      await sleep(500);
      const at = await focused(page);
      ok(/name=city/.test(at), `cari formunda odak eksik alanda: il (${at})`);
      await page.keyboard.type("Ankara", { delay: 35 });
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelectorAll(".hof-modal-backdrop.is-visible").length === 1, null, { timeout: 8000 });
      await sleep(1200);
      ok(accountRow(anon.id).city === "Ankara", `VERİ TABANI: cari kartına il yazıldı (${accountRow(anon.id).city})`);
      ok(!(await waitProblems(page, /il zorunludur/, false)).some(item => /il zorunludur/.test(item)), "sorun kalktı");
    }
    // Komşu: aynı caride sınır aşılınca tutar sınırı söylenir; paylaşılan kimlik faturadan düzeltilmez (D ile aynı kural).
    await page.locator(`${INV} [data-l="0"][data-f="unitPrice"]`).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("40000", { delay: 35 });
    await page.keyboard.press("Tab");
    const over = await waitProblems(page, /30\.000 TL üstü/);
    ok(over.some(item => /30\.000 TL üstü/.test(item)), "40.000 TL'de tutar sınırı sorunu");
    ok(!(await page.$(`${INV} [data-totals] [data-act="edit-account"]`)), "sınır aşılınca 'Cariyi Düzenle' yok");
    const limitHint = await page.$eval(`${INV} [data-totals] [data-party-hint]`, node => node.textContent).catch(() => "");
    ok(/gerçek alıcı/.test(limitHint) && /Yeni Cari/.test(limitHint), `sınırda gerçek alıcı yolu yazılı (${limitHint})`);
  });

  // 31f U7b — öneri listesinden cari seçilince odak kalemlere geçer (kodun yorumu böyle diyordu; önceden ilk kaleme 18 Tab).
  console.log("K) 31f U7b: listeden cari seçilince (Enter ve fare) odak ilk boş kalem adında; seçim kaldırılınca cari kutusunda");
  await part("K", async () => {
    await openForm(page, "service_sale");
    ok(/acc-query/.test(await focused(page)), `açılışta odak cari kutusunda (${await focused(page)})`);
    await page.keyboard.type("Alıcı Tic", { delay: 45 });
    await page.waitForSelector(`${INV} .hof-acc-picker li[data-id]`);
    await sleep(300);
    await page.keyboard.press("Enter");
    await sleep(900);
    const byKey = await focused(page);
    ok(/f=name,l=0/.test(byKey), `Enter ile seçince odak ilk kalem adında (${byKey})`);
    await page.keyboard.type("Kurulum", { delay: 35 });
    ok((await page.$eval(`${INV} [data-l="0"][data-f="name"]`, node => node.value)).startsWith("Kurulum"), "klavyeyle yazılan kalem adına girdi");
    await page.click(`${INV} .hof-acc-picker [data-acc-clear]`);
    await sleep(500);
    ok(/acc-query/.test(await focused(page)), `seçim kaldırılınca odak cari kutusunda (${await focused(page)})`);
    await page.keyboard.type("İlsiz", { delay: 45 });
    await page.waitForSelector(`${INV} .hof-acc-picker li[data-id]`);
    await sleep(300);
    await page.locator(`${INV} .hof-acc-picker li[data-id]`).first().click();
    await sleep(900);
    // Kalem 0 dolu (Kurulum) → ilk boş kalem yoksa kaydetme düğmesi (focusAfterAccount kuralı).
    const byMouse = await focused(page);
    ok(/issue|Kaydet/.test(byMouse) || /f=name/.test(byMouse), `fareyle seçince odak kalemde ya da kaydetme düğmesinde (${byMouse})`);
    ok(!/acc-query|BODY/.test(byMouse), "odak cari kutusunda ya da BODY'de kalmadı");
  });
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} uiux-244-ux9-ux10: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  await edm.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
