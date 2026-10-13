// Senaryo İz 1.3 (2.2.0 iş listesi; K6 "KASA-ACILIS-649"), arayüzden, gerçek tıklama ve klavyeyle:
//   Yönetici Kasa → Açılış Bakiyesi'nden devreden nakdi girer (insan hızında yazım) → Kasa'da "Açılış Bakiyesi · Kasa açılışı (devreden nakit)"
//   satırı ve Nakit Kasa; Ana Defter'de B 100 / A 500 (649'a gelir yazılmaz); satırdaki ✎ ile "Kasa Açılış Bakiyesini Düzelt" (dolu gelir) →
//   düzeltme aynı satırı değiştirir (ikinci açılış yok). Açılış tarihi Kasa'nın ilk hareketinden sonra girilemez (ekranda neden). Muhasebe
//   kullanıcısı (Kasa yetkili, yönetici değil): Açılış Bakiyesi düğmesi yok, açılış satırında düzelt/sil yok.
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/senaryo-iz1-kasa-acilis.mjs
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient } from "../helpers.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-iz1-kasa-acilis");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const STAFF_PASS = "Muhasebe-Prova-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-iz1k-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "error", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f27" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const pad = value => String(value).padStart(2, "0");
const day = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dmy = iso => iso.split("-").reverse().join(".");

let passed = 0;
let failed = 0;
let shotNo = 0;
const errors = [];
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const modal = ".hof-modal-backdrop.is-visible";
// Kasa penceresi ve form penceresi içeriklerinden seçilir (kapanan pencere DOM'da kalabilir; ":last-of-type" ona düşebilir).
const top = `${modal}:has(.hof-cash-list)`;
const form = `${modal}:has(form input[name="amount"])`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const trial = async () => Object.fromEntries((await must("Ana Defter", api.get("/api/workspace/ledger"))).trial.accounts.map(row => [String(row.code), Math.round(row.balance * 100) / 100]));
const cashBalance = async () => (await must("Kasa", api.get("/api/workspace/cash"))).totals.balance;
const openings = async () => (await must("Kasa", api.get("/api/workspace/cash?method=all"))).entries.filter(entry => entry.opening);

async function windowFor(username, password) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(`${username} pageerror ${error.message}`));
  // Beklenen retler (açılış kuralı 409, girişten önceki oturum yoklaması 401) hata sayılmaz.
  page.on("console", message => {
    if (message.type() === "error" && !/status of 40[19]/.test(message.text())) errors.push(`${username} console ${message.text()}`);
  });
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector('#hof-sidecard [data-action="cash"]', { timeout: 60000 });
  await page.waitForTimeout(800);
  return page;
}
const shot = async (page, name) => {
  shotNo += 1;
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const openCash = async page => {
  await page.click('#hof-sidecard [data-action="cash"]');
  await page.waitForSelector(`${top} [data-list] table, ${top} [data-list] .hof-empty`, { timeout: 15000 });
  await page.waitForTimeout(500);
};
const typeHuman = async (page, selector, value) => {
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type(selector, value, { delay: 60 });
};

try {
  console.log("\n■ Kurulum: yönetici; küçük bir tablo; muhasebe kullanıcısı; Kasa'da 5 gün önce bir tahsilat (ilk hareket)");
  await api.login("admin", PASS);
  const stage = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "Rehber.xlsx", sheets: [{ name: "REHBER", matrix: [["No", "Ad"], ["1", "Ali"], ["2", "Ayşe"]] }] }));
  await must("tablo yükle", api.post("/api/workspace/dataset/commit", { stageId: stage.stageId, mode: "replace" }));
  await must("muhasebe", api.post("/api/admin/users", { username: "muhasebe1", name: "Muhasebe Bir", role: "muhasebe", password: STAFF_PASS, mustChangePassword: false }));
  await must("ilk Kasa hareketi", api.post("/api/workspace/cash", { kind: "in", amount: "1.000", date: day(-5), description: "Danışmanlık ücreti" }));
  ok((await trial())["649"] === -1000, "sıradan Kasa girişi 649'da (gelir)");

  console.log("\n■ Yönetici: Kasa → Açılış Bakiyesi → tutar (klavyeyle) → tarih ilk hareketten SONRA → neden ekranda; ilk hareketin günü → kaydedilir");
  const admin = await windowFor("admin", PASS);
  await openCash(admin);
  const button = await admin.$(`${top} [data-opening]`);
  ok(Boolean(button) && (await button.textContent()).trim() === "Açılış Bakiyesi", "Kasa penceresinde “Açılış Bakiyesi” düğmesi");
  await button.click();
  await admin.waitForSelector(`${form} form input[name="amount"]`);
  const title = await admin.$eval(`${form} .hof-modal-title`, node => node.textContent.trim());
  ok(title === "Kasa Açılış Bakiyesi", `pencere başlığı “${title}”`);
  const intro = await admin.$eval(form, node => node.innerText.replace(/\s+/g, " "));
  ok(intro.includes(`Tarihi Kasa'nın ilk hareketinin günü (${dmy(day(-5))}) ya da öncesi`), "ilk hareketin tarihi yardım metninde");
  ok((await admin.inputValue(`${form} form input[name="date"]`)) === day(-5), "tarih ilk hareketin günüyle dolu gelir");
  await typeHuman(admin, `${form} form input[name="amount"]`, "25.000,00");
  await admin.fill(`${form} form input[name="date"]`, day(-3));
  await shot(admin, "acilis-formu");
  await admin.click(`${form} form button[type="submit"]`);
  await admin.waitForFunction(() => /ilk hareketinden \(/.test(document.querySelector('.hof-modal-backdrop.is-visible:has(form input[name="amount"])')?.innerText || "") || [...document.querySelectorAll(".hof-toast")].some(t => /ilk hareketinden/.test(t.textContent)), null, { timeout: 10000 }).catch(() => {});
  const why = await admin.evaluate(() => `${document.querySelector('.hof-modal-backdrop.is-visible:has(form input[name="amount"])')?.innerText || ""} ${[...document.querySelectorAll(".hof-toast")].map(t => t.textContent).join(" ")}`);
  ok(/Kasa'nın ilk hareketinden \(\d{2}\.\d{2}\.\d{4}\) sonra olamaz/.test(why), "ilk hareketten sonraki tarih reddedildi, neden ekranda");
  ok((await openings()).length === 0, "reddedilen istek açılış yazmadı");
  await admin.fill(`${form} form input[name="date"]`, day(-5));
  await shot(admin, "acilis-formu-dogru-tarih");
  await admin.click(`${form} form button[type="submit"]`);
  await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible form input[name=\"amount\"]"), null, { timeout: 10000 }).catch(() => {});
  await admin.waitForTimeout(800);
  const rowText = await admin.$eval(`${top} [data-list]`, node => node.innerText.replace(/\s+/g, " ")).catch(() => "");
  ok(/Açılış Bakiyesi Kasa açılışı \(devreden nakit\)/.test(rowText), "Kasa'da açılış satırı: “Açılış Bakiyesi · Kasa açılışı (devreden nakit)”");
  ok(/Açılış Bakiyesi.*₺25\.000,00 ₺25\.000,00.*Danışmanlık ücreti.*₺1\.000,00 ₺26\.000,00/.test(rowText), "aynı günde önce açılış (25.000), sonra tahsilat (26.000): yürüyen bakiye açılışla başlar");
  const kpi = await admin.$eval(`${top} .hof-cash-balance strong`, node => node.textContent.trim());
  ok(/26\.000,00/.test(kpi), `Nakit Kasa göstergesi ${kpi} (25.000 + 1.000)`);
  await shot(admin, "kasa-acilis-satiri");
  let t = await trial();
  ok(t["100"] === 26000 && t["500"] === -25000 && t["649"] === -1000, `Ana Defter: 100 = 26.000 · 500 = −25.000 (açılış) · 649 = −1.000 (yalnız gelir) — ${JSON.stringify({ 100: t["100"], 500: t["500"], 649: t["649"] })}`);
  ok((await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"))).ok === true, "Mutabakat Testi tamam");

  console.log("\n■ Yönetici: açılış satırındaki ✎ → “Kasa Açılış Bakiyesini Düzelt” (dolu) → 30.000 → aynı satır düzelir");
  const [opening] = await openings();
  await admin.click(`${top} button[data-edit="${opening.id}"]`);
  await admin.waitForSelector(`${form} form input[name="amount"]`);
  ok((await admin.$eval(`${form} .hof-modal-title`, node => node.textContent.trim())) === "Kasa Açılış Bakiyesini Düzelt", "düzeltme penceresi");
  ok(/25\.000,00/.test(await admin.inputValue(`${form} form input[name="amount"]`)), "tutar dolu geldi");
  await typeHuman(admin, `${form} form input[name="amount"]`, "30.000");
  await admin.keyboard.press("Tab");
  await admin.click(`${form} form button[type="submit"]`);
  await admin.waitForFunction(() => /31\.000,00/.test(document.querySelector(".hof-modal-backdrop.is-visible .hof-cash-balance strong")?.textContent || ""), null, { timeout: 10000 }).catch(() => {});
  ok(/31\.000,00/.test(await admin.$eval(`${top} .hof-cash-balance strong`, node => node.textContent.trim()).catch(() => "")), "Nakit Kasa 31.000 (30.000 + 1.000)");
  const after = await openings();
  ok(after.length === 1 && after[0].id === opening.id && after[0].amount === 30000, "tek açılış satırı, aynı satır düzeldi");
  t = await trial();
  ok(t["500"] === -30000 && t["649"] === -1000, `Ana Defter 500 = −30.000 (${t["500"]})`);
  await shot(admin, "kasa-acilis-duzeltildi");

  console.log("\n■ Muhasebe (Kasa yetkili, yönetici değil): Açılış Bakiyesi düğmesi yok; açılış satırında düzelt/sil yok; sıradan satırlarda var");
  const staff = await windowFor("muhasebe1", STAFF_PASS);
  await openCash(staff);
  ok(!(await staff.$(`${top} [data-opening]`)), "Açılış Bakiyesi düğmesi yok");
  ok(!(await staff.$(`${top} button[data-edit="${opening.id}"]`)) && !(await staff.$(`${top} button[data-delete="${opening.id}"]`)), "açılış satırında ✎ ve × yok");
  ok((await staff.$$(`${top} button[data-edit]`)).length >= 1, "sıradan Kasa satırında ✎ var");
  await shot(staff, "muhasebe-kasa");
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
