// Windows kurulum düzeninin (bootstrap.mjs → app/<sürüm> → servis yöneticisi) platformdan bağımsız sınaması.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", HUKUK_DISCOVERY_PORT: "0", HUKUK_LOG_LEVEL: "warn", HUKUK_ADMIN_PASSWORD: "Test-Admin-2026!", HUKUK_DATA_DIR: "", HUKUK_BACKUP_DIR: "" },
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
