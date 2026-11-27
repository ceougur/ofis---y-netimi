// node yazici-kill.mjs <db> <satır> — WAL'a denetim noktası olmadan yazar, "HAZIR" der ve döner (ana süreç SIGKILL ile öldürür).
import { DatabaseSync } from "node:sqlite";
const [file, rows] = process.argv.slice(2);
const db = new DatabaseSync(file);
db.exec("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0;");
const insert = db.prepare("INSERT INTO t(v) VALUES (?)");
db.exec("BEGIN");
for (let i = 0; i < Number(rows); i++) insert.run(`satır ${i} ${"x".repeat(100)}`);
db.exec("COMMIT");
db.exec("BEGIN");
insert.run("yarım işlem");
process.stdout.write("HAZIR\n");
for (;;) {
  // işlem açık
}
