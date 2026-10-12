// Bağımsız doğrulayıcı tur 2 — Senaryo J: Benzer İşlem (aynı gün aynı tutar iki ayrı evrak), kuruş/büyük tutar, Banka Bakiye Raporu sınıfı
// (tahsil dış Giriş), I1'in İşlem Kartı karşılığı. Beklenen elle (plan §3.14, §3.10 K8 "anahtarda hedef (… çek …)", §8.10). Kod değiştirmez.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { bootBank, must, openAcceptanceAccounts } from "../../../../../test/banka-210-hesap-ortak.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CH = "/api/workspace/cheques";
const k = v => Math.round(Number(v) * 100);
const parseTl = s => (s === "" || s === undefined || s === null ? 0 : Math.round(Number(String(s).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".")) * 100));
const log = {};
let ctx, api, acc, m;
const c = {};
const act = (id, body) => api.post(`${CH}/${c[id].id}/actions`, body);
const receive = async (id, body) => (c[id] = await must(`al ${id}`, api.post(CH, { direction: "in", instrument: "cheque", serialNo: id, accountId: m.id, ...body })));
const report = (id, q = "") => must(`rapor ${id}`, api.get(`/api/workspace/report-center/${id}${q}`));
const subs = async (q = "") => Object.fromEntries((await must("alt hesap", api.get(`/api/workspace/bank/sub-trial${q}`))).rows.map(r => [r.sub, k(r.balance)]));

describe("J — Benzer İşlem, kuruş/büyük tutar, Banka Bakiye sınıfı, İşlem Kartı", () => {
  before(async () => {
    ctx = await bootBank({ now: "2026-10-27T12:00:00+03:00" });
    api = ctx.api;
    acc = await openAcceptanceAccounts(api);
    m = await must("cari", api.post("/api/workspace/accounts", { name: "Delta Yapı", type: "customer", registeredOn: "2026-09-01" }));
  });
  after(() => {
    writeFileSync(path.join(HERE, "gercek-j.json"), JSON.stringify(log, null, 1));
    ctx?.server.close();
  });

  it("J1: aynı cariden aynı tutarlı iki ayrı çek aynı gün aynı hesapta tahsil: ikisi de 200 (Benzer İşlem hedefi farklı evrak)", async () => {
    await receive("B1", { amount: "4.000", issueDate: "2026-10-05", dueDate: "2026-10-26" });
    await receive("B2", { amount: "4.000", issueDate: "2026-10-05", dueDate: "2026-10-26", bank: "Başka Banka" });
    await must("ver B1", act("B1", { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc.ziraat.id }));
    await must("ver B2", act("B2", { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc.ziraat.id }));
    const r1 = await act("B1", { action: "collect", date: "2026-10-26" });
    const r2 = await act("B2", { action: "collect", date: "2026-10-26" });
    log.J1 = [r1, r2].map(r => ({ status: r.status, code: r.code, error: r.error }));
    assert.deepEqual(log.J1.map(r => r.status), [200, 200], JSON.stringify(log.J1));
  });

  it("J2: kuruşlu ve büyük tutarlar: 0,01 ve 987.654.321,99 tahsile ver → tahsil; 101.02 ve 102.02 kuruşu kuruşuna", async () => {
    await receive("K1", { amount: "0,01", issueDate: "2026-10-05", dueDate: "2026-10-20" });
    await receive("K2", { amount: "987.654.321,99", issueDate: "2026-10-05", dueDate: "2026-11-20" });
    await must("ver K1", act("K1", { action: "bank-deposit", date: "2026-10-07", bankAccountId: acc.garanti.id }));
    await must("ver K2", act("K2", { action: "bank-deposit", date: "2026-10-07", bankAccountId: acc.garanti.id }));
    const mid = await subs();
    await must("tahsil K1", act("K1", { action: "collect", date: "2026-10-20" }));
    const end = await subs();
    const integ = await must("Mutabakat", api.get("/api/workspace/ledger/integrity"));
    const tah = await report("tahsildeki-cekler");
    log.J2 = { mid, end, ok: integ.ok, tah: tah.summary };
    assert.deepEqual(
      { mid102: mid["101.02"], end102: end["101.02"], garanti: end["102.02"], ok: integ.ok, tah: parseTl(tah.summary.find(x => /101\.02/.test(x[0]))?.[1]) },
      { mid102: 98765432200, end102: 98765432199, garanti: 5000000 + 1, ok: true, tah: 98765432199 },
    );
  });

  it("J3: Banka Bakiye Raporu (Ekim): tahsildeki evrakın tahsili dış Giriş; tahsile ver/geri al hiçbir kolona girmez", async () => {
    const r = await report("banka-bakiye", "?from=2026-10-01&to=2026-10-31");
    log.J3 = { headers: r.headers, rows: r.rows };
    const row = name => r.rows.find(x => x[1] === acc[name].bankName && x[2] === acc[name].name);
    const z = row("ziraat");
    const g = row("garanti");
    // Ziraat: Dönem Başı 0, Açılış ve Devir Düzeltmesi 100.000, Giriş 8.000 (B1 + B2), Dönem Sonu 108.000. Garanti: Giriş 0,01, Dönem Sonu 50.000,01.
    assert.deepEqual([parseTl(z[5]), parseTl(z[7]), parseTl(z[10])], [800000, 0, 10800000], JSON.stringify(z));
    assert.deepEqual([parseTl(g[5]), parseTl(g[7]), parseTl(g[10])], [1, 0, 5000001], JSON.stringify(g));
  });

  it("J4: İşlem Kartı — geri alınmış evrakın tutarı düzeltildikten sonra Tahsile Ver kartı ile Çek / Senet Hareketleri aynı tutarı mı gösteriyor", async () => {
    await receive("E1", { amount: "1.000", issueDate: "2026-10-14", dueDate: "2026-11-05" });
    await must("ver", act("E1", { action: "bank-deposit", date: "2026-10-15", bankAccountId: acc.ziraat.id }));
    await must("geri", act("E1", { action: "bank-withdraw", date: "2026-10-16" }));
    await must("düzelt", api.put(`${CH}/${c.E1.id}`, { amount: "1.250" }));
    const ev = ctx.store.get("SELECT no FROM fin_events WHERE type = 'cheque_deposit' AND cheque_id = ?", c.E1.id);
    const card = await must("İşlem Kartı", api.get(`/api/workspace/bank/events/${ev.no}`));
    const rep = (await report("cek-hareketleri", "?from=2026-10-15&to=2026-10-15")).rows.filter(x => x[2] === "E1").map(x => [x[4], parseTl(x[6])]);
    const detail = await must("evrak kartı", api.get(`${CH}/${c.E1.id}`));
    log.J4 = { card: { amount: card.amountMinor ?? card.tryMinor ?? card.amount, lines: card.lines?.map(l => [l.sub, l.side, l.tryMinor]) }, rep, collections: detail.collections };
    const cardMinor = card.lines?.find(l => l.side === "D")?.tryMinor;
    assert.equal(rep[0]?.[1], cardMinor, `Çek / Senet Hareketleri ${rep[0]?.[1] / 100} ↔ İşlem Kartı ${cardMinor / 100}`);
  });
});
