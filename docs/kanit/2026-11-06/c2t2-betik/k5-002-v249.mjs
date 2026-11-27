// DAR KONTROL Ç2 TUR 1 — K5 onarımı İKİNCİ ŞİRKETTE (002) ve 2.4.9'un GERÇEK koduyla; ayrıca saat geri kipi (sıfırlama anı < fiş anı).
// Kullanım: node k5-002-v249.mjs <yeni kök> <eski 2.4.9 kökü> <sıfırlama saati: ileri|geri> [<karşılaştırma kökü (onarımı açan kod)>]
//   1) yeni kod: 002 açılır, 002'de iki fiş (biri ters kayıtlı) yazılır;
//   2) 2.4.9: 002'yi Şirket Verisini Sıfırla (Tüm Hareketleri Sil);
//   3) onarım kodu (yeni ya da karşılaştırma kökü): 002 açılır → onarım sonucu + kalan fiş + Mutabakat Testi + yevmiyedeki fiş maddeleri.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const [NEW, OLD, mode, REPAIR] = process.argv.slice(2).map((value, index) => (index === 2 ? value : value && path.resolve(value)));
const helpersOf = async code => import(pathToFileURL(path.join(code, "test/helpers.mjs")).href);
const neu = await helpersOf(NEW);
const old = await helpersOf(OLD);
const fix = REPAIR ? await helpersOf(REPAIR) : neu;
const root = mkdtempSync(path.join(tmpdir(), "dk-c2t1-k5-002-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
const T_FIS = "2027-01-10T10:00:00+03:00"; // 07:00Z
const T_RESET = mode === "geri" ? "2027-01-10T09:00:00+03:00" : "2027-01-10T11:00:00+03:00";
const USER = { id: "dk", display_name: "DK" };

// 1) yeni kod
let server = await neu.startTestServer({ ...dirs, now: { time: T_FIS, fixed: true } });
let admin = await neu.loginAdmin(server);
const created = await admin.post("/api/companies", { name: "DK İkinci", select: false });
const second = created.data.data.company || created.data.data;
await admin.get(`/api/workspace/ledger?hofCompany=${encodeURIComponent(second.id)}`);
const child = server.app.openCompany(second.id);
const V = child.ledger.vouchers;
const a = V.post(USER, { type: "closing", date: "2027-01-06", description: "002 kapanış", requestKey: "dk-k5-002-a", lines: [{ account: "602", debit: 70000 }, { account: "690", credit: 70000 }] });
V.reverse(USER, a.id, { requestKey: "dk-k5-002-a-r" });
const b = V.post(USER, { type: "opening-match", date: "2027-01-07", description: "002 eşleştirme", requestKey: "dk-k5-002-b", lines: [{ account: "590", debit: 12300 }, { account: "519", credit: 12300 }] });
console.log(`1) yeni kod: 002 = ${second.id} (${second.code}); fiş ${child.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n}, iz ${child.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'ledger.voucher.created'").n}; fiş anı ${a.createdAt}`);
await server.close();

// 2) 2.4.9 — 002'yi sıfırla
server = await old.startTestServer({ ...dirs, now: { time: T_RESET, fixed: true } });
admin = await old.loginAdmin(server);
await admin.get(`/api/workspace/cash?hofCompany=${encodeURIComponent(second.id)}`);
const reset = await admin.post(`/api/companies/${second.id}/reset`, { mode: "movements", confirm: second.code, password: old.ADMIN_PASSWORD });
const oldChild = server.app.openCompany ? server.app.openCompany(second.id) : null;
const resets = oldChild ? oldChild.store.all("SELECT entity_id AS e, created_at AS at FROM audit_events WHERE type = 'company.reset'") : "okunamadı";
console.log(`2) 2.4.9 sıfırlama: ${reset.status}; 002 dosyasındaki company.reset izleri ${JSON.stringify(resets)}; kalan fiş ${oldChild ? oldChild.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n : "okunamadı"}`);
await server.close();

// 3) onarım kodu
server = await fix.startTestServer({ ...dirs, now: { time: "2027-01-10T12:00:00+03:00", fixed: true } });
try {
  admin = await fix.loginAdmin(server);
  const ledger = await admin.get(`/api/workspace/ledger?hofCompany=${encodeURIComponent(second.id)}`);
  const c = server.app.openCompany(second.id);
  const repair = c.context.voucherRepair;
  const left = c.store.all("SELECT request_key AS k FROM ledger_vouchers ORDER BY rowid").map(row => row.k);
  const scan = await admin.get(`/api/workspace/ledger/integrity?hofCompany=${encodeURIComponent(second.id)}`);
  const entries = c.ledger.build().filter(item => /voucher/.test(item.id)).map(item => `${item.id.split(":")[0]} ${item.lines.map(line => `${line.account}${line.debit ? "B" : "A"}${(line.debit || line.credit)}`).join(" ")}`);
  console.log(`3) onarım (${REPAIR ? path.basename(REPAIR) : "yeni"}): ledger ${ledger.status}; onarım ${JSON.stringify(repair && { removed: repair.removed, ids: repair.ids?.length, kept: repair.kept?.length })}; kalan fiş ${JSON.stringify(left)}; Mutabakat Testi ${scan.status} ok=${scan.data?.data?.ok}; yevmiyede fiş maddesi ${entries.length} ${JSON.stringify(entries)}`);
  console.log(`SONUC kip=${mode} kalan=${left.length} kaldirilan=${repair?.removed ?? "yok"}`);
} finally {
  await server.close();
  neu.removeTestDir(root);
}
