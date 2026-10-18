// Dar kontrol turu 2.4.3 — ek 4 (kullanıcı kararı: bulunan bütün bulgular 2.4.3'te): "silme düğmesinden sonra odak başka bir silme düğmesine gitmez"
// kuralı fatura kalemi DIŞINDAKİ listelerde, gerçek tarayıcıda, yalnız klavyeyle. Her listede ilk / orta / son satır: × düğmesine Enter → satır
// silinir; odak başka satırın ×'inde değil ve kaybolmaz (güvenli hedef: aynı konumdaki satırın ilk alanı / ekleme düğmesi); ikinci Enter başka satır
// silmez.
//   A. Fatura formu → Ödeme: üç Nakit satırı (pay-remove).
//   B. Banka → Ayarlar → Masraf Türleri (fee-remove).
//   C. Serbest sayfa (tablo): kolon (delete-col) ve satır (delete-row).
// Eski kodda (d64ebf8): A ve B'de odak kayboluyordu (BODY) — kırmızı; ikinci Enter hiçbir yerde başka satır silmiyordu. C "gerileme nöbeti"dir:
// serbest sayfada × yalnız fareyle görünür; fareyle silip ardından Enter'a basılır (çıktıda yazar). DEPO=<eski kopya> ile koşulur. Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const { okulServisiXlsx } = await import(pathToFileURL(path.join(ROOT, "test", "fixtures", "okul-servisi-ornek.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-gg243-odak-silme-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f45" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
await api.login("admin", PASS);
await api.post("/api/workspace/bank/setup/dismiss", {});

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
// Odaktaki öğe: düğmeyse data-act, alansa etiket + nitelik.
const focused = () => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "BODY";
  if (a.tagName === "BUTTON") return `BUTTON:${a.dataset.act || a.textContent.trim().slice(0, 20)}`;
  return `${a.tagName}:${a.dataset.f || (a.hasAttribute("data-fee-name") ? "fee-name" : "") || a.name || ""}#${a.dataset.i ?? ""}`;
});
const REMOVAL = /^BUTTON:(pay-remove|fee-remove|delete-col|delete-row|line-remove)$/;
// Her satır listesi için: üç satır kur, which'inci satırın ×'ine Enter, denetle, ikinci Enter.
async function three(label, { setup, values, removeSel, safe, mouse = false }) {
  for (const [which, where] of [[0, "ilk"], [1, "orta"], [2, "son"]]) {
    await setup();
    const start = await values();
    if (!ok(start.length === 3, `${label} ${where}: ön koşul üç satır (${JSON.stringify(start)})`)) continue;
    const expected = start.filter((_, index) => index !== which);
    // Serbest sayfada × yalnız fareyle görünür (başlığın üstüne gelince): fareyle tıklanır, sonra klavyeyle Enter (yanlış odak ikinci silme yapmamalı).
    if (mouse) {
      await page.locator(`th:has(${removeSel(which)})`).hover();
      await page.locator(removeSel(which)).click();
    } else {
      await page.locator(removeSel(which)).focus();
      await page.keyboard.press("Enter");
    }
    await sleep(500);
    const after = await focused();
    ok(JSON.stringify(await values()) === JSON.stringify(expected), `${label} ${where}: satır silindi (${JSON.stringify(await values())})`);
    ok(!REMOVAL.test(after), `${label} ${where}: odak başka silme düğmesinde değil (${after})`);
    ok(safe(after, Math.min(which, expected.length - 1)), `${label} ${where}: odak güvenli hedefte, kaybolmadı (${after})`);
    await page.keyboard.press("Enter");
    await sleep(500);
    ok(JSON.stringify(await values()) === JSON.stringify(expected), `${label} ${where}: ikinci Enter başka satırı silmedi (${JSON.stringify(await values())})`);
  }
}

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.invoices?.newFor && window.HOF?.bank?.open && window.HOF?.free?.open);

  console.log("A) Fatura formu → Ödeme satırları (pay-remove)");
  await page.evaluate(() => window.HOF.invoices.newFor({ side: "sale" }));
  await page.locator(".hof-inv-scenario").first().click();
  await page.waitForSelector('[data-pay] [data-act="pay-add-cash"][data-method="cash"]');
  const payValues = () => page.locator('[data-pay] input[data-pay="cash"][data-f="amount"]').evaluateAll(nodes => nodes.map(node => node.value));
  await three("Ödeme", {
    setup: async () => {
      while ((await page.locator('[data-pay] input[data-pay="cash"][data-f="amount"]').count()) < 3) await page.click('[data-pay] [data-act="pay-add-cash"][data-method="cash"]');
      for (let i = 0; i < 3; i += 1) await page.locator(`[data-pay] input[data-pay="cash"][data-i="${i}"][data-f="amount"]`).fill(String((i + 1) * 10));
      await sleep(300);
    },
    values: payValues,
    removeSel: which => `[data-pay] button[data-act="pay-remove"][data-pay="cash"][data-i="${which}"]`,
    safe: (after, position) => after === `INPUT:amount#${position}`,
  });
  await page.keyboard.press("Escape");
  const q = page.locator(".hof-modal-backdrop.is-visible", { hasText: "Kaydedilmemiş Değişiklik" }).locator('[data-answer="yes"]');
  if (await q.waitFor({ timeout: 3000 }).then(() => true, () => false)) await q.last().click();
  await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible"), null, { timeout: 5000 }).catch(() => null);
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.bank?.open && window.HOF?.free?.open);

  console.log("B) Banka → Ayarlar → Masraf Türleri (fee-remove)");
  await page.evaluate(() => window.HOF.bank.open({ tab: "settings" }));
  await page.waitForSelector(".hof-bank-fees [data-fee]");
  const feeValues = () => page.locator(".hof-bank-fees [data-fee] [data-fee-name]").evaluateAll(nodes => nodes.map(node => node.value));
  const baseFees = (await feeValues()).length;
  await three("Masraf Türü", {
    setup: async () => {
      // Listenin SONUNA üç tanınır tür eklenir; denetim yalnız onlar üzerinde.
      for (const box of await page.locator(".hof-bank-fees [data-fee]").all()) if (!(await box.locator("[data-fee-name]").inputValue())) await box.locator('[data-act="fee-remove"]').click();
      while ((await feeValues()).length > baseFees) await page.locator(".hof-bank-fees [data-fee]").last().locator('[data-act="fee-remove"]').click();
      for (let i = 0; i < 3; i += 1) {
        await page.click('.hof-bank-fees [data-act="fee-add"]');
        await page.locator(".hof-bank-fees [data-fee]").last().locator("[data-fee-name]").fill(`Deneme Türü ${i + 1}`);
      }
      await sleep(200);
    },
    values: async () => (await feeValues()).slice(baseFees),
    removeSel: which => `.hof-bank-fees [data-fee]:nth-child(${baseFees + which + 1}) [data-act="fee-remove"]`,
    safe: after => after === "INPUT:fee-name#" || after === "BUTTON:fee-add",
  });
  await page.keyboard.press("Escape");
  const q2 = page.locator(".hof-modal-backdrop.is-visible", { hasText: "Kaydedilmemiş Değişiklik" }).locator('[data-answer="yes"]');
  if (await q2.waitFor({ timeout: 3000 }).then(() => true, () => false)) await q2.last().click();
  await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible"), null, { timeout: 5000 }).catch(() => null);
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.free?.open);

  console.log("C) Serbest sayfa: kolon ve satır silme (gerileme nöbeti — eski kodda da ikinci Enter başka kolon/satır silmiyordu)");
  // Serbest sayfa veri sekmelerinin yanında açılır: önce örnek Excel verisi yüklenir (senaryo-210 düzeni).
  const excel = path.join(root, "okul-servisi.xlsx");
  writeFileSync(excel, okulServisiXlsx());
  await page.waitForSelector("#hof-start .hof-drop input[type=file]", { state: "attached", timeout: 30000 });
  await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(excel);
  await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-mapping", { timeout: 30000 });
  await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click('.hof-modal-backdrop.is-visible [data-mode="replace"]')]);
  await page.evaluate(() => sessionStorage.removeItem("hof-analyze"));
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForSelector(".cases-panel", { timeout: 30000 });
  await page.waitForFunction(() => window.HOF?.free?.open);
  await page.evaluate(() => window.HOF.free.open());
  await page.waitForSelector('[data-pane="blank"] input[name="name"]');
  await page.fill('[data-pane="blank"] input[name="name"]', "Odak Deneme");
  await page.fill('[data-pane="blank"] input[name="columns"]', "3");
  await page.fill('[data-pane="blank"] input[name="rows"]', "3");
  await page.fill('[data-pane="blank"] textarea[name="names"]', "Birinci, İkinci, Üçüncü");
  await page.click('[data-pane="blank"] button[type="submit"]');
  await page.waitForSelector('button[data-act="delete-col"]', { state: "attached", timeout: 15000 });
  const sheetId = await page.evaluate(() => window.HOF.free.activeId());
  const sheet = async () => unwrap(await api.get(`/api/workspace/free/${sheetId}`));
  const colValues = async () => (await sheet()).columns.map(column => column.id);
  await three("Tablo Kolonu", {
    setup: async () => {
      let cols = await colValues();
      while (cols.length < 3) {
        await api.post(`/api/workspace/free/${sheetId}/columns`, { header: `Ek ${cols.length + 1}` });
        cols = await colValues();
      }
      await page.evaluate(() => window.HOF.free.reload());
      await sleep(600);
    },
    values: colValues,
    removeSel: which => `button[data-act="delete-col"][data-c="${which}"]`,
    safe: after => !REMOVAL.test(after),
    mouse: true,
  });
  const rowValues = async () => (await sheet()).rows.map(row => row.id);
  await three("Tablo Satırı", {
    setup: async () => {
      let rows = await rowValues();
      while (rows.length < 3) {
        await api.post(`/api/workspace/free/${sheetId}/rows`, {});
        rows = await rowValues();
      }
      await page.evaluate(() => window.HOF.free.reload());
      await sleep(600);
    },
    values: rowValues,
    removeSel: which => `button[data-act="delete-row"][data-r="${which}"]`,
    safe: after => !REMOVAL.test(after),
    mouse: true,
  });
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  const shot = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "gg243-odak-silme-diger-hata.png");
  await page.screenshot({ path: shot, fullPage: true }).then(() => console.log(`  ekran görüntüsü: ${shot}`), () => null);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} gg243-odak-silme-diger: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
