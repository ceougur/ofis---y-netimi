// 2.5.0 Ç7b tur 3 EKRANDAN — kabul G (docs/devir/2.5.0-DEVAM/c7b3-istem.txt, c7b3-devam-istem.txt; docs/erp/C7B-FATURA-TASARIM.md §16, §16.8). Gerçek tıklama + klavye (Tab, Enter) + insan
// hızı (ders 12); sahte saat (sunucu ve sayfa, 08.10.2026 — ders 13); lisans servisi yok (ders 30); pencere seçicisi en üstteki görünür pencere (ders 39); "veri bozulmaz" veri tabanı / API
// okunarak söylenir. Kayıtlar API'den kurulur (değişmeyen yollar); DEĞİŞEN yollar (fatura İptal Et, iade İptal Et, Taksitler kart penceresi, Yeniden Aç) ekrandan. BEKLENENLER ELLE (ders 5):
//   A) S15 = A: taksitli fatura 900 (3 × 300; 08.10 / 08.11 / 08.12), kendi kartına 08.10 tahsilat 300. Fatura kartında Sil kapalı, nedeni "… silinmez. İptal Et ile iptal edin (tahsilat
//      carinin avansı olur) …" görünür (pasif düğmenin nedeni İptal Et yolunu söyler);
//      İptal Et açık; pencere "Taksit kartına alınan 300,00 TL tahsilat … carinin avansı olur … kart kapanır" der; İptal Nedeni klavyeyle → Tab → İptal Et → Enter → belge iptal; kart kapalı,
//      tutar 0, faturadan ayrılmış; carinin bakiyesi −300 (avans); Kasa değişmez.
//   B) Karar (4) + S216 = C: taksitli fatura 900 (aynı takvim), 08.10 tahsilat 300, iade 1 × 300 → Taksitler kart penceresinde 08.12 300 var, 08.11 YOK; iade belgesi ekrandan İptal Et → kart
//      08.12 600 (son taksite; takvim ilk hâline dönmez — BİLİNEN SINIR); bakiye 600.
//   C) S210 = A: elle Borç 400 (08.10) + fatura 500 → Mevcut Borç kartı 900 (10.10 / 10.11 / 10.12) → kart tahsilatı 300 → fatura ekrandan İptal Et; pencere "“…” taksit kartı iptalde kapanır;
//      karta alınan 300,00 TL tahsilat carinin avansı olur; karttaki öbür borç kendi vadesiyle carinin borcunda kalır" der → kart Kapalı (Taksitler → Kapalı sekmesinde), tutar 300; bakiye 100;
//      ertesi gün (09.10) gecikmiş 100 (elle borç kendi vadesiyle; kart açık kalsaydı borç 10.10 taksitinde — gecikmiş 0).
//   D) S217 = A: taksitli fatura 900, 08.10 tahsilat 300, kart Kartı Kapat'la kapatılmış → fatura İptal Et ekrandan REDDEDİLİR, pencerede "Önce kartı Yeniden Aç ile açın." görünür, belge
//      kesilmiş kalır, bakiye değişmez; Taksitler → Kapalı → kart → Yeniden Aç → fatura İptal Et → kabul (S15): bakiye −300.
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

const OUT = process.env.EKRAN_DIR || path.join(HERE, "artifacts", "senaryo-c7b-tur3-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const NOW = { time: "2026-10-08T12:00:00+03:00", fixed: true };
const root = mkdtempSync(path.join(tmpdir(), "destekofis-c7b-tur3-"));
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
const acc = async name => (await must("cari", api.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id;
const totals = async id => (await must("cari", api.get(`${W}/accounts/${id}`))).totals;
const planOf = id => app.store.get("SELECT plan_id AS p FROM invoices WHERE id = ?", id).p;
const invStatus = id => app.store.get("SELECT status FROM invoices WHERE id = ?", id).status;
const planRow = id => ({ ...app.store.get("SELECT status, total, invoice_id AS invoiceId FROM plans WHERE id = ?", id) });
const installments = { rest: "installments", installments: { count: 3, firstDue: "2026-10-08" } };
const service = async (accountId, gross, payment) => (await must("satış", api.post(`${W}/invoices`, { scenario: "service_sale", accountId, issueDate: "2026-10-08", lines: [{ name: "Hizmet", qty: 1, unitPrice: gross / 1.2, vatRate: 20 }], payment }))).id;
const pay = (planId, amount) => must("taksit tahsilatı", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date: "2026-10-08", method: "cash" }));
async function closeAll() {
  for (let i = 0; i < 8 && (await page.$(MODAL)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    // Ders 34: dolu formu kapatırken programın ortak sorusu ("Kaydedilmemiş Değişiklik") BEKLENEN sorudur (yalnız reddedilen iptal penceresinde — İptal Nedeni dolu);
    // yanıtı nedeniyle yazılır.
    const top = await text(topSel);
    if (/Kaydedilmemiş Değişiklik/.test(top) && (await page.$(`${topSel} [data-answer="yes"]`))) {
      console.log("    [soru] Kaydedilmemiş Değişiklik → Kaydetmeden Kapat (beklenen: reddedilen iptal penceresinde İptal Nedeni dolu)");
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
// İptal Et penceresi: İptal Nedeni klavyeyle, Tab ile İptal Et düğmesine, Enter. Dönüş: penceredeki metin (gönderimden önce) ve gönderimden sonra en üstteki pencerenin metni.
async function cancelFromScreen(id, reason, { expectReject = false } = {}) {
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
  let after = "";
  for (let i = 0; i < 25; i += 1) {
    await page.waitForTimeout(400);
    if (invStatus(id) === "cancelled") break;
    after = await text(topSel);
    if (expectReject && /Yeniden Aç/.test(after)) break;
    const yes = await page.$(`${topSel} [data-answer="yes"]`);
    if (yes) {
      // Ders 34: beklenmeyen soru adıyla yazılır (bu yolda soru BEKLENMEZ); yanıtlanmaz, adım kırmızı kalır.
      ok(false, `beklenmeyen soru: ${(await text(topSel)).slice(0, 160)}`);
      break;
    }
  }
  return { intro, after };
}
async function openPlansTab(status) {
  await closeAll();
  await page.click('#hof-sidecard [data-action="plans"]');
  await page.waitForSelector(`.hof-plans [data-status="${status}"]`, { timeout: 15000 });
  await human();
  await page.click(`.hof-plans [data-status="${status}"]`);
  await human();
}
async function openPlanCard(planId, status = "all") {
  await openPlansTab(status);
  await page.waitForSelector(`.hof-plans-table tbody tr[data-plan="${planId}"]`, { timeout: 15000 });
  await human();
  await page.click(`.hof-plans-table tbody tr[data-plan="${planId}"]`);
  await page.waitForSelector('.hof-plans [data-act="close"], .hof-plans [data-act="reopen"]', { timeout: 15000 });
  await human();
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

  await step("A) S15 = A — tahsilatlı taksitli faturanın İptal Et'i ekrandan; Sil kapalı ve nedeni görünür", async () => {
    const A = await acc("Ekran S15 Müşterisi");
    const f = await service(A, 900, installments);
    const p = planOf(f);
    await pay(p, 300);
    const cash0 = (await must("kasa", api.get(`${W}/cash?method=cash`))).totals.balance;
    await openInvoiceCard(f);
    const blocks = await text(`${inv} .hof-inv-blocks`);
    ok(/Sil kapalı: Faturanın taksit kartında tahsilat var; silinmez\. İptal Et ile iptal edin \(tahsilat carinin avansı olur\)/.test(blocks), `Sil kapalı, nedeni ve İptal Et yolu görünür: ${blocks.slice(0, 400)}`);
    ok(!/İptal Et kapalı/.test(blocks), "İptal Et kapalı değil");
    await shot("s15-fatura-karti");
    const { intro } = await cancelFromScreen(f, "Müşteri vazgeçti");
    ok(/Taksit kartına alınan 300,00 TL tahsilat iptalden sonra carinin avansı olur \(sonraki borcu kapatır\); kart kapanır\./.test(intro), `pencere kartın ne olacağını söyler: ${intro.slice(0, 300)}`);
    ok(invStatus(f) === "cancelled", "fatura iptal edildi (veri tabanı)");
    const row = planRow(p);
    ok(row.status === "closed" && Number(row.total) === 0 && row.invoiceId === "", `kart kapalı, tutar 0, faturadan ayrıldı (veri tabanı: ${JSON.stringify(row)})`);
    ok((await totals(A)).balance === -300, "carinin bakiyesi −300 (avans)");
    ok((await must("kasa", api.get(`${W}/cash?method=cash`))).totals.balance === cash0, "Kasa değişmedi");
    await shot("s15-iptal-sonrasi");
  });

  await step("B) Karar (4) + S216 = C — iade kartı en önce gelen açık taksitten küçültür; iade ekrandan İptal Et → kart son taksitte büyür", async () => {
    const B = await acc("Ekran İade Müşterisi");
    const f = (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId: B, issueDate: "2026-10-08", lines: [{ name: "Mal", qty: 3, unitPrice: 250, vatRate: 20 }], payment: installments }))).id;
    const p = planOf(f);
    await pay(p, 300);
    const line = (await must("fatura", api.get(`${W}/invoices/${f}`))).lines[0].id;
    const iade = await must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId: B, originalId: f, issueDate: "2026-10-08", lines: [{ originLineId: line, qty: 1 }], payment: { cash: [] }, force: true }));
    await openPlanCard(p);
    const card = await text(".hof-plans");
    ok(/08\.12\.2026/.test(card), "08.12 taksiti duruyor");
    ok(!/08\.11\.2026/.test(card), "08.11 taksiti kesildi (en önce gelen açık)");
    await shot("iade-kart-takvimi");
    await openInvoiceCard(iade.id, "returns");
    await cancelFromScreen(iade.id, "İade yanlış girildi");
    ok(invStatus(iade.id) === "cancelled", "iade iptal edildi (veri tabanı)");
    const items = (await must("kart", api.get(`${W}/plans/${p}`))).items.map(i => `${i.dueDate}:${i.amount}`);
    ok(JSON.stringify(items) === JSON.stringify(["2026-10-08:300", "2026-12-08:600"]), `S216 = C: 300 son taksite (kart: ${items.join(" · ")})`);
    ok((await totals(B)).balance === 600, "bakiye 600");
    await openPlanCard(p);
    ok(/600,00/.test(await text(".hof-plans")), "kart penceresi 08.12 600 gösterir");
    await shot("iade-iptali-kart");
  });

  await step("C) S210 = A — çok kalemli Mevcut Borç kartının içindeki faturanın İptal Et'i ekrandan; kart kapanır, elle borç kendi vadesiyle", async () => {
    const C = await acc("Ekran Çok Kalemli Kart Müşterisi");
    await must("Borç Yaz", api.post(`${W}/accounts/${C}/entries`, { kind: "debt", amount: "400", date: "2026-10-08", note: "Elle borç" }));
    const f = await service(C, 500, { rest: "open" });
    const p = (await must("kart", api.post(`${W}/plans`, { accountId: C, name: "Ekran Çok Kalemli Kart", total: "900", registeredOn: "2026-10-08", mode: "auto", count: 3, firstDue: "2026-10-10", coversBalance: true }))).id;
    await pay(p, 300);
    await openInvoiceCard(f);
    const { intro } = await cancelFromScreen(f, "Yanlış kesildi");
    ok(/“Ekran Çok Kalemli Kart” taksit kartı iptalde kapanır; karta alınan 300,00 TL tahsilat carinin avansı olur; karttaki öbür borç kendi vadesiyle carinin borcunda kalır\./.test(intro), `pencere kartın kapanacağını söyler: ${intro.slice(0, 360)}`);
    ok(invStatus(f) === "cancelled", "fatura iptal edildi (veri tabanı)");
    const row = planRow(p);
    ok(row.status === "closed" && Number(row.total) === 300, `kart kapalı, tutar 300 (veri tabanı: ${JSON.stringify(row)})`);
    await openPlanCard(p, "closed");
    ok(Boolean(await page.$('.hof-plans [data-act="reopen"]')), "kart Taksitler → Kapalı sekmesinde, Yeniden Aç görünür");
    await shot("s210-kart-kapali");
    ok((await totals(C)).balance === 100, "bakiye 100 (400 + 500 − 300 − 500)");
    // Sunucu saati bir gün ileri (yalnız API okuması; sayfa saati değişmez), sonra geri.
    app.config.now.set(Date.parse("2026-10-09T12:00:00+03:00"));
    try {
      ok((await totals(C)).overdueDebt === 100, "09.10: gecikmiş 100 (elle borç kendi vadesiyle — 08.10)");
    } finally {
      app.config.now.set(Date.parse(NOW.time));
    }
  });

  await step("D) S217 = A — Kartı Kapat'la kapatılmış tahsilatlı kartın faturası: İptal Et reddedilir; Yeniden Aç → İptal Et kabul", async () => {
    const D = await acc("Ekran Kapalı Kart Müşterisi");
    const f = await service(D, 900, installments);
    const p = planOf(f);
    await pay(p, 300);
    await must("Kartı Kapat", api.put(`${W}/plans/${p}`, { status: "closed", closeRemaining: 600 }));
    const b0 = (await totals(D)).balance;
    await openInvoiceCard(f);
    const { after } = await cancelFromScreen(f, "Deneme", { expectReject: true });
    ok(/fatura iptal edilemez\. Önce kartı Yeniden Aç ile açın\./.test(after), `pencere reddin nedenini yazar: ${after.slice(0, 260)}`);
    ok(invStatus(f) === "issued", "belge kesilmiş kaldı (veri tabanı)");
    ok((await totals(D)).balance === b0, "bakiye değişmedi");
    await shot("s217-red");
    await openPlanCard(p, "closed");
    await page.click('.hof-plans [data-act="reopen"]');
    await page.waitForSelector('.hof-plans [data-act="close"]', { timeout: 15000 });
    await human();
    ok(planRow(p).status === "active", "Yeniden Aç: kart açık (veri tabanı)");
    await openInvoiceCard(f);
    await cancelFromScreen(f, "Kart açıldıktan sonra");
    ok(invStatus(f) === "cancelled", "Yeniden Aç'tan sonra İptal Et kabul (veri tabanı)");
    ok((await totals(D)).balance === -300, "bakiye −300 (tahsilat avans; kalan bir kez düşüldü)");
    await shot("s217-yeniden-ac-iptal");
  });

  const integrity = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
  ok(integrity.ok === true, `Mutabakat Testi temiz${integrity.ok ? "" : `: ${JSON.stringify(integrity.failures || integrity.checks?.filter(c => !c.ok)).slice(0, 300)}`}`);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  await shot("hata");
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-c7b-tur3-250: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
