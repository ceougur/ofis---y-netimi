// 2.5.1 D4-ÖN tur 2 — H4: devir yedeği klasörü son adına alınırken programın KENDİ okuma akışının tutamağı hâlâ açık mı? (Windows'ta açık tutamaklı klasör taşınamaz.)
// Kullanım: ROOT=<programın kopyası> HUKUK_LICENSE_URL=http://127.0.0.1:9 node docs/kanit/2026-11-27/d4ont2-zorla-h4.mjs
// node:fs createReadStream ve renameSync sarılır (syncBuiltinESMExports: programın adlı içe aktarımları da sarmalı görür); klasör taşıması anında kapanmamış akış sayılır.
// Linux'ta ayrıca /proc/self/fd okunur (yarım klasörün içini gösteren açık tutamak).
import fs, { mkdirSync, mkdtempSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(process.env.ROOT || ".");
const { companyOf } = await import(path.join(ROOT, "test/devir-d2-yardimci.mjs"));
const { loginAdmin, removeTestDir, startTestServer } = await import(path.join(ROOT, "test/helpers.mjs"));
const dir = mkdtempSync(path.join(tmpdir(), "destekofis-d4on-h4-"));
const server = await startTestServer({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: "2026-11-02T10:00:00+03:00", fixed: true } });
const admin = await loginAdmin(server);
const created = await admin.post("/api/companies", { name: "Taşıma İkinci" });
const company = companyOf(server.app, created.data.data.company.id);
const dataDir = server.app.companies.dirsOf(company).dataDir;
mkdirSync(path.join(dataDir, "belgeler", "cd"), { recursive: true });
writeFileSync(path.join(dataDir, "belgeler", "cd", "cd".padEnd(64, "1")), "belge");
writeFileSync(path.join(dataDir, "secret.key"), "y".repeat(44));

const open = new Set();
const realStream = fs.createReadStream;
const realRename = fs.renameSync;
const seen = [];
fs.createReadStream = (...args) => {
  const stream = realStream(...args);
  const file = String(args[0]);
  open.add(file);
  stream.on("close", () => open.delete(file));
  return stream;
};
fs.renameSync = (from, to) => {
  from = String(from);
  if (from.endsWith(".yaziliyor") && path.basename(path.dirname(from)) === "devir-yedekleri") {
    const streams = [...open].filter(file => file.startsWith(from + path.sep)).map(file => path.relative(from, file));
    let fds = "okunmadı (Linux değil)";
    if (process.platform === "linux") {
      fds = readdirSync("/proc/self/fd").map(fd => {
        try {
          return readlinkSync(`/proc/self/fd/${fd}`);
        } catch {
          return "";
        }
      }).filter(link => link.startsWith(from + path.sep)).map(link => path.relative(from, link));
    }
    seen.push({ streams, fds });
  }
  return realRename(from, to);
};
syncBuiltinESMExports();
try {
  for (let i = 0; i < 3; i += 1) await server.app.backups.createDevirBackupFor(company, { label: `devir-oncesi-${2026 + i}`, year: String(2026 + i), runId: "h4" });
} finally {
  fs.createReadStream = realStream;
  fs.renameSync = realRename;
  syncBuiltinESMExports();
}
console.log(`ROOT ${ROOT}`);
seen.forEach((row, i) => console.log(`H4 taşıma ${i + 1}: kapanmamış okuma akışı ${row.streams.length} ${JSON.stringify(row.streams)} · /proc/self/fd yarım klasörde ${Array.isArray(row.fds) ? row.fds.length : row.fds} ${JSON.stringify(row.fds)}`));
await server.close();
removeTestDir(dir);
