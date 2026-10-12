// Tur 2 sonda: "Portföyde (alınan)" — Çek/Senet penceresinin özeti (GET /cheques summary.in.open; istemci hof-cheques.js:157 bu adla gösterir)
// ↔ Rapor Merkezi Çek/Senet Portföyü raporunun özeti (doğrulama T7 sonrası). Koşum: node .../t2-portfoy-ozet.mjs .
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2] || ".");
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { bootBank, openAcceptanceAccounts, must } = await imp("test/banka-210-hesap-ortak.mjs");
const ctx = await bootBank();
const acc = await openAcceptanceAccounts(ctx.api);
const api = ctx.api;
const buyer = await must("müşteri", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
const a = await must("çek A", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-11-30", accountId: buyer.id, serialNo: "PA" }));
await must("çek B", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-11-30", accountId: buyer.id, serialNo: "PB" }));
await must("A tahsile", api.post(`/api/workspace/cheques/${a.id}/actions`, { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc.ziraat.id }));
const list = await must("liste", api.get("/api/workspace/cheques"));
const rep = await must("rapor", api.get("/api/workspace/report-center/cek-portfoy"));
console.log(JSON.stringify({ pencereOzeti_inOpen: list.summary.in.open, pencereOzeti_deposited: list.summary.deposited, raporOzeti: rep.summary }));
ctx.server.close();
process.exit(0);
