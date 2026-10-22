// 2.4.4 iş listesi 29 — EKRANDAN: 002 şirketini gösteren pencere açıkken yönetici kişinin yetkisini değiştirir → 002 ekranı sayfa yenilenmeden
// düğmeyi kaldırır/geri getirir ("Yöneticiniz yetkilerinizi güncelledi" bildirimi). 163dd5d'de olay 001 kanalında kalıyor, 002 penceresi eski
// düğmeleri gösteriyordu (sunucu yine reddediyordu). Denetim: kenar çubuğundaki Kasa (data-requires="cash.view") ve sayfanın yeniden yüklenmediği.
// Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";

const PASS = "Kanal-Personel-2026!";
const root = mkdtempSync(path.join(tmpdir(), "sirket-canli-yetki-"));
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};

// apiOf (surumler.mjs) PATCH vermez; alttaki istemcinin patch'iyle.
const patch = (api, url, body) => api.client.patch(url, body);

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};

const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn" });
const browser = await chromium.launch();
const errors = [];
try {
  const admin = await server.login();
  const second = (await must("002 şirketi", admin.post("/api/companies", { name: "Canlı İkinci Şirket" }))).company;
  await must("personel", admin.post("/api/admin/users", { username: "canlipersonel", name: "Canlı Personel", role: "personel", password: PASS, mustChangePassword: false }));
  const staffId = (await must("kullanıcılar", admin.get("/api/admin/users"))).find(user => user.username === "canlipersonel").id;
  await must("şirket yetkisi", admin.put(`/api/companies/access/${staffId}`, { companies: ["sirket-001", second.id] }));
  await must("Kasa yetkisi ver", patch(admin, `/api/admin/users/${staffId}`, { grants: { add: ["cash.view"], remove: [] } }));
  const staffApi = await server.login("canlipersonel", PASS);
  await must("002'yi seç", staffApi.post("/api/companies/select", { id: second.id }));

  console.log("\n■ 002 penceresi açık; yönetici Kasa yetkisini kaldırır, sonra geri verir");
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "canlipersonel");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  const companyId = await page.evaluate(() => window.HOF.companyId);
  ok(companyId === second.id, `pencere 002'yi gösteriyor (${companyId})`);
  const cashButton = '#hof-sidecard .hof-side-item[data-action="cash"]';
  ok(await page.isVisible(cashButton), "Kasa düğmesi görünür (yetki var)");
  // Canlı bağlantı kuruldu mu (hello alındı): HOF.live.connected(); bağlantı 002'nin kanalına (?hofCompany=002).
  const live = await page.waitForFunction(() => window.HOF?.live?.connected?.() === true, null, { timeout: 15000 }).then(() => true, () => false);
  ok(live, "canlı bağlantı kuruldu");
  await page.evaluate(() => {
    window.__yuklemeIsareti = "ayni-sayfa";
  });

  await must("Kasa yetkisini kaldır", patch(admin, `/api/admin/users/${staffId}`, { grants: { add: [], remove: [] } }));
  const hidden = await page.waitForSelector(cashButton, { state: "hidden", timeout: 8000 }).then(() => true, () => false);
  ok(hidden, "yetki kaldırılınca 002 ekranında Kasa düğmesi kendiliğinden kalktı");
  const toast = await page.waitForFunction(() => /yetkilerinizi güncelledi/.test(document.body.innerText), null, { timeout: 5000 }).then(() => true, () => false);
  ok(toast, "“Yöneticiniz yetkilerinizi güncelledi” bildirimi göründü");
  ok((await page.evaluate(() => window.__yuklemeIsareti)) === "ayni-sayfa", "sayfa yeniden yüklenmedi (canlı güncelleme)");

  await must("Kasa yetkisini geri ver", patch(admin, `/api/admin/users/${staffId}`, { grants: { add: ["cash.view"], remove: [] } }));
  const shown = await page.waitForSelector(cashButton, { state: "visible", timeout: 8000 }).then(() => true, () => false);
  ok(hidden && shown, "yetki geri verilince Kasa düğmesi geri geldi (önce kalkmış olmalı)");
  await page.screenshot({ path: path.join(process.env.EKRAN_DIR || root, "sirket-canli-yetki-002.png") }).catch(() => null);
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await context.close();
} catch (error) {
  failed += 1;
  console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${failed ? "✗" : "✓"} sirket-canli-yetki-244: ${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
