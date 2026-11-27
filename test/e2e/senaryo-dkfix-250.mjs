// 2.5.0 Ç7b DK + S229 ALTIN birleşik küçük tur EKRANDAN — kabul F (görev metni docs/devir/2.5.0-DEVAM/dkfix-istem.txt; tasarım docs/erp/C7B-FATURA-TASARIM.md §18). Gerçek tıklama + klavye +
// insan hızı (ders 12); sahte saat (sunucu ve sayfa, 08.10.2026 — ders 13); lisans servisi yok (ders 30); pencere seçicisi en üstteki görünür pencere (ders 39); "veri bozulmaz" veri tabanı / API
// okunarak söylenir. Kayıtlar API'den kurulur (değişmeyen yollar); DEĞİŞEN gösterimler (kart penceresi, Kartı Kapat onayı, Düzenle onayı) ekrandan. BEKLENENLER ELLE (ders 5):
//   A) S234 = A: fatura 900 → Mevcut Borç kartı 900 (10.10 / 10.11 / 10.12) → kart tahsilatı 300 → Kartı Kapat → iade 1 × 300 (borçtan) → Taksitler → Kapalı → kart penceresi Kalan ₺300,00
//      (tabanda ₺600,00); Yeniden Aç → Kartı Kapat sorusu "Kalan ₺300,00" (tabanda ₺600,00) → onayla kapanır (TEK istek, 200); carinin borcu 300.
//   B) S235 = B: taksitli fatura 900 (3 × 300; 06.10), tahsilatsız, Kartı Kapat → fatura kartı → Düzenle → Değişiklikleri Kaydet → onayda "Bu faturanın kapatılmış taksit kartı yeniden
//      açılır; kalan borç yeni ödeme planına girer." → kaydedilince eski kart kalkar, yeni kart AÇIK (davranış aynen); bakiye 900.
//   C) S235 = B: aynı, Düzenle'de Açık Hesap (Vadeli) seçilir → onayda "Bu faturanın kapatılmış taksit kartı kaldırılır; kalan borç faturanın vadesiyle açık hesapta izlenir." → Vazgeç
//      (kayıt yok — kart kapalı kalır).
//   D) Denetim: kartı AÇIK taksitli faturada Düzenle onayında bu cümleler YOK.
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

const OUT = process.env.EKRAN_DIR || path.join(HERE, "artifacts", "senaryo-dkfix-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const NOW = { time: "2026-10-08T12:00:00+03:00", fixed: true };
const root = mkdtempSync(path.join(tmpdir(), "destekofis-dkfix-"));
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
// Kayıt anları sırayla ilerler (Mevcut Borç kartı yalnız açıldığı ANA kadar doğmuş borcu kapsar).
const tick = () => app.config.now.set(`2026-10-08T12:${String((minute += 1)).padStart(2, "0")}:00+03:00`);
const acc = async name => (await must("cari", api.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id;
const totals = async id => (await must("cari", api.get(`${W}/accounts/${id}`))).totals;
const planOf = id => app.store.get("SELECT plan_id AS p FROM invoices WHERE id = ?", id).p;
const planRow = id => ({ ...app.store.get("SELECT status, total, deleted_at AS deletedAt FROM plans WHERE id = ?", id) });
const goods = async (accountId, date, qty, payment) => (tick(), (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment }))).id);
const pay = (planId, amount) => (tick(), must("taksit tahsilatı", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date: "2026-10-08", method: "cash" })));
const closeByApi = async id => {
  tick();
  const v = await must("kart", api.get(`${W}/plans/${id}`));
  await must("Kartı Kapat", api.put(`${W}/plans/${id}`, { status: "closed", closeRemaining: v.totals.remaining }));
};
async function closeAll() {
  for (let i = 0; i < 8 && (await page.$(MODAL)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const top = await text(topSel);
    // Ders 34: dolu formu kapatırken programın ortak sorusu ("Kaydedilmemiş Değişiklik") BEKLENEN sorudur (C ve D adımlarında Düzenle formu açık bırakılır); yanıtı nedeniyle yazılır.
    if (/Kaydedilmemiş Değişiklik/.test(top) && (await page.$(`${topSel} [data-answer="yes"]`))) {
      console.log("    [soru] Kaydedilmemiş Değişiklik → Kaydetmeden Kapat (beklenen: Vazgeç'ten sonra Düzenle formu açık)");
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
// Düzenle → kalan ödeme (rest: "installments" Taksitlendir / "open" Açık Hesap (Vadeli) — tıklanır) → Değişiklikleri Kaydet → onay metni. answer: "yes" (kaydet) / "no" (Vazgeç).
// GÖZLEM (önceden var — v2.4.9'dan): kaydedilmiş taksitli faturanın Düzenle formu kalan ödemeyi 'Açık Hesap (Vadeli)' seçili açar (istemcinin payFrom'u payment.rest === "installments"
// arar; kaydedilmiş belgede rest tutardır, mode "installments"). Açılıştaki seçim `opened` olarak döner.
async function modifyAsk(id, { rest = "", answer = "yes" } = {}) {
  await openInvoiceCard(id);
  await page.click(`${inv} [data-act="modify"]`);
  await page.waitForSelector(`${inv} [data-act="issue"]`, { timeout: 15000 });
  await human();
  const opened = await page.evaluate(sel => document.querySelector(`${sel} input[name="hof-inv-rest"]:checked`)?.dataset.rest || "", inv);
  if (rest) {
    await page.click(`${inv} input[data-rest="${rest}"]`);
    await human();
  }
  await page.click(`${inv} [data-act="issue"]`);
  await page.waitForSelector(`${topSel} [data-answer="yes"]`, { timeout: 15000 });
  await human();
  const ask = await text(topSel);
  console.log(`    [soru] "Değişiklikler Kaydedilsin mi?" → ${answer === "yes" ? "Değişiklikleri Kaydet" : "Vazgeç"} (beklenen soru)`);
  return {
    ask,
    opened,
    answer: async () => {
      if (answer === "yes") await page.click(`${topSel} [data-answer="yes"]`);
      else await page.keyboard.press("Escape");
      await page.waitForTimeout(1200);
    },
  };
}
const REOPEN = "Bu faturanın kapatılmış taksit kartı yeniden açılır; kalan borç yeni ödeme planına girer.";
const DROP = "Bu faturanın kapatılmış taksit kartı kaldırılır; kalan borç faturanın vadesiyle açık hesapta izlenir.";

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

  await step("A) S234 = A — kapalı Mevcut Borç kartı + iade: kart penceresi Kalan ₺300,00; Yeniden Aç → Kartı Kapat 'Kalan ₺300,00' tek soru", async () => {
    const A = await acc("Ekran S234 Müşterisi");
    const g = await goods(A, "2026-10-07", 3, { rest: "account" });
    tick();
    const made = await must("Mevcut Borç kartı", api.post(`${W}/plans`, { accountId: A, name: "Ekran S234 Kartı", total: "900", registeredOn: "2026-10-07", mode: "auto", count: 3, firstDue: "2026-10-10", coversBalance: true }));
    const p = made.id || made.plan?.id;
    await pay(p, 300);
    await closeByApi(p);
    tick();
    const line = (await must("fatura", api.get(`${W}/invoices/${g}`))).lines[0].id;
    await must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId: A, originalId: g, issueDate: "2026-10-08", lines: [{ originLineId: line, qty: 1 }], payment: { cash: [] }, force: true }));
    ok((await totals(A)).balance === 300, "carinin borcu 300 (API)");
    await openPlanCard(p, "closed");
    const kpi = await text(".hof-plans .hof-plans-kpis .hof-cash-balance strong");
    ok(/₺300,00/.test(kpi), `kart penceresi Kalan ₺300,00 (tabanda ₺600,00): ${kpi}`);
    await shot("s234-kapali-kart-kalan-300");
    await page.click('.hof-plans [data-act="reopen"]');
    await page.waitForSelector('.hof-plans [data-act="close"]', { timeout: 15000 });
    await human();
    ok(planRow(p).status === "active", "Yeniden Aç: kart açık (veri tabanı)");
    const puts = [];
    const onResponse = res => {
      if (res.request().method() === "PUT" && res.url().includes(`${W}/plans/${encodeURIComponent(p)}`)) puts.push(res.status());
    };
    page.on("response", onResponse);
    try {
      await page.click('.hof-plans [data-act="close"]');
      await page.waitForSelector(`${topSel} [data-answer="yes"]`, { timeout: 10000 });
      const ask = await text(topSel);
      ok(/Kalan ₺300,00/.test(ask), `Kartı Kapat sorusu 'Kalan ₺300,00' (tabanda ₺600,00): ${ask.slice(0, 200)}`);
      await shot("s234-karti-kapat-sorusu-300");
      console.log("    [soru] \"Kartı Kapat\" → Kartı Kapat (beklenen tek soru)");
      await page.click(`${topSel} [data-answer="yes"]`);
      let second = "";
      for (let i = 0; i < 40; i += 1) {
        await page.waitForTimeout(250);
        if (await page.$('.hof-plans [data-act="reopen"]')) break;
        if (await page.$(`${topSel} [data-answer="yes"]`)) {
          second = await text(topSel);
          break;
        }
      }
      ok(!second, `ikinci soru YOK${second ? `: ${second.slice(0, 200)}` : ""}`);
      ok(planRow(p).status === "closed", "kart kapandı (veri tabanı)");
      ok(puts.length === 1 && puts[0] === 200, `TEK istek, 200 (gelen: ${JSON.stringify(puts)})`);
      ok((await totals(A)).balance === 300, "Borçta Kalsın: carinin borcu 300");
      await shot("s234-yeniden-kapandi");
    } finally {
      page.off("response", onResponse);
    }
  });

  await step("B) S235 = B — kapalı kartlı taksitli faturada Düzenle onayı kartın yeniden açılacağını söyler; kayıttan sonra yeni kart AÇIK", async () => {
    const B = await acc("Ekran S235 Müşterisi");
    const f = await goods(B, "2026-10-08", 3, { rest: "installments", installments: { count: 3, firstDue: "2026-10-08" } });
    const p = planOf(f);
    await closeByApi(p);
    ok(planRow(p).status === "closed", "kart kapalı (veri tabanı)");
    // Düzenle formu kalan ödemeyi Açık Hesap seçili açar (GÖZLEM, önceden var) → Taksitlendir tıklanır (yeni ödeme planı).
    const { ask, answer, opened } = await modifyAsk(f, { rest: "installments" });
    console.log(`    GÖZLEM (önceden var): Düzenle formu açılışta kalan ödeme '${opened}' seçili`);
    ok(ask.includes(REOPEN), `onayda: "${REOPEN}" — ${ask.slice(0, 420)}`);
    ok(!ask.includes(DROP), "kaldırılır cümlesi YOK");
    await shot("s235-duzenle-onayi-yeniden-acilir");
    await answer();
    const now = planOf(f);
    ok(Boolean(now) && now !== p, "faturanın yeni kartı var (eski kart yerine)");
    ok(planRow(p).deletedAt, "eski kapalı kart kaldırıldı (veri tabanı — bugünkü davranış)");
    ok(planRow(now).status === "active", "yeni kart AÇIK (veri tabanı — bugünkü davranış)");
    ok((await totals(B)).balance === 900, "bakiye 900");
    await shot("s235-duzenle-sonrasi");
  });

  await step("C) S235 = B — Düzenle'de Açık Hesap seçilince onay kartın kaldırılacağını söyler; Vazgeç → kart kapalı kalır", async () => {
    const C = await acc("Ekran S235 Açık Hesap Müşterisi");
    const f = await goods(C, "2026-10-08", 3, { rest: "installments", installments: { count: 3, firstDue: "2026-10-08" } });
    const p = planOf(f);
    await closeByApi(p);
    const { ask, answer } = await modifyAsk(f, { rest: "open", answer: "no" });
    ok(ask.includes(DROP), `onayda: "${DROP}" — ${ask.slice(0, 420)}`);
    ok(!ask.includes(REOPEN), "yeniden açılır cümlesi YOK");
    await shot("s235-duzenle-onayi-kaldirilir");
    await answer();
    ok(planRow(p).status === "closed" && !planRow(p).deletedAt, "Vazgeç: kart kapalı kaldı (veri tabanı)");
  });

  await step("D) Denetim — kartı AÇIK taksitli faturada Düzenle onayında bu cümleler YOK", async () => {
    const D = await acc("Ekran Açık Kart Müşterisi");
    const f = await goods(D, "2026-10-08", 3, { rest: "installments", installments: { count: 3, firstDue: "2026-10-08" } });
    const { ask, answer } = await modifyAsk(f, { rest: "installments", answer: "no" });
    ok(/Değişiklikler Kaydedilsin mi\?/.test(ask) && !ask.includes(REOPEN) && !ask.includes(DROP), `açık kartta cümle yok: ${ask.slice(0, 300)}`);
    await shot("acik-kart-duzenle-onayi");
    await answer();
  });

  // GÖZLEM (önceden var — rapor BULGU; bu turun dosya sınırı dışı): kartı AÇIK taksitli faturada Düzenle → hiçbir şeyi değiştirmeden Değişiklikleri Kaydet → form Açık Hesap seçili açıldığı
  // için taksit kartı kalkar. Sayılar yazılır, adım geçti / kaldı sayılmaz.
  await step("E) GÖZLEM — kartı açık taksitli faturada Düzenle → değiştirmeden Kaydet", async () => {
    const E = await acc("Ekran Gözlem Müşterisi");
    const f = await goods(E, "2026-10-08", 3, { rest: "installments", installments: { count: 3, firstDue: "2026-10-08" } });
    const p = planOf(f);
    const { opened, answer } = await modifyAsk(f, { answer: "yes" });
    await answer();
    console.log(`    GÖZLEM: açılışta seçili '${opened}'; kayıttan sonra faturanın kartı '${planOf(f) || "(yok)"}', eski kart ${JSON.stringify(planRow(p))}, bakiye ${(await totals(E)).balance}`);
    await shot("gozlem-acik-kart-duzenle-sonrasi");
  });

  const integrity = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
  ok(integrity.ok === true, `Mutabakat Testi temiz${integrity.ok ? "" : `: ${JSON.stringify(integrity.failures || integrity.checks?.filter(c => !c.ok)).slice(0, 300)}`}`);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  await shot("hata");
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-dkfix-250: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
