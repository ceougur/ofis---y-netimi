// 2.5.0 İzleyen tur 3 EKRANDAN (görev metni docs/devir/2.5.0-DEVAM/izt3-istem.txt; tasarım docs/erp/C7B-FATURA-TASARIM.md §21.2). Gerçek tıklama + Tab + insan hızı (ders 12); sahte saat
// (sunucu ve sayfa, 10.11.2026 — ders 13); lisans servisi yok (ders 30); pencere seçicisi en üstteki görünür pencere (ders 39); "veri bozulmaz" veri tabanı okunarak söylenir.
// İki ekran: YÖNETİCİ (admin) stok iadesini Stok penceresinden düzeltir / siler, Yönetim › Silinenler'den geri yükler; GÖZCÜ (ikinci kullanıcı, başka bilgisayar gibi) Taksitler'de kartı açık tutar —
// gözcünün ekranına HİÇ dokunulmaz, kart kendiliğinden yenilenmeli (canlı olay). BEKLENENLER ELLE (ders 5; §21.2'nin sözünden ve İzleyen tur 2'nin S238 = A sayılarından):
//   elle borç 900, Mevcut Borç kartı 900 (3 × 300), stok iadesi 300 (API) → kart 600; Düzelt Miktar 1 → 2 (iade 600) → kart 300; Sil → 900; Silinenler'den Geri Yükle (Miktar 2'lik hâli) → 300.
//   Kart penceresinde Kalan sırasıyla ₺600,00 → ₺300,00 → ₺900,00 → ₺300,00; ikinci tur Taksitler LİSTESİNDE aynı: Sil → ₺900,00, Geri Yükle → ₺300,00; bakiye 900 − 600 = 300.
//   Tabanda (3b420085) geri yükleme gözcüye olay göndermiyordu (kart ₺900,00'da kalıyordu); düzeltme ve silme cari olayıyla yenileniyordu (bekçi).
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

const OUT = process.env.EKRAN_DIR || path.join(HERE, "artifacts", "senaryo-izt3-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const NOW = { time: "2026-11-10T12:00:00+03:00", fixed: true };
const root = mkdtempSync(path.join(tmpdir(), "destekofis-izt3-"));
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
let boss = null;
let watcher = null;
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    if (boss) await shot(boss, "hata-yonetici");
    if (watcher) await shot(watcher, "hata-gozcu");
  }
};
const human = page => page.waitForTimeout(300);
const text = async (page, sel) => ((await page.textContent(sel).catch(() => "")) || "").replace(/\s+/g, " ");
const W = "/api/workspace";
const api = await server.login();
const WATCH_USER = "izt3-gozcu";
const WATCH_PASS = "Gozcu-Izt3-2026!";
const planTotal = id => Number(app.store.get("SELECT total FROM plans WHERE id = ?", id).total);
const lastReturn = item => app.store.get("SELECT id FROM stock_moves WHERE item_id = ? AND reason = 'return' ORDER BY rowid DESC LIMIT 1", item)?.id;

async function login(page, user, pass) {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", user);
  await page.fill("#hof-auth input[name=password]", pass);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
}
async function closeAll(page) {
  for (let i = 0; i < 8 && (await page.$(MODAL)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
}
// Gözcü: Taksitler → Tümü → kart (ya da yalnız liste).
async function openPlans(page, planId, { card = true } = {}) {
  await closeAll(page);
  await page.click('#hof-sidecard [data-action="plans"]');
  await page.waitForSelector('.hof-plans [data-status="all"]', { timeout: 15000 });
  await human(page);
  await page.click('.hof-plans [data-status="all"]');
  await human(page);
  await page.waitForSelector(`.hof-plans-table tbody tr[data-plan="${planId}"]`, { timeout: 15000 });
  await human(page);
  if (!card) return;
  await page.click(`.hof-plans-table tbody tr[data-plan="${planId}"]`);
  await page.waitForSelector('.hof-plans [data-act="close"], .hof-plans [data-act="reopen"]', { timeout: 15000 });
  await human(page);
}
const kalan = page => text(page, ".hof-plans .hof-plans-kpis .hof-cash-balance strong");
const listRow = (page, planId) => text(page, `.hof-plans-table tbody tr[data-plan="${planId}"]`);
// Gözcünün ekranına dokunmadan, en çok 8 sn içinde beklenen metin gelir mi (canlı olay + 350 ms birleştirme + yeniden yükleme).
async function waitShown(page, read, pattern) {
  let seen = "";
  for (let i = 0; i < 32; i += 1) {
    seen = await read();
    if (pattern.test(seen)) return { shown: true, seen };
    await page.waitForTimeout(250);
  }
  return { shown: false, seen };
}
// Yönetici: Stok → ürün → hareket satırının düğmesi.
async function openItem(page, itemId) {
  await closeAll(page);
  await page.click("#hof-sidecard [data-action=stock]");
  await page.waitForSelector(`${MODAL} .hof-stock-table tbody tr[data-item="${itemId}"]`, { timeout: 15000 });
  await human(page);
  await page.click(`${MODAL} .hof-stock-table tbody tr[data-item="${itemId}"]`);
  await page.waitForSelector(`${MODAL} [data-edit-move], ${MODAL} [data-delete-move]`, { timeout: 15000 });
  await human(page);
}
async function editReturnQty(page, itemId, moveId, qty) {
  await openItem(page, itemId);
  await page.click(`${MODAL} [data-edit-move="${moveId}"]`);
  await page.waitForSelector(`${topSel} form input[name="qty"]`, { timeout: 15000 });
  await human(page);
  await page.click(`${topSel} form input[name="qty"]`);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(qty, { delay: 120 });
  await page.keyboard.press("Tab");
  await human(page);
  await page.click(`${topSel} form button[type="submit"]`);
  await page.waitForTimeout(1500);
  // Ders 34: bu yolda soru BEKLENMEZ (stok girişi eksiye düşürmez); gelirse yanıtlanmaz, adım kırmızı.
  if (await page.$(`${topSel} [data-answer="yes"]`)) ok(false, `beklenmeyen soru: ${(await text(page, topSel)).slice(0, 160)}`);
}
async function deleteReturn(page, itemId, moveId) {
  await openItem(page, itemId);
  await page.click(`${MODAL} [data-delete-move="${moveId}"]`);
  await page.waitForSelector(`${topSel} [data-answer="yes"]`, { timeout: 15000 });
  await human(page);
  const ask = await text(page, topSel);
  console.log(`    [soru] "Hareketi Sil" → Sil (beklenen soru): ${ask.slice(0, 120)}`);
  await page.click(`${topSel} [data-answer="yes"]`);
  await page.waitForTimeout(1500);
  return ask;
}
async function restoreFromTrash(page, itemName) {
  await page.goto(`${BASE}/admin.html#trash`, { waitUntil: "load" });
  await page.click('.adm-tabs [data-tab="trash"]').catch(() => null);
  await page.waitForSelector("#adm-trash tr[data-id]", { timeout: 15000 });
  await human(page);
  const row = page.locator("#adm-trash tr[data-id]", { hasText: itemName }).first();
  await row.locator("[data-restore]").click();
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector("#hof-sidecard [data-action=stock]", { timeout: 30000 });
}

try {
  await must("gözcü kullanıcı", api.post("/api/admin/users", { username: WATCH_USER, name: "İzt3 Gözcü", role: "admin", password: WATCH_PASS, mustChangePassword: false }));
  const ctxBoss = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  const ctxWatch = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  boss = await ctxBoss.newPage();
  watcher = await ctxWatch.newPage();
  for (const page of [boss, watcher]) {
    page.setDefaultTimeout(20000);
    page.on("pageerror", error => errors.push(error.message));
  }
  await login(boss, "admin", ADMIN_PASSWORD);
  await login(watcher, WATCH_USER, WATCH_PASS);

  // Kurulum (API — değişmeyen yollar): cari, ürün, elle borç 900, Mevcut Borç kartı 900, stok iadesi 300.
  const A = (await must("cari", api.post(`${W}/accounts`, { name: "Ekran İzt3 Müşterisi", type: "customer", registeredOn: "2026-08-01" }))).id;
  const ITEM_NAME = "Ekran İzt3 Malı";
  const mal = (await must("mal", api.post(`${W}/stock`, { kind: "goods", code: "IZT3-EKR", name: ITEM_NAME, unit: "Adet", openingQty: "100", salePrice: "300" }))).id;
  await must("elle borç", api.post(`${W}/accounts/${A}/entries`, { kind: "debt", amount: "900", date: "2026-09-01", note: "elle" }));
  const K = (await must("kart", api.post(`${W}/plans`, { accountId: A, name: "Ekran İzt3 Kartı", total: "900", registeredOn: "2026-09-02", mode: "auto", count: 3, firstDue: "2026-10-05", coversBalance: true }))).id;
  await must("stok iadesi", api.post(`${W}/stock/${mal}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "300", pay: "account", accountId: A, date: "2026-11-10" }));
  const moveId = lastReturn(mal);
  ok(planTotal(K) === 600, `kurulum: stok iadesi kartı 900 → 600 küçülttü (veri tabanı): ${planTotal(K)}`);

  await step("A) Gözcü kart penceresini açar: Kalan ₺600,00", async () => {
    await openPlans(watcher, K);
    ok(/₺600,00/.test(await kalan(watcher)), `gözcü kart penceresi Kalan ₺600,00: ${await kalan(watcher)}`);
    await shot(watcher, "gozcu-kart-acik-600");
  });

  await step("B) Yönetici iadeyi Stok penceresinden düzeltir (Miktar 1 → 2): kart 300; gözcünün kartı kendiliğinden ₺300,00 (bekçi — tabanda cari olayıyla da)", async () => {
    await editReturnQty(boss, mal, moveId, "2");
    ok(planTotal(K) === 300, `kart 300 (veri tabanı): ${planTotal(K)}`);
    const r = await waitShown(watcher, () => kalan(watcher), /₺300,00/);
    ok(r.shown, `gözcü kart penceresi Kalan ₺300,00 (dokunmadan): ${r.seen}`);
    await shot(watcher, "gozcu-kart-duzeltme-300");
  });

  await step("C) Yönetici iadeyi siler: kart 900; gözcünün kartı kendiliğinden ₺900,00 (bekçi)", async () => {
    await deleteReturn(boss, mal, moveId);
    ok(planTotal(K) === 900, `kart 900 (veri tabanı): ${planTotal(K)}`);
    ok(!lastReturn(mal), "hareket silindi (veri tabanı)");
    const r = await waitShown(watcher, () => kalan(watcher), /₺900,00/);
    ok(r.shown, `gözcü kart penceresi Kalan ₺900,00 (dokunmadan): ${r.seen}`);
    await shot(watcher, "gozcu-kart-silme-900");
  });

  await step("D) Yönetici Yönetim › Silinenler'den Geri Yükler: kart 300; gözcünün kartı kendiliğinden ₺300,00 (tabanda ₺900,00'da kalıyordu)", async () => {
    await restoreFromTrash(boss, ITEM_NAME);
    ok(planTotal(K) === 300, `kart 300 (veri tabanı): ${planTotal(K)}`);
    ok(lastReturn(mal) === moveId, "hareket geri geldi (veri tabanı)");
    const r = await waitShown(watcher, () => kalan(watcher), /₺300,00/);
    ok(r.shown, `gözcü kart penceresi Kalan ₺300,00 (dokunmadan; tabanda ₺900,00 kalıyordu): ${r.seen}`);
    await shot(watcher, "gozcu-kart-geri-yukleme-300");
  });

  await step("E) Gözcü Taksitler LİSTESİNDE: yönetici yeniden siler (₺900,00) ve geri yükler (₺300,00) — liste kendiliğinden yenilenir", async () => {
    await openPlans(watcher, K, { card: false });
    ok(/kayıt 02\.09\.2026₺300,00/.test(await listRow(watcher, K)), `liste satırı (Tutar) ₺300,00: ${await listRow(watcher, K)}`);
    await deleteReturn(boss, mal, moveId);
    ok(planTotal(K) === 900, `kart 900 (veri tabanı): ${planTotal(K)}`);
    const d = await waitShown(watcher, () => listRow(watcher, K), /kayıt 02\.09\.2026₺900,00/);
    ok(d.shown, `liste satırı ₺900,00 (dokunmadan): ${d.seen}`);
    await restoreFromTrash(boss, ITEM_NAME);
    ok(planTotal(K) === 300, `kart 300 (veri tabanı): ${planTotal(K)}`);
    const r = await waitShown(watcher, () => listRow(watcher, K), /kayıt 02\.09\.2026₺300,00/);
    ok(r.shown, `liste satırı ₺300,00 (dokunmadan; tabanda ₺900,00 kalıyordu): ${r.seen}`);
    await shot(watcher, "gozcu-liste-geri-yukleme-300");
  });

  const integrity = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
  ok(integrity.ok === true, `Mutabakat Testi temiz${integrity.ok ? "" : `: ${JSON.stringify(integrity.failures).slice(0, 300)}`}`);
  ok((await must("cari", api.get(`${W}/accounts/${A}`))).totals.balance === 300, "bakiye 900 − 600 = 300 (API)");
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  if (boss) await shot(boss, "hata-yonetici");
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-izt3-250: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
