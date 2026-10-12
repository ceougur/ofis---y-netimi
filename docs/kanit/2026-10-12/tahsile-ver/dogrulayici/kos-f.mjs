// Bağımsız doğrulayıcı — Senaryo F (en küçük): tahsildeki senet karşılıksız döner. Plan §3.14: "Karşılıksız (bankadan dönen): mevcut
// cheque_events(bounce) + kayıt returned; Yevmiye mevcut bounce maddesinde A 101.02" → o gün TEK madde: B 120 (DEF) 3.000 / A 101.02 3.000;
// 101.01 o gün hareketsiz (borç 0, alacak 0). Elle beklenen.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { bootBank, must, openAcceptanceAccounts } from "../../../../../test/banka-210-hesap-ortak.mjs";

const CH = "/api/workspace/cheques";
let ctx, api;
describe("F — karşılıksız (tahsildeki) yevmiyesi", () => {
  before(async () => {
    ctx = await bootBank({ now: "2026-10-15T12:00:00+03:00" });
    api = ctx.api;
    const acc = await openAcceptanceAccounts(api);
    const def = await must("cari", api.post("/api/workspace/accounts", { name: "DEF", type: "customer", registeredOn: "2026-09-01" }));
    const n = await must("senet", api.post(CH, { direction: "in", instrument: "note", amount: "3.000", issueDate: "2026-10-03", dueDate: "2026-11-16", accountId: def.id, serialNo: "N1" }));
    await must("ver", api.post(`${CH}/${n.id}/actions`, { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc.ziraat.id }));
    await must("karşılıksız", api.post(`${CH}/${n.id}/actions`, { action: "bounce", date: "2026-10-14" }));
  });
  after(() => ctx.server.close());
  it("14.10 Yevmiye ve Alt Hesap Mizanı (14.10–14.10)", async () => {
    const yev = await must("yevmiye", api.get("/api/workspace/report-center/yevmiye?from=2026-10-14&to=2026-10-14"));
    const alt = await must("alt", api.get("/api/workspace/bank/sub-trial?from=2026-10-14&to=2026-10-14"));
    const r = Object.fromEntries(alt.rows.map(x => [x.sub, [x.debit, x.credit]]));
    console.log("F yevmiye", JSON.stringify(yev.rows), "madde", yev.summary);
    console.log("F alt", JSON.stringify(r));
    assert.deepEqual({ madde: yev.rows.length / 2, s10101: r["101.01"], s10102: r["101.02"] }, { madde: 1, s10101: [0, 0], s10102: [0, 3000] });
  });
});
