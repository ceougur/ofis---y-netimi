// Tur 2 sonda: tahsildeki (bekleyen kayıtlı) çekte action "hasOwnProperty" / "__proto__" / "toString" → ne olur? Kök: argv[2].
// Koşum: node docs/kanit/2026-10-12/tahsile-ver/dogrulayici-2/t2-proto-pending.mjs <kök>
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2] || ".");
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { bootBank, openAcceptanceAccounts, must } = await imp("test/banka-210-hesap-ortak.mjs");
const { integrityOf } = await imp("test/banka-210-ortak.mjs");
const ctx = await bootBank();
const acc = await openAcceptanceAccounts(ctx.api);
const buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
for (const action of ["hasOwnProperty", "__proto__", "toString"]) {
  const cheque = await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-31", accountId: buyer.id, serialNo: `P-${action}` }));
  const dep = await ctx.api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "bank-deposit", date: "2026-10-08", bankAccountId: acc.ziraat.id });
  const res = await ctx.api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action, date: "2026-10-08" });
  let record = null;
  try { record = ctx.store.get("SELECT status FROM cheque_collections WHERE cheque_id = ? ORDER BY rowid DESC", cheque.id); } catch { record = "tablo yok"; }
  const audit = ctx.store.get("SELECT type FROM audit_events WHERE entity_id = ? ORDER BY rowid DESC LIMIT 1", cheque.id);
  const withdrawEvents = (() => { try { return Number(ctx.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE cheque_id = ? AND type = 'cheque_withdraw'", cheque.id).n); } catch { return "?"; } })();
  console.log(JSON.stringify({ root: path.basename(root), action, deposit: dep.status, depositCode: dep.code, status: res.status, code: res.code, error: res.error, record, sonAudit: audit?.type, chequeWithdrawBasligi: withdrawEvents }));
}
console.log(JSON.stringify({ mutabakat: (await integrityOf(ctx.api)).ok }));
ctx.server.close();
process.exit(0);
