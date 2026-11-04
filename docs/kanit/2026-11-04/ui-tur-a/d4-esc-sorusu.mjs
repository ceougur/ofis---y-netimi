// 2.4.9 UI tur A, D4 (ders 34): Yönetim → Şirketler → Şirketi Sil penceresinde parola yazılıp GÖNDERİLMEDEN Esc → "Kaydedilmemiş Değişiklik" sorusu çıkıyor mu?
// Amaç: sorunun 2.4.9 S1'den önce de (v2.4.8) var olup olmadığını gerçek kodla görmek. Kullanım: node d4-esc-sorusu.mjs <kod-kökü>
// (kod kökünde node_modules olmalı; HUKUK_LICENSE_URL ölü adres — ders 30). Çıktı: "SORU: VAR" | "SORU: YOK" ve pencerenin durumu.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [root] = process.argv.slice(2);
if (!root) throw new Error("kullanım: node d4-esc-sorusu.mjs <kod-kökü>");
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const { createApp } = await import(path.join(path.resolve(root), "server/app.mjs"));
const { chromium } = await import(path.join(path.resolve(root), "node_modules/playwright/index.mjs"));
const PASS = "Prova-Admin-2026!";
const dir = mkdtempSync(path.join(tmpdir(), "destekofis-d4-"));
const app = createApp({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "error", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f50" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
let code = 1;
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" })).newPage();
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForTimeout(1200);
  const created = await page.evaluate(async () => (await (await fetch("/api/companies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "İkinci Şirket", select: false }) })).json()).data.company);
  await page.goto(`${BASE}/admin.html#companies`, { waitUntil: "load" });
  await page.waitForSelector(`#adm-companies tr[data-company="${created.id}"] [data-c-delete]`, { timeout: 20000 });
  await page.click(`#adm-companies tr[data-company="${created.id}"] [data-c-delete]`);
  await page.waitForSelector('.hof-modal-backdrop.is-visible input[name="password"]');
  await page.keyboard.type(PASS, { delay: 45 });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  const titles = await page.$$eval(".hof-modal-backdrop .hof-modal-title", nodes => nodes.map(node => node.textContent.trim()));
  const asked = titles.some(title => /Kaydedilmemiş Değişiklik/.test(title));
  console.log(`kod: ${root}`);
  console.log(`açık pencereler: ${JSON.stringify(titles)}`);
  console.log(`SORU: ${asked ? "VAR" : "YOK"}`);
  code = 0;
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
process.exit(code);
