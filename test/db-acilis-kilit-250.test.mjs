// 2.5.0 — veri tabanı açılışında PRAGMA sırası (CI #1007 a2796dd4, Windows Node 24: fis-defteri-yasam-250 N5 işçisi openDatabase'te
// "database is locked", errcode 261 SQLITE_BUSY_RECOVERY). Kök neden: journal_mode PRAGMA'sı busy_timeout ayarlanmadan koşuyordu; başka bağlantı kilit
// tutarken ya da WAL'ı kurtarırken (çökme sonrası / taze -shm ile eşzamanlı ilk açılış) açılış beklemeden düşüyordu.
// Beklenen davranış: açılış kısa süre (OPEN_BUSY_TIMEOUT_MS) bekler, kilit kalkarsa açılır; kalkmazsa SQLITE_BUSY ile düşer ve bağlantı kapanır
// (2.4.8: düşen açılış tutamak sızdırmaz — Linux'ta /proc/self/fd ile ölçülür, Windows'ta ölçüm atlanır). Bozuk dosya beklemeden düşer.
// WINDOWS (ders 48): süreç öldürme (SIGKILL) ve öldürülen sürecin dosyasını iki süreçle yeniden açma bu dosyadadır — Windows CI'de ayrıca görülür.
// Program açılmaz (yalnız veri tabanı); lisans servisine istek yok.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import * as dbLib from "../server/lib/db.mjs";
import { removeTestDir } from "./helpers.mjs";

// Ad alanıyla içe aktarım: eski kodda (OPEN_BUSY_TIMEOUT_MS yok) dosya yüklenir, her hücre kendi nedeniyle kırmızı olur (ders 38).
const { BUSY_TIMEOUT_MS, openDatabase } = dbLib;
const OPEN_BUSY_TIMEOUT_MS = dbLib.OPEN_BUSY_TIMEOUT_MS ?? 2000;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCKER = path.join(HERE, "fixtures", "sqlite-ozel-kilit-isci.mjs");
const PROC = path.join(HERE, "fixtures", "db-acilis-isci.mjs");

let root;
let seq = 0;
const freshDb = () => {
  const file = path.join(root, `d${++seq}.sqlite`);
  const init = new DatabaseSync(file);
  init.exec("PRAGMA journal_mode = WAL; CREATE TABLE t(v TEXT); INSERT INTO t(v) VALUES ('x');");
  init.close();
  return file;
};
// Linux: bu sürecin o dosyaya (ve -wal / -shm) açık tutamak sayısı; başka platformda null (ölçülmez).
const openHandles = file => {
  if (process.platform !== "linux") return null;
  return readdirSync("/proc/self/fd").filter(fd => {
    try {
      return readlinkSync(`/proc/self/fd/${fd}`).startsWith(file);
    } catch {
      return false;
    }
  }).length;
};
// Kilit iş parçacığı: özel kilidi alınca çözülür; `released` kilit bırakılınca çözülür.
const holdLock = (file, ms) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(LOCKER, { workerData: { file, ms } });
    let releasedAt = null;
    const released = new Promise(done => worker.once("exit", () => done(releasedAt)));
    worker.on("message", message => {
      if (message === "kilitli") resolve({ released });
      if (message === "birakti") releasedAt = Date.now();
    });
    worker.once("error", reject);
  });
const runProc = (args, untilReady = false) =>
  new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", PROC, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    proc.stdout.on("data", chunk => {
      out += chunk;
      if (untilReady && out.includes("HAZIR")) resolve(proc);
    });
    proc.stderr.on("data", chunk => (err += chunk));
    proc.once("exit", (code, signal) => {
      if (untilReady) return;
      if (code === 0) resolve(JSON.parse(out));
      else reject(new Error(`işçi ${code ?? signal}: ${err}`));
    });
  });
const killed = proc =>
  new Promise(resolve => {
    if (proc.exitCode !== null || proc.signalCode) return resolve();
    proc.once("exit", () => resolve());
    proc.kill("SIGKILL");
  });

describe("2.5.0 — openDatabase: bekleme süresi açılış PRAGMA'larından önce", () => {
  before(() => {
    root = mkdtempSync(path.join(tmpdir(), "db-acilis-kilit-"));
  });
  after(() => removeTestDir(root));

  it("açılış süresi kullanıcı yazımlarının süresinden kısa (kilitli dosyada şirket isteği olay döngüsünü 10 sn kilitlemez)", () => {
    assert.equal(typeof dbLib.OPEN_BUSY_TIMEOUT_MS, "number", "açılış bekleme süresi tanımlı (OPEN_BUSY_TIMEOUT_MS)");
    assert.ok(OPEN_BUSY_TIMEOUT_MS > 0 && OPEN_BUSY_TIMEOUT_MS < BUSY_TIMEOUT_MS, `${OPEN_BUSY_TIMEOUT_MS} / ${BUSY_TIMEOUT_MS}`);
    const db = openDatabase(freshDb());
    try {
      assert.equal(Number(db.prepare("PRAGMA busy_timeout").get().timeout), BUSY_TIMEOUT_MS, "açılıştan sonra yazımlar BUSY_TIMEOUT_MS bekler");
      assert.equal(db.prepare("PRAGMA journal_mode").get().journal_mode, "wal");
      assert.equal(Number(db.prepare("PRAGMA synchronous").get().synchronous), 2, "synchronous FULL");
      assert.equal(Number(db.prepare("PRAGMA foreign_keys").get().foreign_keys), 1);
    } finally {
      db.close();
    }
  });

  it("(a) başka bağlantı dosyayı özel kilitle tutarken açılış BEKLER, kilit kalkınca açılır ve yazar", async () => {
    const file = freshDb();
    const lock = await holdLock(file, 400);
    const started = Date.now();
    const db = openDatabase(file);
    const waited = Date.now() - started;
    try {
      db.exec("INSERT INTO t(v) VALUES ('a')");
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM t").get().n, 2);
    } finally {
      db.close();
    }
    const releasedAt = await lock.released;
    assert.ok(waited >= 200, `açılış kilidin kalkmasını bekledi (${waited} ms)`);
    assert.ok(releasedAt && started + waited >= releasedAt - 50, "açılış kilit kalktıktan sonra bitti");
  });

  it("(b) kilit bekleme süresi boyunca kalkmazsa açılış SQLITE_BUSY ile düşer (süre kadar bekleyerek) ve bağlantı kapanır", async () => {
    const file = freshDb();
    const lock = await holdLock(file, OPEN_BUSY_TIMEOUT_MS + 1500);
    const started = Date.now();
    let failure = null;
    try {
      openDatabase(file).close();
    } catch (error) {
      failure = error;
    }
    const waited = Date.now() - started;
    await lock.released;
    // Kilit iş parçacığı aynı süreçte; tutamaklar o kapandıktan sonra sayılır (kalan tutamak düşen açılışındır).
    const handles = openHandles(file);
    assert.ok(failure, "kilitli dosyada açılış düşmeliydi");
    assert.match(String(failure.message), /database is locked/);
    assert.equal(Number(failure.errcode) & 0xff, 5, `SQLITE_BUSY (errcode ${failure.errcode})`);
    assert.ok(waited >= OPEN_BUSY_TIMEOUT_MS - 300, `açılış bekleme süresi kadar bekledi (${waited} ms)`);
    assert.ok(waited < BUSY_TIMEOUT_MS - 2000, `açılış 10 sn beklemedi (${waited} ms)`);
    if (handles !== null) assert.equal(handles, 0, "düşen açılış tutamak sızdırmadı (/proc/self/fd)");
    // Kilit kalkınca aynı dosya açılır (düşen bağlantı dosyayı tutmuyor).
    const db = openDatabase(file);
    try {
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM t").get().n, 1);
    } finally {
      db.close();
    }
  });

  it("(c) salt okunur açılış: kilitli dosyada açılır, ilk okuma kilit kalkana kadar (BUSY_TIMEOUT_MS içinde) bekler ve okur; tutamak kalmaz", async () => {
    // Salt okunur yolda açılış PRAGMA'sı kilit istemez; bekleme ilk okumada olur. Kilit açılış süresinden UZUN tutulur: okuma yine okur (rapor işçisi,
    // yedek, Mutabakat gibi salt okunur yollar kısa açılış süresinden etkilenmez).
    const file = freshDb();
    const lock = await holdLock(file, OPEN_BUSY_TIMEOUT_MS + 1500);
    const started = Date.now();
    const db = openDatabase(file, { readOnly: true });
    try {
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM t").get().n, 1);
    } finally {
      db.close();
    }
    const waited = Date.now() - started;
    await lock.released;
    assert.ok(waited >= OPEN_BUSY_TIMEOUT_MS + 1000, `salt okunur okuma kilidin kalkmasını bekledi (${waited} ms)`);
    const handles = openHandles(file);
    if (handles !== null) assert.equal(handles, 0, "kapatılan salt okunur bağlantı tutamak bırakmadı");
  });

  it("(d) bozuk dosya (veri tabanı değil) BEKLEMEDEN düşer ve bağlantı kapanır (2.4.8 davranışı aynen)", () => {
    const file = path.join(root, "bozuk.sqlite");
    writeFileSync(file, Buffer.from("Bu bir veri tabanı değil.".repeat(500)));
    for (const readOnly of [false, true]) {
      const started = Date.now();
      // Yazılabilir açılış PRAGMA'da düşer (openDatabase bağlantıyı kapatır); salt okunur açılış dosyayı okumaz, ilk okumada düşer (çağıran kapatır).
      assert.throws(() => {
        const db = openDatabase(file, { readOnly });
        try {
          db.prepare("SELECT 1 FROM t").get();
        } finally {
          db.close();
        }
      }, /not a database/i);
      assert.ok(Date.now() - started < 1000, `bozuk dosya beklemedi (readOnly ${readOnly})`);
      const handles = openHandles(file);
      if (handles !== null) assert.equal(handles, 0, `bozuk dosyada tutamak kalmadı (readOnly ${readOnly})`);
    }
  });

  it("(e) yazar işlem ortasında SIGKILL ile öldürülür (kurtarılacak WAL), sonra İKİ SÜREÇ AYNI ANDA açar → ikisi de açılır (CI #1007 errcode 261)", async () => {
    const rounds = 12;
    const failures = [];
    for (let round = 0; round < rounds; round++) {
      const file = freshDb();
      await killed(await runProc(["yaz-kill", file, "20000"], true));
      const at = String(Date.now() + 600);
      const results = await Promise.all([runProc(["ac", file, at]), runProc(["ac", file, at])]);
      for (const item of results) if (!item.ok) failures.push({ round, ...item });
      const db = openDatabase(file);
      try {
        assert.equal(db.prepare("SELECT COUNT(*) AS n FROM t WHERE v = 'acilis'").get().n, results.filter(item => item.ok).length, "her açılan süreç yazdı");
        assert.equal(db.prepare("SELECT COUNT(*) AS n FROM t WHERE v = 'yarım işlem'").get().n, 0, "öldürülen sürecin yarım işlemi yok");
        assert.equal(db.prepare("PRAGMA quick_check").get().quick_check, "ok");
      } finally {
        db.close();
      }
    }
    assert.deepEqual(failures, [], `${failures.length} açılış düştü / ${rounds * 2}`);
  });
});
