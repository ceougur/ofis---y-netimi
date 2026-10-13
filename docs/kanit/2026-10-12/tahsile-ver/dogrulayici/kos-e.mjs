// Bağımsız doğrulayıcı — Senaryo E: Banka ekranları (Hareketler, hesap kartı son hareketler, Banka Genel Bakış/özet) tahsile vermede para
// hareketi göstermez; tahsil ise hesabın girişidir (plan §3.14: Tahsile Ver "para satırı yok"; §3.7 #21). Elle beklenen: Ziraat 100.000 →
// tahsile ver (1.000) sonrası 100.000, Hareketler'de giriş 0; tahsil sonrası 101.000, giriş 1.000.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { bootBank, must, openAcceptanceAccounts } from "../../../../../test/banka-210-hesap-ortak.mjs";

const CH = "/api/workspace/cheques";
const B = "/api/workspace/bank";
let ctx, api, acc, abc, c;
describe("E — Banka ekranları", () => {
  before(async () => {
    ctx = await bootBank({ now: "2026-10-15T12:00:00+03:00" });
    api = ctx.api;
    acc = await openAcceptanceAccounts(api);
    abc = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    c = await must("çek", api.post(CH, { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-02", dueDate: "2026-10-20", accountId: abc.id, serialNo: "E-1" }));
    await must("ver", api.post(`${CH}/${c.id}/actions`, { action: "bank-deposit", date: "2026-10-15", bankAccountId: acc.ziraat.id }));
  });
  after(() => ctx.server.close());

  it("tahsile verdikten sonra: Hareketler, hesap kartı, Banka özeti, ANLIK DURUM bugün giriş", async () => {
    const mv = await must("hareketler", api.get(`${B}/movements?account=${acc.ziraat.id}&from=2026-10-01&to=2026-10-31`));
    const card = await must("hesap", api.get(`${B}/accounts/${acc.ziraat.id}`));
    const sum = await must("özet", api.get(`${B}/summary`));
    const ov = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    const list = mv.rows || mv.items || mv.movements || [];
    const got = { hareket: list.map(r => ({ type: r.type, in: r.inMinor ?? r.in, out: r.outMinor ?? r.out, amount: r.amountMinor ?? r.amount, no: r.no })), recent: (card.recent || []).map(r => ({ type: r.type, amount: r.amountMinor ?? r.amount, dir: r.direction })), bakiye: card.balanceMinor, gercek: sum.realBank?.minor, bugunGiris: ov.cash?.bank?.today?.in };
    console.log("E", JSON.stringify(got));
    assert.equal(got.bakiye, 10000000);
    assert.equal(got.gercek, 15000000);
    assert.equal(got.bugunGiris, 0);
  });
});
