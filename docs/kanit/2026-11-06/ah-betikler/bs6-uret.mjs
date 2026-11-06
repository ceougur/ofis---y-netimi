// BS-6 yeniden üretim (gerçek SQLite, Linux): iç içe store.tx'in İÇ seviyesinde dosya boyutu sınırı (RLIMIT_FSIZE) + küçük önbellek → önbellek
// taşması WAL'a yazarken G/Ç hatası; SQLite işlemi kendiliğinden geri alır mı (db.isTransaction)? Sonra dış fn hatayı yakalayıp yazmayı sürdürürse
// (seçici yakalama deseni) derinlik 1 iken bağlantıda işlem yok → store.run yazımı kendiliğinden kesinleşir mi (yarım yazım)?
//   node bs6-uret.mjs <kod kökü>
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] || ".");
const { createStore, openDatabase } = await import(pathToFileURL(path.join(root, "server", "lib", "db.mjs")).href);
const dir = mkdtempSync(path.join(os.tmpdir(), "bs6-uret-"));
const file = path.join(dir, "x.sqlite");
const raw = openDatabase(file);
raw.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT); CREATE TABLE cash_entries (id TEXT PRIMARY KEY, amount REAL);");
const store = createStore(raw);
const pid = String(process.pid);
const soft = execFileSync("prlimit", ["--pid", pid, "--fsize", "--raw", "--noheadings", "-o", "SOFT"], { encoding: "utf8" }).trim();
const wal = () => { try { return statSync(`${file}-wal`).size; } catch { return 0; } };
const out = { kod: root };
raw.exec("PRAGMA wal_autocheckpoint = 0");
for (let i = 0; i < 3; i += 1) store.tx(() => store.run("INSERT INTO t (v) VALUES (?)", `ısınma ${i}`));
raw.exec("PRAGMA cache_size = 8"); // 8 sayfa: büyük işlem önbellekten taşar, işlem içinde WAL'a yazılır
let innerError = null;
let afterInner = null;
let outerError = null;
const limit = wal() + 64 * 1024;
out.sinirBayt = limit;
try {
  store.tx(() => {
    store.run("INSERT INTO t (v) VALUES ('dış önce')");
    try {
      execFileSync("prlimit", ["--pid", pid, `--fsize=${limit}:`]);
      store.tx(() => {
        for (let i = 0; i < 2000; i += 1) store.run("INSERT INTO t (v) VALUES (?)", `iç ${i} ${"x".repeat(2000)}`);
      });
    } catch (error) {
      innerError = error.message;
    } finally {
      execFileSync("prlimit", ["--pid", pid, `--fsize=${soft}:`]);
    }
    afterInner = { depthIcinde: store.inTransaction, baglantidaIslem: raw.isTransaction };
    // Seçici yakalamadan sonra iş sürer: bir para satırı ve bir düz satır.
    store.run("INSERT INTO cash_entries (id, amount) VALUES ('sonra', 100)");
    store.run("INSERT INTO t (v) VALUES ('dış sonra')");
  });
} catch (error) {
  outerError = error.message;
}
out.icHata = innerError;
out.icHatadanSonra = afterInner;
out.disHata = outerError;
const count = sql => Number(raw.prepare(sql).get().n);
out.kalanSatir = { disOnce: count("SELECT COUNT(*) AS n FROM t WHERE v = 'dış önce'"), ic: count("SELECT COUNT(*) AS n FROM t WHERE v LIKE 'iç %'"), disSonra: count("SELECT COUNT(*) AS n FROM t WHERE v = 'dış sonra'"), paraSonra: count("SELECT COUNT(*) AS n FROM cash_entries WHERE id = 'sonra'") };
out.sondaBaglantidaIslem = raw.isTransaction;
console.log(JSON.stringify(out, null, 2));
try { if (raw.isTransaction) raw.exec("ROLLBACK"); raw.close(); } catch {}
rmSync(dir, { recursive: true, force: true });
