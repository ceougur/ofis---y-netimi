// 2.4.9 B2 (tasarım notu §7 adım 4, §11 R5; Ölçek kuralı "sunucu + ekran") — YALNIZ ÖLÇÜM: gerçek program (test/isz-248/ortak.mjs düzeneği; dış istek yok, ders 30) + gerçek
// tarayıcı (Playwright). Cari Listesi → seçimsiz "WhatsApp Ekstre" (Tümüne, etkin cariler) → (WhatsApp Business API bağlıysa "WhatsApp Web ile Gönder") → pencerenin dolma süresi
// (tıklama → alıcı başlığı; /targets yanıt süresi ayrıca), sonra istemci tarafı yeniden çizimler: "Yalnız Borçlu Carilere Gönder", tek kişinin işareti, "Hepsini seç" ve
// Ekstre Dönemi değişimi (yeniden /targets). prepare() her değişimde bütün satırları yeniden yazar — istemci tarafı, sunucuyu kilitlemez (B2 kapsamı DEĞİL; ölçülür, yazılır).
// Kullanım: node test/b2-249/ekran-olcum.mjs <hazır veri> <iş klasörü> <çıktı.json> [tekrar=2]
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { surum, kurulum, PASS, log } from "../isz-248/ortak.mjs";

const [VERI, IS, CIKTI, TEKRAR = "2"] = process.argv.slice(2);
if (!VERI || !IS || !CIKTI) throw new Error("kullanım: ekran-olcum.mjs <veri> <iş> <çıktı.json> [tekrar]");
const SAAT = "2026-11-03T15:00:00+03:00";
const sonuc = { commit: surum(), node: process.version, veri: VERI, saat: SAAT, basladi: new Date().toISOString(), tekrar: [] };
const ctx = await kurulum({ veri: VERI, is: IS, saat: { time: SAAT, fixed: true }, isci: "manual", aralik: 0, tier: "TIER_10K", onEk: `b2s${Date.now().toString(36)}` });
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" })).newPage();
  const hatalar = [];
  page.on("pageerror", e => hatalar.push(e.message));
  const MODAL = ".hof-modal-backdrop.is-visible";
  const top = `${MODAL}:nth-last-child(1 of ${MODAL})`;
  await page.goto(`${ctx.server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector('#hof-sidecard [data-action="accounts"]', { timeout: 30000 });
  // /targets isteğinin süresi tarayıcıdan (istek → yanıtın sonu); istemcinin 30 sn zaman aşımında istek iptal edilir ("requestfailed").
  const hedef = [];
  const basla = new Map();
  page.on("request", r => {
    if (r.url().includes("/api/workspace/whatsapp/targets")) basla.set(r, Date.now());
  });
  page.on("requestfinished", async r => {
    if (basla.has(r)) hedef.push({ durum: (await r.response())?.status(), ms: Date.now() - basla.get(r) });
  });
  page.on("requestfailed", r => {
    if (basla.has(r)) hedef.push({ durum: "düştü", hata: r.failure()?.errorText, ms: Date.now() - basla.get(r) });
  });
  const ciz = sel =>
    page.evaluate(async sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const t = performance.now();
      el.click();
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
      return Math.round(performance.now() - t);
    }, `${top} ${sel}`);
  for (let i = 0; i < Number(TEKRAR); i += 1) {
    for (let k = 0; k < 6 && (await page.$(MODAL)); k += 1) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
    await page.click('#hof-sidecard [data-action="accounts"]');
    await page.waitForSelector(`${top} tr[data-account]`, { timeout: 60000 });
    await page.waitForTimeout(500);
    const baslik = await page.$eval(`${top} [data-act="waStatement"]`, n => n.title || n.textContent.trim());
    hedef.length = 0;
    // Açılış: düğmeye tıklama → alıcı başlığı (ya da istemcinin hata iletisi). Otomatik + WhatsApp Web sekmeleri varsa WhatsApp Web seçili değilse seçilir.
    const t0 = Date.now();
    await page.click(`${top} [data-act="waStatement"]`);
    const ilk = await page.waitForSelector(`${top} [data-wa-path="manual"], ${top} .hof-wa-head`, { timeout: 120000 });
    let yol = "tek yol";
    if (await ilk.getAttribute("data-wa-path")) {
      yol = `Otomatik + WhatsApp Web (WhatsApp Web ${(await ilk.getAttribute("aria-selected")) === "true" ? "kendiliğinden seçili" : "tıklandı"})`;
      if ((await ilk.getAttribute("aria-selected")) !== "true") await page.click(`${top} [data-wa-path="manual"]`);
    }
    await page.waitForFunction(sel => document.querySelector(`${sel} .hof-wa-head`) || [...document.querySelectorAll(`${sel} [data-wa] .hof-empty`)].some(n => !/hazırlanıyor/.test(n.textContent)), top, { timeout: 120000 });
    const acilisMs = Date.now() - t0;
    const hata = await page.$eval(`${top} [data-wa]`, n => (n.querySelector(".hof-wa-head") ? "" : n.textContent.trim()));
    if (hata) {
      const kayit = { yol, dugme: baslik, acilisMs, targets: hedef.slice(), istemciHatasi: hata };
      sonuc.tekrar.push(kayit);
      log("ekran", JSON.stringify(kayit));
      continue;
    }
    const satir = await page.$$eval(`${top} .hof-wa-list tbody tr`, rows => rows.length);
    const head = await page.$eval(`${top} .hof-wa-head`, n => n.innerText.replace(/\s+/g, " "));
    const borclu = await ciz("input[data-debtors]");
    const borcluGeri = await ciz("input[data-debtors]");
    const tekKisi = await ciz("input[data-pick]:not([disabled])");
    const hepsi = await ciz("input[data-pick-all]");
    const ilkTargets = hedef.slice();
    hedef.length = 0;
    const t1 = Date.now();
    await page.selectOption(`${top} select[data-preset]`, "all");
    await page.waitForFunction(sel => document.querySelector(sel)?.value === "all" && document.querySelector(sel.replace(" select[data-preset]", " .hof-wa-head")), `${top} select[data-preset]`, { timeout: 120000 });
    const donemMs = Date.now() - t1;
    const kayit = { yol, dugme: baslik, acilisMs, targets: ilkTargets, donemTargets: hedef.slice(), satir, head, yeniden: { yalnizBorcluMs: borclu, yalnizBorcluGeriMs: borcluGeri, tekKisiMs: tekKisi, hepsiniSecMs: hepsi }, donemDegisimMs: donemMs };
    sonuc.tekrar.push(kayit);
    log("ekran", JSON.stringify(kayit));
  }
  sonuc.sayfaHatasi = hatalar;
} finally {
  await browser.close();
  await ctx.kapat();
  sonuc.bitti = new Date().toISOString();
  writeFileSync(CIKTI, `${JSON.stringify(sonuc, null, 1)}\n`);
  console.log("yazıldı", CIKTI);
}
