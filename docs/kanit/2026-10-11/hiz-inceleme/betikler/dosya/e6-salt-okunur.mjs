// E6: WAL kipindeki dosyayı salt okunur açma: (a) -wal/-shm yokken, (b) yazar TRUNCATE checkpoint yaparken, (c) yazar BEGIN IMMEDIATE içindeyken
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, existsSync } from "node:fs";
import path from "node:path"; import os from "node:os";
const dir = mkdtempSync(path.join(os.tmpdir(), "e6-")); const file = path.join(dir, "d.sqlite");
let w = new DatabaseSync(file); w.exec("PRAGMA journal_mode=WAL; CREATE TABLE t(x); INSERT INTO t VALUES (1)"); w.close();
console.log("(a) yazar kapalı; -wal var mı:", existsSync(file + "-wal"), "-shm var mı:", existsSync(file + "-shm"));
try { const r = new DatabaseSync(file, { readOnly: true }); r.exec("PRAGMA busy_timeout=10000"); r.exec("BEGIN"); console.log("(a) salt okunur açılış + okuma:", r.prepare("SELECT count(*) c FROM t").get().c); r.exec("COMMIT"); r.close(); console.log("(a) sonra -wal/-shm:", existsSync(file + "-wal"), existsSync(file + "-shm")); } catch (e) { console.log("(a) HATA", e.code, e.errcode, e.message); }
w = new DatabaseSync(file); w.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000");
for (let i = 0; i < 2000; i++) w.exec("INSERT INTO t VALUES (" + i + ")");
const r = new DatabaseSync(file, { readOnly: true }); r.exec("PRAGMA busy_timeout=10000"); r.exec("BEGIN"); r.prepare("SELECT count(*) FROM t").get();
console.log("(b) okuyucu işlem içindeyken yazarın TRUNCATE checkpoint'i:", JSON.stringify(w.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get()));
r.exec("COMMIT");
console.log("(b) okuyucu bitince:", JSON.stringify(w.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get()));
w.exec("BEGIN IMMEDIATE; INSERT INTO t VALUES (99)");
try { const r2 = new DatabaseSync(file, { readOnly: true }); r2.exec("BEGIN"); console.log("(c) yazar işlemdeyken salt okunur okuma:", r2.prepare("SELECT count(*) c FROM t").get().c); r2.exec("COMMIT"); r2.close(); } catch (e) { console.log("(c) HATA", e.message); }
w.exec("COMMIT"); w.close(); r.close();
