// Tur 2 gerileme sondası: MEVCUT çek akışlarının (Bankaya Tahsile Ver kullanılmadan) İşlem Kartı yevmiye satırları eski ↔ yeni.
//   node sonda-islem-karti-mevcut.mjs <v2.1.0|guncel>
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { bootVersion } from "../../../../../test/guvenilirlik/surumler.mjs";

const [version] = process.argv.slice(2);
const root = mkdtempSync(path.join(tmpdir(), "gerileme-tur2-sonda-"));
const app = await bootVersion(version, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: { time: "2026-10-08T12:00:00+03:00", fixed: true }, reportWorker: false });
const api = await app.login();
const must = async (l, p) => { const r = await p; if (r.status !== 200) throw new Error(`${l} ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`); return r.data; };
const bank = await must("hesap", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } }));
const abc = await must("cari", api.post("/api/workspace/accounts", { name: "ABC", type: "customer", registeredOn: "2026-09-01" }));
const c = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.000", accountId: abc.id, serialNo: "S1", issueDate: "2026-10-05", dueDate: "2026-10-31" }));
await must("tahsil", api.post(`/api/workspace/cheques/${c.id}/actions`, { action: "collect", date: "2026-10-08", method: "bank", bankAccountId: bank.id }));
const moves = await must("hareketler", api.get(`/api/workspace/bank/movements?account=${bank.id}`));
const rows = moves.rows || moves.movements || moves.items || [];
const out = [];
for (const row of rows) {
  const ref = row.id || row.eventId || row.ref;
  const card = await api.get(`/api/workspace/bank/events/${ref}`);
  out.push({ no: row.no, type: row.type || row.typeLabel, status: card.status, lines: (card.data?.lines || []).map(l => ({ account: l.account, sub: l.sub, subName: l.subName, debit: l.debit, credit: l.credit, name: l.accountName || l.name })) });
}
console.log(version, JSON.stringify(out, null, 1));
await app.close();
