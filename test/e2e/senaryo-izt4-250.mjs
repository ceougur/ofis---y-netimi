// 2.5.0 İzleyen tur 4 EKRANDAN (görev metni docs/devir/2.5.0-DEVAM/izt4-istem.txt; tasarım docs/erp/C7B-FATURA-TASARIM.md §22 — S255 = A). Gerçek tıklama + Tab + insan hızı (ders 12);
// sahte saat (sunucu ve sayfa, 20.10.2026 — ders 13); lisans servisi yok (ders 30); pencere seçicisi en üstteki görünür pencere (ders 39); "veri bozulmaz" veri tabanı okunarak söylenir.
// KARAR (AYNEN): S255 = A — "bağlı tahsilat önce faturanın GÖSTERİLEN açığını (kartın almadığı kısım — örnekte 300) kapatır; fazlası S230 = A'nın sözüyle 'carinin vadesi en önce gelen açık borcuna'
// (tek kuyruk — örnekte kartın 05.10 taksitinden başlayarak) gider: 600 → fatura kapanır, kart Tahsil 300 · Kalan 300 (05.10 ödenmiş, 05.11'den 100), bakiye 300, gecikmiş 0; 900 → kart Kalan 0, bakiye 0".
// Kurulum (API — değişmeyen yollar), iki cari: F 900 (01.09; 3 × 250 + %20), elle Mevcut Borç kartı 600 (02.09; 3 × 200, 05.10 / 05.11 / 05.12) — kart F'nin 600'ünü alır.
// BEKLENENLER ELLE (kararın sözünden):
//   A) Fatura kartı: Açık ₺300,00 + 'Taksit Kartında · ₺600,00'; + Tahsilat Ekle öneri 300 → kullanıcı ÖNERİDEN FAZLA 600 yazar (Tab) → fatura Taksitte (Açık 0); Taksitler'de kart
//      Tahsil Edilen ₺300,00 · Kalan ₺300,00; liste satırı Kalan ₺300,00; cari kartında kart satırı Ödenen ₺300,00 · Kalan ₺300,00, Bakiye ₺300,00, Gecikmiş Borç ₺0,00.
//      Tabanda (6a1d19d1) kart Tahsil Edilen ₺0,00 · Kalan ₺600,00 kalıyordu, Gecikmiş Borç ₺200,00.
//   B) Cari kartı → + Tahsilat → Kapatılacak Fatura = F, 900 → kart Kalan ₺0,00 (Tahsil Edilen ₺600,00); Bakiye ₺0,00; Gecikmiş Borç ₺0,00. Tabanda Kalan ₺600,00.
// Çıkış: "N geçti, M kaldı".
import fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..", "..");
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { installPageClock, ADMIN_PASSWORD } = await imp("test/helpers.mjs");
const { CURRENT, bootVersion } = await imp("test/guvenilirlik/surumler.mjs");

const OUT = process.env.EKRAN_DIR || path.join(HERE, "artifacts", "senaryo-izt4-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
const root = mkdtempSync(path.join(tmpdir(), "destekofis-izt4-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const server = await bootVersion(CURRENT, { ...dirs, now: NOW });
const app = server.app;
const BASE = server.base;
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
const MODAL = ".hof-modal-backdrop.is-visible";
const topSel = `${MODAL}:nth-last-child(1 of ${MODAL})`;
let shotNo = 0;
const shot = async (page, name) => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), fullPage: true }).catch(() => null);
};
let page = null;
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    if (page) await shot(page, "hata");
  }
};
const human = p => p.waitForTimeout(300);
const text = async (p, sel) => ((await p.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ");
const W = "/api/workspace";
const api = await server.login();
const card = async id => {
  const v = await must("kart", api.get(`${W}/plans/${id}`));
  return { paid: v.totals.paid, left: v.totals.remaining, items: v.items.map(i => i.remaining) };
};
const entriesOf = (accountId, invoiceId) => app.store.all("SELECT kind, amount, invoice_id AS invoiceId FROM account_entries WHERE account_id = ? AND kind = 'in'", accountId).filter(row => row.invoiceId === invoiceId);

async function login(p, user, pass) {
  await installPageClock(p, app.config.now);
  await p.goto(`${BASE}/`);
  await p.fill("#hof-auth input[name=username]", user);
  await p.fill("#hof-auth input[name=password]", pass);
  await Promise.all([p.waitForEvent("load"), p.click('#hof-auth button[type="submit"]')]);
  await p.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await p.waitForFunction(() => Boolean(window.HOF?.invoices?.openDoc && window.HOF?.accounts?.open), null, { timeout: 20000 });
  await p.evaluate(() => localStorage.setItem(`hof-notices-off:${window.HOF.user.id}`, "1"));
}
async function closeAll(p) {
  for (let i = 0; i < 8 && (await p.$(MODAL)); i += 1) {
    await p.keyboard.press("Escape");
    await p.waitForTimeout(250);
  }
}
async function typeAmount(p, value) {
  await p.click(`${topSel} input[name="amount"]`);
  await p.keyboard.press("Control+A");
  await p.keyboard.type(value, { delay: 120 });
  await p.keyboard.press("Tab");
  await human(p);
}
async function openPlans(p, planId) {
  await closeAll(p);
  await p.click('#hof-sidecard [data-action="plans"]');
  await p.waitForSelector('.hof-plans [data-status="all"]', { timeout: 15000 });
  await human(p);
  await p.click('.hof-plans [data-status="all"]');
  await human(p);
  await p.waitForSelector(`.hof-plans-table tbody tr[data-plan="${planId}"]`, { timeout: 15000 });
  await human(p);
  const row = await text(p, `.hof-plans-table tbody tr[data-plan="${planId}"]`);
  await p.click(`.hof-plans-table tbody tr[data-plan="${planId}"]`);
  await p.waitForSelector('.hof-plans [data-act="close"], .hof-plans [data-act="reopen"]', { timeout: 15000 });
  await human(p);
  return { row, kpis: await text(p, ".hof-plans .hof-plans-kpis") };
}
async function openAccount(p, accountId) {
  await closeAll(p);
  await p.click("#hof-sidecard [data-action=accounts]");
  await p.waitForSelector(`${MODAL} tr[data-account="${accountId}"]`, { timeout: 15000 });
  await human(p);
  await p.click(`${MODAL} tr[data-account="${accountId}"]`);
  await p.waitForSelector(`${MODAL} [data-entry="in"]`, { timeout: 15000 });
  await human(p);
}

try {
  const setup = async name => {
    const A = (await must("cari", api.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id;
    app.config.now.set("2026-09-01T12:00:00+03:00");
    const F = (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId: A, issueDate: "2026-09-01", lines: [{ name: "Mal", qty: 3, unitPrice: 250, vatRate: 20 }], payment: { rest: "account" } }))).id;
    app.config.now.set("2026-09-02T12:00:00+03:00");
    const K = (await must("kart", api.post(`${W}/plans`, { accountId: A, name: `${name} Kartı`, total: "600", registeredOn: "2026-09-02", mode: "auto", count: 3, firstDue: "2026-10-05", coversBalance: true }))).id;
    app.config.now.set("2026-10-20T12:00:00+03:00");
    return { A, F, K };
  };
  const one = await setup("Ekran İzt4 Fatura Tahsilatı");
  const two = await setup("Ekran İzt4 Kapatılacak Fatura");

  page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" })).newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", error => errors.push(error.message));
  await login(page, "admin", ADMIN_PASSWORD);

  await step("A) Fatura kartı → + Tahsilat Ekle: öneri 300, kullanıcı 600 yazar → kart Tahsil Edilen 300 · Kalan 300", async () => {
    await page.evaluate(id => window.HOF.invoices.openDoc(id), one.F);
    await page.waitForSelector(`${MODAL} [data-act="pay"]`, { timeout: 15000 });
    await human(page);
    const before = await text(page, MODAL);
    ok(/Taksit Kartında: .*₺600,00/.test(before), `fatura kartında 'Taksit Kartında · ₺600,00' (S230): ${(before.match(/Taksit Kartında[^₺]*₺[\d.,]+/) || [""])[0]}`);
    await shot(page, "a-fatura-karti-once");
    await page.click(`${MODAL} [data-act="pay"]`);
    await page.waitForSelector(`${topSel} input[name="amount"]`, { timeout: 15000 });
    await human(page);
    const suggested = await page.$eval(`${topSel} input[name="amount"]`, node => node.value);
    const intro = await text(page, `${topSel} .hof-modal-text`);
    ok(suggested.replace(/[^\d]/g, "").startsWith("300"), `form ÖNERİSİ gösterilen açık 300 (S230; sınır değişmez): ${suggested}`);
    ok(/fazlası carinin vadesi en önce gelen açık borcuna gider/.test(intro), `form metni kuralı söylüyor: ${intro.slice(0, 220)}`);
    await typeAmount(page, "600");
    await shot(page, "a-tahsilat-formu-600");
    await page.click(`${topSel} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible) input[name="amount"]'), null, { timeout: 15000 });
    await page.waitForTimeout(1200);
    const rows = entriesOf(one.A, one.F);
    ok(rows.length === 1 && Number(rows[0].amount) === 600, `veri tabanı: faturaya bağlı tahsilat 600 (${JSON.stringify(rows)})`);
    const c = await card(one.K);
    ok(c.paid === 300 && c.left === 300 && c.items.join("/") === "0/100/200", `API kart Tahsil Edilen 300 · Kalan 300, satırlar 0 / 100 / 200 (tabanda 0 / 600): ${JSON.stringify(c)}`);
    const doc = await text(page, MODAL);
    await shot(page, "a-fatura-karti-sonra");
    ok(/Taksitte/.test(doc), `fatura kartı 'Taksitte' (gösterilen açık 0): ${(doc.match(/(Taksitte|Ödendi|Vadesi Geçti|Kısmi)/) || [""])[0]}`);
    const plans = await openPlans(page, one.K);
    ok(/Tahsil Edilen/.test(plans.kpis) && /₺300,00\s*Tahsil Edilen/.test(plans.kpis) && /₺300,00\s*Kalan/.test(plans.kpis), `kart penceresi Tahsil Edilen ₺300,00 · Kalan ₺300,00: ${plans.kpis.slice(0, 220)}`);
    ok(/₺300,00/.test(plans.row), `Taksitler liste satırı: ${plans.row.slice(0, 200)}`);
    await shot(page, "a-kart-penceresi");
    await openAccount(page, one.A);
    const acc = await text(page, topSel);
    const planRow = await text(page, `${topSel} tr[data-open-plan="${one.K}"]`);
    ok(/₺600,00\s*₺300,00\s*₺300,00/.test(planRow), `cari kartında kart satırı Toplam ₺600,00 · Ödenen ₺300,00 · Kalan ₺300,00: ${planRow.slice(0, 200)}`);
    ok(/₺300,00\s*Bakiye/.test(acc) && /₺0,00\s*Gecikmiş Borç/.test(acc), `cari kartı Bakiye ₺300,00, Gecikmiş Borç ₺0,00: ${(acc.match(/₺[\d.,]+\s*Bakiye/) || [""])[0]} · ${(acc.match(/₺[\d.,]+\s*Gecikmiş Borç/) || [""])[0]}`);
    await shot(page, "a-cari-karti");
    const t = (await must("cari", api.get(`${W}/accounts/${one.A}`))).totals;
    ok(t.balance === 300 && t.overdueDebt === 0, `API bakiye 300, gecikmiş 0: ${t.balance} / ${t.overdueDebt}`);
  });

  await step("B) Cari kartı → + Tahsilat → Kapatılacak Fatura = F, 900 → kart Kalan ₺0,00, bakiye ₺0,00", async () => {
    await openAccount(page, two.A);
    await page.click(`${MODAL} [data-entry="in"]`);
    // Ders 34: carinin açık taksit kartı olduğundan program SORAR ('Taksite Yaz' / 'Taksit Dışı Tahsilat') — beklenen soru; Kapatılacak Fatura yolu 'Taksit Dışı Tahsilat'tır.
    await page.waitForSelector(`${topSel} [data-plain]`, { timeout: 15000 });
    await human(page);
    ok(true, `beklenen soru geldi: ${(await text(page, `${topSel} .hof-modal-text`)).slice(0, 120)} → 'Taksit Dışı Tahsilat'`);
    await shot(page, "b-soru-taksit-disi");
    await page.click(`${topSel} [data-plain]`);
    await page.waitForSelector(`${topSel} select[name="invoiceId"]`, { timeout: 15000 });
    await human(page);
    const options = await page.$$eval(`${topSel} select[name="invoiceId"] option`, nodes => nodes.map(node => ({ value: node.value, label: node.textContent.trim() })));
    ok(options.some(option => option.value === two.F), `Kapatılacak Fatura seçeneklerinde F (gösterilen açık 300): ${options.map(option => option.label).join(" | ").slice(0, 240)}`);
    await typeAmount(page, "900");
    await page.selectOption(`${topSel} select[name="invoiceId"]`, two.F);
    await human(page);
    await shot(page, "b-tahsilat-formu-900");
    await page.click(`${topSel} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible) select[name="invoiceId"]'), null, { timeout: 15000 });
    await page.waitForTimeout(1200);
    const rows = entriesOf(two.A, two.F);
    ok(rows.length === 1 && Number(rows[0].amount) === 900, `veri tabanı: Kapatılacak Fatura = F, 900 (${JSON.stringify(rows)})`);
    const c = await card(two.K);
    ok(c.paid === 600 && c.left === 0, `API kart Tahsil Edilen 600 · Kalan 0 (tabanda 0 / 600): ${JSON.stringify(c)}`);
    const acc = await text(page, topSel);
    const planRow = await text(page, `${topSel} tr[data-open-plan="${two.K}"]`);
    ok(/₺600,00\s*₺600,00\s*₺0,00/.test(planRow), `cari kartında kart satırı Ödenen ₺600,00 · Kalan ₺0,00: ${planRow.slice(0, 200)}`);
    ok(/₺0,00\s*Gecikmiş Borç/.test(acc), `cari kartı Gecikmiş Borç ₺0,00: ${(acc.match(/₺[\d.,]+\s*Gecikmiş Borç/) || [""])[0]}`);
    await shot(page, "b-cari-karti");
    const plans = await openPlans(page, two.K);
    ok(/₺600,00\s*Tahsil Edilen/.test(plans.kpis) && /₺0,00\s*Kalan/.test(plans.kpis), `kart penceresi Tahsil Edilen ₺600,00 · Kalan ₺0,00: ${plans.kpis.slice(0, 220)}`);
    await shot(page, "b-kart-penceresi");
    const t = (await must("cari", api.get(`${W}/accounts/${two.A}`))).totals;
    ok(t.balance === 0 && t.overdueDebt === 0, `API bakiye 0, gecikmiş 0: ${t.balance} / ${t.overdueDebt}`);
  });

  const integrity = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
  ok(integrity.ok === true, `Mutabakat Testi temiz${integrity.ok ? "" : `: ${JSON.stringify(integrity.failures).slice(0, 300)}`}`);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  if (page) await shot(page, "hata");
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-izt4-250: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
