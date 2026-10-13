// Bağımsız doğrulayıcı tur 2 — Senaryo M (şüphe): taksite sayılmış, bankada tahsildeki çek kilitten sonra karşılıksız dönünce kilitli dönemin
// yevmiyesi (alış günü 10.10) değişiyor mu? Elle beklenen (kilit izi, plan §3.14 "Kilit izi" + §5.5): 20.10 kesiti karşılıksızdan önce ve sonra AYNI.
// DEPOSIT=0 ile aynı akış tahsile vermeden (karşılaştırma: eski davranış mı).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { bootBank, lockPeriod, must, openAcceptanceAccounts } from "../../../../../test/banka-210-hesap-ortak.mjs";

const CH = "/api/workspace/cheques";
const deposit = process.env.DEPOSIT !== "0";
const k = v => Math.round(Number(v) * 100);
let ctx, api, acc, m;
const slice = async () => Object.fromEntries((await must("mizan", api.get("/api/workspace/ledger?to=2026-10-20"))).trial.accounts.map(r => [r.code, k(r.balance)]));
describe(`M — taksite sayılmış çek, kilit sonrası karşılıksız (tahsile ver: ${deposit})`, () => {
  before(async () => {
    ctx = await bootBank({ now: "2026-10-27T12:00:00+03:00" });
    api = ctx.api;
    acc = await openAcceptanceAccounts(api);
    m = await must("cari", api.post("/api/workspace/accounts", { name: "Teta Ltd", type: "customer", registeredOn: "2026-09-01" }));
  });
  after(() => ctx?.server.close());
  it("20.10 kesiti karşılıksızdan önce ve sonra aynı", async () => {
    const plan = await must("kart", api.post("/api/workspace/plans", { name: "Teta Taksit", accountId: m.id, total: "2.400", mode: "auto", count: 1, firstDue: "2026-11-30", registeredOn: "2026-10-01" }));
    const c = await must("al", api.post(CH, { direction: "in", instrument: "cheque", serialNo: "TM-1", accountId: m.id, planId: plan.id, amount: "2.400", issueDate: "2026-10-10", dueDate: "2026-10-26" }));
    if (deposit) await must("ver", api.post(`${CH}/${c.id}/actions`, { action: "bank-deposit", date: "2026-10-12", bankAccountId: acc.ziraat.id }));
    if (process.env.LOCK !== "0") await lockPeriod(api, "2026-10-20");
    const s0 = await slice();
    const b = await api.post(`${CH}/${c.id}/actions`, { action: "bounce", date: "2026-10-27" });
    const s1 = await slice();
    const y = (await must("yevmiye", api.get("/api/workspace/report-center/yevmiye?from=2026-10-10&to=2026-10-10"))).rows.map(r => [r[3], r[4], r[5]]);
    const integ = await must("Mutabakat", api.get("/api/workspace/ledger/integrity"));
    const full = Object.fromEntries((await must("mizan", api.get("/api/workspace/ledger"))).trial.accounts.map(r => [r.code, k(r.balance)]));
    const sub = Object.fromEntries((await must("alt", api.get("/api/workspace/bank/sub-trial"))).rows.map(r => [r.sub, k(r.balance)]));
    const y27 = (await must("yevmiye", api.get("/api/workspace/report-center/yevmiye?from=2026-10-27&to=2026-10-27"))).rows.map(r => [r[3], r[4], r[5]]);
    console.log("SONUC", JSON.stringify({ bounce: { status: b.status, code: b.code, error: b.error }, s0: { 120: s0["120"], 602: s0["602"], 101: s0["101"] }, s1: { 120: s1["120"], 602: s1["602"], 101: s1["101"] }, y1010: y, y2710: y27, full: { 120: full["120"], 602: full["602"], 770: full["770"], 101: full["101"] }, sub: { "101.01": sub["101.01"], "101.02": sub["101.02"] }, ok: integ.ok, failures: integ.failures }));
    assert.deepEqual(s1, s0);
  });
});
