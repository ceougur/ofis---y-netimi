// 2.5.0 BS-2 (b) (2.4.9 birleşik son dar kontrol DÜŞÜK-2 — eksik test; docs/2.4.9-IS-LISTESI.md satır 200, docs/2.5.0-IS-LISTESI.md A tablosu BS-2):
// kayıt kartının İşlem Geçmişi'nde kayda bağlı carinin "Kredi Kartına İade" satırı EKRANDA "cari tahsilatı (Kredi Kartına İade)" yazar (client/assets/hof-workspace.js
// describe → HOF.methodLabel(..., { cardRefund })); 2.4.9 UI tur A yalnız sunucunun cardRefund işaretini (ui-tur-a-249) deniyordu, ekran metni testsizdi.
// Senaryo: Rehber.xlsx (1 kayıt) → kayıt seçilir → kayda bağlı tedarikçi (caseKey) + Ziraat vadesiz + Kredi Kartı (World); cari hareketleri (API, programın kendi
// yolu): Alacak 1.000, kartla Ödeme 300 (Kredi Kartı), Kredi Kartına İade 100 (kart hesabına), Nakit Tahsilat 50. Sayfa yenilenir, kayıt yeniden seçilir,
// İşlem Geçmişi "Daha Fazla Göster" ile açılır; satır metinleri ekrandan okunur (gerçek tıklama). Beklenen (elle, programdan bağımsız):
//   • 100,00 TL cari tahsilatı (Kredi Kartına İade) — "POS" YAZMAZ;
//   • 300,00 TL cariye ödeme (Kredi Kartı);
//   • 50,00 TL cari tahsilatı — nakitte yol yazılmaz.
// Dişi: test/bs2-kart-iade-250-mutasyon.mjs M2 (describe'da cardRefund düşer → "(POS)") bu senaryoyu beklenen nedenle kırmızıya çevirir (ders 7, 38).
// Sahte saat 08.10.2026 (ders 13); lisans servisi ölü adres (ders 30); pencereler escClose ile (ders 34).
// Çalıştırma: npm run test:senaryo-kart-iade-gecmis-250 — çıkış: "N geçti, M kaldı" (kaldıysa 1).
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-kart-iade-gecmis-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const BANK = "/api/workspace/bank";
const modal = ".hof-modal-backdrop.is-visible";

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};

const root = mkdtempSync(path.join(tmpdir(), "destekofis-kart-iade-gecmis-250-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f50" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const api = createClient(BASE);
const browser = await chromium.launch();
const errors = [];

const activityRows = page => page.$$eval("#hof-activity li", rows => rows.map(row => ({ type: row.dataset.type, text: row.textContent.replace(/\s+/g, " ").trim() })));
const closeModals = async page => {
  await page.waitForSelector(modal, { timeout: 4000 }).catch(() => {});
  for (let i = 0; i < 6 && (await page.$(modal)); i += 1) {
    const button = (await page.$(`${modal} [data-done]`)) || (await page.$(`${modal} [data-keep]`)) || (await page.$(`${modal} [data-general]`));
    if (button) await button.click();
    else await escClose(page, { expect: "", step: "açılış pencereleri" });
    await page.waitForTimeout(400);
  }
};

try {
  console.log("\n■ Kurulum: Rehber.xlsx (1 kayıt), banka (Ziraat + World kredi kartı)");
  await api.login("admin", PASS);
  const rehber = [["Dosya No", "Adı Soyadı", "Telefonu"], ["2026/250", "Toptancı A.Ş.", "05321234567"]];
  const staged = await must("sayfa", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "Rehber.xlsx", sheets: [{ name: "REHBER", matrix: rehber }] }));
  await must("sayfa onay", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
  await must("banka kurulumu", api.post(`${BANK}/setup/dismiss`, {}));
  const ziraat = await must("Ziraat", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", useCard: true, opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
  const card = await must("kart", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "World", kind: "card", parentId: ziraat.id, creditLimit: "50.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } }));

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  const page = await context.newPage();
  await installPageClock(page, app.config.now);
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
  });
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector(".dynamic-table tbody tr", { timeout: 30000 });
  await closeModals(page);

  console.log("\n■ Kayıt seçilir; anahtarı okunur; kayda bağlı tedarikçi ve hareketleri (API)");
  const openRecord = async () => {
    await page.locator(".dynamic-table tbody tr").first().locator("td").first().click({ position: { x: 12, y: 10 } });
    await page.waitForSelector("#hof-activity", { timeout: 10000 });
    await page.waitForFunction(() => Boolean(document.querySelector("#hof-activity")?.dataset.hofKey), null, { timeout: 10000 });
    await page.waitForTimeout(600);
  };
  await openRecord();
  const caseKey = await page.$eval("#hof-activity", node => node.dataset.hofKey);
  ok(Boolean(caseKey), `kayıt anahtarı: ${caseKey}`);
  const sup = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Toptancı A.Ş.", type: "supplier", registeredOn: "2026-10-01", caseKey, caseTitle: "Toptancı A.Ş." }));
  await must("alacak", api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "credit", amount: "1000", date: "2026-10-02", note: "Mal alımı" }));
  await must("kartla ödeme", api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "card", amount: "300", date: "2026-10-03", bankAccountId: card.id, note: "Kartla ödeme" }));
  const refund = await must("Kredi Kartına İade", api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "in", method: "card", amount: "100", date: "2026-10-04", cardRefund: true, bankAccountId: card.id, note: "Karta iade" }));
  await must("nakit tahsilat", api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "in", method: "cash", amount: "50", date: "2026-10-05", note: "Nakit iade" }));
  // Veri tabanı (ders 3): iade satırı kart hesabında, giriş + kart yolu.
  const row = app.store.get("SELECT kind, method, fin_ref AS finRef, amount FROM account_entries WHERE id = ?", refund.entryId);
  ok(row && row.kind === "in" && row.method === "card" && row.finRef === card.id && Number(row.amount) === 100, `veri tabanı: iade satırı kart hesabında (${JSON.stringify(row)})`);

  console.log("\n■ Sayfa yenilenir; kayıt yeniden seçilir; İşlem Geçmişi tamamı (Daha Fazla Göster) ekrandan okunur");
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector(".dynamic-table tbody tr", { timeout: 30000 });
  await closeModals(page);
  await openRecord();
  await page.waitForFunction(() => document.querySelectorAll('#hof-activity li[data-type="account-entry"]').length >= 1, null, { timeout: 10000 });
  if (await page.$("#hof-activity [data-more]")) {
    await page.click("#hof-activity [data-more]");
    await page.waitForFunction(() => !document.querySelector("#hof-activity [data-more]"), null, { timeout: 10000 });
  }
  const rows = (await activityRows(page)).filter(item => item.type === "account-entry");
  await page.screenshot({ path: path.join(OUT, "01-islem-gecmisi.png") }).catch(() => null);
  console.log(`  (ekran satırları: ${rows.map(item => item.text).join(" ‖ ")})`);
  const refundRow = rows.find(item => item.text.includes("100,00"));
  const payRow = rows.find(item => item.text.includes("300,00"));
  const cashRow = rows.find(item => item.text.includes("50,00"));
  ok(rows.length === 3, `kayda bağlı carinin 3 tahsilat / ödeme satırı (${rows.length})`);
  ok(refundRow?.text.includes("cari tahsilatı (Kredi Kartına İade)"), `iade satırı “cari tahsilatı (Kredi Kartına İade)” — ekran: “${refundRow?.text}”`);
  ok(refundRow && !/\bPOS\b/.test(refundRow.text), "iade satırında “POS” yazmaz");
  ok(payRow?.text.includes("cariye ödeme (Kredi Kartı)"), `ödeme satırı “cariye ödeme (Kredi Kartı)” — ekran: “${payRow?.text}”`);
  ok(cashRow?.text.includes("cari tahsilatı ·") && !cashRow.text.includes("(Nakit)"), `nakit tahsilatta yol yazılmaz — ekran: “${cashRow?.text}”`);
  await context.close();
} catch (error) {
  failed += 1;
  console.error("HATA:", error);
} finally {
  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
  console.log(`\nSONUÇ: ${passed} geçti, ${failed} kaldı`);
  process.exit(failed ? 1 : 0);
}
