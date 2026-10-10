// Windows kurulum düzeninin (bootstrap.mjs → app/<sürüm> → servis yöneticisi) platformdan bağımsız sınaması.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
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

const alive = pid => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};

// Hizmeti durdurur ve UYGULAMA alt sürecinin de kapanmasını bekler. CI 532 (Windows Node 22, eb1437e): Windows'ta Node
// `kill("SIGTERM")`'ü TerminateProcess ile uygular — yalnız bootstrap süreci ölür, SIGTERM işleyicisi (servis yöneticisini
// düzgün durdurma) ÇALIŞMAZ; uygulama alt süreci öksüz kalır ve IPC kopunca kendi kapanışını yapar (Linux'ta SIGKILL ile ölçüldü:
// veri tabanı ~30 ms'de kapanıyor, süreç 1–6 sn yaşıyor). Eskiden test yalnız bootstrap'ın çıkışını bekliyordu; sonraki adım
// ("yedek") kapanmakta olan uygulamayla aynı veri tabanını açıyordu. Linux'ta SIGTERM yakalanır, servis yöneticisi uygulamayı bekler.
async function stopService(service, timeoutMs = 15000) {
  const exited = service.child.exitCode !== null || service.child.signalCode !== null ? Promise.resolve() : new Promise(resolve => service.child.once("exit", resolve));
  service.child.kill("SIGTERM");
  await exited;
  const started = Date.now();
  while (alive(service.appPid)) {
    if (Date.now() - started > timeoutMs) {
      try {
        process.kill(service.appPid, "SIGKILL");
      } catch {}
      throw new Error(`hizmet durduruldu ama uygulama süreci (pid ${service.appPid}) ${timeoutMs / 1000} sn içinde kapanmadı (öksüz süreç); servis çıktısının sonu: ${JSON.stringify(service.output().slice(-1500))}`);
    }
    await sleep(25);
  }
  return Date.now() - started;
}

// Hizmeti açar, işi yapar, durdurur. Temizlik (durdurma) hatası işin ASIL hatasını ezmez (ders 21).
async function withService(installRoot, t, work) {
  const port = await freePort();
  const service = await startService(installRoot, port);
  let failure = null;
  try {
    await work(service, port);
  } catch (error) {
    failure = error;
  }
  try {
    const closedAfter = await stopService(service);
    t.diagnostic(`uygulama alt süreci bootstrap kapandıktan ${closedAfter} ms sonra kapandı (${process.platform})`);
  } catch (cleanup) {
    if (!failure) failure = cleanup;
    else console.error(`temizlik de başarısız: ${cleanup.message}`);
  }
  if (failure) throw failure;
}

// bootstrap.mjs yedek — reddetmez; çıkış kodu, çıktılar ve süre döner (hata iletisine teşhis eklemek için).
function runBootstrapBackup(installRoot) {
  return new Promise(resolve => {
    const started = Date.now();
    execFile(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(installRoot, "bootstrap.mjs"), "yedek"], { env: { ...process.env, HUKUK_DATA_DIR: "", HUKUK_BACKUP_DIR: "" } }, (error, stdout, stderr) => {
      resolve({ code: error ? (error.code ?? 1) : 0, stdout: String(stdout).trim(), stderr: String(stderr).trim(), ms: Date.now() - started });
    });
  });
}

// Yedek düşerse hata iletisine: komutun çıktısı (SQLite genişletilmiş hata kodu dahil), veri klasöründeki dosyalar ve boyutları,
// bilinen uygulama süreçlerinin yaşayıp yaşamadığı — bir sonraki Windows kırmızısı kök nedeni söylesin diye.
function backupDiagnosis(installRoot, result, pids = []) {
  const dataDir = path.join(installRoot, "data");
  let files;
  try {
    files = readdirSync(dataDir).map(name => {
      try {
        return `${name} (${statSync(path.join(dataDir, name)).size} B)`;
      } catch (error) {
        return `${name} (okunamadı: ${error.code})`;
      }
    });
  } catch (error) {
    files = [`veri klasörü okunamadı: ${error.code}`];
  }
  const processes = pids.filter(Boolean).map(pid => `${pid}:${alive(pid) ? "yaşıyor" : "kapalı"}`);
  return `çıkış ${result.code}, ${result.ms} ms; stderr: ${JSON.stringify(result.stderr.slice(-1500))}; stdout: ${JSON.stringify(result.stdout.slice(-500))}; veri: ${files.join(", ")}; uygulama süreçleri: ${processes.join(", ") || "-"}; ${process.platform} ${process.version}`;
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
      if (response.status === 200) {
        // Servis yöneticisinin uygulama alt sürecinin kimliği: durdurmada onun da kapanması beklenir (stopService).
        const state = await (await fetch(`http://127.0.0.1:${port}/__supervisor/health`)).json();
        return { child, appPid: state.childPid || null, output: () => output };
      }
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
  // Bu bölümde açılmış uygulama süreçleri: "yedek" düşerse hâlâ yaşayıp yaşamadıkları hata iletisine yazılır.
  const appPids = [];
  before(() => {
    installRoot = mkdtempSync(path.join(tmpdir(), "destekofis-kurulum-"));
    stageInstall(installRoot);
  });
  after(() => rmSync(installRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }));

  it("bootstrap etkin sürümü açar; veri kurulum kökündeki data klasörüne yazılır", async t => {
    await withService(installRoot, t, async (service, port) => {
      appPids.push(service.appPid);
      const health = await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
      assert.equal(health.data.version, version);
      assert.ok(service.appPid, "servis yöneticisi uygulama alt sürecinin kimliğini vermeli");
      assert.ok(existsSync(path.join(installRoot, "data", "destekofis.sqlite")), "yeni kurulumun veritabanı kurulum kökündeki data klasöründe, sektörden bağımsız adla");
      assert.ok(!existsSync(path.join(installRoot, "data", "hukuk-ofisi.sqlite")), "yeni kurulumda eski adlı dosya oluşmaz");
      assert.ok(!existsSync(path.join(installRoot, "app", version, "data")), "uygulama klasörüne veri yazılmamalı");
    });
  });

  it("'surum' ve 'yedek' alt komutları çalışır", async () => {
    const { stdout } = await run(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(installRoot, "bootstrap.mjs"), "surum"]);
    assert.equal(stdout.trim(), version);
    const result = await runBootstrapBackup(installRoot);
    assert.equal(result.code, 0, `yedek (hizmet kapalı) alınamadı — ${backupDiagnosis(installRoot, result, appPids)}`);
    // v2.0.20: her şirket kendi klasörüne ("001 - <ad>"), adında şirket kodu.
    const folder = readdirSync(path.join(installRoot, "backups")).find(name => name.startsWith("001 - "));
    assert.ok(folder, readdirSync(path.join(installRoot, "backups")).join(", "));
    assert.ok(readdirSync(path.join(installRoot, "backups", folder)).some(name => /^destekofis-001-.*-manuel\.sqlite$/.test(name)));
  });

  // Ürün sorusu (CI 532): müşteri hizmet ÇALIŞIRKEN Başlat → DestekOfis → "Yedek al" (bootstrap.mjs yedek) kullanırsa yedek alınır
  // mı? Hizmet açıkken yedek olağan kullanımdır; aynı anda girişler (her giriş veri tabanına oturum satırı yazar) sürerken alınır.
  // Yedek dosyası açılıp bütünlüğü ve içeriği okunur (çıkış kodu tek başına kanıt değil).
  it("hizmet ÇALIŞIRKEN ve yazarken 'yedek' alınır; yedek bütün ve okunur", async t => {
    await withService(installRoot, t, async (service, port) => {
      appPids.push(service.appPid);
      const backupsDir = path.join(installRoot, "backups");
      const listBackups = () => (existsSync(backupsDir) ? readdirSync(backupsDir).flatMap(folder => (folder.startsWith("001 - ") ? readdirSync(path.join(backupsDir, folder)).map(name => path.join(backupsDir, folder, name)) : [])) : []);
      const before = new Set(listBackups());
      const loginOnce = async () => {
        const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "Test-Admin-2026!" }) });
        await response.arrayBuffer();
        return response.status;
      };
      assert.equal(await loginOnce(), 200, "yazma öncesi giriş");
      let writes = 0;
      const statuses = [];
      let running = true;
      const writer = (async () => {
        while (running) {
          const status = await loginOnce().catch(error => error.message);
          statuses.push(status);
          if (status === 200) writes += 1;
        }
      })();
      const result = await runBootstrapBackup(installRoot);
      running = false;
      await writer;
      assert.equal(result.code, 0, `yedek (hizmet açık) alınamadı — ${backupDiagnosis(installRoot, result, [service.appPid])}`);
      assert.ok(alive(service.appPid), "yedek sırasında uygulama süreci çalışıyor olmalı (ön koşul)");
      assert.ok(statuses.every(status => status === 200), `yedek sırasında hizmet yanıt vermeye devam etmeli: ${JSON.stringify(statuses.slice(0, 20))}`);
      const created = listBackups().filter(file => !before.has(file) && /destekofis-001-.*-manuel\.sqlite$/.test(file));
      assert.equal(created.length, 1, `yeni yedek dosyası: ${JSON.stringify(created)}; çıktı: ${result.stdout}`);
      assert.equal(result.stdout.split(/\r?\n/)[0], created[0], "bootstrap ilk satırda 001'in yedek dosyasının tam yolunu yazar");
      const copy = new DatabaseSync(created[0], { readOnly: true });
      try {
        assert.equal(copy.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
        assert.equal(copy.prepare("SELECT username FROM users WHERE username = 'admin'").get()?.username, "admin");
        assert.ok(copy.prepare("SELECT COUNT(*) AS n FROM sessions").get().n >= 1, "yedek, yedek başlamadan önce yazılmış oturumu içermeli");
      } finally {
        copy.close();
      }
      t.diagnostic(`hizmet açıkken yedek ${result.ms} ms; bu sürede ${writes} giriş yazıldı`);
    });
  });

  it("etkin sürüm açılamazsa önceki sürüme dönülür ve açılamayan sürüm işaretlenir", async t => {
    const broken = path.join(installRoot, "app", "99.0.0", "server");
    mkdirSync(broken, { recursive: true });
    writeFileSync(path.join(broken, "supervisor.mjs"), 'throw new Error("bozuk sürüm");\n');
    writeFileSync(path.join(installRoot, "app", "current.json"), JSON.stringify({ version: "99.0.0", previous: version, pending: true }));
    try {
      await withService(installRoot, t, async (service, port) => {
        appPids.push(service.appPid);
        const health = await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
        assert.equal(health.data.version, version);
        const current = JSON.parse(readFileSync(path.join(installRoot, "app", "current.json"), "utf8"));
        assert.equal(current.version, version);
        assert.equal(current.fallbackFrom, "99.0.0");
      });
    } finally {
      rmSync(path.join(installRoot, "app", "99.0.0"), { recursive: true, force: true });
    }
  });

  it("current.json bozuk veya olmayan sürümü gösteriyorsa kurulu en yeni sürümle açılır", async t => {
    writeFileSync(path.join(installRoot, "app", "current.json"), JSON.stringify({ version: "9.9.9" }));
    await withService(installRoot, t, async (service, port) => {
      appPids.push(service.appPid);
      const health = await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
      assert.equal(health.data.version, version);
    });
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
