// Otomatik güncelleme — gün içinde hazırlanan (app\.hazir) sürüm yayından GERİ ÇEKİLİRSE (yargıç 2.1.0 bulgu B5, 11.10.2026;
// yeniden üretim docs/kanit/2026-10-11/yargic/p2-geri-cekilen-surum.mjs). Açılıştaki son denetim HATASIZ döndüyse hazır paket
// yalnız yayın listesinde kurulabilir en yeni sürümse kurulur:
//  (1) yayın listesi boş / "güncel" → hazır paket KURULMAZ, silinir; günlük + Yönetim → Sistem durumunda "yayından kaldırıldı"
//  (2) en yeni yayın hazırdakinden ESKİ (hazır 9.0.2 geri çekildi, en yeni 9.0.1) → 9.0.2 kurulmaz/silinir; 9.0.1 kurulur (tek geçiş)
//  (3) son denetim ağ hatasıyla döner → bugünkü davranış: hazırdaki kurulur; günlükte "indiriliyor" değil "hazırdaki paket kuruluyor"
//  (4) daha yeni sürüm var → o indirilip kurulur (bugünkü davranış)
// GERÇEK süreçler (test/guncelleme-hazir.test.mjs ile aynı kalıp): ayrı süreçte servis yöneticisi + uygulama, yerel sahte yayın
// kaynağı, gerçek HTTP etkinliği, gerçek durdur/başlat. Kısaltılan yalnız süreler (saatlik denetim 0,6 sn).
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, buildTestRelease, client, prepareInstall, releaseEntry, startActivity, startFeed, startService, stopAllActivity, waitFor } from "./guncelleme-gercek/ortak.mjs";

const work = mkdtempSync(path.join(tmpdir(), "destekofis-geri-cekilen-"));
const rel = {};
before(() => {
  rel.v901 = releaseEntry(buildTestRelease(work, "9.0.1"));
  rel.v902 = releaseEntry(buildTestRelease(work, "9.0.2"));
});
after(() => rmSync(work, { recursive: true, force: true }));

const DAY = { quiet: "never", retryDelays: [], timings: { idleMs: 600_000, periodicCheckMs: 600, periodicJitterMs: 0, deferRecheckMs: 600_000 } };
const readJson = file => JSON.parse(readFileSync(file, "utf8"));
const appDir = (root, version) => path.join(root, "app", version);
const hazirDir = root => path.join(root, "app", ".hazir");
const hazirList = root => (existsSync(hazirDir(root)) ? readdirSync(hazirDir(root)) : []);
const stateOf = root => readJson(path.join(root, "app", "update-state.json"));
const appStarts = text => [...text.matchAll(/Uygulama başlatılıyor \(([^,]+),/g)].map(match => match[1].replace(/\\/g, "/"));
const activated = root => stateOf(root).history.filter(item => item.event === "activated").map(item => item.version);

async function withFeed(name, body) {
  const root = path.join(work, name);
  await prepareInstall(root, {});
  const feed = await startFeed({ releases: [] });
  const services = [];
  const boot = async (options = DAY) => {
    const offset = services.length ? readFileSync(services.at(-1).logFile, "utf8").length : 0;
    const service = await startService(root, { feed: feed.url, ...options });
    services.push(service);
    service.bootLog = () => readFileSync(service.logFile, "utf8").slice(offset);
    return service;
  };
  const restart = async () => {
    await stopAllActivity();
    await services.at(-1).stop();
    return boot({ retryDelays: [] });
  };
  try {
    await body({ root, feed, boot, restart });
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

// Gün içinde (kullanıcı çalışırken) yayımlanan sürüm bulunur ve arka planda hazırlanır.
async function prepareDuringDay({ feed, boot }, releases, prepared) {
  const service = await boot();
  assert.equal(await service.appVersion(), "9.0.0");
  await startActivity(service.base, { intervalMs: 300 });
  feed.setReleases(releases);
  await waitFor(async () => {
    const value = await service.status();
    return value.updates.prepared?.version === prepared ? value : Promise.reject(new Error(`hazır değil: ${JSON.stringify(value.updates.prepared)}`));
  }, { timeoutMs: 60_000, interval: 200 });
  return service;
}

describe("Otomatik güncelleme: geri çekilen hazır sürüm (yargıç B5, gerçek süreçler)", { concurrency: false, timeout: 600_000 }, () => {
  it("(1) hazır 9.0.1 yayından geri çekildi (yayın listesi boş, kaynak çalışıyor) → açılışta KURULMAZ, hazır paket silinir, durum ve günlükte 'yayından kaldırıldı'", async () => {
    await withFeed("bos", async ctx => {
      await prepareDuringDay(ctx, [rel.v901], "9.0.1");
      ctx.feed.setReleases([]);
      const next = await ctx.restart();
      assert.equal(await next.appVersion(), "9.0.0", "geri çekilen 9.0.1 kurulmadı; 9.0.0 çalışıyor");
      assert.deepEqual(appStarts(next.bootLog()), ["app/9.0.0"], "bu açılışta uygulama yalnız 9.0.0 ile başlatıldı");
      assert.deepEqual(activated(ctx.root), [], "hiçbir sürüm etkinleştirilmedi");
      assert.equal(readJson(path.join(ctx.root, "app", "current.json")).version, "9.0.0");
      assert.deepEqual(hazirList(ctx.root), [], "hazır paket silindi");
      assert.ok(!existsSync(appDir(ctx.root, "9.0.1")), "hazır paketin açılımı (app\\9.0.1) silindi");
      const state = stateOf(ctx.root);
      assert.equal(state.prepared, null);
      assert.ok(state.history.some(item => item.event === "prepared-withdrawn" && item.version === "9.0.1"), "geçmişte 'yayından kaldırıldı' kaydı");
      assert.match(next.bootLog(), /9\.0\.1 sürümü yayından kaldırıldığı için kurulmadı/);
      assert.doesNotMatch(next.bootLog(), /9\.0\.1 sürümü indiriliyor/);
      const status = await next.status();
      assert.equal(status.updates.lastResult?.outcome, "withdrawn");
      assert.equal(status.updates.lastResult?.version, "9.0.1");
      assert.match(status.updates.lastResult?.reason || "", /yayından kaldırıldığı için kurulmadı/);
      assert.equal(status.updates.prepared, null);
      // Yönetim → Sistem (API) aynı bilgiyi verir.
      const admin = client(next.base);
      assert.equal((await admin.login("admin", ADMIN_PASSWORD)).status, 200);
      const panel = (await admin.get("/api/admin/update")).data.data;
      assert.equal(panel.lastResult?.outcome, "withdrawn");
      assert.equal(panel.prepared, null);
    });
  });

  it("(2) hazır 9.0.2 geri çekildi, yayındaki en yeni 9.0.1 (hazırdakinden ESKİ) → 9.0.2 kurulmaz/silinir; 9.0.1 kurulur, tek geçiş", async () => {
    await withFeed("eski", async ctx => {
      await prepareDuringDay(ctx, [rel.v902, rel.v901], "9.0.2");
      ctx.feed.setReleases([rel.v901]);
      const next = await ctx.restart();
      assert.equal(await next.appVersion(), "9.0.1", "kurulabilir en yeni sürüm (9.0.1) çalışıyor");
      assert.deepEqual(appStarts(next.bootLog()), ["app/9.0.1"], "bu açılışta uygulama bir kez, 9.0.1 ile başlatıldı");
      assert.deepEqual(activated(ctx.root), ["9.0.1"], "geri çekilen 9.0.2 hiç etkinleştirilmedi");
      assert.ok(!existsSync(appDir(ctx.root, "9.0.2")), "9.0.2 açılımı silindi");
      assert.deepEqual(hazirList(ctx.root), []);
      const state = stateOf(ctx.root);
      assert.ok(state.history.some(item => item.event === "prepared-withdrawn" && item.version === "9.0.2"));
      assert.match(next.bootLog(), /9\.0\.2 sürümü yayından kaldırıldığı için kurulmadı/);
      assert.equal((await next.status()).updates.lastResult?.outcome, "success");
    });
  });

  it("(3) son denetim ağ hatasıyla döner → hazırdaki kurulur (bugünkü davranış); günlükte 'indiriliyor' değil 'hazırdaki paket kuruluyor'", async () => {
    await withFeed("agyok", async ctx => {
      await prepareDuringDay(ctx, [rel.v901], "9.0.1");
      ctx.feed.setDown(true);
      const next = await ctx.restart();
      assert.equal(await next.appVersion(), "9.0.1");
      assert.deepEqual(appStarts(next.bootLog()), ["app/9.0.1"]);
      assert.match(next.bootLog(), /son denetim yapılamadı/);
      assert.match(next.bootLog(), /9\.0\.1 sürümü hazırdaki paketten kuruluyor/);
      assert.doesNotMatch(next.bootLog(), /sürümü indiriliyor/, "hazır paket kurulurken yanıltıcı 'indiriliyor' yazmaz");
      assert.equal((await next.status()).updates.lastResult?.outcome, "success");
    });
  });

  it("(4) açılışta daha yeni sürüm var → o indirilip kurulur (bugünkü davranış); hazırdaki eski paket silinir", async () => {
    await withFeed("yeni", async ctx => {
      await prepareDuringDay(ctx, [rel.v901], "9.0.1");
      ctx.feed.setReleases([rel.v902, rel.v901]);
      const next = await ctx.restart();
      assert.equal(await next.appVersion(), "9.0.2");
      assert.deepEqual(appStarts(next.bootLog()), ["app/9.0.2"]);
      assert.deepEqual(activated(ctx.root), ["9.0.2"]);
      assert.equal(ctx.feed.zipHits("9.0.2"), 1);
      assert.deepEqual(hazirList(ctx.root), []);
      assert.doesNotMatch(next.bootLog(), /yayından kaldırıldığı/);
    });
  });
});
