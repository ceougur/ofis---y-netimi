// 2.5.0 Ç5-A tur 2c — Açılış Eşleştirme ekranı (İş 1; docs/erp/C5-ACILIS-TASARIM.md §2.7, §17.10; kural kitabı M-11; BAŞ MİMAR B10). Kullanıcı gözüyle, gerçek tıklama + Tab + Boşluk +
// insan hızında (ders 12): boş veride pasif + neden; açılışlar girilince 519 bakiyesi ve dökümü; hedef satırı ekle (500 + 570), Ön İzleme (519 satırı kendiliğinden), onay kutusu Tab +
// Boşluk ile, Fişi Kaydet → Mizan'da 500 / 570 / 519; kalanı aşan tutar ön izlemede reddedilir (ters bakiye), Kaydet pasif; Ters Kaydet → 519 geri gelir; kilitli tarih seçilince pasif +
// neden; Muhasebe rolü Yönetim'e giremez. Beklenen sayılar girdilerden elle (Kasa 1.000 + cari 300 − tedarikçi 200 + banka 5.000 + stok 10 × 20 = 6.300 alacak).
// Saat sahte ve sabit (ders 13); lisans servisi yok (ders 30); pencere seçicisi son görünen pencere (ders 39). DEPO=<kopya> ile başka kod kopyasına karşı koşulur (eski kod: ekran yok).
// Çalıştırma: node test/e2e/senaryo-acilis-eslestirme-250.mjs
import fs from "node:fs";
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

const OUT = path.join(HERE, "artifacts", "senaryo-acilis-eslestirme-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const NOW = { time: "2026-11-20T12:00:00+03:00", fixed: true };
const root = fs.mkdtempSync(path.join(tmpdir(), "c5a2c-e2e-eslestirme-"));
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: NOW });
const app = server.app;
const BASE = server.base;
const api = await server.login();
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
let page = null;
let shotNo = 0;
const shot = async (name, target = page) => {
  shotNo += 1;
  await target.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), fullPage: true });
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    await shot("hata").catch(() => null);
  }
};
const MODAL = ".hof-modal-backdrop.is-visible";
const top = (p = page) => p.locator(`${MODAL}:nth-last-child(1 of ${MODAL})`);
const human = (p = page) => p.waitForTimeout(250);
const balance = code => {
  let out = 0;
  for (const entry of app.ledger.book({})) for (const line of entry.lines) if (line.account === code) out += line.debit - line.credit;
  return out;
};
const vouchers = () => app.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers WHERE type = 'opening-match'").n;
async function login(context, username, password) {
  const p = await context.newPage();
  await installPageClock(p, app.config.now);
  p.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  await p.goto(`${BASE}/`);
  await p.fill("#hof-auth input[name=username]", username);
  await p.fill("#hof-auth input[name=password]", password);
  await Promise.all([p.waitForEvent("load"), p.click('#hof-auth button[type="submit"]')]);
  await p.waitForSelector("#hof-sidecard", { timeout: 60000 });
  return p;
}
async function openWindow() {
  await page.goto(`${BASE}/admin.html#system`, { waitUntil: "load" });
  await page.click('.adm-tabs [data-tab="system"]');
  await page.waitForSelector("#adm-opening-match-open", { state: "visible", timeout: 60000 });
  await page.click("#adm-opening-match-open");
  await page.waitForSelector(`${MODAL} [data-match-balance]`, { timeout: 60000 });
  await human();
  return top();
}
const text = async locator => ((await locator.textContent()) || "").replace(/\s+/g, " ").trim();

try {
  await api.post("/api/workspace/bank/setup/dismiss", {});
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
  page = await login(context, "admin", ADMIN_PASSWORD);

  await step("Boş veri: 519 bakiyesi yok → pasif, neden görünür yazı; Ön İzleme ve Fişi Kaydet pasif", async () => {
    const dialog = await openWindow();
    ok((await text(dialog.locator(".hof-modal-title"))) === "Açılış Eşleştirme", "pencere başlığı");
    ok((await text(dialog.locator("[data-match-reason]"))) === "Fiş tarihinde eşleştirilecek açılış bakiyesi (519) yok.", "pasifliğin nedeni görünür yazı");
    ok(await dialog.locator("[data-match-preview]").isDisabled(), "Ön İzleme pasif");
    ok(await dialog.locator("[data-match-save]").isDisabled(), "Fişi Kaydet pasif");
    await shot("bos-veri");
    await page.keyboard.press("Escape");
  });

  await step("Açılışlar girilir (Kasa, cari, tedarikçi, banka, stok) → 519 bakiyesi 6.300,00 Alacak, dökümü türlere göre", async () => {
    await api.post("/api/workspace/cash/opening", { amount: "1.000", date: "2026-02-01" });
    await api.post("/api/workspace/accounts", { name: "Borçlu Cari", registeredOn: "2026-02-01", openingBalance: "300", openingSide: "auto" });
    await api.post("/api/workspace/accounts", { name: "Alacaklı Tedarikçi", type: "supplier", registeredOn: "2026-02-01", openingBalance: "200", openingSide: "credit" });
    await api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana Hesap", kind: "demand", currency: "TRY", opening: { date: "2026-02-01", amount: "5.000", confirmed: true } });
    await api.post("/api/workspace/stock", { name: "Un", unit: "Kg", unitPrice: "20", salePrice: "30", openingQty: "10", openingDate: "2026-02-01" });
    ok(balance("519") === -630_000, `ön koşul: defterde 519 = −6.300 (${balance("519") / 100})`);
    const dialog = await openWindow();
    const line = await text(dialog.locator("[data-match-balance]"));
    ok(/6\.300,00 Alacak/.test(line), `bakiye: "${line}"`);
    const parts = (await dialog.locator("[data-match-parts] tbody tr").allInnerTexts()).map(row => row.replace(/\s+/g, " ").trim());
    console.log(`  döküm: ${parts.join(" | ")}`);
    ok(parts.length === 5 && parts.some(row => /^Kasa Açılışı.*1\.000,00 Alacak/.test(row)) && parts.some(row => /^Banka Açılışları.*5\.000,00 Alacak/.test(row)) && /^Toplam.*6\.300,00 Alacak/.test(parts.at(-1)), "döküm: Kasa, Cari, Banka, Stok + Toplam");
    const first = dialog.locator('[data-match-row="0"]');
    ok((await first.locator("[data-match-account]").inputValue()) === "500" && (await first.locator("[data-match-side]").inputValue()) === "credit", "ilk satır önerisi: 500 Alacak");
    await shot("bakiye-dokum");
  });

  await step("Hedef satırları: 500 Alacak 4.000 + (Satır Ekle) 570 Alacak 1.000 → Ön İzleme: 519 Borç 5.000 kendiliğinden; fişten sonra 1.300,00 Alacak", async () => {
    const dialog = top();
    const amount = dialog.locator('[data-match-row="0"] [data-match-amount]');
    await amount.click();
    await amount.fill("");
    await page.keyboard.type("4.000", { delay: 60 });
    await page.keyboard.press("Tab");
    await dialog.locator("[data-match-add]").click();
    await human();
    const second = top().locator('[data-match-row="1"]');
    await second.locator("[data-match-account]").selectOption("570");
    await second.locator("[data-match-amount]").click();
    await page.keyboard.type("1.000", { delay: 60 });
    ok(await top().locator("[data-match-save]").isDisabled(), "ön izlemeden önce Fişi Kaydet pasif");
    ok((await text(top().locator("[data-match-save-why]"))) === "Kaydetmeden önce Ön İzleme'ye basın.", "neden görünür yazı");
    await top().locator("[data-match-preview]").click();
    await page.waitForSelector(`${MODAL} [data-match-lines]`, { timeout: 60000 });
    await human();
    const rows = (await top().locator("[data-match-lines] tbody tr").allInnerTexts()).map(row => row.replace(/\s+/g, " ").trim());
    console.log(`  satırlar: ${rows.join(" | ")}`);
    ok(rows.length === 4 && /^500 .*4\.000,00$/.test(rows[0]) && /^570 .*1\.000,00$/.test(rows[1]) && /^519 .*5\.000,00/.test(rows[2]) && /^Toplam/.test(rows[3]), "fiş satırları 500 / 570 / 519 + toplam");
    ok(/Fişten sonra 519: ₺?1\.300,00 Alacak\./.test(await text(top().locator("[data-match-after]"))), "fişten sonra 519");
    await shot("on-izleme");
  });

  await step("Onay kutusu Tab + Boşluk; Fişi Kaydet → fiş yazıldı; Mizan'da 500 −4.000, 570 −1.000, 519 −1.300; Kasa / cari / banka / stok aynı", async () => {
    const untouched = ["100", "102", "120", "153", "320"].map(code => balance(code));
    await top().locator("[data-match-preview]").focus();
    let reached = false;
    for (let index = 0; index < 12 && !reached; index += 1) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(120);
      reached = await page.evaluate(() => document.activeElement?.matches?.("[data-match-confirm]") || false);
    }
    ok(reached, "onay kutusuna Tab ile ulaşıldı");
    await page.keyboard.press("Space");
    await human();
    ok(!(await top().locator("[data-match-save]").isDisabled()), "onaydan sonra Fişi Kaydet etkin");
    await top().locator("[data-match-save]").click();
    await page.locator(".hof-toast", { hasText: "açılış bakiyeleri eşleştirildi" }).last().waitFor({ timeout: 30000 });
    ok(vouchers() === 1, "bir eşleştirme fişi");
    ok(balance("500") === -400_000 && balance("570") === -100_000 && balance("519") === -130_000, `Mizan: 500 ${balance("500") / 100}, 570 ${balance("570") / 100}, 519 ${balance("519") / 100}`);
    ok(JSON.stringify(["100", "102", "120", "153", "320"].map(code => balance(code))) === JSON.stringify(untouched), "Kasa / banka / cari / stok bakiyesi değişmez");
    const integrity = (await api.get("/api/workspace/ledger/integrity")).data;
    ok(integrity.checks.find(item => item.code === "opening:519")?.ok === true && integrity.checks.find(item => item.code === "opening:500")?.ok === true, "Açılış Karşılığı (519, 500) tutarlı");
  });

  await step("Kalanı aşan tutar (2.000 > 1.300): ön izleme reddeder (ters bakiye), Fişi Kaydet pasif; yazılmış fiş listede", async () => {
    const dialog = await openWindow();
    ok(/1\.300,00 Alacak/.test(await text(dialog.locator("[data-match-balance]"))), "bakiye 1.300,00 Alacak");
    const amount = dialog.locator('[data-match-row="0"] [data-match-amount]');
    await amount.fill("2.000");
    await top().locator("[data-match-preview]").click();
    await page.waitForSelector(`${MODAL} [data-match-error]`, { timeout: 60000 });
    const error = await text(top().locator("[data-match-error]"));
    ok(/519'u ters bakiyeye geçirir/.test(error) && /en çok 1\.300,00/.test(error), `ret iletisi: "${error}"`);
    ok(await top().locator("[data-match-save]").isDisabled(), "Fişi Kaydet pasif");
    ok((await top().locator("[data-match-vouchers] li").count()) === 1, "yazılmış eşleştirme fişi listede");
    await shot("ters-bakiye-ret");
  });

  await step("Ters Kaydet → 519 geri gelir (−6.300); fiş listeden düşer", async () => {
    await top().locator("[data-match-reverse]").click();
    await page.waitForSelector(`${MODAL} [data-answer="yes"]`, { timeout: 30000 });
    await human();
    await top().locator('[data-answer="yes"]').click();
    await page.locator(".hof-toast", { hasText: "ters kaydedildi" }).last().waitFor({ timeout: 30000 });
    ok(balance("519") === -630_000, `519 geri geldi (${balance("519") / 100})`);
    const dialog = await openWindow();
    ok((await dialog.locator("[data-match-vouchers] li").count()) === 0, "etkin eşleştirme fişi yok");
    await page.keyboard.press("Escape");
  });

  await step("Kilitli tarih: kilit 28.02 → fiş tarihi 15.02 seçilince pasif + neden; Ön İzleme pasif", async () => {
    await api.put("/api/admin/period-lock", { lockedUntil: "2026-02-28" });
    await app.ledger.snapshots.runPending();
    const dialog = await openWindow();
    await dialog.locator("[data-match-date]").focus();
    await dialog.locator("[data-match-date]").fill("2026-02-15");
    await page.waitForFunction(() => /kilitli/.test(document.querySelector(".hof-modal-backdrop.is-visible [data-match-reason]")?.textContent || ""), null, { timeout: 30000 });
    const reason = await text(top().locator("[data-match-reason]"));
    ok(reason === "28.02.2026 ve öncesi kapatılmış (kilitli) dönemdir; fiş tarihi 01.03.2026 ya da sonrası olmalı.", `neden: "${reason}"`);
    ok(await top().locator("[data-match-preview]").isDisabled(), "Ön İzleme pasif");
    await shot("kilitli-tarih");
    await page.keyboard.press("Escape");
  });

  await step("Muhasebe rolü: Yönetim paneline giremez; uçlar 403", async () => {
    await api.post("/api/admin/users", { username: "muhasebe2ce", name: "Muhasebe", role: "muhasebe", password: "Personel-2026!", mustChangePassword: false });
    const accApi = await server.login("muhasebe2ce", "Personel-2026!");
    ok((await accApi.get("/api/admin/ledger/opening-match")).status === 403, "uç 403");
    const accContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "tr-TR", timezoneId: "Europe/Istanbul" });
    const acc = await login(accContext, "muhasebe2ce", "Personel-2026!");
    await acc.goto(`${BASE}/admin.html#system`, { waitUntil: "load" });
    await acc.waitForSelector("#adm-denied", { state: "visible", timeout: 60000 });
    ok(!(await acc.locator("#adm-opening-match-open").isVisible()), "Muhasebe: Açılış Eşleştirme düğmesi görünmez");
    await accContext.close();
  });
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  await browser.close().catch(() => null);
  await server.close().catch(() => null);
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız.`);
console.log(`\n# tests ${passed + failed}\n# pass ${passed}\n# fail ${failed}`);
process.exitCode = failed ? 1 : 0;
