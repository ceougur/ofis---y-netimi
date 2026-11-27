// 2.5.1 D3 TUR 2 — EVRAKIN K'DEKİ DURUMU (tasarım §3.8 "Çek / senet", §3.3; tur 1 nasıl bozulur 4 / 28 ve DOĞRULANMADI). Veri programın KENDİ API'sinden, beklenen sayılar ELLE.
// Koddaki bütün durumlar (lib/cheques.mjs STATUSES: portfolio, endorsed, collected, bounced, pending, paid; lib/bank/collections.mjs: bankada tahsilde / tahsil / geri alındı) en az bir satırla.
// "Teminata verilmiş" durumu programda YOK (sınanamaz — raporda). K = 31.12.2026, bugün 10.02.2027.
//   Alınan (X müşterisinden; tutar, alış, vade → K'deki durum):
//     E1 çek 1.000 (01.11, vade 01.02.2027) portföyde → portfolio 101.01 (vade K'den sonra aynen)
//     E2 senet 500 (02.11, vade 15.01.2027) portföyde → portfolio 121.01
//     E3 çek 700 (03.11) 10.12 bankaya tahsile → bank 101.02
//     E4 çek 600 (04.11) 11.12 tahsile, 06.01.2027 tahsil edildi → K'de bank 101.02 (sonraki olay sayılmaz)
//     E5 çek 400 (05.11) 12.12 tahsile, 20.12 tahsil edildi → listede YOK (kapandı)
//     E6 çek 300 (06.11) 01.12 Y'ye ciro → endorsed (defter bakiyesi yok)
//     E7 çek 250 (07.11) 02.12 Y'ye ciro, 10.01.2027 karşılıksız → K'de endorsed
//     E8 çek 350 (Z müşterisinden, 08.11) 15.12 karşılıksız → bounced (Z'nin bakiyesi 0: alış alacağı ↔ karşılıksız borcu)
//     E9 çek 450 (09.11) 12.01.2027 tahsil edildi (Kasa) → K'de portfolio 101.01
//     E10 çek 200 (10.11) 05.12 tahsile, 20.12 bankadan geri alındı → portfolio 101.01
//     E11 çek 150 (05.01.2027 alındı) → listede YOK (K'den sonra)
//     E12 çek 100 (11.11) silindi → listede YOK
//     E13 çek 120 (12.11) 01.12 tahsil edildi, Geri Al → portfolio 101.01
//   Verilen (Y tedarikçisine): O1 çek 800 (15.11, vade 20.01.2027) → pending 103 · O2 senet 300 (16.11) → pending 321 · O3 çek 200 (17.11) 18.12 ödendi → YOK ·
//     O4 çek 500 (18.11) 21.01.2027 ödendi → K'de pending 103.
//   ELLE: portföy 5 adet 2.270,00 (E1 1.000 + E2 500 + E9 450 + E10 200 + E13 120) · tahsilde 2 adet 1.300,00 · ciroda 2 adet 550,00 · karşılıksız 1 adet 350,00 · verilen ödenmemiş 3 adet
//     1.600,00. Defter: 101.01 = 1.770,00 · 121.01 = 500,00 · 101.02 = 1.300,00 · 103 = −1.300,00 · 321 = −300,00 — modül açılışı = arşiv kapanışı (modül farkı YOK).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const K = "2026-12-31";

async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 tur 2 — evrakın K'deki durumu (çek / senet, alınan / verilen, bankada tahsil, ciro, karşılıksız, K sonrası değişen)", () => {
  let ctx;
  let api;
  let job;
  const ids = {};
  let serial = 0;
  const receive = async (name, account, amount, issueDate, dueDate, instrument = "cheque") => {
    ids[name] = (await must(name, api.post("/api/workspace/cheques", { direction: "in", instrument, accountId: account, amount, issueDate, dueDate, serialNo: `EVR-${(serial += 1)}`, bank: "Ziraat" }))).id;
  };
  const give = async (name, amount, issueDate, dueDate, instrument = "cheque") => {
    ids[name] = (await must(name, api.post("/api/workspace/cheques", { direction: "out", instrument, accountId: ids.y, amount, issueDate, dueDate, serialNo: `VER-${(serial += 1)}`, bank: "Ziraat" }))).id;
  };
  const act = (label, name, body) => must(label, api.post(`/api/workspace/cheques/${ids[name]}/actions`, { method: "cash", cashForce: true, ...body }));
  before(async () => {
    ctx = await boot({ now: { time: "2027-02-10T12:00:00+03:00", fixed: true } });
    api = ctx.api;
    ids.x = (await must("X", api.post("/api/workspace/accounts", { name: "Evrak Müşterisi", type: "customer" }))).id;
    ids.z = (await must("Z", api.post("/api/workspace/accounts", { name: "Karşılıksız Müşterisi", type: "customer" }))).id;
    ids.y = (await must("Y", api.post("/api/workspace/accounts", { name: "Evrak Tedarikçisi", type: "supplier" }))).id;
    ids.bank = (await must("banka", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Tahsil Hesabı", kind: "demand", currency: "TRY", useCheque: true, useNote: true, opening: { date: "2026-01-01", amount: "0", confirmed: true } }))).id;
    await receive("e1", ids.x, "1000", "2026-11-01", "2027-02-01");
    await receive("e2", ids.x, "500", "2026-11-02", "2027-01-15", "note");
    await receive("e3", ids.x, "700", "2026-11-03", "2026-12-30");
    await receive("e4", ids.x, "600", "2026-11-04", "2027-01-05");
    await receive("e5", ids.x, "400", "2026-11-05", "2026-12-20");
    await receive("e6", ids.x, "300", "2026-11-06", "2027-01-20");
    await receive("e7", ids.x, "250", "2026-11-07", "2027-01-08");
    await receive("e8", ids.z, "350", "2026-11-08", "2026-12-15");
    await receive("e9", ids.x, "450", "2026-11-09", "2027-01-12");
    await receive("e10", ids.x, "200", "2026-11-10", "2027-01-25");
    await receive("e12", ids.x, "100", "2026-11-11", "2027-01-25");
    await receive("e13", ids.x, "120", "2026-11-12", "2027-01-25");
    await give("o1", "800", "2026-11-15", "2027-01-20");
    await give("o2", "300", "2026-11-16", "2027-01-20", "note");
    await give("o3", "200", "2026-11-17", "2026-12-18");
    await give("o4", "500", "2026-11-18", "2027-01-21");
    await act("E6 ciro", "e6", { action: "endorse", date: "2026-12-01", accountId: ids.y });
    await act("E13 tahsil", "e13", { action: "collect", date: "2026-12-01" });
    await must("E13 geri al", api.post(`/api/workspace/cheques/${ids.e13}/undo`, {}));
    await act("E7 ciro", "e7", { action: "endorse", date: "2026-12-02", accountId: ids.y });
    await act("E10 tahsile", "e10", { action: "bank-deposit", date: "2026-12-05", bankAccountId: ids.bank });
    await act("E3 tahsile", "e3", { action: "bank-deposit", date: "2026-12-10", bankAccountId: ids.bank });
    await act("E4 tahsile", "e4", { action: "bank-deposit", date: "2026-12-11", bankAccountId: ids.bank });
    await act("E5 tahsile", "e5", { action: "bank-deposit", date: "2026-12-12", bankAccountId: ids.bank });
    await act("E8 karşılıksız", "e8", { action: "bounce", date: "2026-12-15" });
    await act("O3 ödendi", "o3", { action: "pay", date: "2026-12-18" });
    await act("E5 tahsil", "e5", { action: "collect", date: "2026-12-20", method: "bank" });
    await act("E10 geri al", "e10", { action: "bank-withdraw", date: "2026-12-20" });
    await must("E12 sil", api.del(`/api/workspace/cheques/${ids.e12}`));
    // ---- K'den sonra ----
    await receive("e11", ids.x, "150", "2027-01-05", "2027-02-05");
    await act("E4 tahsil", "e4", { action: "collect", date: "2027-01-06", method: "bank" });
    await act("E7 karşılıksız", "e7", { action: "bounce", date: "2027-01-10" });
    await act("E9 tahsil", "e9", { action: "collect", date: "2027-01-12" });
    await act("O4 ödendi", "o4", { action: "pay", date: "2027-01-21" });
    job = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
  });
  after(() => ctx?.server.close());

  const nameOf = id => Object.entries(ids).find(([, value]) => value === id)?.[0] || id;

  it("her evrak K'deki durumuyla (elle): durum, hesap / alt hesap, tutar, vade; kapanmış / K sonrası alınmış / silinmiş evrak YOK; K sonrası olay K durumunu değiştirmez", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const got = job.result.plan.newYear.evraklar.map(row => [nameOf(row.evrak), row.yon, row.tur, row.durum, row.hesap, row.alt, row.minor, row.vade, nameOf(row.cari)]).sort();
    const want = [
      ["e1", "in", "cek", "portfolio", "101", "101.01", 100000, "2027-02-01", "x"],
      ["e10", "in", "cek", "portfolio", "101", "101.01", 20000, "2027-01-25", "x"],
      ["e13", "in", "cek", "portfolio", "101", "101.01", 12000, "2027-01-25", "x"],
      ["e2", "in", "senet", "portfolio", "121", "121.01", 50000, "2027-01-15", "x"],
      ["e3", "in", "cek", "bank", "101", "101.02", 70000, "2026-12-30", "x"],
      ["e4", "in", "cek", "bank", "101", "101.02", 60000, "2027-01-05", "x"],
      ["e6", "in", "cek", "endorsed", "", "", 30000, "2027-01-20", "x"],
      ["e7", "in", "cek", "endorsed", "", "", 25000, "2027-01-08", "x"],
      ["e8", "in", "cek", "bounced", "", "", 35000, "2026-12-15", "z"],
      ["e9", "in", "cek", "portfolio", "101", "101.01", 45000, "2027-01-12", "x"],
      ["o1", "out", "cek", "pending", "103", "", 80000, "2027-01-20", "y"],
      ["o2", "out", "senet", "pending", "321", "", 30000, "2027-01-20", "y"],
      ["o4", "out", "cek", "pending", "103", "", 50000, "2027-01-21", "y"],
    ].sort();
    assert.deepEqual(got, want);
  });

  it("ön izleme sayıları (elle): portföy 5 / 2.270,00 · tahsilde 2 / 1.300,00 · ciroda 2 / 550,00 · karşılıksız 1 / 350,00 · verilen ödenmemiş 3 / 1.600,00", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.deepEqual(job.result.plan.sayilar.evrak, { portfolio: { adet: 5, minor: 227000 }, bank: { adet: 2, minor: 130000 }, endorsed: { adet: 2, minor: 55000 }, bounced: { adet: 1, minor: 35000 }, pending: { adet: 3, minor: 160000 } });
  });

  it("kapanış = açılış (elle): 101.01 1.770,00 · 121.01 500,00 · 101.02 1.300,00 · 103 −1.300,00 · 321 −300,00; modül farkı YOK; Z'nin bakiyesi 0 ve satırı yok", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const cells = Object.fromEntries(job.result.plan.archive.kapanisBakiyeleri.filter(row => ["101", "103", "121", "321"].includes(row.hesap)).map(row => [`${row.hesap}|${row.alt}|${row.cari}`, row.minor]));
    assert.deepEqual(cells, { "101|101.01|": 177000, "101|101.02|": 130000, "103||": -130000, "121|121.01|": 50000, "321||": -30000 });
    assert.deepEqual(job.result.plan.sorunlar, []);
    assert.deepEqual(job.result.plan.degismezler.filter(row => !row.ok), []);
    const z = job.result.plan.newYear.cariler.find(row => row.cari === ids.z);
    assert.deepEqual([z.kBakiyeMinor, z.satirlar.length], [0, 0]);
  });
});
