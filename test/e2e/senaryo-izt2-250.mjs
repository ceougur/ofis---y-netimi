// 2.5.0 İzleyen tur 2 EKRANDAN (görev metni docs/devir/2.5.0-DEVAM/izt2-istem.txt; tasarım docs/erp/C7B-FATURA-TASARIM.md §20). Gerçek tıklama + Tab + insan hızı (ders 12); sahte saat
// (sunucu ve sayfa, 08.10.2026 — ders 13); lisans servisi yok (ders 30); pencere seçicisi en üstteki görünür pencere (ders 39); "veri bozulmaz" veri tabanı / API okunarak söylenir. Kayıtlar
// API'den kurulur (değişmeyen yollar); DEĞİŞEN yollar (Düzenle kaydı, İptal Et, iade Düzenle'si) ve gösterimler (kart penceresi, Faturalar listesi) ekrandan. BEKLENENLER ELLE (ders 5; kararların sözünden):
//   A) S241 = A: fatura 900 → Mevcut Borç kartı 900 (10.10 / 10.11 / 10.12) → tahsilat 600 → Düzenle Miktar 3 → 1 (klavye) → kart penceresi Kalan ₺0,00 ve Tahsil Edilen ₺600,00 (tabanda Kalan ₺300,00),
//      kart tutarı 600 (veri tabanı), cari kartı özeti 600 / 0 (API), bakiye −300 (avans).
//   B) Kapsam seçimi (S110 = A, S120 = A; D 18:28 (2)): A 600 (05.10) + B 600 (06.10), elle kart 600 → listede A 'Taksitte', B 'Vadesi Geçti'; B'nin İptal Et'i kartı DEĞİŞTİRMEZ (tabanda
//      kapatıyordu); A'nın İptal Et'i kartı kapatır (S211).
//   C) İade Düzenle'si (S238 = A komşusu): taksitli fatura 900 (10.10 / 10.11 / 10.12), tahsilat 300, iade 600 → iade Düzenle Miktar 2 → 1 → kart penceresinde iki taksit satırı (10.10 ve 10.12
//      ₺300,00; tabanda tek satır 10.10 ₺600,00), Kalan ₺300,00.
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

const OUT = process.env.EKRAN_DIR || path.join(HERE, "artifacts", "senaryo-izt2-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const NOW = { time: "2026-10-08T12:00:00+03:00", fixed: true };
const root = mkdtempSync(path.join(tmpdir(), "destekofis-izt2-"));
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
const inv = `${MODAL} .hof-invoices-modal`;
let page = null;
let shotNo = 0;
const shot = async name => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), fullPage: true }).catch(() => null);
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    await shot("hata");
  }
};
const human = () => page.waitForTimeout(300);
const text = async sel => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ");
const W = "/api/workspace";
const api = await server.login();
let minute = 0;
const tick = () => app.config.now.set(`2026-10-08T12:${String((minute += 1)).padStart(2, "0")}:00+03:00`);
const acc = async name => (await must("cari", api.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id;
const totals = async id => (await must("cari", api.get(`${W}/accounts/${id}`))).totals;
const planOf = id => app.store.get("SELECT plan_id AS p FROM invoices WHERE id = ?", id).p;
const planRow = id => ({ ...app.store.get("SELECT id, ref_no AS refNo, status, total, deleted_at AS deletedAt FROM plans WHERE id = ?", id) });
const itemRows = id => app.store.all("SELECT id, seq, due_date AS dueDate, amount FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq", id).map(row => ({ ...row }));
const goods = async (accountId, date, qty, payment) => (tick(), (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment }))).id);
const cover = async (accountId, total, firstDue, registeredOn, name) => {
  tick();
  const made = await must("Mevcut Borç kartı", api.post(`${W}/plans`, { accountId, name, total: String(total), registeredOn, mode: "auto", count: 3, firstDue, coversBalance: true }));
  return made.id || made.plan?.id;
};
const pay = (planId, amount) => (tick(), must("taksit tahsilatı", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date: "2026-10-08", method: "cash" })));
const closeByApi = async id => {
  tick();
  const v = await must("kart", api.get(`${W}/plans/${id}`));
  await must("Kartı Kapat", api.put(`${W}/plans/${id}`, { status: "closed", closeRemaining: v.totals.remaining }));
};
const giveBack = async (invoiceId, accountId, qty) => {
  tick();
  const line = (await must("fatura", api.get(`${W}/invoices/${invoiceId}`))).lines[0].id;
  return (await must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId, originalId: invoiceId, issueDate: "2026-10-08", lines: [{ originLineId: line, qty }], payment: { cash: [] }, force: true }))).id;
};
async function closeAll() {
  for (let i = 0; i < 8 && (await page.$(MODAL)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const top = await text(topSel);
    // Ders 34: dolu formu kapatırken programın ortak sorusu ("Kaydedilmemiş Değişiklik") BEKLENEN sorudur; yanıtı nedeniyle yazılır.
    if (/Kaydedilmemiş Değişiklik/.test(top) && (await page.$(`${topSel} [data-answer="yes"]`))) {
      console.log("    [soru] Kaydedilmemiş Değişiklik → Kaydetmeden Kapat (beklenen: form açık kapatılıyor)");
      await page.click(`${topSel} [data-answer="yes"]`);
      await page.waitForTimeout(250);
    }
  }
}
async function openInvoiceCard(id, tab = "sale") {
  await closeAll();
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="new"]`, { timeout: 15000 });
  await human();
  await page.click(`${inv} .hof-inv-tabs [data-tab="${tab}"]`);
  await page.waitForSelector(`${inv} tr[data-inv="${id}"]`, { timeout: 15000 });
  await human();
  await page.click(`${inv} tr[data-inv="${id}"]`);
  await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 15000 });
  await human();
}
async function openPlanCard(planId, status = "all") {
  await closeAll();
  await page.click('#hof-sidecard [data-action="plans"]');
  await page.waitForSelector(`.hof-plans [data-status="${status}"]`, { timeout: 15000 });
  await human();
  await page.click(`.hof-plans [data-status="${status}"]`);
  await human();
  await page.waitForSelector(`.hof-plans-table tbody tr[data-plan="${planId}"]`, { timeout: 15000 });
  await human();
  await page.click(`.hof-plans-table tbody tr[data-plan="${planId}"]`);
  await page.waitForSelector('.hof-plans [data-act="close"], .hof-plans [data-act="reopen"]', { timeout: 15000 });
  await human();
}
const kpi = () => text(".hof-plans .hof-plans-kpis .hof-cash-balance strong");
// Düzenle → (isteğe bağlı: Miktar) → Tab ile gezinme → Değişiklikleri Kaydet → onay → Kaydet. Açılıştaki kalan ödeme seçimi `opened` olarak döner.
async function modifySave(id, { qty = "", tab = "sale" } = {}) {
  await openInvoiceCard(id, tab);
  await page.click(`${inv} [data-act="modify"]`);
  await page.waitForSelector(`${inv} [data-act="issue"]`, { timeout: 15000 });
  await human();
  const opened = await page.evaluate(sel => document.querySelector(`${sel} input[name="hof-inv-rest"]:checked`)?.dataset.rest || "", inv);
  const field = `${inv} [data-l="0"][data-f="qty"]`;
  await page.click(field);
  await human();
  if (qty) {
    await page.keyboard.press("Control+A");
    await page.keyboard.type(qty, { delay: 120 });
    await human();
  }
  await page.keyboard.press("Tab");
  await human();
  await page.keyboard.press("Tab");
  await human();
  await page.waitForTimeout(800); // ön hesap (calc)
  await page.click(`${inv} [data-act="issue"]`);
  await page.waitForSelector(`${topSel} [data-answer="yes"]`, { timeout: 15000 });
  await human();
  const ask = await text(topSel);
  console.log(`    [soru] "Değişiklikler Kaydedilsin mi?" → Değişiklikleri Kaydet (beklenen soru)`);
  await page.click(`${topSel} [data-answer="yes"]`);
  await page.waitForTimeout(1500);
  return { opened, ask };
}

const invStatus = id => app.store.get("SELECT status FROM invoices WHERE id = ?", id).status;
const paidText = () => text(".hof-plans .hof-plans-kpis");
// İptal Et penceresi: İptal Nedeni klavyeyle, Tab ile İptal Et düğmesine, Enter (senaryo-c7b-tur3-250 ile aynı yol). Dönüş: penceredeki metin.
async function cancelFromScreen(id, reason) {
  await openInvoiceCard(id);
  await page.waitForSelector(`${inv} [data-act="cancel"]`, { timeout: 10000 });
  await page.click(`${inv} [data-act="cancel"]`);
  await page.waitForSelector(`${topSel} form input[name="reason"]`);
  await human();
  const intro = await text(topSel);
  await page.click(`${topSel} form input[name="reason"]`);
  await page.keyboard.type(reason, { delay: 45 });
  let onSubmit = false;
  for (let i = 0; i < 8 && !onSubmit; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(150);
    onSubmit = await page.evaluate(() => document.activeElement?.type === "submit" && /İptal Et/.test(document.activeElement?.textContent || ""));
  }
  ok(onSubmit, "Tab ile İptal Et düğmesine gelinir");
  await page.keyboard.press("Enter");
  for (let i = 0; i < 25 && invStatus(id) !== "cancelled"; i += 1) {
    await page.waitForTimeout(400);
    if (await page.$(`${topSel} [data-answer="yes"]`)) {
      // Ders 34: bu yolda soru BEKLENMEZ; yanıtlanmaz, adım kırmızı kalır.
      ok(false, `beklenmeyen soru: ${(await text(topSel)).slice(0, 160)}`);
      break;
    }
  }
  return intro;
}
const listRow = async id => {
  await closeAll();
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="new"]`, { timeout: 15000 });
  await human();
  await page.click(`${inv} .hof-inv-tabs [data-tab="sale"]`);
  await page.waitForSelector(`${inv} tr[data-inv="${id}"]`, { timeout: 15000 });
  return text(`${inv} tr[data-inv="${id}"]`);
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", error => errors.push(error.message));
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });

  // Kurulum (API): fatura numarası ve tarih sırası uyuşmalı (kronoloji) — eski tarihli faturalar önce.
  const B = await acc("Ekran İzt2 Kapsam Müşterisi");
  const bA = await goods(B, "2026-10-05", 2, { rest: "account" });
  const bB = await goods(B, "2026-10-06", 2, { rest: "account" });
  tick();
  const bP = (await must("elle kart", api.post(`${W}/plans`, { accountId: B, name: "Ekran İzt2 Elle Kart", total: "600", registeredOn: "2026-10-07", mode: "auto", count: 2, firstDue: "2026-11-10", coversBalance: true }))).id;
  const A = await acc("Ekran İzt2 Düzenle Müşterisi");
  const aF = await goods(A, "2026-10-07", 3, { rest: "account" });
  const aP = await cover(A, 900, "2026-10-10", "2026-10-07", "Ekran İzt2 Düzenle Kartı");
  const C = await acc("Ekran İzt2 İade Müşterisi");
  const cF = await goods(C, "2026-10-08", 3, { rest: "installments", installments: { count: 3, firstDue: "2026-10-10" } });
  const cP = planOf(cF);

  await step("A) S241 = A — tahsilat 600 + Düzenle 900 → 300: kart Kalan ₺0,00 · Tahsil Edilen ₺600,00; bakiye −300", async () => {
    await pay(aP, 600);
    const { ask } = await modifySave(aF, { qty: "1" });
    ok(/Değişiklikler Kaydedilsin mi\?/.test(ask), "onay sorusu geldi");
    ok(planRow(aP).total === 600, `kart tutarı 600 (veri tabanı): ${planRow(aP).total}`);
    await openPlanCard(aP, "all");
    ok(/₺0,00/.test(await kpi()), `kart penceresi Kalan ₺0,00 (tabanda ₺300,00): ${await kpi()}`);
    ok(/₺600,00/.test(await paidText()), `kart penceresinde Tahsil Edilen ₺600,00: ${(await paidText()).slice(0, 200)}`);
    await shot("s241-kart-penceresi");
    const card = await must("kart", api.get(`${W}/plans/${aP}`));
    ok(card.totals.paid === 600 && card.totals.remaining === 0, `kart (API) Tahsil Edilen 600 · Kalan 0: ${card.totals.paid} / ${card.totals.remaining}`);
    const summary = (await must("cari", api.get(`${W}/accounts/${A}`))).plans.find(p => p.id === aP);
    ok(summary.totals.paid === 600 && summary.totals.remaining === 0, `cari kartı özeti 600 / 0: ${summary.totals.paid} / ${summary.totals.remaining}`);
    ok((await totals(A)).balance === -300, "bakiye −300 (fazlası carinin avansı)");
  });

  await step("B) Kapsam seçimi — A 'Taksitte', B 'Vadesi Geçti'; B'nin İptal Et'i kartı değiştirmez; A'nın İptal Et'i kartı kapatır", async () => {
    const rowA = await listRow(bA);
    const rowB = await listRow(bB);
    ok(/Taksitte/.test(rowA), `A 'Taksitte': ${rowA.slice(0, 160)}`);
    ok(/Vadesi Geçti/.test(rowB), `B 'Vadesi Geçti': ${rowB.slice(0, 160)}`);
    await shot("kapsam-liste");
    await cancelFromScreen(bB, "Ekran B iptal");
    ok(invStatus(bB) === "cancelled", "B iptal edildi (veri tabanı)");
    const after = planRow(bP);
    ok(after.status === "active" && after.total === 600, `kart DEĞİŞMEDİ (tabanda kapanıyordu): ${after.status} ${after.total}`);
    await openPlanCard(bP, "all");
    ok(/₺600,00/.test(await kpi()), `kart penceresi Kalan ₺600,00: ${await kpi()}`);
    await shot("kapsam-b-iptal-sonrasi-kart");
    await cancelFromScreen(bA, "Ekran A iptal");
    ok(invStatus(bA) === "cancelled", "A iptal edildi");
    const closed = planRow(bP);
    ok(closed.status === "closed" && closed.total === 0, `A'nın iptali kartı kapattı (S211): ${closed.status} ${closed.total}`);
    ok((await totals(B)).balance === 0, "bakiye 0");
  });

  await step("C) İade Düzenle'si — kendi kart aynı taksitlere geri büyür: 10.10 ve 10.12 ₺300,00", async () => {
    await pay(cP, 300);
    const r = await giveBack(cF, C, 2);
    ok(itemRows(cP).length === 1, `iade 600 → kartta tek taksit (10.10): ${JSON.stringify(itemRows(cP).map(x => [x.dueDate, x.amount]))}`);
    await modifySave(r, { qty: "1", tab: "returns" });
    const rows = itemRows(cP).map(x => `${x.dueDate}:${x.amount}`);
    ok(JSON.stringify(rows) === JSON.stringify(["2026-10-10:300", "2026-12-10:300"]), `taksitler 10.10 300 + 10.12 300 (tabanda 10.10 600): ${rows.join(" | ")}`);
    await openPlanCard(cP, "all");
    const shown = await page.$$eval(".hof-plans .hof-plan-items tbody tr[data-item]", trs => trs.map(tr => tr.textContent.replace(/\s+/g, " ").trim()));
    ok(shown.length === 2 && shown.every(row => row.includes("₺300,00")), `kart penceresinde iki taksit satırı ₺300,00: ${shown.join(" | ")}`);
    ok(/₺300,00/.test(await kpi()), `Kalan ₺300,00: ${await kpi()}`);
    await shot("iade-duzenle-sonrasi-kart");
    ok((await totals(C)).balance === 300, "bakiye 300");
  });

  const integrity = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
  ok(integrity.ok === true, `Mutabakat Testi temiz${integrity.ok ? "" : `: ${JSON.stringify(integrity.failures || integrity.checks?.filter(c => !c.ok)).slice(0, 300)}`}`);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  await shot("hata");
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-izt2-250: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
