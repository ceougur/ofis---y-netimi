// Otomatik güncelleme — gerçek tarayıcı sekmesiyle (CI arayüz senaryosu; kullanıcı 10.10.2026: "15 dk boş kalınca gerçekten alıyor mu").
// Gerçek: ayrı süreçte servis yöneticisi + uygulama (test/guncelleme-gercek/hizmet.mjs, bootstrap gibi), yerel sahte yayın kaynağı
// (test imzalı bildirge + gerçek güncelleme paketi; dışarı çıkılmaz), gerçek Chromium sekmesi, gerçek saat.
// KISALTILAN (açıkça): 15 dk boşta → 90 sn; 60 dk yeniden bakış → 10 sn; 6 sa periyodik denetim → 15 sn. 90 sn, açık sekmenin
// istekleri arasındaki en uzun aradan (ölçülen ~45 sn) büyük seçildi ki "açık sekme" gerçekte olduğu gibi meşgul sayılsın.
// Mesai içi zorlanır (mesai dışında kullanıcı çalışırken de kurulur; o yol test/guncelleme-gercek.test.mjs S4'te gerçek saatle).
// Üretim süreleriyle bir kezlik koşu: test/guncelleme-gercek/gercek-kos.mjs.
//  1. Sekme açıkken (personel) yeni sürüm bulunur → kurulmaz, ertelenir; Yönetim → Sistem → Güncellemeler "hazır" (ekran görüntüsü).
//  2. Sekme açık ve görünür kaldıkça (boşta süresinden uzun) kurulmaz: açık sekme düzenli istek gönderir, sunucu meşgul sayılır.
//  3. Sekme kapatılınca istek kesilir → boşta süresi dolunca kurulur. (Yalnız gizlemek yetmez: gizli sekme de 5 dakikada bir
//     tablo eşitlemesi isteği gönderir — test/guncelleme-gercek/gizli-sekme-olcum.mjs.)
//  4. Yeni sürüm sağlıklı, eski veriler aynı, yedek alındı; Yönetim ekranında "güncellendi".
// Çalıştırma: npm run test:guncelleme-gercek
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { ADMIN_PASSWORD, buildTestRelease, counts, prepareInstall, releaseEntry, sleep, STAFF, startFeed, startService, waitFor } from "../guncelleme-gercek/ortak.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "guncelleme-gercek");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const IDLE = 90_000;
const work = mkdtempSync(path.join(tmpdir(), "destekofis-e2e-gunc-"));
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};

// Tarayıcı ile servis arasında istekleri kaydeden ara katman (servis yöneticisinin kuralı: sağlık/keşif dışındaki her istek etkinliktir).
async function startRecorder(target) {
  const port = Number(new URL(target).port);
  const log = [];
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    log.push({ at: Date.now(), path: (req.url || "/").split("?")[0], counts: !/^\/api\/(health|discovery)\b/.test(req.url || "") });
    const upstream = http.request({ host: "127.0.0.1", port, method: req.method, path: req.url, headers: req.headers, agent: false }, response => {
      res.writeHead(response.statusCode || 502, response.headers);
      res.flushHeaders?.();
      response.pipe(res);
      response.on("error", () => res.destroy());
    });
    upstream.on("error", () => (res.headersSent ? res.destroy() : (res.writeHead(502), res.end())));
    res.on("close", () => !res.writableFinished && upstream.destroy());
    req.pipe(upstream);
  });
  server.on("connection", socket => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    log,
    close: () => {
      for (const socket of sockets) socket.destroy();
      return new Promise(resolve => server.close(resolve));
    },
  };
}

async function login(context, base, { username, password }) {
  const page = await context.newPage();
  await page.goto(`${base}/`);
  await page.waitForSelector("#hof-auth input[name=username]", { timeout: 30_000 });
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load", { timeout: 30_000 }), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60_000 });
  return page;
}

const installRoot = path.join(work, "kurulum");
const release = releaseEntry(buildTestRelease(work, "9.0.1"));
const before = await prepareInstall(installRoot);
const feed = await startFeed({ releases: [] });
const service = await startService(installRoot, { feed: feed.url, quiet: "never", retryDelays: [], timings: { idleMs: IDLE, periodicCheckMs: 15_000, periodicJitterMs: 0, deferRecheckMs: 10_000 } });
const recorder = await startRecorder(service.base);
const browser = await chromium.launch();
const errors = [];
try {
  console.log("\n■ 1. Personel sekmesi açık; yeni sürüm yayımlanır → bulunur, kurulmaz, 'hazır'");
  const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  const tab = await login(staffContext, recorder.url, STAFF);
  tab.on("pageerror", error => errors.push(error.message));
  ok((await service.appVersion()) === "9.0.0", "başlangıç sürümü 9.0.0");
  feed.setReleases([release]);
  const deferred = await waitFor(async () => {
    const status = await service.status();
    return status.updates?.deferred ? status : Promise.reject(new Error("ertelenmedi"));
  }, { timeoutMs: 60_000, interval: 500 });
  ok(deferred.updates.deferred.version === "9.0.1", "9.0.1 bulundu ve ertelendi (kullanıcı çalışıyor)");
  ok(deferred.activity.busy === true, "servis yöneticisi sunucuyu meşgul görüyor");
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  const admin = await login(adminContext, recorder.url, { username: "admin", password: ADMIN_PASSWORD });
  await admin.goto(`${recorder.url}/admin.html#system`);
  await admin.waitForSelector("#adm-update-body .adm-update-available", { timeout: 30_000 });
  const panel = (await admin.textContent("#adm-update")).replace(/\s+/g, " ");
  ok(/Yeni sürüm hazır: DestekOfis 9\.0\.1/.test(panel), "Yönetim → Sistem → Güncellemeler: 'Yeni sürüm hazır: DestekOfis 9.0.1'");
  ok(/Kullanıcılar çalışırken bulundu, kurulmadı/.test(panel), "neden ekranda: kullanıcılar çalışırken bulundu");
  ok(await admin.isVisible("#adm-update-apply"), "Şimdi Güncelle düğmesi görünür");
  await admin.locator("#adm-update").screenshot({ path: path.join(OUT, "01-hazir-yonetim-sistem.png") });
  await adminContext.close();

  console.log(`\n■ 2. Sekme açık ve görünür kalır (${(IDLE * 1.7) / 1000} sn > boşta süresi ${IDLE / 1000} sn) → kurulmaz`);
  const openFrom = Date.now();
  const checksBefore = feed.listHits();
  await sleep(IDLE * 1.7);
  const openLog = recorder.log.filter(item => item.counts && item.at >= openFrom);
  const gaps = openLog.slice(1).map((item, index) => item.at - openLog[index].at);
  const maxGap = gaps.length ? Math.max(...gaps) : Infinity;
  ok(openLog.length >= 3, `açık sekme kendiliğinden istek gönderdi (${openLog.length} istek: ${[...new Set(openLog.map(item => item.path))].join(", ")})`);
  ok(maxGap < IDLE, `açık sekmenin istekleri arasındaki en uzun ara ${Math.round(maxGap / 1000)} sn < ${IDLE / 1000} sn`);
  ok(feed.listHits() - checksBefore >= 5, `bu sürede denetim/yeniden bakış sürdü (${feed.listHits() - checksBefore} sorgu)`);
  ok((await service.appVersion()) === "9.0.0", "açık sekme varken kurulmadı");
  ok(feed.zipHits() === 0, "paket indirilmedi");
  const mid = await service.status();
  ok(mid.activity.busy === true && mid.updates.deferred?.version === "9.0.1", "hâlâ meşgul ve 'hazır' bekliyor");
  await tab.screenshot({ path: path.join(OUT, "02-personel-acik-sekme.png") });

  // Not: sekmeyi yalnız GİZLEMEK (arka plan / küçültme) yetmez — gizli sekme de tablo eşitlemesi için 5 dakikada bir istek gönderir
  // (ölçüm: test/guncelleme-gercek/gizli-sekme-olcum.mjs, 20 dk'da 8 istek). Bu yüzden burada sekme KAPATILIR.
  console.log("\n■ 3. Sekme kapatılır → istek kesilir → boşta süresi dolunca kendiliğinden kurulur");
  await staffContext.close();
  const hiddenAt = Date.now();
  let lastSeen = Date.parse(mid.activity.lastActivityAt);
  const installed = await waitFor(async () => {
    const status = await service.status();
    if (status.version === "9.0.0" && status.updates?.state === "idle" && status.activity.lastActivityAt) lastSeen = Date.parse(status.activity.lastActivityAt);
    return status.updates?.lastResult?.outcome === "success" ? status : Promise.reject(new Error(status.updates?.state));
  }, { timeoutMs: IDLE * 3, interval: 1000 });
  const installedAt = Date.parse(installed.updates.lastResult.at);
  const hiddenRequests = recorder.log.filter(item => item.counts && item.at > hiddenAt + 2_000 && item.at < installedAt - 30_000);
  ok(hiddenRequests.length === 0, `sekme kapandıktan sonra istek yok (${hiddenRequests.map(item => item.path).join(", ") || "yok"})`);
  ok(installedAt - lastSeen >= IDLE, `son kullanıcı isteğinden ${Math.round((installedAt - lastSeen) / 1000)} sn sonra kuruldu (≥ ${IDLE / 1000} sn)`);
  ok(installedAt - lastSeen < IDLE + 60_000, `boşta süresi dolduktan sonra yeniden bakışta kuruldu (${Math.round((installedAt - lastSeen - IDLE) / 1000)} sn gecikme)`);
  console.log(`  · sekme kapanışından kuruluma ${Math.round((installedAt - hiddenAt) / 1000)} sn`);

  console.log("\n■ 4. Yeni sürüm sağlıklı, veriler aynı, yedek alındı");
  ok((await service.appVersion()) === "9.0.1", "çalışan sürüm 9.0.1");
  ok(JSON.stringify(counts(installRoot)) === JSON.stringify(before), `kullanıcı/cari/Kasa sayıları ve Kasa toplamı aynı (${JSON.stringify(counts(installRoot))})`);
  ok(readdirSync(path.join(installRoot, "backups", "001 - Şirket 1")).some(file => /guncelleme-oncesi-9-0-0/.test(file)), "güncelleme öncesi yedek alındı");
  const adminAfter = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  const adminPage = await login(adminAfter, recorder.url, { username: "admin", password: ADMIN_PASSWORD });
  await adminPage.goto(`${recorder.url}/admin.html#system`);
  await adminPage.waitForSelector("#adm-update-body .adm-update-ok", { timeout: 30_000 });
  ok(/9\.0\.1 sürümüne güncellendi/.test(await adminPage.textContent("#adm-update")), "Yönetim → Sistem: '9.0.1 sürümüne güncellendi'");
  await adminPage.locator("#adm-update").screenshot({ path: path.join(OUT, "03-guncellendi-yonetim-sistem.png") });
  await adminAfter.close();
  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`✗ senaryo durdu: ${error.stack || error.message}`);
  console.log(service.log().slice(-4000));
} finally {
  await browser.close();
  await service.stop();
  await recorder.close();
  await feed.close();
  rmSync(work, { recursive: true, force: true });
}
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız.`);
process.exitCode = failed ? 1 : 0;
