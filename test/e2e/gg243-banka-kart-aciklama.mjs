// Dar kontrol turu 2.4.3 — ek (b): Banka → Ters Kaydet'in iade faturası (kilitli dönemdeki KDV'li masraf) seride daha eski bekleyen varken numarasız
// ertelenir; banka işleminin açıklaması "İade Faturası (gönderilecek)" der. Gönderilince açıklama numaraya döner (sunucu: ek 3). Bu test EKRAN
// tarafını sınar: Banka penceresinde İşlem Kartı AÇIKKEN (önbellekteki görünüm) açıklama numaraya dönünce kart, kullanıcı bir şey yapmadan yeni
// açıklamayı gösterir.
//   A. Başka oturum Tümünü Gönder'e basar (canlı olay)            → açık kart numarayı gösterir, "(gönderilecek)" kalmaz.
//   B. Aynı sayfa Tümünü Gönder'i çağırır (bu ekranın yazımı)     → açık kart numarayı gösterir.
// Sahte EDM; ağa çıkmaz. Eski kodda: d64ebf8'de ön koşul oluşmaz (iade faturası ertelenmez); bf53782'de açıklama sunucuda hiç dönmez (kırmızı).
// Önbellek tazelemesi (ekran) için ayrıca bir eksik bulunmadı: "gerileme nöbeti". DEPO=<eski kopya> ile koşulur. Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const { BUYER_VKN, OUR_VKN, startMockEdm, vkn } = await import(pathToFileURL(path.join(ROOT, "test", "einvoice-mock.mjs")).href);
const { resetEdmCaches } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "einvoice", "edm.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const BANK = "/api/workspace/bank";
resetEdmCaches();
const edm = await startMockEdm();
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
  return globalThis.fetch(input, init);
};
const root = mkdtempSync(path.join(tmpdir(), "destekofis-gg243-banka-kart-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, fetchImpl, edocEnabled: true, testSeriesStart: () => 1, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f45" }, startLicenseTimers: false });
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
await must("kurulum geç", api.post(`${BANK}/setup/dismiss`, {}));
await must("firma", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true }));
await must("entegratör", api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
const account = await must("hesap", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
const addr = { address: "Atatürk Blv. 8", district: "Altındağ", city: "Ankara", registeredOn: "2026-09-01" };
// A: e-Arşiv serisi (TEA) — mükellef olmayan banka carisi; B: e-Fatura serisi (TEF) — e-Fatura mükellefi banka carisi (posta kutusu seçili).
const archiveBank = await must("banka carisi", api.post("/api/workspace/accounts", { name: "Ziraat Bankası A.Ş.", type: "supplier", partyKind: "company", taxNo: vkn(700000001), taxOffice: "Ulus", ...addr }));
const efaturaBank = await must("banka carisi (e-Fatura)", api.post("/api/workspace/accounts", { name: "Alıcı Bankası A.Ş.", type: "supplier", partyKind: "company", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr", ...addr }));
const fees = [];
for (const [party, no] of [[archiveBank, "ZBA2026000000001"], [efaturaBank, "ABA2026000000001"]]) fees.push(await must("KDV'li masraf", api.post(`${BANK}/vouchers`, { type: "fee", accountId: account.id, amount: "120", feeType: "eft", tax: "vat_incl", partyId: party.id, invoiceNo: no, date: "2026-10-05" })));
const person = await must("müşteri", api.post("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", registeredOn: "2026-09-01" }));
const firm = await must("e-Fatura müşterisi", api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", partyKind: "company", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr", registeredOn: "2026-09-01" }));
const sale = accountId => must("bekleyen", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId, issueDate: "2026-10-07", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
const waitingArchive = await sale(person.id);
await sale(firm.id);
await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: "2026-10-06" }));
const reversals = [];
for (const fee of fees) {
  await must("Ters Kaydet", api.post(`${BANK}/events/${fee.id}/reverse`, { reason: "Banka masrafı iade etti" }));
  const invoice = app.store.get("SELECT id, number, e_status AS eStatus FROM invoices WHERE original_id = ?", fee.invoice.id);
  const event = app.store.get("SELECT id, no, description FROM fin_events WHERE type = 'reversal' AND invoice_id = ?", invoice.id);
  reversals.push({ invoice, event });
}
const description = id => app.store.get("SELECT description FROM fin_events WHERE id = ?", id).description;
const numberOf = id => app.store.get("SELECT number FROM invoices WHERE id = ?", id).number;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const modalText = () => page.evaluate(() => document.querySelector(".hof-modal-backdrop.is-visible .hof-bank-modal")?.innerText || "");
const shows = async (text, ms = 12000) => page.waitForFunction(t => (document.querySelector(".hof-modal-backdrop.is-visible .hof-bank-modal")?.innerText || "").includes(t), text, { timeout: ms }).then(() => true, () => false);
const sendAllVia = async post => {
  for (let i = 0; i < 5; i += 1) {
    const r = await post();
    if (!r.remaining || !r.sent) break;
  }
};

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.bank?.openEvent);

  for (const [index, label, via] of [[0, "A) başka oturum Tümünü Gönder (canlı olay)", "other"], [1, "B) aynı sayfa Tümünü Gönder (bu ekranın yazımı)", "local"]]) {
    console.log(label);
    const { event } = reversals[index];
    const invoice = app.store.get("SELECT id, number, e_status AS eStatus FROM invoices WHERE id = ?", reversals[index].invoice.id);
    if (!ok(invoice.number === "" && invoice.eStatus === "waiting" && /İade Faturası \(gönderilecek\)$/.test(event.description), `ön koşul: iade faturası numarasız, açıklama "(gönderilecek)" (${invoice.number || "numarasız"}; ${event.description})`)) continue;
    await page.evaluate(id => window.HOF.bank.openEvent(id), event.id);
    ok(await shows("İade Faturası (gönderilecek)"), "İşlem Kartı açık, açıklama '(gönderilecek)'");
    if (via === "other") {
      const other = createClient(BASE);
      await other.login("admin", PASS);
      // Yalnız e-Arşiv serisindeki iki belge (B'nin e-Fatura iadesi beklemede kalsın).
      await sendAllVia(async () => must("Tümünü Gönder", other.post("/api/workspace/invoices/send-pending", { ids: [waitingArchive.id, invoice.id] })));
    } else {
      await sendAllVia(() => page.evaluate(() => window.HOF.api("/api/workspace/invoices/send-pending", { method: "POST", body: { all: true } })));
    }
    const number = numberOf(invoice.id);
    ok(/^TE[AF]2026\d{9}$/.test(number) && description(event.id).endsWith(`İade Faturası ${number}`), `sunucuda açıklama numaraya döndü (${description(event.id)})`);
    ok(await shows(`İade Faturası ${number}`), `açık kart kendiliğinden yeni açıklamayı gösterdi (${number})`);
    ok(!(await modalText()).includes("(gönderilecek)"), "kartta '(gönderilecek)' kalmadı");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible"), null, { timeout: 5000 }).catch(() => null);
  }
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  const shot = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "gg243-banka-kart-aciklama-hata.png");
  await page.screenshot({ path: shot, fullPage: true }).then(() => console.log(`  ekran görüntüsü: ${shot}`), () => null);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} gg243-banka-kart-aciklama: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  await edm.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
