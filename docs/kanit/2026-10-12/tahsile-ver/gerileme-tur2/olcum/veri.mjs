// Tur 2 gerileme — hız karşılaştırması için veri (bağımsız doğrulayıcı; KOD DEĞİŞTİRMEZ). Bankaya Tahsile Ver KULLANILMAZ (şema aynı, göç yok):
// aynı veri klasörü v2.1.0'ın gerçek koduyla ve bu dalın koduyla ayrı kopyalarda açılıp aynı uçlar ölçülür (olc.mjs).
//   node veri.mjs <dataDir> <cekSayisi>
import { mkdirSync } from "node:fs";
import path from "node:path";
import { CURRENT, bootVersion } from "../../../../../../test/guvenilirlik/surumler.mjs";

const [dir, countText = "3000"] = process.argv.slice(2);
const N = Number(countText);
mkdirSync(dir, { recursive: true });
const app = await bootVersion(CURRENT, { dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), now: { time: "2026-10-08T12:00:00+03:00", fixed: true }, gateVerify: false, reportWorker: false });
const api = await app.login();
const must = async (label, p) => { const r = await p; if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return r.data; };
const bank = await must("hesap", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", currency: "TRY", opening: { date: "2026-01-01", amount: "1.000.000", confirmed: true } }));
const customers = [];
for (let i = 0; i < 200; i += 1) customers.push((await must("cari", api.post("/api/workspace/accounts", { name: `Müşteri ${i + 1}`, type: "customer", registeredOn: "2026-01-01" }))).id);
const supplier = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Tedarikçi A", type: "supplier", registeredOn: "2026-01-01" }))).id;
const day = n => { const d = new Date(Date.UTC(2026, 0, 3 + n)); return d.toISOString().slice(0, 10); };
const t0 = Date.now();
const counts = {};
for (let i = 0; i < N; i += 1) {
  const issue = day(i % 270);
  const due = day((i % 270) + 20 + (i % 60));
  const c = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: i % 5 === 0 ? "note" : "cheque", amount: String(100 + (i % 97) * 13), accountId: customers[i % customers.length], serialNo: `P-${i}`, issueDate: issue, dueDate: due }));
  const kind = i % 10;
  const act = day(Math.min((i % 270) + 5, 277));
  let action = null;
  if (kind < 4) action = { action: "collect", date: act, method: "bank", bankAccountId: bank.id };
  else if (kind === 4) action = { action: "collect", date: act, method: "cash" };
  else if (kind === 5) action = { action: "endorse", date: act, accountId: supplier };
  else if (kind === 6) action = { action: "bounce", date: act };
  if (action) await must(`işlem ${i}`, api.post(`/api/workspace/cheques/${c.id}/actions`, action));
  counts[action?.action || "portfolio"] = (counts[action?.action || "portfolio"] || 0) + 1;
}
console.log(JSON.stringify({ cheques: N, counts, ms: Date.now() - t0 }));
await app.close();
