// Gözden geçirme 2.4.3 (gg243 #4, DÜŞÜK–ORTA — A10 yan etkisi): yeniden çizimde odaktaki düğme "aynı anahtarlı" düğmeye taşınıyordu; anahtar
// yalnız data-act olduğundan satır düğmelerinde odak BAŞKA satırın aynı düğmesine geçiyordu: fatura 3 kalem, 3. kalemin ×'ine Enter → odak 1. kalemin
// ×'i, ikinci Enter 1. kalemi siliyordu. Artık anahtar satırı ayırt eden bütün data-* nitelikleriyle eşleşir; aynı öğe yoksa başka satırın düğmesine
// odak verilmez. GERÇEK tarayıcıda, yalnız klavyeyle:
//  A. Fatura formu (3 kalem): 3. kalemin ⋯ düğmesine Enter → odak yine 3. kalemin ⋯'inde; 3. kalemin ×'ine Enter → odak başka kalemin ×'inde DEĞİL;
//     ikinci Enter başka kalem silmez (kalan: Kalem 1, Kalem 2).
//  B. Banka → Hareketler → Planlı İşlemler (3 aylık plan): 3. satırın "Atla"sına Enter → odak başka planın düğmesinde değil; ikinci Enter öbür
//     planları atlatmaz (sunucudan tarihleri okunur).
// Eski kodda (52bacd3) A ve B kırmızıdır; DEPO=<eski kopya> ile koşulur. Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-gg243-odak-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f45" }, startLicenseTimers: false });
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
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
const ziraat = await must("hesap", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
const plans = [];
for (const [day, description] of [["2026-10-20", "Kira"], ["2026-10-21", "Aidat"], ["2026-10-22", "Abonelik"]]) plans.push(await must("plan", api.post("/api/workspace/bank/plans", { kind: "other_out", accountId: ziraat.id, amount: "100", plannedDate: day, repeat: "monthly", description })));

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
// Odaktaki öğe: düğmeyse data-act + satırı ayırt eden nitelik (data-l / data-plan).
const focused = () => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "BODY";
  return a.tagName === "BUTTON" ? `${a.dataset.act || "?"}#${a.dataset.l ?? a.dataset.plan ?? ""}` : a.tagName;
});

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.invoices?.newFor);

  console.log("A) fatura formu, 3 kalem, klavyeyle satır düğmeleri");
  await page.evaluate(() => window.HOF.invoices.newFor({ side: "sale" }));
  await page.locator(".hof-inv-scenario").first().click();
  await page.waitForSelector('[data-lines] input[data-f="name"]');
  for (let i = 0; i < 3; i += 1) {
    if ((await page.locator('[data-lines] input[data-f="name"]').count()) <= i) await page.click('[data-act="add-line"]');
    await page.locator('[data-lines] input[data-f="name"]').nth(i).fill(`Kalem ${i + 1}`);
  }
  await sleep(300);
  const names = () => page.locator('[data-lines] input[data-f="name"]').evaluateAll(nodes => nodes.map(node => node.value));
  await page.locator('[data-lines] button[data-act="line-more"][data-l="2"]').focus();
  await page.keyboard.press("Enter");
  await sleep(300);
  const afterMore = await focused();
  ok(afterMore === "line-more#2", `3. kalemin ⋯'ine Enter → odak aynı düğmede (${afterMore})`);
  await page.locator('[data-lines] button[data-act="line-remove"][data-l="2"]').focus();
  await page.keyboard.press("Enter");
  await sleep(300);
  const afterRemove = await focused();
  ok(!/^line-remove#[01]$/.test(afterRemove), `3. kalemin ×'ine Enter → odak başka kalemin ×'inde değil (${afterRemove})`);
  ok(JSON.stringify(await names()) === JSON.stringify(["Kalem 1", "Kalem 2"]), `3. kalem silindi (${JSON.stringify(await names())})`);
  await page.keyboard.press("Enter");
  await sleep(300);
  ok(JSON.stringify(await names()) === JSON.stringify(["Kalem 1", "Kalem 2"]), `ikinci Enter başka kalemi silmedi (${JSON.stringify(await names())})`);
  // Formu kapat (kaydetmeden): soru görünür olana kadar beklenir (açılış canlandırması; hemen sayılınca 0 çıkıp ikinci Esc soruyu "Forma Dön"
  // ile kapatıyordu), sonra B için sayfa yeniden yüklenir (temiz başlangıç).
  await page.keyboard.press("Escape");
  const q = page.locator(".hof-modal-backdrop.is-visible", { hasText: "Kaydedilmemiş Değişiklik" }).locator('[data-answer="yes"]');
  if (await q.waitFor({ timeout: 3000 }).then(() => true, () => false)) await q.last().click();
  await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible"), null, { timeout: 5000 }).catch(() => null);
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });

  console.log("B) Banka → Hareketler → Planlı İşlemler, 3. planın Atla düğmesine Enter");
  const bankWin = ".hof-bank-modal";
  ok((await page.locator(".hof-modal-backdrop.is-visible").count()) === 0, "ön koşul: fatura penceresi kapandı");
  await page.click('#hof-sidecard [data-action="bank"]');
  await page.waitForSelector(`${bankWin} .hof-bank-tabs`);
  await page.click(`${bankWin} .hof-bank-tabs [data-tab="movements"]`);
  await page.waitForSelector(`${bankWin} [data-act="mv-planned"]`);
  await page.click(`${bankWin} [data-act="mv-planned"]`);
  await page.waitForSelector(`${bankWin} button[data-act="plan-skip"][data-plan="${plans[2].id}"]`);
  const dates = async () => {
    const list = (await must("planlar", api.get("/api/workspace/bank/plans"))).plans || [];
    return plans.map(plan => list.find(item => item.id === plan.id)?.plannedDate || "?");
  };
  ok(JSON.stringify(await dates()) === JSON.stringify(["2026-10-20", "2026-10-21", "2026-10-22"]), "ön koşul: üç plan");
  await page.locator(`${bankWin} button[data-act="plan-skip"][data-plan="${plans[2].id}"]`).focus();
  await page.keyboard.press("Enter");
  const skipped = await page.waitForFunction(() => /sonraki tarih/.test(document.body.innerText), null, { timeout: 8000 }).then(() => true, () => false);
  ok(skipped, "ön koşul: 3. plan atlandı (bildirim)");
  await sleep(800);
  const afterSkip = await focused();
  const others = new Set(plans.slice(0, 2).map(plan => plan.id));
  ok(![...others].some(id => afterSkip.endsWith(`#${id}`)), `odak başka planın düğmesinde değil (${afterSkip.replace(/#.*/, "#…")}${afterSkip.endsWith(`#${plans[2].id}`) ? " aynı plan" : ""})`);
  await page.keyboard.press("Enter");
  await sleep(1200);
  const after = await dates();
  ok(after[0] === "2026-10-20" && after[1] === "2026-10-21", `ikinci Enter öbür planları atlatmadı (${after.join(", ")})`);
  ok(after[2] >= "2026-11-22", `3. plan atlandı (${after[2]})`);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  const shot = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "gg243-odak-dugme-hata.png");
  await page.screenshot({ path: shot, fullPage: true }).then(() => console.log(`  ekran görüntüsü: ${shot}`), () => null);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} gg243-odak-dugme: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
