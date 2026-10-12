// Bağımsız doğrulayıcı — Senaryo D: tahsildeki çekin beklenen tarihi bütün vade ekranlarında aynı mı (plan §3.14 "Nakit akışında ve Vade Takip'te
// vade + hesabın valörüyle"; §8.9 "Nakit Akış kaynakları: … Tahsildeki Çek"; "Vade Takip / Zil / Takvim: … tahsildeki çekler bank.view ile eklenir").
// Beklenen elle: vade 17.10.2026 Cumartesi → valör (iş günü) 19.10.2026 Pazartesi. Bugün 15.10.2026.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { bootBank, must, openAcceptanceAccounts } from "../../../../../test/banka-210-hesap-ortak.mjs";

const CH = "/api/workspace/cheques";
let ctx, api, acc, abc, dep, por;
describe("D — tahsildeki çekin beklenen tarihi: Nakit Akış / Vade Takip / Zil-Takvim", () => {
  before(async () => {
    ctx = await bootBank({ now: "2026-10-15T12:00:00+03:00" });
    api = ctx.api;
    acc = await openAcceptanceAccounts(api);
    abc = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    dep = await must("çek", api.post(CH, { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-02", dueDate: "2026-10-17", accountId: abc.id, serialNo: "D-1" }));
    por = await must("çek", api.post(CH, { direction: "in", instrument: "cheque", amount: "300", issueDate: "2026-10-02", dueDate: "2026-10-17", accountId: abc.id, serialNo: "D-2" }));
    await must("ver", api.post(`${CH}/${dep.id}/actions`, { action: "bank-deposit", date: "2026-10-15", bankAccountId: acc.ziraat.id }));
  });
  after(() => ctx.server.close());

  it("Nakit Akış: tahsildeki 19.10 (valör), portföydeki 17.10; kaynak ayrımı 'Tahsildeki Çek'", async () => {
    const d = await must("Nakit Akış", api.get("/api/workspace/overview/nakit-akisi?from=2026-10-15&to=2026-10-31&table=0"));
    const rows = d.rows.filter(r => r.ref?.type === "cheque").map(r => ({ no: r.label.match(/No (D-\d)/)?.[1], date: r.date, source: r.source }));
    console.log("D akış", JSON.stringify(rows), JSON.stringify(d.bySource));
    assert.deepEqual(rows.map(r => [r.no, r.date]).sort(), [["D-1", "2026-10-19"], ["D-2", "2026-10-17"]]);
    const sources = new Set(rows.map(r => r.source));
    assert.equal(sources.size, 2, `tahsildeki ve portföydeki çek aynı kaynakta: ${[...sources]}`);
  });
  it("Vade Takip: tahsildeki 19.10", async () => {
    const d = await must("Vade Takip", api.get("/api/workspace/overview/vade-takip?preset=open&sources=cheque"));
    const rows = d.rows.filter(r => r.ref?.type === "cheque").map(r => [r.label.match(/No (D-\d)/)?.[1], r.date]).sort();
    console.log("D vade", JSON.stringify(rows));
    assert.deepEqual(rows, [["D-1", "2026-10-19"], ["D-2", "2026-10-17"]]);
  });
  it("Zil / Takvim (dues): tahsildeki çek Vade Takip ile aynı tarihte ve 'Bankada Tahsilde' olarak", async () => {
    const d = await must("dues", api.get("/api/workspace/dues"));
    const rows = d.items.filter(i => i.source === "cheque").map(i => ({ no: i.label.match(/No (D-\d)/)?.[1], due: i.dueDate, label: i.label, days: i.days })).sort((a, b) => a.no.localeCompare(b.no));
    console.log("D zil", JSON.stringify(rows));
    assert.deepEqual(rows.map(r => [r.no, r.due]), [["D-1", "2026-10-19"], ["D-2", "2026-10-17"]], "zil/takvim tahsildeki çeki vade (17.10) ile gösteriyor; Vade Takip 19.10");
  });
});
