// Otomatik güncelleme — GERÇEK süreçlerle (kullanıcı, 10.10.2026: "kodda olan, teoride olan… gerçekten alıyor mu doğrula").
// Ayrı süreçte gerçek servis yöneticisi (test/guncelleme-gercek/hizmet.mjs: bootstrap gibi app\<sürüm>\server\supervisor.mjs'i açar),
// onun açtığı gerçek uygulama süreci, yerel sahte yayın kaynağı (GitHub API biçimi, test imzalı bildirge + gerçek güncelleme paketi),
// gerçek HTTP istekleri (kullanıcı etkinliği) ve gerçek saat. Bu testte KISALTILAN yalnız sürelerdir (açıkça):
//   15 dk boşta → birkaç saniye, 6 sa periyodik denetim → ~1 sn, 60 dk yeniden bakış → ~1 sn.
// Üretim süreleriyle bir kez yapılan gerçek koşu: test/guncelleme-gercek/gercek-kos.mjs (kanıt docs/kanit/2026-10-10/otomatik-guncelleme).
//  S1 açılışta: yeni sürüm varken servis açılır → kimse kullanmıyor → kurulur; yedek alınır; veriler aynı.
//  S2 çalışırken bulunur, kullanıcı etkin (mesai içi): KURULMAZ, "hazır"; etkinlik kesilince boşta süresi dolunca kurulur.
//  S4 mesai dışı (sunucunun GERÇEK saati, TZ ile mesai dışına düşen saat dilimi): kullanıcı etkin olsa da kurulur.
//  S5 "kendiliğinden kur" kapalı: denetlenir, "hazır" görünür, KURULMAZ; yönetici Şimdi Güncelle deyince kurulur.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, buildTestRelease, client, counts, prepareInstall, quietZoneNow, releaseEntry, sleep, startActivity, startFeed, startService, waitFor } from "./guncelleme-gercek/ortak.mjs";

const work = mkdtempSync(path.join(tmpdir(), "destekofis-gercek-gunc-"));
let release;
before(() => {
  release = releaseEntry(buildTestRelease(work, "9.0.1"));
});
after(() => rmSync(work, { recursive: true, force: true }));

const readJson = file => JSON.parse(readFileSync(file, "utf8"));
async function withService(name, { config, feedOptions, ...serviceOptions }, body) {
  const installRoot = path.join(work, name);
  const before = await prepareInstall(installRoot, { config });
  const feed = await startFeed(feedOptions);
  const service = await startService(installRoot, { feed: feed.url, ...serviceOptions });
  try {
    await body({ installRoot, feed, service, before });
  } catch (error) {
    console.log(`---- ${name} servis günlüğü (son) ----\n${service.log().slice(-6000)}`);
    throw error;
  } finally {
    await service.stop();
    await feed.close();
  }
}
const waitVersion = (service, version, timeoutMs = 90_000) => waitFor(async () => ((await service.appVersion()) === version ? true : Promise.reject(new Error(`sürüm ${await service.appVersion()}`))), { timeoutMs, interval: 250, message: `${version} sürümüne geçilmedi` });

describe("otomatik güncelleme — gerçek süreçlerle", () => {
  it("S1 açılışta: yeni sürüm varken servis açılır, kimse kullanmıyor → kendiliğinden kurulur; yedek alınır, veriler aynı", async () => {
    // Mesai içi zorlanır: kurulumun nedeni mesai dışı değil, açılışta sunucunun boş olmasıdır.
    await withService("s1", { feedOptions: { releases: [release] }, quiet: "never", retryDelays: [] }, async ({ installRoot, feed, service, before }) => {
      await waitVersion(service, "9.0.1");
      assert.ok(feed.listHits() >= 1, "açılışta kaynak sorgulandı");
      assert.equal(feed.zipHits(), 1, "paket bir kez indirildi");
      const status = await service.status();
      assert.equal(status.updates.lastResult?.outcome, "success");
      assert.equal(status.updates.lastResult?.previous, "9.0.0");
      assert.equal(readJson(path.join(installRoot, "app", "current.json")).version, "9.0.1");
      assert.ok(readdirSync(path.join(installRoot, "backups", "001 - Şirket 1")).some(file => /guncelleme-oncesi-9-0-0/.test(file)), "güncelleme öncesi yedek");
      assert.deepEqual(counts(installRoot), before, "kullanıcı, cari, Kasa sayıları ve Kasa toplamı aynı");
      assert.match(service.log(), /Yeni sürüm bulundu: 9\.0\.1/);
      assert.match(service.log(), /DestekOfis 9\.0\.1 sürümüne güncellendi \(önceki 9\.0\.0\)/);
      const staff = await client(service.base).login("kalici", "Kalici-Parola-2026");
      assert.equal(staff.status, 200, "güncelleme öncesi kullanıcı giriş yapar");
    });
  });

  it("S2 kullanıcı çalışırken (mesai içi) bulunan sürüm KURULMAZ, 'hazır' görünür; etkinlik kesilince boşta süresi dolunca kurulur", async () => {
    const IDLE = 4000;
    await withService("s2", { feedOptions: { releases: [] }, quiet: "never", retryDelays: [], timings: { idleMs: IDLE, periodicCheckMs: 800, periodicJitterMs: 0, deferRecheckMs: 600 } }, async ({ installRoot, feed, service, before }) => {
      assert.equal(await service.appVersion(), "9.0.0");
      const activity = await startActivity(service.base, { intervalMs: 400 });
      feed.setReleases([release]);
      const found = await waitFor(async () => {
        const status = await service.status();
        return status.updates.deferred ? status : Promise.reject(new Error("henüz ertelenmedi"));
      }, { timeoutMs: 20_000 });
      assert.equal(found.updates.deferred.version, "9.0.1");
      assert.equal(found.updates.available?.version, "9.0.1");
      assert.equal(found.activity.busy, true);
      // Yönetici paneli de "hazır" gösterir (bu istek de etkinliktir; zaten çalışılıyor).
      const admin = client(service.base);
      assert.equal((await admin.login("admin", ADMIN_PASSWORD)).status, 200);
      const panel = await admin.get("/api/admin/update");
      assert.equal(panel.data.data.available?.version, "9.0.1");
      assert.equal(panel.data.data.deferred?.version, "9.0.1");
      // Kullanıcı çalışmayı sürdürürken birçok periyodik denetim ve yeniden bakış geçer; kurulmamalı.
      const checksBefore = feed.listHits();
      await sleep(3 * IDLE);
      assert.ok(feed.listHits() - checksBefore >= 5, `çalışırken de denetlendi (${feed.listHits() - checksBefore})`);
      assert.equal(feed.zipHits(), 0, "kullanıcı çalışırken paket indirilmedi");
      assert.equal(await service.appVersion(), "9.0.0", "kullanıcı çalışırken kurulmadı");
      const lastAt = await activity.stop();
      await waitVersion(service, "9.0.1", 60_000);
      const status = await service.status();
      const installedAt = Date.parse(status.updates.lastResult.at);
      assert.ok(installedAt - lastAt >= IDLE, `son istekten ${installedAt - lastAt} ms sonra kuruldu; boşta süresi ${IDLE} ms dolmadan kurulmamalı`);
      assert.equal(status.updates.lastResult.outcome, "success");
      assert.match(service.log(), /9\.0\.1 sürümü hazır; kullanıcılar çalışıyor/);
      assert.deepEqual(counts(installRoot), before);
    });
  });

  it("S4 mesai dışı (sunucunun gerçek saati; mesai dışındaki bir saat dilimi): kullanıcı çalışırken de kurulur", async () => {
    const zone = quietZoneNow();
    assert.ok(zone, "her an mesai dışında bir saat dilimi vardır");
    await withService("s4", { feedOptions: { releases: [] }, tz: zone.tz, retryDelays: [], timings: { periodicCheckMs: 800, periodicJitterMs: 0 } }, async ({ installRoot, feed, service, before }) => {
      // Saat dilimi servis sürecinde gerçekten etkin mi (aksi hâlde test bir şey kanıtlamaz).
      assert.equal(service.hello.offsetMinutes, zone.offset * 60, `servisin saat dilimi ${zone.tz} (${service.hello.localTime})`);
      assert.equal(service.hello.quietNow, true, `servisin yerel saati mesai dışı (${service.hello.localTime})`);
      const activity = await startActivity(service.base, { intervalMs: 300 });
      try {
        feed.setReleases([release]);
        await waitVersion(service, "9.0.1", 60_000);
        const status = await service.status();
        assert.ok(Date.parse(status.updates.lastResult.at) - activity.lastAt < 15 * 60_000, "kullanıcı etkinken (15 dk dolmadan) kuruldu");
        assert.equal(status.updates.deferred, null, "ertelenmedi");
      } finally {
        await activity.stop();
      }
      assert.deepEqual(counts(installRoot), before);
    });
  });

  it("S5 'kendiliğinden kur' kapalı: açılışta ve periyodik denetlenir, 'hazır' görünür, boşta ve mesai dışında da KURULMAZ; Şimdi Güncelle ile kurulur", async () => {
    await withService("s5", { config: { enabled: false }, feedOptions: { releases: [release] }, quiet: "always", retryDelays: [], timings: { idleMs: 500, periodicCheckMs: 700, periodicJitterMs: 0, deferRecheckMs: 500 } }, async ({ installRoot, feed, service, before }) => {
      const found = await waitFor(async () => {
        const status = await service.status();
        return status.updates.available ? status : Promise.reject(new Error("henüz bulunmadı"));
      }, { timeoutMs: 20_000 });
      assert.equal(found.updates.autoUpdate, false);
      assert.equal(found.updates.available.version, "9.0.1");
      await sleep(5000);
      assert.ok(feed.listHits() >= 4, `kapalıyken de periyodik denetlendi (${feed.listHits()})`);
      assert.equal(feed.zipHits(), 0, "paket indirilmedi");
      assert.equal(await service.appVersion(), "9.0.0", "kapalıyken kurulmadı (sunucu boşta ve mesai dışı olsa da)");
      assert.match(service.log(), /kendiliğinden kurulum kapalı, kurulmayacak/);
      const admin = client(service.base);
      assert.equal((await admin.login("admin", ADMIN_PASSWORD)).status, 200);
      const panel = await admin.get("/api/admin/update");
      assert.equal(panel.data.data.available?.version, "9.0.1", "yönetici panelinde 'hazır'");
      assert.equal(panel.data.data.autoUpdate, false);
      const applied = await admin.post("/api/admin/update/apply");
      assert.equal(applied.status, 200, JSON.stringify(applied.data));
      assert.equal(applied.data.data.accepted, true);
      await waitVersion(service, "9.0.1");
      assert.ok(existsSync(path.join(installRoot, "app", "9.0.1", ".paket.json")));
      assert.deepEqual(counts(installRoot), before);
    });
  });
});
