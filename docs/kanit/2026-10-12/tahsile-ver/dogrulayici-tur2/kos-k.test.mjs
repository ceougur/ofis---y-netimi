// Bağımsız doğrulayıcı tur 2 — Senaryo K: yıl dönümü + yılbaşı tatili + yıl sonu kilidi. Sahte saat 05.01.2027 Salı.
// Elle beklenen (plan §3.14): çek 28.12.2026 alınır (3.333,33), 30.12.2026 Ziraat'e tahsile verilir; vade 01.01.2027 Cuma (tatil) → beklenen
// 04.01.2027 Pazartesi (gecikmiş, bugün 05.01). Yıl sonu kilidi 31.12.2026. 05.01.2027 tahsil: B 102.01 / A 101.02.
//   2027 Alt Hesap Mizanı: 101.02 devir 3.333,33 · alacak 3.333,33 · bakiye 0; 102.01 devir 100.000 · borç 3.333,33.
//   2026 kesiti (?to=2026-12-31) tahsilden sonra da: 101.02 = 3.333,33; 101.01 = 0.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { bootBank, lockPeriod, must, openAcceptanceAccounts } from "../../../../../test/banka-210-hesap-ortak.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CH = "/api/workspace/cheques";
const k = v => Math.round(Number(v) * 100);
const log = {};
let ctx, api, acc, m, ch;
const subRows = async q => Object.fromEntries((await must("alt hesap", api.get(`/api/workspace/bank/sub-trial${q}`))).rows.map(r => [r.sub, { devir: k(r.opening), borc: k(r.debit), alacak: k(r.credit), bakiye: k(r.balance) }]));

describe("K — yıl dönümü", () => {
  before(async () => {
    ctx = await bootBank({ now: "2027-01-05T12:00:00+03:00" });
    api = ctx.api;
    acc = await openAcceptanceAccounts(api);
    m = await must("cari", api.post("/api/workspace/accounts", { name: "Epsilon AŞ", type: "customer", registeredOn: "2026-09-01" }));
  });
  after(() => {
    writeFileSync(path.join(HERE, "gercek-k.json"), JSON.stringify(log, null, 1));
    ctx?.server.close();
  });

  it("K1: tahsildeyken beklenen gün 04.01.2027 (yılbaşı tatili + hafta sonu yok; 01.01 Cuma tatil → 04.01 Pazartesi): Nakit Akış gecikmiş, Vade Takip, Zil, rapor", async () => {
    ch = await must("al", api.post(CH, { direction: "in", instrument: "cheque", serialNo: "Y-27", accountId: m.id, amount: "3.333,33", issueDate: "2026-12-28", dueDate: "2027-01-01" }));
    await must("ver", api.post(`${CH}/${ch.id}/actions`, { action: "bank-deposit", date: "2026-12-30", bankAccountId: acc.ziraat.id }));
    await lockPeriod(api, "2026-12-31");
    const na = await must("akış", api.get("/api/workspace/overview/nakit-akisi?from=2027-01-05&to=2027-02-05&table=0"));
    const vt = (await must("vade", api.get("/api/workspace/overview/vade-takip?preset=open&sources=cheque"))).rows.find(r => /Y-27/.test(r.label));
    const zil = (await must("dues", api.get("/api/workspace/dues"))).items.find(r => /Y-27/.test(r.label));
    const rep = (await must("rapor", api.get("/api/workspace/report-center/tahsildeki-cekler"))).rows.find(r => r[3] === "Y-27");
    log.K1 = { over: na.overdue.map(r => [r.date, r.amount]), rows: na.rows.map(r => [r.date, r.amount]), vt: vt && [vt.date, vt.state], zil: zil && [zil.dueDate, zil.state], rep };
    assert.deepEqual({ over: log.K1.over, vt: log.K1.vt, zil: log.K1.zil, rep: rep?.[6] }, { over: [["2027-01-04", 3333.33]], vt: ["2027-01-04", "overdue"], zil: ["2027-01-04", "overdue"], rep: "04.01.2027" });
  });

  it("K2: 05.01.2027 tahsil (kilitli yılda verilmiş): 2027 Alt Hesap Mizanı devir/alacak; 2026 kesiti değişmez; Mutabakat tamam", async () => {
    const before26 = await subRows("?to=2026-12-31");
    await must("tahsil", api.post(`${CH}/${ch.id}/actions`, { action: "collect", date: "2027-01-05" }));
    const after26 = await subRows("?to=2026-12-31");
    const y27 = await subRows("?from=2027-01-01&to=2027-12-31");
    const integ = await must("Mutabakat", api.get("/api/workspace/ledger/integrity"));
    const trial27 = Object.fromEntries((await must("mizan", api.get("/api/workspace/ledger?from=2027-01-01&to=2027-12-31"))).trial.accounts.map(r => [r.code, { devir: k(r.opening), borc: k(r.debit), alacak: k(r.credit), bakiye: k(r.balance) }]));
    log.K2 = { before26, after26, y27, trial27: { 101: trial27["101"], 102: trial27["102"] }, ok: integ.ok };
    assert.deepEqual(after26, before26, "2026 kesiti değişti");
    assert.deepEqual(before26["101.02"].bakiye, 333333);
    assert.deepEqual(y27["101.02"], { devir: 333333, borc: 0, alacak: 333333, bakiye: 0 });
    assert.deepEqual(y27["102.01"], { devir: 10000000, borc: 333333, alacak: 0, bakiye: 10333333 });
    assert.deepEqual(trial27["101"], { devir: 333333, borc: 0, alacak: 333333, bakiye: 0 });
    assert.equal(integ.ok, true, JSON.stringify(integ.failures));
  });
});
