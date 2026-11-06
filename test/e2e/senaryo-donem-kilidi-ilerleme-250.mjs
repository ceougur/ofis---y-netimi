// 2.5.0 Ç3 TUR 2 — Yönetim → Sistem → Dönem Kilidi ve Mutabakat EKRANDAN (docs/erp/C3-DONDURMA-TASARIM.md §18; plan §8 "1.000.000: hedef ≤ 2 dk, İLERLEME").
// Kilit ucu uzun dondurmayı beklemez: kilit konar, kısa dondurma (küçük şirket) yanıttan önce biter, uzunu (en çok 5 sn beklendikten sonra) sunucuda arkada sürer. Kart:
//   (1) dondurma sürerken "… ve öncesi kilitli. Kilitli dönemin defteri donduruluyor (N satır yazıldı)… Bu sırada çalışmaya devam edebilirsiniz." yazar ve GET .../ledger/lock'u
//       yoklar (büyük şirkette dakikalar; istemcinin 30 sn sınırına takılmaz — önceden "Sunucu zamanında yanıt vermedi");
//   (2) bitince "… ve öncesi kilitli." + "Kilitli dönemin defteri donduruldu." bildirimi; yoklama DURUR (sonraki 4 sn'de yeni istek yok);
//   (3) dondurma düşerse (disk dolu benzetimi) "dondurulamadı (…)" sarı uyarı, yoklama durur; kilit yerinde; yeniden Kilitle → tamamlanır;
//   (4) kancasız (kısa) dondurmada kart hemen temiz, yoklama yok.
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
// Ç3 tur 3: Kilitle düğmesi (pasif mi, nedeni görünür mü) ve kilit isteği (PUT) sayımı; bildirimler DOM'a eklendikçe toplanır (kısa ömürlü bildirim kaçmasın).
const saveState = () => page.evaluate(() => {
  const save = document.querySelector("#adm-period-save");
  const note = document.querySelector("#adm-period-busy");
  return { disabled: save.disabled, title: save.title, note: note && !note.hidden ? note.textContent : "" };
});
const lockPuts = [];
const toastLog = [];
const watchToasts = () => page.evaluate(() => {
  new MutationObserver(list => {
    for (const change of list) for (const node of change.addedNodes) if (node.nodeType === 1) for (const item of [node, ...(node.querySelectorAll?.(".hof-toast") || [])]) if (item.classList?.contains("hof-toast")) window.__toastSeen(item.textContent);
  }).observe(document.body, { childList: true, subtree: true });
});
const openSystem = async () => {
  await page.reload({ waitUntil: "load" });
  await page.click('.adm-tabs [data-tab="system"]');
  await watchToasts();
};
const FREEZE_REASON = "Kilitle, kilitli dönemin defteri dondurulurken kullanılamaz; dondurma bitince açılır.";
const CLEANUP_REASON = "Kilitle, önceki dönemin defter temizliği sürerken kullanılamaz; temizlik bitince açılır.";
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
    if (request.url().includes("/api/admin/period-lock") && request.method() === "PUT") lockPuts.push(Date.now());
  });
  await page.exposeFunction("__toastSeen", text => toastLog.push(text));
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
  // Ç3 tur 3 (YÜKSEK-1, dar kontrol p3 karşılığı): dondurma sürerken Kilitle PASİF, nedeni düğmenin altında görünür; formu göndermek kilit isteği göndermez, nedeni söyler.
  const busy = await saveState();
  ok(busy.disabled === true, `dondurma sürerken Kilitle pasif (${JSON.stringify(busy)})`);
  ok(busy.note === FREEZE_REASON && busy.title === FREEZE_REASON, `pasif düğmenin nedeni görünür: "${busy.note}"`);
  const putsBusy = lockPuts.length;
  await page.evaluate(() => document.querySelector("#adm-period").requestSubmit());
  const reasonToast = await page.waitForFunction(reason => [...document.querySelectorAll(".hof-toast")].some(node => node.textContent.includes(reason)), FREEZE_REASON, { timeout: 5000 }).then(() => true, () => false);
  ok(reasonToast && lockPuts.length === putsBusy, `dondurma sürerken form gönderimi kilit isteği göndermedi (${lockPuts.length - putsBusy} PUT), nedeni bildirildi (${reasonToast})`);
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
  const free = await saveState();
  ok(free.disabled === false && free.note === "" && free.title === "", `bitince Kilitle açık, neden satırı yok (${JSON.stringify(free)})`);
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

  console.log("5) Dondurma sürerken Kilidi Kaldır: 'donduruldu' bildirimi ÇIKMAZ (Ç3 tur 3 DÜŞÜK-1, dar kontrol p2)");
  await must("kilit kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
  await openSystem();
  await page.waitForFunction(() => /Kilitli dönem yok/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 15000 });
  let release5 = null;
  const held5 = new Promise(resolve => {
    release5 = resolve;
  });
  const fallback5 = setTimeout(() => release5(), 20000);
  let batches5 = 0;
  hook.fn = async phase => {
    if (phase === "batch") {
      batches5 += 1;
      await sleep(60);
      if (batches5 >= 4) await held5;
    }
  };
  await page.fill("#adm-period-date", LOCK);
  await page.click("#adm-period-save");
  await page.waitForFunction(() => /donduruluyor/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 15000 });
  const polls5 = lockRequests.length;
  for (let i = 0; i < 100 && lockRequests.length - polls5 < 2; i += 1) await page.waitForTimeout(100);
  ok(lockRequests.length - polls5 >= 2, `ön koşul: kart dondurmayı sürerken yokladı (${lockRequests.length - polls5} istek)`);
  ok((await saveState()).disabled === true, "ön koşul: dondurma sürüyor (Kilitle pasif)");
  const toastsBefore = toastLog.length;
  await page.click("#adm-period-clear");
  await page.waitForSelector('.hof-modal-backdrop.is-visible [data-answer="yes"]', { timeout: 10000 });
  await page.click('.hof-modal-backdrop.is-visible [data-answer="yes"]');
  await page.waitForFunction(() => /^Kilitli dönem yok/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 20000 });
  clearTimeout(fallback5);
  release5();
  hook.fn = null;
  await page.waitForTimeout(4000);
  const after5 = toastLog.slice(toastsBefore);
  ok(after5.some(text => /Dönem kilidi kaldırıldı\./.test(text)), `kaldırma bildirimi: ${JSON.stringify(after5)}`);
  ok(!after5.some(text => /donduruldu/.test(text)), `kilit kaldırılınca "donduruldu" bildirimi çıkmadı: ${JSON.stringify(after5)}`);
  const view5 = await must("kilit", api.get("/api/workspace/ledger/lock"));
  ok(view5.lockedUntil === "" && view5.frozenThrough === "" && view5.freeze.pending === null, `sunucu: kilit yok, kapsam yok, bekleyen yok (${JSON.stringify({ lockedUntil: view5.lockedUntil, frozenThrough: view5.frozenThrough, pending: view5.freeze.pending })})`);

  console.log("6) Kilit geri çekilince temizlik sürerken: kart ilerlemeyi yazar, Kilitle pasif + nedeni (Ç3 tur 3 ORTA-1)");
  await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
  await must("dondurma bitti", api.get("/api/workspace/ledger/lock"));
  for (let i = 0; i < 200 && (await must("kilit", api.get("/api/workspace/ledger/lock"))).freeze.active; i += 1) await sleep(50);
  await openSystem();
  await page.waitForFunction(() => document.querySelector("#adm-period-status")?.textContent === "31.12.2026 ve öncesi kilitli.", null, { timeout: 15000 });
  let release6 = null;
  const held6 = new Promise(resolve => {
    release6 = resolve;
  });
  const fallback6 = setTimeout(() => release6(), 30000);
  hook.fn = async phase => {
    if (phase === "purge") await held6;
  };
  await page.click("#adm-period-clear");
  await page.waitForSelector('.hof-modal-backdrop.is-visible [data-answer="yes"]', { timeout: 10000 });
  await page.click('.hof-modal-backdrop.is-visible [data-answer="yes"]');
  await page.waitForFunction(() => /Önceki dönemin defter temizliği sürüyor \([\d.]+ satır silindi\)…$/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 20000 }).catch(() => null);
  const cleaning = await status();
  ok(/^Kilitli dönem yok; tüm geçmiş tarihlere hareket girilebilir\. Önceki dönemin defter temizliği sürüyor \([\d.]+ satır silindi\)…$/.test(cleaning), `kart: "${cleaning}"`);
  const busy6 = await saveState();
  ok(busy6.disabled === true && busy6.note === CLEANUP_REASON && busy6.title === CLEANUP_REASON, `temizlik sürerken Kilitle pasif, nedeni görünür (${JSON.stringify(busy6)})`);
  await shot("6-temizlik");
  const polls6 = lockRequests.length;
  await page.waitForTimeout(3500);
  ok(lockRequests.length - polls6 >= 2, `kart temizlik sürerken yokluyor (${lockRequests.length - polls6} istek / 3,5 sn)`);
  clearTimeout(fallback6);
  release6();
  hook.fn = null;
  await page.waitForFunction(() => document.querySelector("#adm-period-status")?.textContent === "Kilitli dönem yok; tüm geçmiş tarihlere hareket girilebilir.", null, { timeout: 15000 });
  const free6 = await saveState();
  ok(free6.disabled === false && free6.note === "", `temizlik bitince Kilitle açık (${JSON.stringify(free6)})`);
  await page.fill("#adm-period-date", "2026-06-30");
  await page.click("#adm-period-save");
  await page.waitForFunction(() => document.querySelector("#adm-period-status")?.textContent === "30.06.2026 ve öncesi kilitli.", null, { timeout: 15000 });
  ok((await must("kilit", api.get("/api/workspace/ledger/lock"))).frozenThrough === "2026-06-30", "temizlikten sonra yeniden Kilitle: kapsam 30.06.2026");

  console.log("7) Mutabakat Testi çalışamazsa satır sessizce boşalmaz, neden görünür (Ç3 küçük işler (c))");
  const integrityUrl = url => new URL(url).pathname === "/api/workspace/ledger/integrity";
  await page.route(integrityUrl, route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Test: mutabakat hatası." }) }));
  await openSystem();
  await page.waitForFunction(() => /Mutabakat Testi çalıştırılamadı/.test(document.querySelector("#adm-integrity-status")?.textContent || ""), null, { timeout: 15000 }).catch(() => null);
  const health = await page.textContent("#adm-integrity-status");
  ok(health === "Mutabakat Testi çalıştırılamadı: Test: mutabakat hatası.", `mutabakat satırı: "${health}"`);
  ok(await page.$eval("#adm-integrity-status", node => node.classList.contains("adm-error-text")), "hata rengi");
  await page.unroute(integrityUrl);
  await openSystem();
  await page.waitForFunction(() => /^Mutabakat: /.test(document.querySelector("#adm-integrity-status")?.textContent || ""), null, { timeout: 15000 });
  ok(!(await page.$eval("#adm-integrity-status", node => node.classList.contains("adm-error-text"))), `sunucu düzelince satır normal: "${await page.textContent("#adm-integrity-status")}"`);
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
