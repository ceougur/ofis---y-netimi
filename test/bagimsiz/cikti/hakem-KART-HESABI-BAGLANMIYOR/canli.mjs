// Hakem (KART-HESABI-BAGLANMIYOR): canlı sürüm v2.0.26'da yalnız 2.1.0 öncesi var olan işlemlerle kartla ödeme nereye yazılıyor?
// Kullanım: node canli-v2026.mjs <v2.0.26 çalışma ağacı>
import path from "node:path";
import { pathToFileURL } from "node:url";

const tree = process.argv[2];
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(tree, "test/helpers.mjs")).href);
const server = await startTestServer();
const api = await loginAdmin(server);
const must = async (label, p) => {
  const r = await p;
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data?.data ?? r.data;
};
const today = new Date().toISOString().slice(0, 10);
try {
  const t = await must("cari", api.post("/api/workspace/accounts", { name: "Tedarikçi C25", type: "supplier" }));
  // 1) cari ödeme kartla 579 + koşucunun gönderdiği biçimde bankAccountId (v2.0.26'da banka hesabı kavramı yok)
  const r1 = await api.post(`/api/workspace/accounts/${t.id}/entries`, { kind: "out", amount: "579", method: "card", bankAccountId: "yok-boyle-hesap", date: today });
  console.log(`1) cari ödeme kart 579 + bankAccountId: ${r1.status} ${JSON.stringify(r1.data).slice(0, 120)}`);
  // 2) cari ödeme kartla 100
  const r2 = await api.post(`/api/workspace/accounts/${t.id}/entries`, { kind: "out", amount: "100", method: "card", date: today });
  console.log(`2) cari ödeme kart 100: ${r2.status}`);
  // 3) alış faturası (hizmet 200 + %20 KDV = 240), peşin kartla tamamı
  const doc = { kind: "purchase", accountId: t.id, issueDate: today, number: "F1", pricesIncludeVat: false, lines: [{ name: "Bakım", qty: 1, unitPrice: "200", vatRate: 20 }] };
  const r3 = await api.post("/api/workspace/invoices", { ...doc, payment: { cash: [{ amount: "240", method: "card" }], rest: "open" } });
  console.log(`3) alış faturası 240 peşin kart: ${r3.status} ${r3.status !== 200 ? JSON.stringify(r3.data).slice(0, 200) : ""}`);
  // 4) cari ödeme kartla 50
  const r4 = await api.post(`/api/workspace/accounts/${t.id}/entries`, { kind: "out", amount: "50", method: "card", date: today });
  console.log(`4) cari ödeme kart 50: ${r4.status}`);

  const ledger = await must("mizan", api.get("/api/workspace/ledger"));
  const rows = ledger.trial?.accounts || [];
  console.log(`Mizan (GET /api/workspace/ledger; ağaç ${tree}):`);
  for (const row of rows) console.log(`  ${row.code || row.account} ${row.name || ""} borç ${row.debit} alacak ${row.credit} bakiye ${row.balance ?? ""}`);
  if (!rows.length) console.log(JSON.stringify(ledger).slice(0, 1500));
  const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
  const bank = overview.cash?.bank ?? overview.cash ?? overview;
  console.log(`ANLIK DURUM Banka/POS (cash.bank): ${JSON.stringify(bank)}`);
  console.log(`ANLIK DURUM yol kırılımı (cash.byMethod): ${JSON.stringify(overview.cash?.byMethod)}`);
  const acc = await must("cari liste", api.get("/api/workspace/accounts?status=all"));
  console.log(`Cari bakiye: ${JSON.stringify((acc.accounts || []).map(a => [a.name, a.balance]))}`);
  const integrity = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
  console.log(`Mutabakat Testi: ${integrity.ok ? "tamam" : "BOZUK"}`);
} finally {
  await server.close();
}
