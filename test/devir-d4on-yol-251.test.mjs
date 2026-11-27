// 2.5.1 D4-ÖN tur 2 — CI #1115 Windows Node 24 kırmızısı ("undefined unable to open database file"; docs/devir/2.5.1-DEVAM/d4ont2-rapor.md §1).
// KÖK NEDEN: devir yedeğinde veri tabanı kopyası yarım klasöre doğrudan yazılıyordu; yolda zaman + etiket İKİ KEZ geçtiğinden SQLite'ın günlük dosyası
// (<kopya>-journal) Windows'un 260 karakter sınırını aşıyordu → uzun etiketli (Devri Yenile / Devri Geri Al) ya da uzun adlı şirkette devir yedeği HİÇ alınamıyor,
// kullanıcıya İngilizce SQLite iletisi gidiyordu. Bu dosyanın testleri iki platformda da AYNI koşar (CI kapısı: Linux ve Windows aynı sayıda test, atlanan yok):
//   Y1 SQLite'ın açtığı her yol (kopya + günlük) kurulumun varsayılan kökünde (C:\DestekOfis\backups) ve şirket adının en uzun hâlinde (80 karakter) 260'ın altında —
//      yollar GERÇEK yedekten yakalanır, yalnız kök ve şirket klasörü üretim değerine çevrilir (Windows'ta ayrıca gerçek yedek de alınır).
//   Y2 yazma hatası (SQLite günlüğü açılamaz — günlüğün yerine klasör konur; Windows'ta da Linux'ta da GERÇEK SQLite hatası) → 503 devir-backup-write, açık Türkçe ileti,
//      iç kod / İngilizce yalnız makine alanında; yarım klasör kalmaz, çalışma klasörü listede görünmez.
//   Y3 iç dosya taşımaları (kopyanın geçici adından asıl adına, çalışma klasöründen yarım klasöre) geçici hatada yeniden denenir.
//   Y4 yedek klasörü son adına alınırken programın kendi okuma akışlarının hepsi kapanmış (Windows'ta açık tutamaklı klasör taşınamaz).
//   Y5 taşıma hatası iletisinde iç kod / İngilizce yok (yeniden denenmeyen kod ve kodsuz hata).
// Windows'ta GERÇEK ön koşulu test/devir-d4on-yedek-tasima-251.test.mjs'in 2. ve 3. testleri taşır (uzun etiketler CI'nin geçici klasöründe sınırı eski kodda aşıyordu).
import assert from "node:assert/strict";
import fs, { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, describe, test } from "node:test";
import { companyOf } from "./devir-d2-yardimci.mjs";
import { loginAdmin, removeTestDir, startTestServer } from "./helpers.mjs";

const { listDevirBackups, verifyDevirBackup } = await import("../server/lib/devir/devir-backups.mjs");

const NOW = "2026-11-02T10:00:00+03:00";
const TRANSIENT = ["EPERM", "EBUSY", "EACCES", "ENOTEMPTY"];
// Windows'un yol sınırı (MAX_PATH): sondaki NUL dahil 260 → en çok 259 karakter. Kurulumun varsayılan kökü: packaging/windows/setup.iss DefaultAppDir + "backups".
const MAX_PATH = 260;
const PROD_BACKUPS = "C:\\DestekOfis\\backups";
// Şirket klasörünün adı en çok 80 karakter (lib/backup.mjs companyFolderName); gerçekçi uzun bir ad.
const LONG_NAME = "Yılmaz İnşaat Taahhüt Sanayi ve Ticaret Limited Şirketi Danışmanlık ve Müşavirlik Hizmetleri".slice(0, 80);
const roots = [];
let server = null;
let backupDir = null;
after(async () => {
  await server?.close();
  for (const dir of roots) removeTestDir(dir);
});

async function open() {
  if (server) return server;
  const dir = mkdtempSync(path.join(tmpdir(), "destekofis-d4on-yol-"));
  roots.push(dir);
  backupDir = path.join(dir, "backups");
  server = await startTestServer({ dataDir: path.join(dir, "data"), backupDir, now: { time: NOW, fixed: true } });
  const admin = await loginAdmin(server);
  const created = await admin.post("/api/companies", { name: "Yol İkinci" });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  server.companyId = created.data.data.company.id;
  const dataDir = server.app.companies.dirsOf(companyOf(server.app, server.companyId)).dataDir;
  mkdirSync(path.join(dataDir, "belgeler", "ef"), { recursive: true });
  writeFileSync(path.join(dataDir, "belgeler", "ef", "ef".padEnd(64, "2")), "belge");
  writeFileSync(path.join(dataDir, "secret.key"), "z".repeat(44));
  return server;
}
const company = () => companyOf(server.app, server.companyId);
const folder = () => server.app.backups.folderOf(company());
const take = (label, runId) => server.app.backups.createDevirBackupFor(company(), { label, year: label.slice(-4), runId });
const attempt = async (label, runId) => {
  try {
    return { made: await take(label, runId), failure: null };
  } catch (error) {
    return { made: null, failure: error };
  }
};
const fsError = (code, note = "test: enjekte") => Object.assign(new Error(`${code}: ${note}, rename`), code ? { code } : {});
// node:fs renameSync'i sarar (programın adlı içe aktarımları da sarmalı görür). Dönüş: geri alma.
function patchRename(handler) {
  const real = fs.renameSync;
  fs.renameSync = (from, to) => handler(real, String(from), String(to));
  syncBuiltinESMExports();
  return () => {
    fs.renameSync = real;
    syncBuiltinESMExports();
  };
}
// SQLite'ın VACUUM INTO hedeflerini yakalar (isteğe bağlı: hedeften önce bir iş). Dönüş: geri alma.
function patchVacuum(onTarget) {
  const real = DatabaseSync.prototype.exec;
  DatabaseSync.prototype.exec = function (sql) {
    const match = /^VACUUM INTO '(.*)'$/s.exec(String(sql));
    if (match) onTarget(match[1].replace(/''/g, "'"));
    return real.call(this, sql);
  };
  return () => {
    DatabaseSync.prototype.exec = real;
  };
}
const isFolderMove = from => from.endsWith(".yaziliyor") && path.basename(path.dirname(from)) === "devir-yedekleri";
const NO_INTERNAL = /unable|SQLITE|ERR_|\bE[A-Z]{3,}\b|enjekte|rename|database/;

describe("D4-ÖN tur 2: devir yedeğinin yolu, yazma ve taşıma hataları (Windows)", () => {
  test("Y1 SQLite'ın açtığı her yol (kopya + günlük) varsayılan kurulum kökünde ve 80 karakterlik şirket adında Windows sınırının (260) altında; üç etiket de Tamam", async () => {
    await open();
    const targets = [];
    const restore = patchVacuum(target => targets.push(target));
    const made = [];
    try {
      for (const label of ["devir-oncesi-2026", "devri-yenile-oncesi-2026", "devri-geri-al-oncesi-2026"]) made.push(await take(label, `y1-${label}`));
    } finally {
      restore();
    }
    assert.equal(targets.length, 3, "her yedekte bir VACUUM INTO");
    const code = company().code;
    for (const [index, target] of targets.entries()) {
      const parts = path.relative(backupDir, target).split(path.sep);
      assert.equal(parts[1], "devir-yedekleri", `yakalanan yol şirketin devir yedekleri klasöründe: ${parts.join("/")}`);
      const prod = path.win32.join(PROD_BACKUPS, `${code} - ${LONG_NAME}`, ...parts.slice(1));
      const journal = `${prod}-journal`;
      assert.ok(journal.length < MAX_PATH, `${made[index].name}: günlük yolu ${journal.length} karakter (sınır ${MAX_PATH - 1}; kopya ${prod.length}) — ${journal}`);
    }
    for (const item of made) {
      assert.deepEqual(listDevirBackups(folder()).filter(row => row.name === item.name).map(row => row.state), ["tamam"]);
      assert.equal((await verifyDevirBackup(item.path)).ok, true, `${item.name} doğrulandı`);
      assert.ok(readdirSync(item.path).some(name => /^destekofis-\d{3}-.*\.sqlite$/.test(name)), "veri tabanı kopyası yedeğin içinde");
    }
  });

  test("Y2 yazma hatası (SQLite günlüğü açılamaz) → 503 devir-backup-write, açık Türkçe ileti (ne oldu, neden, ne yapmalı, nereye); iç kod yalnız makine alanında; yarım klasör kalmaz", async () => {
    await open();
    const blockers = [];
    const restore = patchVacuum(target => {
      // Günlüğün yerine klasör: SQLite günlüğü GERÇEKTEN açamaz (Windows'ta 260 karakteri aşan yolun açılamamasıyla aynı sonuç: SQLITE_CANTOPEN).
      mkdirSync(`${target}-journal`);
      blockers.push(`${target}-journal`);
    });
    let result;
    try {
      result = await attempt("devri-yenile-oncesi-2028", "y2");
    } finally {
      restore();
    }
    for (const blocker of blockers) rmSync(blocker, { recursive: true, force: true });
    const { failure } = result;
    assert.ok(failure, "yazılamayan yedek başarılı sayılmamalı");
    assert.equal(failure.status, 503, `${failure.status} ${failure.message}`);
    assert.equal(failure.extra?.code, "devir-backup-write");
    assert.match(failure.message, /^Devir yedeği alınamadı: veri tabanının kopyası yedek klasöründe açılamadı \(klasörün yolu çok uzun ya da klasöre yazma izni yok\)\. Devri Yenile bu yedek olmadan yapılmaz; verilerinizde değişiklik olmadı\. Şirket adı çok uzunsa Yönetim → Şirketler'den kısaltıp ya da programı daha kısa bir klasöre kurup yeniden deneyin\.$/);
    assert.doesNotMatch(failure.message, NO_INTERNAL, "iletide iç kod / İngilizce yok");
    assert.match(String(failure.extra?.cause), /ERR_SQLITE_ERROR 14\b|ERR_SQLITE_ERROR \d+ .*unable to open database file/, `makine alanında SQLite nedeni: ${failure.extra?.cause}`);
    assert.equal(listDevirBackups(folder()).filter(row => /devri-yenile-oncesi-2028$/.test(row.name)).length, 0, "yarım klasör kalmadı (silindi)");
    const root = path.join(folder(), "devir-yedekleri");
    assert.ok(!readdirSync(root).some(name => name.endsWith("devri-yenile-oncesi-2028.yaziliyor")), "diskte yarım klasör yok");
    assert.ok(!listDevirBackups(folder()).some(row => row.name === ".vt" || row.dir.endsWith(`${path.sep}.vt`)), "çalışma klasörü listede görünmez");
  });

  test("Y3 iç dosya taşımaları (kopyanın geçici adından asıl adına; çalışma klasöründen yarım klasöre) geçici hatada yeniden denenir; yedek Tamam", async () => {
    await open();
    let inner = 0;
    let staged = 0;
    const real = [];
    const pass = (rename, from, to) => {
      try {
        return rename(from, to);
      } catch (error) {
        real.push(error.code);
        throw error;
      }
    };
    const restore = patchRename((rename, from, to) => {
      if (from.endsWith(".sqlite.yaziliyor")) {
        inner += 1;
        if (inner <= 2) throw fsError(inner === 1 ? "EPERM" : "EACCES");
        return pass(rename, from, to);
      }
      if (from.endsWith(".sqlite") && path.basename(path.dirname(from)) === ".vt") {
        staged += 1;
        if (staged <= 2) throw fsError("EBUSY");
        return pass(rename, from, to);
      }
      return rename(from, to);
    });
    let result;
    try {
      result = await attempt("devir-oncesi-2029", "y3");
    } finally {
      restore();
    }
    assert.equal(result.failure, null, `taşıma yeniden denenmeliydi: ${result.failure?.status} ${result.failure?.message}`);
    assert.ok(real.every(code => TRANSIENT.includes(code)), `gerçek hatalar yalnız geçici türde: ${JSON.stringify(real)}`);
    assert.equal(inner + staged, 6 + real.length, `iki taşımanın her biri iki geçici hatadan sonra (iç ${inner}, çalışma klasöründen ${staged})`);
    assert.ok(inner >= 3 && staged >= 3, `iki taşıma da yeniden denendi (iç ${inner}, çalışma klasöründen ${staged})`);
    assert.deepEqual(listDevirBackups(folder()).filter(row => row.name === result.made.name).map(row => row.state), ["tamam"]);
    assert.equal((await verifyDevirBackup(result.made.path)).ok, true);
  });

  test("Y4 yedek klasörü son adına alınırken programın kendi okuma akışlarının hepsi kapanmış (açık tutamak yok)", async () => {
    await open();
    const open_ = new Set();
    const realStream = fs.createReadStream;
    const moments = [];
    fs.createReadStream = (...args) => {
      const stream = realStream(...args);
      const file = String(args[0]);
      open_.add(file);
      stream.on("close", () => open_.delete(file));
      return stream;
    };
    const restore = patchRename((rename, from, to) => {
      if (isFolderMove(from)) moments.push([...open_].filter(file => file.startsWith(from + path.sep)).map(file => path.relative(from, file)));
      return rename(from, to);
    });
    syncBuiltinESMExports();
    let result;
    try {
      result = await attempt("devir-oncesi-2030", "y4");
    } finally {
      fs.createReadStream = realStream;
      restore();
    }
    assert.equal(result.failure, null, `${result.failure?.status} ${result.failure?.message}`);
    assert.ok(moments.length >= 1, "klasör taşıması görüldü");
    assert.deepEqual(moments[0], [], `taşıma anında kapanmamış okuma akışı: ${JSON.stringify(moments[0])}`);
  });

  test("Y5 taşıma hatası iletisinde iç kod / İngilizce yok: yeniden denenmeyen kod (EXDEV) ve kodsuz hata → 503 devir-backup-move, neden yalnız makine alanında", async () => {
    await open();
    for (const [label, error, cause] of [["devri-geri-al-oncesi-2031", fsError("EXDEV"), "EXDEV"], ["devri-geri-al-oncesi-2032", fsError(null, "beklenmeyen iç hata"), /beklenmeyen iç hata/]]) {
      const restore = patchRename((rename, from, to) => {
        if (isFolderMove(from)) throw error;
        return rename(from, to);
      });
      let result;
      try {
        result = await attempt(label, `y5-${label}`);
      } finally {
        restore();
      }
      const { failure } = result;
      assert.ok(failure, label);
      assert.equal(failure.status, 503, `${failure.status} ${failure.message}`);
      assert.equal(failure.extra?.code, "devir-backup-move");
      assert.match(failure.message, /^Devir yedeği yazıldı ama tamamlanamadı: yedek klasörü son adına alınamadı \(dosya sistemi taşımaya izin vermedi\)\. Devri Geri Al bu yedek tamamlanmadan yapılmaz; verilerinizde değişiklik olmadı\. Birkaç dakika bekleyip yeniden deneyin\. Yazılan yedek silinmedi: Yönetim → Yedekler → Devir Yedekleri'nde “Yarım Kaldı” olarak görünür\.$/);
      assert.doesNotMatch(failure.message, NO_INTERNAL, "iletide iç kod / İngilizce yok");
      if (typeof cause === "string") assert.equal(failure.extra?.cause, cause);
      else assert.match(String(failure.extra?.cause), cause);
      assert.equal(listDevirBackups(folder()).filter(row => row.state === "yarim" && row.name.endsWith(label)).length, 1, "yazılmış klasör listede Yarım");
      assert.ok(existsSync(path.join(folder(), "devir-yedekleri", `${failure.extra.partial}`)), "yarım klasör diskte");
    }
  });
});
