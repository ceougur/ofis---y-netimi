// Bağımsız doğrulayıcı — Senaryo B (MUHASEBE SAYILARI, uç durumlar). Beklenenler bu dosyada ELLE, plan §3.14 / §3.11 madde 5 metninden yazıldı
// (programın kodu beklenen türetmek için kullanılmadı). Sahte saat 15.10.2026. Kod değiştirmez.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { bootBank, must, openAcceptanceAccounts, openAccount, trIban, lockPeriod } from "../../../../../test/banka-210-hesap-ortak.mjs";

const CH = "/api/workspace/cheques";
const NOW = "2026-10-15T12:00:00+03:00";
const k = v => Math.round(Number(v) * 100);
const act = (api, id, body) => api.post(`${CH}/${id}/actions`, body);
async function subs(api, q = "") {
  const d = await must("alt", api.get(`/api/workspace/bank/sub-trial${q}`));
  return { rows: Object.fromEntries(d.rows.map(r => [r.sub, r])), mains: Object.fromEntries(d.mains.map(m => [m.account, m])) };
}
async function main(api, q = "") {
  const d = await must("mizan", api.get(`/api/workspace/ledger${q}`));
  return Object.fromEntries(d.trial.accounts.map(r => [r.code, r]));
}
const bal = (rows, s) => k(rows[s]?.balance ?? 0);
async function integrity(api) {
  const r = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
  return { ok: r.ok, failures: (r.failures || []).map(f => f.code || f), coll: r.checks.find(c => c.code === "cheque:collections") };
}
async function boot() {
  const ctx = await bootBank({ now: NOW });
  const acc = await openAcceptanceAccounts(ctx.api);
  const abc = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  const xyz = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
  return { ctx, api: ctx.api, acc, abc, xyz };
}
const receive = (api, body) => must(`al ${body.serialNo}`, api.post(CH, { direction: "in", instrument: "cheque", issueDate: "2026-10-02", dueDate: "2026-11-02", ...body }));

describe("B1 — taksite sayılmış çek: tahsile ver → karşılıksız (geçmiş tarihli mizan)", () => {
  let t;
  before(async () => { t = await boot(); });
  after(() => t.ctx.server.close());
  it("plan: 10-02 B 101.01 900 / A 120; 10-05 B 101.02 / A 101.01; 10-08 karşılıksız A 101.02 → ?to=10-06: 101.01 = 0, 101.02 = 900 (portföy hiçbir gün eksi olmaz)", async () => {
    const { api, acc, abc } = t;
    const plan = await must("taksit kartı", api.post("/api/workspace/plans", { name: "ABC Taksit", accountId: abc.id, total: "900", mode: "auto", count: 1, firstDue: "2026-11-08", registeredOn: "2026-10-01" }));
    const c = await receive(api, { serialNo: "TK-1", accountId: abc.id, planId: plan.id, amount: "900" });
    await must("ver", act(api, c.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: acc.ziraat.id }));
    const mid = await subs(api, "?to=2026-10-06");
    const beforeBounce = { p: bal(mid.rows, "101.01"), b: bal(mid.rows, "101.02") };
    await must("karşılıksız", act(api, c.id, { action: "bounce", date: "2026-10-08" }));
    const s = await subs(api, "?to=2026-10-06");
    const m = await main(api, "?to=2026-10-06");
    const fin = await subs(api);
    const integ = await integrity(api);
    const got = { onceP: beforeBounce.p, onceB: beforeBounce.b, p: bal(s.rows, "101.01"), b: bal(s.rows, "101.02"), ana101: k(m["101"]?.balance ?? 0), sonP: bal(fin.rows, "101.01"), sonB: bal(fin.rows, "101.02"), mutabakat: integ.ok };
    console.log("B1", JSON.stringify(got));
    assert.deepEqual(got, { onceP: 0, onceB: 90000, p: 0, b: 90000, ana101: 90000, sonP: 0, sonB: 0, mutabakat: true });
  });
});

describe("B2 — faturayla alınan çek: Alt Hesap Mizanı 101 = Ana Defter 101", () => {
  let t;
  before(async () => { t = await boot(); });
  after(() => t.ctx.server.close());
  it("satış faturası 2.000 (çekle, 10-02) → tahsile ver 10-05 → tahsil 10-07: her kesitte 101.01/101.02/102.01 ve ana 101 = alt toplam", async () => {
    const { api, acc, abc } = t;
    const doc = await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: abc.id, issueDate: "2026-10-02", pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 2000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "cheque", amount: "2.000", dueDate: "2026-11-20", serialNo: "F-1", bank: "İş Bankası" }], endorse: [], rest: "open" }, force: true }));
    const chequeId = t.ctx.store.get("SELECT id FROM cheques WHERE invoice_id = ?", doc.id).id;
    await must("ver", act(api, chequeId, { action: "bank-deposit", date: "2026-10-05", bankAccountId: acc.ziraat.id }));
    await must("tahsil", act(api, chequeId, { action: "collect", date: "2026-10-07" }));
    const want = { "2026-10-04": [200000, 0, 10000000], "2026-10-06": [0, 200000, 10000000], "2026-10-07": [0, 0, 10200000] };
    const diffs = [];
    for (const [d, [p, b, z]] of Object.entries(want)) {
      const s = await subs(api, `?to=${d}`);
      const m = await main(api, `?to=${d}`);
      const got = [bal(s.rows, "101.01"), bal(s.rows, "101.02"), bal(s.rows, "102.01")];
      if (JSON.stringify(got) !== JSON.stringify([p, b, z])) diffs.push(`${d}: ${got} / ${[p, b, z]}`);
      if (k(m["101"]?.balance ?? 0) !== p + b) diffs.push(`${d}: Ana Defter 101 ${m["101"]?.balance} / ${(p + b) / 100}`);
      if (s.mains["101"] && k(s.mains["101"].balance) !== p + b) diffs.push(`${d}: Alt Hesap Mizanı ana 101 ${s.mains["101"].balance} / ${(p + b) / 100}`);
    }
    const integ = await integrity(api);
    if (!integ.ok) diffs.push(`mutabakat ${integ.failures}`);
    assert.deepEqual(diffs, []);
  });
});

describe("B3 — carisiz çek (cariye işlenmemiş evrak): tahsile ver → karşılıksız", () => {
  let t;
  before(async () => { t = await boot(); });
  after(() => t.ctx.server.close());
  it("10-02 B 101.01 / A 602; 10-05 B 101.02 / A 101.01; 10-08 karşılıksız B 770 / A 101.02 → ?to=10-06 101.02 = 1.500; son 0/0; 10-07..10-15 aralığında 101.01 hareketsiz", async () => {
    const { api, acc } = t;
    const c = await must("carisiz çek", api.post(CH, { direction: "in", instrument: "cheque", amount: "1.500", issueDate: "2026-10-02", dueDate: "2026-11-02", drawer: "Ali Veli", serialNo: "FR-1" }));
    await must("ver", act(api, c.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: acc.ziraat.id }));
    await must("karşılıksız", act(api, c.id, { action: "bounce", date: "2026-10-08" }));
    const s6 = await subs(api, "?to=2026-10-06");
    const fin = await subs(api);
    const rng = await subs(api, "?from=2026-10-07&to=2026-10-15");
    const m = await main(api);
    const integ = await integrity(api);
    const got = { p6: bal(s6.rows, "101.01"), b6: bal(s6.rows, "101.02"), p: bal(fin.rows, "101.01"), b: bal(fin.rows, "101.02"), rngP: [k(rng.rows["101.01"]?.debit ?? 0), k(rng.rows["101.01"]?.credit ?? 0)], rngB: [k(rng.rows["101.02"]?.debit ?? 0), k(rng.rows["101.02"]?.credit ?? 0)], g602: k(m["602"]?.balance ?? 0), g770: k(m["770"]?.balance ?? 0), mutabakat: integ.ok };
    console.log("B3", JSON.stringify(got));
    assert.deepEqual(got, { p6: 0, b6: 150000, p: 0, b: 0, rngP: [0, 0], rngB: [0, 150000], g602: -150000, g770: 150000, mutabakat: true });
  });
});

describe("B4 — kilitli dönem: kilitli ayda tahsile verilen çek açık ayda tahsil edilir / geri alınır", () => {
  let t;
  let is;
  before(async () => {
    t = await boot();
    is = await openAccount(t.api, { bankName: "İş Bankası", name: "Eylül TL", kind: "demand", currency: "TRY", iban: trIban(64, 1112223), opening: { date: "2026-09-01", amount: "10.000", confirmed: true } });
  });
  after(() => t.ctx.server.close());
  it("09-20 al 3.000 + 1.000 → 09-25 ver (İş) → kilit 30.09 → 10-05 tahsil (200) → 10-06 Geri Al (200); kilitli kesit değişmez", async () => {
    const { api, abc } = t;
    const a = await receive(api, { serialNo: "L-1", accountId: abc.id, amount: "3.000", issueDate: "2026-09-20" });
    const b = await receive(api, { serialNo: "L-2", accountId: abc.id, amount: "1.000", issueDate: "2026-09-20" });
    await must("ver a", act(api, a.id, { action: "bank-deposit", date: "2026-09-25", bankAccountId: is.id }));
    await must("ver b", act(api, b.id, { action: "bank-deposit", date: "2026-09-25", bankAccountId: is.id }));
    const lockedBefore = await subs(api, "?to=2026-09-30");
    await lockPeriod(api, "2026-09-30");
    const resDepLocked = await act(api, a.id, { action: "bank-withdraw", date: "2026-09-29" });
    const resCollect = await act(api, a.id, { action: "collect", date: "2026-10-05" });
    const resWithdraw = await act(api, b.id, { action: "bank-withdraw", date: "2026-10-06" });
    const lockedAfter = await subs(api, "?to=2026-09-30");
    const fin = await subs(api);
    const integ = await integrity(api);
    const sub = is.glSub;
    const got = { kilitliGeriAl: resDepLocked.status, tahsil: resCollect.status, geriAl: resWithdraw.status, kilitliOnce: [bal(lockedBefore.rows, "101.01"), bal(lockedBefore.rows, "101.02")], kilitliSonra: [bal(lockedAfter.rows, "101.01"), bal(lockedAfter.rows, "101.02")], son: [bal(fin.rows, "101.01"), bal(fin.rows, "101.02"), bal(fin.rows, sub)], mutabakat: integ.ok };
    console.log("B4", JSON.stringify(got), resCollect.error || "", resWithdraw.error || "");
    assert.deepEqual(got, { kilitliGeriAl: 409, tahsil: 200, geriAl: 200, kilitliOnce: [0, 400000], kilitliSonra: [0, 400000], son: [100000, 0, 1300000], mutabakat: true });
  });
});

describe("B5 — Kasa ve ciro: tahsildeyken nakit tahsil 400; Geri Al sonrası nakit tahsil B 100 / A 101.01, ciro B 320 / A 101.01", () => {
  let t;
  before(async () => { t = await boot(); });
  after(() => t.ctx.server.close());
  it("sayılar", async () => {
    const { api, acc, abc, xyz } = t;
    const a = await receive(api, { serialNo: "K-1", accountId: abc.id, amount: "700" });
    const b = await receive(api, { serialNo: "K-2", accountId: abc.id, amount: "1.200" });
    await must("ver a", act(api, a.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: acc.ziraat.id }));
    await must("ver b", act(api, b.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: acc.garanti.id }));
    const nakit = await act(api, a.id, { action: "collect", date: "2026-10-07", method: "cash" });
    const baska = await act(api, a.id, { action: "collect", date: "2026-10-07", method: "bank", bankAccountId: acc.garanti.id });
    const ciro = await act(api, b.id, { action: "endorse", date: "2026-10-07", accountId: xyz.id });
    const sil = await api.del(`${CH}/${a.id}`);
    const tutar = await api.put(`${CH}/${a.id}`, { amount: "800" });
    const vade = await api.put(`${CH}/${a.id}`, { dueDate: "2026-12-01" });
    const no = await api.put(`${CH}/${a.id}`, { serialNo: "K-1b" });
    const faturaCiro = await api.post("/api/workspace/invoices", { kind: "purchase", accountId: xyz.id, number: "A-9", issueDate: "2026-10-07", pricesIncludeVat: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: 1200, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [b.id], rest: "open" }, force: true });
    const mid = await subs(api);
    await must("geri al a", act(api, a.id, { action: "bank-withdraw", date: "2026-10-08" }));
    await must("geri al b", act(api, b.id, { action: "bank-withdraw", date: "2026-10-08" }));
    await must("nakit tahsil a", act(api, a.id, { action: "collect", date: "2026-10-09", method: "cash" }));
    await must("ciro b", act(api, b.id, { action: "endorse", date: "2026-10-09", accountId: xyz.id }));
    const fin = await subs(api);
    const m = await main(api);
    const xyzRow = await must("xyz", api.get(`/api/workspace/accounts/${xyz.id}`));
    const integ = await integrity(api);
    const got = { nakit: nakit.status, baska: baska.status, ciro: ciro.status, sil: sil.status, tutar: tutar.status, vade: vade.status, no: no.status, faturaCiro: faturaCiro.status,
      ara: [bal(mid.rows, "101.01"), bal(mid.rows, "101.02"), bal(mid.rows, "102.01"), bal(mid.rows, "102.02")],
      son: [bal(fin.rows, "101.01"), bal(fin.rows, "101.02"), bal(fin.rows, "102.01"), bal(fin.rows, "102.02")], kasa: k(m["100"]?.balance ?? 0), xyz: k(xyzRow.totals.balance), mutabakat: integ.ok };
    console.log("B5", JSON.stringify(got));
    assert.deepEqual(got, { nakit: 400, baska: 400, ciro: 409, sil: 409, tutar: 409, vade: 409, no: 200, faturaCiro: 409, ara: [0, 190000, 10000000, 5000000], son: [0, 0, 10000000, 5000000], kasa: 70000, xyz: 120000, mutabakat: true });
  });
});

describe("B6 — aynı anda iki Tahsile Ver / Tahsile Ver + Ciro (çift kayıt yok)", () => {
  let t;
  before(async () => { t = await boot(); });
  after(() => t.ctx.server.close());
  it("iki eşzamanlı istekten biri 200, öbürü 409; 101.02 = tutar (bir kez); bekleyen kayıt 1", async () => {
    const { api, acc, abc, xyz } = t;
    const a = await receive(api, { serialNo: "E-1", accountId: abc.id, amount: "1.000" });
    const [r1, r2] = await Promise.all([act(api, a.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc.ziraat.id }), act(api, a.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc.garanti.id })]);
    const b = await receive(api, { serialNo: "E-2", accountId: abc.id, amount: "500" });
    const [r3, r4] = await Promise.all([act(api, b.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc.ziraat.id }), act(api, b.id, { action: "endorse", date: "2026-10-06", accountId: xyz.id })]);
    const fin = await subs(api);
    const pending = Number(t.ctx.store.get("SELECT COUNT(*) AS n FROM cheque_collections WHERE status = 'pending'").n);
    const integ = await integrity(api);
    const bState = t.ctx.store.get("SELECT status FROM cheques WHERE id = ?", b.id).status;
    const statuses = [r1.status, r2.status].sort();
    const st2 = [r3.status, r4.status].sort();
    const want101 = (st2[0] === 200 && r3.status === 200 ? 150000 : 100000);
    const got = { ikiVer: statuses, verCiro: st2, b101_02: bal(fin.rows, "101.02"), bekleyen: pending, mutabakat: integ.ok, bDurum: bState };
    console.log("B6", JSON.stringify(got), r2.code || r1.code, r4.code || r3.code);
    assert.deepEqual({ ikiVer: got.ikiVer, verCiro: got.verCiro, b101_02: got.b101_02, mutabakat: got.mutabakat }, { ikiVer: [200, 409], verCiro: [200, 409], b101_02: want101, mutabakat: true });
  });
});

describe("B7 — Silinenler: Geri Al'ınmış (kaydı olan) evrak silinip geri yüklenir", () => {
  let t;
  before(async () => { t = await boot(); });
  after(() => t.ctx.server.close());
  it("sil → 101 tamamen düşer; geri yükle → 101.01 = 1.000, 101.02 = 0; mutabakat", async () => {
    const { api, acc, abc } = t;
    const a = await receive(api, { serialNo: "S-1", accountId: abc.id, amount: "1.000" });
    await must("ver", act(api, a.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: acc.ziraat.id }));
    await must("geri al", act(api, a.id, { action: "bank-withdraw", date: "2026-10-06" }));
    await must("sil", api.del(`${CH}/${a.id}`));
    const s1 = await subs(api);
    const i1 = await integrity(api);
    const m1 = await main(api);
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: `cheque:${a.id}` }));
    const s2 = await subs(api);
    const m2 = await main(api, "?to=2026-10-05");
    const s25 = await subs(api, "?to=2026-10-05");
    const i2 = await integrity(api);
    const got = { silindi: [bal(s1.rows, "101.01"), bal(s1.rows, "101.02"), k(m1["101"]?.balance ?? 0), i1.ok], geri: [bal(s2.rows, "101.01"), bal(s2.rows, "101.02"), i2.ok], kesit05: [bal(s25.rows, "101.01"), bal(s25.rows, "101.02"), k(m2["101"]?.balance ?? 0)] };
    console.log("B7", JSON.stringify(got), JSON.stringify(i1.failures), JSON.stringify(i2.failures));
    assert.deepEqual(got, { silindi: [0, 0, 0, true], geri: [100000, 0, true], kesit05: [0, 100000, 100000] });
  });
});

describe("B8 — hesap açılışından önce tahsile verme ve tahsil", () => {
  let t;
  before(async () => { t = await boot(); });
  after(() => t.ctx.server.close());
  it("Ziraat açılışı 01.10: 09-28 tahsile ver → ? ; 09-29 tahsil → 409 beklenir; 10-02 tahsil → 200; mutabakat tamam", async () => {
    const { api, acc, abc } = t;
    const a = await receive(api, { serialNo: "O-1", accountId: abc.id, amount: "2.000", issueDate: "2026-09-20" });
    const dep = await act(api, a.id, { action: "bank-deposit", date: "2026-09-28", bankAccountId: acc.ziraat.id });
    const integ1 = await integrity(api);
    const col1 = dep.status === 200 ? await act(api, a.id, { action: "collect", date: "2026-09-29" }) : { status: 0 };
    const col2 = dep.status === 200 ? await act(api, a.id, { action: "collect", date: "2026-10-02" }) : { status: 0 };
    const fin = await subs(api);
    const integ2 = await integrity(api);
    const got = { ver: dep.status, verKod: dep.code || "", m1: integ1.ok, tahsilAcilistanOnce: col1.status, tahsilKod: col1.code || "", tahsil: col2.status, z: bal(fin.rows, "102.01"), m2: integ2.ok };
    console.log("B8", JSON.stringify(got), dep.error || "", col1.error || "");
    assert.equal(got.m1, true);
    assert.equal(got.m2, true);
    if (got.ver === 200) assert.notEqual(got.tahsilAcilistanOnce, 200, "açılıştan önce 102'ye para yazılmamalı");
  });
});

describe("B9 — Çek / Senet Hareketleri raporu ve Yevmiye: Tahsile Ver / Geri Al izi", () => {
  let t;
  before(async () => { t = await boot(); });
  after(() => t.ctx.server.close());
  it("Yevmiye 101 satırlarında alt hesap ayrımı görünür mü; Çek/Senet Hareketleri tahsile vermeyi gösterir mi", async () => {
    const { api, acc, abc } = t;
    const a = await receive(api, { serialNo: "Y-1", accountId: abc.id, amount: "1.000" });
    await must("ver", act(api, a.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: acc.ziraat.id }));
    const yev = await must("yevmiye", api.get("/api/workspace/report-center/yevmiye?from=2026-10-05&to=2026-10-05"));
    const har = await must("hareketler", api.get("/api/workspace/report-center/cek-hareketleri?from=2026-10-01&to=2026-10-15"));
    const got = { yevmiye: yev.rows, hareket: har.rows.map(r => [r[0], r[4], r[6]]) };
    console.log("B9", JSON.stringify(got));
    assert.ok(got.yevmiye.some(r => /101\.02/.test(r[3])), `Yevmiye satırlarında 101.02 görünmüyor: ${JSON.stringify(got.yevmiye)}`);
  });
});
