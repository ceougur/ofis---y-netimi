// Otomatik güncelleme — "arka planda indir, sonraki açılışta kur" (2.1.0; ana oturum tasarımı, kullanıcı onayı 10.10.2026:
// ofislerin çoğu sunucuyu akşam ve hafta sonu KAPATIYOR → mesai dışı kuralı pratikte işlemiyor, tek kurulum anı açılış).
// GERÇEK süreçlerle: ayrı süreçte gerçek servis yöneticisi (test/guncelleme-gercek/hizmet.mjs), onun açtığı gerçek uygulama süreci,
// yerel sahte yayın kaynağı (GitHub API biçimi, test imzalı bildirge + gerçek güncelleme paketi), gerçek HTTP istekleri (kullanıcı
// etkinliği), gerçek durdur/başlat. KISALTILAN yalnız sürelerdir (açıkça): saatlik denetim → 0,6 sn; boşta süresi 15 dk → 10 dk
// (testte hiç dolmaz; kullanıcı hep "çalışıyor"); 60 dk yeniden bakış → 10 dk. Açılıştaki 60 sn'lik son denetim ÜRETİM değeridir.
//  (a) gün içinde bulundu, kullanıcı çalışıyor → paket indirildi + doğrulandı + açıldı, servis/uygulama durmadı, durum "hazır"
//  (b) servis durdurulup başlatılır → uygulama ESKİ sürümle hiç açılmadan yeni sürüm kurulur (yeniden indirilmez)
//  (c) açılışta ağ yok → hazırdaki kurulur
//  (d) açılışta daha yeni sürüm var → o indirilip kurulur, tek geçiş
//  (e)+(k) hazırken daha yeni çıktı → yeni paket hazırlandıktan SONRA eski hazır paket (klasörü + zip'i) silinir; çalışan ve önceki
//      sürüm klasörleri durur
//  (f) bozuk (SHA-256) ya da yanlış imzalı hazır paket → kurulmaz, eski sürüm açılır, kayıt
//  (g) yeni sürümün deneme açılışı başarısız → geri dönüş + "kurulamadı"; sonraki açılışta aynı sürüm yeniden denenmez
//  (h) kendiliğinden kur kapalı → indirme yok, yalnız "hazır"
//  (i) saatlik denetim (kısaltılmış aralıkla gerçek süreç) + üretim varsayılanı 1 saat
//  (j) hazır 9.0.1 varken 9.0.2 indirmesi yarıda kesilir / özeti tutmaz → 9.0.1 hazır kalır; açılışta 9.0.1 kurulur
//  (l) iki indirme aynı anda başlamaz (yavaş indirme sürerken saatlik denetimler + yöneticinin elle "Denetle"si)
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, buildTestRelease, client, counts, prepareInstall, releaseEntry, sleep, startActivity, startFeed, startService, stopAllActivity, waitFor } from "./guncelleme-gercek/ortak.mjs";

const work = mkdtempSync(path.join(tmpdir(), "destekofis-hazir-"));
const rel = {};
before(() => {
  rel.v901 = releaseEntry(buildTestRelease(work, "9.0.1"));
  rel.v902 = releaseEntry(buildTestRelease(work, "9.0.2"));
  rel.broken = releaseEntry(buildTestRelease(path.join(work, "bozuk"), "9.0.1", { serverSource: "process.exit(4);\n" }));
});
after(() => rmSync(work, { recursive: true, force: true }));

const DAY = { quiet: "never", retryDelays: [], timings: { idleMs: 600_000, periodicCheckMs: 600, periodicJitterMs: 0, deferRecheckMs: 600_000 } };
const readJson = file => JSON.parse(readFileSync(file, "utf8"));
const appDir = (root, version) => path.join(root, "app", version);
const hazirDir = (root, version) => path.join(root, "app", ".hazir", ...(version ? [version] : []));
const hazirList = root => (existsSync(hazirDir(root)) ? readdirSync(hazirDir(root)) : []);
const stateOf = root => readJson(path.join(root, "app", "update-state.json"));
// Bu açılışta servis yöneticisinin uygulamayı hangi sürüm klasörüyle başlattığı (günlükten, açılış sırasına göre).
const appStarts = text => [...text.matchAll(/Uygulama başlatılıyor \(([^,]+),/g)].map(match => match[1].replace(/\\/g, "/"));

async function withFeed(name, { config, previous, feedOptions = {} }, body) {
  const root = path.join(work, name);
  const before = await prepareInstall(root, { config, previous });
  const feed = await startFeed(feedOptions);
  const services = [];
  const boot = async (options = DAY) => {
    const offset = services.length ? readFileSync(services.at(-1).logFile, "utf8").length : 0;
    const service = await startService(root, { feed: feed.url, ...options });
    services.push(service);
    service.bootLog = () => readFileSync(service.logFile, "utf8").slice(offset);
    return service;
  };
  const restart = async (options = { retryDelays: [] }) => {
    await stopAllActivity();
    await services.at(-1).stop();
    return boot(options);
  };
  try {
    await body({ root, feed, boot, restart, before, current: () => services.at(-1) });
  } catch (error) {
    const last = services.at(-1);
    if (last) console.log(`---- ${name} servis günlüğü (son) ----\n${last.log().slice(-6000)}`);
    throw error;
  } finally {
    await stopAllActivity();
    for (const service of services) await service.stop().catch(() => {});
    await feed.close();
  }
}

// Gün içi: servis açılır (kaynakta yeni sürüm yok), kullanıcı çalışır, sonra yeni sürüm yayımlanır → saatlik denetimde bulunur.
async function foundDuringDay({ feed, boot }, releases, { prepared = releases[0].version } = {}) {
  const service = await boot();
  assert.equal(await service.appVersion(), "9.0.0");
  await startActivity(service.base, { intervalMs: 300 });
  const pidBefore = (await service.status()).childPid;
  feed.setReleases(releases);
  const status = await waitFor(async () => {
    const value = await service.status();
    return value.updates.prepared?.version === prepared ? value : Promise.reject(new Error(`hazır değil: ${JSON.stringify(value.updates.prepared)}`));
  }, { timeoutMs: 60_000, interval: 200 });
  return { service, status, pidBefore };
}

describe("Otomatik güncelleme: arka planda indir, sonraki açılışta kur (gerçek süreçler)", { concurrency: false, timeout: 300_000 }, () => {
  it("(a) gün içinde kullanıcı çalışırken bulunan sürüm arka planda indirilir + doğrulanır + açılır; servis durmaz, 'hazır' görünür; (b) durdur/başlat → eski sürüm hiç açılmadan kurulur", async () => {
    await withFeed("ab", { feedOptions: { releases: [] } }, async ctx => {
      const { root, feed, restart, before } = ctx;
      const { service, status, pidBefore } = await foundDuringDay(ctx, [rel.v901]);
      assert.equal(status.updates.available?.version, "9.0.1");
      assert.equal(status.updates.deferred?.version, "9.0.1", "kullanıcı çalışıyor → kurulmadı (ertelendi)");
      assert.equal(status.activity.busy, true);
      assert.equal(status.version, "9.0.0");
      assert.equal(status.childPid, pidBefore, "uygulama süreci değişmedi (servis durmadı)");
      assert.equal(await service.appVersion(), "9.0.0", "eski sürüm çalışmaya devam ediyor");
      assert.equal(feed.zipHits("9.0.1"), 1, "paket bir kez indirildi");
      assert.ok(existsSync(path.join(hazirDir(root, "9.0.1"), "destekofis-guncelleme.json")), "imzalı bildirge saklandı");
      assert.ok(readdirSync(hazirDir(root, "9.0.1")).some(file => file.endsWith(".zip")), "paket saklandı");
      assert.equal(readJson(path.join(appDir(root, "9.0.1"), ".paket.json")).version, "9.0.1", "paket app\\9.0.1 klasörüne açıldı");
      assert.equal(readJson(path.join(root, "app", "current.json")).version, "9.0.0", "etkin sürüm değişmedi");
      assert.equal(stateOf(root).prepared?.version, "9.0.1");
      assert.match(service.log(), /9\.0\.1 sürümü arka planda indirildi ve doğrulandı/);
      // Yönetici paneli (API) de aynı bilgiyi verir.
      const admin = client(service.base);
      assert.equal((await admin.login("admin", ADMIN_PASSWORD)).status, 200);
      const panel = (await admin.get("/api/admin/update")).data.data;
      assert.equal(panel.prepared?.version, "9.0.1");
      // Saatlik denetimler sürerken yeniden indirilmez, uygulama yeniden başlamaz.
      const checks = feed.listHits();
      await sleep(3000);
      assert.ok(feed.listHits() - checks >= 3, `denetim sürüyor (${feed.listHits() - checks})`);
      assert.equal(feed.zipHits("9.0.1"), 1, "yeniden indirilmedi");
      assert.equal((await service.status()).childPid, pidBefore);

      // (b) Servis durdurulur, yeniden başlatılır (akşam kapatıp sabah açmak gibi).
      const next = await restart({ retryDelays: [] });
      assert.equal(await next.appVersion(), "9.0.1", "yeni sürüm çalışıyor");
      const starts = appStarts(next.bootLog());
      assert.deepEqual(starts, ["app/9.0.1"], `bu açılışta uygulama yalnız 9.0.1 ile başlatıldı (eski sürüm hiç açılmadı): ${starts.join(", ")}`);
      const after = await next.status();
      assert.equal(after.updates.lastResult?.outcome, "success");
      assert.equal(after.updates.periodicCheckMs, 3_600_000, "üretim varsayılanı: saatte bir denetim");
      assert.equal(feed.zipHits("9.0.1"), 1, "açılışta yeniden indirilmedi (hazır paket)");
      assert.match(next.bootLog(), /Açılışta hazır güncelleme var \(9\.0\.1\)/);
      assert.deepEqual(hazirList(root), [], "kurulan paket hazırdan silindi");
      assert.equal(stateOf(root).prepared, null);
      assert.ok(readdirSync(path.join(root, "backups", "001 - Şirket 1")).some(file => /guncelleme-oncesi-9-0-0/.test(file)), "güncelleme öncesi yedek");
      assert.deepEqual(counts(root), before, "veriler aynı");
    });
  });

  it("(c) açılışta ağ yok (yayın kaynağı kapalı) → hazırdaki sürüm kurulur", async () => {
    await withFeed("c", { feedOptions: { releases: [] } }, async ctx => {
      await foundDuringDay(ctx, [rel.v901]);
      ctx.feed.setDown(true);
      const next = await ctx.restart({ retryDelays: [] });
      assert.equal(await next.appVersion(), "9.0.1");
      assert.deepEqual(appStarts(next.bootLog()), ["app/9.0.1"]);
      assert.match(next.bootLog(), /son denetim yapılamadı/);
      assert.equal((await next.status()).updates.lastResult?.outcome, "success");
    });
  });

  it("(d) açılışta daha yeni sürüm var → o indirilip kurulur; tek geçiş, ara sürüm kurulmaz", async () => {
    await withFeed("d", { feedOptions: { releases: [] } }, async ctx => {
      await foundDuringDay(ctx, [rel.v901]);
      ctx.feed.setReleases([rel.v902, rel.v901]);
      const next = await ctx.restart({ retryDelays: [] });
      assert.equal(await next.appVersion(), "9.0.2");
      assert.deepEqual(appStarts(next.bootLog()), ["app/9.0.2"], "uygulama bu açılışta bir kez, 9.0.2 ile başlatıldı");
      const activated = stateOf(ctx.root).history.filter(item => item.event === "activated").map(item => item.version);
      assert.deepEqual(activated, ["9.0.2"], "yalnız 9.0.2 etkinleştirildi");
      assert.equal(ctx.feed.zipHits("9.0.2"), 1);
      assert.deepEqual(hazirList(ctx.root), []);
      assert.ok(!existsSync(appDir(ctx.root, "9.0.1")), "kullanılmayan 9.0.1 açılımı silindi");
    });
  });

  it("(e)+(k) hazırken daha yeni sürüm çıkar → önce yenisi tamamen hazırlanır, SONRA eski hazır paket (klasör + zip) silinir; çalışan ve önceki sürüm durur", async () => {
    await withFeed("ek", { previous: "8.9.0", feedOptions: { releases: [] } }, async ctx => {
      const { service, pidBefore } = await foundDuringDay(ctx, [rel.v901]);
      const zip901 = readdirSync(hazirDir(ctx.root, "9.0.1")).find(file => file.endsWith(".zip"));
      assert.ok(zip901);
      ctx.feed.setReleases([rel.v902, rel.v901]);
      const status = await waitFor(async () => {
        const value = await service.status();
        return value.updates.prepared?.version === "9.0.2" ? value : Promise.reject(new Error("9.0.2 hazır değil"));
      }, { timeoutMs: 60_000 });
      assert.equal(status.childPid, pidBefore, "servis durmadı");
      assert.equal(await service.appVersion(), "9.0.0");
      assert.deepEqual(hazirList(ctx.root), ["9.0.2"], "diskte yalnız en yeni hazır paket");
      assert.ok(!existsSync(path.join(hazirDir(ctx.root), "9.0.1", zip901)), "eski hazır paketin zip'i silindi");
      assert.ok(!existsSync(appDir(ctx.root, "9.0.1")), "eski hazır paketin açılımı (app\\9.0.1) silindi");
      assert.ok(existsSync(path.join(appDir(ctx.root, "9.0.2"), ".paket.json")), "app\\9.0.2 açıldı");
      assert.ok(existsSync(path.join(appDir(ctx.root, "9.0.0"), "package.json")), "çalışan sürüm klasörü duruyor");
      assert.ok(existsSync(path.join(appDir(ctx.root, "8.9.0"), "package.json")), "önceki (geri dönüş) sürüm klasörü duruyor");
      const history = stateOf(ctx.root).history.filter(item => item.event === "prepared").map(item => item.version);
      assert.deepEqual(history, ["9.0.1", "9.0.2"]);
      const next = await ctx.restart({ retryDelays: [] });
      assert.equal(await next.appVersion(), "9.0.2");
      assert.deepEqual(appStarts(next.bootLog()), ["app/9.0.2"]);
    });
  });

  it("(j) hazır 9.0.1 varken 9.0.2 indirmesi yarıda kesilir ya da özeti tutmaz → 9.0.1 hazır kalır (hiçbir an hazır paketsiz değil); açılışta 9.0.1 kurulur", async () => {
    await withFeed("j", { feedOptions: { releases: [] } }, async ctx => {
      const { service } = await foundDuringDay(ctx, [rel.v901]);
      const before = readdirSync(hazirDir(ctx.root, "9.0.1")).sort();
      for (const mode of ["cut", "sha"]) {
        ctx.feed.setZipMode("9.0.2", mode);
        ctx.feed.setReleases([rel.v902, rel.v901]);
        const tries = ctx.feed.zipHits("9.0.2");
        await waitFor(() => (ctx.feed.zipHits("9.0.2") >= tries + 2 ? true : Promise.reject(new Error("indirme denenmedi"))), { timeoutMs: 60_000 });
        await waitFor(async () => ((await service.status()).updates.preparing ? Promise.reject(new Error("sürüyor")) : true), { timeoutMs: 30_000 });
        assert.equal(stateOf(ctx.root).prepared?.version, "9.0.1", `${mode}: hazır paket hâlâ 9.0.1`);
        assert.deepEqual(hazirList(ctx.root), ["9.0.1"], `${mode}: hazırda yalnız 9.0.1 (yarım 9.0.2 yok)`);
        assert.deepEqual(readdirSync(hazirDir(ctx.root, "9.0.1")).sort(), before, `${mode}: 9.0.1 dosyaları yerinde`);
        assert.ok(existsSync(path.join(appDir(ctx.root, "9.0.1"), ".paket.json")), `${mode}: app\\9.0.1 açılımı yerinde`);
        assert.ok(!existsSync(appDir(ctx.root, "9.0.2")), `${mode}: yarım 9.0.2 açılmadı`);
      }
      assert.match(service.log(), /9\.0\.2 sürümü arka planda hazırlanamadı/);
      ctx.feed.setDown(true);
      const next = await ctx.restart({ retryDelays: [] });
      assert.equal(await next.appVersion(), "9.0.1", "açılışta hazırdaki 9.0.1 kuruldu");
      assert.deepEqual(appStarts(next.bootLog()), ["app/9.0.1"]);
    });
  });

  it("(f) bozuk (SHA-256 tutmayan) ya da yanlış imzalı hazır paket → kurulmaz, eski sürüm açılır, kayıt düşülür, hazır paket silinir", async () => {
    for (const kind of ["sha", "imza"]) {
      await withFeed(`f-${kind}`, { feedOptions: { releases: [] } }, async ctx => {
        await foundDuringDay(ctx, [rel.v901]);
        await stopAllActivity();
        await ctx.current().stop();
        const dir = hazirDir(ctx.root, "9.0.1");
        if (kind === "sha") {
          const zip = path.join(dir, readdirSync(dir).find(file => file.endsWith(".zip")));
          const data = readFileSync(zip);
          data[Math.floor(data.length / 3)] ^= 0xff;
          writeFileSync(zip, data);
        } else {
          const file = path.join(dir, "destekofis-guncelleme.json");
          const envelope = readJson(file);
          const sig = Buffer.from(envelope.signatures[0].sig, "base64");
          sig[5] ^= 0xff;
          envelope.signatures[0].sig = sig.toString("base64");
          writeFileSync(file, JSON.stringify(envelope));
        }
        ctx.feed.setDown(true);
        const next = await ctx.boot({ retryDelays: [] });
        assert.equal(await next.appVersion(), "9.0.0", `${kind}: eski sürüm açıldı`);
        assert.deepEqual(appStarts(next.bootLog()), ["app/9.0.0"], `${kind}: yalnız 9.0.0 başlatıldı`);
        assert.match(next.bootLog(), /Hazırdaki güncelleme paketi \(9\.0\.1\) kurulmadı/);
        const state = stateOf(ctx.root);
        assert.ok(state.history.some(item => item.event === "prepared-rejected" && item.version === "9.0.1"), `${kind}: kayıt`);
        assert.ok(!state.history.some(item => item.event === "activated"), `${kind}: etkinleştirilmedi`);
        assert.equal(state.prepared, null);
        assert.deepEqual(hazirList(ctx.root), []);
        assert.ok(!existsSync(appDir(ctx.root, "9.0.1")), `${kind}: açılımı silindi`);
        const status = await next.status();
        assert.equal(status.updates.lastResult?.outcome, "failed");
        assert.match(status.updates.lastResult?.reason || "", kind === "sha" ? /SHA-256/ : /imza/);
      });
    }
  });

  it("(g) yeni sürümün deneme açılışı başarısız → önceki sürüme dönülür, 'kurulamadı' işaretlenir; sonraki açılışta aynı sürüm yeniden denenmez", async () => {
    await withFeed("g", { feedOptions: { releases: [] } }, async ctx => {
      await foundDuringDay(ctx, [rel.broken]);
      const next = await ctx.restart({ retryDelays: [] });
      await waitFor(async () => ((await next.status()).updates.lastResult?.outcome === "rolled-back" ? true : Promise.reject(new Error("dönülmedi"))), { timeoutMs: 120_000 });
      assert.equal(await next.appVersion(), "9.0.0");
      const state = stateOf(ctx.root);
      assert.ok(state.failed["9.0.1"], "9.0.1 kurulamadı olarak işaretlendi");
      assert.equal(state.prepared, null);
      assert.deepEqual(hazirList(ctx.root), []);
      const zips = ctx.feed.zipHits("9.0.1");
      const third = await ctx.restart({ retryDelays: [] });
      await sleep(2000);
      assert.equal(await third.appVersion(), "9.0.0");
      assert.deepEqual(appStarts(third.bootLog()), ["app/9.0.0"], "aynı sürüm yeniden denenmedi");
      assert.equal(stateOf(ctx.root).history.filter(item => item.event === "activated").length, 1, "yalnız bir kez etkinleştirildi");
      assert.equal(ctx.feed.zipHits("9.0.1"), zips, "yeniden indirilmedi");
      assert.deepEqual((await third.status()).updates.skippedVersions, ["9.0.1"]);
    });
  });

  it("(h) kendiliğinden kur KAPALI → bulunan sürüm indirilmez, hazırlanmaz, yalnız 'hazır' bildirilir; (i) saatlik denetim sürer", async () => {
    await withFeed("h", { config: { enabled: false }, feedOptions: { releases: [] } }, async ctx => {
      const service = await ctx.boot();
      await startActivity(service.base, { intervalMs: 300 });
      ctx.feed.setReleases([rel.v901]);
      await waitFor(async () => ((await service.status()).updates.available?.version === "9.0.1" ? true : Promise.reject(new Error("bulunmadı"))), { timeoutMs: 30_000 });
      const checks = ctx.feed.listHits();
      await sleep(4000);
      assert.ok(ctx.feed.listHits() - checks >= 4, `(i) kısaltılmış saatlik denetim sürdü (${ctx.feed.listHits() - checks} sorgu / 4 sn, aralık 0,6 sn)`);
      const status = await service.status();
      assert.equal(ctx.feed.zipHits(), 0, "indirilmedi");
      assert.deepEqual(hazirList(ctx.root), []);
      assert.equal(status.updates.prepared, null);
      assert.equal(status.updates.autoUpdate, false);
      assert.equal(status.updates.available?.version, "9.0.1");
      assert.ok(!existsSync(appDir(ctx.root, "9.0.1")));
      const next = await ctx.restart({ retryDelays: [] });
      await sleep(2000);
      assert.equal(await next.appVersion(), "9.0.0", "kapalıyken açılışta da kurulmadı");
      assert.equal(ctx.feed.zipHits(), 0);
    });
  });

  it("(l) iki indirme aynı anda başlamaz: yavaş indirme sürerken saatlik denetimler ve yöneticinin elle 'Denetle'si yeni indirme başlatmaz", async () => {
    await withFeed("l", { feedOptions: { releases: [], zipDelayMs: 60 } }, async ctx => {
      const service = await ctx.boot();
      await startActivity(service.base, { intervalMs: 300 });
      ctx.feed.setReleases([rel.v901]);
      await waitFor(async () => ((await service.status()).updates.preparing === "9.0.1" ? true : Promise.reject(new Error("hazırlık başlamadı"))), { timeoutMs: 30_000, interval: 50 });
      const admin = client(service.base);
      assert.equal((await admin.login("admin", ADMIN_PASSWORD)).status, 200);
      const manual = await Promise.all([admin.post("/api/admin/update/check"), admin.post("/api/admin/update/check")]);
      assert.deepEqual(manual.map(item => item.status), [200, 200]);
      const during = await service.status();
      assert.equal(during.updates.preparing, "9.0.1", "elle denetim sırasında indirme sürüyor");
      await waitFor(async () => ((await service.status()).updates.prepared?.version === "9.0.1" ? true : Promise.reject(new Error("hazır değil"))), { timeoutMs: 60_000 });
      assert.ok(ctx.feed.listHits() >= 5, `indirme sürerken birçok denetim oldu (${ctx.feed.listHits()})`);
      assert.equal(ctx.feed.zipHits("9.0.1"), 1, "paket yalnız bir kez indirildi");
      assert.deepEqual(hazirList(ctx.root), ["9.0.1"]);
      assert.ok(!readdirSync(path.join(ctx.root, "app")).some(name => /\.part$|^\.indirilen$/.test(name)), "yarım indirme kalmadı");
    });
  });
});
