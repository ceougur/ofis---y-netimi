// Ç2 tur 1 (DÜŞÜK-2): fikstür nesne deposundaki (brotli) SQLite dosyalarının user_version'ı ve eski göç 46 tetikleyicisi var mı?
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dir = process.argv[2];
const tmp = mkdtempSync(path.join(process.argv[3], "fkbr-"));
let max = 0;
let n = 0;
const hits = [];
for (const name of readdirSync(dir)) {
  if (!name.endsWith(".br")) continue;
  let buf;
  try {
    buf = brotliDecompressSync(readFileSync(path.join(dir, name)));
  } catch {
    continue;
  }
  if (buf.subarray(0, 15).toString("latin1") !== "SQLite format 3") continue;
  n += 1;
  const t = path.join(tmp, "x.sqlite");
  writeFileSync(t, buf);
  const db = new DatabaseSync(t, { readOnly: true });
  const v = db.prepare("PRAGMA user_version").get().user_version;
  max = Math.max(max, v);
  const trig = db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type='trigger' AND name='ledger_voucher_lines_closed'").get();
  if (v >= 46 || trig) hits.push(`${v} ${trig ? "tetik" : ""} ${name}`);
  db.close();
}
console.log(`sqlite ${n}, en yüksek user_version ${max}; ≥46 ya da tetikleyicili: ${hits.length ? hits.join("; ") : "YOK"}`);
rmSync(tmp, { recursive: true, force: true });
