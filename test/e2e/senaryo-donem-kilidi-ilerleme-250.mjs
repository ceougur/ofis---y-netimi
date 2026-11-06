// 2.5.0 Ç3 TUR 2 — Yönetim → Sistem → Dönem Kilidi ve Mutabakat EKRANDAN (docs/erp/C3-DONDURMA-TASARIM.md §18; plan §8 "1.000.000: hedef ≤ 2 dk, İLERLEME").
// Kilit ucu artık dondurmanın bitmesini beklemez: Kilitle'ye basınca kilit hemen konur, kilitli dönemin defteri sunucuda arkada donar. Kart:
//   (1) dondurma sürerken "… ve öncesi kilitli. Kilitli dönemin defteri donduruluyor (N satır yazıldı)… Bu sırada çalışmaya devam edebilirsiniz." yazar ve GET .../ledger/lock'u
//       yoklar (büyük şirkette dakikalar; istemcinin 30 sn sınırına takılmaz — önceden "Sunucu zamanında yanıt vermedi");
//   (2) bitince "… ve öncesi kilitli." + "Kilitli dönemin defteri donduruldu." bildirimi; yoklama DURUR (sonraki 4 sn'de yeni istek yok);
//   (3) dondurma düşerse (disk dolu benzetimi) "dondurulamadı (…)" sarı uyarı, yoklama durur; kilit yerinde; yeniden Kilitle → tamamlanır;
//   (4) küçük şirkette (dondurma kısa) "donduruldu" bildirimi ÇIKMAZ (yalnız kaydetme bildirimi).
// Dondurmayı uzatmak / düşürmek için YALNIZ TEST kancası (__testFreezeHook; ürün davranışı değişmez). Saat sahte ve sabit (ders 13). Lisans servisi yok (ders 30).
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/senaryo-donem-kilidi-ilerleme-250.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, installPageClock } from "../helpers.mjs";
import { createClock } from "../../server/lib/clock.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-donem-kilidi-ilerleme-250-"));
const shots = process.env.EKRAN_DIR || root;
const TODAY = "2027-01-10";
const LOCK = "2026-12-31";
const clock = createClock({ time: `${TODAY}T10:00:00+03:00`, fixed: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const hook = { fn: null };
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: clock, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, __testFreezeHook: hook, freezeBatchLines: 5 });
const api = await server.login();
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
let page = null;
const shot = name => page?.screenshot({ path: path.join(shots, `donem-kilidi-ilerleme-250-${name}.png`), fullPage: true }).catch(() => null);
const status = () => page.textContent("#adm-period-status");
const lockRequests = [];
const browser = await chromium.launch();
try {
  // Veri programın API'sinden: 2026'ya yayılmış Kasa girişleri (dondurma birkaç parça sürsün).
  for (let i = 1; i <= 30; i += 1) await must(`kasa ${i}`, api.post("/api/workspace/cash", { kind: "in", amount: String(20 + i), date: `2026-${String(1 + (i % 12)).padStart(2, "0")}-1${i % 9}`, description: `Giriş ${i}` }));
  const context = await browser.newContext({ locale: "tr-TR", viewport: { width: 1360, height: 900 } });
  page = await context.newPage();
  await installPageClock(page, clock);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.url().includes("/api/workspace/ledger/lock")) lockRequests.push(Date.now());
  });
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.goto(`${server.base}/admin.html#system`, { waitUntil: "load" });
  await page.click('.adm-tabs [data-tab="system"]');
  await page.waitForFunction(() => /Kilitli dönem yok/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 15000 });

  console.log("1) Dondurma sürerken: kilit hemen kondu, kart ilerlemeyi yazar ve yoklar");
  let release = null;
  const held = new Promise(resolve => {
    release = resolve;
  });
  const fallback = setTimeout(() => release(), 20000);
  hook.fn = async phase => {
    if (phase === "batch") await sleep(60);
    if (phase === "before-done") await held;
  };
  await page.fill("#adm-period-date", LOCK);
  const started = Date.now();
  await page.click("#adm-period-save");
  await page.waitForFunction(() => /31\.12\.2026 ve öncesi kilitli/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 15000 });
  ok(Date.now() - started < 10000, `kilit dondurma bitmeden göründü (${Date.now() - started} ms)`);
  ok((await must("kilit", api.get("/api/workspace/ledger/lock"))).lockedUntil === LOCK, "sunucuda kilit 31.12.2026");
  await page.waitForFunction(() => /donduruluyor \([\d.]+ satır yazıldı\)… Bu sırada çalışmaya devam edebilirsiniz\./.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 15000 });
  const during = await status();
  ok(/^31\.12\.2026 ve öncesi kilitli\. Kilitli dönemin defteri donduruluyor \([\d.]+ satır yazıldı\)… Bu sırada çalışmaya devam edebilirsiniz\.$/.test(during), `kart: "${during}"`);
  ok(!(await page.$eval("#adm-period-status", node => node.classList.contains("adm-warn-text"))), "sürerken uyarı rengi yok");
  await shot("1-donduruluyor");
  const pollsBefore = lockRequests.length;
  await page.waitForTimeout(3500);
  ok(lockRequests.length - pollsBefore >= 2, `kart dondurma sürerken yokluyor (${lockRequests.length - pollsBefore} istek / 3,5 sn)`);
  ok(lockRequests.length - pollsBefore <= 4, `yoklama seyrek (${lockRequests.length - pollsBefore} istek / 3,5 sn; ≤ 4)`);
  // Bu sırada çalışma sürer: açık döneme Kasa hareketi ekrandan değil API'den (aynı oturum), kilitli döneme 409.
  ok((await api.post("/api/workspace/cash", { kind: "in", amount: "5", date: "2027-01-08", description: "Açık dönem" })).status === 200, "dondurma sürerken açık döneme yazım 200");
  const lockedWrite = await api.post("/api/workspace/cash", { kind: "in", amount: "5", date: "2026-12-30", description: "Kilitli" });
  ok(lockedWrite.status === 409 && lockedWrite.data.code === "period-locked", `dondurma sürerken kilitli döneme yazım 409 (${lockedWrite.status})`);

  console.log("2) Bitince: kart temiz, bildirim, yoklama durur");
  clearTimeout(fallback);
  release();
  hook.fn = null;
  await page.waitForFunction(() => document.querySelector("#adm-period-status")?.textContent === "31.12.2026 ve öncesi kilitli.", null, { timeout: 15000 });
  ok(true, `kart: "${await status()}"`);
  await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => /Kilitli dönemin defteri donduruldu\./.test(node.textContent)), null, { timeout: 8000 });
  ok(true, "bildirim: Kilitli dönemin defteri donduruldu.");
  await shot("2-donduruldu");
  const view = await must("kilit", api.get("/api/workspace/ledger/lock"));
  ok(view.frozenThrough === LOCK && view.freeze.pending === null && view.freeze.active === false, `sunucu: kapsam ${view.frozenThrough}, bekleyen yok, süren iş yok`);
  const pollsDone = lockRequests.length;
  await page.waitForTimeout(4000);
  ok(lockRequests.length === pollsDone, `bitince yoklama durdu (sonraki 4 sn'de ${lockRequests.length - pollsDone} istek)`);

  console.log("3) Dondurma düşerse: sarı uyarı, yoklama durur, kilit yerinde; yeniden Kilitle tamamlar");
  await must("kilit kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
  await page.reload({ waitUntil: "load" });
  await page.click('.adm-tabs [data-tab="system"]');
  await page.waitForFunction(() => /Kilitli dönem yok/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 15000 });
  hook.fn = phase => {
    if (phase === "before-done") throw new Error("database or disk is full (test)");
  };
  await page.fill("#adm-period-date", LOCK);
  await page.click("#adm-period-save");
  await page.waitForFunction(() => /dondurulamadı/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 15000 });
  const failedText = await status();
  ok(/^31\.12\.2026 ve öncesi kilitli\. Kilitli dönemin defteri dondurulamadı \(Disk dolu: database or disk is full \(test\)\)\. Kilit yerinde; kilidi yeniden kaydedin ya da programı yeniden açın, dondurma yeniden denenir\.$/.test(failedText), `kart: "${failedText}"`);
  ok(await page.$eval("#adm-period-status", node => node.classList.contains("adm-warn-text")), "uyarı rengi (sarı)");
  await shot("3-dondurulamadi");
  const pollsFail = lockRequests.length;
  await page.waitForTimeout(3500);
  ok(lockRequests.length === pollsFail, `hata görününce yoklama durdu (${lockRequests.length - pollsFail} istek / 3,5 sn)`);
  ok((await must("kilit", api.get("/api/workspace/ledger/lock"))).lockedUntil === LOCK, "kilit yerinde");
  hook.fn = null;
  await page.click("#adm-period-save");
  await page.waitForFunction(() => document.querySelector("#adm-period-status")?.textContent === "31.12.2026 ve öncesi kilitli.", null, { timeout: 15000 });
  ok(!(await page.$eval("#adm-period-status", node => node.classList.contains("adm-warn-text"))), "yeniden Kilitle → tamamlandı, uyarı kalktı");
  ok((await must("kilit", api.get("/api/workspace/ledger/lock"))).frozenThrough === LOCK, "sunucuda kapsam = kilit");

  console.log("4) Kancasız (kısa) dondurma: kaydetme bildirimi, kart temiz, yoklama durur");
  await must("kilit kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
  await page.reload({ waitUntil: "load" });
  await page.click('.adm-tabs [data-tab="system"]');
  await page.waitForFunction(() => /Kilitli dönem yok/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 15000 });
  await page.fill("#adm-period-date", "2026-06-30");
  await page.click("#adm-period-save");
  await page.waitForFunction(() => document.querySelector("#adm-period-status")?.textContent === "30.06.2026 ve öncesi kilitli.", null, { timeout: 15000 });
  const toasts = await page.$$eval(".hof-toast", nodes => nodes.map(node => node.textContent));
  ok(toasts.some(text => /30\.06\.2026 ve öncesi kilitlendi\./.test(text)), `kaydetme bildirimi: ${JSON.stringify(toasts)}`);
  // "donduruldu" bildirimi yalnız bir yoklama dondurmayı SÜRERKEN gördüyse çıkar (kısa dondurmada çoğunlukla çıkmaz; zamanlamaya bağlı olduğu için burada denetlenmez — ders 20).
  const pollsShort = lockRequests.length;
  await page.waitForTimeout(3500);
  ok(lockRequests.length === pollsShort, `kısa dondurmadan sonra yoklama yok (${lockRequests.length - pollsShort} istek / 3,5 sn)`);
  ok((await must("kilit", api.get("/api/workspace/ledger/lock"))).frozenThrough === "2026-06-30", "sunucuda kapsam 30.06.2026");
  ok(errors.length === 0, `sayfa hatası yok (${errors.join(" | ") || "—"})`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ HATA: ${error.stack || error.message}`);
  await shot("hata");
} finally {
  hook.fn = null;
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
console.log(`\nsenaryo-donem-kilidi-ilerleme-250: ${passed} geçti, ${failed} kaldı`);
console.log(`\n# tests ${passed + failed}\n# pass ${passed}\n# fail ${failed}`);
process.exit(failed ? 1 : 0);
