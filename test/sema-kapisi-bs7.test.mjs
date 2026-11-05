// 2.5.0 BS-7 — şema sürüm kapısı (docs/devir/DEVIR-PLANI.md G6; docs/2.5.0-IS-LISTESI.md BS-7).
// Veri dosyası programın daha yeni bir sürümüyle açılmışsa (user_version > LATEST_VERSION) program onu göç ettirmez ve YAZILABİLİR açmaz: yazma istekleri
// 409 SCHEMA_AHEAD + Türkçe neden, okuma çalışır, arka plan işleri yazmaz, ekran şeridi için client-state.schemaGate. "Yeni sürüm" benzetimi: dosyanın
// user_version'ı LATEST_VERSION + 1 yapılır ve yeni sürümün eklediği varsayılan bir tablo (gelecek_bs7) açılır — eski kod bu tabloyu bilmez, dokunmamalı.
// Nasıl bozulur (testler buradan): 001 yeni / 002 normal; 002 yeni / 001 normal; yeni şemalı şirkete unvan / sıfırlama / kayıt; arka plan turu; yedek alma;
// eski yedeğe geri yükleme (002 hemen, 001 yeniden açılışta) ve kapının kalkması; daha yeni yedeğin geri yüklenmesi (reddedilir); göç adımı (ensureBankSchema).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";
import { openDatabase, createStore } from "../server/lib/db.mjs";
import { ROOT_COMPANY_ID } from "../server/lib/companies.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { LATEST_VERSION, runMigrations } from "../server/lib/migrations.mjs";
import { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const MESSAGE = "Bu şirketin verisi programın daha yeni bir sürümüyle açılmış. Programı güncelleyin; o zamana kadar veri yalnız görüntülenir.";
const AHEAD = LATEST_VERSION + 1;
const today = new Date().toISOString().slice(0, 10);
const roots = [];
after(() => {
  for (const dir of roots) removeTestDir(dir);
});
const workDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-bs7-"));
  roots.push(dir);
  return dir;
};
const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data && response.data.ok ? response.data.data : response.data);

// "Yeni sürüm" benzetimi: şema numarası büyür, yeni bir tablo eklenir (kapalı sunucuda).
function makeAhead(file) {
  const db = new DatabaseSync(file);
  try {
    db.exec(`CREATE TABLE gelecek_bs7 (id TEXT PRIMARY KEY, value TEXT); INSERT INTO gelecek_bs7 VALUES ('a', 'yeni sürümün verisi'); PRAGMA user_version = ${AHEAD}`);
  } finally {
    db.close();
  }
}
const schemaOf = file => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("PRAGMA user_version").get().user_version;
  } finally {
    db.close();
  }
};
// Dosyanın mantıksal parmak izi: tablo → satırların özeti (+ şema numarası). skip: ortak katman tabloları (001'de giriş oturumu ve denetim izi yazılır).
function fingerprint(file, { skip = [] } = {}) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const out = { user_version: db.prepare("PRAGMA user_version").get().user_version };
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
    out.schema = createHash("sha256").update(JSON.stringify(db.prepare("SELECT type, name, sql FROM sqlite_master ORDER BY type, name").all())).digest("hex");
    for (const table of tables) {
      if (skip.includes(table)) continue;
      const rows = db.prepare(`SELECT * FROM "${table}"`).all().map(row => JSON.stringify(row)).sort();
      out[table] = createHash("sha256").update(rows.join("\n")).digest("hex");
    }
    return out;
  } finally {
    db.close();
  }
}

// Programın bütün sabit GET uçları (kaynaktan; yeni uç eklenince kendiliğinden girer). Okuma uçları yeni şemalı şirkette 500 vermemeli (002'de bağlantı kilitli:
// okurken yazan bir uç SQLite hatasıyla görünür) ve 001'in verisine yazmamalı (dosya parmak iziyle denetlenir). Canlı olay akışı (/api/events) uzun bağlantıdır; atlanır.
function staticGetRoutes() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server");
  const found = new Set();
  const walk = folder => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".mjs")) {
        const source = readFileSync(full, "utf8");
        // `${BASE}/summary` biçimi: dosyadaki const BASE = "/api/…" sabitleriyle çözülür; parametreli (:id) ya da çözülemeyen yol atlanır.
        const constants = new Map([...source.matchAll(/const (\w+) = "(\/api\/[^"]+)"/g)].map(match => [match[1], match[2]]));
        for (const match of source.matchAll(/router\.get\(\s*(?:"(\/api\/[^"]+)"|`([^`]+)`)/g)) {
          const route = match[1] ?? match[2].replace(/\$\{(\w+)\}/g, (all, name) => constants.get(name) ?? all);
          if (route.startsWith("/api/") && !route.includes(":") && !route.includes("${")) found.add(route);
        }
      }
    }
  };
  walk(dir);
  found.delete("/api/events");
  return [...found].sort();
}
async function crawl(client, companyId) {
  const failures = [];
  const routes = staticGetRoutes();
  assert.ok(routes.length > 100, `uç listesi okunamadı (${routes.length})`);
  for (const route of routes) {
    const response = await client.raw("GET", `${route}?hofCompany=${encodeURIComponent(companyId)}`);
    if (response.status >= 500) failures.push(`${route} → ${response.status} ${response.data?.error || ""}`);
  }
  return { count: routes.length, failures };
}

// İki şirketli kurulum: 001'de ve 002'de birer cari + Kasa girişi. Sunucu kapanır; veri klasörleri kalır.
async function seedTwoCompanies(dir) {
  const dataDir = path.join(dir, "data");
  const backupDir = path.join(dir, "backups");
  const server = await startTestServer({ dataDir, backupDir });
  try {
    const admin = await loginAdmin(server);
    assert.equal((await admin.post("/api/workspace/accounts", { name: "Bir Cari", type: "customer" })).status, 200);
    assert.equal((await admin.post("/api/workspace/cash", { kind: "in", amount: 100, date: today, description: "001 girişi" })).status, 200);
    const created = await admin.post("/api/companies", { name: "İkinci Şirket" });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const second = unwrap(created).company;
    const q = `?hofCompany=${second.id}`;
    assert.equal((await admin.post(`/api/workspace/accounts${q}`, { name: "İki Cari", type: "customer" })).status, 200);
    assert.equal((await admin.post(`/api/workspace/cash${q}`, { kind: "in", amount: 250, date: today, description: "002 girişi" })).status, 200);
    // 002'nin bugünkü (eski şemalı) yedeği: geri yükleme senaryosu bunu kullanır.
    const backup = await admin.post("/api/admin/backups", { scope: "one", companyId: second.id });
    assert.equal(backup.status, 200, JSON.stringify(backup.data));
    const rootBackup = await admin.post("/api/admin/backups", { scope: "one", companyId: ROOT_COMPANY_ID });
    assert.equal(rootBackup.status, 200, JSON.stringify(rootBackup.data));
    const companies = unwrap(await admin.get("/api/companies")).companies;
    const dirs = server.app.companies.dirsOf(server.app.companies.get(second.id));
    return { dataDir, backupDir, second, secondFile: resolveDbPath(dirs.dataDir), rootFile: resolveDbPath(dataDir), secondBackup: unwrap(backup).name, rootBackup: unwrap(rootBackup).name, companies };
  } finally {
    await server.close();
  }
}

describe("BS-7 şema sürüm kapısı", () => {
  test("göç: yeni şemalı dosyada hiçbir göç adımı koşmaz (ensureBankSchema dahil), dosya aynen kalır", () => {
    const dir = workDir();
    const file = path.join(dir, "goc.sqlite");
    const db = openDatabase(file);
    try {
      const store = createStore(db);
      runMigrations(store, {});
      assert.equal(store.get("PRAGMA user_version").user_version, LATEST_VERSION);
      // Yeni sürüm bu indeksi kaldırmış olsun; eski kod onu yeniden kurmamalı.
      db.exec(`DROP INDEX IF EXISTS idx_audit_entity; PRAGMA user_version = ${AHEAD}`);
      const before = fingerprint(file);
      const result = runMigrations(store, {});
      assert.equal(store.get("PRAGMA user_version").user_version, AHEAD, "şema numarası düşmemeli");
      assert.equal(store.get("SELECT 1 AS found FROM sqlite_master WHERE name = 'idx_audit_entity'"), undefined, "ensureBankSchema yeni şemalı dosyaya indeks eklememeli");
      assert.deepEqual(fingerprint(file), before);
      assert.equal(result.ahead, true, `ahead işareti: ${JSON.stringify(result)}`);
      assert.deepEqual(result.applied, []);
    } finally {
      db.close();
    }
  });

  test("002 yeni şemalı, 001 normal: 002 yalnız görüntülenir, 001 çalışır; 002 dosyası bayt bayt aynı mantıksal içerikte kalır", async () => {
    const dir = workDir();
    const seed = await seedTwoCompanies(dir);
    makeAhead(seed.secondFile);
    const before = fingerprint(seed.secondFile);
    const server = await startTestServer({ dataDir: seed.dataDir, backupDir: seed.backupDir });
    try {
      const admin = await loginAdmin(server);
      const q = `?hofCompany=${seed.second.id}`;
      // Okuma çalışır.
      const accounts = await admin.get(`/api/workspace/accounts${q}`);
      assert.equal(accounts.status, 200, JSON.stringify(accounts.data));
      assert.deepEqual(unwrap(accounts).accounts.map(item => item.name), ["İki Cari"]);
      const cash = await admin.get(`/api/workspace/cash${q}`);
      assert.equal(cash.status, 200);
      assert.equal(unwrap(cash).totals.balance, 250);
      // Yazma istekleri 409 + Türkçe neden.
      const write = await admin.post(`/api/workspace/cash${q}`, { kind: "in", amount: 5, date: today, description: "olmamalı" });
      assert.equal(write.status, 409, JSON.stringify(write.data));
      assert.equal(write.data.code, "SCHEMA_AHEAD");
      assert.equal(write.data.error, MESSAGE);
      const account = await admin.post(`/api/workspace/accounts${q}`, { name: "Yeni Cari", type: "customer" });
      assert.equal(account.status, 409, JSON.stringify(account.data));
      // Ekran şeridinin bilgisi.
      const state = unwrap(await admin.get(`/api/workspace/client-state${q}`));
      assert.deepEqual(state.schemaGate, { code: "SCHEMA_AHEAD", version: AHEAD, latest: LATEST_VERSION, message: MESSAGE });
      assert.equal(unwrap(await admin.get("/api/workspace/client-state")).schemaGate, null, "001'in şeridi yok");
      // Ortak katmandan 002'ye yazan işlemler: unvan değiştirme ve sıfırlama (kayıt defteri de değişmez).
      const rename = await admin.put(`/api/companies/${seed.second.id}`, { name: "Başka Ad" });
      assert.equal(rename.status, 409, JSON.stringify(rename.data));
      assert.equal(rename.data.code, "SCHEMA_AHEAD");
      assert.equal(server.app.companies.get(seed.second.id).name, "İkinci Şirket", "kayıt defteri değişmemeli");
      const reset = await admin.post(`/api/companies/${seed.second.id}/reset`, { mode: "movements", confirm: "002", password: ADMIN_PASSWORD });
      assert.equal(reset.status, 409, JSON.stringify(reset.data));
      // Şirket seçimi (ortak katman) çalışır.
      assert.equal((await admin.post("/api/companies/select", { id: seed.second.id })).status, 200);
      // Arka plan: 002'nin hiçbir işi yazmaz; 001'inki yazar.
      const child = server.app.openCompany(seed.second.id);
      assert.ok(child, "002 açık olmalı");
      assert.equal(child.schemaGate?.version, AHEAD);
      assert.equal(child.context.canWriteInBackground(), false);
      assert.equal(server.app.context.canWriteInBackground(), true);
      // Bağlantı kilidi (query_only): kapıyı atlayan bir yazıcı da 002 dosyasını değiştiremez.
      assert.throws(() => child.store.run("INSERT INTO gelecek_bs7 (id, value) VALUES ('b', 'eski kod')"), /readonly/i, "002 bağlantısı yazıma kapalı olmalı");
      // Yedek almak okumadır: yeni şemalı şirkette de çalışır.
      const backup = await admin.post("/api/admin/backups", { scope: "one", companyId: seed.second.id });
      assert.equal(backup.status, 200, JSON.stringify(backup.data));
      // Bütün okuma uçları yeni şemalı 002'de çalışır (bağlantı kilitli: okurken yazan uç 500 verirdi).
      const read = await crawl(admin, seed.second.id);
      assert.deepEqual(read.failures, [], `${read.count} uçtan 5xx verenler`);
      // 001 yazılabilir.
      const rootWrite = await admin.post(`/api/workspace/cash?hofCompany=${ROOT_COMPANY_ID}`, { kind: "in", amount: 7, date: today, description: "001 sürer" });
      assert.equal(rootWrite.status, 200, JSON.stringify(rootWrite.data));
    } finally {
      await server.close();
    }
    assert.equal(schemaOf(seed.secondFile), AHEAD, "002'nin şema numarası düşmemeli");
    assert.deepEqual(fingerprint(seed.secondFile), before, "002'nin içeriği değişmemeli");
  });

  test("001 yeni şemalı, 002 normal: giriş ve okuma çalışır, 001'e veri yazılmaz; 002'ye geçilip çalışılır", async () => {
    const dir = workDir();
    const seed = await seedTwoCompanies(dir);
    makeAhead(seed.rootFile);
    // Ortak katman: giriş oturumu (sessions) ve denetim izi (audit_events) 001 dosyasında; bunlar yazılır (giriş olmadan veri görülemez).
    const skip = ["sessions", "audit_events", "users"];
    const before = fingerprint(seed.rootFile, { skip });
    const settingsAt = () => {
      const db = new DatabaseSync(seed.rootFile, { readOnly: true });
      try {
        return new Map(db.prepare("SELECT key, value, updated_at FROM settings").all().map(row => [row.key, `${row.value}|${row.updated_at}`]));
      } finally {
        db.close();
      }
    };
    const settingsBefore = settingsAt();
    const server = await startTestServer({ dataDir: seed.dataDir, backupDir: seed.backupDir });
    try {
      const admin = server.client();
      assert.equal((await admin.login("admin", ADMIN_PASSWORD)).status, 200, "giriş çalışmalı");
      const cash = await admin.get("/api/workspace/cash");
      assert.equal(cash.status, 200);
      assert.equal(unwrap(cash).totals.balance, 100);
      const write = await admin.post("/api/workspace/cash", { kind: "in", amount: 5, date: today, description: "olmamalı" });
      assert.equal(write.status, 409, JSON.stringify(write.data));
      assert.equal(write.data.error, MESSAGE);
      assert.equal(server.app.schemaGate?.version, AHEAD);
      assert.equal(unwrap(await admin.get("/api/workspace/client-state")).schemaGate?.version, AHEAD);
      // Ortak katmanın yönetim yazımları da 001 dosyasına gider → reddedilir (kullanıcı ekleme).
      const user = await admin.post("/api/admin/users", { username: "yeni", name: "Yeni", role: "personel", password: "Personel-2026!", mustChangePassword: false });
      assert.equal(user.status, 409, JSON.stringify(user.data));
      assert.equal(server.app.context.canWriteInBackground(), false, "001'in arka plan işleri yazmaz");
      // Bütün okuma uçları: 5xx yok; 001'in veri tabloları (sonda parmak izi) değişmez.
      const read = await crawl(admin, ROOT_COMPANY_ID);
      assert.deepEqual(read.failures, [], `${read.count} uçtan 5xx verenler`);
      // 002'ye geçilir ve orada çalışılır.
      assert.equal((await admin.post("/api/companies/select", { id: seed.second.id })).status, 200);
      const secondWrite = await admin.post(`/api/workspace/cash?hofCompany=${seed.second.id}`, { kind: "in", amount: 9, date: today, description: "002 sürer" });
      assert.equal(secondWrite.status, 200, JSON.stringify(secondWrite.data));
      assert.equal(unwrap(await admin.get(`/api/workspace/client-state?hofCompany=${seed.second.id}`)).schemaGate, null);
      assert.equal(server.app.openCompany(seed.second.id).context.canWriteInBackground(), true);
    } finally {
      await server.close();
    }
    assert.equal(schemaOf(seed.rootFile), AHEAD);
    const afterPrint = fingerprint(seed.rootFile, { skip });
    // settings: yalnız ortak katman anahtarları (şirket seçimi, lisans, oturum) değişebilir; şirket verisi tabloları aynen.
    const { settings: _before, ...restBefore } = before;
    const { settings: _after, ...restAfter } = afterPrint;
    assert.deepEqual(restAfter, restBefore, "001'in veri tabloları değişmemeli");
    const settingsAfter = settingsAt();
    const changed = [...new Set([...settingsBefore.keys(), ...settingsAfter.keys()])].filter(key => settingsBefore.get(key) !== settingsAfter.get(key)).sort();
    for (const key of changed) assert.match(key, /^(company\.|license\.|auth\.)/, `001'de yalnız ortak katman ayarı yazılabilir; değişen: ${changed.join(", ")}`);
  });

  test("geri yükleme + kapı: yeni şemalı 002 eski yedeğine döner (kapı kalkar); 001 eski yedeği yeniden açılışta uygulanır; daha yeni yedek reddedilir", async () => {
    const dir = workDir();
    const seed = await seedTwoCompanies(dir);
    makeAhead(seed.secondFile);
    makeAhead(seed.rootFile);
    let server = await startTestServer({ dataDir: seed.dataDir, backupDir: seed.backupDir });
    try {
      const admin = await loginAdmin(server);
      // Yeni şemalı dosyanın yedeği (programdan yeni) geri yüklenemez — 002'ye de.
      const newer = await admin.post("/api/admin/backups", { scope: "one", companyId: seed.second.id });
      assert.equal(newer.status, 200, JSON.stringify(newer.data));
      const refused = await admin.post("/api/admin/backups/restore", { name: unwrap(newer).name, company: seed.second.id, confirm: "002", password: ADMIN_PASSWORD });
      assert.equal(refused.status, 409, JSON.stringify(refused.data));
      assert.match(refused.data.error, /daha yeni bir sürümünde alınmış/);
      // Eski (programın şemasındaki) yedek 002'ye hemen geri yüklenir; şirket yazılabilir olur.
      const restored = await admin.post("/api/admin/backups/restore", { name: seed.secondBackup, company: seed.second.id, confirm: "002", password: ADMIN_PASSWORD });
      assert.equal(restored.status, 200, JSON.stringify(restored.data));
      assert.equal(schemaOf(seed.secondFile), LATEST_VERSION);
      const q = `?hofCompany=${seed.second.id}`;
      assert.equal(unwrap(await admin.get(`/api/workspace/client-state${q}`)).schemaGate ?? null, null);
      const write = await admin.post(`/api/workspace/cash${q}`, { kind: "in", amount: 11, date: today, description: "geri yüklemeden sonra" });
      assert.equal(write.status, 200, JSON.stringify(write.data));
      // Geri yükleme öncesi yedek (yeni şemalı veri) şirketin klasöründe durur — veri kaybolmaz.
      const folder = server.app.companies.dirsOf(server.app.companies.get(seed.second.id)).backupDir;
      assert.ok(readdirSync(folder).some(name => /geri-yukleme-oncesi-002/.test(name)), readdirSync(folder).join(","));
      // 001: eski yedek hazırlanır; aşağıda hazırlanan kopya yeniden açılıştan önce bozulur (BS-7 tur 1, dar kontrol ORTA-1).
      const stagedBroken = await admin.post("/api/admin/backups/restore", { name: seed.rootBackup, company: ROOT_COMPANY_ID, confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(stagedBroken.status, 200, JSON.stringify(stagedBroken.data));
      assert.equal(unwrap(stagedBroken).staged, true);
    } finally {
      await server.close();
    }
    // Başarısız 001 geri yüklemesi kapı açıkken de sessiz kalmaz: sonuç Yönetim → Yedekler'de (lastRestore) görünür; 001 yeni şemada kalır (kapı sürer).
    const stagedCopy = path.join(seed.dataDir, "geri-yukleme", seed.rootBackup);
    assert.ok(existsSync(stagedCopy), `hazırlanan kopya yok: ${stagedCopy}`);
    writeFileSync(stagedCopy, "bozuk kopya — veri tabanı değil");
    // BS-7 dar kontrol DÜŞÜK-1: kapılı 001'e başarısız geri yükleme açılışında YALNIZ sonuç notu (backup.lastRestore — kapının bilinçli istisnası) ile ortak katman
    // ayarları (license.*, company.*, auth.*) yazılabilir; denetim izi dahil başka hiçbir şey değişmez. Önce/sonra giriş YAPILMADAN alınır (giriş ortak katmana yazar).
    const rootAudit = () => {
      const db = new DatabaseSync(seed.rootFile, { readOnly: true });
      try {
        return db.prepare("SELECT COUNT(*) AS n FROM audit_events").get().n;
      } finally {
        db.close();
      }
    };
    const rootSettings = () => {
      const db = new DatabaseSync(seed.rootFile, { readOnly: true });
      try {
        return new Map(db.prepare("SELECT key, value, updated_at FROM settings").all().map(row => [row.key, `${row.value}|${row.updated_at}`]));
      } finally {
        db.close();
      }
    };
    const { settings: _rootSettingsBefore, ...rootBefore } = fingerprint(seed.rootFile);
    const rootSettingsBefore = rootSettings();
    const rootAuditBefore = rootAudit();
    server = await startTestServer({ dataDir: seed.dataDir, backupDir: seed.backupDir });
    try {
      assert.equal(server.app.stagedRestore?.ok, false, JSON.stringify(server.app.stagedRestore));
      assert.equal(server.app.schemaGate?.version, AHEAD, "geri yükleme uygulanmadı; 001 yeni şemada, kapı sürer");
      assert.equal(schemaOf(seed.rootFile), AHEAD);
      assert.equal(rootAudit(), rootAuditBefore, "kapılı 001'e geri yükleme denetim izi (audit_events) yazılmamalı");
      const { settings: _rootSettingsAfter, ...rootAfter } = fingerprint(seed.rootFile);
      assert.deepEqual(rootAfter, rootBefore, "kapılı 001'in tabloları (audit_events dahil) başarısız geri yükleme açılışında değişmemeli");
      const rootSettingsAfter = rootSettings();
      const changedKeys = [...new Set([...rootSettingsBefore.keys(), ...rootSettingsAfter.keys()])].filter(key => rootSettingsBefore.get(key) !== rootSettingsAfter.get(key)).sort();
      assert.ok(changedKeys.includes("backup.lastRestore"), `sonuç notu yazılmalı; değişen: ${changedKeys.join(", ")}`);
      for (const key of changedKeys) assert.match(key, /^(backup\.lastRestore$|company\.|license\.|auth\.)/, `kapılı 001'de yalnız sonuç notu ve ortak katman ayarı yazılabilir; değişen: ${changedKeys.join(", ")}`);
      const admin = await loginAdmin(server);
      const folders = unwrap(await admin.get("/api/admin/backups/folders"));
      assert.equal(folders.lastRestore?.ok, false, `başarısız geri yükleme Yedekler'de görünmeli: ${JSON.stringify(folders.lastRestore)}`);
      assert.match(folders.lastRestore.error, /Yedek dosyası okunamadı/);
      assert.equal(folders.lastRestore.name, seed.rootBackup);
      // 001: eski yedek yeniden hazırlanır (yeniden açılışta uygulanır).
      const staged = await admin.post("/api/admin/backups/restore", { name: seed.rootBackup, company: ROOT_COMPANY_ID, confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(staged.status, 200, JSON.stringify(staged.data));
      assert.equal(unwrap(staged).staged, true);
    } finally {
      await server.close();
    }
    server = await startTestServer({ dataDir: seed.dataDir, backupDir: seed.backupDir });
    try {
      assert.equal(server.app.stagedRestore?.ok, true, JSON.stringify(server.app.stagedRestore));
      assert.equal(server.app.schemaGate, null, "001 eski yedeğe döndü; kapı kalktı");
      assert.equal(schemaOf(seed.rootFile), LATEST_VERSION);
      const admin = await loginAdmin(server);
      assert.equal((await admin.post("/api/workspace/cash", { kind: "in", amount: 3, date: today, description: "001 yeniden yazılabilir" })).status, 200);
      // Geri yükleme öncesi yedekte yeni şemalı 001 verisi durur.
      const rootFolder = path.join(seed.backupDir, readdirSync(seed.backupDir).find(name => name.startsWith("001")));
      assert.ok(readdirSync(rootFolder).some(name => /geri-yukleme-oncesi-001/.test(name)), readdirSync(rootFolder).join(","));
    } finally {
      await server.close();
    }
  });
});
