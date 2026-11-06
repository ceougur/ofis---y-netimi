// BT5 madde 1 — "ilk hata okuma hatasında da dolsun" (dar kontrol DOĞRULANMADI): GERÇEK SQLite'ta işlem içindeki bir OKUMA (SELECT) G/Ç hatası verip işlemi
// kendiliğinden geri aldırabilir mi? Düzen: büyük önbellekle işlem içinde çok sayfa kirlenir (yazım diske taşmaz), sonra önbellek 8 sayfaya indirilir, dosya boyutu
// sınırı (RLIMIT_FSIZE) WAL'ın o anki boyunun biraz üstüne çekilir, büyük bir tablo taranır → önbellek kirli sayfaları WAL'a taşırırken G/Ç hatası.
// node okuma-hatasi-dene.mjs <kodKoku> <klasor>
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [root, dir] = process.argv.slice(2);
const { createStore, openDatabase } = await import(pathToFileURL(path.join(root, "server", "lib", "db.mjs")).href);
const pid = String(process.pid);
const soft = execFileSync("prlimit", ["--pid", pid, "--fsize", "--raw", "--noheadings", "-o", "SOFT"], { encoding: "utf8" }).trim();
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const file = path.join(dir, "a.sqlite");
const raw = openDatabase(file);
raw.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT); CREATE TABLE big (id INTEGER PRIMARY KEY, v TEXT); CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT, updated_by TEXT); PRAGMA wal_autocheckpoint = 0");
const store = createStore(raw);
store.tx(() => {
  for (let i = 0; i < 3000; i += 1) store.run("INSERT INTO big (v) VALUES (?)", `büyük ${i} ${"y".repeat(1500)}`);
});
raw.exec("PRAGMA wal_checkpoint(TRUNCATE)");
let readError = null;
let later = null;
let outer = null;
let afterRead = null;
try {
  store.tx(() => {
    raw.exec("PRAGMA cache_size = -20000");
    for (let i = 0; i < 400; i += 1) store.run("INSERT INTO t (v) VALUES (?)", `dış önce ${i} ${"x".repeat(2000)}`);
    let wal = 0;
    try {
      wal = statSync(`${file}-wal`).size;
    } catch {}
    raw.exec("PRAGMA cache_size = 8");
    execFileSync("prlimit", ["--pid", pid, `--fsize=${wal + 32 * 1024}:`]);
    try {
      readError = null;
      try {
        store.all("SELECT id, length(v) AS n FROM big ORDER BY v DESC");
      } catch (error) {
        readError = `${error.code || ""} ${error.errcode ?? ""} ${String(error.message).slice(0, 60)}`;
      }
    } finally {
      execFileSync("prlimit", ["--pid", pid, `--fsize=${soft}:`]);
    }
    afterRead = raw.isTransaction;
    raw.exec("PRAGMA cache_size = -2000");
    try {
      store.run("INSERT INTO t (v) VALUES ('dış sonra')");
    } catch (error) {
      later = `${error.code || ""} ${String(error.message).slice(0, 160)}`;
    }
  });
} catch (error) {
  outer = `${error.code || ""} ${String(error.message).slice(0, 200)}`;
}
execFileSync("prlimit", ["--pid", pid, `--fsize=${soft}:`]);
const left = raw.prepare("SELECT COUNT(*) AS n FROM t").get().n;
console.log(JSON.stringify({ readError, acikIslemOkumadanSonra: afterRead, sonrakiYazim: later, dis: outer, disktekiDisSatir: left }, null, 1));
raw.close();
rmSync(dir, { recursive: true, force: true });
