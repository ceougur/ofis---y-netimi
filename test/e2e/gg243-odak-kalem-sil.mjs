// Dar kontrol turu 2.4.3 (D1, DÜŞÜK–ORTA — GG4 eksik; betik r9): fatura formunda İLK ya da ORTADAKİ kalemin ×'ine klavyeyle Enter → kalem silinip
// satırlar yeniden çizilince aynı data-l'li × bir SONRAKİ kalemin düğmesi oluyor, odak ona geçiyordu; ikinci Enter o kalemi de siliyordu. Artık silme
// düğmesinden sonra odak hiçbir zaman başka bir silme düğmesine gitmez: aynı konumdaki (yoksa son) kalemin ilk yazılabilir alanına gider.
// GERÇEK tarayıcıda, yalnız klavyeyle; ilk / orta / son kalem üçü de. Eski kodda (d64ebf8) ilk ve orta kalem kırmızıdır; DEPO=<eski kopya> ile koşulur.
// Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-gg243-kalem-sil-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f45" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
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
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Odaktaki öğe: düğmeyse data-act#data-l, alansa ALAN:data-f#data-l (hangi kalem satırında olduğu).
const focused = () => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "BODY";
  if (a.tagName === "BUTTON") return `${a.dataset.act || "?"}#${a.dataset.l ?? ""}`;
  const row = a.closest("tr[data-line]");
  return `${a.tagName}:${a.dataset.f || ""}#${row ? row.dataset.line : "-"}`;
});
const names = () => page.locator('[data-lines] input[data-f="name"]').evaluateAll(nodes => nodes.map(node => node.value));
const fillThree = async () => {
  for (let i = 0; i < 3; i += 1) {
    if ((await page.locator('[data-lines] input[data-f="name"]').count()) <= i) await page.click('[data-act="add-line"]');
    await page.locator('[data-lines] input[data-f="name"]').nth(i).fill(`Kalem ${i + 1}`);
  }
  await sleep(300);
};

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.invoices?.newFor);
  await page.evaluate(() => window.HOF.invoices.newFor({ side: "sale" }));
  await page.locator(".hof-inv-scenario").first().click();
  await page.waitForSelector('[data-lines] input[data-f="name"]');

  for (const [which, label] of [[0, "ilk"], [1, "orta"], [2, "son"]]) {
    console.log(`${label} kalem (${which + 1}.) ×'ine klavyeyle Enter`);
    await fillThree();
    const start = await names();
    if (!ok(JSON.stringify(start) === JSON.stringify(["Kalem 1", "Kalem 2", "Kalem 3"]), `ön koşul: üç kalem (${JSON.stringify(start)})`)) continue;
    const expected = start.filter((_, index) => index !== which);
    await page.locator(`[data-lines] button[data-act="line-remove"][data-l="${which}"]`).focus();
    await page.keyboard.press("Enter");
    await sleep(400);
    const after = await focused();
    ok(JSON.stringify(await names()) === JSON.stringify(expected), `${which + 1}. kalem silindi (${JSON.stringify(await names())})`);
    ok(!/^line-remove#/.test(after), `odak başka kalemin ×'inde değil (${after})`);
    const position = Math.min(which, expected.length - 1);
    ok(after === `INPUT:code#${position}`, `odak aynı konumdaki (${position + 1}.) kalemin ilk alanında (${after})`);
    await page.keyboard.press("Enter");
    await sleep(400);
    ok(JSON.stringify(await names()) === JSON.stringify(expected), `ikinci Enter başka kalemi silmedi (${JSON.stringify(await names())})`);
  }
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  const shot = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "gg243-odak-kalem-sil-hata.png");
  await page.screenshot({ path: shot, fullPage: true }).then(() => console.log(`  ekran görüntüsü: ${shot}`), () => null);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} gg243-odak-kalem-sil: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
