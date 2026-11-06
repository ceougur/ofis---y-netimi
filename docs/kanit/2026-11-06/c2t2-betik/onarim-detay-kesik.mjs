// Ç2 tur 2 — YAN BULGU denemesi (kapsam dışı, yalnız rapor): onarım kaydının ayrıntısı JSON.stringify(...).slice(0, 20000) ile kesiliyor; çok fiş kaldırılınca geçersiz JSON
// Mutabakat Testi yanıtında (routes/ledger.mjs: JSON.parse(row.detail)) hataya yol açar mı? Kullanım: node onarim-detay-kesik.mjs <kod kökü> <fiş sayısı>
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const [CODE, COUNT] = [path.resolve(process.argv[2]), Number(process.argv[3] || 600)];
const h = await import(pathToFileURL(path.join(CODE, "test/helpers.mjs")).href);
const root = mkdtempSync(path.join(tmpdir(), "c2t2-detay-kesik-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
const USER = { id: "c2t2", display_name: "C2T2" };
let server = await h.startTestServer({ ...dirs, now: { time: "2027-01-10T10:00:00+03:00", fixed: true } });
const file = server.app.config.dbPath;
for (let i = 0; i < COUNT; i += 1) server.app.ledger.vouchers.post(USER, { type: "opening-match", date: "2027-01-05", requestKey: `c2t2-kesik-${i}`, lines: [{ account: "590", debit: 100 }, { account: "519", credit: 100 }] });
await server.close();
const db = new DatabaseSync(file);
db.exec("BEGIN IMMEDIATE; DELETE FROM audit_events; DELETE FROM integrity_log;");
db.prepare("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES ('event-eski', 'company.reset', 'sirket-001', 'u', 'U', '{}', '2027-01-10T08:00:00.000Z')").run();
db.exec("COMMIT");
db.close();
server = await h.startTestServer({ ...dirs, now: { time: "2027-01-10T12:00:00+03:00", fixed: true } });
try {
  const row = server.app.store.get("SELECT length(detail_json) AS n, detail_json AS d FROM integrity_log WHERE action = 'repair' AND tables = 'ledger_vouchers'");
  let valid = true;
  try {
    JSON.parse(row.d);
  } catch {
    valid = false;
  }
  const scan = await (await h.loginAdmin(server)).get("/api/workspace/ledger/integrity");
  console.log(`onarım: kaldırılan ${server.app.context.voucherRepair?.removed}; ayrıntı ${row?.n} karakter, geçerli JSON: ${valid}; Mutabakat Testi HTTP ${scan.status} ${JSON.stringify(scan.data).slice(0, 160)}`);
} finally {
  await server.close();
  h.removeTestDir(root);
}
