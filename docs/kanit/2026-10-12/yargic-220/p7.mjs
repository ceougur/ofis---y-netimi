// Yargıç 2.2.0 — p7: eski sürüme dönüş (2.2.0 → v2.1.0 → 2.2.0; plan §10.6 açılış onarımı) POS bekleyen satışlarıyla.
// v2.1.0 (7c6405f, ayrı kopya) POS'u bilmez: POS'lu cari tahsilatının TUTARINI değiştirir, birini SİLER, yeni bir kart tahsilatı girer.
// Bağımsız beklenen (plan §4.3 BSMV Dahil %2,5; §10.6 c/g): 10.000 → 8.000 düzeltilen satış valörde net 7.800 (kom. 200); silinen 5.000 satış void;
// eski sürümün yeni kart tahsilatı 108.00 / "Hesabı Belirsiz". Ziraat = 100.000 + 7.800 = 107.800; 108.01 = 0.
// Koşu: SP=<geçici> node docs/kanit/2026-10-12/yargic-220/p7.mjs <eski-kod-klasörü>
import { mkdtempSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const OLD_DIR = process.argv[2];
const NOW = "2026-10-08T12:00:00+03:00";
const BANK = "/api/workspace/bank";
const ok = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data?.ok === true ? res.data.data : res.data;
};
const trial = ledger => Object.fromEntries(ledger.trial.accounts.map(r => [r.code, r.balance]));
const out = [];
const check = (id, label, expected, actual) => {
  const okk = JSON.stringify(expected) === JSON.stringify(actual);
  out.push(okk);
  console.log(`${okk ? "UYDU " : "FARK "} [${id}] ${label} :: beklenen=${JSON.stringify(expected)} gerçek=${JSON.stringify(actual)}`);
};
const root = mkdtempSync(path.join(process.env.SP || "/tmp", "yargic220-p7-"));
const dataDir = path.join(root, "data");
const NH = await import(pathToFileURL(path.resolve("test/helpers.mjs")).href);
const OH = await import(pathToFileURL(path.join(OLD_DIR, "test", "helpers.mjs")).href);

// 1) 2.2.0
let srv = await NH.startTestServer({ dataDir, now: NOW });
let api = await NH.loginAdmin(srv);
const z = await ok("hesap", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
await ok("POS Kullan", api.put(`${BANK}/accounts/${z.id}`, { usePos: true }));
await ok("POS", api.post(`${BANK}/pos`, { name: "Ziraat POS", bankAccountId: z.id, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", merchantNo: "1", terminalNo: "T1", validFrom: "2026-10-01", rates: [{ installments: 1, rate: "2,5" }] }));
const party = await ok("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
const e1 = await ok("POS 10.000", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-10-08" }));
const e2 = await ok("POS 5.000", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "5.000", method: "card", date: "2026-10-08" }));
await srv.app.close();

// 2) v2.1.0 aynı dosyada
srv = await OH.startTestServer({ dataDir, now: "2026-10-09T12:00:00+03:00" });
api = await OH.loginAdmin(srv);
const r1 = await api.put(`/api/workspace/accounts/${party.id}/entries/${e1.entryId}`, { amount: "8.000" });
console.log("v2.1.0 düzelt 10.000 → 8.000:", r1.status, JSON.stringify(r1.data).slice(0, 200));
const r2 = await api.del(`/api/workspace/accounts/${party.id}/entries/${e2.entryId}`);
console.log("v2.1.0 sil 5.000:", r2.status, JSON.stringify(r2.data).slice(0, 200));
const r3 = await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "700", method: "card", date: "2026-10-09" });
console.log("v2.1.0 yeni kart tahsilatı 700:", r3.status, JSON.stringify(r3.data).slice(0, 160));
await srv.app.close();

// 3) 2.2.0 yeniden
srv = await NH.startTestServer({ dataDir, now: "2026-10-09T12:00:00+03:00" });
api = await NH.loginAdmin(srv);
console.log("onarım raporu:", JSON.stringify(srv.app.context?.bankRepair || srv.app.repair || null).slice(0, 600));
const sales = (await ok("satışlar", api.get(`${BANK}/pos/sales`))).sales;
console.log("POS satışları:", JSON.stringify(sales.map(s => [s.status, s.grossMinor / 100, s.commissionMinor / 100, s.items.map(i => [i.status, i.grossMinor / 100, i.netMinor / 100])])));
let integ = await ok("mutabakat", api.get("/api/workspace/ledger/integrity"));
console.log("Mutabakat (dönüşten hemen sonra):", integ.ok, JSON.stringify((integ.failures || []).map(f => [f.code, f.name || f.label, f.detail || ""]).slice(0, 6)).slice(0, 700));
srv.clock.set("2026-10-13T12:00:00+03:00");
await ok("aktar", api.post(`${BANK}/settle`, {}));
const zb = (await ok("h", api.get(`${BANK}/accounts/${z.id}`))).balanceMinor / 100;
check("R1", "Ziraat valörden sonra (100.000 + 7.800)", 107800, zb);
const sub = await ok("alt", api.get(`${BANK}/sub-trial`));
const subs = Object.fromEntries(sub.rows.map(r => [r.sub, r.balance]));
check("R2", "108.01 / 108.00", [0, 700], [subs["108.01"] ?? 0, subs["108.00"] ?? 0]);
const tb = trial(await ok("mizan", api.get("/api/workspace/ledger")));
check("R3", "653 (8.000 × %2,5)", 200, tb["653"] ?? 0);
const cari = await ok("cari", api.get(`/api/workspace/accounts/${party.id}`));
check("R4", "cari ABC (−8.000 − 700)", -8700, cari.totals.balance);
integ = await ok("mutabakat", api.get("/api/workspace/ledger/integrity"));
check("R5", "Mutabakat", true, integ.ok);
console.log("Mutabakat hataları:", JSON.stringify((integ.failures || []).map(f => [f.code, f.name || f.label]).slice(0, 6)));
await srv.app.close();
console.log("\nÖZET", out.filter(x => !x).length, "fark /", out.length);
process.exit(0);
