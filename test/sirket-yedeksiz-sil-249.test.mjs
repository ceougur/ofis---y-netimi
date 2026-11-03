// 2.4.9 S1 (kullanıcı kararı 03.11.2026, docs/2.4.9-IS-LISTESI.md "KULLANICI KARARI (03.11 ~19:45 UTC"): veri dosyası bozuk şirket silinemiyordu —
// Şirketi Sil önce yedek alır, bozuk dosyada yedek düşer → 500 "Silme öncesi yedek alınamadı; şirket silinmedi". Artık yedek düşünce 409 + kod
// `backup-failed` + neden; ekran ikinci, açık bir onay sorar ve `withoutBackup: true` ile yeniden ister → yedeksiz silinir, audit'e `withoutBackup: true`.
// Silme veriyi YOK ETMEZ: klasör yine silinen-sirketler/<kod>-<zaman> altına taşınır. Yedek HER ZAMAN denenir: sağlam şirkette `withoutBackup` yedeği
// atlatmaz. Kod/parola onayı, 001 kuralı, paylaşılan dosya (company-shared) ve meşgul şirket kuralları AYNEN.
//
// NASIL BOZULUR (önce yazıldı): (1) bozuk dosyada bayraksız istek silerse (onaysız yedeksiz silme); (2) bayrak kod/parola onayını atlatırsa; (3) bayrak
// sağlam şirkette yedeği atlatırsa; (4) bayrak 001 / paylaşılan dosya / meşgul kuralını delerse; (5) yedeksiz silme klasörü taşımak yerine silerse ya da
// yerinde bırakıp kaydı düşürürse; (6) reddedilen istekte şirket "siliniyor" işaretinde kalırsa (sonraki istek 409 meşgul).
// Bozuk dosya: başlık ve şema sağlam, yalnız users tablosunun kök sayfası bozuk (docs/kanit/2026-11-02/db-bozuk-dk/betik/sizinti-log.mjs "tablo-bozuk").
//
// S1 TUR 1 (dar kontrol DÜŞÜK'leri, docs/2.4.9-IS-LISTESI.md "S1 DAR KONTROL"): yedek hatasının nedeni kullanıcıya Türkçe (errcode / error.code eşlemesi:
// 11/26 → veri dosyası bozuk, 13/ENOSPC → disk dolu, 5/6/EBUSY → başka programca kullanılıyor, EACCES/EPERM → yazma izni yok, bilinmeyen → beklenmeyen hata);
// audit'teki backupError HAM kalır; 409 yolunda sunucu günlüğüne uyarı (şirket kodu + ham neden).
//
// Windows notu (ders 48): klasör taşıma (renameSync) dosyaya dokunur; bu testte platforma özgü sayım yok — Windows'ta açık tutamak kalırsa taşıma
// EBUSY/EPERM ile düşer ve "yedeksiz silme" hücresi kırmızı olur. Sonuç CI'nin Windows işlerinde okunur.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, writeFileSync, writeSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";

const ENV = { HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const data = res => (res.data && typeof res.data === "object" && "ok" in res.data ? res.data.data : res.data);
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return data(res);
};
const del = async (api, id, body) => {
  const res = await api.raw("DELETE", `/api/companies/${id}`, { body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  let json = {};
  try {
    json = JSON.parse(res.buffer.toString("utf8"));
  } catch {
    json = {};
  }
  return { status: res.status, json, body: json.ok ? json.data : json };
};
// Sunucu günlüğü yakalanır (409 yolunda uyarı satırı).
const captureLog = () => {
  const lines = { warn: [], error: [] };
  return { lines, log: { debug() {}, info() {}, warn: message => lines.warn.push(String(message)), error: message => lines.error.push(String(message)) } };
};
const sha = file => createHash("sha256").update(readFileSync(file)).digest("hex");

// users tablosunun kök sayfası 0xA5 ile doldurulur (WAL önce dosyaya işlenir, -wal/-shm kenara alınır).
function corrupt(file) {
  const c = new DatabaseSync(file);
  let pageSize;
  let rootpage;
  try {
    c.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    pageSize = c.prepare("PRAGMA page_size").get().page_size;
    rootpage = c.prepare("SELECT rootpage FROM sqlite_master WHERE type = 'table' AND name = 'users'").get().rootpage;
  } finally {
    c.close();
  }
  for (const suffix of ["-wal", "-shm"]) if (existsSync(file + suffix)) renameSync(file + suffix, `${file + suffix}.yok`);
  const fd = openSync(file, "r+");
  try {
    writeSync(fd, Buffer.alloc(pageSize, 0xa5), 0, pageSize, (rootpage - 1) * pageSize);
  } finally {
    closeSync(fd);
  }
}

const auditOf = (server, id) =>
  server.app.store.all("SELECT payload_json AS p FROM audit_events WHERE type = 'company.deleted' AND entity_id = ?", id).map(row => JSON.parse(row.p));
const archived = (server, code) => {
  const dir = path.join(server.dataDir, "silinen-sirketler");
  return existsSync(dir) ? readdirSync(dir).filter(name => name.startsWith(`${code}-`)) : [];
};
const backupsIn = folder => (existsSync(folder) ? readdirSync(folder).filter(name => name.includes("silme-oncesi")) : []);

describe("2.4.9 S1 — bozuk dosyalı şirket: 409 backup-failed, onayla yedeksiz silme (klasör silinen-sirketler'e)", () => {
  let server;
  let api;
  let company;
  let dir;
  let file;
  let folder;
  const captured = captureLog();
  before(async () => {
    server = await startTestServer({ maxCompanies: 2, env: ENV, log: captured.log });
    api = await loginAdmin(server);
    company = (await must("002 aç", api.post("/api/companies", { name: "Bozuk Dosyalı Şirket", select: false }))).company;
    const q = `?hofCompany=${encodeURIComponent(company.id)}`;
    await must("cari", api.post(`/api/workspace/accounts${q}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" }));
    folder = server.app.backups.folderOf(server.app.companies.get(company.id));
    await server.app.context.closeCompany(company.id);
    dir = path.join(server.dataDir, "sirketler", company.code);
    file = resolveDbPath(dir);
    corrupt(file);
    // Bozuk dosyalı şirkete gelen istek açılamaz (ön koşul: dosya GERÇEKTEN bozuk).
    const probe = await api.get(`/api/workspace/accounts${q}`);
    assert.notEqual(probe.status, 200, `bozuk şirket açılmamalı (durum ${probe.status})`);
  });
  after(() => server?.close());

  it("bayraksız istek: 409, kod backup-failed, nedeni iletide ve `reason`da; klasör yerinde, şirket listede, audit yok, yedek dosyası yok", async () => {
    const before = sha(file);
    const res = await del(api, company.id, { confirm: company.code, password: ADMIN_PASSWORD });
    assert.equal(res.status, 409, `durum ${res.status} ${JSON.stringify(res.json).slice(0, 300)}`);
    assert.equal(res.json.code, "backup-failed", `kod: ${JSON.stringify(res.json).slice(0, 300)}`);
    assert.ok(typeof res.json.reason === "string" && res.json.reason.length > 0, `neden boş: ${JSON.stringify(res.json)}`);
    assert.match(res.json.error, /Silme öncesi yedek alınamadı; şirket silinmedi/);
    assert.ok(res.json.error.includes(res.json.reason), "ileti nedeni içerir");
    // S1 TUR 1: neden Türkçe — bozuk dosyada "veri dosyası bozuk" (ham SQLite iletisi kullanıcıya tek başına gösterilmez).
    assert.match(res.json.reason, /^veri dosyası bozuk/, `neden Türkçe değil: ${res.json.reason}`);
    assert.match(res.json.error, /veri dosyası bozuk/);
    // S1 TUR 1: 409 yolunda sunucu günlüğüne uyarı — şirket kodu + ham neden.
    const warned = captured.lines.warn.filter(line => line.includes(company.code) && /yedek/i.test(line));
    assert.equal(warned.length, 1, `günlük uyarısı: ${JSON.stringify(captured.lines.warn).slice(0, 500)}`);
    assert.ok(existsSync(dir) && existsSync(file), "veri klasörü yerinde");
    assert.equal(sha(file), before, "veri dosyasına dokunulmadı");
    assert.ok(server.app.companies.get(company.id), "şirket kayıtta");
    assert.deepEqual(archived(server, company.code), [], "silinen-sirketler'e taşınmadı");
    assert.deepEqual(auditOf(server, company.id), [], "company.deleted audit yok");
    assert.deepEqual(backupsIn(folder), [], "silme öncesi yedek dosyası bırakılmadı");
  });

  it("withoutBackup: true kod/parola onayını atlatmaz (yanlış parola 403, yanlış kod 400); şirket meşgulse 409 meşgul — hepsinde klasör yerinde", async () => {
    const wrongPass = await del(api, company.id, { confirm: company.code, password: "yanlis-parola", withoutBackup: true });
    assert.equal(wrongPass.status, 403, `yanlış parola: ${wrongPass.status} ${JSON.stringify(wrongPass.json)}`);
    assert.equal(wrongPass.json.code, "password");
    const wrongCode = await del(api, company.id, { confirm: "999", password: ADMIN_PASSWORD, withoutBackup: true });
    assert.equal(wrongCode.status, 400, `yanlış kod: ${wrongCode.status} ${JSON.stringify(wrongCode.json)}`);
    assert.equal(wrongCode.json.code, "confirm");
    const busy = server.app.context.busyCompanies;
    busy.set(company.id, "Deneme: başka işlem sürüyor.");
    try {
      const busyRes = await del(api, company.id, { confirm: company.code, password: ADMIN_PASSWORD, withoutBackup: true });
      assert.equal(busyRes.status, 409, `meşgul: ${busyRes.status} ${JSON.stringify(busyRes.json)}`);
      assert.match(busyRes.json.error, /Deneme: başka işlem sürüyor/);
    } finally {
      busy.delete(company.id);
    }
    // "true" metni bayrak sayılmaz (yalnız gerçek true): yine 409 backup-failed.
    const stringFlag = await del(api, company.id, { confirm: company.code, password: ADMIN_PASSWORD, withoutBackup: "true" });
    assert.equal(stringFlag.status, 409);
    assert.equal(stringFlag.json.code, "backup-failed");
    assert.ok(existsSync(file) && server.app.companies.get(company.id), "klasör ve kayıt yerinde");
    assert.deepEqual(auditOf(server, company.id), []);
  });

  it("withoutBackup: true + doğru kod/parola: 200, yedek yok; klasör silinen-sirketler/<kod>-<zaman> altında (dosya aynı), kayıt düştü, audit withoutBackup", async () => {
    const before = sha(file);
    const res = await del(api, company.id, { confirm: company.code, password: ADMIN_PASSWORD, withoutBackup: true });
    assert.equal(res.status, 200, `durum ${res.status} ${JSON.stringify(res.json).slice(0, 300)}`);
    assert.equal(res.body.deleted, company.id);
    assert.equal(res.body.backup, "");
    assert.equal(res.body.withoutBackup, true);
    assert.ok(!res.body.companies.some(item => item.id === company.id), "listeden düştü");
    assert.ok(!server.app.companies.get(company.id), "kayıttan düştü");
    assert.ok(!existsSync(dir), "eski yerinde klasör yok");
    const moved = archived(server, company.code);
    assert.equal(moved.length, 1, `silinen-sirketler: ${moved.join(", ")}`);
    const movedFile = resolveDbPath(path.join(server.dataDir, "silinen-sirketler", moved[0]));
    assert.ok(existsSync(movedFile), "veri dosyası taşındı (silinmedi)");
    assert.equal(sha(movedFile), before, "taşınan dosya bayt bayt aynı (geri getirilebilir)");
    const audits = auditOf(server, company.id);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].withoutBackup, true);
    assert.equal(audits[0].backup, "");
    assert.ok(typeof audits[0].backupError === "string" && audits[0].backupError.length > 0, "audit'te yedek hatasının nedeni");
    assert.ok(!/veri dosyası bozuk/.test(audits[0].backupError), `audit'te ham neden kalır: ${audits[0].backupError}`);
    assert.ok(captured.lines.warn.some(line => line.includes(company.code) && line.includes(audits[0].backupError)), "günlükte şirket kodu + audit'teki ham neden");
    assert.ok(String(audits[0].archivedTo).includes("silinen-sirketler"), `archivedTo: ${audits[0].archivedTo}`);
    assert.deepEqual(backupsIn(folder), [], "yedek dosyası yok");
    // Silinen şirketin yeri boşaldı: yeni şirket açılabilir (2 şirket sınırı).
    await must("yeni şirket", api.post("/api/companies", { name: "Yeni Şirket", select: false }));
  });
});

describe("2.4.9 S1 — sağlam şirket: davranış AYNEN, withoutBackup yedeği atlatmaz", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ maxCompanies: 2, env: ENV });
    api = await loginAdmin(server);
  });
  after(() => server?.close());

  for (const [label, extra] of [
    ["bayraksız", {}],
    ["withoutBackup: true", { withoutBackup: true }],
  ]) {
    it(`${label}: yedek alınır (dosya yedek klasöründe), yanıtta ve audit'te withoutBackup yok, klasör silinen-sirketler'de`, async () => {
      const company = (await must("aç", api.post("/api/companies", { name: `Sağlam Şirket ${label}`, select: false }))).company;
      await must("cari", api.post(`/api/workspace/accounts?hofCompany=${encodeURIComponent(company.id)}`, { name: "Ayşe Demir", phone: "0532 111 22 33" }));
      const folder = server.app.backups.folderOf(server.app.companies.get(company.id));
      const res = await del(api, company.id, { confirm: company.code, password: ADMIN_PASSWORD, ...extra });
      assert.equal(res.status, 200, `durum ${res.status} ${JSON.stringify(res.json).slice(0, 300)}`);
      assert.ok(res.body.backup && res.body.backup.includes("silme-oncesi"), `yedek adı: ${res.body.backup}`);
      assert.ok(existsSync(path.join(folder, res.body.backup)), "yedek dosyası diskte");
      assert.ok(!("withoutBackup" in res.body), "yanıtta withoutBackup yok");
      const audits = auditOf(server, company.id);
      assert.equal(audits.length, 1);
      assert.equal(audits[0].backup, res.body.backup);
      assert.ok(!("withoutBackup" in audits[0]) && !("backupError" in audits[0]), `audit: ${JSON.stringify(audits[0])}`);
      assert.equal(archived(server, company.code).length >= 1, true, "klasör silinen-sirketler'de");
    });
  }

  it("001 withoutBackup ile de silinmez (409, kural iletisi)", async () => {
    const res = await del(api, "sirket-001", { confirm: "001", password: ADMIN_PASSWORD, withoutBackup: true });
    assert.equal(res.status, 409, `durum ${res.status} ${JSON.stringify(res.json)}`);
    assert.match(res.json.error, /001 kodlu ilk şirket silinemez/);
    assert.ok(server.app.companies.get("sirket-001"));
  });
});

describe("2.4.9 S1 TUR 1 — yedek hatasının nedeni Türkçe (errcode / error.code eşlemesi; hata zorla üretilir)", () => {
  let server;
  let api;
  let company;
  const captured = captureLog();
  const fault = (props, message) => Object.assign(new Error(message), props);
  before(async () => {
    server = await startTestServer({ maxCompanies: 2, env: ENV, log: captured.log });
    api = await loginAdmin(server);
    company = (await must("002 aç", api.post("/api/companies", { name: "Arıza Şirketi", select: false }))).company;
  });
  after(() => server?.close());

  // Yedek servisinin backup işlevi bu hücrede sahte hatayla değiştirilir (rota her istekte backups.backup'ı okur).
  for (const [label, error, expected] of [
    ["errcode 11 (SQLITE_CORRUPT)", fault({ code: "ERR_SQLITE_ERROR", errcode: 11 }, "database disk image is malformed"), /^veri dosyası bozuk/],
    ["errcode 26 (SQLITE_NOTADB)", fault({ code: "ERR_SQLITE_ERROR", errcode: 26 }, "file is not a database"), /^veri dosyası bozuk/],
    ["errcode 267 (genişletilmiş CORRUPT_VTAB, & 0xff = 11)", fault({ code: "ERR_SQLITE_ERROR", errcode: 267 }, "corrupt vtab"), /^veri dosyası bozuk/],
    ["errcode 13 (SQLITE_FULL)", fault({ code: "ERR_SQLITE_ERROR", errcode: 13 }, "database or disk is full"), /^disk dolu/],
    ["ENOSPC", fault({ code: "ENOSPC" }, "ENOSPC: no space left on device, write"), /^disk dolu/],
    ["errcode 5 (SQLITE_BUSY)", fault({ code: "ERR_SQLITE_ERROR", errcode: 5 }, "database is locked"), /^dosya başka bir programca kullanılıyor/],
    ["errcode 6 (SQLITE_LOCKED)", fault({ code: "ERR_SQLITE_ERROR", errcode: 6 }, "database table is locked"), /^dosya başka bir programca kullanılıyor/],
    ["EBUSY", fault({ code: "EBUSY" }, "EBUSY: resource busy or locked, rename"), /^dosya başka bir programca kullanılıyor/],
    ["EACCES", fault({ code: "EACCES" }, "EACCES: permission denied, mkdir"), /^yedek klasörüne yazma izni yok/],
    ["EPERM", fault({ code: "EPERM" }, "EPERM: operation not permitted, open"), /^yedek klasörüne yazma izni yok/],
    ["bilinmeyen", new Error("tuhaf bir şey oldu"), /^beklenmeyen hata/],
  ]) {
    it(`${label} → 409 backup-failed, reason Türkçe; günlükte şirket kodu + ham ileti; şirket yerinde`, async () => {
      const backups = server.app.backups;
      const original = backups.backup;
      const warnsBefore = captured.lines.warn.length;
      backups.backup = () => {
        throw error;
      };
      let res;
      try {
        res = await del(api, company.id, { confirm: company.code, password: ADMIN_PASSWORD });
      } finally {
        backups.backup = original;
      }
      assert.equal(res.status, 409, `durum ${res.status} ${JSON.stringify(res.json).slice(0, 300)}`);
      assert.equal(res.json.code, "backup-failed");
      assert.match(res.json.reason, expected, `neden: ${res.json.reason}`);
      assert.ok(res.json.error.includes(res.json.reason), `ileti nedeni içerir: ${res.json.error}`);
      const warned = captured.lines.warn.slice(warnsBefore);
      assert.equal(warned.length, 1, `günlük: ${JSON.stringify(warned)}`);
      assert.ok(warned[0].includes(company.code) && warned[0].includes(error.message), `günlükte kod + ham ileti: ${warned[0]}`);
      assert.ok(server.app.companies.get(company.id), "şirket kayıtta");
    });
  }
});

describe("2.4.9 S1 — paylaşılan veri dosyası: withoutBackup ile de company-shared reddi aynen", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({
      env: ENV,
      prepare: ({ dataDir }) => {
        mkdirSync(path.join(dataDir, "sirketler", "002"), { recursive: true });
        writeFileSync(
          path.join(dataDir, "sirketler.json"),
          JSON.stringify({
            companies: [
              { id: "sirket-001", code: "001", name: "Ana Şirket", dir: "", createdAt: "2026-09-01T08:00:00.000Z", createdBy: "" },
              { id: "sirket-eski", code: "005", name: "Eski Şirket", dir: "sirketler/002", createdAt: "2026-10-01T08:00:00.000Z", createdBy: "" },
              { id: "sirket-yeni", code: "002", name: "Yeni Şirket", dir: "sirketler/002", createdAt: "2026-10-02T08:00:00.000Z", createdBy: "" },
            ],
          }),
        );
      },
    });
    api = await loginAdmin(server);
  });
  after(() => server?.close());

  it("409 company-shared, klasör yerinde, iki şirket kayıtta", async () => {
    const res = await del(api, "sirket-yeni", { confirm: "002", password: ADMIN_PASSWORD, withoutBackup: true });
    assert.equal(res.status, 409, `durum ${res.status} ${JSON.stringify(res.json)}`);
    assert.equal(res.json.code, "company-shared");
    assert.ok(existsSync(path.join(server.dataDir, "sirketler", "002")));
    assert.ok(server.app.companies.get("sirket-yeni") && server.app.companies.get("sirket-eski"));
  });
});
