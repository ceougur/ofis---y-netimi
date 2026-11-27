// 2.5.1 M2 — Değersiz Alacak sınırı EKRANDAN (S264 / S269 / S268 / S270 / S-M2-1 = B; karar girdisi docs/devir/2.5.1-DEVAM/m2-kararlar.md; sunucu kuralı
// test/supheli-degersiz-siniri-m2-251.test.mjs). Sahte saat 15.10.2026 (ders 13); gerçek tıklama + Tab + insan hızında yazım (ders 12); sayılar kayıttan sonra VERİ TABANINDAN.
//   Taban T: Fatura 2.900 (10.09) + Borç 3.400 (12.09) · 17.09 faturaya bağlı tahsilat 2.876,45 · 17.09 Şüpheliye Al 3.000.
//   1 Form tarihi BUGÜN gelir (kendiliğinden geriye kurulmaz); ipucu "15.10.2026 tarihiyle en çok ₺123,55 … 17.09.2026 tarihiyle en çok ₺3.000,00"; önerilen 123,55.
//   2 Tarih klavyeyle 17.09.2026 + Tab → ipucu ve önerilen tutar sunucudan yenilenir (3.000,00).
//   3 1.000 yazılır (insan hızı) → bildirim "₺1.000,00 · şüphelide kalan ₺0,00 · 17.09.2026 tarihiyle en çok ₺2.000,00 daha"; kayıt "Değersiz Yazıldı" ama düğme DURUR (S269).
//   4 Kalanın yazılması: 2.000,01 RET (form açık, ileti sınırı söyler) → 2.000 kabul; Değersiz toplamı 3.000, bakiye 423,55 (veri tabanı).
//   5 Fazla yazımın reddi (sonradan gelen bağsız tahsilat, S270): 01.10 bağsız 1.000 olan caride @17.09 öneri 2.000; 3.000 RET (iletide 2.000,00 TL); hiçbir satır yazılmaz.
//   6 Mutabakat Testi tamam; sayfa hatası yok.
// Çıkış: "N geçti, M kaldı" (kalan > 0 → çıkış 1). Ekran görüntüleri EKRAN_DIR (yoksa geçici klasör).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, installPageClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

const NOW = "2026-10-15T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "senaryo-m2-251-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: NOW, logLevel: "warn", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const admin = await server.login();
const BASE = server.base;
const db = () => server.app.store;
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
const ACC = "/api/workspace/accounts";
const setup = async (name, { later = false } = {}) => {
  const acc = await must(name, admin.post(ACC, { name, type: "customer", registeredOn: "2026-09-01" }));
  const inv = await must("fatura", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } }));
  await must("borç", admin.post(`${ACC}/${acc.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" }));
  await must("bağlı tahsilat", admin.post(`${ACC}/${acc.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: inv.id }));
  await must("şüpheliye al", admin.post(`${ACC}/${acc.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" }));
  if (later) await must("bağsız 1.000", admin.post(`${ACC}/${acc.id}/entries`, { kind: "in", amount: "1000", date: "2026-10-01", method: "cash", cashForce: true, similarOk: true, note: "Bağsız" }));
  return acc;
};
const T = await setup("M2 Ekran Taban Müşterisi");
const Z = await setup("M2 Ekran Sonradan Bağsız", { later: true });

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const MODAL = ".hof-modal-backdrop.is-visible";
const top = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const card = ".hof-accounts-modal";
const errors = [];
const browser = await chromium.launch();
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const writtenOff = id => Number(db().get("SELECT COALESCE(SUM(CAST(ROUND(amount * 100) AS INTEGER)), 0) AS n FROM account_entries WHERE account_id = ? AND source = 'doubtful'", id).n);
const lines = id => Number(db().get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", id).n);
const balance = async id => (await must("kart", admin.get(`${ACC}/${id}`))).totals.balance;
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true }).catch(() => null);
const closeAll = async page => {
  for (let index = 0; index < 8 && (await page.$(MODAL)); index += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
const openCard = async (page, id) => {
  await closeAll(page);
  await page.evaluate(accountId => window.HOF.accounts.open(accountId), id);
  await page.waitForSelector(`${card} .hof-plan-head`, { timeout: 10000 });
  await page.waitForSelector(`${card} [data-doubtful-record]`, { timeout: 10000 });
};
const openWriteOff = async page => {
  await page.click(`${card} [data-dbt-act="writeoff"]`);
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`);
  await page.waitForTimeout(300);
};
const hint = page => textOf(page, `${top} [data-dbt-wo-hint]`);
/**
 * Tarih alanına klavyeyle yazar ve Tab'la çıkar — change olayı ve sunucu okuması. Chromium tarih alanı bölümlüdür ve bölüm sırası tarayıcının düzenidir (başsız kabukta locale
 * tr-TR olsa da ay/gün/yıl; masaüstünde gün.ay.yıl): önce gün.ay.yıl denenir, değer tutmazsa ay/gün/yıl (tarih-dene ölçümü, 27.11.2026).
 */
const typeDate = async (page, dd, mm, yyyy) => {
  const target = `${yyyy}-${mm}-${dd}`;
  for (const digits of [`${dd}${mm}${yyyy}`, `${mm}${dd}${yyyy}`]) {
    await page.click(`${top} input[name="date"]`, { position: { x: 10, y: 10 } });
    for (let index = 0; index < 3; index += 1) await page.keyboard.press("ArrowLeft");
    await page.keyboard.type(digits, { delay: 90 });
    if ((await page.inputValue(`${top} input[name="date"]`)) === target) break;
  }
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);
  await page.waitForFunction(sel => document.querySelector(`${sel} [data-dbt-wo-hint]`)?.getAttribute("aria-busy") !== "true", top, { timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(400);
};
const typeAmount = async (page, text) => {
  await page.click(`${top} input[name="amount"]`, { clickCount: 3 });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(text, { delay: 80 });
  await page.keyboard.press("Tab");
};
const submitConfirm = async page => {
  await page.click(`${top} .hof-form button[type="submit"]`);
  await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
  await page.click(`${top} [data-answer="yes"]`);
  await page.waitForTimeout(900);
};
const lastToast = page => page.$$eval(".hof-toast .hof-toast-text", nodes => nodes.map(node => node.textContent.trim()).at(-1) || "").catch(() => "");

try {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(error.message));
  await installPageClock(page, server.app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });

  console.log("\n■ 1 Form tarihi bugün; ipucu bugünün ve 17.09'un sınırını söyler");
  await openCard(page, T.id);
  ok(await page.$(`${card} [data-dbt-act="writeoff"]`), "açık kayıtta Değersiz Alacak Yaz düğmesi");
  await openWriteOff(page);
  const date0 = await page.inputValue(`${top} input[name="date"]`);
  ok(date0 === "2026-10-15", `form tarihi bugün (${date0}) — kendiliğinden geriye kurulmaz`);
  const amount0 = await page.inputValue(`${top} input[name="amount"]`);
  ok(/123,55/.test(amount0), `önerilen tutar bugünün sınırı 123,55 (${amount0})`);
  const hint0 = await hint(page);
  ok(/15\.10\.2026 tarihiyle en çok ₺123,55/.test(hint0) && /17\.09\.2026 tarihiyle en çok ₺3\.000,00/.test(hint0), `ipucu: "${hint0}"`);
  await shot(page, "m2-1-form-bugun");

  console.log("\n■ 2 Tarih 17.09.2026 (klavye + Tab) → ipucu ve önerilen tutar yenilenir");
  await typeDate(page, "17", "09", "2026");
  const date1 = await page.inputValue(`${top} input[name="date"]`);
  const hint1 = await hint(page);
  const amount1 = await page.inputValue(`${top} input[name="amount"]`);
  ok(date1 === "2026-09-17", `tarih ${date1}`);
  ok(/^17\.09\.2026 tarihiyle en çok ₺3\.000,00 yazılabilir/.test(hint1), `ipucu: "${hint1}"`);
  ok(/3\.000,00/.test(amount1), `önerilen tutar 3.000,00 (${amount1})`);
  await shot(page, "m2-2-form-17-09");

  console.log("\n■ 3 1.000 yazılır (insan hızı); bildirim bu yazımı ve gerçek kalanı söyler; düğme durur (S269)");
  await typeAmount(page, "1000");
  await submitConfirm(page);
  const toast3 = await lastToast(page);
  ok(/Değersiz alacak yazıldı: ₺1\.000,00 · şüphelide kalan ₺0,00 · 17\.09\.2026 tarihiyle en çok ₺2\.000,00 daha yazılabilir/.test(toast3), `bildirim: "${toast3}"`);
  ok(writtenOff(T.id) === 100000, `veri tabanı: Değersiz toplamı ${writtenOff(T.id) / 100}`);
  await page.waitForSelector(`${card} [data-doubtful-record]`);
  await page.waitForTimeout(500);
  const status3 = await textOf(page, `${card} [data-doubtful-record] .hof-plan-badge`);
  ok(status3 === "Değersiz Yazıldı", `kayıt durumu: ${status3}`);
  ok(await page.$(`${card} [data-dbt-act="writeoff"]`), "S269: kalanı o günün bağlı payıyla 0 görünen kayıtta düğme DURUR");
  await shot(page, "m2-3-kismi-sonrasi");

  console.log("\n■ 4 Kalanın yazılması: 2.000,01 ret, 2.000 kabul");
  await openWriteOff(page);
  const hint4 = await hint(page);
  ok(/15\.10\.2026 tarihiyle yazılabilecek tutar yok/.test(hint4) && /17\.09\.2026 tarihiyle en çok ₺2\.000,00/.test(hint4), `ipucu: "${hint4}"`);
  const amount4 = await page.inputValue(`${top} input[name="amount"]`);
  ok(amount4 === "", `bugünün tarihiyle yazılabilecek tutar yok → tutar boş gelir, eski 'kalan' (0,00) önerilmez (${JSON.stringify(amount4)})`);
  await typeDate(page, "17", "09", "2026");
  ok(/2\.000,00/.test(await page.inputValue(`${top} input[name="amount"]`)), "önerilen tutar 2.000,00");
  const before4 = lines(T.id);
  await typeAmount(page, "2000,01");
  await submitConfirm(page);
  const error4 = await textOf(page, `${top} .hof-form-error`);
  ok(/2\.000,00 TL/.test(error4) && /aşıyor/.test(error4) && (await page.$(`${top} .hof-form input[name="amount"]`)), `2.000,01: form açık, ileti "${error4.slice(0, 160)}"`);
  ok(lines(T.id) === before4, "reddedilen yazım iz bırakmaz");
  await typeAmount(page, "2000");
  await submitConfirm(page);
  ok(writtenOff(T.id) === 300000, `veri tabanı: Değersiz toplamı ${writtenOff(T.id) / 100} (3.000)`);
  ok((await balance(T.id)) === 423.55, `bakiye ${await balance(T.id)} (423,55)`);
  await shot(page, "m2-4-kalan-yazildi");

  console.log("\n■ 5 Fazla yazımın reddi — 01.10 bağsız 1.000 (S270)");
  await openCard(page, Z.id);
  await openWriteOff(page);
  await typeDate(page, "17", "09", "2026");
  const hint5 = await hint(page);
  ok(/^17\.09\.2026 tarihiyle en çok ₺2\.000,00/.test(hint5), `ipucu: "${hint5}"`);
  const before5 = lines(Z.id);
  await typeAmount(page, "3000");
  await submitConfirm(page);
  const error5 = await textOf(page, `${top} .hof-form-error`);
  ok(/\(2\.000,00 TL\) aşıyor/.test(error5), `3.000 ret: "${error5.slice(0, 160)}"`);
  ok(lines(Z.id) === before5 && writtenOff(Z.id) === 0, "hiçbir satır yazılmadı");
  ok((await balance(Z.id)) === 2423.55, `bakiye değişmedi (${await balance(Z.id)})`);
  await shot(page, "m2-5-fazla-ret");
  await closeAll(page);

  console.log("\n■ 6 Mutabakat Testi ve sayfa hataları");
  const integrity = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
  ok(integrity.ok === true, "Mutabakat Testi tamam");
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ senaryo kesildi: ${error.stack || error.message}`);
} finally {
  await browser.close();
  await server.close();
  if (!process.env.EKRAN_DIR) rmSync(root, { recursive: true, force: true });
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
