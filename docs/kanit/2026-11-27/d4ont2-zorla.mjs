// 2.5.1 D4-ÖN tur 2 — CI #1115 Windows kırmızısının ("undefined unable to open database file") Linux'ta ZORLA üretilmesi (ders 6, 20).
// Kullanım: ROOT=<programın kopyası> HUKUK_LICENSE_URL=http://127.0.0.1:9 node docs/kanit/2026-11-27/d4ont2-zorla.mjs
// H1: her VACUUM INTO hedefinin ve SQLite günlüğünün (-journal) Windows uzunluğu CI'nin geçici klasörüyle (path.win32) hesaplanır; uzunluk ≥ 260 (MAX_PATH, NUL dahil)
//     ise günlüğün yoluna klasör konur → SQLite günlüğü GERÇEKTEN açamaz (Windows'ta CreateFileW'nin MAX_PATH reddinin Linux eşdeğeri). Testteki dört etiket sırayla.
// H2: testin isMove'u Windows biçimli (path.win32) yollarla: iç dosya taşıması eşleşir mi?
// H3: önceki yedeğin klasöründe açık tutamak varken sonraki yedek alınabiliyor mu?
import { closeSync, mkdirSync, mkdtempSync, openSync, readdirSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(process.env.ROOT || ".");
const WIN_TMP = process.env.WIN_TMP || "C:\\Users\\RUNNER~1\\AppData\\Local\\Temp";
const MAX_PATH = 260;
const { companyOf } = await import(path.join(ROOT, "test/devir-d2-yardimci.mjs"));
const { loginAdmin, removeTestDir, startTestServer } = await import(path.join(ROOT, "test/helpers.mjs"));
const winOf = file => path.win32.join(WIN_TMP, ...path.relative(tmpdir(), file).split(path.sep));

const dir = mkdtempSync(path.join(tmpdir(), "destekofis-d4on-tasima-"));
const server = await startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: "2026-11-02T10:00:00+03:00", fixed: true } });
const admin = await loginAdmin(server);
const created = await admin.post("/api/companies", { name: "Taşıma İkinci" });
const company = companyOf(server.app, created.data.data.company.id);
const dataDir = server.app.companies.dirsOf(company).dataDir;
mkdirSync(path.join(dataDir, "belgeler", "cd"), { recursive: true });
writeFileSync(path.join(dataDir, "belgeler", "cd", "cd".padEnd(64, "1")), "belge");
writeFileSync(path.join(dataDir, "secret.key"), "y".repeat(44));

const opened = [];
const realExec = DatabaseSync.prototype.exec;
DatabaseSync.prototype.exec = function (sql) {
  const match = /^VACUUM INTO '(.*)'$/s.exec(String(sql));
  if (match) {
    const target = match[1].replace(/''/g, "'");
    const journal = `${target}-journal`;
    const row = { target: winOf(target).length, journal: winOf(journal).length };
    row.blocked = row.journal >= MAX_PATH;
    if (row.blocked) mkdirSync(journal); // Windows'ta açılamayacak günlük → Linux'ta da açılamaz
    opened.push(row);
  }
  return realExec.call(this, sql);
};

console.log(`ROOT ${ROOT}`);
console.log(`H1 — CI geçici klasörü ${WIN_TMP} (${WIN_TMP.length} karakter); sınır ${MAX_PATH} (NUL dahil → en çok ${MAX_PATH - 1})`);
let fd = null;
for (const label of ["devir-oncesi-2026", "devri-yenile-oncesi-2026", "devri-geri-al-oncesi-2026", "devir-oncesi-2027"]) {
  const before = opened.length;
  let outcome;
  try {
    const made = await server.app.backups.createDevirBackupFor(company, { label, year: label.slice(-4), runId: "zorla" });
    outcome = `Tamam (${made.files} dosya)`;
    if (!fd) {
      // H3: bu yedeğin veri tabanı kopyasını açık tut; sonraki yedekler etkilenir mi?
      const database = readdirSync(made.path).find(name => name.endsWith(".sqlite"));
      fd = openSync(path.join(made.path, database), "r");
    }
  } catch (error) {
    outcome = `HATA status=${error.status} ileti="${error.message}" code=${error.extra?.code ?? error.code ?? ""}`;
  }
  const row = opened[before] || {};
  console.log(`  ${label.padEnd(26)} VACUUM hedefi ${row.target ?? "?"} / günlük ${row.journal ?? "?"} karakter${row.blocked ? " (≥ 260 → günlük açılamaz)" : ""} → ${outcome}`);
}
if (fd !== null) closeSync(fd);
console.log("H3 — ilk yedeğin veri tabanı kopyası açık tutuldu (sonraki yedekler yukarıda; etkilenen yok ise H3 elendi)");

// H2: testin isMove'u (aynı ifade) Windows biçimli yollarla.
const isMoveWin = from => from.endsWith(".yaziliyor") && path.win32.basename(path.win32.dirname(from)) === "devir-yedekleri";
const folder = "C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\destekofis-d4on-tasima-AbCdEf\\backups\\002 - Taşıma İkinci\\devir-yedekleri\\2026-11-02T07-00-00-000Z-devri-yenile-oncesi-2026.yaziliyor";
const inner = `${folder}\\destekofis-002-2026-11-02T07-00-00-000Z-devri-yenile-oncesi-2026.sqlite.yaziliyor`;
console.log(`H2 — isMove(klasör)=${isMoveWin(folder)} isMove(iç dosya)=${isMoveWin(inner)} isMove(ileri eğik çizgili klasör)=${isMoveWin(folder.replace(/\\/g, "/"))}`);

DatabaseSync.prototype.exec = realExec;
await server.close();
removeTestDir(dir);
