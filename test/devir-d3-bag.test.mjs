// 2.5.1 D3 TUR 2 — K'den SONRA yazılmış, K'den ÖNCEKİ belgeye BAĞLI kayıtlar (bağ yönlendirmesi; docs/devir/D3-D4-TASARIM.md §3.5 madde 7, G2, karar 28 = A, S24 = A) ve
// K günü / K+1 günü aynı tutarlı iki kayıt (tur 1 nasıl bozulur 9). Veri programın KENDİ API'sinden; beklenen sayılar ELLE (aşağıda). D3 HİÇBİR ŞEY YAZMAZ.
//
// Saat: ≤K veri 05.01.2027 10:00'da yazılır → 05.01.2027 11:00'da Dönem Kilidi K (31.12.2026) → K sonrası veri 10.02.2027 12:00'de (S24 = A: Ocak'ta devirden önce yazılmış bağ
// K kilidiyle değerlendirilir — devirsiz eşi "aynı kilitle", tasarım §3.12). Her cari tek senaryo (elle hesap kolay olsun):
//   A1 (a1): F1 satış 1.000,00 (01.11.2026, vade 01.12) · 10.01.2027 tahsilat 400,00 "Kapatılacak Fatura" F1. K: açık kalem inv:F1 1.000,00 (Ocak tahsilatı düşmez).
//   A2 (a2): F2 satış 500,00 (05.11, vade 10.11) · F2b satış 300,00 (06.11, vade 15.12) · 20.11 tahsilat 500,00 bağsız (S2: vadesi önce gelen F2'yi kapatır) · 12.01.2027 tahsilat
//            500,00 F2'ye bağlı. K: F2 kapalı, F2b açık 300,00 → bağ F2 için ARŞİV BAŞVURUSU (no + tarih); kilitli dönemde bağsız kapanmış F2 açılmaz (karar (3)) → Ocak tahsilatı
//            bağsız gibi: F2b 300,00'ü 12.01'de kapatır, 200,00 avans (gecikmiş bugünkü kalanlardan → 0).
//   A3 (a3, a9): F3 satış 800,00 (05.12, vade 05.01.2027) · 20.12 tahsilat 300,00 F3'e bağlı (iki taraf ≤K → bağ listesinde YOK) · 08.01.2027 tahsilat 500,00 F3'e bağlı.
//            K: açık kalem inv:F3 500,00; bağ yalnız 08.01 satırı.
//   A4 (a6): F5 satış 2 × 300,00 = 600,00 (10.12, vade 10.01.2027) · 18.01.2027 iade faturası 1 adet (300,00) asıl F5. K: açık kalem inv:F5 600,00; iade → asıl fatura bağı listede.
//   A5 (a7): F6 satış 400,00 (15.12, vade 25.12) · 05.01.2027 çek 400,00 alındı, Kapatılacak Fatura F6. K: açık kalem inv:F6 400,00; olay bağı listede.
//   A6 (a8): F7 satış 200,00 (18.12, vade 18.12) · 07.01.2027 banka havalesi 200,00 F7'ye bağlı. K: açık kalem inv:F7 200,00; bağ listede.
//   A7 (a10): F8 satış 150,00 (15.01.2027) · 20.01.2027 tahsilat 150,00 F8'e bağlı (iki taraf >K → listede YOK). K: carinin bakiyesi 0, satır YOK.
//   B1 (a4; "Diğer" cari): FB1 satış 700,00 (01.12, vade 20.12) · FB2 alış 200,00 (02.12) · 15.01.2027 Mahsup Et FB1 ↔ FB2 200,00 (iki belge ≤K). K (net görünüm, karar (5)):
//            FB2 FB1'i netler → açık kalem FB1 500,00; mahsup aynı çifti eşler — devirli = devirsiz.
//   B2 (a5; "Diğer" cari): FB5 satış 400,00 (02.12, vade 20.12) · FB4 alış 150,00 (03.12) · FB3 satış 300,00 (16.01.2027, vade 30.01) · 17.01.2027 Mahsup Et FB3 ↔ FB4 150,00
//            (belge >K, KARŞI belge ≤K). K: FB4 FB5'i netler → açık kalem FB5 250,00. Devirsiz (Mahsup zamandan bağımsız, karar (2)): FB4 mahsuba ayrılır → FB5 400,00, FB3 150,00.
//            Devirli: FB4 arşivde (bağ = arşiv başvurusu) → FB5 250,00, FB3 300,00 — bakiye aynı (550,00), gecikmiş 01.01–29.01 FARKLI (250 ↔ 400) → KULLANICIYA SORULMALI (rapor S-T2-1).
//   A8 (bağın dişi): G1 satış 300,00 (01.10, vade 01.11) · F9 satış 1.000,00 (02.11, vade 01.12) · 10.01.2027 tahsilat 400,00 F9'a bağlı. Devirsiz: F9 600,00 + G1 300,00 açık
//            (11.01 gecikmiş 900,00). Bağ yönlendirilmezse Ocak tahsilatı bağsız gibi önce G1'i kapatır (kalemler ayrışır).
//   H1 (h1): 31.12.2026 Borç Yaz 250,00 + 01.01.2027 Borç Yaz 250,00 · 31.12 tahsilat 100,00 + 01.01 tahsilat 100,00 → K bakiyesi 150,00 (yalnız 31.12'ler); açık kalem Borç Yaz 150,00.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const fixture = await import("./fixtures/devir-d3-esdeger.mjs");
const K = "2026-12-31";
const pay = { cash: [], cheques: [], endorse: [], rest: "open" };
const line = (price, qty = 1) => [{ name: "Hizmet", qty, unitPrice: price, discountRate: 0, vatRate: 0 }];

async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 tur 2 — K sonrası bağlar (bağ yönlendirmesi) ve K / K+1 aynı tutarlı kayıtlar", () => {
  let ctx;
  let api;
  let job;
  const ids = {};
  const sale = async (label, account, issueDate, price, dueDate, qty = 1) => (await must(label, api.post("/api/workspace/invoices", { kind: "sale", accountId: account, issueDate, lines: line(price, qty), payment: dueDate ? { ...pay, dueDate } : pay, force: true })));
  const entry = (label, account, body) => must(label, api.post(`/api/workspace/accounts/${account}/entries`, body));
  before(async () => {
    ctx = await boot({ now: { time: "2027-01-05T10:00:00+03:00", fixed: true } });
    api = ctx.api;
    for (const [key, name, type] of [["a1", "Bağ Bir", "customer"], ["a2", "Bağ İki", "customer"], ["a3", "Bağ Üç", "customer"], ["a4", "Bağ Dört", "customer"], ["a5", "Bağ Beş", "customer"], ["a6", "Bağ Altı", "customer"], ["a7", "Bağ Yedi", "customer"], ["b1", "Mahsup Bir", "other"], ["b2", "Mahsup İki", "other"],["h1", "Sınır Bir", "customer"], ["a8", "Bağ Sekiz", "customer"]]) {
      ids[key] = (await must(key, api.post("/api/workspace/accounts", { name, type }))).id;
    }
    ids.bank = (await must("banka", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-01-01", amount: "0", confirmed: true } }))).id;
    // ---- ≤K (tarih sırasıyla) ----
    ids.g1 = (await sale("G1", ids.a8, "2026-10-01", 300, "2026-11-01")).id;
    ids.f1 = (await sale("F1", ids.a1, "2026-11-01", 1000, "2026-12-01")).id;
    ids.f9 = (await sale("F9", ids.a8, "2026-11-02", 1000, "2026-12-01")).id;
    ids.f2 = (await sale("F2", ids.a2, "2026-11-05", 500, "2026-11-10")).id;
    ids.f2b = (await sale("F2b", ids.a2, "2026-11-06", 300, "2026-12-15")).id;
    await entry("A2 bağsız", ids.a2, { kind: "in", amount: "500", date: "2026-11-20", note: "Bağsız" });
    ids.fb1 = (await sale("FB1", ids.b1, "2026-12-01", 700, "2026-12-20")).id;
    ids.fb2 = (await must("FB2", api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.b1, number: "AL-B2", issueDate: "2026-12-02", lines: line(200), payment: pay, force: true }))).id;
    ids.fb5 = (await sale("FB5", ids.b2, "2026-12-02", 400, "2026-12-20")).id;
    ids.fb4 = (await must("FB4", api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.b2, number: "AL-B4", issueDate: "2026-12-03", lines: line(150), payment: pay, force: true }))).id;
    ids.f3 = (await sale("F3", ids.a3, "2026-12-05", 800, "2027-01-05")).id;
    ids.f5 = (await sale("F5", ids.a4, "2026-12-10", 300, "2027-01-10", 2)).id;
    ids.f6 = (await sale("F6", ids.a5, "2026-12-15", 400, "2026-12-25")).id;
    ids.f7 = (await sale("F7", ids.a6, "2026-12-18", 200, "2026-12-18")).id;
    await entry("A3 ≤K bağlı", ids.a3, { kind: "in", amount: "300", date: "2026-12-20", note: "Kısmi", invoiceId: ids.f3 });
    await entry("H1 borç K", ids.h1, { kind: "debt", amount: "250", date: "2026-12-31", note: "Sınır" });
    await entry("H1 tahsilat K", ids.h1, { kind: "in", amount: "100", date: "2026-12-31", note: "Sınır" });
    await entry("H1 borç K+1", ids.h1, { kind: "debt", amount: "250", date: "2027-01-01", note: "Sınır" });
    await entry("H1 tahsilat K+1", ids.h1, { kind: "in", amount: "100", date: "2027-01-01", note: "Sınır" });
    // ---- Dönem Kilidi K (S24 = A: Ocak'ın bağları K kilidiyle) ----
    ctx.server.clock.set("2027-01-05T11:00:00+03:00");
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: K }));
    await ctx.app.ledger.snapshots.runPending();
    ctx.server.clock.set("2027-02-10T12:00:00+03:00");
    // ---- >K ----
    ids.chq = (await must("A5 çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", accountId: ids.a5, amount: "400", issueDate: "2027-01-05", dueDate: "2027-03-05", serialNo: "BAG-1", bank: "Ziraat", invoiceId: ids.f6 }))).id;
    await entry("A6 havale", ids.a6, { kind: "in", amount: "200", date: "2027-01-07", note: "Havale", method: "bank", bankAccountId: ids.bank, invoiceId: ids.f7 });
    await entry("A3 >K bağlı", ids.a3, { kind: "in", amount: "500", date: "2027-01-08", note: "Kalan", invoiceId: ids.f3 });
    await entry("A1 >K bağlı", ids.a1, { kind: "in", amount: "400", date: "2027-01-10", note: "Ocak", invoiceId: ids.f1 });
    await entry("A8 >K bağlı", ids.a8, { kind: "in", amount: "400", date: "2027-01-10", note: "Ocak", invoiceId: ids.f9 });
    await entry("A2 >K bağlı", ids.a2, { kind: "in", amount: "500", date: "2027-01-12", note: "Ocak", invoiceId: ids.f2 });
    await must("B1 mahsup ≤K belgeler", api.post(`/api/workspace/invoices/${ids.fb1}/offsets`, { counterType: "invoice", counterId: ids.fb2, amount: "200", date: "2027-01-15" }));
    ids.f8 = (await sale("F8", ids.a7, "2027-01-15", 150, "")).id;
    ids.fb3 = (await sale("FB3", ids.b2, "2027-01-16", 300, "2027-01-30")).id;
    await must("B1 mahsup karşı ≤K", api.post(`/api/workspace/invoices/${ids.fb3}/offsets`, { counterType: "invoice", counterId: ids.fb4, amount: "150", date: "2027-01-17" }));
    const f5 = await must("F5 oku", api.get(`/api/workspace/invoices/${ids.f5}`));
    ids.r5 = (await must("A4 iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: ids.f5, issueDate: "2027-01-18", lines: [{ originLineId: f5.lines[0].id, qty: 1 }], payment: {} }))).id;
    await entry("A7 >K bağlı", ids.a7, { kind: "in", amount: "150", date: "2027-01-20", note: "Ocak", invoiceId: ids.f8 });
    job = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
  });
  after(() => ctx?.server.close());

  // Kimlikleri senaryo adına çevir (bağ listesi ve açık kalemler elle yazılmış beklentiyle karşılaştırılır).
  const nameOf = id => Object.entries(ids).find(([, value]) => value === id)?.[0] || id;
  const rowOf = key => job.result.plan.newYear.cariler.find(row => row.cari === ids[key]);
  const openOf = key => rowOf(key).satirlar.filter(row => row.tur === "acik-kalem").map(row => [row.kalemSinifi === "fatura" ? nameOf(row.belge.faturaId) : row.kalemSinifi, row.yon, row.tutarMinor, row.vade]);

  it("bağ listesi (elle): K sonrası satırın ≤K belgeye HER bağı — Kapatılacak Fatura, çek olayı, banka havalesi, Mahsup Et'in iki tarafı, iade → asıl fatura; iki tarafı ≤K ya da >K olan bağ YOK", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const got = job.result.plan.newYear.baglar.map(row => [row.tablo, row.alan, row.tarih, nameOf(row.eskiHedef), row.tur, row.yeniHedef ? nameOf(row.yeniHedef.replace("devir-2026-kalem-inv:", "")) : "", row.arsiv ? `${row.arsiv.yil}|${row.arsiv.tarih}` : ""]).sort();
    const want = [
      ["account_entries", "invoice_id", "2027-01-07", "f7", "acik-kalem", "f7", ""], // A6 banka havalesi
      ["account_entries", "invoice_id", "2027-01-08", "f3", "acik-kalem", "f3", ""], // A3 kısmi bağın K sonrası kısmı
      ["account_entries", "invoice_id", "2027-01-10", "f1", "acik-kalem", "f1", ""], // A1
      ["account_entries", "invoice_id", "2027-01-10", "f9", "acik-kalem", "f9", ""], // A8
      ["account_entries", "invoice_id", "2027-01-12", "f2", "arsiv-basvurusu", "", "2026|2026-11-05"], // A2: K'de kapanmış fatura
      ["cheque_events", "invoice_id", "2027-01-05", "f6", "acik-kalem", "f6", ""], // A5 çek olayı
      ["invoice_offsets", "counter_id", "2027-01-15", "fb2", "arsiv-basvurusu", "", "2026|2026-12-02"], // B1 mahsubun karşı tarafı (alış K'de netleşmiş)
      ["invoice_offsets", "counter_id", "2027-01-17", "fb4", "arsiv-basvurusu", "", "2026|2026-12-03"], // B1 mahsup: belge >K, KARŞI belge ≤K (a5)
      ["invoice_offsets", "invoice_id", "2027-01-15", "fb1", "acik-kalem", "fb1", ""], // B1 mahsup (iki belge ≤K)
      ["invoices", "original_id", "2027-01-18", "f5", "acik-kalem", "f5", ""], // A4 iade → asıl fatura (a6)
    ].sort();
    assert.deepEqual(got, want);
    const a2 = job.result.plan.newYear.baglar.find(row => row.eskiHedef === ids.f2);
    assert.match(a2.arsiv.no, /\S/, "arşiv başvurusunda belge no");
  });

  it("açık kalemler (elle): K sonrası bağlı tahsilat K'deki kalanı DÜŞÜRMEZ; ≤K bağlı kısım düşer; kapanmış fatura açık kalem değil; iki tarafı >K olan cariye satır YOK", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.deepEqual(openOf("a1"), [["f1", "debt", 100000, "2026-12-01"]]);
    assert.deepEqual(openOf("a2"), [["f2b", "debt", 30000, "2026-12-15"]]);
    assert.deepEqual(openOf("a3"), [["f3", "debt", 50000, "2027-01-05"]]);
    assert.deepEqual(openOf("a4"), [["f5", "debt", 60000, "2027-01-10"]]);
    assert.deepEqual(openOf("a5"), [["f6", "debt", 40000, "2026-12-25"]]);
    assert.deepEqual(openOf("a6"), [["f7", "debt", 20000, "2026-12-18"]]);
    assert.deepEqual(openOf("a8"), [["g1", "debt", 30000, "2026-11-01"], ["f9", "debt", 100000, "2026-12-01"]]);
    assert.deepEqual(openOf("b1"), [["fb1", "debt", 50000, "2026-12-20"]]);
    assert.deepEqual(openOf("b2"), [["fb5", "debt", 25000, "2026-12-20"]]);
    assert.deepEqual([rowOf("a7").kBakiyeMinor, rowOf("a7").satirlar.length], [0, 0]);
    assert.deepEqual(job.result.plan.sorunlar, []);
    assert.deepEqual(job.result.onDenetim.durdurur.map(row => row.kod), []);
  });

  it("DEVİRSİZ EŞDEĞER (aynı kilitle — S24 = A): bağı açık kaleme YÖNLENDİRİLMİŞ devirli kuyruk = devirsiz (gecikmiş, açık kalemler, en eski vade); elle: A1 02.01 = 600, A2 02.01 = 0, A8 11.01 = 900", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const eq = fixture.createEquivalence(ctx.store);
    const days = ["2027-01-01", "2027-01-02", "2027-01-06", "2027-01-09", "2027-01-11", "2027-01-13", "2027-01-16", "2027-01-19", "2027-02-01", "2027-03-01"];
    for (const key of ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "b1", "h1"]) { // b2: KULLANICIYA SORULMALI (S-T2-1) — aşağıdaki testte sayılarıyla
      for (const out of eq.compare(ids[key], rowOf(key), K, days, { redirect: true })) {
        assert.equal(out.devirli, out.devirsiz, `${key} ${out.day} gecikmiş`);
        assert.deepEqual(out.kalemDevirli, out.kalemDevirsiz, `${key} ${out.day} açık kalemler`);
        assert.equal(out.sinceDevirli, out.sinceDevirsiz, `${key} ${out.day} en eski vade`);
      }
    }
    const at = (key, day) => eq.compare(ids[key], rowOf(key), K, [day], { redirect: true })[0].devirsiz;
    // gecikmiş(t) = BUGÜNKÜ kalanların t'deki vadesi (tur 1 tanımı; TYK tahsilatı kendi gününde dağıtır): A1 F1 1.000 − 400 = 600; A2 F2b'yi 12.01 tahsilatı kapatır → 0; A8 F9 600 + G1 300.
    assert.deepEqual([at("a1", "2027-01-02"), at("a2", "2027-01-02"), at("a8", "2027-01-11")], [60000, 0, 90000]);
  });

  it("S-T2-1 (KULLANICIYA SORULMALI — sayılar SABİT; yanıta göre değişir): K sonrası Mahsup Et'in KARŞI belgesi ≤K (B2) — bakiye aynı, gecikmiş 01.01–29.01 devirsiz 400,00 ↔ devirli 250,00", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const eq = fixture.createEquivalence(ctx.store);
    const out = Object.fromEntries(eq.compare(ids.b2, rowOf("b2"), K, ["2027-01-01", "2027-02-01"], { redirect: true }).map(row => [row.day, [row.devirsiz, row.devirli]]));
    assert.deepEqual(out, { "2027-01-01": [40000, 25000], "2027-02-01": [55000, 55000] });
  });

  it("DİŞ (D4a şartı): K sonrası bağ açık kaleme yönlendirilmezse (bağsız gibi dağılırsa) A8'de devirli ≠ devirsiz — planın `baglar` listesi gerekli", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const eq = fixture.createEquivalence(ctx.store);
    const [right] = eq.compare(ids.a8, rowOf("a8"), K, ["2027-01-11"], { redirect: true });
    const [wrong] = eq.compare(ids.a8, rowOf("a8"), K, ["2027-01-11"]);
    assert.deepEqual(right.kalemDevirli, right.kalemDevirsiz);
    assert.notDeepEqual(wrong.kalemDevirli, wrong.kalemDevirsiz, "bağsız dağılan Ocak tahsilatı G1'i kapatır, devirsizde F9'u");
  });

  it("K günü / K+1 günü aynı tutarlı iki kayıt (h1): 31.12'ler K bakiyesinde (150,00), 01.01'ler yeni yılda; tablo sayımı ≤K 17 / >K 12 (elle: 13 fatura + 4 elle / 3 fatura + 8 elle + 1 çek)", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const h1 = rowOf("h1");
    assert.equal(h1.kBakiyeMinor, 15000);
    assert.deepEqual(h1.satirlar.map(row => [row.tur, row.yon, row.tutarMinor, row.vade]), [["borc-toplami", "debt", 10000, ""], ["alacak-toplami", "credit", 10000, ""], ["acik-kalem", "debt", 15000, "2026-12-31"]]);
    const db = ctx.store.all("SELECT date FROM account_entries WHERE account_id = ? ORDER BY date", ids.h1).map(row => row.date);
    assert.deepEqual(db, ["2026-12-31", "2026-12-31", "2027-01-01", "2027-01-01"]);
    const entries = job.result.plan.newYear.budama.find(row => row.table === "account_entries");
    assert.deepEqual([entries.kOncesi, entries.kSonrasi, entries.toplam], [17, 12, 29]);
  });
});
