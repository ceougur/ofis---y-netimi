// DAR KONTROL Ç2 TUR 1 — K5 + saat geri (001, 2.4.9 GERÇEK kodu): asıl fiş O 10:00'da, saat geri alınır, ters kaydı R 08:00'de yazılır; 2.4.9 09:00'da Şirket Verisini
// Sıfırla. Onarım: O (10:00 > sıfırlama) kalır mı, R (08:00 ≤ sıfırlama) kaldırılır mı → ters kaydı silinmiş asıl fiş yeniden ETKİN mi (yevmiye / mizan)?
// Kullanım: node k5-saat-ters.mjs <yeni kök> <2.4.9 kökü> [<onarım kökü>]
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const [NEW, OLD, REPAIR] = process.argv.slice(2).map(value => value && path.resolve(value));
const helpersOf = async code => import(pathToFileURL(path.join(code, "test/helpers.mjs")).href);
const neu = await helpersOf(NEW);
const old = await helpersOf(OLD);
const fix = REPAIR ? await helpersOf(REPAIR) : neu;
const root = mkdtempSync(path.join(tmpdir(), "dk-c2t1-k5-ters-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
const USER = { id: "dk", display_name: "DK" };

let server = await neu.startTestServer({ ...dirs, now: { time: "2027-01-10T10:00:00+03:00", fixed: true } });
const V = server.app.ledger.vouchers;
const o = V.post(USER, { type: "opening-match", date: "2027-01-06", description: "Asıl", requestKey: "dk-k5-ters-o", lines: [{ account: "590", debit: 45600 }, { account: "519", credit: 45600 }] });
server.clock.set("2027-01-10T08:00:00+03:00");
const r = V.reverse(USER, o.id, { requestKey: "dk-k5-ters-r" });
console.log(`1) yeni kod: O ${o.createdAt}, R ${r.createdAt}`);
await server.close();

server = await old.startTestServer({ ...dirs, now: { time: "2027-01-10T09:00:00+03:00", fixed: true } });
let admin = await old.loginAdmin(server);
const reset = await admin.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: old.ADMIN_PASSWORD });
console.log(`2) 2.4.9 sıfırlama ${reset.status}`);
await server.close();

server = await fix.startTestServer({ ...dirs, now: { time: "2027-01-10T12:00:00+03:00", fixed: true } });
try {
  const repair = server.app.context.voucherRepair;
  const left = server.app.store.all("SELECT request_key AS k FROM ledger_vouchers ORDER BY rowid").map(row => row.k);
  const trial = server.app.ledger.check().trial.accounts.filter(row => ["590", "519"].includes(row.code)).map(row => `${row.code}=${row.balance}`);
  admin = await fix.loginAdmin(server);
  const scan = await admin.get("/api/workspace/ledger/integrity");
  console.log(`3) onarım (${REPAIR ? path.basename(REPAIR) : "yeni"}): ${JSON.stringify(repair && { removed: repair.removed, kept: repair.kept?.length })}; kalan ${JSON.stringify(left)}; mizan ${JSON.stringify(trial)}; Mutabakat Testi ok=${scan.data?.data?.ok}; ledger:vouchers sorunları ${JSON.stringify((scan.data?.data?.checks || []).filter(item => /vouch/.test(item.code)).map(item => [item.code, item.ok]))}`);
} finally {
  await server.close();
  neu.removeTestDir(root);
}
