// Otomatik güncelleme — ÜRETİM SÜRELERİYLE gerçek koşu (bir kez; kanıt için). Kısaltılmış süre YOK: 15 dk boşta, 60 dk yeniden
// bakış, açılışta ağ yoksa 60 sn sonra yeniden deneme, 6 saatlik periyodik denetim (bu koşuda süresi dolmaz) — hepsi üretim
// değerleri. Gerçek: ayrı süreçte servis yöneticisi + uygulama, gerçek Chromium sekmeleri (Playwright), gerçek saat.
// Tek zorlanan koşul S2'de "mesai içi"dir: koşu günü (10.10.2026) Cumartesi olduğundan gerçek saate göre her an mesai dışıdır;
// mesai içi davranışı (kullanıcı çalışırken kurulmaz) ancak mesai kuralını "hep mesai içi" yaparak gözlenebilir.
//
// Senaryolar (--senaryo s1,s4,s5,s2,s6; varsayılan s1,s4,s5,s2 — s6 ~6,5 saat sürdüğü için yalnız açıkça istenirse):
//  s1  açılışta yeni sürüm → kimse kullanmıyor → kurulur (gerçek saat).
//  s4  mesai dışı saat dilimi (TZ) + açık sekme (kullanıcı etkin) → yine de kurulur.
//  s5  kendiliğinden kur kapalı → açılışta bulunur, "hazır" görünür, 3 dk beklenir kurulmaz → ekrandan Şimdi Güncelle → kurulur.
//  s2  dört servis birlikte (her biri ayrı kurulum kökü): açılışta internet yok → 60 sn sonra yeniden denemede sürüm, sekme açıkken
//      bulunur → ertelenir. A: sekme açık kalır (60. dk'da kurulmamalı), 62. dk'da kapanır; B: sekme 3. dk'da kapanır; C: sekme
//      50. dk'da kapanır (60. dk'da boşta süresi 10 dk < 15 dk); D: sekme 3. dk'dan sonra GİZLİ (sayfanın görünürlük bilgisi
//      sayfa içinden taklit edilir — bu ortamda gerçek pencere küçültme yok). Kurulum anları ölçülür. D'de beklenen (ölçüm,
//      gizli-sekme-olcum.mjs): gizli sekme 5 dk'da bir tablo eşitlemesi isteği gönderdiği için sunucu hiç 15 dk boş kalmaz →
//      mesai içinde KURULMAZ (ürün davranışı; karar ana oturumda).
//  s6  6 saatlik periyodik denetim, ÜRETİM süresiyle (6 sa + 0–30 dk rastgele kayma; kısaltma yok): iki servis (kendiliğinden
//      kur AÇIK ve KAPALI), kimse bağlı değil. Açılışta kaynakta yeni sürüm YOK; açılış denetimi bitince 9.0.1 yayımlanır →
//      sonraki sorgu yalnız 6 saatlik zamanlayıcıdan gelebilir. Açıkta kurulur; kapalıda "hazır" görünür, kurulmaz.
// Çıktı: docs/kanit/2026-10-10/otomatik-guncelleme/gercek/<senaryo>/ (sonuc.json, servis.log, istekler.json, ekran görüntüleri).
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { ADMIN_PASSWORD, buildTestRelease, counts, HERE, prepareInstall, quietZoneNow, releaseEntry, sleep, STAFF, stamp, startFeed, startService, waitFor, writeJson } from "./ortak.mjs";

const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(ROOT, "docs", "kanit", "2026-10-10", "otomatik-guncelleme", "gercek");
const argOf = name => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const wanted = (argOf("--senaryo") || "s1,s4,s5,s2").split(",");
const work = mkdtempSync(path.join(tmpdir(), "destekofis-gercek-kos-"));
const release = releaseEntry(buildTestRelease(work, "9.0.1"));
const MIN = 60_000;
const minutesSince = (from, to = Date.now()) => Math.round(((to - from) / MIN) * 100) / 100;

// Tarayıcı ile servis arasında isteği olduğu gibi ileten, her isteğin zamanını ve yolunu kaydeden ara katman. Servis yöneticisinin
// kuralı: /api/health ve /api/discovery DIŞINDAKİ her istek "kullanıcı etkinliği"dir (son 15 dk'da istek varsa sunucu meşgul).
async function startRecorder(target) {
  const port = Number(new URL(target).port);
  const log = [];
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    const pathname = (req.url || "/").split("?")[0];
    log.push({ at: Date.now(), method: req.method, path: pathname, counts: !/^\/api\/(health|discovery)\b/.test(req.url || ""), sse: String(req.headers.accept || "").includes("text/event-stream") });
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

function gapsOf(log, from, to) {
  const times = log.filter(item => item.counts && item.at >= from && item.at <= to).map(item => item.at);
  const gaps = times.slice(1).map((time, index) => time - times[index]);
  const paths = {};
  for (const item of log.filter(entry => entry.counts && entry.at >= from && entry.at <= to)) paths[item.path] = (paths[item.path] || 0) + 1;
  return { istek: times.length, enUzunAraSn: gaps.length ? Math.round(Math.max(...gaps) / 1000) : null, ortalamaAraSn: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length / 1000) : null, yollar: paths };
}

async function openTab(browser, base, { username, password }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/`);
  await page.waitForSelector("#hof-auth input[name=username]", { timeout: 30_000 });
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load", { timeout: 30_000 }), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60_000 });
  return { context, page, errors };
}

// Sekmeyi gizli yapar: tarayıcının "sekme arka planda / pencere küçültüldü" bildirimini sayfa içinde taklit eder (document.hidden,
// visibilityState + visibilitychange olayı). Program yalnız bu ikisini okur.
const hideTab = page =>
  page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });

async function adminScreens(browser, base, dir, prefix) {
  const { context, page } = await openTab(browser, base, { username: "admin", password: ADMIN_PASSWORD });
  try {
    await page.waitForTimeout(1500);
    // Test servisinde internet yok → lisans denemesi başlamadı uyarısı açılır; ana ekran görünsün diye kapatılır.
    await page.click('.hof-modal-backdrop.is-visible button:has-text("Tamam")', { timeout: 3000 }).catch(() => null);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(dir, `${prefix}-yonetici-ana-ekran.png`) });
    const bell = await page.evaluate(() => document.querySelector(".hof-bell, [data-action='alerts'], #hof-bell")?.textContent?.trim() || null);
    await page.goto(`${base}/admin.html#system`);
    await page.waitForSelector("#adm-update-body .adm-update-available", { timeout: 30_000 });
    const text = await page.textContent("#adm-update");
    await page.locator("#adm-update").screenshot({ path: path.join(dir, `${prefix}-yonetim-sistem-guncellemeler.png`) });
    await page.screenshot({ path: path.join(dir, `${prefix}-yonetim-sistem.png`), fullPage: true });
    return { panelMetni: text.replace(/\s+/g, " ").trim(), zil: bell };
  } finally {
    await context.close();
  }
}

async function setup(name, { config, feed: feedOptions, ...serviceOptions }) {
  const dir = path.join(OUT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const installRoot = path.join(work, name);
  const before = await prepareInstall(installRoot, { config });
  const feed = await startFeed(feedOptions);
  const started = Date.now();
  const service = await startService(installRoot, { feed: feed.url, ...serviceOptions });
  const recorder = await startRecorder(service.base);
  return { name, dir, installRoot, before, feed, service, recorder, started };
}
async function finish(ctx, result) {
  const status = await ctx.service.status().catch(error => ({ error: error.message }));
  await ctx.service.stop();
  await ctx.recorder.close();
  await ctx.feed.close();
  copyFileSync(ctx.service.logFile, path.join(ctx.dir, "servis.log"));
  const full = { senaryo: ctx.name, ...result, sonDurum: status, verilerOnce: ctx.before, verilerSonra: counts(ctx.installRoot), yedekler: listBackups(ctx.installRoot), kaynakIstekleri: ctx.feed.hits };
  writeJson(path.join(ctx.dir, "sonuc.json"), full);
  writeJson(path.join(ctx.dir, "istekler.json"), ctx.recorder.log.map(item => ({ ...item, at: new Date(item.at).toISOString() })));
  console.log(`[${stamp()}] ${ctx.name} bitti: ${JSON.stringify(result.ozet || {})}`);
  return full;
}
const listBackups = installRoot => {
  try {
    return readdirSync(path.join(installRoot, "backups", "001 - Şirket 1"));
  } catch {
    return [];
  }
};
const installedAt = async service => {
  const status = await service.status();
  return status.updates?.lastResult?.outcome === "success" ? Date.parse(status.updates.lastResult.at) : null;
};

const browser = await chromium.launch();
const results = {};
try {
  if (wanted.includes("s1")) {
    // S1: üretim süreleri, gerçek saat (koşu günü Cumartesi → mesai dışı; açılışta zaten kimse bağlı değil).
    const ctx = await setup("s1-acilis", { feed: { releases: [release] } });
    const done = await waitFor(async () => (await installedAt(ctx.service)) || Promise.reject(new Error("kurulmadı")), { timeoutMs: 5 * MIN, interval: 250 });
    results.s1 = await finish(ctx, { ozet: { acilistanKurulumaSn: Math.round((done - ctx.started) / 1000), surum: await ctx.service.appVersion() } });
  }

  if (wanted.includes("s4")) {
    // S4: gerçek saat, mesai dışı saat dilimi; açılışta internet yok → 60 sn sonra (üretim) yeniden denemede bulunur; o anda gerçek
    // bir tarayıcı sekmesi açık ve istek gönderiyor (sunucu meşgul) — mesai dışı olduğu için yine de kurulur.
    const zone = quietZoneNow();
    const ctx = await setup("s4-mesai-disi", { feed: { releases: [release], down: true }, tz: zone.tz });
    const tab = await openTab(browser, ctx.recorder.url, STAFF);
    ctx.feed.setDown(false);
    const done = await waitFor(async () => (await installedAt(ctx.service)) || Promise.reject(new Error("kurulmadı")), { timeoutMs: 5 * MIN, interval: 500 });
    const lastRequest = Math.max(...ctx.recorder.log.filter(item => item.counts && item.at < done).map(item => item.at));
    await tab.context.close();
    results.s4 = await finish(ctx, { ozet: { saatDilimi: zone.tz, servisYerelSaat: ctx.service.hello.localTime, mesaiDisi: ctx.service.hello.quietNow, kurulumdanOnceSonIstekSn: Math.round((done - lastRequest) / 1000), acilistanKurulumaSn: Math.round((done - ctx.started) / 1000), surum: await ctx.service.appVersion() }, sekmeIstekleri: gapsOf(ctx.recorder.log, ctx.started, done) });
  }

  if (wanted.includes("s5")) {
    // S5: kendiliğinden kur kapalı; üretim süreleri; gerçek saat (mesai dışı) — kapalıyken boşta/mesai dışında da kurulmamalı.
    const ctx = await setup("s5-kapali", { config: { enabled: false }, feed: { releases: [release] } });
    await waitFor(async () => ((await ctx.service.status()).updates?.available ? true : Promise.reject(new Error("bulunmadı"))), { timeoutMs: 2 * MIN });
    const foundAt = Date.now();
    await sleep(3 * MIN);
    const stillOld = await ctx.service.appVersion();
    const zipBefore = ctx.feed.zipHits();
    const screens = await adminScreens(browser, ctx.recorder.url, ctx.dir, "1-hazir");
    // Ekrandan Şimdi Güncelle.
    const { context, page } = await openTab(browser, ctx.recorder.url, { username: "admin", password: ADMIN_PASSWORD });
    await page.goto(`${ctx.recorder.url}/admin.html#system`);
    await page.waitForSelector("#adm-update-apply:not([hidden])", { timeout: 30_000 });
    await page.click("#adm-update-apply");
    await page.click('.hof-modal-backdrop.is-visible [data-answer="yes"]');
    const clickedAt = Date.now();
    const done = await waitFor(async () => (await installedAt(ctx.service)) || Promise.reject(new Error("kurulmadı")), { timeoutMs: 5 * MIN, interval: 500 });
    await page.waitForTimeout(8000);
    await page.goto(`${ctx.recorder.url}/admin.html#system`).catch(() => null);
    await page.waitForSelector("#adm-update-body .adm-update-ok", { timeout: 60_000 }).catch(() => null);
    await page.locator("#adm-update").screenshot({ path: path.join(ctx.dir, "2-kuruldu-yonetim-sistem-guncellemeler.png") }).catch(() => null);
    await context.close();
    results.s5 = await finish(ctx, { ozet: { bulunmaSonrasi3DkSurum: stillOld, ucDkIcindePaketIndirme: zipBefore, simdiGuncelleTiklamadanKurulumaSn: Math.round((done - clickedAt) / 1000), surum: await ctx.service.appVersion(), bulunmaAni: new Date(foundAt).toISOString() }, ekran: screens });
  }

  if (wanted.includes("s6")) {
    // S6: 6 saatlik periyodik denetim — üretim süresi, gerçek saat, kimse bağlı değil.
    const H = 60 * MIN;
    const runs = [];
    for (const plan of [{ name: "s6-6sa-kur-acik" }, { name: "s6-6sa-kur-kapali", config: { enabled: false } }]) {
      const ctx = await setup(plan.name, { config: plan.config, feed: { releases: [] } });
      // Açılış denetimi (kaynakta yeni sürüm yok) bitsin; sonra 9.0.1 yayımlanır.
      const status = await waitFor(async () => {
        const value = await ctx.service.status();
        return ctx.feed.listHits() >= 1 && value.updates?.state === "idle" && value.updates?.lastCheck ? value : Promise.reject(new Error("açılış denetimi bitmedi"));
      }, { timeoutMs: 5 * MIN, interval: 500 });
      const firstCheck = Date.parse(ctx.feed.hits.find(hit => hit.path === "/repos/test/repo/releases").at);
      ctx.feed.setReleases([release]);
      const run = { plan, ctx, firstCheck, publishedAt: Date.now(), lastListHits: ctx.feed.listHits(), events: [] };
      run.events.push({ at: stamp(), olay: "açılış denetimi (kaynakta yeni sürüm yok)", sorgu: run.lastListHits, ilkSorgu: new Date(firstCheck).toISOString(), sonuc: status.updates.available ? "bulundu" : "yok", periodicCheckMs: status.updates.periodicCheckMs, kendiligindenKur: status.updates.autoUpdate });
      run.events.push({ at: stamp(), olay: "9.0.1 yayımlandı (kaynakta)" });
      console.log(`[${stamp()}] ${plan.name}: açılış denetimi ${new Date(firstCheck).toISOString()}, 9.0.1 yayımlandı`);
      runs.push(run);
    }
    const deadline = Math.min(...runs.map(run => run.firstCheck)) + 7 * H;
    const done = run => (run.plan.config ? run.afterCheck : run.installedAt);
    while (Date.now() < deadline && runs.some(run => !done(run))) {
      for (const run of runs) {
        if (done(run)) continue;
        const status = await run.ctx.service.status();
        const listHits = run.ctx.feed.listHits();
        if (listHits !== run.lastListHits) {
          const hit = run.ctx.feed.hits.filter(item => item.path === "/repos/test/repo/releases").at(-1);
          const hours = Math.round(((Date.parse(hit.at) - run.firstCheck) / H) * 1000) / 1000;
          run.events.push({ at: stamp(), olay: "kaynak sorgulandı", sorgu: listHits, sorguAni: hit.at, ilkSorgudanSaat: hours, mesaiDisi: status.quietNow, mesgul: status.activity.busy, durum: status.updates?.state, bulunan: status.updates?.available?.version || null, surum: status.version });
          console.log(`[${stamp()}] ${run.plan.name}: kaynak sorgulandı #${listHits} (ilk sorgudan ${hours} sa)`);
          run.lastListHits = listHits;
          run.periodicHitAt ||= Date.parse(hit.at);
        }
        if (!run.foundAt && status.updates?.available) {
          run.foundAt = Date.now();
          run.events.push({ at: stamp(), olay: "hazır (bulundu)", surum: status.version, ertelendi: status.updates.deferred });
        }
        if (!run.plan.config && status.updates?.lastResult?.outcome === "success") {
          run.installedAt = Date.parse(status.updates.lastResult.at);
          run.events.push({ at: stamp(), olay: "kuruldu", ilkSorgudanSaat: Math.round(((run.installedAt - run.firstCheck) / H) * 1000) / 1000, surum: await run.ctx.service.appVersion() });
          console.log(`[${stamp()}] ${run.plan.name}: KURULDU`);
        }
        if (run.plan.config && run.foundAt && !run.afterCheck && Date.now() - run.foundAt >= 5 * MIN) {
          run.afterCheck = { bulunmaSonrasi5DkSurum: await run.ctx.service.appVersion(), paketIndirme: run.ctx.feed.zipHits() };
          run.screens = await adminScreens(browser, run.ctx.recorder.url, run.ctx.dir, "hazir-6sa-sonra");
          run.events.push({ at: stamp(), olay: "bulunduktan 5 dk sonra", ...run.afterCheck });
        }
      }
      await sleep(30_000);
    }
    for (const run of runs) {
      results[run.plan.name] = await finish(run.ctx, {
        ozet: {
          kendiligindenKur: !run.plan.config,
          ilkSorgu: new Date(run.firstCheck).toISOString(),
          ikinciSorgu: run.periodicHitAt ? new Date(run.periodicHitAt).toISOString() : null,
          ikiSorguArasiSaat: run.periodicHitAt ? Math.round(((run.periodicHitAt - run.firstCheck) / H) * 1000) / 1000 : null,
          beklenenAralikSaat: "6,000–6,500 (6 sa + 0–30 dk kayma)",
          kurulduIlkSorgudanSaat: run.installedAt ? Math.round(((run.installedAt - run.firstCheck) / H) * 1000) / 1000 : null,
          bulunduHazirGorundu: run.plan.config ? Boolean(run.foundAt) : "kendiliğinden kur açık — bulunduğu anda kuruldu",
          ...(run.afterCheck || {}),
          surum: await run.ctx.service.appVersion(),
        },
        olaylar: run.events,
        ekran: run.screens || null,
      });
    }
  }

  if (wanted.includes("s2")) {
    // S2: dört servis birlikte; üretim süreleri; mesai içi zorlanır (Cumartesi).
    const plans = [
      { name: "s2-A-sekme-acik-kalir", closeAt: 62 * MIN },
      { name: "s2-B-sekme-3dk-kapanir", closeAt: 3 * MIN },
      { name: "s2-C-sekme-50dk-kapanir", closeAt: 50 * MIN },
      { name: "s2-D-sekme-gizli", hideAt: 3 * MIN },
    ];
    const runs = [];
    for (const plan of plans) {
      const ctx = await setup(plan.name, { feed: { releases: [release], down: true }, quiet: "never" });
      const tab = await openTab(browser, ctx.recorder.url, STAFF);
      ctx.feed.setDown(false);
      runs.push({ plan, ctx, tab, events: [] });
    }
    for (const run of runs) {
      const status = await waitFor(async () => {
        const value = await run.ctx.service.status();
        return value.updates?.deferred ? value : Promise.reject(new Error("ertelenmedi"));
      }, { timeoutMs: 4 * MIN, interval: 500 });
      run.t0 = Date.parse(status.updates.deferred.since);
      run.events.push({ at: stamp(), olay: "ertelendi (hazır)", t0: status.updates.deferred.since, mesgul: status.activity.busy, sonEtkinlik: status.activity.lastActivityAt });
      console.log(`[${stamp()}] ${run.plan.name}: ertelendi ${status.updates.deferred.since}`);
    }
    // Ekran: A'da yönetici paneli "hazır" (kullanıcılar çalışırken bulundu) + yöneticinin ana ekranı (zil).
    runs[0].screens = await adminScreens(browser, runs[0].ctx.recorder.url, runs[0].ctx.dir, "hazir");
    await runs[0].tab.page.screenshot({ path: path.join(runs[0].ctx.dir, "personel-acik-sekme.png") });
    const deadline = Math.max(...runs.map(run => run.t0)) + 135 * MIN;
    while (Date.now() < deadline && runs.some(run => !run.installedAt)) {
      for (const run of runs) {
        const elapsed = Date.now() - run.t0;
        if (run.plan.closeAt && !run.closedAt && elapsed >= run.plan.closeAt) {
          await run.tab.context.close();
          run.closedAt = Date.now();
          run.events.push({ at: stamp(), olay: "sekme kapatıldı", dk: minutesSince(run.t0) });
          console.log(`[${stamp()}] ${run.plan.name}: sekme kapatıldı (${minutesSince(run.t0)} dk)`);
        }
        if (run.plan.hideAt && !run.hiddenAt && elapsed >= run.plan.hideAt) {
          await hideTab(run.tab.page);
          run.hiddenAt = Date.now();
          run.events.push({ at: stamp(), olay: "sekme gizlendi", dk: minutesSince(run.t0) });
          console.log(`[${stamp()}] ${run.plan.name}: sekme gizlendi (${minutesSince(run.t0)} dk)`);
        }
        if (!run.installedAt) {
          const status = await run.ctx.service.status();
          const at = status.updates?.lastResult?.outcome === "success" ? Date.parse(status.updates.lastResult.at) : null;
          // Servis yöneticisinin kendi gördüğü son kullanıcı isteği (kurulum başlamadan önceki son okuma).
          if (status.version === "9.0.0" && status.updates?.state === "idle" && status.activity.lastActivityAt) run.lastActivitySeen = Date.parse(status.activity.lastActivityAt);
          const listHits = run.ctx.feed.listHits();
          if (listHits !== run.lastListHits) {
            run.events.push({ at: stamp(), olay: "kaynak sorgulandı", dk: minutesSince(run.t0), sorgu: listHits, mesgul: status.activity.busy, sonEtkinlik: status.activity.lastActivityAt, surum: status.version });
            run.lastListHits = listHits;
          }
          if (at) {
            run.installedAt = at;
            run.events.push({ at: stamp(), olay: "kuruldu", dk: minutesSince(run.t0, at), surum: await run.ctx.service.appVersion() });
            console.log(`[${stamp()}] ${run.plan.name}: KURULDU ${minutesSince(run.t0, at)} dk`);
          }
        }
      }
      await sleep(15_000);
    }
    for (const run of runs) {
      if (!run.closedAt) await run.tab.context.close().catch(() => null);
      const quietSince = run.closedAt || run.hiddenAt || null;
      results[run.plan.name] = await finish(run.ctx, {
        ozet: {
          ertelemeAni: new Date(run.t0).toISOString(),
          sekmeKapandiDk: run.closedAt ? minutesSince(run.t0, run.closedAt) : null,
          sekmeGizlendiDk: run.hiddenAt ? minutesSince(run.t0, run.hiddenAt) : null,
          kurulduDk: run.installedAt ? minutesSince(run.t0, run.installedAt) : null,
          sekmeKapaninca_GizlenincedenKurulumaDk: run.installedAt && quietSince ? minutesSince(quietSince, run.installedAt) : null,
          sonKullaniciIsteginden_KurulumaDk: run.installedAt && run.lastActivitySeen ? minutesSince(run.lastActivitySeen, run.installedAt) : null,
          servisinGorduguSonIstek: run.lastActivitySeen ? new Date(run.lastActivitySeen).toISOString() : null,
          surum: await run.ctx.service.appVersion(),
        },
        olaylar: run.events,
        sekmeIstekleri_acikGorunur: gapsOf(run.ctx.recorder.log, run.t0, run.closedAt || run.hiddenAt || run.installedAt || Date.now()),
        sekmeIstekleri_gizliyken: run.hiddenAt ? gapsOf(run.ctx.recorder.log, run.hiddenAt + 1, run.installedAt || Date.now()) : null,
        ekran: run.screens || null,
        sayfaHatalari: run.tab.errors,
      });
    }
  }
} finally {
  await browser.close();
  writeJson(path.join(OUT, `ozet-${wanted.join("-")}.json`), Object.fromEntries(Object.entries(results).map(([key, value]) => [key, value.ozet])));
  rmSync(work, { recursive: true, force: true });
}
