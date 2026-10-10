// Otomatik güncelleme gerçek çalıştırma testlerinin ortak parçaları: kurulum kökü, yerel sahte yayın kaynağı (GitHub API
// biçiminde; dışarı çıkılmaz), ayrı süreçte servis (hizmet.mjs), kullanıcı etkinliği üreten istemci, bekleme yardımcıları.
import { fork } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { createApp } from "../../server/app.mjs";
import { buildRelease, makeKeys, makeVersion } from "../update-helpers.mjs";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ADMIN_PASSWORD = "Test-Admin-2026!";
export const STAFF = { username: "kalici", password: "Kalici-Parola-2026", name: "Kalıcı Kullanıcı" };
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const stamp = () => new Date().toISOString();

export async function waitFor(check, { timeoutMs = 60_000, interval = 200, message = "Beklenen durum oluşmadı" } = {}) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    last = await Promise.resolve()
      .then(check)
      .catch(error => ({ error: error.message }));
    if (last && !last.error) return last;
    await sleep(interval);
  }
  throw new Error(`${message}: ${JSON.stringify(last)}`);
}

export const keysOnce = (() => {
  let keys;
  return () => (keys ||= makeKeys("test-gercek-1"));
})();

// Depodaki uygulamadan imzalı (test anahtarı) bir güncelleme paketi üretir.
export function buildTestRelease(work, version) {
  const source = makeVersion(path.join(work, `kaynak-${version}`), version);
  return buildRelease(source, path.join(work, `yayin-${version}`), keysOnce());
}

// GitHub Releases biçiminde yanıt veren yerel sahte yayın kaynağı. down: true iken her şeye 503 (sunucu açılırken
// internet/GitHub yokmuş gibi). Her isteğin zamanı ve yolu kaydedilir.
export async function startFeed({ releases = [], down = false } = {}) {
  const state = { releases, down };
  const hits = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const record = status => hits.push({ at: stamp(), path: url.pathname, status });
    if (state.down) {
      record(503);
      res.writeHead(503, { "content-type": "text/plain" });
      res.end("bakim");
      return;
    }
    const base = `http://127.0.0.1:${server.address().port}`;
    if (url.pathname === "/repos/test/repo/releases") {
      record(200);
      const body = state.releases.map(release => ({
        tag_name: `v${release.version}`,
        draft: false,
        prerelease: false,
        html_url: `${base}/releases/v${release.version}`,
        assets: Object.entries(release.files).map(([name, file]) => ({ name, size: readFileSync(file).length, browser_download_url: `${base}/download/${release.version}/${encodeURIComponent(name)}` })),
      }));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
      return;
    }
    const match = /^\/download\/([^/]+)\/([^/]+)$/.exec(url.pathname);
    const file = match && state.releases.find(item => item.version === match[1])?.files[decodeURIComponent(match[2])];
    if (!file) {
      record(404);
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Not Found" }));
      return;
    }
    record(200);
    const data = readFileSync(file);
    res.writeHead(200, { "content-type": "application/octet-stream", "content-length": data.length });
    res.end(data);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    hits,
    listHits: () => hits.filter(hit => hit.path === "/repos/test/repo/releases").length,
    zipHits: () => hits.filter(hit => hit.path.endsWith(".zip")).length,
    setReleases(next) {
      state.releases = next;
    },
    setDown(value) {
      state.down = value;
    },
    close: () => new Promise(resolve => server.close(resolve)),
  };
}
export const releaseEntry = built => ({ version: built.version, files: { [path.basename(built.zipPath)]: built.zipPath, "destekofis-guncelleme.json": built.manifestPath } });

// Kurulum kökü: app\<sürüm> (depodaki uygulamanın kopyası), app\current.json, config\guncelleme.json, data (programın kendi
// API'siyle girilmiş kullanıcı + cari + Kasa hareketi). Lisans denetimi yalnız bu hazırlıkta kapalıdır (servis açıkken gerçek).
export async function prepareInstall(installRoot, { version = "9.0.0", config } = {}) {
  makeVersion(path.join(installRoot, "app", version), version);
  writeFileSync(path.join(installRoot, "app", "current.json"), JSON.stringify({ version }));
  if (config) {
    mkdirSync(path.join(installRoot, "config"), { recursive: true });
    writeFileSync(path.join(installRoot, "config", "guncelleme.json"), JSON.stringify(config));
  }
  const app = createApp({ dataDir: path.join(installRoot, "data"), backupDir: path.join(installRoot, "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false });
  const { port } = await app.listen(0, "127.0.0.1");
  try {
    const admin = client(`http://127.0.0.1:${port}`);
    await must("yönetici girişi", admin.login("admin", ADMIN_PASSWORD));
    await must("personel", admin.post("/api/admin/users", { username: STAFF.username, name: STAFF.name, role: "personel", password: STAFF.password, mustChangePassword: false }));
    await must("cari", admin.post("/api/workspace/accounts", { name: "Güncelleme Testi Carisi", type: "customer" }));
    await must("Kasa girişi", admin.post("/api/workspace/cash", { kind: "in", amount: "1250", description: "Güncelleme öncesi tahsilat" }));
  } finally {
    await app.close();
  }
  return counts(installRoot);
}

async function must(what, promise) {
  const result = await promise;
  if (result.status !== 200) throw new Error(`${what}: HTTP ${result.status} ${JSON.stringify(result.data).slice(0, 300)}`);
  return result.data;
}

// Veri dosyasından (servisten bağımsız) sayım: güncellemeden önce ve sonra aynı olmalı.
export function counts(installRoot) {
  const db = new DatabaseSync(path.join(installRoot, "data", "destekofis.sqlite"), { readOnly: true });
  try {
    const one = sql => db.prepare(sql).get().n;
    return { kullanici: one("SELECT COUNT(*) AS n FROM users"), cari: one("SELECT COUNT(*) AS n FROM accounts"), kasa: one("SELECT COUNT(*) AS n FROM cash_entries"), kasaToplam: db.prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM cash_entries").get().n };
  } finally {
    db.close();
  }
}

export function client(base) {
  let cookie = "";
  const request = async (method, url, body) => {
    const headers = cookie ? { cookie } : {};
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const type = response.headers.get("content-type") || "";
    return { status: response.status, data: type.includes("json") ? await response.json() : await response.text() };
  };
  return { get: url => request("GET", url), post: (url, body = {}) => request("POST", url, body), login: (username, password) => request("POST", "/api/auth/login", { username, password }) };
}

// Servisi ayrı süreçte açar (hizmet.mjs). Günlük (stdout + stderr) kurulum kökünde logs\servis.log'a yazılır (nssm gibi).
export async function startService(installRoot, { feed, timings, quiet, retryDelays, tz, port = 0 } = {}) {
  const logFile = path.join(installRoot, "logs", "servis.log");
  mkdirSync(path.dirname(logFile), { recursive: true });
  let text = "";
  const env = { ...process.env, GUNCELLEME_TEST: JSON.stringify({ installRoot, feed, trustedKeys: keysOnce().trusted, timings, quiet, retryDelays, port }), HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_LOG_LEVEL: "warn", HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9", HUKUK_DATA_DIR: "", HUKUK_BACKUP_DIR: "" };
  if (tz) env.TZ = tz;
  const child = fork(path.join(HERE, "hizmet.mjs"), [], { env, execArgv: ["--disable-warning=ExperimentalWarning"], stdio: ["ignore", "pipe", "pipe", "ipc"] });
  const sink = chunk => {
    text += chunk;
    appendFileSync(logFile, chunk);
  };
  child.stdout.setEncoding("utf8").on("data", sink);
  child.stderr.setEncoding("utf8").on("data", sink);
  const pending = new Map();
  let ready;
  const readyPromise = new Promise((resolve, reject) => {
    ready = resolve;
    child.once("exit", code => reject(new Error(`servis açılmadan kapandı (kod ${code}):\n${text.slice(-3000)}`)));
  });
  child.on("message", message => {
    if (message?.type === "hazir") ready(message);
    else if (message?.type === "durum") pending.get(message.id)?.(message), pending.delete(message.id);
  });
  const hello = await readyPromise;
  let seq = 0;
  const service = {
    child,
    hello,
    port: hello.port,
    base: `http://127.0.0.1:${hello.port}`,
    logFile,
    log: () => text,
    status: () =>
      new Promise((resolve, reject) => {
        const id = ++seq;
        const timer = setTimeout(() => reject(new Error("servis durum sorusuna yanıt vermedi")), 10_000);
        pending.set(id, value => {
          clearTimeout(timer);
          resolve(value);
        });
        child.send({ type: "durum", id });
      }),
    // Sağlık ucu kullanıcı etkinliği SAYILMAZ (servis yöneticisi kuralı) — sürümü okumak etkinlik üretmez.
    appVersion: async () => {
      try {
        const response = await fetch(`${service.base}/api/health`);
        return response.status === 200 ? (await response.json()).data.version : null;
      } catch {
        return null;
      }
    },
    async stop() {
      if (child.exitCode !== null) return;
      const exited = new Promise(resolve => child.once("exit", resolve));
      child.send({ type: "dur" });
      const timer = setTimeout(() => child.kill("SIGKILL"), 20_000);
      await exited;
      clearTimeout(timer);
    },
  };
  // Servis yöneticisi uygulama süreci hazır olmadan döner (açılış bakım sayfası); uygulama sağlık ucu yanıt verene kadar beklenir.
  await waitFor(async () => ((await service.appVersion()) ? true : Promise.reject(new Error("uygulama hazır değil"))), { timeoutMs: 90_000, interval: 150, message: "servis uygulaması açılmadı" });
  return service;
}

// Kullanıcı etkinliği: personel girişi + her `intervalMs`'de bir ekran isteği (dosya takip ekranının düzenli yenilemesi gibi).
// Test yarıda düşerse döngü süreci açık tutmasın diye hepsi stopAllActivity() ile durdurulur.
const activities = new Set();
export async function stopAllActivity() {
  await Promise.all([...activities].map(activity => activity.stop()));
}
export async function startActivity(base, { intervalMs = 500 } = {}) {
  const user = client(base);
  const login = await user.login(STAFF.username, STAFF.password);
  if (login.status !== 200) throw new Error(`personel girişi: ${login.status} ${JSON.stringify(login.data)}`);
  let lastAt = Date.now();
  let running = true;
  let requests = 1;
  const loop = (async () => {
    while (running) {
      await sleep(intervalMs);
      if (!running) break;
      await user.get("/api/workspace/client-state").catch(() => null);
      lastAt = Date.now();
      requests += 1;
    }
  })();
  const activity = {
    get lastAt() {
      return lastAt;
    },
    get requests() {
      return requests;
    },
    async stop() {
      running = false;
      activities.delete(activity);
      await loop;
      return lastAt;
    },
  };
  activities.add(activity);
  return activity;
}

// Şu an mesai DIŞI olan bir saat dilimi (Etc/GMT±N): hafta içi 20:00–07:00 ya da hafta sonu. Saate göre seçilir (hafta sonuna
// güvenmeden); her an en az bir dilim uyar (−12…+14 saat aralığı 26 saat).
export function quietZoneNow(now = Date.now()) {
  const zones = [];
  for (let offset = -12; offset <= 14; offset += 1) {
    const local = new Date(now + offset * 3_600_000);
    const hour = local.getUTCHours();
    const day = local.getUTCDay();
    if (hour >= 21 || hour < 6) zones.push({ tz: offset === 0 ? "Etc/GMT" : `Etc/GMT${offset > 0 ? "-" : "+"}${Math.abs(offset)}`, offset, hour, day });
  }
  // Gece yarısından sonraki 01:30'a en yakın olan seçilir ki test sırasında mesai içine geçilmesin.
  const distance = hour => Math.min(Math.abs(hour - 1.5), 24 - Math.abs(hour - 1.5));
  return zones.sort((a, b) => distance(a.hour) - distance(b.hour))[0] || null;
}

export const writeJson = (file, data) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};
