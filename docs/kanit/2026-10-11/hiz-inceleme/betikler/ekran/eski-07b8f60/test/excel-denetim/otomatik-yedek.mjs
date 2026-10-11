// Otomatik yedek: zamanlayıcının "zamanı gelen" çalışması (aralık 2 sn'ye indirilir), iki şirket de kendi klasörüne.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../../server/app.mjs";
import { HERE, PASS } from "./ortak.mjs";
const ROOT = path.join(process.env.SP, "canli");
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "durum.json"), "utf8"));
const app = createApp({ dataDir: path.join(ROOT, "data"), backupDir: path.join(ROOT, "backups"), logLevel: "error", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_BACKUP_INTERVAL_HOURS: String(2 / 3600) }, license: { enforce: false, machineId: "d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6" } });
await app.listen(0, "127.0.0.1");
await new Promise(r => setTimeout(r, 2500));
const ran = await app.runDueBackups();
const out = [];
for (const item of ran) {
  const file = item.path || (item.folder && item.name ? path.join(item.folder, item.name) : "");
  const db = file && fs.existsSync(file) ? new DatabaseSync(file, { readOnly: true }) : null;
  const meta = db ? JSON.parse(db.prepare("SELECT value FROM backup_meta WHERE key='company'").get()?.value || "null") : null;
  const n = db ? db.prepare("SELECT COUNT(*) n FROM invoices WHERE status='issued'").get().n : null;
  db?.close();
  out.push({ company: item.company?.code || item.companyId, name: item.name || item.error, folder: file ? path.basename(path.dirname(file)) : "", kimlik: meta?.code, faturalar: n });
}
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(HERE, "cikti", "otomatik-yedek-sonucu.json"), JSON.stringify(out, null, 1));
void state;
await app.close();
