// Windows kurulum düzeninin (bootstrap.mjs → app/<sürüm> → servis yöneticisi) platformdan bağımsız sınaması.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { after, before, describe, it } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
const run = promisify(execFile);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = () =>
  new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

function stageInstall(installRoot, versions = [version]) {
  for (const item of versions) {
    const target = path.join(installRoot, "app", item);
    for (const name of ["server", "client", "package.json"]) cpSync(path.join(root, name), path.join(target, name), { recursive: true });
    mkdirSync(path.join(target, "tools"), { recursive: true });
    cpSync(path.join(root, "tools", "backup.mjs"), path.join(target, "tools", "backup.mjs"));
  }
  writeFileSync(path.join(installRoot, "app", "current.json"), JSON.stringify({ version: versions[0] }));
  cpSync(path.join(root, "packaging", "windows", "bootstrap.mjs"), path.join(installRoot, "bootstrap.mjs"));
}

async function startService(installRoot, port) {
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(installRoot, "bootstrap.mjs")], {
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", HUKUK_DISCOVERY_PORT: "0", HUKUK_LOG_LEVEL: "warn", HUKUK_ADMIN_PASSWORD: "Test-Admin-2026!", HUKUK_DATA_DIR: "", HUKUK_BACKUP_DIR: "", HUKUK_UPDATES: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", chunk => (output += chunk));
  child.stderr.on("data", chunk => (output += chunk));
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.status === 200) return { child, output: () => output };
    } catch {
      // henüz açılmadı
    }
    if (child.exitCode !== null) break;
    await sleep(100);
  }
  child.kill("SIGKILL");
  throw new Error(`Servis açılmadı:\n${output}`);
}

describe("kurulum sonrası sürüm etkinleştirme (bootstrap etkinlestir)", () => {
  const bootstrap = path.join(root, "packaging", "windows", "bootstrap.mjs");
  const fakeInstall = versions => {
    const dir = mkdtempSync(path.join(tmpdir(), "destekofis-etkin-"));
    cpSync(bootstrap, path.join(dir, "bootstrap.mjs"));
    for (const item of versions) {
      mkdirSync(path.join(dir, "app", item, "server"), { recursive: true });
      writeFileSync(path.join(dir, "app", item, "server", "supervisor.mjs"), "");
    }
    return dir;
  };
  const activate = async (dir, target) => (await run(process.execPath, [path.join(dir, "bootstrap.mjs"), "etkinlestir", target])).stdout;
  const current = dir => JSON.parse(readFileSync(path.join(dir, "app", "current.json"), "utf8"));

  it("ilk kurulumda kurulan sürümü etkinleştirir", async () => {
    const dir = fakeInstall(["1.3.0"]);
    try {
      await activate(dir, "1.3.0");
      assert.equal(current(dir).version, "1.3.0");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("yükseltmede yeni sürümü etkinleştirir, öncekini saklar, daha eskileri siler", async () => {
    const dir = fakeInstall(["1.1.0", "1.2.0", "1.3.0"]);
    try {
      writeFileSync(path.join(dir, "app", "current.json"), JSON.stringify({ version: "1.2.0", previous: "1.1.0" }));
      await activate(dir, "1.3.0");
      assert.equal(current(dir).version, "1.3.0");
      assert.equal(current(dir).previous, "1.2.0");
      assert.deepEqual(readdirSync(path.join(dir, "app")).filter(name => /^\d/.test(name)).sort(), ["1.2.0", "1.3.0"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("otomatik güncellemeyle gelmiş daha yeni sürümü eski kurulum dosyası geri almaz", async () => {
    const dir = fakeInstall(["1.3.0", "1.3.1"]);
    try {
      writeFileSync(path.join(dir, "app", "current.json"), JSON.stringify({ version: "1.3.1", previous: "1.3.0" }));
      const output = await activate(dir, "1.3.0");
      assert.match(output, /Daha yeni bir sürüm etkin/);
      assert.equal(current(dir).version, "1.3.1");
      assert.ok(existsSync(path.join(dir, "app", "1.3.0")));
      await assert.rejects(activate(dir, "9.9.9"), error => error.code === 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Windows kurulum düzeni (bootstrap)", () => {
  let installRoot;
  before(() => {
    installRoot = mkdtempSync(path.join(tmpdir(), "destekofis-kurulum-"));
    stageInstall(installRoot);
  });
  after(() => rmSync(installRoot, { recursive: true, force: true }));

  it("bootstrap etkin sürümü açar; veri kurulum kökündeki data klasörüne yazılır", async () => {
    const port = await freePort();
    const service = await startService(installRoot, port);
    try {
      const health = await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
      assert.equal(health.data.version, version);
      assert.ok(existsSync(path.join(installRoot, "data", "hukuk-ofisi.sqlite")), "veritabanı kurulum kökündeki data klasöründe olmalı");
      assert.ok(!existsSync(path.join(installRoot, "app", version, "data")), "uygulama klasörüne veri yazılmamalı");
    } finally {
      service.child.kill("SIGTERM");
      await new Promise(resolve => service.child.once("exit", resolve));
    }
  });

  it("'surum' ve 'yedek' alt komutları çalışır", async () => {
    const { stdout } = await run(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(installRoot, "bootstrap.mjs"), "surum"]);
    assert.equal(stdout.trim(), version);
    await run(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(installRoot, "bootstrap.mjs"), "yedek"], { env: { ...process.env, HUKUK_DATA_DIR: "", HUKUK_BACKUP_DIR: "" } });
    assert.ok(readdirSync(path.join(installRoot, "backups")).some(name => name.endsWith("-manuel.sqlite")));
  });

  it("etkin sürüm açılamazsa önceki sürüme dönülür ve açılamayan sürüm işaretlenir", async () => {
    const broken = path.join(installRoot, "app", "99.0.0", "server");
    mkdirSync(broken, { recursive: true });
    writeFileSync(path.join(broken, "supervisor.mjs"), 'throw new Error("bozuk sürüm");\n');
    writeFileSync(path.join(installRoot, "app", "current.json"), JSON.stringify({ version: "99.0.0", previous: version, pending: true }));
    const port = await freePort();
    const service = await startService(installRoot, port);
    try {
      const health = await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
      assert.equal(health.data.version, version);
      const current = JSON.parse(readFileSync(path.join(installRoot, "app", "current.json"), "utf8"));
      assert.equal(current.version, version);
      assert.equal(current.fallbackFrom, "99.0.0");
    } finally {
      service.child.kill("SIGTERM");
      await new Promise(resolve => service.child.once("exit", resolve));
      rmSync(path.join(installRoot, "app", "99.0.0"), { recursive: true, force: true });
    }
  });

  it("current.json bozuk veya olmayan sürümü gösteriyorsa kurulu en yeni sürümle açılır", async () => {
    writeFileSync(path.join(installRoot, "app", "current.json"), JSON.stringify({ version: "9.9.9" }));
    const port = await freePort();
    const service = await startService(installRoot, port);
    try {
      const health = await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
      assert.equal(health.data.version, version);
    } finally {
      service.child.kill("SIGTERM");
      await new Promise(resolve => service.child.once("exit", resolve));
    }
  });
});

describe("kurulum sonrası sağlık kontrolü (bootstrap saglik)", () => {
  const bootstrap = path.join(root, "packaging", "windows", "bootstrap.mjs");
  let dir;
  before(() => {
    dir = mkdtempSync(path.join(tmpdir(), "destekofis-saglik-"));
    cpSync(bootstrap, path.join(dir, "bootstrap.mjs"));
    mkdirSync(path.join(dir, "logs"));
    writeFileSync(path.join(dir, "logs", "servis.log"), "ilk satir\nError: listen EADDRINUSE 127.0.0.1:5123\n");
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  // Belirtilen yanıtı veren sahte sunucuyla "saglik" alt komutunu çalıştırır; çıkış kodu ve çıktıyı döndürür.
  async function check(respond, seconds = 2) {
    const server = respond
      ? await new Promise(resolve => {
          const created = http.createServer((req, res) => respond(res));
          created.listen(0, "127.0.0.1", () => resolve(created));
        })
      : null;
    const port = server ? server.address().port : await freePort();
    try {
      const { stdout } = await run(process.execPath, [path.join(dir, "bootstrap.mjs"), "saglik", String(seconds)], { env: { ...process.env, PORT: String(port) } });
      return { code: 0, stdout };
    } catch (error) {
      return { code: error.code, stdout: error.stdout };
    } finally {
      server?.close();
    }
  }
  const json = (status, body) => res => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  it("sağlık ucu 200 dönünce hemen başarılı olur", async () => {
    const result = await check(json(200, { ok: true, data: { status: "ok" } }));
    assert.equal(result.code, 0);
    assert.match(result.stdout, /basarili/);
  });

  it("servis bakım yanıtı veriyorsa (açılışta güncelleme) çalışıyor sayılır", async () => {
    const result = await check(json(503, { ok: false, code: "MAINTENANCE", phase: "updating" }));
    assert.equal(result.code, 0);
    assert.match(result.stdout, /suruyor/);
  });

  it("servis başlatılamadıysa veya hiç yanıt yoksa başarısız olur ve servis günlüğünü yazdırır", async () => {
    const failed = await check(json(503, { ok: false, code: "MAINTENANCE", phase: "failed" }));
    assert.equal(failed.code, 1);
    assert.match(failed.stdout, /başlatılamadı/);
    assert.match(failed.stdout, /EADDRINUSE/, "hata nedeni kurulum günlüğüne düşmeli");
    const none = await check(null);
    assert.equal(none.code, 1);
    assert.match(none.stdout, /bağlantı yok/);
  });
});
