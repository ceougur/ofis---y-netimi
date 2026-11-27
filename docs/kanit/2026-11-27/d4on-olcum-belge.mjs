// D4-ÖN kabul E: arşivsiz şirkette belge temizliği süresi önce (taban) / sonra (yeni) — AYNI veri, dosya silinmez (dosyalar yeni tarihli → tarama maliyeti).
// Kullanım: node olcum-belge.mjs <yeni ağaç> <taban ağacı> [dosya sayısı] [satır sayısı]
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir, loadavg } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [NEW, OLD, FILES = "20000", ROWS = "10000"] = process.argv.slice(2);
const mod = async root => import(pathToFileURL(path.join(root, "server/lib/documents.mjs")).href);
const { createApp } = await import(pathToFileURL(path.join(NEW, "server/app.mjs")).href);
const yeni = await mod(NEW);
const eski = await mod(OLD);
const root = mkdtempSync(path.join(tmpdir(), "d4on-olcum-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: "Olcum-Parola-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false });
try {
  const dir = path.join(app.config?.dataDir || path.join(root, "data"), "belgeler");
  const shas = [];
  for (let i = 0; i < Number(FILES); i += 1) {
    const sha = createHash("sha256").update(`belge-${i}`).digest("hex");
    mkdirSync(path.join(dir, sha.slice(0, 2)), { recursive: true });
    writeFileSync(path.join(dir, sha.slice(0, 2), sha), `belge-${i}`);
    shas.push(sha);
  }
  const store = app.store;
  const now = new Date().toISOString();
  store.tx(() => {
    for (let i = 0; i < Number(ROWS); i += 1) store.run("INSERT INTO case_documents (id, case_key, name, kind, mime, size, sha256, created_by, created_at) VALUES (?, ?, ?, 'pdf', 'application/pdf', 10, ?, 'olcum', ?)", `olcum-${i}`, `2026/${i % 500}`, `Belge ${i}.pdf`, shas[i], now);
  });
  const companies = app.companies;
  const companyId = companies.ROOT_COMPANY_ID;
  const binding = () => (companies.archivesOf(companyId) || []).map(entry => ({ year: entry.year, file: path.join(dir, "..", "arsiv", entry.year, "destekofis.sqlite") }));
  const variants = {
    taban: () => eski.createDocumentStore({ dir }),
    yeni: () => yeni.createDocumentStore({ dir, archives: binding }),
  };
  const times = { taban: [], yeni: [] };
  let last = {};
  for (let round = 0; round < 7; round += 1) {
    for (const name of round % 2 ? ["yeni", "taban"] : ["taban", "yeni"]) {
      const files = variants[name]();
      const start = process.hrtime.bigint();
      last[name] = files.purge(store);
      times[name].push(Number(process.hrtime.bigint() - start) / 1e6);
    }
  }
  const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
  console.log(JSON.stringify({ dosya: Number(FILES), satir: Number(ROWS), arsiv: companies.archivesOf(companyId).length, loadavg: loadavg(), tabanMs: times.taban.map(t => +t.toFixed(1)), yeniMs: times.yeni.map(t => +t.toFixed(1)), tabanOrtanca: +median(times.taban).toFixed(1), yeniOrtanca: +median(times.yeni).toFixed(1), sonuc: last }, null, 1));
} finally {
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
