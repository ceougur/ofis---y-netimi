// Kilit tutucu: node tutucu.mjs <db> <kip> <tutmaMs>; hazır olunca stdout'a "HAZIR" yazar, tutmaMs sonra kilidi bırakır (close).
import { DatabaseSync } from "node:sqlite";
const [file, mode, holdMs] = process.argv.slice(2);
const db = new DatabaseSync(file);
if (mode === "excl-wal") {
  db.exec("PRAGMA journal_mode = WAL; PRAGMA locking_mode = EXCLUSIVE; BEGIN; INSERT INTO t(v) VALUES ('a'); COMMIT;");
} else if (mode === "begin-exclusive") {
  db.exec("PRAGMA journal_mode = WAL; BEGIN EXCLUSIVE; INSERT INTO t(v) VALUES ('b');");
} else if (mode === "rollback-read") {
  db.exec("PRAGMA journal_mode = DELETE; BEGIN;");
  db.prepare("SELECT COUNT(*) AS n FROM t").get();
} else throw new Error(mode);
process.stdout.write("HAZIR\n");
const end = Date.now() + Number(holdMs);
while (Date.now() < end) {
  // kilit tutulur
}
try {
  if (db.isTransaction) db.exec("COMMIT");
} catch {
  // yok
}
db.close();
process.stdout.write(`BIRAKTI ${Date.now()}\n`);
