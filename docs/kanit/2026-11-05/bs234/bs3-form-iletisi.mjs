// 2.5.0 BS-3 — istemci denetimi (ders 3, 12): düzeltme formu açıkken kayıt silinirse "Kaydet" formda sunucunun 404 iletisini gösterir mi?
// Üç form (stok hareketi ✎, taksit kartı tahsilatı ✎, taksit ✎) gerçek tıklamayla açılır; kayıt API'den silinir; Kaydet'e basılır; .hof-form-error okunur;
// form açık kalır; veri tabanında kayıt yok. (Bu betik kanıt içindir; isteğin başındaki denetim de aynı iletiyi verir — yarış sunucu testinde:
// test/bs3-silinmis-kayit-250.test.mjs.) Çalıştırma: PLAYWRIGHT_BROWSERS_PATH=… node docs/kanit/2026-11-05/bs234/bs3-form-iletisi.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createApp } from "../../../../server/app.mjs";
import { createClient, installPageClock } from "../../../../test/helpers.mjs";
import { escClose } from "../../../../test/e2e/esc-kapat.mjs";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const top = ".hof-modal-backdrop.is-visible:nth-last-child(1 of .hof-modal-backdrop.is-visible)";
const form = `${top} .hof-form`;
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const root = mkdtempSync(path.join(tmpdir(), "destekofis-bs3-form-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f51" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const api = createClient(BASE);
const browser = await chromium.launch();
try {
  await api.login("admin", PASS);
  await must("banka kurulumu", api.post("/api/workspace/bank/setup/dismiss", {}));
  const account = await must("cari", api.post("/api/workspace/accounts", { name: "BS3 Form Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
  const item = await must("ürün", api.post("/api/workspace/stock", { name: "BS3 Form Ürünü", unit: "Adet", unitPrice: 10, openingQty: "10" }));
  const sale = await must("satış", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: 1, unitPrice: 50, pay: "account", accountId: account.id, date: TODAY }));
  const plan = await must("kart", api.post("/api/workspace/plans", { accountId: account.id, name: "BS3 Form Kartı", total: "600", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: TODAY }));
  const paid = await must("tahsilat", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "100", date: TODAY, method: "cash" }));
  const firstItem = app.store.get("SELECT id FROM plan_items WHERE plan_id = ? ORDER BY seq LIMIT 1", plan.id).id;

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  const page = await context.newPage();
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForFunction(() => Boolean(window.HOF?.plans && window.HOF?.stock), null, { timeout: 30000 });
  await page.waitForTimeout(1500);

  const tryForm = async ({ label, openWith, editSel, remove, gone, message, field = "amount" }) => {
    console.log(`\n■ ${label}`);
    await page.evaluate(openWith);
    await page.waitForSelector(editSel, { timeout: 15000 });
    await page.waitForTimeout(400);
    await page.click(editSel);
    await page.waitForSelector(`${form} input[name="${field}"]`, { timeout: 10000 });
    await page.waitForTimeout(500);
    await remove();
    await page.click(`${form} input[name="${field}"]`);
    await page.fill(`${form} input[name="${field}"]`, "");
    await page.type(`${form} input[name="${field}"]`, "77", { delay: 60 });
    await page.click(`${form} button[type="submit"]`);
    await page.waitForFunction(f => (document.querySelector(`${f} .hof-form-error`)?.textContent || "").trim().length > 0, form, { timeout: 10000 }).catch(() => null);
    const shown = await page.$eval(`${form} .hof-form-error`, node => node.textContent.trim()).catch(() => "(form kapandı)");
    ok(shown === message, `formda ileti: “${shown}”`);
    ok(gone(), "veri tabanında kayıt yok (düzeltme yazılmadı)");
    // Form kirli (tutar yazıldı) → "Kaydedilmemiş Değişiklik" sorusu beklenir (ders 34); sonra açık pencereler (kart / ürün) sorusuz kapanır.
    await escClose(page, { expect: "soru-var", step: `${label}: formu kapat` });
    await page.waitForTimeout(300);
    for (let i = 0; i < 6 && (await page.$(".hof-modal-backdrop.is-visible")); i += 1) {
      await escClose(page, { expect: "soru-yok", step: `${label}: pencereyi kapat` });
      await page.waitForTimeout(300);
    }
  };
  await tryForm({
    label: "(d) stok hareketi ✎ → hareket silinir → Kaydet",
    openWith: `HOF.stock.open(${JSON.stringify(item.id)})`,
    editSel: `[data-edit-move="${sale.moveId}"]`,
    field: "unitPrice",
    remove: () => must("hareket sil", api.del(`/api/workspace/stock/${item.id}/moves/${sale.moveId}`)),
    gone: () => !app.store.get("SELECT 1 AS x FROM stock_moves WHERE id = ?", sale.moveId),
    message: "Stok hareketi bulunamadı. Başka biri silmiş olabilir.",
  });
  await tryForm({
    label: "(f) taksit kartı tahsilatı ✎ → tahsilat silinir → Kaydet",
    openWith: `HOF.plans.open(${JSON.stringify(plan.id)})`,
    editSel: `[data-edit-entry="${paid.entryId}"]`,
    remove: () => must("tahsilat sil", api.del(`/api/workspace/plans/${plan.id}/entries/${paid.entryId}?cashForce=1`)),
    gone: () => !app.store.get("SELECT 1 AS x FROM plan_entries WHERE id = ?", paid.entryId),
    message: "Hareket bulunamadı. Başka biri silmiş olabilir.",
  });
  await tryForm({
    label: "(g) taksit ✎ → taksit silinir → Kaydet",
    openWith: `HOF.plans.open(${JSON.stringify(plan.id)})`,
    editSel: `[data-edit-item="${firstItem}"]`,
    remove: () => must("taksit sil", api.del(`/api/workspace/plans/${plan.id}/items/${firstItem}`)),
    gone: () => !app.store.get("SELECT 1 AS x FROM plan_items WHERE id = ?", firstItem),
    message: "Taksit bulunamadı. Başka biri silmiş olabilir.",
  });
  await context.close();
} catch (error) {
  failed += 1;
  console.error("HATA:", error);
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  console.log(`\nSONUÇ: ${passed} geçti, ${failed} kaldı`);
  process.exit(failed ? 1 : 0);
}
