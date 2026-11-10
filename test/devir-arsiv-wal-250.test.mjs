// 2.5.0 D2 tur 3 — ARŞİVİN YANINDA İŞLENMEMİŞ GÜNLÜK (dar kontrol 10.11 ORTA-2; docs/devir/D2-ALTYAPI-TASARIM.md §14; BAŞ MİMAR KARARI 10.11 "D4'e bırakılmaz").
// Önceden (tur 2, 78855096): iki aşamalı göç yalnız ANA dosyayı kopyalıyor, taşımadan önce asıl dosyanın -wal / -shm'ini siliyordu, bütünlük özeti yalnız ana dosyanındı
// → WAL kipinde KESİNLEŞMİŞ ama ana dosyaya işlenmemiş kayıt göçte sessizce kayboluyordu (dar kontrol p5: Kasa 56 → 55).
// Karar (K2 aynen): arşivin yanında BOŞ OLMAYAN -wal ya da -journal varsa arşiv "değişmiş" sayılır — eski şema → 409 archive-changed, son şema → uyarıyla salt okunur;
// GÖÇ ETMEZ, yan dosya SİLİNMEZ. Boş (0 bayt) -wal / -shm zararsızdır (göçün sonucu yerine geçerken silinir). Çalışma kopyasının kendi günlüğü bu kurala girmez.
// Veri: eski şemalı arşiv GERÇEK v2.0.26 koduyla üretilmiş fikstürden (test/fixtures/surum-2.0.26-zincir; ders 17); son şemalı arşiv programın kendi dosyasından
// (VACUUM INTO — D4 benzetimi, test/devir-d2-yardimci.mjs makeArchive). İşlenmemiş günlük AYRI SÜREÇTE (test/fixtures/devir-arsiv-wal-isci.mjs: yazar, kapatmadan SIGKILL).
// Ayrıca (dar kontrol DÜŞÜK-4, yaşayan mutantlar): D10 — göçün sonucu yerine geçerken boş yan dosyalar silinir; D13 — devir yedeği (ürün yolu) yarıda kesilen göçün çalışma
// kopyasını ve göç öncesi kopyayı ALMAZ.
// Windows (ders 48): bütün bağlantılar dosyaya dokunulmadan önce kapanır; günlüğü bırakan süreç ölünce tutamakları düşer; CI Windows işlerinde görülür.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { createApp } from "../server/app.mjs";
import { ROOT_COMPANY_ID } from "../server/lib/companies.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { MIGRATION_WORK_FILE, companyOf, hashFile, makeArchive, placeLegacyArchive, schemaOf } from "./devir-d2-yardimci.mjs";
import { ADMIN_PASSWORD, loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WAL_WORKER = path.join(HERE, "fixtures", "devir-arsiv-wal-isci.mjs");
const GOC_WORKER = path.join(HERE, "fixtures", "devir-d2-arsiv-goc-isci.mjs");
const NOW = "2026-11-02T10:00:00+03:00";
const roots = [];
let fixture = null;
let fixtureDb = "";
before(() => {
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-d2t3-fikstur-"));
  roots.push(dir);
  fixture = unpackFixture("surum-2.0.26-zincir", { root: dir });
  fixtureDb = resolveDbPath(fixture.dataDir);
});
after(() => {
  fixture?.cleanup();
  for (const dir of roots) removeTestDir(dir);
});
const workDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-d2t3-"));
  roots.push(dir);
  return dir;
};
const start = dir => startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: NOW, fixed: true } });
const unwrap = response => (response.data?.ok ? response.data.data : response.data);
const sha = file => createHash("sha256").update(readFileSync(file)).digest("hex");
const size = file => (existsSync(file) ? statSync(file).size : -1);
/** Ayrı süreçte yan günlük bırakır (wal | journal); süreç yazdıktan sonra bağlantıyı kapatmadan ölmeli (temiz çıkış değil). */
function leaveJournal(mode, file) {
  const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", WAL_WORKER, mode, file], { encoding: "utf8", timeout: 120_000 });
  assert.ok(/YAZILDI/.test(run.stdout) && run.status !== 0, `ön koşul: günlüğü bırakan süreç yazdı ve bağlantıyı kapatmadan öldü (${run.status} ${run.signal} ${run.stderr})`);
}
/** Sunucu bir kez kapanır (kapandıktan sonra dosyalar denetlenir; finally yalnız açık kaldıysa kapatır). */
const closer = server => {
  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;
    await server.close();
  };
};
/** Dosyanın salt okunur görünümü (WAL varsa SQLite onu uygular): satır sayısı ve WAL'daki satır. Bağlantı her durumda kapanır. */
function readView(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return { kasa: db.prepare("SELECT COUNT(*) AS n FROM cash_entries").get().n, walSatiri: db.prepare("SELECT COUNT(*) AS n FROM cash_entries WHERE id = 'cash-d2t3-wal'").get().n, isaret: db.prepare("SELECT value FROM settings WHERE key = 'd2t3.wal'").get()?.value ?? null };
  } finally {
    db.close();
  }
}
/** Arşiv klasörünün izi: ana dosya ve günlüklerin özeti (-shm hariç — okuyucu kilit işareti yazar), dosya adları. */
function folderPrint(made) {
  return {
    adlar: readdirSync(made.dir).sort(),
    ana: sha(made.file),
    wal: existsSync(`${made.file}-wal`) ? sha(`${made.file}-wal`) : null,
    journal: existsSync(`${made.file}-journal`) ? sha(`${made.file}-journal`) : null,
  };
}
/** Arşivin kaydı (sha256 = dosyanın ŞİMDİKİ ana dosyası — D4'ün günlüğü işlemeden özet aldığı benzetim). */
// schemaVersion: sıcak günlüklü dosyada salt okunur okunamaz — yerleştirmedeki şema verilir.
async function register(app, made, { year = "2025", schemaVersion = null } = {}) {
  const entry = { year, cutoff: `${year}-12-31`, runId: made.runId, sha256: await hashFile(made.file), schemaVersion: schemaVersion ?? schemaOf(made.file), createdAt: new Date().toISOString() };
  app.companies.addArchive(ROOT_COMPANY_ID, entry);
  return entry;
}
const archiveRow = async admin => (unwrap(await admin.get("/api/admin/devir/archives"))?.archives || []).find(item => item.companyId === ROOT_COMPANY_ID && item.year === "2025") || null;

describe("D2 tur 3 — arşivin yanında işlenmemiş günlük: arşiv 'değişmiş' (K2), göç etmez, yan dosya silinmez (ORTA-2)", () => {
  test("eski şemalı arşiv + işlenmemiş -wal (kesinleşmiş kayıt yalnız WAL'da) → 409 archive-changed; ana dosya, -wal, klasör ve kayıt DEĞİŞMEDİ; WAL'daki satır duruyor; göç öncesi kopya / çalışma kopyası oluşmadı; Doğrula ve liste 'Değişmiş'", async () => {
    const dir = workDir();
    const server = await start(dir);
    const close = closer(server);
    try {
      const admin = await loginAdmin(server);
      const made = await placeLegacyArchive(server.app, ROOT_COMPANY_ID, { source: fixtureDb, year: "2025", register: false });
      assert.ok(made.schemaVersion < LATEST_VERSION, `fikstür eski şemada (${made.schemaVersion})`);
      leaveJournal("wal", made.file);
      assert.ok(size(`${made.file}-wal`) > 0, "ön koşul: -wal boş değil");
      const view = readView(made.file);
      assert.deepEqual([view.walSatiri, view.isaret], [1, "WAL-DAKI-KAYIT"], "ön koşul: kesinleşmiş kayıt WAL'da (salt okunur okuma uygular)");
      await register(server.app, made);
      const entryBefore = JSON.stringify(server.app.companies.archiveOf(ROOT_COMPANY_ID, "2025"));
      const printBefore = folderPrint(made);
      const opened = await admin.get("/api/workspace/cash?hofArchive=2025");
      assert.deepEqual([opened.status, opened.data?.code], [409, "archive-changed"], `işlenmemiş günlüklü eski şemalı arşiv göç ettirilmez: ${opened.status} ${JSON.stringify(opened.data).slice(0, 300)}`);
      assert.match(String(opened.data?.error || ""), /işlenmemiş günlük dosyası var: destekofis\.sqlite-wal/, "ileti nedeni söyler");
      const verified = unwrap(await admin.post("/api/admin/devir/archives/verify", { company: ROOT_COMPANY_ID, year: "2025" }));
      assert.equal(verified?.state, "changed", `Doğrula: ${JSON.stringify(verified)}`);
      const row = await archiveRow(admin);
      assert.deepEqual([row?.status, row?.statusLabel], ["changed", "Değişmiş"], `Yönetim listesi: ${JSON.stringify(row)}`);
      assert.equal(JSON.stringify(server.app.companies.archiveOf(ROOT_COMPANY_ID, "2025")), entryBefore, "kayıt değişmedi (bekleyen özet yok, göç bilgisi yok)");
      await close();
      assert.deepEqual(folderPrint(made), printBefore, "ana dosya, -wal ve klasör (göç öncesi kopya / çalışma kopyası yok) değişmedi");
      assert.deepEqual(readView(made.file), view, "WAL'daki kesinleşmiş kayıt ve satır sayısı aynı");
      assert.equal(schemaOf(made.file), made.schemaVersion, "dosya göç etmedi");
    } finally {
      await close();
    }
  });

  test("son şemalı arşiv + işlenmemiş -wal → salt okunur açılır, UYARI ile (değişmiş); WAL'daki satır arşivde GÖRÜNÜR (bugünkü davranış: salt okunur bağlantı WAL'ı uygular, işlemez); dosyalar değişmedi", async () => {
    const dir = workDir();
    const server = await start(dir);
    const close = closer(server);
    try {
      const admin = await loginAdmin(server);
      const made = await makeArchive(server.app, ROOT_COMPANY_ID, { year: "2025", register: false });
      assert.equal(schemaOf(made.file), LATEST_VERSION);
      leaveJournal("wal", made.file);
      assert.ok(size(`${made.file}-wal`) > 0, "ön koşul: -wal boş değil");
      await register(server.app, made);
      const printBefore = folderPrint(made);
      const view = readView(made.file);
      const read = await admin.get("/api/workspace/cash?hofArchive=2025");
      assert.equal(read.status, 200, `son şema + değişmiş → uyarıyla açılır (K2): ${read.status} ${JSON.stringify(read.data).slice(0, 300)}`);
      const entries = unwrap(read)?.entries || [];
      // Ölçülen bugünkü davranış (görev metni 2d): salt okunur bağlantı WAL'daki kesinleşmiş kaydı OKUR (dosyaya işlemez).
      assert.equal(entries.filter(item => item.id === "cash-d2t3-wal").length, 1, `WAL'daki satır arşivin Kasa listesinde görünür (${entries.length} satır)`);
      const write = await admin.post("/api/workspace/cash?hofArchive=2025", { kind: "in", amount: 1, date: "2025-12-01", description: "arşive yazma denemesi" });
      assert.equal(write.status, 403, "arşiv salt okunur");
      assert.match(String(write.data?.archive?.warning || ""), /değişmiş görünüyor \(yanında işlenmemiş günlük dosyası var: destekofis\.sqlite-wal\); kayıtlar yalnız görüntülenir/, `arşiv uyarısı: ${JSON.stringify(write.data?.archive)}`);
      assert.equal(unwrap(await admin.post("/api/admin/devir/archives/verify", { company: ROOT_COMPANY_ID, year: "2025" }))?.state, "changed");
      await close();
      assert.deepEqual(folderPrint(made), printBefore, "ana dosya, -wal ve klasör değişmedi (salt okunur bağlantı günlüğü işlemedi)");
      assert.deepEqual(readView(made.file), view);
    } finally {
      await close();
    }
  });

  test("sıcak -journal (yarıda kalmış yazım; salt okunur bağlantı geri alamaz) → 409 archive-changed (önceden 503 'dosya bozuk olabilir'); ana dosya ve -journal değişmedi, göç denenmedi", async () => {
    const dir = workDir();
    const server = await start(dir);
    const close = closer(server);
    try {
      const admin = await loginAdmin(server);
      const made = await placeLegacyArchive(server.app, ROOT_COMPANY_ID, { source: fixtureDb, year: "2025", register: false });
      leaveJournal("journal", made.file);
      assert.ok(size(`${made.file}-journal`) > 0, "ön koşul: -journal boş değil (sıcak)");
      // Ön koşul gerçekten oluştu (ders 20): salt okunur bağlantı dosyayı okuyamıyor (geri alma yazım ister).
      assert.throws(() => readView(made.file), /readonly|read-only|salt/i, "ön koşul: sıcak günlüklü dosya salt okunur açılamaz");
      await register(server.app, made, { schemaVersion: made.schemaVersion });
      const entryBefore = JSON.stringify(server.app.companies.archiveOf(ROOT_COMPANY_ID, "2025"));
      const printBefore = folderPrint(made);
      const opened = await admin.get("/api/workspace/cash?hofArchive=2025");
      assert.deepEqual([opened.status, opened.data?.code], [409, "archive-changed"], `${opened.status} ${JSON.stringify(opened.data).slice(0, 300)}`);
      assert.match(String(opened.data?.error || ""), /işlenmemiş günlük dosyası var: destekofis\.sqlite-journal/);
      assert.equal((await archiveRow(admin))?.status, "changed");
      assert.equal(JSON.stringify(server.app.companies.archiveOf(ROOT_COMPANY_ID, "2025")), entryBefore, "kayıt değişmedi");
      await close();
      assert.deepEqual(folderPrint(made), printBefore, "ana dosya, -journal ve klasör değişmedi");
    } finally {
      await close();
    }
  });

  test("BOŞ (0 bayt) -wal ve -shm kalıntısı zararsız: arşiv değişmiş SAYILMAZ, göç eder, uyarısız açılır; göçün sonucu yerine geçerken boş yan dosyalar silinir (D10)", async () => {
    const dir = workDir();
    const server = await start(dir);
    const close = closer(server);
    try {
      const admin = await loginAdmin(server);
      const made = await placeLegacyArchive(server.app, ROOT_COMPANY_ID, { source: fixtureDb, year: "2025" });
      writeFileSync(`${made.file}-wal`, "");
      writeFileSync(`${made.file}-shm`, Buffer.alloc(32768));
      const read = await admin.get("/api/workspace/cash?hofArchive=2025");
      assert.equal(read.status, 200, `${read.status} ${JSON.stringify(read.data).slice(0, 300)}`);
      const write = await admin.post("/api/workspace/cash?hofArchive=2025", { kind: "in", amount: 1, date: "2025-12-01", description: "x" });
      assert.deepEqual([write.status, write.data?.archive?.warning], [403, ""], "uyarısız salt okunur");
      assert.equal(schemaOf(made.file), LATEST_VERSION, "göç etti");
      const entry = server.app.companies.archiveOf(ROOT_COMPANY_ID, "2025");
      assert.equal(entry.sha256, await hashFile(made.file), "kayıt göçün sonucunun özetini taşır");
      assert.equal(unwrap(await admin.post("/api/admin/devir/archives/verify", { company: ROOT_COMPANY_ID, year: "2025" }))?.state, "ok");
      await close();
      const names = readdirSync(made.dir).sort();
      assert.deepEqual(names.filter(name => /-wal$|-shm$|-journal$/.test(name) || name.startsWith(MIGRATION_WORK_FILE)), [], `göçten sonra arşivin yanında yan dosya / çalışma kopyası yok (${names.join(", ")})`);
    } finally {
      await close();
    }
  });

  test("göç sürerken (bekleyen özet yazıldıktan sonra, taşımadan önce) arşivin yanında işlenmemiş -wal belirirse: taşınmaz, silinmez → 409 archive-changed; ana dosya ve -wal değişmedi; kayıtta bekleyen özet kalmadı; çalışma kopyası silindi", async () => {
    const dir = workDir();
    const seeded = await start(dir);
    let made;
    try {
      await loginAdmin(seeded);
      made = await placeLegacyArchive(seeded.app, ROOT_COMPANY_ID, { source: fixtureDb, year: "2025" });
    } finally {
      await seeded.close();
    }
    let raced = null;
    // YALNIZ TEST kesme noktası (server/app.mjs __testArchiveStep): taşımadan hemen önce başka bir yazıcı arşive WAL bırakır (ürün yolunda yok; sözleşme D4'ün).
    const app = createApp({
      dataDir: path.join(dir, "data"),
      backupDir: path.join(dir, "backups"),
      logLevel: "silent",
      scheduleBackups: false,
      license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
      startLicenseTimers: false,
      whatsappWorker: "manual",
      env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" },
      now: { time: NOW, fixed: true },
      __testArchiveStep: name => {
        if (name !== "bekleyen-yazildi") return;
        leaveJournal("wal", made.file);
        raced = { wal: size(`${made.file}-wal`), print: folderPrint(made), view: readView(made.file) };
      },
    });
    try {
      await assert.rejects(app.openArchive(app.companies.get(ROOT_COMPANY_ID), "2025"), error => error?.status === 409 && error?.extra?.code === "archive-changed" && /destekofis\.sqlite-wal/.test(error.message), "taşıma öncesi denetim: 409 archive-changed");
      assert.ok(raced && raced.wal > 0, `ön koşul: WAL taşımadan önce belirdi (${JSON.stringify(raced?.wal)})`);
      const entry = app.companies.archiveOf(ROOT_COMPANY_ID, "2025");
      assert.deepEqual([entry.pendingSha256, entry.pendingFrom, entry.pendingAt, entry.schemaVersion], [undefined, undefined, undefined, made.schemaVersion], `kayıtta bekleyen özet kalmadı, göç bilgisi yok (${JSON.stringify(entry)})`);
      assert.equal(entry.sha256, made.sha256, "kayıttaki özet ilk dosyanınki");
    } finally {
      await app.close();
    }
    const print = folderPrint(made);
    assert.equal(print.ana, raced.print.ana, "ana dosya taşınmadı / değişmedi");
    assert.equal(print.wal, raced.print.wal, "-wal silinmedi, değişmedi");
    assert.deepEqual(print.adlar.filter(name => name.startsWith(MIGRATION_WORK_FILE)), [], "çalışma kopyası silindi");
    assert.deepEqual(readView(made.file), raced.view, "WAL'daki kesinleşmiş kayıt duruyor");
  });
});

describe("D2 tur 3 — devir yedeği yarıda kesilen göçün geçici dosyalarını almaz (dar kontrol DÜŞÜK-4: D13, ürün yolundan)", () => {
  test("göç 'bekleyen-yazildi' adımında SIGKILL → arşiv klasöründe çalışma kopyası + göç öncesi kopya; createDevirBackupFor yedeğinde ikisi de YOK, arşiv dosyası ve kaydı VAR; yedek doğrulaması tutar", async () => {
    const dir = workDir();
    const seeded = await start(dir);
    let made;
    try {
      await loginAdmin(seeded);
      made = await placeLegacyArchive(seeded.app, ROOT_COMPANY_ID, { source: fixtureDb, year: "2025" });
    } finally {
      await seeded.close();
    }
    const note = path.join(dir, "kesme.json");
    const cut = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", GOC_WORKER, path.join(dir, "data"), path.join(dir, "backups"), "2025", "bekleyen-yazildi", note], { env: { ...process.env, HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, encoding: "utf8", timeout: 120_000 });
    const cutNote = existsSync(note) ? JSON.parse(readFileSync(note, "utf8")) : null;
    assert.equal(cutNote?.yol, "kanca", `ön koşul: göç programın "bekleyen-yazildi" noktasında kesildi (${JSON.stringify(cutNote)} ${cut.status} ${cut.signal} ${String(cut.stderr).slice(0, 300)})`);
    const left = readdirSync(made.dir).sort();
    assert.ok(left.includes(MIGRATION_WORK_FILE) && left.some(name => name.startsWith("goc-oncesi-v")), `ön koşul: arşiv klasöründe çalışma kopyası ve göç öncesi kopya (${left.join(", ")})`);
    const server = await start(dir);
    try {
      await loginAdmin(server);
      const company = companyOf(server.app, ROOT_COMPANY_ID);
      const backup = await server.app.backups.createDevirBackupFor(company, { label: "devir-oncesi-2026", year: "2026", runId: "devir-2026-d2t3", by: { id: "u", display_name: "Test" } });
      const paths = backup.manifest.files.map(file => file.path);
      assert.ok(paths.includes("arsiv/2025/destekofis.sqlite") && paths.includes("arsiv/2025/arsiv-kaydi.json"), `arşiv dosyası ve kaydı yedekte (${paths.filter(item => item.startsWith("arsiv")).join(", ")})`);
      assert.deepEqual(paths.filter(item => item.includes(MIGRATION_WORK_FILE)), [], "çalışma kopyası yedekte yok");
      assert.deepEqual(paths.filter(item => item.includes("goc-oncesi-v")), [], "göç öncesi kopya yedekte yok");
      const walked = [];
      const walk = folder => {
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
          const full = path.join(folder, entry.name);
          if (entry.isDirectory()) walk(full);
          else walked.push(path.relative(backup.path, full).split(path.sep).join("/"));
        }
      };
      walk(backup.path);
      assert.deepEqual(walked.filter(item => item.includes(MIGRATION_WORK_FILE) || item.includes("goc-oncesi-v")), [], `yedek klasöründe de geçici dosya yok (${walked.filter(item => item.startsWith("arsiv")).join(", ")})`);
      const { verifyDevirBackup } = await import("../server/lib/devir/devir-backups.mjs");
      assert.equal((await verifyDevirBackup(backup.path)).ok, true, "yedek doğrulaması tutar");
    } finally {
      await server.close();
    }
  });
});
