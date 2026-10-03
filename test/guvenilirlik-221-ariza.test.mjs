// ARIZA testi (2.0.21 güvenilirlik, CLAUDE.md 2.0.21 madde 5): yedek ve geri yükleme ortasında kesinti, disk dolu, kilitli /
// eksik / bozuk veri dosyası, bozuk şirket listesi, meşgul şirket. Kural: veri BOZULMAZ, başka şirkete DÜŞMEZ, kullanıcıya
// açık hata verilir. Veri: gerçek v2.0.19 zinciri (test/fixtures/surum-2.0.19-zincir), güncel sürümle açılır.
//
// Hata enjeksiyonu: node:fs işlevleri test süresince sarılır (module.syncBuiltinESMExports ile programın içe aktardığı
// adlara da geçer) — yalnız belirli dosya yolunda hata verir; disk dolu, SQLite'ın VACUUM INTO sırasında verdiği hatayla
// (yarım yazılmış dosya + "database or disk is full") taklit edilir.
import assert from "node:assert/strict";
import fs, { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, test } from "node:test";
import { BACKUP_NAME } from "../server/lib/backup.mjs";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { apiFacts, dbFacts } from "./guvenilirlik/olgular.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { companyDbFile, readRegistry } from "./guvenilirlik/uretici.mjs";

// node:fs işlevini sarar: koşul tutunca hata fırlatır. Dönen işlev eski hâline getirir.
function inject(name, when, makeError) {
  const original = fs[name];
  fs[name] = function patched(...args) {
    if (when(...args)) throw makeError(...args);
    return original.apply(this, args);
  };
  syncBuiltinESMExports();
  return () => {
    fs[name] = original;
    syncBuiltinESMExports();
  };
}
const fsError = (code, message) => Object.assign(new Error(`${code}: ${message}`), { code });

// Ortak hazırlık: fikstürü aç, güncel sürümü başlat.
function harness() {
  const h = { fixture: null, server: null, api: null };
  h.start = async () => {
    h.fixture = h.fixture || unpackFixture("surum-2.0.19-zincir");
    h.server = await bootVersion(CURRENT, { dataDir: h.fixture.dataDir, backupDir: h.fixture.backupDir });
    h.api = await h.server.login();
  };
  h.restart = async () => {
    await h.server.close();
    await h.start();
  };
  h.stop = async () => {
    await h.server?.close();
    h.fixture?.cleanup();
  };
  h.company = code => h.fixture.fixture.final.find(item => item.code === code);
  h.entry = id => readRegistry(h.fixture.dataDir).find(item => item.id === id);
  h.dbFile = id => companyDbFile(h.fixture.dataDir, h.entry(id));
  h.facts = id => dbFacts(h.dbFile(id));
  h.folder = id => h.server.app.backups.folderOf(h.server.app.companies.get(id));
  h.select = async id => assert.equal((await h.api.post("/api/companies/select", { id })).status, 200);
  h.listed = async id => (await h.api.get("/api/admin/backups")).data.filter(item => item.companyId === id).map(item => item.name).sort();
  return h;
}

describe("yedek alırken kesinti ve disk dolu", () => {
  const h = harness();
  before(() => h.start());
  after(() => h.stop());

  test("yarıda kesilen yedek (.yaziliyor) listelenmez, geri yüklenemez; bir saatten eskisi sonraki yedekte temizlenir, tazesi kalır", async () => {
    const one = h.company("001");
    const folder = h.folder(one.id);
    mkdirSync(folder, { recursive: true });
    // Elektrik kesilmiş gibi: geçici adla yarım yazılmış iki dosya (biri 2 saat önce, biri az önce).
    const live = readFileSync(h.dbFile(one.id));
    const stale = path.join(folder, "destekofis-001-2026-01-01T00-00-00-000Z-manuel.sqlite.yaziliyor");
    const fresh = path.join(folder, "destekofis-001-2026-01-02T00-00-00-000Z-manuel.sqlite.yaziliyor");
    writeFileSync(stale, live.subarray(0, Math.floor(live.length / 2)));
    writeFileSync(fresh, live.subarray(0, 4096));
    const old = Date.now() / 1000 - 2 * 3600;
    utimesSync(stale, old, old);
    const listed = await h.listed(one.id);
    assert.ok(!listed.some(name => name.includes("2026-01-0")), `yarım dosya listede: ${listed.join(", ")}`);
    const refused = await h.api.post("/api/admin/backups/restore", { name: path.basename(stale), company: one.id, confirm: "001", password: ADMIN_PASSWORD });
    assert.equal(refused.status, 400, "yarım dosya adı geçersiz yedek adı");
    assert.equal((await h.api.post("/api/admin/backups", { scope: "one", companyId: one.id })).status, 200);
    assert.ok(!existsSync(stale), "bir saatten eski yarım dosya temizlendi");
    assert.ok(existsSync(fresh), "taze yarım dosyaya dokunulmadı (başka işlem yazıyor olabilir)");
    rmSync(fresh);
  });

  test("disk dolu (VACUUM INTO yarıda): açık hata, yarım dosya kalmaz, listede yeni yedek yok, canlı veri aynı", async () => {
    const one = h.company("001");
    const folder = h.folder(one.id);
    const before = await h.listed(one.id);
    const facts = h.facts(one.id);
    const db = h.server.app.db;
    const exec = db.exec;
    db.exec = function full(sql) {
      const match = /^VACUUM INTO '(.+)'$/.exec(String(sql));
      if (!match) return exec.call(this, sql);
      // SQLite disk dolunca hedefe yazabildiği kadarını yazmış olur ve SQLITE_FULL döner.
      writeFileSync(match[1].replace(/''/g, "'"), Buffer.alloc(64 * 1024, 7));
      throw Object.assign(new Error("database or disk is full"), { code: "ERR_SQLITE_ERROR", errcode: 13 });
    };
    try {
      const response = await h.api.post("/api/admin/backups", { scope: "one", companyId: one.id });
      assert.equal(response.status, 500, JSON.stringify(response.data));
      assert.match(response.data.error, /Yedek alınamadı/);
      assert.match(response.data.error, /disk is full/);
      // Tüm Şirketler: öbür şirketler yedeklenir, alınamayan açıkça bildirilir.
      const all = await h.api.post("/api/admin/backups", { scope: "all" });
      assert.equal(all.status, 200, JSON.stringify(all.data));
      assert.deepEqual(all.data.failed.map(item => item.companyId), [one.id]);
      assert.equal(all.data.backups.length, h.fixture.fixture.final.length - 1);
    } finally {
      db.exec = exec;
    }
    const leftovers = readdirSync(folder).filter(name => name.endsWith(".yaziliyor"));
    assert.deepEqual(leftovers, [], "yarım (.yaziliyor) dosya diskte kalmadı");
    assert.deepEqual(await h.listed(one.id), before, "listede yeni yedek yok");
    assert.deepEqual(h.facts(one.id), facts, "canlı veri aynı");
    assert.equal((await h.api.post("/api/admin/backups", { scope: "one", companyId: one.id })).status, 200, "disk boşalınca yedek alınır");
  });
});

describe("geri yükleme ortasında hata: şirketin canlı verisi bozulmaz", () => {
  const h = harness();
  let two;
  let backup;
  let facts;
  before(async () => {
    await h.start();
    two = h.company("002");
    await h.select(two.id);
    backup = (await h.api.post("/api/admin/backups", { scope: "one", companyId: two.id })).data.backups[0].name;
    assert.equal((await h.api.post("/api/workspace/accounts", { name: "Yedekten Sonra Açılan Cari", type: "customer" })).status, 200);
    facts = await apiFacts(h.api);
  });
  after(() => h.stop());
  const unchanged = async () => {
    await h.select(two.id);
    assert.deepEqual(await apiFacts(h.api), facts, "şirketin verisi aynı ve okunuyor");
    const dir = path.dirname(h.dbFile(two.id));
    assert.deepEqual(readdirSync(dir).filter(name => name.includes(".geri-yukleme")), [], "geçici dosya kalmadı");
    assert.equal(h.server.app.context.busyCompanies.size, 0, "şirket meşgul kalmadı");
  };

  test("kopyalama adımı hata verir (EIO): 500, veri aynı", async () => {
    const restore = inject("copyFileSync", (from, to) => String(to).endsWith(".geri-yukleme"), () => fsError("EIO", "i/o error, copyfile"));
    let response;
    try {
      response = await h.api.post("/api/admin/backups/restore", { name: backup, company: two.id, confirm: two.code, password: ADMIN_PASSWORD });
    } finally {
      restore();
    }
    assert.equal(response.status, 500, JSON.stringify(response.data));
    assert.match(response.data.error, /şirketin verisi değişmedi/);
    await unchanged();
  });

  test("dosya değiştirme adımı hata verir (EBUSY: Windows'ta dosya başka programda açık): 500, veri aynı", async () => {
    const restore = inject("renameSync", from => String(from).endsWith(".geri-yukleme"), () => fsError("EBUSY", "resource busy or locked, rename"));
    let response;
    try {
      response = await h.api.post("/api/admin/backups/restore", { name: backup, company: two.id, confirm: two.code, password: ADMIN_PASSWORD });
    } finally {
      restore();
    }
    assert.equal(response.status, 500, JSON.stringify(response.data));
    assert.match(response.data.error, /Veri dosyası değiştirilemedi; şirketin verisi değişmedi/);
    await unchanged();
  });

  test("hata geçince aynı geri yükleme çalışır; veri yedek anına döner", async () => {
    const response = await h.api.post("/api/admin/backups/restore", { name: backup, company: two.id, confirm: two.code, password: ADMIN_PASSWORD });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    await h.select(two.id);
    assert.equal((await apiFacts(h.api)).accounts.count, facts.accounts.count - 1, "yedekten sonra açılan cari geri gitti");
  });

  test("001'in hazırlanan geri yüklemesi açılışta kopyalanamazsa sunucu mevcut veriyle açılır; sonuç ekranda", async () => {
    const one = h.company("001");
    const taken = (await h.api.post("/api/admin/backups", { scope: "one", companyId: one.id })).data.backups[0].name;
    await h.select(one.id);
    assert.equal((await h.api.post("/api/workspace/accounts", { name: "001 Yedekten Sonra", type: "customer" })).status, 200);
    const facts1 = h.facts(one.id);
    assert.equal((await h.api.post("/api/admin/backups/restore", { name: taken, company: one.id, confirm: "001", password: ADMIN_PASSWORD })).data.staged, true);
    await h.server.close();
    const restore = inject("copyFileSync", (from, to) => String(to).endsWith(".geri-yukleme"), () => fsError("EIO", "i/o error, copyfile"));
    try {
      await h.start();
    } finally {
      restore();
    }
    assert.equal(h.server.app.stagedRestore?.ok, false, JSON.stringify(h.server.app.stagedRestore));
    assert.deepEqual(h.facts(one.id), facts1, "001'in verisi aynı");
    const info = (await h.api.get("/api/admin/backups/folders")).data;
    assert.equal(info.lastRestore?.ok, false, "başarısız geri yükleme Yönetim → Yedekler'de görünür");
    assert.equal(info.pending, null, "yarım iş kalmadı");
    assert.ok(!existsSync(path.join(h.fixture.dataDir, "destekofis.sqlite.geri-yukleme")), "geçici dosya kalmadı");
  });
});

describe("meşgul şirket: aynı anda ikinci işlem 409, veri isteği 503; hiçbir istek başka şirketin verisini görmez", () => {
  const h = harness();
  before(() => h.start());
  after(() => h.stop());

  test("geri yükleme sürerken (meşgul) geri yükleme, ad, sıfırlama, silme 409; veri isteği 503", async () => {
    const two = h.company("002");
    const backup = (await h.api.post("/api/admin/backups", { scope: "one", companyId: two.id })).data.backups[0].name;
    await h.select(two.id);
    h.server.app.context.busyCompanies.set(two.id, "“002” yedekten geri yükleniyor; birkaç saniye sonra yeniden deneyin.");
    try {
      assert.equal((await h.api.post("/api/admin/backups/restore", { name: backup, company: two.id, confirm: two.code, password: ADMIN_PASSWORD })).status, 409);
      assert.equal((await h.api.put(`/api/companies/${two.id}`, { name: "Başka Ad" })).status, 409);
      assert.equal((await h.api.post(`/api/companies/${two.id}/reset`, { confirm: two.code, password: ADMIN_PASSWORD, mode: "all" })).status, 409);
      assert.equal((await h.api.del(`/api/companies/${two.id}`, { confirm: two.code, password: ADMIN_PASSWORD })).status, 409);
      const read = await h.api.get("/api/workspace/accounts");
      assert.equal(read.status, 503);
      const write = await h.api.post("/api/workspace/accounts", { name: "Meşgulken Yazılan", type: "customer" });
      assert.equal(write.status, 503, "yazma isteği başka şirkete düşmez");
    } finally {
      h.server.app.context.busyCompanies.delete(two.id);
    }
    await h.select("sirket-001");
    assert.equal((await h.api.get(`/api/workspace/accounts?q=${encodeURIComponent("Meşgulken Yazılan")}`)).data.accounts.length, 0, "001'e yazılmadı");
  });

  test("aynı şirkete aynı anda iki geri yükleme ve okuma: biri uygulanır, öbürü 409 ya da sırayla; okuma hiçbir zaman 001'in verisini görmez", async () => {
    const two = h.company("002");
    const backup = (await h.api.post("/api/admin/backups", { scope: "one", companyId: two.id })).data.backups[0].name;
    await h.select(two.id);
    const snapshot = await apiFacts(h.api);
    assert.equal((await h.api.post("/api/workspace/accounts", { name: "Eşzamanlı Testten Önce", type: "customer" })).status, 200);
    // 001'in cari kimlikleri doğrudan veri dosyasından (seçim kullanıcıya bağlı; aynı kullanıcıyla 001'i seçmek bozardı).
    const rootDb = new DatabaseSync(h.dbFile("sirket-001"), { readOnly: true });
    const oneIds = new Set(rootDb.prepare("SELECT id FROM accounts").all().map(row => row.id));
    rootDb.close();
    assert.ok(oneIds.size > 0);
    const body = { name: backup, company: two.id, confirm: two.code, password: ADMIN_PASSWORD };
    const results = await Promise.all([h.api.post("/api/admin/backups/restore", body), h.api.post("/api/admin/backups/restore", body), h.api.get("/api/workspace/accounts?status=all&limit=5000"), h.api.get("/api/workspace/accounts?status=all&limit=5000")]);
    const statuses = results.slice(0, 2).map(item => item.status);
    assert.ok(statuses.includes(200), JSON.stringify(results.slice(0, 2).map(item => item.data)));
    assert.ok(statuses.every(status => status === 200 || status === 409), JSON.stringify(statuses));
    for (const read of results.slice(2)) {
      assert.ok(read.status === 200 || read.status === 503, `okuma ${read.status}`);
      if (read.status === 200) assert.ok(!read.data.accounts.some(item => oneIds.has(item.id)), "okuma 001'in carilerini gösterdi");
    }
    assert.deepEqual(await apiFacts(h.api), snapshot, "sonuç yedek anındaki veri");
    assert.equal(h.server.app.context.busyCompanies.size, 0);
  });
});

describe("kilitli, eksik ya da bozuk veri dosyası: 503 company-unavailable, 001'e düşmez, boş şirket açılmaz", () => {
  const h = harness();
  let rootFacts;
  before(async () => {
    await h.start();
    rootFacts = h.facts("sirket-001");
  });
  after(() => h.stop());
  const unavailable = async (company, what) => {
    await h.select(company.id);
    const read = await h.api.get("/api/workspace/accounts");
    assert.equal(read.status, 503, `${what}: ${read.status} ${JSON.stringify(read.data).slice(0, 200)}`);
    assert.equal(read.data.code, "company-unavailable");
    assert.match(read.data.error, new RegExp(company.code));
    const write = await h.api.post("/api/workspace/accounts", { name: `${what} Sırasında Yazılan`, type: "customer" });
    assert.equal(write.status, 503, `${what}: yazma isteği`);
    assert.deepEqual(h.facts("sirket-001"), rootFacts, `${what}: 001'in verisi değişmedi`);
  };

  test("başka program dosyayı kilitlemiş (SQLite özel kilit): 503; kilit kalkınca açılır", async () => {
    const company = h.company("007");
    await h.server.app.context.closeCompany(company.id);
    const lock = new DatabaseSync(h.dbFile(company.id));
    lock.exec("PRAGMA locking_mode = EXCLUSIVE; BEGIN EXCLUSIVE; UPDATE settings SET value = value WHERE key = 'office.name';");
    try {
      await unavailable(company, "Kilitli Dosya");
    } finally {
      lock.exec("ROLLBACK");
      lock.close();
    }
    assert.deepEqual(await apiFacts(h.api), company.api, "kilit kalkınca şirket verisiyle açılır");
  });

  test("veri dosyası bozuk (veri tabanı değil): 503", async () => {
    const company = h.company("004");
    await h.server.app.context.closeCompany(company.id);
    const file = h.dbFile(company.id);
    const saved = readFileSync(file);
    writeFileSync(file, Buffer.from("Bu bir veri tabanı değil.".repeat(500)));
    for (const suffix of ["-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });
    try {
      await unavailable(company, "Bozuk Dosya");
    } finally {
      await h.server.app.context.closeCompany(company.id);
      writeFileSync(file, saved);
    }
    assert.deepEqual(await apiFacts(h.api), company.api, "dosya düzelince açılır");
  });

  test("veri dosyası silinmiş: 503 (boş şirket AÇILMAZ); yedekten geri yüklenince veri döner", async () => {
    const company = h.company("002");
    await h.select(company.id);
    const backup = (await h.api.post("/api/admin/backups", { scope: "one", companyId: company.id })).data.backups[0].name;
    const facts = await apiFacts(h.api);
    await h.server.app.context.closeCompany(company.id);
    const file = h.dbFile(company.id);
    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });
    await unavailable(company, "Silinmiş Dosya");
    assert.ok(!existsSync(file), "boş veri tabanı oluşturulmadı");
    const restored = await h.api.post("/api/admin/backups/restore", { name: backup, company: company.id, confirm: company.code, password: ADMIN_PASSWORD });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    await h.select(company.id);
    assert.deepEqual(await apiFacts(h.api), facts, "yedekten geri döndü");
  });

  test("veri klasörü tamamen silinmiş: 503; yedekten geri yüklenince veri döner", async () => {
    const company = h.company("002");
    await h.select(company.id);
    const backup = (await h.api.post("/api/admin/backups", { scope: "one", companyId: company.id })).data.backups[0].name;
    const facts = await apiFacts(h.api);
    await h.server.app.context.closeCompany(company.id);
    const dir = path.dirname(h.dbFile(company.id));
    rmSync(dir, { recursive: true, force: true });
    await unavailable(company, "Silinmiş Klasör");
    assert.ok(!existsSync(dir), "boş klasör/veri tabanı oluşturulmadı");
    const restored = await h.api.post("/api/admin/backups/restore", { name: backup, company: company.id, confirm: company.code, password: ADMIN_PASSWORD });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    await h.select(company.id);
    assert.deepEqual(await apiFacts(h.api), facts, "yedekten geri döndü");
  });

  test("yeni açılan şirket (boş klasör) yine açılır", async () => {
    const created = await h.api.post("/api/companies", { name: "Yeni Açılan", select: true });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    assert.equal((await h.api.get("/api/workspace/accounts")).status, 200);
    assert.equal((await h.api.post("/api/workspace/accounts", { name: "İlk Cari", type: "customer" })).status, 200);
    await h.restart();
    await h.select(created.data.company.id);
    assert.equal((await h.api.get("/api/workspace/accounts")).data.accounts.length, 1, "yeniden açılışta da açılır");
  });
});

describe("şirket listesi (sirketler.json) bozuk, boş ya da yarım yazılmış", () => {
  for (const [label, content] of [["bozuk JSON", "{\"companies\": [{\"id\": \"sirket-001\""], ["boş dosya", ""], ["boş liste", "{\"companies\": []}"]]) {
    test(`${label}: sunucu açılır, 001'in verisi ve kullanıcılar yerinde`, async () => {
      const h = harness();
      try {
        await h.start();
        const root = h.facts("sirket-001");
        await h.server.close();
        writeFileSync(path.join(h.fixture.dataDir, "sirketler.json"), content);
        await h.start();
        assert.deepEqual(h.facts("sirket-001"), root, "001'in verisi aynı");
        await h.select("sirket-001");
        assert.deepEqual(await apiFacts(h.api), h.company("001").api, "001 ekranda aynı");
      } finally {
        await h.stop();
      }
    });
  }

  test("yarım kalmış kayıt (sirketler.json.tmp) asıl listeyi bozmaz", async () => {
    const h = harness();
    try {
      await h.start();
      await h.server.close();
      writeFileSync(path.join(h.fixture.dataDir, "sirketler.json.tmp"), "{\"compan");
      await h.start();
      assert.deepEqual((await h.api.get("/api/companies")).data.all.map(item => item.code).sort(), h.fixture.fixture.final.map(item => item.code).sort());
    } finally {
      await h.stop();
    }
  });

  test(
    "bozuk sirketler.json: 002 ve sonraki şirketler kaybolmaz (veri klasörleri diskte duruyor)",
    async () => {
      const h = harness();
      try {
        await h.start();
        await h.server.close();
        writeFileSync(path.join(h.fixture.dataDir, "sirketler.json"), "{\"companies\": [{\"id\": \"sirket-001\"");
        await h.start();
        const codes = (await h.api.get("/api/companies")).data.all.map(item => item.code).sort();
        assert.deepEqual(codes, h.fixture.fixture.final.map(item => item.code).sort(), "bütün şirketler listede");
      } finally {
        await h.stop();
      }
    },
  );
});

// Silinmiş yedek dosyalarını listelemez (BACKUP_NAME süzgeci) — yalnız tam adlı .sqlite dosyaları yedek sayılır.
test("yedek adı süzgeci: .yaziliyor, -wal, .geri-yukleme yedek sayılmaz", () => {
  for (const name of ["destekofis-001-2026-01-01T00-00-00-000Z-manuel.sqlite.yaziliyor", "destekofis-001-2026-01-01T00-00-00-000Z-manuel.sqlite-wal", "destekofis.sqlite.geri-yukleme"]) assert.equal(BACKUP_NAME.test(name), false, name);
});
