// Yedek ve çoklu şirket — bağımsız gözden geçirme bulgularının regresyon testleri (2.0.20).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { createApp } from "../server/app.mjs";
import { BACKUP_NAME, SAFETY_KEEP, companyFolderName, createBackup, parseBackupName, readBackupIdentity, runDueBackups } from "../server/lib/backup.mjs";
import { companiesOnDisk } from "../server/lib/company-backups.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { startSupervisor } from "../server/supervisor.mjs";
import { ADMIN_PASSWORD, createClient } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async (url, body) => unwrap(await client.raw("DELETE", url, { body: body ? JSON.stringify(body) : undefined, headers: body ? { "content-type": "application/json" } : {} })),
});
const LICENSE = { enforce: false, machineId: "0123456789abcdef0123456789abcdef" };

// Aynı klasörlerle yeniden açılabilen sunucu (yeniden başlatma, göç ve 001 geri yüklemesi için).
async function boot(dirs, { env = {}, ...overrides } = {}) {
  const app = createApp({ dataDir: dirs.dataDir, backupDir: dirs.backupDir, logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0", ...env }, license: LICENSE, startLicenseTimers: false, ...overrides });
  const address = await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${address.port}`;
  const login = async (username = "admin", password = ADMIN_PASSWORD) => {
    const client = createClient(base);
    const result = await client.login(username, password);
    assert.equal(result.status, 200, `${username} girişi: ${JSON.stringify(result.data)}`);
    return { client, api: apiOf(client) };
  };
  return { app, base, login };
}
const freshDirs = () => {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-yedek-"));
  return { root, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
};
const countAccounts = file => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL").get().n;
  } finally {
    db.close();
  }
};
const filesIn = dir => (existsSync(dir) ? readdirSync(dir).filter(name => BACKUP_NAME.test(name)) : []);
const addAccounts = async (api, names) => {
  for (const name of names) assert.equal((await api.post("/api/workspace/accounts", { name, type: "customer" })).status, 200);
};
const accountsNow = async api => (await api.get("/api/workspace/accounts")).data.accounts.length;


// Bağımsız gözden geçirme bulguları (2.0.20 birleştirmesi) — her biri düzeltmeden önce kırmızıydı.
const settingOf = (file, key) => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value ?? null;
  } finally {
    db.close();
  }
};

describe("şirket klasörleri: kodu değişen şirketin klasörü yeni şirkete verilmez; açılamayan şirket 001'e düşmez", () => {
  const dirs = freshDirs();
  let server;
  let api;
  before(async () => {
    server = await boot(dirs);
    api = (await server.login()).api;
  });
  after(async () => {
    await server?.app.close();
    rmSync(dirs.root, { recursive: true, force: true });
  });

  test("002 → 005 yapılıp yeni şirket açılınca (002) ayrı veri tabanı alır; veriler karışmaz (2.0.17'den kalan kritik hata)", async () => {
    const first = (await api.post("/api/companies", { code: "002", name: "Resmi", select: true })).data.company;
    await addAccounts(api, ["Resmi Cari"]);
    assert.equal((await api.put(`/api/companies/${first.id}`, { code: "005" })).status, 200);
    const fresh = (await api.post("/api/companies", { code: "002", name: "Gayri Resmi", select: true })).data.company;
    assert.equal(fresh.code, "002");
    assert.equal(await accountsNow(api), 0, "yeni şirket boş açılır (Resmi Cari görünmez)");
    const registry = JSON.parse(readFileSync(path.join(dirs.dataDir, "sirketler.json"), "utf8")).companies;
    const dirOf = id => registry.find(item => item.id === id).dir;
    assert.notEqual(dirOf(fresh.id), dirOf(first.id), `veri klasörleri ayrı: ${dirOf(first.id)} / ${dirOf(fresh.id)}`);
    await api.post("/api/companies/select", { id: first.id });
    assert.equal(await accountsNow(api), 1, "005'in carisi yerinde");
  });

  test("şirketin veri dosyası açılamazsa istek 503 alır; 001'in verisi gösterilmez", async () => {
    const broken = (await api.post("/api/companies", { code: "003", name: "Bozuk", select: true })).data.company;
    await api.post("/api/companies/select", { id: "sirket-001" });
    await addAccounts(api, ["Bir Numaralı"]);
    const registry = JSON.parse(readFileSync(path.join(dirs.dataDir, "sirketler.json"), "utf8")).companies;
    const brokenDir = path.join(dirs.dataDir, registry.find(item => item.id === broken.id).dir);
    // Örnek kapatılır (geri yükleme yolu), dosya bozulur: veri tabanı dosyası yerine klasör.
    await server.app.context.closeCompany(broken.id);
    for (const name of readdirSync(brokenDir)) rmSync(path.join(brokenDir, name), { recursive: true, force: true });
    mkdirSync(path.join(brokenDir, "destekofis.sqlite"));
    await api.post("/api/companies/select", { id: broken.id });
    const response = await api.get("/api/workspace/accounts");
    assert.equal(response.status, 503, JSON.stringify(response.data).slice(0, 200));
    assert.match(response.data.error, /003 · Bozuk/);
    await api.post("/api/companies/select", { id: "sirket-001" });
  });
});

describe("silinen şirketin eski yedekleri aynı kodla açılan yeni şirkete geçmez ve onun üzerine yüklenemez", () => {
  const dirs = freshDirs();
  let server;
  let api;
  after(async () => {
    await server?.app.close();
    rmSync(dirs.root, { recursive: true, force: true });
  });

  test("eski (2.0.19) sirket-002 yedeği yeni 002'ye taşınmaz/listelenmez; kimliksiz yedek başka veri tabanına 409; aynı ad+kod klasörü ek alır", async () => {
    server = await boot(dirs);
    api = (await server.login()).api;
    const old = (await api.post("/api/companies", { code: "002", name: "Eski A", select: true })).data.company;
    await addAccounts(api, ["A-cari-1", "A-cari-2"]);
    // 2.0.19 biçiminde (kimliksiz, sirket-002 klasöründe) eski yedek: şirketin veri tabanının kopyası.
    const registry = () => JSON.parse(readFileSync(path.join(dirs.dataDir, "sirketler.json"), "utf8")).companies;
    const oldDir = path.join(dirs.dataDir, registry().find(item => item.id === old.id).dir);
    await server.app.context.closeCompany(old.id);
    const legacy = path.join(dirs.backupDir, "sirket-002");
    mkdirSync(legacy, { recursive: true });
    const legacyName = "destekofis-2026-01-15T10-00-00-000Z-manuel.sqlite";
    const probe = new DatabaseSync(path.join(oldDir, "destekofis.sqlite"));
    probe.exec(`VACUUM INTO '${path.join(legacy, legacyName).replace(/'/g, "''")}'`);
    probe.close();
    // Yeni biçimde de bir yedeği olsun (aynı ad + kod klasörü: "002 - Eski A").
    await api.post("/api/admin/backups", { scope: "one", companyId: old.id });
    const del = await api.del(`/api/companies/${old.id}`, { confirm: "002", password: ADMIN_PASSWORD });
    assert.equal(del.status, 200, JSON.stringify(del.data));
    // Yeni şirket: aynı kod ve aynı ad.
    const fresh = (await api.post("/api/companies", { code: "002", name: "Eski A", select: true })).data.company;
    await addAccounts(api, ["B-cari"]);
    const folder = (await api.get("/api/admin/backups/folders")).data.companies.find(item => item.id === fresh.id).folder;
    assert.equal(path.basename(folder), "002 - Eski A (2)", "silinen şirketin dolu klasörü yeni şirkete verilmez");
    // Yeniden açılış: göç çalışır.
    await server.app.close();
    server = await boot(dirs);
    api = (await server.login()).api;
    const list = (await api.get("/api/admin/backups")).data.filter(item => item.companyId === fresh.id);
    assert.ok(!list.some(item => item.name === legacyName), "silinen şirketin eski yedeği yeni şirketin listesinde yok");
    assert.ok(existsSync(path.join(legacy, legacyName)), "eski yedek yerinde kaldı (silinmedi, taşınmadı)");
    // Elle yeni şirketin klasörüne konsa bile: kimliksiz yedek başka veri tabanından → 409.
    mkdirSync(folder, { recursive: true });
    copyFileSync(path.join(legacy, legacyName), path.join(folder, legacyName));
    const refused = await api.post("/api/admin/backups/restore", { name: legacyName, company: fresh.id, confirm: "002", password: ADMIN_PASSWORD });
    assert.equal(refused.status, 409, JSON.stringify(refused.data));
    assert.equal(refused.data.code, "company-unknown");
    await api.post("/api/companies/select", { id: fresh.id });
    assert.equal(await accountsNow(api), 1, "yeni şirketin verisi aynı");
  });
});

describe("geri yükleme sağlamlığı: bozuk canlı dosya, eşzamanlı istek, unvan, 001 sonucu ekranda, güncelleme sırasında uygulanmaz", () => {
  const dirs = freshDirs();
  let server;
  let api;
  let second;
  let backup002;
  before(async () => {
    server = await boot(dirs);
    api = (await server.login()).api;
    second = (await api.post("/api/companies", { code: "002", name: "Şirket 2", select: true })).data.company;
    await addAccounts(api, ["Dört", "Beş"]);
    backup002 = (await api.post("/api/admin/backups", { scope: "one", companyId: second.id })).data.backups[0];
  });
  after(async () => {
    await server?.app.close();
    rmSync(dirs.root, { recursive: true, force: true });
  });

  test("şirket yeniden adlandırıldıktan sonra geri yüklenirse unvan (office.name) yeni adda kalır", async () => {
    assert.equal((await api.put(`/api/companies/${second.id}`, { name: "Şirket İki" })).status, 200);
    const folder = (await api.get("/api/admin/backups/folders")).data.companies.find(item => item.id === second.id).folder;
    const restored = await api.post("/api/admin/backups/restore", { name: backup002.name, company: second.id, confirm: "002", password: ADMIN_PASSWORD });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    const registry = JSON.parse(readFileSync(path.join(dirs.dataDir, "sirketler.json"), "utf8")).companies;
    const file = path.join(dirs.dataDir, registry.find(item => item.id === second.id).dir, "destekofis.sqlite");
    await server.app.context.closeCompany(second.id);
    assert.equal(settingOf(file, "office.name"), "Şirket İki");
    assert.ok(existsSync(path.join(folder, backup002.name)), "seçilen yedek yeni klasöre taşınmış ve duruyor");
    backup002.folder = folder;
  });

  test("canlı dosya bozuksa geri yükleme engellenmez: önce ham kopya alınır, sonra yedeğe dönülür", async () => {
    const registry = JSON.parse(readFileSync(path.join(dirs.dataDir, "sirketler.json"), "utf8")).companies;
    const file = path.join(dirs.dataDir, registry.find(item => item.id === second.id).dir, "destekofis.sqlite");
    await server.app.context.closeCompany(second.id);
    const { openSync, writeSync, closeSync, statSync } = await import("node:fs");
    const fd = openSync(file, "r+");
    const middle = Math.floor(statSync(file).size / 2);
    writeSync(fd, Buffer.alloc(32 * 1024, 0x5a), 0, 32 * 1024, middle);
    closeSync(fd);
    const restored = await api.post("/api/admin/backups/restore", { name: backup002.name, company: second.id, confirm: "002", password: ADMIN_PASSWORD });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    assert.match(restored.data.safety, /-geri-yukleme-oncesi-002-ham\.sqlite$/);
    await api.post("/api/companies/select", { id: second.id });
    assert.equal(await accountsNow(api), 2);
  });

  test("şirkette geri yükleme sürerken ikinci geri yükleme, ad değiştirme, sıfırlama 409", async () => {
    server.app.context.busyCompanies.set(second.id, "“002 · Şirket İki” yedekten geri yükleniyor; birkaç saniye sonra yeniden deneyin.");
    try {
      assert.equal((await api.post("/api/admin/backups/restore", { name: backup002.name, company: second.id, confirm: "002", password: ADMIN_PASSWORD })).status, 409);
      assert.equal((await api.put(`/api/companies/${second.id}`, { name: "X" })).status, 409);
      assert.equal((await api.post(`/api/companies/${second.id}/reset`, { confirm: "002", password: ADMIN_PASSWORD, mode: "movements" })).status, 409);
    } finally {
      server.app.context.busyCompanies.delete(second.id);
    }
  });

  test("001 geri yüklemesi başarısız olursa Yönetim → Yedekler'de görünür; güncelleme sırasında uygulanmaz", async () => {
    await api.post("/api/companies/select", { id: "sirket-001" });
    const taken = (await api.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" })).data.backups[0];
    const staged = await api.post("/api/admin/backups/restore", { name: taken.name, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    assert.equal(staged.data.staged, true);
    await server.app.close();
    // Güncellemenin deneme açılışı gibi: canlı veri bir önceki şema sürümünde.
    const live = new DatabaseSync(path.join(dirs.dataDir, "destekofis.sqlite"));
    live.exec(`PRAGMA user_version = ${LATEST_VERSION - 1}`);
    live.close();
    server = await boot(dirs);
    api = (await server.login()).api;
    const info = (await api.get("/api/admin/backups/folders")).data;
    assert.ok(info.lastRestore && info.lastRestore.ok === false, JSON.stringify(info.lastRestore));
    assert.match(info.lastRestore.error, /güncelleniyordu/);
    assert.equal(info.pending, null, "bekleyen iş kalmadı");
  });
});

describe("budama ve otomatik yedek: güvenlik yedekleri rutin kopyalarla silinmez; değişmeyen şirket yeniden kopyalanmaz", () => {
  test("40 rutin yedekten sonra sıfırlama/geri yükleme öncesi yedekler yerinde; rutinler 30'a budanır", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "budama-"));
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE users (id TEXT)");
    try {
      const company = { id: "sirket-x", code: "002", name: "X" };
      createBackup(db, dir, { label: "sifirlama-oncesi-002", keep: 30, company, stamp: "2026-01-01T00-00-00-000Z" });
      createBackup(db, dir, { label: "geri-yukleme-oncesi-002", keep: 30, company, stamp: "2026-01-02T00-00-00-000Z" });
      for (let i = 0; i < 40; i += 1) createBackup(db, dir, { keep: 30, company, stamp: `2026-02-${String(1 + Math.floor(i / 24)).padStart(2, "0")}T${String(i % 24).padStart(2, "0")}-00-00-000Z` });
      const names = readdirSync(dir).filter(name => BACKUP_NAME.test(name));
      assert.ok(names.some(name => name.includes("sifirlama-oncesi")), "sıfırlama öncesi yedek duruyor");
      assert.ok(names.some(name => name.includes("geri-yukleme-oncesi")), "geri yükleme öncesi yedek duruyor");
      assert.equal(names.filter(name => !/-oncesi-/.test(name)).length, 30, "rutin yedekler 30");
      assert.ok(!readdirSync(dir).some(name => name.endsWith(".yaziliyor")), "yarım dosya kalmaz");
      assert.ok(SAFETY_KEEP >= 20);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("veri dosyası son yedekten beri değişmediyse otomatik yedek alınmaz; değişince alınır", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "degismeyen-"));
    try {
      let runs = 0;
      let changed = 0;
      // Yedek dosyasının zamanı 10 dakika önceye çekilir (dosya sistemi zamanı ms yuvarlamasıyla "gelecekte" görünmesin).
      const backupAt = Date.now() - 600_000;
      const targets = () => [{ backupDir: dir, label: "X", changedAt: () => changed, run: () => { runs += 1; const file = path.join(dir, `destekofis-002-2026-03-0${runs}T00-00-00-000Z.sqlite`); writeFileSync(file, "x"); utimesSync(file, backupAt / 1000, backupAt / 1000); return { name: `y${runs}` }; } }];
      runDueBackups({ targets, intervalHours: 0, log: null });
      assert.equal(runs, 1, "hiç yedek yokken alınır");
      changed = backupAt - 60_000; // son yedekten önce değişmiş
      runDueBackups({ targets, intervalHours: 0, log: null });
      assert.equal(runs, 1, "değişmeyen şirket yeniden kopyalanmaz");
      changed = Date.now();
      runDueBackups({ targets, intervalHours: 0, log: null });
      assert.equal(runs, 2, "değişince yeniden alınır");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
