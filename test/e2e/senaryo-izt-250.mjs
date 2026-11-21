// 2.5.0 İzleyen küçük tur EKRANDAN (görev metni docs/devir/2.5.0-DEVAM/izt-istem.txt; tasarım docs/erp/C7B-FATURA-TASARIM.md §19). Gerçek tıklama + Tab + insan hızı (ders 12); sahte saat
// (sunucu ve sayfa, 08.10.2026 — ders 13); lisans servisi yok (ders 30); pencere seçicisi en üstteki görünür pencere (ders 39); "veri bozulmaz" veri tabanı / API okunarak söylenir. Kayıtlar
// API'den kurulur (değişmeyen yollar); DEĞİŞEN gösterimler (Düzenle formu, kart penceresi, Kartı Kapat onayı) ve Düzenle kaydı ekrandan. BEKLENENLER ELLE (ders 5; kararların sözünden):
//   A) BULGU-2: kartı AÇIK taksitli fatura → Düzenle → kalan ödeme 'Taksitli' seçili açılır (tabanda Açık Hesap) → Tab ile alanlarda gezinilir → Değişiklikleri Kaydet → kart kimliği, kart no,
//      taksitler AYNEN (veri tabanı; tabanda kart silinirdi); bakiye 900.
//   B) S234 = A + S238 = A: fatura 900 → Mevcut Borç kartı 900 (10.10 / 10.11 / 10.12) → tahsilat 300 → Kartı Kapat → iade 300 → kart penceresi Kalan ₺300,00 → iade İptal Et → kart penceresi
//      Kalan ₺600,00 ve 10.11 taksiti geri gelmiş (iade öncesiyle aynı satırlar; tabanda 10.12 600) → Yeniden Aç → Kartı Kapat sorusu 'Kalan ₺600,00'.
//   C) BULGU-1: iki Mevcut Borç kartı aynı caride, ilk faturaya iade 300 → ikinci kartın taksitleri 'Ödendi' DEĞİL (tabanda Ödendi), Kalan ₺300,00; carinin gecikmişi 0 (API).
//   D) S234-c: fatura 900 → Mevcut Borç kartı 900 → fatura kartı → Düzenle → Miktar 3 → 1 (klavye) → Kaydet → kart penceresi Kalan ₺300,00 (tabanda ₺900,00); kart tutarı 300 (veri tabanı).
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

const OUT = process.env.EKRAN_DIR || path.join(HERE, "artifacts", "senaryo-izt-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const NOW = { time: "2026-10-08T12:00:00+03:00", fixed: true };
const root = mkdtempSync(path.join(tmpdir(), "destekofis-izt-"));
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
async function modifySave(id, { qty = "" } = {}) {
  await openInvoiceCard(id);
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

  await step("A) BULGU-2 — kartı açık taksitli fatura: Düzenle 'Taksitli' açılır; değiştirmeden Kaydet kartı ve taksitleri aynen bırakır", async () => {
    const A = await acc("Ekran İzt Taksitli Müşteri");
    const f = await goods(A, "2026-10-08", 3, { rest: "installments", installments: { count: 3, firstDue: "2026-11-08" } });
    const p = planOf(f);
    const before = { head: planRow(p), rows: itemRows(p) };
    const { opened, ask } = await modifySave(f);
    ok(opened === "installments", `Düzenle formu kalan ödemeyi 'Taksitli' açtı (tabanda 'open'): '${opened}'`);
    ok(/Değişiklikler Kaydedilsin mi\?/.test(ask), "onay sorusu geldi");
    await shot("bulgu2-duzenle-sonrasi");
    ok(planOf(f) === p, "faturanın kartı AYNI (veri tabanı; tabanda silinip yeniden kurulurdu)");
    ok(JSON.stringify({ head: planRow(p), rows: itemRows(p) }) === JSON.stringify(before), `kart (kimlik, kart no ${before.head.refNo}, durum) ve taksit satırları aynen (veri tabanı)`);
    ok((await totals(A)).balance === 900, "bakiye 900");
  });

  await step("B) S234 = A + S238 = A — kapalı kart + iade → Kalan ₺300,00; iade İptal Et → Kalan ₺600,00 ve 10.11 taksiti geri; Kartı Kapat sorusu ₺600,00", async () => {
    const B = await acc("Ekran İzt İade İptali Müşterisi");
    const g = await goods(B, "2026-10-07", 3, { rest: "account" });
    const p = await cover(B, 900, "2026-10-10", "2026-10-07", "Ekran İzt Kartı");
    await pay(p, 300);
    await closeByApi(p);
    const before = itemRows(p);
    const r = await giveBack(g, B, 1);
    await openPlanCard(p, "closed");
    ok(/₺300,00/.test(await kpi()), `iade sonrası kart penceresi Kalan ₺300,00: ${await kpi()}`);
    await shot("s238-iade-sonrasi-kalan-300");
    tick();
    await must("iade İptal Et", api.post(`${W}/invoices/${r}/cancel`, { reason: "ekran" }));
    await openPlanCard(p, "closed");
    ok(/₺600,00/.test(await kpi()), `iade iptali sonrası Kalan ₺600,00: ${await kpi()}`);
    const rows = await page.$$eval(".hof-plans .hof-plan-items tbody tr[data-item]", trs => trs.map(tr => tr.textContent.replace(/\s+/g, " ").trim()));
    ok(rows.length === 3 && rows.some(row => row.includes("10.11.2026")), `üç taksit satırı, 10.11.2026 geri geldi: ${rows.join(" | ")}`);
    ok(JSON.stringify(itemRows(p)) === JSON.stringify(before), "taksitler iade öncesiyle aynı (veri tabanı — kimlik, vade, tutar)");
    await shot("s238-iade-iptali-sonrasi");
    await page.click('.hof-plans [data-act="reopen"]');
    await page.waitForSelector('.hof-plans [data-act="close"]', { timeout: 15000 });
    await human();
    await page.click('.hof-plans [data-act="close"]');
    await page.waitForSelector(`${topSel} [data-answer="yes"]`, { timeout: 10000 });
    const ask = await text(topSel);
    ok(/Kalan ₺600,00/.test(ask), `Kartı Kapat sorusu 'Kalan ₺600,00': ${ask.slice(0, 200)}`);
    await shot("s238-karti-kapat-sorusu");
    console.log('    [soru] "Kartı Kapat" → Kartı Kapat (beklenen soru)');
    await page.click(`${topSel} [data-answer="yes"]`);
    await page.waitForTimeout(1200);
    ok(planRow(p).status === "closed", "kart kapandı (veri tabanı)");
    ok((await totals(B)).balance === 600, "carinin borcu 600 (Borçta Kalsın)");
  });

  await step("C) BULGU-1 — iki kartlı caride ilk faturaya iade: ikinci kartın taksitleri açık, gecikmiş 0", async () => {
    const C = await acc("Ekran İzt İki Kart Müşterisi");
    const g = await goods(C, "2026-10-05", 3, { rest: "account" });
    await cover(C, 900, "2026-10-10", "2026-10-05", "Ekran İzt Birinci Kart");
    await goods(C, "2026-10-06", 1, { rest: "account" });
    const r = await cover(C, 300, "2026-10-20", "2026-10-06", "Ekran İzt İkinci Kart");
    await giveBack(g, C, 1);
    await openPlanCard(r, "active");
    ok(/₺300,00/.test(await kpi()), `ikinci kart Kalan ₺300,00: ${await kpi()}`);
    const states = await page.$$eval(".hof-plans .hof-plan-items tbody tr[data-item]", trs => trs.map(tr => tr.className));
    ok(states.length === 3 && states.every(cls => !/is-paid/.test(cls)), `ikinci kartın taksitleri 'Ödendi' değil (tabanda ödendi): ${states.join(",")}`);
    await shot("bulgu1-ikinci-kart");
    const t = await totals(C);
    ok(t.balance === 900 && t.overdueDebt === 0, `bakiye 900, gecikmiş 0 (tabanda 300): ${t.balance} / ${t.overdueDebt}`);
  });

  await step("D) S234-c — Düzenle ile 900 → 300: Mevcut Borç kartı 300'e küçülür", async () => {
    const D = await acc("Ekran İzt Düzenle Müşterisi");
    const f = await goods(D, "2026-10-07", 3, { rest: "account" });
    const p = await cover(D, 900, "2026-10-10", "2026-10-07", "Ekran İzt Düzenle Kartı");
    await modifySave(f, { qty: "1" });
    ok((await totals(D)).balance === 300, "bakiye 300 (Düzenle kaydedildi)");
    ok(planRow(p).total === 300, `kart tutarı 300 (veri tabanı; tabanda 900): ${planRow(p).total}`);
    await openPlanCard(p, "active");
    ok(/₺300,00/.test(await kpi()), `kart penceresi Kalan ₺300,00 (tabanda ₺900,00): ${await kpi()}`);
    await shot("s234c-duzenle-sonrasi-kart");
  });

  const integrity = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
  ok(integrity.ok === true, `Mutabakat Testi temiz${integrity.ok ? "" : `: ${JSON.stringify(integrity.failures || integrity.checks?.filter(c => !c.ok)).slice(0, 300)}`}`);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  await shot("hata");
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-izt-250: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
