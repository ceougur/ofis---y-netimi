// 2.0.21 güvenilirlik testlerinin (rastgele sıra, tatbikat, göç, arıza) BULDUĞU hataların kalıcı regresyon testleri.
// Her biri düzeltmeden önce kırmızıydı; bulan test ve tohum yanında yazılı.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, test } from "node:test";
import { createBackup } from "../server/lib/backup.mjs";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const data = response => response.data?.data ?? response.data;

describe("001'in verisini 'Tümünü Sıfırla' ortak katmanı silmez", () => {
  // Bulan: rastgele sıra testi, tohum 1 (boş kurulum), işlem 149–151: 001 "all" ile sıfırlanınca işlemi yapan yöneticinin
  // seçili şirketi kayboldu; sonraki istekleri 002 yerine 001'e gitti ("Cari bulunamadı"). Kök neden: resetData "all"
  // kipinde KEEP_SETTINGS dışındaki bütün ayarları siliyordu; 001'in veri tabanı aynı zamanda ortak katman olduğundan
  // kullanıcıların şirket seçimi (company.user.*), ŞİRKET YETKİLERİ (company.access.*) ve yönetici parolası kurtarma
  // anahtarı (auth.recovery) da siliniyordu. Yetkisi yalnız 002 olan personel 001'i görmeye başlıyordu.
  test("seçili şirket, şirket yetkileri ve kurtarma anahtarı kalır; 001'in kendi verisi sıfırlanır", async () => {
    const server = await startTestServer();
    try {
      const admin = await loginAdmin(server);
      assert.equal((await admin.post("/api/workspace/accounts", { name: "Bir Numaralı Cari", type: "customer" })).status, 200);
      const second = data(await admin.post("/api/companies", { code: "002", name: "İkinci Şirket" })).company;
      const staff = await createUser(server, admin, { username: "personel2", role: "personel" });
      const staffId = data(await staff.get("/api/auth/me")).id;
      assert.equal((await admin.put(`/api/companies/access/${staffId}`, { companies: [second.id] })).status, 200);
      assert.equal((await staff.post("/api/companies/select", { id: "sirket-001" })).status, 403, "personel 001'i göremez");
      assert.equal((await admin.post("/api/admin/recovery", {})).status, 200);
      assert.equal((await admin.post("/api/companies/select", { id: second.id })).status, 200);
      const before = data(await admin.post("/api/workspace/accounts", { name: "İkinci Şirketin Carisi", type: "customer" }));

      const reset = await admin.post("/api/companies/sirket-001/reset", { mode: "all", confirm: "001", password: ADMIN_PASSWORD });
      assert.equal(reset.status, 200, JSON.stringify(reset.data));

      assert.equal(data(await admin.get("/api/companies")).current, second.id, "yöneticinin seçili şirketi 002 kaldı");
      const after = data(await admin.post(`/api/workspace/accounts/${before.id}/entries`, { kind: "debt", amount: 100 }));
      assert.equal(after.id, before.id, "yöneticinin isteği hâlâ 002'ye gidiyor");
      assert.deepEqual(data(await staff.get("/api/companies")).companies.map(item => item.code), ["002"], "personelin şirket yetkisi (yalnız 002) kaldı");
      assert.equal((await staff.post("/api/companies/select", { id: "sirket-001" })).status, 403, "personel 001'i yine göremez");
      assert.equal(data(await admin.get("/api/admin/recovery")).exists, true, "kurtarma anahtarı silinmedi");
      // 001'in kendi verisi gerçekten sıfırlandı.
      assert.equal((await admin.post("/api/companies/select", { id: "sirket-001" })).status, 200);
      assert.equal(data(await admin.get("/api/workspace/accounts?status=all")).accounts.length, 0);
    } finally {
      await server.close();
    }
  });
});

describe("disk dolu: yarım yedek dosyası diskte kalmaz", () => {
  // Bulan: arıza testi (guvenilirlik-221-ariza, "disk dolu"). VACUUM INTO yarıda kalınca (SQLite: "database or disk is
  // full") geçici adlı yarım kopya (.yaziliyor) diskte kalıyordu; yalnız bir saat sonraki yedekte siliniyordu — dolu diski
  // daha da dolduruyordu.
  test("VACUUM INTO hata verirse .yaziliyor silinir, hata çağırana iletilir; liste değişmez", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "disk-dolu-"));
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE users (id TEXT)");
    const full = {
      exec(sql) {
        const match = /^VACUUM INTO '(.+)'$/.exec(sql);
        if (!match) return db.exec(sql);
        writeFileSync(match[1], Buffer.alloc(32 * 1024, 1));
        throw new Error("database or disk is full");
      },
    };
    try {
      assert.throws(() => createBackup(full, dir, { label: "manuel", company: { id: "sirket-x", code: "002", name: "X" } }), /disk is full/);
      assert.deepEqual(readdirSync(dir), [], "yarım dosya kalmadı");
      const ok = createBackup(db, dir, { label: "manuel", company: { id: "sirket-x", code: "002", name: "X" } });
      assert.deepEqual(readdirSync(dir), [ok.name], "disk boşalınca yedek alınır");
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("veri dosyası ya da klasörü kaybolan şirket boş açılmaz", () => {
  // Bulan: arıza testi (guvenilirlik-221-ariza, "veri dosyası silinmiş" / "veri klasörü tamamen silinmiş"). Şirketin veri
  // dosyası (ya da klasörü) diskten kaybolunca (taşınma, virüs programı, disk hatası) program sessizce YENİ, BOŞ bir veri
  // tabanı açıyordu: kullanıcı şirketini boş görüp üstüne kayıt giriyor, boş dosyanın otomatik yedekleri de zamanla eski
  // dolu yedekleri budayabiliyordu. Klasör tamamen silinmişse yedekten geri yükleme de çalışmıyordu (geçici dosya yazılacak
  // klasör yok). Artık: 503 company-unavailable (001'e düşmez, boş dosya açılmaz); Yedekler'den geri yükleme veriyi getirir.
  test("dosya silinmiş: 503, boş dosya oluşmaz; klasör silinmiş: 503, geri yükleme çalışır; yeni şirket yine açılır", async () => {
    // Kaybolan 002 kayıtta durur; "yeni şirket yine açılır" denetimi için sınır (en fazla 2) burada yükseltilir.
    const server = await startTestServer({ maxCompanies: 3 });
    try {
      const admin = await loginAdmin(server);
      const company = data(await admin.post("/api/companies", { code: "002", name: "Kaybolan", select: true })).company;
      assert.equal((await admin.post("/api/workspace/accounts", { name: "Kaybolmaması Gereken", type: "customer" })).status, 200);
      const backup = data(await admin.post("/api/admin/backups", { scope: "one", companyId: company.id })).backups[0].name;
      const dir = path.join(server.dataDir, "sirketler", "002");
      const file = path.join(dir, "destekofis.sqlite");

      await server.app.context.closeCompany(company.id);
      for (const suffix of ["", "-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });
      const missing = await admin.get("/api/workspace/accounts");
      assert.equal(missing.status, 503, JSON.stringify(missing.data));
      assert.equal(missing.data.code, "company-unavailable");
      assert.equal((await admin.post("/api/workspace/accounts", { name: "Boşa Yazılan", type: "customer" })).status, 503);
      assert.equal(existsSync(file), false, "boş veri tabanı oluşturulmadı");

      rmSync(dir, { recursive: true, force: true });
      assert.equal((await admin.get("/api/workspace/accounts")).status, 503);
      assert.equal(existsSync(dir), false, "boş klasör oluşturulmadı");
      const restored = await admin.post("/api/admin/backups/restore", { name: backup, company: company.id, confirm: "002", password: ADMIN_PASSWORD });
      assert.equal(restored.status, 200, JSON.stringify(restored.data));
      assert.deepEqual(data(await admin.get("/api/workspace/accounts")).accounts.map(item => item.name), ["Kaybolmaması Gereken"]);

      const fresh = data(await admin.post("/api/companies", { name: "Yepyeni", select: true })).company;
      assert.equal((await admin.get("/api/workspace/accounts")).status, 200, "yeni açılan (boş klasörlü) şirket açılır");
      await server.app.context.closeCompany(fresh.id);
      assert.equal((await admin.get("/api/workspace/accounts")).status, 200, "yeni şirket kapatılıp yeniden açılır");
    } finally {
      await server.close();
    }
  });
});
