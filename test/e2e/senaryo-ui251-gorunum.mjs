// 2.5.1 son aday UI düzeltme turu EKRANDAN (UI/UX ORTA-1/2/3 + mali müşavir D1; yalnız istemci görünümü — para / defter kuralı değişmez).
// Sahte saat 15.04.2026 (sunucu ve sayfa — ders 13); lisans servisi yok (ders 30); pencere seçicisi en üstteki görünür pencere (ders 39); veri programın API'sinden;
// ret ve silme yolları gerçek tıklamayla (ders 12); "kaydedilmedi" veri tabanından / kart yanıtından okunur (ders 3). Ölçümler getBoundingClientRect ile, sayıyla.
//   A (UI-1) Cari kartında (pencere) Ödeme × → Sil: Değersiz Alacak ret iletisi (~760 harf) GENİŞ (min(720, ekran − 36) px), en çok ~10 satır, ekranın içinde ve iletinin
//     söylediği düğmeleri (Şüpheli Alacak → kaydın Değersiz satırındaki ×, kaydın ×'ı) ÖRTMEZ — kart olduğu gibi, bölüm üste ve ortaya kaydırılmışken; 1440×900, 1366×768,
//     1280×720 ve telefon 390×844. Süreyle kapanmaz (60 sn sonra yerinde), yalnız × ile; iki ret daha (Borç ×) → en çok iki uzun bildirim, yığın ekrandan taşmaz.
//     Ret: ödeme / borç satırları yerinde, bakiye değişmedi.
//   B Kısa bildirimler eskisi gibi: pencere açıkken üst ortada 380 px, pencere yokken sağ altta; süreyle kapanır. Öbür raporların özet kartları alçak ekranda eskisi gibi tek satır.
//   C (UI-2) Raporlar → KDV Özeti: tutar kartlarının hepsi kart satırının içinde ve kendi metni kesilmeden (1366×768, 1280×720, 1440×900, 1920×1080); telefonda sayfa yana kaymaz.
//   D (UI-3) KDV Mahsup Fişi → Mahsup Edilen Aylar: tablo yana taşmaz, "Mahsuptan Sonra Değişti" rozetli satır varken en yeni mahsubun Geri Al düğmesi tablonun görünen alanında
//     (1366×768, 1440×900, 1920×1080).
//   E (D1) Değersiz Alacak Yaz formu: "659 Diğer Olağan Gider ve Zararlar" (hesap planındaki adla aynı), "Olağandışı" yok.
// Çıkış: "N geçti, M kaldı" (kalan > 0 → çıkış 1). Ekran görüntüleri EKRAN_DIR (yoksa geçici klasör).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const { CHART } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "general-ledger.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-04-15T10:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-ui251-gorunum-"));
const shots = process.env.EKRAN_DIR || root;
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f61" } });
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
const ACC = "/api/workspace/accounts";
const INV = "/api/workspace/invoices";
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
// KDV: Ocak satış KDV 1.000 + alış KDV 500 → Ocak mahsubu; Şubat, Mart satış + mahsup (Mart en yeni → Geri Al); sonra Ocak'a alış (İndirilecek +100) → Ocak
// "Mahsuptan Sonra Değişti" (UI/UX incelemesinin verisi gibi; KDV Özeti'nde 6 tutar kartı + notlar).
const T = (await must("tedarikçi", api.post(ACC, { name: "Toptancı Kırtasiye", type: "supplier", registeredOn: "2026-01-01" }))).id;
const M = (await must("müşteri", api.post(ACC, { name: "Ayşe Kaya", type: "customer", registeredOn: "2026-01-01" }))).id;
const sale = (date, net) => must(`satış ${date}`, api.post(INV, { scenario: "service_sale", accountId: M, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }));
const buy = (date, net, number) => must(`alış ${date}`, api.post(INV, { kind: "purchase", scenario: "expense_purchase", accountId: T, issueDate: date, number, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }));
await sale("2026-01-05", 5000);
await buy("2026-01-10", 2500, "TK-1");
await must("Ocak mahsubu", api.post("/api/workspace/tax/vat-offset", { month: "2026-01" }));
await sale("2026-02-10", 1000);
await must("Şubat mahsubu", api.post("/api/workspace/tax/vat-offset", { month: "2026-02" }));
await sale("2026-03-10", 2000);
await must("Mart mahsubu", api.post("/api/workspace/tax/vat-offset", { month: "2026-03" }));
await buy("2026-01-20", 500, "TK-2");
// Değersiz: D (KDV'siz fatura 5.000 + Ödeme 500 + Borç 1.000 + Borç 800 = 7.300; Şüpheliye Al 7.300 → Değersiz 7.300 → bakiye 0). Ödeme / Borç silinirse cari
// alacaklıya düşer → ret (uzun ileti, "Ne yapmalı:"). W: Şüpheli 1.000 açık (Değersiz Alacak Yaz formu).
const D = await must("cari D", api.post(ACC, { name: "Değersiz Deneme Ltd", type: "customer", registeredOn: "2026-04-01", phone: "0532 251 77 01" }));
await must("fatura D", api.post(INV, { scenario: "service_sale", accountId: D.id, issueDate: "2026-04-01", lines: [{ name: "Hizmet", qty: 1, unitPrice: "5000", vatRate: 0 }], payment: { rest: "open" } }));
const out = await must("ödeme D", api.post(`${ACC}/${D.id}/entries`, { kind: "out", amount: "500", date: "2026-04-02", method: "cash", cashForce: true, similarOk: true, note: "Müşteriye ödeme" }));
const debt1 = await must("borç D 1", api.post(`${ACC}/${D.id}/entries`, { kind: "debt", amount: "1000", date: "2026-04-03", note: "Ek borç" }));
const debt2 = await must("borç D 2", api.post(`${ACC}/${D.id}/entries`, { kind: "debt", amount: "800", date: "2026-04-04", note: "İkinci borç" }));
const sD = (await must("şüpheliye al D", api.post(`${ACC}/${D.id}/doubtful`, { amount: "7300", date: "2026-04-10", reason: "lawsuit" }))).record.id;
await must("Değersiz D", api.post(`${ACC}/${D.id}/doubtful/${sD}/write-off`, { amount: "7300", date: "2026-04-10" }));
const W = await must("cari W", api.post(ACC, { name: "Şüpheli Bekleyen Ltd", type: "customer", registeredOn: "2026-04-01" }));
await must("fatura W", api.post(INV, { scenario: "service_sale", accountId: W.id, issueDate: "2026-04-01", lines: [{ name: "Hizmet", qty: 1, unitPrice: "1000", vatRate: 0 }], payment: { rest: "open" } }));
await must("şüpheliye al W", api.post(`${ACC}/${W.id}/doubtful`, { amount: "1000", date: "2026-04-10", reason: "lawsuit" }));
const cardD = async () => must("kart D", api.get(`${ACC}/${D.id}`));
const entryIds = card => new Set((card.entries || card.ledger || []).map(item => item.id || item.entryId).filter(Boolean));
const before = await cardD();
console.log(`# kurulum: D bakiye ${JSON.stringify(before.totals?.balance ?? before.totals)}`);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "tr-TR" });
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
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const CARD = ".hof-accounts-modal";
const shot = name => page.screenshot({ path: path.join(shots, `${name}.png`) }).catch(() => null);
const clearToasts = () => page.evaluate(() => document.querySelectorAll(".hof-toast").forEach(node => node.remove()));
const closeModals = async () => {
  for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const discard = await page.$(`${TOP} [data-answer="discard"], ${TOP} [data-answer="no"]`);
    if (discard) await discard.click().catch(() => null);
  }
};
const openCard = async id => {
  await closeModals();
  await page.evaluate(accountId => window.HOF.accounts.open(accountId), id);
  await page.waitForSelector(`${CARD} .hof-plan-head`);
  await page.waitForSelector(`${CARD} [data-doubtful-record]`);
  await page.waitForTimeout(500);
};
/** Kartta bir hareketin × düğmesine tıklanır, "Hareketi Sil" sorusu onaylanır; yeni hata bildiriminin metni döner. */
const deleteEntry = async entryId => {
  // Ekrandaki bildirimler işaretlenir; yeni (işaretsiz) hata bildirimi beklenir (en çok iki uzun bildirim kuralı eskisini kapatabilir — sayı artmayabilir).
  await page.$$eval(".hof-toast", nodes => nodes.forEach(node => node.setAttribute("data-seen", "")));
  // Telefonda kendi içinde kayan uzun bildirim metni dokunmayı alır (kaydırılabilsin diye): kullanıcı gibi satır ekranın ortasına kaydırılıp basılır.
  await page.$eval(`${CARD} [data-delete-entry="${entryId}"]`, button => button.scrollIntoView({ block: "center" }));
  await page.click(`${CARD} [data-delete-entry="${entryId}"]`);
  await page.waitForSelector(`${TOP} [data-answer="yes"]`);
  await page.click(`${TOP} [data-answer="yes"]`);
  await page.waitForSelector(".hof-toast-error:not([data-seen])", { timeout: 10000 });
  await page.waitForTimeout(400);
  return page.$eval(".hof-toast-error:not([data-seen]) .hof-toast-text", node => node.textContent || "");
};
/** Son hata bildirimi ve iletinin söylediği düğmeler (Değersiz satırının ×'ı, kaydın ×'ı): kutular ve çakışma. */
const measure = () =>
  page.evaluate(() => {
    const rect = node => {
      const r = node.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
    };
    const toast = [...document.querySelectorAll(".hof-toast-error")].at(-1);
    const t = toast.getBoundingClientRect();
    const hits = sel =>
      [...document.querySelectorAll(sel)].map(node => {
        const r = node.getBoundingClientRect();
        const shown = r.width > 0 && r.bottom > 0 && r.top < innerHeight;
        return { ...rect(node), shown, under: shown && r.right > t.left && r.left < t.right && r.bottom > t.top && r.top < t.bottom };
      });
    const text = toast.querySelector(".hof-toast-text");
    const lineHeight = parseFloat(getComputedStyle(text).lineHeight) || 18;
    return {
      vw: innerWidth,
      vh: innerHeight,
      toast: rect(toast),
      lines: Math.round(text.clientHeight / lineHeight),
      textCut: text.scrollHeight > text.clientHeight + 1,
      woDel: hits(".hof-accounts-modal [data-dbt-wo-del]"),
      recDel: hits('.hof-accounts-modal [data-dbt-act="delete"]'),
    };
  });
const covered = m => [...m.woDel, ...m.recDel].filter(item => item.under);
const scrollDoubtful = block => page.evaluate(where => document.querySelector(".hof-accounts-modal [data-dbt-wo-del]")?.scrollIntoView({ block: where }), block);

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });

  console.log("A) UI-1 — cari kartında Ödeme × → Sil: Değersiz Alacak ret iletisi geniş, düğmeleri örtmüyor, yalnız × ile kapanıyor");
  for (const [vw, vh] of [[1440, 900], [1366, 768], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width: vw, height: vh });
    await clearToasts();
    await openCard(D.id);
    const text = await deleteEntry(out.entryId);
    const expectWidth = Math.min(720, vw - 36);
    const asIs = await measure();
    await shot(`ui251-a-ret-${vw}x${vh}`);
    await scrollDoubtful("start");
    const atTop = await measure();
    await scrollDoubtful("center");
    const atCenter = await measure();
    const tag = `${vw}×${vh}`;
    console.log(`    [ölçü ${tag}] bildirim ${JSON.stringify(asIs.toast)} satır ${asIs.lines}; Değersiz × ${JSON.stringify(atTop.woDel.map(item => [item.x, item.y]))} (bölüm üstte), ${JSON.stringify(atCenter.woDel.map(item => [item.x, item.y]))} (ortada)`);
    ok(/^Ödeme hareketi silinemez: .*Ne yapmalı:/.test(text) && text.length > 300, `${tag}: ret iletisi uzun ve 'Ne yapmalı:' yolu veriyor (${text.length} harf)`);
    ok(Math.abs(asIs.toast.w - expectWidth) <= 2, `${tag}: bildirim geniş (${asIs.toast.w} px; beklenen ${expectWidth})`);
    ok(asIs.toast.y >= 0 && asIs.toast.bottom <= vh, `${tag}: bildirim ekranın içinde (y ${asIs.toast.y}–${asIs.toast.bottom}, ekran ${vh})`);
    if (vw >= 1280) ok(asIs.lines <= 10 && !asIs.textCut, `${tag}: ileti en çok 10 satır, kesiksiz (${asIs.lines} satır)`);
    else ok(asIs.toast.h <= vh / 2 + 10, `${tag}: telefonda bildirim ekranın yarısını geçmiyor (${asIs.toast.h} px; metin ${asIs.textCut ? "kendi içinde kayar" : "tam"})`);
    for (const [label, m] of [["olduğu gibi", asIs], ["Şüpheli bölümü üstte", atTop], ["Şüpheli bölümü ortada", atCenter]]) {
      const shown = [...m.woDel, ...m.recDel].filter(item => item.shown).length;
      ok(covered(m).length === 0, `${tag} (${label}): iletinin söylediği × düğmeleri örtülmüyor (görünen ${shown}, örtülen ${covered(m).length}: ${JSON.stringify(covered(m))})`);
    }
    if (vw === 1366) {
      // İletinin söylediği düğmeye basılır (Değersiz satırının ×'ı) → "silinsin mi?" sorusu: uzun bildirim SONRADAN açılan bu pencerenin düğmelerini örtmez
      // (gizlenir); Vazgeç'ten sonra yeniden görünür. Hiçbir şey silinmez.
      await page.click(`${CARD} [data-dbt-wo-del]`);
      await page.waitForSelector(`${TOP} [data-answer="no"]`);
      await page.waitForTimeout(300);
      const ask = await page.evaluate(sel => {
        const shown = node => getComputedStyle(node).display !== "none" && node.getBoundingClientRect().height > 0;
        const toasts = [...document.querySelectorAll(".hof-toast")].filter(shown).map(node => node.getBoundingClientRect());
        const buttons = [...document.querySelectorAll(`${sel} [data-answer]`)].map(node => node.getBoundingClientRect());
        const under = buttons.filter(b => toasts.some(t => b.right > t.left && b.left < t.right && b.bottom > t.top && b.top < t.bottom)).length;
        return { longShown: [...document.querySelectorAll(".hof-toast-long")].filter(shown).length, buttons: buttons.length, under };
      }, TOP);
      await shot(`ui251-a-soru-${vw}x${vh}`);
      ok(ask.longShown === 0 && ask.buttons === 2 && ask.under === 0, `${tag}: Değersiz × → soru penceresi açıkken uzun bildirim gizli, soru düğmeleri örtülmüyor (${JSON.stringify(ask)})`);
      await page.click(`${TOP} [data-answer="no"]`);
      await page.waitForTimeout(400);
      ok((await page.$$eval(".hof-toast-long", nodes => nodes.filter(node => getComputedStyle(node).display !== "none").length)) === 1, `${tag}: Vazgeç'ten sonra uzun bildirim yeniden görünür`);
      ok((await page.$$(`${CARD} [data-dbt-wo-del]`)).length === 1, `${tag}: Değersiz satırı yerinde (Vazgeç)`);
    }
    if (vw === 1440) {
      await shot(`ui251-a-ret-${vw}x${vh}-bolum-ortada`);
      await page.clock.runFor(60000);
      await page.waitForTimeout(400);
      const still = await page.$$eval(".hof-toast-error .hof-toast-text", nodes => nodes.map(node => node.textContent));
      ok(still.includes(text), `${tag}: 60 sn sonra ileti yerinde (süreyle kapanmadı)`);
      // İki ret daha (Borç ×) → üç uzun ileti; en çok ikisi görünür, yığın ekrandan taşmaz.
      await deleteEntry(debt1.entryId);
      await deleteEntry(debt2.entryId);
      await page.clock.runFor(60000);
      await page.waitForTimeout(400);
      const stack = await page.$$eval(".hof-toast", nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), text: node.querySelector(".hof-toast-text")?.textContent.slice(0, 40) }; }));
      await shot(`ui251-a-uc-ret-${vw}x${vh}`);
      console.log(`    [yığın] ${JSON.stringify(stack)}`);
      ok(stack.length === 2 && stack.every(item => item.top >= 0 && item.bottom <= vh), `${tag}: üç retten sonra 2 ileti görünür, hepsi ekranın içinde (${JSON.stringify(stack.map(item => [item.top, item.bottom]))})`);
      ok(stack.some(item => /^Borç hareketi silinemez/.test(item.text)), `${tag}: en yeni ret (Borç) görünür`);
      // Yalnız × ile kapanır.
      for (let i = 0; i < 3 && (await page.$(".hof-toast-error .hof-toast-close")); i += 1) await page.click(".hof-toast-error .hof-toast-close");
      ok((await page.$$(".hof-toast")).length === 0, `${tag}: × ile kapandılar`);
    }
    if (vw <= 600) {
      // Telefonda iki uzun ret üst üste: ikisi de ekranın içinde (metin kutusu ekranın yarısını geçmez, sığmayan metin kendi içinde kayar).
      await deleteEntry(debt1.entryId);
      const pair = await page.$$eval(".hof-toast-long", nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; }));
      await shot(`ui251-a-iki-ret-${vw}x${vh}`);
      ok(pair.length === 2 && pair.every(([top, bottom]) => top >= 0 && bottom <= vh), `${tag}: iki uzun ret ekranın içinde (${JSON.stringify(pair)})`);
    }
  }
  const after = await cardD();
  ok(JSON.stringify(after.totals) === JSON.stringify(before.totals), `ret: kart toplamları değişmedi (${JSON.stringify(after.totals?.balance ?? after.totals)})`);
  const ids = entryIds(after);
  ok([out.entryId, debt1.entryId, debt2.entryId].every(id => !ids.size || ids.has(id)), "ret: ödeme ve iki borç satırı yerinde");

  console.log("B) Kısa bildirimler ve öbür raporlar eskisi gibi");
  await page.setViewportSize({ width: 1440, height: 900 });
  await clearToasts();
  await openCard(D.id);
  await page.evaluate(() => window.HOF.toast("Kaydedildi.", { type: "success" }));
  await page.evaluate(() => window.HOF.toast("Kısa hata.", { type: "error" }));
  await page.waitForTimeout(400);
  const shortModal = await page.$$eval(".hof-toast", nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), long: node.classList.contains("hof-toast-long") }; }));
  ok(shortModal.length === 2 && shortModal.every(item => item.w === 380 && !item.long) && shortModal[0].y <= 20 && Math.abs(shortModal[0].x - (1440 - 380) / 2) <= 2, `pencere açıkken kısa bildirimler üst ortada, 380 px (${JSON.stringify(shortModal)})`);
  await page.clock.runFor(9000);
  await page.waitForTimeout(500);
  ok((await page.$$(".hof-toast")).length === 0, "kısa bildirimler süreyle kapandı (9 sn)");
  await closeModals();
  await page.evaluate(() => window.HOF.toast("Kaydedildi.", { type: "success" }));
  await page.waitForTimeout(400);
  const shortPage = await page.$eval(".hof-toast", node => { const r = node.getBoundingClientRect(); return { right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width) }; });
  ok(shortPage.w === 380 && shortPage.right === 1440 - 18 && shortPage.bottom <= 900 - 18, `pencere yokken kısa bildirim sağ altta, 380 px (${JSON.stringify(shortPage)})`);
  await clearToasts();
  // Hangi bildirim "uzun": hata ve (300 harften uzun ya da "Ne yapmalı:" içeren). 250 harflik hata ve 400 harflik uyarı / bilgi eskisi gibi kısa.
  const kinds = await page.evaluate(() => {
    const make = (text, type) => window.HOF.toast(text, { type }).classList.contains("hof-toast-long");
    const result = { error350: make(`Uzun hata ${"x".repeat(340)}`, "error"), error250: make(`Orta hata ${"y".repeat(240)}`, "error"), errorHint: make("Kısa ret. Ne yapmalı: önce kaydı silin.", "error"), warn400: make(`Uzun uyarı ${"z".repeat(390)}`, "warn"), info400: make(`Uzun bilgi ${"q".repeat(390)}`, "info") };
    document.querySelectorAll(".hof-toast").forEach(node => node.remove());
    return result;
  });
  ok(kinds.error350 && !kinds.error250 && kinds.errorHint && !kinds.warn400 && !kinds.info400, `uzun bildirim yalnız hata + (300 harf üstü ya da 'Ne yapmalı:') (${JSON.stringify(kinds)})`);

  console.log("C) UI-2 — Raporlar → KDV Özeti: tutar kartları alçak ekranda kesilmiyor / gizlenmiyor");
  const openReport = async id => {
    await closeModals();
    // Telefonda yan menü kapalı (düğme ekran dışında): menü öğesi kendi tıklamasıyla açılır.
    if ((page.viewportSize()?.width || 0) <= 600) await page.$eval('#hof-sidecard [data-action="analytics"]', button => button.click());
    else await page.click('#hof-sidecard [data-action="analytics"]');
    await page.waitForSelector(`${MODAL} .hof-rep-tab[data-tab="all"]`);
    await page.click(`${MODAL} .hof-rep-tab[data-tab="all"]`);
    await page.waitForSelector(`${MODAL} [data-rc-list] [data-report="${id}"]`);
    await page.click(`${MODAL} [data-rc-list] [data-report="${id}"]`);
    await page.waitForFunction(sel => {
      const main = document.querySelector(`${sel} [data-rc-main]`);
      return main && main.getAttribute("aria-busy") !== "true" && main.querySelector(".hof-rc-summary span") && !/Rapor hazırlanıyor/.test(main.innerText);
    }, MODAL, { timeout: 20000 });
    await page.waitForTimeout(400);
  };
  const cards = () =>
    page.evaluate(sel => {
      const row = document.querySelector(`${sel} [data-rc-main] .hof-rc-summary:not(.is-kdv-notes)`);
      const box = row.getBoundingClientRect();
      const items = [...row.querySelectorAll("span")].map(span => {
        const r = span.getBoundingClientRect();
        return { name: span.querySelector("small")?.textContent.trim(), inside: r.left >= box.left - 1 && r.right <= box.right + 1, cut: span.scrollWidth > span.clientWidth + 1, top: Math.round(r.top) };
      });
      return { rows: new Set(items.map(item => item.top)).size, overflow: row.scrollWidth > row.clientWidth + 1, wrap: getComputedStyle(row).flexWrap, items, pageScroll: document.documentElement.scrollWidth > innerWidth + 1 };
    }, MODAL);
  for (const [vw, vh] of [[1366, 768], [1280, 720], [1440, 900], [1920, 1080], [390, 844]]) {
    await page.setViewportSize({ width: vw, height: vh });
    await openReport("kdv-ozeti");
    const c = await cards();
    await shot(`ui251-c-kdv-ozeti-${vw}x${vh}`);
    const bad = c.items.filter(item => !item.inside || item.cut).map(item => item.name);
    ok(c.items.length >= 6 && bad.length === 0 && !c.overflow, `${vw}×${vh}: KDV Özeti ${c.items.length} kartın hepsi görünür, kesik yok (${c.rows} satır; dışarıda / kesik: ${JSON.stringify(bad)})`);
    if (vw <= 600) ok(!c.pageScroll, `${vw}×${vh}: telefonda sayfa yana kaymıyor`);
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await openReport("fatura-satis");
  const other = await cards();
  ok(other.wrap === "nowrap", `1366×768: Satış Faturaları özet kartları eskisi gibi tek satır (flex-wrap ${other.wrap})`);

  console.log("D) UI-3 — KDV Mahsup Fişi → Mahsup Edilen Aylar: Geri Al yana kaydırmadan görünür");
  for (const [vw, vh] of [[1366, 768], [1440, 900], [1920, 1080], [834, 1112]]) {
    await page.setViewportSize({ width: vw, height: vh });
    await openReport("kdv-ozeti");
    await page.click(`${MODAL} [data-rc-action="vat-offset"]`);
    await page.waitForSelector("[data-vat-root] [data-vat-reverse]");
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const box = document.querySelector("[data-vat-root] h3 + .hof-rep-table");
      const button = box.querySelector("[data-vat-reverse]");
      button.scrollIntoView({ block: "nearest" });
      const b = box.getBoundingClientRect();
      const r = button.getBoundingClientRect();
      return { badge: box.querySelector(".hof-plan-badge")?.textContent.trim() || "", row: button.closest("tr")?.cells[0]?.textContent.trim(), scrollLeft: box.scrollLeft, overflow: box.scrollWidth > box.clientWidth + 1, scrollWidth: box.scrollWidth, clientWidth: box.clientWidth, button: { left: Math.round(r.left), right: Math.round(r.right) }, box: { left: Math.round(b.left), right: Math.round(b.right) }, inside: r.left >= b.left - 1 && r.right <= b.right + 1 && r.width > 0 };
    });
    await shot(`ui251-d-mahsup-${vw}x${vh}`);
    ok(m.badge === "Mahsuptan Sonra Değişti" && m.row === "Mart 2026", `${vw}×${vh}: rozetli satır var, Geri Al en yeni mahsupta (${m.row})`);
    ok(!m.overflow && m.inside && m.scrollLeft === 0, `${vw}×${vh}: tablo yana taşmıyor, Geri Al görünür (tablo ${m.scrollWidth}/${m.clientWidth} px; düğme ${m.button.left}–${m.button.right}, kutu ${m.box.left}–${m.box.right})`);
    await closeModals();
  }

  console.log("E) D1 — Değersiz Alacak Yaz formunda 659'un adı");
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCard(W.id);
  await page.click(`${CARD} [data-dbt-act="writeoff"]`);
  await page.waitForSelector(`${TOP} .hof-form input[name="amount"]`);
  const intro = await page.$eval(TOP, node => node.innerText);
  await shot("ui251-e-degersiz-form");
  ok(intro.includes(`659 ${CHART["659"]}`) && CHART["659"] === "Diğer Olağan Gider ve Zararlar", `form metni hesap planındaki adla: "659 ${CHART["659"]}"`);
  ok(!/Olağandışı/.test(intro), "formda 'Olağandışı' yok");
  await closeModals();
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  await page.screenshot({ path: path.join(shots, "ui251-gorunum-hata.png"), fullPage: true }).catch(() => null);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-ui251-gorunum: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  if (!process.env.EKRAN_DIR) rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
