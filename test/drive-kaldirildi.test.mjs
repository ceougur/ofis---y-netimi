// Drive'a yedek 2.1.0'da kaldırıldı (kullanıcı kararı, 10.10.2026: "Programın Drive yedekleme bölümünü kaldıralım, kılavuzdan ve
// web sitesinden de kaldıralım. Şimdilik gerek yok. Müşterileri de yanlış yönlendirmiş olmayalım.").
// Çalışıyor mu: eski uçlar 404; yerel yedek (Şimdi Yedek Al Tüm/Yalnız, otomatik zamanlayıcı, veri yükleme öncesi, bootstrap
// `yedek` = tools/backup.mjs) her şirketin kendi klasöründe aynen alınır.
// Nasıl bozarım: eski kurulumun veri tabanında Drive ayarı DOLU kalmış (klasör kipi gerçek geçici klasörle; bağlantı kipi sahte
// lisans servisiyle; 2.0.17–2.0.19 düzeninde ayar 002'nin dosyasında) → o klasöre tek dosya kopyalanmaz, servise tek istek
// gitmez, ayar okunmaz/silinmez/değişmez (ortak katmana da taşınmaz).
// Eski kodda (507f0e1) kırmızı: uçlar 200 döner, yedekler klasöre kopyalanır, servise yükleme oturumu istenir, ayar değişir.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, utimesSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { createApp } from "../server/app.mjs";
import { BACKUP_NAME } from "../server/lib/backup.mjs";
import { ADMIN_PASSWORD, createClient } from "./helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LICENSE = { enforce: false, machineId: "0123456789abcdef0123456789abcdef" };
const KEY = "backup.cloud";

const freshDirs = () => {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-drive-yok-"));
  return { root, dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), drive: path.join(root, "Drive'ım", "Yedekler") };
};
const boot = async (dirs, overrides = {}) => {
  const app = createApp({ dataDir: dirs.dataDir, backupDir: dirs.backupDir, logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: LICENSE, startLicenseTimers: false, ...overrides });
  const { port } = await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${port}`;
  const admin = createClient(base);
  assert.equal((await admin.login("admin", ADMIN_PASSWORD)).status, 200);
  return { app, base, admin };
};
const db001 = dirs => path.join(dirs.dataDir, "destekofis.sqlite");
const db002 = dirs => path.join(dirs.dataDir, "sirketler", "002", "destekofis.sqlite");
const readSetting = file => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("SELECT value FROM settings WHERE key = ?").get(KEY)?.value ?? null;
  } finally {
    db.close();
  }
};
const writeSetting = (file, value) => {
  const db = new DatabaseSync(file);
  try {
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(KEY, value, new Date().toISOString());
  } finally {
    db.close();
  }
};
// Eski sürümün (2.0.2–2.0.26) Yönetim → Yedekler → "Kaydet ve Bağla" ile yazdığı ayarın biçimi.
const folderSetting = drive => JSON.stringify({ enabled: true, mode: "folder", value: drive, folderId: null, path: drive, resolvedPath: path.join(drive, "DestekOfis Yedekleri"), configuredBy: null, configuredAt: "2026-10-01T09:00:00.000Z", lastAt: null, lastError: null, lastName: null, copies: 0 });
const LINK = "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStU";
const linkSetting = () => JSON.stringify({ enabled: true, mode: "link", value: LINK, folderId: "1AbCdEfGhIjKlMnOpQrStU", path: null, configuredBy: null, configuredAt: "2026-10-01T09:00:00.000Z", lastAt: null, lastError: null, lastName: null, copies: 0 });
const filesUnder = dir => {
  try {
    return readdirSync(dir, { recursive: true }).map(String);
  } catch {
    return [];
  }
};
const backupsIn = (dirs, folder) => filesUnder(path.join(dirs.backupDir, folder)).filter(name => BACKUP_NAME.test(name));
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
const settle = () => new Promise(resolve => setTimeout(resolve, 400)); // eski kodda arka plan kopyası (fire-and-forget) bitsin

// İlk kurulum: 001'de 2, 002'de 3 cari; sonra sunucu kapanır ve eski sürümden kalmış Drive ayarı veri tabanına yazılır.
async function prepare(dirs) {
  const { app, admin } = await boot(dirs);
  for (const name of ["Ali Veli", "Ayşe Kaya"]) assert.equal((await admin.post("/api/workspace/accounts", { name, type: "customer" })).status, 200);
  const created = await admin.post("/api/companies", { code: "002", name: "İkinci Şirket", select: true });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  for (const name of ["Zeynep Ak", "Can Er", "Deniz Su"]) assert.equal((await admin.post("/api/workspace/accounts", { name, type: "customer" })).status, 200);
  assert.equal((await admin.post("/api/companies/select", { id: "sirket-001" })).status, 200);
  await app.close();
  return unwrap(created).company;
}

describe("Drive'a yedek kaldırıldı — klasör kipi ayarı dolu eski kurulum", () => {
  const dirs = freshDirs();
  let server;
  let second;
  let setting;
  before(async () => {
    second = await prepare(dirs);
    setting = folderSetting(dirs.drive);
    // Ortak katmanda (001) ve 2.0.17–2.0.19 düzeninde 002'nin kendi dosyasında.
    writeSetting(db001(dirs), setting);
    writeSetting(db002(dirs), setting);
    server = await boot(dirs);
  });
  after(async () => {
    await server?.app.close();
    rmSync(dirs.root, { recursive: true, force: true });
  });

  test("kaldırılan uçlar 404: GET/POST /api/admin/backups/cloud ve POST …/cloud/test (yönetici ve oturumsuz)", async () => {
    for (const client of [server.admin, createClient(server.base)]) {
      assert.equal((await client.get("/api/admin/backups/cloud")).status, 404, "GET cloud");
      assert.equal((await client.post("/api/admin/backups/cloud", { target: dirs.drive })).status, 404, "POST cloud (bağla)");
      assert.equal((await client.post("/api/admin/backups/cloud", { target: "" })).status, 404, "POST cloud (kaldır)");
      assert.equal((await client.post("/api/admin/backups/cloud/test")).status, 404, "POST cloud/test");
    }
    assert.deepEqual(filesUnder(dirs.drive), [], "bağlama denemesi klasör de açmadı");
    // Yedek indirme yolu bozulmadı: geçersiz ad yine 400.
    assert.equal((await server.admin.get("/api/admin/backups/..%2Fdestekofis.sqlite")).status, 400);
  });

  test("Şimdi Yedek Al — Tüm Şirketler ve Yalnız 001: yerel yedek alınır, Drive klasörüne dosya gitmez, yanıtta Drive alanı yok", async () => {
    const all = await server.admin.post("/api/admin/backups", {});
    assert.equal(all.status, 200, JSON.stringify(all.data));
    const body = unwrap(all);
    assert.deepEqual(body.backups.map(item => item.code).sort(), ["001", "002"]);
    assert.ok(!("cloud" in body) && body.backups.every(item => !("cloud" in item)), `yanıtta cloud alanı yok: ${JSON.stringify(body)}`);
    const one = await server.admin.post("/api/admin/backups", { scope: "one" });
    assert.equal(one.status, 200);
    assert.deepEqual(unwrap(one).backups.map(item => item.code), ["001"]);
    assert.equal(backupsIn(dirs, "001 - Şirket 1").length, 2);
    assert.equal(backupsIn(dirs, "002 - İkinci Şirket").length, 1);
    await settle();
    assert.deepEqual(filesUnder(dirs.drive), [], "Drive klasörü boş");
  });

  test("veri yükleme öncesi yedek (001 ve 002): yerel yedek alınır, kopya yok", async () => {
    const matrix = [["Dosya No", "Borçlu", "Telefon"], ["2026/1", "Veli Kaya", "0532 999 99 99"]];
    for (const scope of ["", `?hofCompany=${second.id}`]) {
      for (let round = 0; round < 2; round += 1) {
        const staged = await server.admin.post(`/api/workspace/dataset/stage${scope}`, { kind: "excel", fileName: "dosyalar.xlsx", sheets: [{ name: "Aktif", matrix }] });
        assert.equal(staged.status, 200, JSON.stringify(staged.data));
        const committed = await server.admin.post(`/api/workspace/dataset/commit${scope}`, { stageId: unwrap(staged).stageId, mode: "replace" });
        assert.equal(committed.status, 200, JSON.stringify(committed.data));
      }
    }
    // İkinci yüklemede (veri varken) "veri-oncesi-degistirme" yedeği alınır — her şirket kendi klasörüne.
    assert.equal(backupsIn(dirs, "001 - Şirket 1").filter(name => /veri-oncesi/.test(name)).length, 1);
    assert.equal(backupsIn(dirs, "002 - İkinci Şirket").filter(name => /veri-oncesi/.test(name)).length, 1);
    await settle();
    assert.deepEqual(filesUnder(dirs.drive), [], "Drive klasörü boş");
  });

  test("otomatik zamanlayıcı (son yedek 7 saat önce: zamanı gelmiş): iki şirket yedeklenir, kopya yok", async () => {
    // Sahte saat: yedeklerin zamanı 7 saat geriye alınır (varsayılan aralık 6 saat; zamanlayıcı dosya zamanına bakar).
    const past = new Date(Date.now() - 7 * 3_600_000);
    for (const folder of ["001 - Şirket 1", "002 - İkinci Şirket"]) for (const name of backupsIn(dirs, folder)) utimesSync(path.join(dirs.backupDir, folder, name), past, past);
    const results = server.app.runDueBackups();
    assert.deepEqual(results.map(item => item.company.code).sort(), ["001", "002"], "iki şirketin de zamanı gelmişti");
    await settle();
    assert.deepEqual(filesUnder(dirs.drive), [], "Drive klasörü boş");
  });

  test("Drive ayarı okunmaz, silinmez, değişmez (001 ve 002); gerçek zamanlayıcı ve bootstrap `yedek` de kopyalamaz", async () => {
    await server.app.close();
    server = null;
    assert.equal(readSetting(db001(dirs)), setting, "001'deki ayar aynen duruyor");
    assert.equal(readSetting(db002(dirs)), setting, "002'deki ayar aynen duruyor");
    // Gerçek zamanlayıcı: açılıştan kısa süre sonra ilk tur (yedekler 7 saat eski).
    const past = new Date(Date.now() - 7 * 3_600_000);
    for (const folder of ["001 - Şirket 1", "002 - İkinci Şirket"]) for (const name of backupsIn(dirs, folder)) utimesSync(path.join(dirs.backupDir, folder, name), past, past);
    const before1 = backupsIn(dirs, "001 - Şirket 1").length;
    const timed = createApp({ dataDir: dirs.dataDir, backupDir: dirs.backupDir, logLevel: "silent", scheduleBackups: true, backupOnStartDelayMs: 20, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: LICENSE, startLicenseTimers: false });
    try {
      for (let tries = 0; tries < 150 && backupsIn(dirs, "001 - Şirket 1").length === before1; tries += 1) await new Promise(resolve => setTimeout(resolve, 30));
      assert.equal(backupsIn(dirs, "001 - Şirket 1").length, before1 + 1, "zamanlayıcı yerel yedeği aldı");
      await settle();
    } finally {
      await timed.close();
    }
    // Bootstrap `yedek` (Windows hizmeti: bootstrap.mjs yedek → tools/backup.mjs): bütün şirketler, kendi klasörlerinde.
    const output = execFileSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(ROOT, "tools", "backup.mjs")], { env: { ...process.env, HUKUK_DATA_DIR: dirs.dataDir, HUKUK_BACKUP_DIR: dirs.backupDir }, encoding: "utf8" })
      .trim()
      .split(/\r?\n/);
    assert.deepEqual(output.map(file => path.basename(path.dirname(file))), ["001 - Şirket 1", "002 - İkinci Şirket"], output.join("\n"));
    assert.deepEqual(filesUnder(dirs.drive), [], "Drive klasörü boş (hiçbir yolda kopya alınmadı)");
    assert.equal(readSetting(db001(dirs)), setting, "001'deki ayar yine aynı");
    assert.equal(readSetting(db002(dirs)), setting, "002'deki ayar yine aynı");
  });
});

describe("Drive'a yedek kaldırıldı — bağlantı kipi ayarı dolu eski kurulum (sahte lisans servisi)", () => {
  const dirs = freshDirs();
  const requests = [];
  const fetchCalls = [];
  const realFetch = globalThis.fetch;
  let service;
  let serviceBase = "";
  let server;
  before(async () => {
    // Sahte lisans servisi: eski kod yükleme oturumu ister (POST /v1/yedek/oturum) ve dosyayı verilen adrese PUT eder.
    service = createServer((req, res) => {
      requests.push(`${req.method} ${req.url}`);
      req.resume();
      req.on("end", () => {
        res.setHeader("content-type", "application/json");
        res.end(req.url.startsWith("/v1/yedek/oturum") ? JSON.stringify({ uploadUrl: `${serviceBase}/yukle` }) : "{}");
      });
    });
    await new Promise(resolve => service.listen(0, "127.0.0.1", resolve));
    serviceBase = `http://127.0.0.1:${service.address().port}`;
    // Sahte fetch: süreçteki her fetch sayılır; sahte servise ya da Google'a giden istek "Drive yüklemesi" demektir.
    globalThis.fetch = (input, init) => {
      const url = String(input?.url || input);
      if (url.startsWith(serviceBase) || /googleapis|drive\.google/.test(url)) fetchCalls.push(`${init?.method || "GET"} ${url}`);
      return realFetch(input, init);
    };
    await prepare(dirs);
    // 2.0.17–2.0.19 düzeni: bağlantı yalnız 002'nin dosyasında (eski kod açılışta ortak katmana taşırdı).
    writeSetting(db002(dirs), linkSetting());
    server = await boot(dirs, { licenseServices: serviceBase });
  });
  after(async () => {
    await server?.app.close();
    globalThis.fetch = realFetch;
    await new Promise(resolve => service.close(resolve));
    rmSync(dirs.root, { recursive: true, force: true });
  });

  test("Şimdi Yedek Al (Tüm + Yalnız) ve otomatik tur: yerel yedek var, servise ve Google'a tek istek yok; ayar ortak katmana taşınmaz", async () => {
    const all = await server.admin.post("/api/admin/backups", {});
    assert.equal(all.status, 200, JSON.stringify(all.data));
    assert.deepEqual(unwrap(all).backups.map(item => item.code).sort(), ["001", "002"]);
    assert.equal((await server.admin.post("/api/admin/backups", { scope: "one" })).status, 200);
    const past = new Date(Date.now() - 7 * 3_600_000);
    for (const folder of ["001 - Şirket 1", "002 - İkinci Şirket"]) for (const name of backupsIn(dirs, folder)) utimesSync(path.join(dirs.backupDir, folder, name), past, past);
    assert.deepEqual(server.app.runDueBackups().map(item => item.company.code).sort(), ["001", "002"]);
    await settle();
    assert.equal(backupsIn(dirs, "001 - Şirket 1").length, 3);
    assert.equal(backupsIn(dirs, "002 - İkinci Şirket").length, 2);
    assert.deepEqual(requests.filter(item => /\/v1\/yedek|\/yukle/.test(item)), [], `sahte servise yedek isteği gitmedi (bütün istekler: ${requests.join(", ") || "yok"})`);
    assert.deepEqual(fetchCalls.filter(item => /\/v1\/yedek|\/yukle|googleapis|drive\.google/.test(item)), [], "sahte fetch: Drive yüklemesi yok");
    assert.equal((await server.admin.get("/api/admin/backups/cloud")).status, 404);
    await server.app.close();
    server = null;
    assert.equal(readSetting(db002(dirs)), linkSetting(), "002'deki bağlantı ayarı aynen duruyor (silinmedi, değişmedi)");
    assert.equal(readSetting(db001(dirs)), null, "ortak katmana (001) bağlantı ayarı taşınmadı");
  });
});
