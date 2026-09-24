// Uçtan uca güncelleme akışı: gerçek servis yöneticisi + gerçek uygulama süreçleri + sahte GitHub Releases.
import assert from "node:assert/strict";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, describe, it } from "node:test";
import { createApp } from "../server/app.mjs";
import { startSupervisor } from "../server/supervisor.mjs";
import { buildRelease, makeKeys, makeVersion, releaseFiles, startMockGithub } from "./update-helpers.mjs";

const ADMIN_PASSWORD = "Test-Admin-2026!";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const keys = makeKeys();
const work = mkdtempSync(path.join(tmpdir(), "destekofis-akis-"));
after(() => rmSync(work, { recursive: true, force: true }));

function capturingLog() {
  const lines = [];
  const write = level => (message, error) => lines.push(`${level} ${message}${error ? ` ${error.message}` : ""}`);
  return { lines, info: write("info"), warn: write("warn"), error: write("error"), debug() {} };
}

async function waitFor(check, { timeoutMs = 30_000, interval = 50, message = "Beklenen durum oluşmadı" } = {}) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    last = await check().catch(error => ({ error }));
    if (last && !last.error) return last;
    await sleep(interval);
  }
  throw new Error(`${message}: ${JSON.stringify(last)}`);
}

// Sürüm klasörleri ve (isteğe bağlı) önceden oluşturulmuş veritabanıyla bir kurulum kökü hazırlar.
async function prepareInstall(name, { versions = ["9.0.0"], current = { version: "9.0.0" }, seedUser = true, config } = {}) {
  const installRoot = path.join(work, name);
  for (const version of versions) {
    const spec = typeof version === "string" ? { version } : version;
    makeVersion(path.join(installRoot, "app", spec.version), spec.version, spec);
  }
  writeFileSync(path.join(installRoot, "app", "current.json"), JSON.stringify(current));
  if (config) {
    mkdirSync(path.join(installRoot, "config"), { recursive: true });
    writeFileSync(path.join(installRoot, "config", "guncelleme.json"), JSON.stringify(config));
  }
  if (seedUser) {
    const app = createApp({ dataDir: path.join(installRoot, "data"), backupDir: path.join(installRoot, "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD } });
    const { hashPassword } = await import("../server/lib/passwords.mjs");
    const timestamp = new Date().toISOString();
    app.store.run("INSERT INTO users (id, username, display_name, role, password_hash, must_change_password, created_at, updated_at) VALUES ('user-kalici', 'kalici', 'Kalıcı Kullanıcı', 'personel', ?, 0, ?, ?)", hashPassword("Kalici-Parola-2026"), timestamp, timestamp);
    await app.close();
  }
  return installRoot;
}

async function supervise(installRoot, github, { appVersion = "9.0.0", ...options } = {}) {
  const log = capturingLog();
  const supervisor = await startSupervisor({
    installRoot,
    appDir: path.join(installRoot, "app", appVersion),
    port: 0,
    host: "127.0.0.1",
    discovery: false,
    log,
    env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_LOG_LEVEL: "warn", HUKUK_BOOTSTRAP_VERSION: "2", HUKUK_BACKUP_START_DELAY_MS: "600000" },
    trustedKeys: keys.trusted,
    githubApi: github.url,
    updateFeed: "github:test/repo",
    updateRetryDelays: [],
    trialTimeoutMs: 30_000,
    ...options,
  });
  const base = `http://127.0.0.1:${supervisor.port}`;
  const health = async () => (await fetch(`${base}/__supervisor/health`)).json();
  const appHealth = async () => {
    const response = await fetch(`${base}/api/health`);
    return response.status === 200 ? (await response.json()).data : null;
  };
  return { supervisor, base, log, health, appHealth };
}

async function login(base, username, password) {
  const response = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
  const cookie = response.headers.get("set-cookie")?.split(";")[0] || "";
  return { status: response.status, cookie, body: await response.json() };
}

const readJson = file => JSON.parse(readFileSync(file, "utf8"));
const schemaOf = dbPath => {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare("PRAGMA user_version").get().user_version;
  } finally {
    db.close();
  }
};

describe("otomatik güncelleme akışı", () => {
  it("açılışta yeni sürüm indirilir, bakım sayfası gösterilir, yeni sürüme geçilir; veriler korunur", async () => {
    // Yeni sürüm yavaş açılsın ki bakım penceresi gözlenebilsin.
    const release = buildRelease(makeVersion(path.join(work, "src-a"), "9.0.1", { serverPrefix: "await new Promise(resolve => setTimeout(resolve, 1500));" }), path.join(work, "rel-a"), keys);
    const github = await startMockGithub([{ tag: "v9.0.1", files: releaseFiles(release) }]);
    const installRoot = await prepareInstall("a", { versions: ["8.9.0", "9.0.0"], current: { version: "9.0.0", previous: "8.9.0" } });
    const { supervisor, base, health, appHealth, log } = await supervise(installRoot, github);
    try {
      const phases = new Set();
      let maintenancePage = "";
      const done = await waitFor(async () => {
        const state = await health();
        phases.add(state.phase);
        if (state.phase === "updating" && !maintenancePage) {
          const page = await fetch(`${base}/`);
          if (page.status === 503) maintenancePage = await page.text();
        }
        const app = state.phase === "ready" ? await appHealth() : null;
        if (app?.version === "9.0.1") return app;
        throw new Error(state.phase);
      }, { timeoutMs: 60_000, interval: 25 });
      assert.equal(done.version, "9.0.1");
      assert.ok(phases.has("updating"), `bakım aşaması görülmeli: ${[...phases]}`);
      assert.match(maintenancePage, /Sistem güncelleniyor/);
      assert.match(maintenancePage, /1 dakika sonra tekrar deneyin/);

      const current = readJson(path.join(installRoot, "app", "current.json"));
      assert.equal(current.version, "9.0.1");
      assert.equal(current.previous, "9.0.0");
      assert.ok(!current.pending, "onaylanmış olmalı");
      assert.ok(existsSync(path.join(installRoot, "app", "9.0.1", ".paket.json")));
      assert.ok(!existsSync(path.join(installRoot, "app", "8.9.0")), "eski sürüm temizlenmeli");
      assert.ok(existsSync(path.join(installRoot, "app", "9.0.0")), "önceki sürüm geri dönüş için saklanmalı");
      assert.ok(readdirSync(path.join(installRoot, "backups")).some(name => name.includes("guncelleme-oncesi-9-0-0")), "güncelleme öncesi yedek alınmalı");
      const history = readJson(path.join(installRoot, "app", "update-state.json")).history.map(item => item.event);
      assert.ok(history.includes("installed"), history.join(","));

      const kept = await login(base, "kalici", "Kalici-Parola-2026");
      assert.equal(kept.status, 200, "güncelleme öncesi kullanıcı korunmalı");
      assert.equal(kept.body.data.name, "Kalıcı Kullanıcı");
      assert.equal(supervisor.updates.status().lastResult.outcome, "success");
    } catch (error) {
      console.log(log.lines.join("\n"));
      throw error;
    } finally {
      await supervisor.stop();
      await github.close();
    }
  });

  it("yeni sürüm açılamazsa veritabanı ve sürüm geri alınır; o sürüm bir daha denenmez", async () => {
    // Bozuk sürüm: veritabanı şemasını değiştirip çöker (başarısız bir göçü taklit eder).
    const broken = `import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
const dir = process.env.HUKUK_DATA_DIR;
const db = new DatabaseSync(existsSync(dir + "/hukuk-ofisi.sqlite") ? dir + "/hukuk-ofisi.sqlite" : dir + "/destekofis.sqlite");
db.exec("PRAGMA user_version = 99");
db.close();
process.exit(3);
`;
    const release = buildRelease(makeVersion(path.join(work, "src-b"), "9.0.1", { serverSource: broken }), path.join(work, "rel-b"), keys);
    const github = await startMockGithub([{ tag: "v9.0.1", files: releaseFiles(release) }]);
    const installRoot = await prepareInstall("b");
    const { supervisor, base, appHealth, log } = await supervise(installRoot, github);
    try {
      await waitFor(async () => {
        const result = supervisor.updates.status().lastResult;
        if (result?.outcome === "rolled-back") return result;
        throw new Error(JSON.stringify(result));
      }, { timeoutMs: 60_000 });
      const app = await waitFor(async () => (await appHealth()) || Promise.reject(new Error("hazır değil")));
      assert.equal(app.version, "9.0.0");
      const current = readJson(path.join(installRoot, "app", "current.json"));
      assert.equal(current.version, "9.0.0");
      assert.equal(current.rolledBackFrom, "9.0.1");
      assert.equal(schemaOf(path.join(installRoot, "data", "destekofis.sqlite")), LATEST_VERSION, "veritabanı güncelleme öncesi hâline dönmeli");
      assert.ok(readdirSync(path.join(installRoot, "backups")).some(name => name.includes("basarisiz-guncelleme-9-0-1")));
      assert.ok(readJson(path.join(installRoot, "app", "update-state.json")).failed["9.0.1"]);
      assert.equal((await login(base, "kalici", "Kalici-Parola-2026")).status, 200);

      const again = await supervisor.updates.runCheck();
      assert.equal(again.status, "up-to-date");
      assert.deepEqual(again.skipped, ["9.0.1"]);
    } catch (error) {
      console.log(log.lines.join("\n"));
      throw error;
    } finally {
      await supervisor.stop();
      await github.close();
    }
  });

  it("otomatik güncelleme kapalıyken yönetici panelinden denetlenip kurulabilir", async () => {
    const release = buildRelease(makeVersion(path.join(work, "src-c"), "9.0.1"), path.join(work, "rel-c"), keys);
    const github = await startMockGithub([{ tag: "v9.0.1", files: releaseFiles(release) }]);
    const installRoot = await prepareInstall("c", { config: { enabled: false } });
    const { supervisor, base, appHealth, log } = await supervise(installRoot, github);
    try {
      await waitFor(async () => (await appHealth()) || Promise.reject(new Error("hazır değil")));
      assert.equal(github.hits.list, 0, "otomatik denetim yapılmamalı");
      const admin = await login(base, "admin", ADMIN_PASSWORD);
      assert.equal(admin.status, 200);
      const call = async (method, url, body) => {
        const response = await fetch(`${base}${url}`, { method, headers: { cookie: admin.cookie, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
        return { status: response.status, body: await response.json() };
      };
      const status = await call("GET", "/api/admin/update");
      assert.equal(status.body.data.enabled, true);
      assert.equal(status.body.data.autoUpdate, false);
      assert.equal(status.body.data.currentVersion, "9.0.0");

      const checked = await call("POST", "/api/admin/update/check");
      assert.equal(checked.status, 200);
      assert.equal(checked.body.data.available.version, "9.0.1");
      assert.match(checked.body.data.available.notes, /Test sürümü/);

      const staff = await login(base, "kalici", "Kalici-Parola-2026");
      const forbidden = await fetch(`${base}/api/admin/update/apply`, { method: "POST", headers: { cookie: staff.cookie } });
      assert.equal(forbidden.status, 403, "personel güncelleme başlatamaz");

      const applied = await call("POST", "/api/admin/update/apply");
      assert.equal(applied.status, 200);
      assert.equal(applied.body.data.accepted, true);
      const app = await waitFor(async () => {
        const data = await appHealth();
        if (data?.version === "9.0.1") return data;
        throw new Error(data?.version || "bakımda");
      }, { timeoutMs: 60_000 });
      assert.equal(app.version, "9.0.1");

      const again = await login(base, "admin", ADMIN_PASSWORD);
      const settings = await fetch(`${base}/api/admin/update/settings`, { method: "PUT", headers: { cookie: again.cookie, "content-type": "application/json" }, body: JSON.stringify({ autoUpdate: true, channel: "beta" }) });
      const saved = (await settings.json()).data;
      assert.equal(saved.autoUpdate, true);
      assert.equal(saved.channel, "beta");
      assert.equal(saved.lastResult.outcome, "success");
      const audit = await fetch(`${base}/api/admin/audit?type=system.update`, { headers: { cookie: again.cookie } });
      assert.ok((await audit.json()).data.some(item => item.type === "system.update_settings"));
    } catch (error) {
      console.log(log.lines.join("\n"));
      throw error;
    } finally {
      await supervisor.stop();
      await github.close();
    }
  });

  it("elektrik kesintisinden kalan onaylanmamış sürüm açılışta denenir, açılmazsa önceki sürüme dönülür", async () => {
    const github = await startMockGithub([]);
    const installRoot = await prepareInstall("d", { versions: ["9.0.0", { version: "9.0.1", serverSource: "process.exit(4);\n" }], current: { version: "9.0.1", previous: "9.0.0", pending: true } });
    const { supervisor, appHealth, log } = await supervise(installRoot, github, { appVersion: "9.0.1" });
    try {
      const app = await waitFor(async () => (await appHealth()) || Promise.reject(new Error("hazır değil")), { timeoutMs: 60_000 });
      assert.equal(app.version, "9.0.0");
      const current = readJson(path.join(installRoot, "app", "current.json"));
      assert.equal(current.version, "9.0.0");
      assert.equal(current.rolledBackFrom, "9.0.1");
      assert.ok(readJson(path.join(installRoot, "app", "update-state.json")).failed["9.0.1"]);
    } catch (error) {
      console.log(log.lines.join("\n"));
      throw error;
    } finally {
      await supervisor.stop();
      await github.close();
    }
  });

  it("güncelleme sunucusuna ulaşılamazsa uygulama normal açılır", async () => {
    const installRoot = await prepareInstall("e", { seedUser: false });
    const { supervisor, appHealth, log } = await supervise(installRoot, { url: "http://127.0.0.1:9" });
    try {
      const app = await waitFor(async () => (await appHealth()) || Promise.reject(new Error("hazır değil")));
      assert.equal(app.version, "9.0.0");
      await supervisor.updates.idle();
      const status = await waitFor(async () => {
        const value = supervisor.updates.status();
        if (value.lastCheck) return value;
        throw new Error("denetim bitmedi");
      });
      assert.equal(status.lastCheck.status, "error");
      assert.match(status.lastError, /ulaşılamadı|bağlanılamadı/);
    } catch (error) {
      console.log(log.lines.join("\n"));
      throw error;
    } finally {
      await supervisor.stop();
    }
  });
});
