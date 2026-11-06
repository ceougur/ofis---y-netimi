// Ç2 tur 1 — madde 6 YENİDEN ÜRETİM (ders 6): vouchers.postAll(..., { lockThrough }) PUT period-lock'un ön adımını (pos.beforeLock: vadesi gelmiş POS kalemlerini
// bankaya aktar; kalan varsa 409 bank-pending-before-lock) atlıyor mu? Aynı dünya iki kez kurulur: (A) PUT period-lock, (B) postAll lockThrough; sonuçlar yan yana.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 node r6-postall-pos.mjs <depo kökü>
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.argv[2]);
const ortak = await import(pathToFileURL(path.join(ROOT, "test/banka-220-pos-ortak.mjs")).href);
const { BANK, TODAY, bootBank, must, openAcceptanceAccounts, openPos, ziraatPos } = ortak;
const USER = { id: "r6", display_name: "R6" };

async function world(settleMode) {
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  const abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  const pos = await openPos(ctx.api, ziraatPos(acc.ziraat.id, { settleMode }));
  await must("POS satışı", ctx.api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", method: "card", date: TODAY, amount: "1.000" }));
  ctx.server.clock.set("2026-10-14T10:00:00+03:00");
  return { ctx, pos };
}
const settlements = ctx => ctx.store.all("SELECT date, value_date AS valueDate, description FROM fin_events WHERE type = 'pos_settlement' ORDER BY rowid");
const pending = ctx => ctx.store.get("SELECT COUNT(*) AS n FROM pos_items WHERE status = 'pending' AND value_date <= '2026-10-12'").n;
const closing = tag => ({ type: "closing", date: "2026-10-12", description: "Kapanış", requestKey: `r6-${tag}-kapanis-1`, lines: [{ account: "602", debit: 100 }, { account: "690", credit: 100 }] });

for (const mode of ["manual", "auto"]) {
  // (A) PUT
  let w = await world(mode);
  try {
    const res = await w.ctx.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-12" });
    console.log(`[${mode}] A PUT period-lock: ${res.status} ${res.data?.code || ""}; kilit ${w.ctx.app.period.lockedUntil() || "yok"}; aktarım ${JSON.stringify(settlements(w.ctx))}; bekleyen (≤ 12.10) ${pending(w.ctx)}`);
  } finally {
    await w.ctx.server.close();
  }
  // (B) postAll lockThrough
  w = await world(mode);
  try {
    let out;
    try {
      w.ctx.app.ledger.vouchers.postAll(USER, [closing(mode)], { lockThrough: "2026-10-12" });
      out = "200";
    } catch (error) {
      out = `${error.status} ${error.extra?.code || error.message.slice(0, 80)}`;
    }
    console.log(`[${mode}] B postAll lockThrough: ${out}; kilit ${w.ctx.app.period.lockedUntil() || "yok"}; fiş ${w.ctx.store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n}; aktarım ${JSON.stringify(settlements(w.ctx))}; bekleyen (≤ 12.10) ${pending(w.ctx)}`);
    // Kilitten sonra aktarım (otomatik): kalem kilit + 1'e Gecikmeli Aktarım mı?
    if (mode === "manual") await must("otomatik", w.ctx.api.put(`${BANK}/pos/${w.pos.id}`, { settleMode: "auto" }));
    await must("Şimdi Aktar", w.ctx.api.post(`${BANK}/settle`, {}));
    console.log(`[${mode}]   sonra Şimdi Aktar: aktarım ${JSON.stringify(settlements(w.ctx))}`);
  } finally {
    await w.ctx.server.close();
  }
}
