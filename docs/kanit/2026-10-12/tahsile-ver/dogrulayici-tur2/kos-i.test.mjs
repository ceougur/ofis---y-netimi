// Bağımsız doğrulayıcı tur 2 — Senaryo I: komşu yollar (tutar düzeltme, sil + geri yükle, fatura iptali, kilit, yarım gün ayarı, geç verilen
// evrak, aynı gün zincir, bankada karşılıksız). Beklenen değerler plan §3.14 yevmiyesinden elle (yorumda); programın kodu kullanılmaz.
// Sahte saat 27.10.2026 Salı. Kod değiştirmez.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { bootBank, lockPeriod, must, openAcceptanceAccounts } from "../../../../../test/banka-210-hesap-ortak.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CH = "/api/workspace/cheques";
const k = v => Math.round(Number(v) * 100);
const parseTl = s => (s === "" || s === undefined || s === null ? 0 : Math.round(Number(String(s).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".")) * 100));
const log = {};
let ctx, api, acc, m3;
const c = {};
const act = (id, body) => api.post(`${CH}/${c[id].id}/actions`, body);
const receive = async (id, body) => (c[id] = await must(`al ${id}`, api.post(CH, { direction: "in", instrument: "cheque", serialNo: id, accountId: m3.id, ...body })));
const report = (id, q = "") => must(`rapor ${id}`, api.get(`/api/workspace/report-center/${id}${q}`));
const subs = async (q = "") => Object.fromEntries((await must("alt hesap", api.get(`/api/workspace/bank/sub-trial${q}`))).rows.map(r => [r.sub, k(r.balance)]));
const yevmiye = async d => (await report("yevmiye", `?from=${d}&to=${d}`)).rows.map(r => [r[3], parseTl(r[4]), parseTl(r[5])]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const sorted = list => [...list].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const integrity = async () => must("Mutabakat", api.get("/api/workspace/ledger/integrity"));

describe("I — komşu yollar", () => {
  before(async () => {
    ctx = await bootBank({ now: "2026-10-27T12:00:00+03:00" });
    api = ctx.api;
    acc = await openAcceptanceAccounts(api);
    m3 = await must("cari", api.post("/api/workspace/accounts", { name: "M3 Ticaret", type: "customer", registeredOn: "2026-09-01" }));
  });
  after(() => {
    writeFileSync(path.join(HERE, "gercek-i.json"), JSON.stringify(log, null, 1));
    ctx?.server.close();
  });

  it("I1: Geri alınmış evrakın tutarı düzeltilince (1.000 → 1.250) Yevmiye ve Çek / Senet Hareketleri tahsile verme tutarında anlaşır", async () => {
    await receive("X1", { amount: "1.000", issueDate: "2026-10-14", dueDate: "2026-11-05" });
    await must("ver", act("X1", { action: "bank-deposit", date: "2026-10-15", bankAccountId: acc.ziraat.id }));
    await must("geri al", act("X1", { action: "bank-withdraw", date: "2026-10-16" }));
    const put = await api.put(`${CH}/${c.X1.id}`, { amount: "1.250" });
    log.I1put = { status: put.status, code: put.code, error: put.error };
    assert.equal(put.status, 200, `tutar düzeltme: ${put.status} ${put.error}`);
    // Beklenen (plan §3.14): 15.10 B 101.02 / A 101.01, 16.10 B 101.01 / A 101.02 — aynı tutar; 101.01 = 1.250 (portföy).
    const y15 = await yevmiye("2026-10-15");
    const y16 = await yevmiye("2026-10-16");
    const s = await subs();
    const hareket = (await report("cek-hareketleri", "?from=2026-10-14&to=2026-10-16")).rows.map(r => [r[0], r[4], parseTl(r[6])]);
    log.I1 = { y15, y16, s, hareket };
    assert.equal(s["101.01"], 125000, "101.01 = 1.250");
    const deposit = y15.find(r => r[0] === "101.02")?.[1];
    const rows = hareket.filter(r => /Bankaya|Bankadan/.test(r[1]));
    assert.deepEqual(rows.map(r => r[2]), [deposit, deposit], `Çek / Senet Hareketleri tahsile verme/geri alma tutarı ${JSON.stringify(rows)} ↔ Yevmiye ${deposit / 100}`);
  });

  it("I2: Geri alınmış evrakı sil → geri yükle: 101.01 / 101.02 ve Mutabakat; yeniden tahsile verilebilir", async () => {
    const before = await subs();
    const del = await api.del(`${CH}/${c.X1.id}`);
    log.I2del = { status: del.status, code: del.code, error: del.error };
    assert.equal(del.status, 200, `sil: ${del.error}`);
    const afterDel = await subs();
    const i1 = await integrity();
    // Beklenen: evrak yok → 101.01 1.250 azalır, 101.02 değişmez (0); Mutabakat tamam.
    assert.equal((afterDel["101.01"] || 0), (before["101.01"] || 0) - 125000);
    assert.equal((afterDel["101.02"] || 0), (before["101.02"] || 0));
    assert.equal(i1.ok, true, JSON.stringify(i1.failures));
    const res = await api.post("/api/admin/trash/restore", { id: `cheque:${c.X1.id}` });
    log.I2restore = { status: res.status, code: res.code, error: res.error };
    assert.equal(res.status, 200, `geri yükle: ${res.error}`);
    const afterRestore = await subs();
    assert.deepEqual([afterRestore["101.01"] || 0, afterRestore["101.02"] || 0], [before["101.01"] || 0, before["101.02"] || 0]);
    const i2 = await integrity();
    assert.equal(i2.ok, true, JSON.stringify(i2.failures));
    const again = await act("X1", { action: "bank-deposit", date: "2026-10-27", bankAccountId: acc.garanti.id });
    assert.equal(again.status, 200, `yeniden tahsile ver: ${again.error}`);
  });

  it("I4: Fatura ile alınan evrak tahsildeyken fatura iptali 409; geri alınınca iptal 200 ve evrak defterden çıkar", async () => {
    const inv = await must("fatura", api.post("/api/workspace/invoices", { kind: "sale", accountId: m3.id, issueDate: "2026-10-12", pricesIncludeVat: false, lines: [{ name: "Hizmet", qty: 1, unitPrice: 500, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "cheque", amount: "500", dueDate: "2026-11-06", serialNo: "Z1", bank: "Akbank" }], endorse: [], rest: "open" }, force: true }));
    c.Z1 = (await must("liste", api.get(`${CH}?q=Z1`))).cheques.find(x => x.serialNo === "Z1");
    await must("ver", act("Z1", { action: "bank-deposit", date: "2026-10-13", bankAccountId: acc.garanti.id }));
    const blocked = await api.post(`/api/workspace/invoices/${inv.id}/cancel`, {});
    log.I4blocked = { status: blocked.status, code: blocked.code, error: blocked.error };
    assert.equal(blocked.status, 409);
    assert.equal(blocked.code, "cheque-deposited");
    await must("geri al", act("Z1", { action: "bank-withdraw", date: "2026-10-14" }));
    const before = await subs();
    const okCancel = await api.post(`/api/workspace/invoices/${inv.id}/cancel`, {});
    log.I4cancel = { status: okCancel.status, code: okCancel.code, error: okCancel.error };
    assert.equal(okCancel.status, 200, okCancel.error);
    const afterCancel = await subs();
    assert.equal((afterCancel["101.01"] || 0), (before["101.01"] || 0) - 50000, "101.01 500 azalır");
    assert.equal((afterCancel["101.02"] || 0), (before["101.02"] || 0), "101.02 değişmez");
    const i = await integrity();
    assert.equal(i.ok, true, JSON.stringify(i.failures));
  });

  it("I5: Yarım gün (arife) 'İş Günü Sayılmaz' seçilince vadesi 28.10 olan tahsildeki evrak 30.10'da beklenir — Nakit Akış, Vade Takip, Zil, Tahsildeki raporu aynı", async () => {
    await receive("W1", { amount: "700", issueDate: "2026-10-20", dueDate: "2026-10-28" });
    await must("ver", act("W1", { action: "bank-deposit", date: "2026-10-21", bankAccountId: acc.ziraat.id }));
    const read = async () => {
      const na = (await must("akış", api.get("/api/workspace/overview/nakit-akisi?from=2026-10-27&to=2026-11-30&table=0"))).rows.find(r => /No W1/.test(r.label))?.date;
      const vt = (await must("vade", api.get("/api/workspace/overview/vade-takip?preset=open&sources=cheque"))).rows.find(r => /No W1/.test(r.label))?.date;
      const zil = (await must("dues", api.get("/api/workspace/dues"))).items.find(r => /No W1/.test(r.label))?.dueDate;
      const rep = (await report("tahsildeki-cekler")).rows.find(r => r[3] === "W1")?.[6];
      return { na, vt, zil, rep };
    };
    const first = await read();
    log.I5first = first;
    assert.deepEqual(first, { na: "2026-10-28", vt: "2026-10-28", zil: "2026-10-28", rep: "28.10.2026" }, "varsayılan: arife iş günü");
    await must("ayar", api.put("/api/workspace/bank/settings", { values: { holidayAdvanced: { halfDay: "holiday" } } }));
    const second = await read();
    log.I5second = second;
    assert.deepEqual(second, { na: "2026-10-30", vt: "2026-10-30", zil: "2026-10-30", rep: "30.10.2026" }, "arife iş günü sayılmaz: 28.10 → 30.10 (29.10 tatil)");
    await must("ayar geri", api.put("/api/workspace/bank/settings", { values: { holidayAdvanced: { halfDay: "business" } } }));
  });

  it("I6: Vadesinden sonra (Cumartesi) tahsile verilen evrak: beklenen = veriliş gününden sonraki iş günü (26.10), gecikmiş", async () => {
    await receive("V1", { amount: "300", issueDate: "2026-10-10", dueDate: "2026-10-17" });
    await must("ver", act("V1", { action: "bank-deposit", date: "2026-10-24", bankAccountId: acc.garanti.id }));
    const na = await must("akış", api.get("/api/workspace/overview/nakit-akisi?from=2026-10-27&to=2026-11-30&table=0"));
    const over = na.overdue.find(r => /No V1/.test(r.label));
    const vt = (await must("vade", api.get("/api/workspace/overview/vade-takip?preset=open&sources=cheque"))).rows.find(r => /No V1/.test(r.label));
    const zil = (await must("dues", api.get("/api/workspace/dues"))).items.find(r => /No V1/.test(r.label));
    log.I6 = { over: over && { date: over.date, amount: over.amount }, vt: vt && { date: vt.date, state: vt.state, days: vt.days }, zil: zil && { due: zil.dueDate, state: zil.state, days: zil.days } };
    assert.deepEqual(log.I6, { over: { date: "2026-10-26", amount: 300 }, vt: { date: "2026-10-26", state: "overdue", days: -1 }, zil: { due: "2026-10-26", state: "overdue", days: -1 } });
  });

  it("I7: Aynı gün zincir (al → Ziraat'e ver → geri al → Garanti'ye ver → tahsil): Yevmiye 22.10 = plan maddeleri; Garanti +900", async () => {
    const g0 = Number((await must("hesap", api.get(`/api/workspace/bank/accounts/${acc.garanti.id}`))).balanceMinor);
    await receive("U1", { amount: "900", issueDate: "2026-10-22", dueDate: "2026-10-22" });
    await must("ver", act("U1", { action: "bank-deposit", date: "2026-10-22", bankAccountId: acc.ziraat.id }));
    await must("geri", act("U1", { action: "bank-withdraw", date: "2026-10-22" }));
    await must("ver 2", act("U1", { action: "bank-deposit", date: "2026-10-22", bankAccountId: acc.garanti.id }));
    await must("tahsil", act("U1", { action: "collect", date: "2026-10-22" }));
    const y = await yevmiye("2026-10-22");
    log.I7 = y;
    const want = sorted([["101.01", 90000, 0], ["120", 0, 90000], ["101.02", 90000, 0], ["101.01", 0, 90000], ["101.01", 90000, 0], ["101.02", 0, 90000], ["101.02", 90000, 0], ["101.01", 0, 90000], [acc.garanti.glSub, 90000, 0], ["101.02", 0, 90000]]);
    assert.deepEqual(y, want);
    const g1 = Number((await must("hesap", api.get(`/api/workspace/bank/accounts/${acc.garanti.id}`))).balanceMinor);
    assert.equal(g1 - g0, 90000);
  });

  it("I3: Dönem kilidi 20.10: kilitli güne geri alma 409; açık günde karşılıksız (bankada) ve tahsil; 20.10 kesiti değişmez", async () => {
    await receive("Y1", { amount: "2.000", issueDate: "2026-10-10", dueDate: "2026-10-26" });
    await must("ver", act("Y1", { action: "bank-deposit", date: "2026-10-12", bankAccountId: acc.ziraat.id }));
    await lockPeriod(api, "2026-10-20");
    const slice = async () => ({ subs: await subs("?to=2026-10-20"), trial: Object.fromEntries((await must("mizan", api.get("/api/workspace/ledger?to=2026-10-20"))).trial.accounts.map(r => [r.code, k(r.balance)])) });
    const s0 = await slice();
    const locked = await act("Y1", { action: "bank-withdraw", date: "2026-10-19" });
    log.I3locked = { status: locked.status, code: locked.code, error: locked.error };
    assert.equal(locked.status, 409);
    const m0 = k((await must("cari", api.get(`/api/workspace/accounts/${m3.id}`))).totals.balance);
    await must("karşılıksız", act("Y1", { action: "bounce", date: "2026-10-27" }));
    const m1 = k((await must("cari", api.get(`/api/workspace/accounts/${m3.id}`))).totals.balance);
    assert.equal(m1 - m0, 200000, "cari +2.000");
    await must("X1 tahsil", act("X1", { action: "collect", date: "2026-10-27" }));
    const s1 = await slice();
    log.I3 = { s0, s1 };
    assert.deepEqual(s1, s0, "kilitli dönem kesiti değişti");
  });

  it("Son durum (elle beklenen): 101.01 0 · 101.02 1.000 (W1 700 + V1 300) · 102.01 100.000 · 102.02 52.150 (U1 900 + X1 1.250) · 100 0 · cari M3 −3.150 · Mutabakat tamam", async () => {
    const s = await subs();
    const t = Object.fromEntries((await must("mizan", api.get("/api/workspace/ledger"))).trial.accounts.map(r => [r.code, k(r.balance)]));
    const m = k((await must("cari", api.get(`/api/workspace/accounts/${m3.id}`))).totals.balance);
    const i = await integrity();
    const tah = await report("tahsildeki-cekler");
    log.son = { s, t, m, ok: i.ok, failures: i.failures, tah: tah.summary };
    assert.deepEqual(
      { "101.01": s["101.01"] || 0, "101.02": s["101.02"] || 0, "102.01": s["102.01"], "102.02": s["102.02"], 100: t["100"] || 0, m3: m, ok: i.ok, tah: parseTl(tah.summary.find(x => /101\.02/.test(x[0]))?.[1]) },
      { "101.01": 0, "101.02": 100000, "102.01": 10000000, "102.02": 5215000, 100: 0, m3: -315000, ok: true, tah: 100000 },
    );
  });
});
