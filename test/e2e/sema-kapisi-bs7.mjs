// 2.5.0 BS-7 — EKRANDAN: veri dosyası programın daha yeni bir sürümüyle açılmış şirket (002) ekranda görünür bir şeritle "yalnız görüntülenir" der; kayıt
// denemesi sunucuda 409 SCHEMA_AHEAD ile reddedilir, şerit kalır ve veri değişmez; 001'de şerit yok. "Yeni sürüm" benzetimi: 002'nin user_version'ı
// LATEST_VERSION + 1 (sunucu kapalıyken). Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { chromium } from "playwright";
import { resolveDbPath } from "../../server/lib/db-path.mjs";
import { LATEST_VERSION } from "../../server/lib/migrations.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";

const MESSAGE = "Bu şirketin verisi programın daha yeni bir sürümüyle açılmış. Programı güncelleyin; o zamana kadar veri yalnız görüntülenir.";
const root = mkdtempSync(path.join(tmpdir(), "sema-kapisi-bs7-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn" };
const today = new Date().toISOString().slice(0, 10);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const cashCount = file => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("SELECT COUNT(*) AS n FROM cash_entries").get().n;
  } finally {
    db.close();
  }
};

let server = null;
const browser = await chromium.launch();
const errors = [];
try {
  console.log("\n■ Hazırlık: 001 ve 002 programın kendi API'siyle; 002'nin şeması 'yeni sürüm' benzetimiyle büyütülür");
  server = await bootVersion(CURRENT, dirs);
  let admin = await server.login();
  const second = (await must("002 şirketi", admin.post("/api/companies", { name: "Yeni Sürüm Şirketi", select: true }))).company;
  await must("002 Kasa girişi", admin.post(`/api/workspace/cash?hofCompany=${second.id}`, { kind: "in", amount: 250, date: today, description: "002 girişi" }));
  const secondFile = resolveDbPath(server.app.companies.dirsOf(server.app.companies.get(second.id)).dataDir);
  await server.close();
  const bump = new DatabaseSync(secondFile);
  bump.exec(`PRAGMA user_version = ${LATEST_VERSION + 1}`);
  bump.close();
  const before = cashCount(secondFile);

  server = await bootVersion(CURRENT, dirs);
  admin = await server.login();
  await must("002'yi seç", admin.post("/api/companies/select", { id: second.id }));

  console.log("\n■ 002 penceresi: şerit görünür, okuma çalışır");
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  ok((await page.evaluate(() => window.HOF.companyId)) === second.id, "pencere 002'yi gösteriyor");
  const bar = await page.waitForSelector("#hof-schema-bar", { state: "visible", timeout: 10000 }).then(() => true, () => false);
  ok(bar, "uyarı şeridi görünür");
  const text = bar ? await page.textContent("#hof-schema-bar") : "";
  ok(text.includes("Bu Şirket Yalnız Görüntülenir"), `şerit başlığı (${text.slice(0, 60)})`);
  ok(text.includes(MESSAGE), "şerit Türkçe nedeni söyler");
  ok((await page.getAttribute("#hof-schema-bar", "role")) === "alert", "şerit ekran okuyucuya duyurulur (role=alert)");
  await page.screenshot({ path: path.join(process.env.EKRAN_DIR || root, "sema-kapisi-bs7-002.png") }).catch(() => null);

  console.log("\n■ Kayıt denemesi: sunucu reddeder, veri değişmez");
  const attempt = await page.evaluate(async today => {
    try {
      await window.HOF.api("/api/workspace/cash", { method: "POST", body: { kind: "in", amount: 5, date: today, description: "olmamalı" } });
      return { status: 200 };
    } catch (error) {
      return { status: error.status, code: error.data?.code, message: error.message };
    }
  }, today);
  ok(attempt.status === 409 && attempt.code === "SCHEMA_AHEAD", `kayıt 409 SCHEMA_AHEAD (${JSON.stringify(attempt)})`);
  ok(attempt.message === MESSAGE, "hata iletisi Türkçe neden");
  ok(await page.isVisible("#hof-schema-bar"), "şerit kayıt denemesinden sonra da görünür");
  await context.close();

  console.log("\n■ 001 penceresi: şerit yok");
  await must("001'i seç", admin.post("/api/companies/select", { id: "sirket-001" }));
  const context2 = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  const page2 = await context2.newPage();
  page2.setDefaultTimeout(15000);
  page2.on("pageerror", error => errors.push(error.message));
  await page2.goto(`${server.base}/`);
  await page2.fill("#hof-auth input[name=username]", "admin");
  await page2.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page2.waitForEvent("load"), page2.click('#hof-auth button[type="submit"]')]);
  await page2.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page2.waitForTimeout(800);
  ok((await page2.evaluate(() => window.HOF.companyId)) === "sirket-001", "pencere 001'i gösteriyor");
  ok(!(await page2.isVisible("#hof-schema-bar")), "001'de şerit yok");
  await context2.close();
  await server.close();
  server = null;
  ok(cashCount(secondFile) === before, `002'nin Kasa satırı sayısı değişmedi (${before})`);
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  await browser.close();
  if (server) await server.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${failed ? "✗" : "✓"} sema-kapisi-bs7: ${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
