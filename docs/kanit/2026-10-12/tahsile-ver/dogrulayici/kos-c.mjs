// Bağımsız doğrulayıcı — Senaryo C: Alt Hesap Mizanı'nın ilk tahsile vermeden önceki hâli; Mutabakat Testi'nin dişi (ham SQL ile bozulan iz).
// Beklenenler elle (plan §3.11 madde 5–6: 101.01 portföy alt hesabı; §3.11 cheque:collections: 101.02 = Σ etkin kayıt, her başlığın kaydı var).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { bootBank, must, openAcceptanceAccounts } from "../../../../../test/banka-210-hesap-ortak.mjs";
import { rawRun } from "../../../../../test/banka-210-ortak.mjs";

const CH = "/api/workspace/cheques";
const NOW = "2026-10-15T12:00:00+03:00";
const k = v => Math.round(Number(v) * 100);
const act = (api, id, body) => api.post(`${CH}/${id}/actions`, body);

describe("C1 — hiç tahsile verilmemiş şirkette Alt Hesap Mizanı", () => {
  let ctx, api, acc, abc;
  before(async () => {
    ctx = await bootBank({ now: NOW });
    api = ctx.api;
    acc = await openAcceptanceAccounts(api);
    abc = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  });
  after(() => ctx.server.close());
  it("portföyde 2.000 alınan çek: Ana Defter 101 = 2.000 iken Alt Hesap Mizanı'nda 101.01 satırı ve 101 ana hesabı var mı (plan §3.11: 101.01 Portföydeki Çekler)", async () => {
    await must("çek", api.post(CH, { direction: "in", instrument: "cheque", amount: "2.000", issueDate: "2026-10-02", dueDate: "2026-11-02", accountId: abc.id, serialNo: "P-1" }));
    const sub = await must("alt", api.get("/api/workspace/bank/sub-trial"));
    const led = await must("mizan", api.get("/api/workspace/ledger"));
    const ana101 = led.trial.accounts.find(r => r.code === "101")?.balance;
    const got = { ana101, alt10101: sub.rows.find(r => r.sub === "101.01")?.balance ?? null, mains: sub.mains.map(m => m.account) };
    console.log("C1", JSON.stringify(got));
    assert.deepEqual(got, { ana101: 2000, alt10101: 2000, mains: ["101", "102"] });
  });
});

describe("C2 — Mutabakat Testi'nin dişi: ham SQL ile bozulan tahsil izi yakalanır mı", () => {
  const cases = [
    ["bekleyen kaydın verilme başlığı silinir", (db, c) => rawRun(db, "DELETE FROM fin_events WHERE type = 'cheque_deposit' AND cheque_id = ?", c.id)],
    ["bekleyen kayıt başlıksız 'withdrawn' yapılır", (db, c) => rawRun(db, "UPDATE cheque_collections SET status = 'withdrawn' WHERE cheque_id = ?", c.id)],
    ["tahsildeki evrakın tutarı değiştirilir", (db, c) => rawRun(db, "UPDATE cheques SET amount = 1500 WHERE id = ?", c.id)],
    ["tahsildeki evrak 'collected' yapılır (kayıt bekliyor)", (db, c) => rawRun(db, "UPDATE cheques SET status = 'collected' WHERE id = ?", c.id)],
    ["ikinci bekleyen kayıt (başka hesap) eklenir", (db, c, acc) => rawRun(db, "INSERT INTO cheque_collections (id, cheque_id, bank_account_id, given_date, status, closed_date, event_id, close_event_id, created_by, created_at) VALUES ('chqcol-sahte', ?, ?, '2026-10-06', 'withdrawn', '2026-10-07', 'yok', 'yok', 'test', '2026-10-06')", c.id, acc.garanti.id)],
  ];
  for (const [label, tamper] of cases) {
    it(`${label} → Mutabakat Testi bozuk (cheque:collections ya da başka denetim)`, async () => {
      const ctx = await bootBank({ now: NOW });
      try {
        const api = ctx.api;
        const acc = await openAcceptanceAccounts(api);
        const abc = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
        const c = await must("çek", api.post(CH, { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-02", dueDate: "2026-11-02", accountId: abc.id, serialNo: "T-1" }));
        await must("ver", act(api, c.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: acc.ziraat.id }));
        const okBefore = (await must("mutabakat", api.get("/api/workspace/ledger/integrity"))).ok;
        tamper(ctx.db, c, acc);
        const r = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
        const failing = (r.failures || r.checks.filter(x => !x.ok)).map(x => x.code);
        console.log("C2", label, okBefore, r.ok, JSON.stringify(failing));
        assert.equal(okBefore, true);
        assert.equal(r.ok, false, "bozuk iz yakalanmadı");
      } finally {
        ctx.server.close();
      }
    });
  }
});
