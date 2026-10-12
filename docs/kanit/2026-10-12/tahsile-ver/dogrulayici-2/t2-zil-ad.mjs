// Tur 2 sonda B1: banka hesabının adı değişince tahsildeki çekin zil/takvim (dues) etiketi ↔ çek kartı ↔ Vade Takip. Kök: argv[2].
// Koşum: node docs/kanit/2026-10-12/tahsile-ver/dogrulayici-2/t2-zil-ad.mjs .
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2] || ".");
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { bootBank, openAcceptanceAccounts, must, BANK } = await imp("test/banka-210-hesap-ortak.mjs");
const ctx = await bootBank();
const acc = await openAcceptanceAccounts(ctx.api);
const api = ctx.api;
const buyer = await must("müşteri", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
const c = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-10", accountId: buyer.id, serialNo: "Z1" }));
await must("ver", api.post(`/api/workspace/cheques/${c.id}/actions`, { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc.ziraat.id }));
const show = async label => {
  const dues = (await must("dues", api.get("/api/workspace/dues"))).items.filter(item => item.chequeId === c.id).map(item => item.label);
  const card = (await must("kart", api.get(`/api/workspace/cheques/${c.id}`))).statusLabel;
  const vade = (await must("vade", api.get("/api/workspace/overview/vade-takip?preset=all"))).rows.filter(row => JSON.stringify(row).includes("Z1")).map(row => row.label);
  console.log(JSON.stringify({ label, zil: dues, cekKarti: card, vadeTakip: vade }));
};
await show("önce");
await must("ad değiştir", api.put(`${BANK}/accounts/${acc.ziraat.id}`, { bankName: "Yapı Kredi" }));
console.log(JSON.stringify({ hesapAdi: ctx.store.get("SELECT bank_name AS b FROM bank_accounts WHERE id = ?", acc.ziraat.id).b }));
await show("ad değişti");
await must("başka çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "5", issueDate: "2026-10-08", dueDate: "2026-12-01", accountId: buyer.id, serialNo: "Z2" }));
await show("başka bir çek girildikten sonra");
ctx.server.close();
process.exit(0);
