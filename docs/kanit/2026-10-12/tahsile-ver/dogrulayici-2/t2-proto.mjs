// Tur 2 sonda: action "__proto__" / "hasOwnProperty" / "valueOf" ile çek eylem ucu. Kök: argv[2] (depo kökü; eski sürüm ayrı kopyada).
// Koşum: node docs/kanit/2026-10-12/tahsile-ver/dogrulayici-2/t2-proto.mjs <kök>
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2] || ".");
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { bootBank, openAcceptanceAccounts, must } = await imp("test/banka-210-hesap-ortak.mjs");
const { integrityOf } = await imp("test/banka-210-ortak.mjs");
const ctx = await bootBank();
const acc = await openAcceptanceAccounts(ctx.api);
const buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
const count = (t, w = "1") => Number(ctx.store.get(`SELECT COUNT(*) AS n FROM ${t} WHERE ${w}`).n);
const snap = () => ({ cheque_events: count("cheque_events"), fin_events: count("fin_events"), account_entries: count("account_entries"), audit: count("audit_events"), collections: (() => { try { return count("cheque_collections"); } catch { return "tablo yok"; } })() });
const cheque = await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-31", accountId: buyer.id, serialNo: "P1" }));
for (const action of ["__proto__", "hasOwnProperty", "valueOf", "constructor", "bank-withdraw", "bank-deposit"]) {
  const before = snap();
  const res = await ctx.api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action, date: "2026-10-08", bankAccountId: acc.ziraat.id });
  const row = ctx.store.get("SELECT status, updated_at AS u FROM cheques WHERE id = ?", cheque.id);
  console.log(JSON.stringify({ root: path.basename(root), action, status: res.status, code: res.code, error: res.error, data: res.data && typeof res.data === "object" ? Object.keys(res.data) : res.data, before, after: snap(), cheque: row }));
}
const auditRows = ctx.store.all("SELECT type, entity_id AS e FROM audit_events ORDER BY rowid DESC LIMIT 4");
console.log(JSON.stringify({ sonAudit: auditRows }));
const integ = await integrityOf(ctx.api);
console.log(JSON.stringify({ mutabakat: integ.ok }));
ctx.server.close();
process.exit(0);
