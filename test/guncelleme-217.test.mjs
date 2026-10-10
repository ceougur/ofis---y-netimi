// 2.0.17 madde 4 (kullanıcı: "güncelleme geç geliyor"): periyodik denetim, 30 sn zaman aşımı, elle denetimde 3 deneme,
// per_page=10, API'siz yedek yol (releases/latest/download/destekofis-guncelleme.json), mesai içinde erteleme.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createUpdateOrchestrator, isQuietTime } from "../server/lib/update-orchestrator.mjs";
import { createUpdater } from "../server/lib/updater.mjs";
import { buildRelease, makeKeys, makeVersion, releaseFiles, startMockGithub } from "./update-helpers.mjs";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const quiet = { info() {}, warn() {}, error() {} };

describe("güncelleyici: zaman aşımı, per_page, yeniden deneme, yedek yol", () => {
  const keys = makeKeys();
  let work;
  let github;
  let release;
  const updaterFor = (overrides = {}) => {
    const appsDir = path.join(work, "kurulum", "app");
    mkdirSync(appsDir, { recursive: true });
    return createUpdater({ appsDir, configDir: path.join(work, "kurulum", "config"), currentVersion: "9.0.0", trustedKeys: keys.trusted, githubApi: github.url, githubWeb: github.url, defaultFeed: "github:test/repo", bootstrapVersion: 2, checkRetryDelaysMs: [10, 10], log: quiet, ...overrides });
  };
  before(async () => {
    work = mkdtempSync(path.join(tmpdir(), "destekofis-g217-"));
    release = buildRelease(makeVersion(path.join(work, "src-9.0.1"), "9.0.1"), path.join(work, "rel-9.0.1"), keys);
    github = await startMockGithub([{ tag: "v9.0.1", files: releaseFiles(release) }, { tag: "v9.0.0", files: {} }]);
  });
  after(async () => {
    await github?.close();
    rmSync(work, { recursive: true, force: true });
  });

  it("varsayılan istek zaman aşımı 30 sn; liste isteği per_page=10", async () => {
    const seen = [];
    const updater = updaterFor({
      fetchImpl: (url, options) => {
        seen.push(String(url));
        return globalThis.fetch(url, options);
      },
    });
    await updater.check();
    assert.ok(seen[0].includes("per_page=10"), seen[0]);
    const source = readFileSync(new URL("../server/lib/updater.mjs", import.meta.url), "utf8");
    assert.match(source, /requestTimeoutMs = 30_000/);
  });

  it("elle denetim (attempts: 3): ilk iki istek ağ hatası, üçüncüsü sürümü bulur", async () => {
    let calls = 0;
    const updater = updaterFor({
      fetchImpl: (url, options) => {
        calls += 1;
        if (calls <= 2) return Promise.reject(Object.assign(new Error("boom"), { cause: { code: "ECONNRESET" } }));
        return globalThis.fetch(url, options);
      },
    });
    const once = await updater.check();
    assert.equal(once.status, "error");
    calls = 0;
    const found = await updater.check({ attempts: 3 });
    assert.equal(found.status, "available", JSON.stringify(found));
    assert.equal(found.version, "9.0.1");
  });

  it("API erişilemezse (5xx / istek sınırı) yedek yol: releases/latest/download bildirgesi okunur ve paket oradan iner", async () => {
    // API listesi 503 döner; yedek yol GitHub'ın "latest/download" adresinden bildirge ve paket verir.
    const files = releaseFiles(release);
    const fallback = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/repos/")) {
        res.writeHead(503);
        return res.end("busy");
      }
      const match = /^\/test\/repo\/releases\/latest\/download\/(.+)$/.exec(url.pathname);
      const name = match && decodeURIComponent(match[1]);
      if (!name || !files[name]) {
        res.writeHead(404);
        return res.end();
      }
      const data = Buffer.isBuffer(files[name]) ? files[name] : readFileSync(files[name]);
      res.writeHead(200, { "content-type": "application/octet-stream", "content-length": data.length });
      return res.end(data);
    });
    await new Promise(resolve => fallback.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${fallback.address().port}`;
    try {
      const updater = updaterFor({ githubApi: base, githubWeb: base });
      const found = await updater.check();
      assert.equal(found.status, "available", JSON.stringify(found));
      assert.equal(found.version, "9.0.1");
      assert.equal(found.viaFallback, true);
      assert.match(found.packageUrl, /releases\/latest\/download\//);
      const zip = await updater.download(found);
      assert.ok(zip.endsWith(".zip"));
    } finally {
      await new Promise(resolve => fallback.close(resolve));
    }
  });
});

describe("orkestratör: periyodik denetim ve mesai içinde erteleme", () => {
  const found = { status: "available", version: "9.0.1", manifest: { package: { size: 10 } }, retryable: false };
  const fakeUpdater = (result, { enabled = true } = {}) => {
    const calls = [];
    return {
      calls,
      config: () => ({ enabled, channel: "stable", feed: "github:test/repo" }),
      state: () => ({ lastCheck: null, failed: {}, history: [] }),
      check: async options => {
        calls.push(options);
        return typeof result === "function" ? result() : result;
      },
      // Kurulum başlarsa (boşta/mesai dışı) indirme burada kasten düşer; amaç yalnız "kurulum denendi mi"yi görmek.
      download: async () => {
        throw new Error("test: indirme yok");
      },
      addHistory() {},
    };
  };
  const controller = (busy = false) => ({ appVersion: () => "9.0.0", appDir: () => "/x", busy: () => busy, isRunning: () => true, stopping: () => false, async start() {}, async stop() {}, release() {}, setAppDir() {}, setPhase() {} });

  it("servis açıkken 6 saatte bir denetim (sahte süre: 30 ms + kayma)", async () => {
    const updater = fakeUpdater({ status: "up-to-date" });
    const orchestrator = createUpdateOrchestrator({ updater, controller: controller(), appsDir: "/tmp/x", runningVersion: "9.0.0", log: quiet, periodicCheckMs: 30, periodicJitterMs: 10, retryDelays: [] });
    // startup() yerine yalnız zamanlayıcı: startup gerçek kurulum klasörü ister.
    orchestrator.schedulePeriodic?.();
    await sleep(160);
    orchestrator.stop();
    assert.ok(updater.calls.length >= 3, `periyodik denetim sayısı ${updater.calls.length}`);
    assert.equal(orchestrator.status().periodicCheckMs, 30);
  });

  it("mesai içinde ve kullanıcı çalışırken bulunan sürüm kurulmaz, 'hazır' olarak bekler; mesai dışında kurulur", async () => {
    const updater = fakeUpdater(found);
    const busyOffice = createUpdateOrchestrator({ updater, controller: controller(true), appsDir: "/tmp/x", runningVersion: "9.0.0", log: quiet, quietTime: () => false, deferRecheckMs: 60_000, retryDelays: [] });
    await busyOffice.runCheck({ auto: true });
    await busyOffice.idle();
    const status = busyOffice.status();
    assert.equal(status.available?.version, "9.0.1");
    assert.equal(status.deferred?.version, "9.0.1", "mesai içinde ertelendi");
    assert.equal(status.state, "idle");
    busyOffice.stop();
    const idleOffice = createUpdateOrchestrator({ updater: fakeUpdater(found), controller: controller(false), appsDir: "/tmp/x", runningVersion: "9.0.0", log: quiet, quietTime: () => false, retryDelays: [] });
    await idleOffice.runCheck({ auto: true });
    await idleOffice.idle();
    assert.equal(idleOffice.status().deferred, null, "sunucu boştaysa kurulum hemen başlar (ertelenmez)");
    assert.equal(idleOffice.status().lastResult?.outcome, "failed", "kurulum denendi (sahte indirme düştü)");
    idleOffice.stop();
  });

  // 2.1.0 (kullanıcı, 10.10.2026: "kendiliğinden kur kapalıyken hiç sorulmuyor"): kapalıyken de açılışta ve periyodik denetlenir;
  // bulunan sürüm KURULMAZ, yöneticiye "hazır" görünür. Eski kodda kapalıyken updater.check hiç çağrılmıyordu.
  it("kendiliğinden kur KAPALIYKEN de açılışta ve 6 saatte bir denetlenir; bulunan sürüm kurulmaz, 'hazır' görünür", async () => {
    const updater = fakeUpdater(found, { enabled: false });
    let downloads = 0;
    updater.download = async () => {
      downloads += 1;
      throw new Error("kapalıyken indirme olmamalı");
    };
    // Sunucu boşta ve mesai dışı: kurulum için en elverişli an; yine de kurulmamalı.
    const orchestrator = createUpdateOrchestrator({ updater, controller: controller(false), appsDir: path.join(tmpdir(), "destekofis-yok-kapali"), runningVersion: "9.0.0", log: quiet, quietTime: () => true, periodicCheckMs: 30, periodicJitterMs: 5, deferRecheckMs: 20, retryDelays: [] });
    await orchestrator.startup();
    await orchestrator.idle();
    assert.equal(updater.calls.length, 1, "açılışta denetim yapılmalı (kapalıyken de)");
    await sleep(140);
    orchestrator.stop();
    await orchestrator.idle();
    assert.ok(updater.calls.length >= 3, `periyodik denetim kapalıyken de sürmeli (${updater.calls.length})`);
    const status = orchestrator.status();
    assert.equal(status.autoUpdate, false);
    assert.equal(status.available?.version, "9.0.1", "bulunan sürüm yöneticiye 'hazır' görünür");
    assert.equal(status.deferred?.version, "9.0.1");
    assert.equal(status.lastResult, null, "kurulum denenmedi");
    assert.equal(downloads, 0, "indirme başlamadı");
  });

  it("ertelenmiş sürüm, yönetici bu arada 'kendiliğinden kur'u kapatırsa saatlik bakışta kurulmaz", async () => {
    let enabled = true;
    const updater = fakeUpdater(found);
    updater.config = () => ({ enabled, channel: "stable", feed: "github:test/repo" });
    updater.saveConfig = changes => {
      if (changes.enabled !== undefined) enabled = Boolean(changes.enabled);
    };
    let downloads = 0;
    updater.download = async () => {
      downloads += 1;
      throw new Error("kapatıldıktan sonra indirme olmamalı");
    };
    let busy = true;
    const ctrl = { ...controller(), busy: () => busy };
    const orchestrator = createUpdateOrchestrator({ updater, controller: ctrl, appsDir: "/tmp/x", runningVersion: "9.0.0", log: quiet, quietTime: () => false, deferRecheckMs: 40, periodicCheckMs: 0, retryDelays: [] });
    await orchestrator.runCheck({ auto: true });
    assert.equal(orchestrator.status().deferred?.version, "9.0.1", "kullanıcı çalışırken ertelendi");
    await orchestrator.handle("config", { enabled: false });
    busy = false;
    await sleep(150);
    await orchestrator.idle();
    orchestrator.stop();
    assert.equal(downloads, 0, "kapatılan ayara rağmen kurulum başladı");
    assert.equal(orchestrator.status().lastResult, null);
    assert.equal(orchestrator.status().available?.version, "9.0.1", "sürüm 'hazır' kalır");
  });

  it("elle denetim 3 deneme ister; mesai dışı tanımı: hafta içi 20:00–07:00 ve hafta sonu", async () => {
    const updater = fakeUpdater({ status: "up-to-date" });
    const orchestrator = createUpdateOrchestrator({ updater, controller: controller(), appsDir: "/tmp/x", runningVersion: "9.0.0", log: quiet, retryDelays: [] });
    await orchestrator.handle("check");
    assert.equal(updater.calls.at(-1).attempts, 3);
    orchestrator.stop();
    assert.equal(isQuietTime(new Date(2026, 9, 1, 14, 0)), false, "perşembe 14:00 mesai");
    assert.equal(isQuietTime(new Date(2026, 9, 1, 21, 0)), true, "perşembe 21:00");
    assert.equal(isQuietTime(new Date(2026, 9, 3, 14, 0)), true, "cumartesi");
  });
});
