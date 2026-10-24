// 2.4.4 madde 15 EKRANDAN (UX18; kullanıcı kararı 21.10.2026: "faturadan Çek/Senet ile tahsilat BU faturayı kapatır … carideki + Tahsilat Çek/Senet
// yolunda seçili Kapatılacak Fatura artık KORUNUR"):
//   S1 Fatura kartı → + Tahsilat Ekle → Tahsilat Yolu "Çek / Senet (portföye alınır)" → evrak formu cari, tutar ve Kapatılacak Fatura (bu fatura) dolu →
//      insan hızında No + Tab → Portföye Al → veri tabanında evrak cheques.invoice_id BOŞ, bağ alış olayında; bu fatura kapandı, eski fatura açık;
//      fatura kartı kendiliğinden yenilenir ("Bu Faturayı Kapatanlar"da evrak).
//   S2 Cari kartı → + Tahsilat → Kapatılacak Fatura = YENİ fatura → Çek / Senet → evrak formunda seçim korunur → yeni fatura kapanır, en eskisi açık.
//   S3 Evrak kartında "Kapatılacak Fatura" bağlantısı faturayı açar.
//   S4 Evrak Düzenle → Kapatılacak Fatura Otomatik → bağ düşer (en eski faturaya döner).
//   S5 Taksite Say seçilince Kapatılacak Fatura boşalır, Kapatılacak Fatura seçilince Taksite Say boşalır (ikisi birlikte seçilmez).
//   S6 Alış faturası → + Ödeme Yap → "Çek / Senet (verilir)" → evrak formu Kapatılacak Fatura dolu → alış faturası kapanır.
//   S7 Çek / Senet İşlemleri yetkisi olmayan muhasebe kullanıcısı faturada Çek / Senet yolunu görmez.
//   S8 Fatura iptal → evrak portföyde, kartında Kapatılacak Fatura yok; mizan dengede, Mutabakat Testi temiz.
// Çıkış: "N geçti, M kaldı" (kaldıysa çıkış kodu 1).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-ux18-244-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
const api = await server.login();
const BASE = server.base;
const db = server.app.store;
const one = (sql, ...args) => db.get(sql, ...args);

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
let mainPage = null;
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    if (mainPage) await shot(mainPage, `hata-${title.slice(0, 3).replace(/[^A-Za-z0-9]/g, "")}`);
    if (mainPage) await closeAll(mainPage).catch(() => null);
  }
};

// ---------- Veri (programın kendi uçları) ----------
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
const item = await must("ürün", api.post("/api/workspace/stock", { kind: "service", code: "UX18-E", name: "UX18 Ekran Hizmeti", unit: "Adet", salePrice: "100" }));
let cursor = -60;
let serial = 0;
const invoice = async (account, amount, kind = "sale") => {
  const lines = kind === "purchase" ? [{ name: "UX18 Gider", qty: 1, unitPrice: amount, vatRate: 0, expenseCode: "general" }] : [{ itemId: item.id, qty: 1, unitPrice: amount, vatRate: 0 }];
  const doc = await must("fatura", api.post("/api/workspace/invoices", { kind, scenario: kind === "purchase" ? "expense_purchase" : "service_sale", accountId: account.id, issueDate: day(cursor++), lines, payment: { rest: "open" }, ...(kind === "purchase" ? { number: `UX18-E-A${(serial += 1)}` } : {}) }));
  return must("fatura oku", api.get(`/api/workspace/invoices/${doc.id}`));
};
const customer = await must("cari 1", api.post("/api/workspace/accounts", { name: "UX18 Ekran Müşteri", type: "customer", phone: "0532 018 01 01" }));
const customer2 = await must("cari 2", api.post("/api/workspace/accounts", { name: "UX18 Ekran Cari", type: "customer", phone: "0532 018 02 02" }));
const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "UX18 Ekran Tedarikçi", type: "supplier", phone: "0532 018 03 03" }));
const y1 = await invoice(customer, 1000);
const x1 = await invoice(customer, 800);
const a2 = await invoice(customer2, 500);
const b2 = await invoice(customer2, 700);
const p1 = await invoice(supplier, 600, "purchase");
await must("muhasebe2", api.post("/api/admin/users", { username: "muhasebe2", name: "Muhasebe İki", role: "muhasebe", password: "Muhasebe-2026!", mustChangePassword: false, grants: { add: [], remove: ["cheques.manage"] } }));

const openOf = async id => (await must("fatura", api.get(`/api/workspace/invoices/${id}`))).open;
const chequeBy = serialNo => one("SELECT c.id, c.invoice_id AS own, c.status, c.deleted_at AS deletedAt, ev.invoice_id AS bond FROM cheques c JOIN cheque_events ev ON ev.cheque_id = c.id AND ev.kind IN ('receive', 'issue') WHERE c.serial_no = ?", serialNo);

const browser = await chromium.launch();
const errors = [];
const modal = ".hof-modal-backdrop.is-visible";
const top = ".hof-modal-backdrop.is-visible:last-of-type";
const shot = (page, name) => page.screenshot({ path: path.join(shots, `ux18-244-${name}.png`) }).catch(() => null);
const typeSlow = async (page, text) => {
  for (const ch of text) await page.keyboard.type(ch, { delay: 45 });
};
const closeAll = async page => {
  for (let index = 0; index < 6 && (await page.$(modal)); index += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
async function openPage({ user = "admin", password = ADMIN_PASSWORD } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", user);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.openDoc && window.HOF?.cheques?.newFor && window.HOF?.accounts?.open), null, { timeout: 20000 });
  await page.evaluate(() => {
    localStorage.setItem(`hof-notices-off:${window.HOF.user.id}`, "1");
  });
  return page;
}
const methodOptions = page => page.$$eval(`${top} select[name="method"] option`, nodes => nodes.map(node => ({ value: node.value, label: node.textContent.trim() })));
/** Açılan evrak formunda Kapatılacak Fatura seçimini bekler (sunucudan yüklenir). */
const bondSelect = async page => {
  await page.waitForSelector(`${top} select[name="invoiceId"]`, { timeout: 8000 });
  return page.$eval(`${top} select[name="invoiceId"]`, node => ({ value: node.value, disabled: node.disabled, options: [...node.options].map(option => option.value) }));
};
const fillCheque = async (page, serialNo) => {
  await page.click(`${top} input[name="serialNo"]`);
  await typeSlow(page, serialNo);
  await page.keyboard.press("Tab");
  await page.fill(`${top} input[name="dueDate"]`, day(45));
};

try {
  const page = await openPage();
  mainPage = page;

  await step("S1 Fatura kartı → + Tahsilat Ekle → Çek / Senet: evrak bu faturayı kapatır (en eskiyi değil)", async () => {
    await page.evaluate(id => window.HOF.invoices.openDoc(id), x1.id);
    await page.waitForSelector(`${modal} [data-act="pay"]`, { timeout: 10000 });
    await page.click(`${modal} [data-act="pay"]`);
    await page.waitForSelector(`${top} select[name="method"]`);
    const options = await methodOptions(page);
    ok(options.some(option => option.value === "cheque" && option.label === "Çek / Senet (portföye alınır)"), `tahsilat yolları: ${options.map(option => option.label).join(", ")}`);
    await page.selectOption(`${top} select[name="method"]`, "cheque");
    await page.waitForTimeout(200);
    const intro = await page.$eval(`${top} .hof-modal-text`, node => node.textContent);
    ok(/evrak formu açılır/.test(intro) && /Bu faturaya bağlı kapatılır/.test(intro), `açıklama yola göre: “${intro}”`);
    await page.click(`${top} button[type="submit"]`);
    await page.waitForSelector(`${top} input[name="serialNo"]`, { timeout: 8000 });
    const title = await page.$eval(`${top} .hof-modal-title`, node => node.textContent.trim()).catch(() => "");
    ok(/Çek \/ Senet Al/.test(title), `evrak formu açıldı: ${title}`);
    const bond = await bondSelect(page);
    ok(bond.value === x1.id && !bond.disabled, `Kapatılacak Fatura bu fatura: ${JSON.stringify(bond)}`);
    const amount = await page.$eval(`${top} input[name="amount"]`, node => node.value);
    const party = await page.$eval(`${top} [data-acc-query]`, node => node.value);
    ok(amount.replace(/[^\d]/g, "").startsWith("800") && party === customer.name, `tutar ${amount}, cari ${party}`);
    await fillCheque(page, "UX18E1");
    await shot(page, "s1-evrak-formu");
    await page.click(`${top} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible:last-of-type input[name="serialNo"]'), null, { timeout: 8000 });
    const row = chequeBy("UX18E1");
    ok(row && row.own === "" && row.bond === x1.id && row.status === "portfolio", `veri tabanı: ${JSON.stringify(row)}`);
    ok((await openOf(x1.id)) === 0 && (await openOf(y1.id)) === 1000, "bu fatura kapandı (800), eski fatura açık (1.000)");
    await page.waitForFunction(() => /Çek \/ Senet/.test(document.querySelector(".hof-modal-backdrop.is-visible .hof-inv-closers")?.textContent || ""), null, { timeout: 8000 });
    ok(true, "fatura kartı kendiliğinden yenilendi: kapatanlarda evrak");
    await shot(page, "s1-fatura-karti");
    await closeAll(page);
  });

  await step("S2 Cari → + Tahsilat → Kapatılacak Fatura (yeni) → Çek / Senet: seçim evrak formunda korunur", async () => {
    await page.click("#hof-sidecard [data-action=accounts]");
    await page.waitForSelector(`${modal} tr[data-account="${customer2.id}"]`);
    await page.click(`${modal} tr[data-account="${customer2.id}"]`);
    await page.waitForSelector(`${modal} [data-entry="in"]`);
    await page.click(`${modal} [data-entry="in"]`);
    await page.waitForSelector(`${top} select[name="invoiceId"]`);
    await page.fill(`${top} input[name="amount"]`, "700");
    await page.selectOption(`${top} select[name="method"]`, "cheque");
    await page.selectOption(`${top} select[name="invoiceId"]`, b2.id);
    await page.click(`${top} button[type="submit"]`);
    await page.waitForSelector(`${top} input[name="serialNo"]`, { timeout: 8000 });
    const bond = await bondSelect(page);
    ok(bond.value === b2.id, `evrak formunda Kapatılacak Fatura korundu: ${JSON.stringify(bond)}`);
    await fillCheque(page, "UX18E2");
    await page.click(`${top} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible:last-of-type input[name="serialNo"]'), null, { timeout: 8000 });
    const row = chequeBy("UX18E2");
    ok(row?.bond === b2.id && row?.own === "", `veri tabanı bağı: ${JSON.stringify(row)}`);
    ok((await openOf(b2.id)) === 0 && (await openOf(a2.id)) === 500, "seçilen yeni fatura kapandı, en eski açık");
    await closeAll(page);
  });

  await step("S3 + S4 Evrak kartı: Kapatılacak Fatura bağlantısı; Düzenle → Otomatik → bağ düşer", async () => {
    const row = chequeBy("UX18E2");
    await page.evaluate(id => window.HOF.cheques.open({ id }), row.id);
    await page.waitForSelector(`${modal} .hof-chq-facts`, { timeout: 10000 });
    const facts = await page.$eval(`${modal} .hof-chq-facts`, node => node.textContent.replace(/\s+/g, " "));
    ok(facts.includes("Kapatılacak Fatura") && facts.includes(b2.number), `kartta: ${facts.slice(0, 300)}`);
    await shot(page, "s3-evrak-karti");
    await page.click(`${modal} [data-act="edit"]`);
    const bond = await bondSelect(page);
    ok(bond.value === b2.id, `düzenle formunda bağ: ${JSON.stringify(bond)}`);
    await page.selectOption(`${top} select[name="invoiceId"]`, "");
    await page.click(`${top} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible:last-of-type select[name="invoiceId"]'), null, { timeout: 8000 });
    ok(chequeBy("UX18E2")?.bond === "", "bağ kaldırıldı");
    ok((await openOf(a2.id)) === 0 && (await openOf(b2.id)) === 500, "Otomatik: 700 en eski faturayı (500) ve yeninin 200'ünü kapattı");
    await closeAll(page);
  });

  await step("S5 Taksite Say ile Kapatılacak Fatura birlikte seçilmez (biri seçilince öbürü boşalır)", async () => {
    await must("kart", api.post("/api/workspace/plans", { accountId: customer2.id, name: "UX18 Kart", total: "300", registeredOn: day(-30), mode: "auto", count: 1, firstDue: day(10) }));
    await page.evaluate(({ id, name, invoiceId }) => window.HOF.cheques.newFor({ direction: "in", account: { id, name }, amount: "100", invoiceId }), { id: customer2.id, name: customer2.name, invoiceId: b2.id });
    const bond = await bondSelect(page);
    ok(bond.value === b2.id, `açılışta bağ: ${JSON.stringify(bond)}`);
    await page.waitForSelector(`${top} select[name="planId"]`);
    const plans = await page.$$eval(`${top} select[name="planId"] option`, nodes => nodes.map(node => node.value).filter(Boolean));
    await page.selectOption(`${top} select[name="planId"]`, plans[0]);
    const after = await page.$eval(`${top} select[name="invoiceId"]`, node => node.value);
    ok(after === "", `Taksite Say seçilince Kapatılacak Fatura boşaldı (Otomatik): “${after}”`);
    await page.selectOption(`${top} select[name="invoiceId"]`, b2.id);
    const plan = await page.$eval(`${top} select[name="planId"]`, node => node.value);
    ok(plan === "", `Kapatılacak Fatura seçilince Taksite Say boşaldı: “${plan}”`);
    await closeAll(page);
  });

  await step("S6 Alış faturası → + Ödeme Yap → Çek / Senet (verilir): alış faturası kapanır", async () => {
    await page.evaluate(id => window.HOF.invoices.openDoc(id), p1.id);
    await page.waitForSelector(`${modal} [data-act="pay"]`, { timeout: 10000 });
    await page.click(`${modal} [data-act="pay"]`);
    await page.waitForSelector(`${top} select[name="method"]`);
    const options = await methodOptions(page);
    ok(options.some(option => option.value === "cheque" && option.label === "Çek / Senet (verilir)"), `ödeme yolları: ${options.map(option => option.label).join(", ")}`);
    await page.selectOption(`${top} select[name="method"]`, "cheque");
    await page.click(`${top} button[type="submit"]`);
    await page.waitForSelector(`${top} input[name="serialNo"]`, { timeout: 8000 });
    const bond = await bondSelect(page);
    ok(bond.value === p1.id, `Kapatılacak Fatura alış faturası: ${JSON.stringify(bond)}`);
    await fillCheque(page, "UX18E3");
    await page.click(`${top} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible:last-of-type input[name="serialNo"]'), null, { timeout: 8000 });
    ok(chequeBy("UX18E3")?.bond === p1.id && (await openOf(p1.id)) === 0, "verilen evrak alış faturasını kapattı");
    await closeAll(page);
  });

  await step("S7 Çek / Senet İşlemleri yetkisi olmayan kullanıcı faturada Çek / Senet yolunu görmez", async () => {
    const staff = await openPage({ user: "muhasebe2", password: "Muhasebe-2026!" });
    try {
      await staff.evaluate(id => window.HOF.invoices.openDoc(id), y1.id);
      await staff.waitForSelector(`${modal} [data-act="pay"]`, { timeout: 10000 });
      await staff.click(`${modal} [data-act="pay"]`);
      await staff.waitForSelector(`${top} select[name="method"]`);
      const options = await methodOptions(staff);
      ok(!options.some(option => option.value === "cheque") && options.length >= 3, `yollar: ${options.map(option => option.label).join(", ")}`);
    } finally {
      await staff.context().close();
    }
  });

  await step("S8 Fatura iptal: evrak portföyde kalır, kartında bağ yok; Mutabakat Testi temiz", async () => {
    await must("iptal", api.post(`/api/workspace/invoices/${x1.id}/cancel`, { reason: "UX18 ekran" }));
    const row = chequeBy("UX18E1");
    ok(row?.bond === "" && row?.status === "portfolio" && row?.deletedAt === null, `evrak: ${JSON.stringify(row)}`);
    await page.evaluate(id => window.HOF.cheques.open({ id }), row.id);
    await page.waitForSelector(`${modal} .hof-chq-facts`, { timeout: 10000 });
    const facts = await page.$eval(`${modal} .hof-chq-facts`, node => node.textContent);
    ok(!facts.includes("Kapatılacak Fatura"), "kartta Kapatılacak Fatura yok");
    ok((await openOf(y1.id)) === 200, "evrak (800) artık en eski faturadan düştü: 1.000 − 800");
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    ok(integrity.ok === true, `Mutabakat Testi temiz${integrity.ok ? "" : `: ${JSON.stringify(integrity.checks.filter(check => !check.ok))}`}`);
    await closeAll(page);
  });

  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
} finally {
  await browser.close().catch(() => null);
  await server.close().catch(() => null);
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
