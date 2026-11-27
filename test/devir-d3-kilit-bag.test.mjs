// 2.5.1 D3 TUR 5 — K öncesi belge KİLİTLİ dönemdeyken K sonrası bağ / mahsup (tur 4 raporu DOĞRULANMADI-2) + S-T4-1 = A'nın devir tarafı.
// KULLANICI 27.11.2026 18:1x UTC (AYNEN: "önerlerini uygula") — S-T4-1 = A: Dönem Kilidi'nden sonra kurulan bağ (faturaya bağlı tahsilat / mahsup) faturanın kilit anındaki BAĞSIZ kapanışını
// KAYDIRMAZ (karar 28 = A ile aynı çizgi). Tur 4 örneği (gerçek veri, tohum 11, "Müşteri 108"): fatura 350,40 kilitli dönemde 175,20 iade + 175,20 havale ile kapanmış; 06.01.2027'de 128,00
// tahsilat bu faturaya bağlı girilmiş. DOĞRU sonuç (A): açık kalemler 280,00 (vade 22.12.2026) + 1.245,40 (19.01.2027), 19.01'e kadar gecikmiş 280,00; bakiye 1.525,40. Programın BUGÜNKÜ tek borç
// sırası 408,00 / 1.117,40 veriyor (v2.5.0'dan beri; düzeltmesi AYRI pakette). DEVİR PLANI BUGÜN ZATEN A'YI VERİYOR — bu test o davranışı SABİTLER; devirsiz eşdeğerdeki farkı yalnız
// S-T4-1 imzasıyla (test/fixtures/devir-d3-esdeger.mjs kilitBagImzasi) "BEKLENEN FARK (S-T4-1 = A; program düzeltmesi kilit paketinde)" sayar — öbür her fark BAŞARISIZ.
// Veri programın KENDİ API'sinden; beklenen sayılar ELLE. D3 HİÇBİR ŞEY YAZMAZ. K = 31.12.2026.
//   K1 (tur 4 tohum 11 carisinin küçük elle kurulmuş EŞDEĞERİ — sayılar AYNEN): FIS-1 13.05.2026 350,40 (iki satır 175,20; vadesiz); FIS-2 01.07.2026 2.673,20 (vade 19.01.2027); 25.07 iade
//        175,20 (FIS-1'e); 11.08 bağsız tahsilat 1.603,00 (FIS-1'in kalan 175,20'si + FIS-2'nin 1.427,80'i); FIS-3 22.11.2026 408,00 (vade 22.12.2026). Dönem Kilidi K. 06.01.2027 tahsilat
//        128,00 FIS-1'e BAĞLI. Plan (K): FIS-3 408,00 + FIS-2 1.245,40 açık; bağ arşiv başvurusu → yeni yılda 128,00 bağsız → FIS-3 → devirli görünüm 280,00 / 1.245,40, gecikmiş (≤19.01) 280,00,
//        20.01'den 1.525,40; bakiye 1.525,40. Devirsiz (bugün): 408,00 / 1.117,40 (kilit paketi girince 280,00 / 1.245,40).
//   K2 (aynı sınıf İADESİZ): G-1 13.05 500 (vadesiz), G-2 01.07 1.000 (vade 19.01.2027), 11.08 bağsız 700, G-3 22.11 300 (vade 22.12); kilit K; 06.01 128,00 G-1'e bağlı. Program bu
//        biçimde bağsız kapanışı KAYDIRMIYOR (keşif koşusunda ölçüldü): devirli = devirsiz = 172,00 / 800,00.
//   K4 (kilit K, belge kilitli dönemde KISMEN bağsız kapanmış): Aralık satış 400 (vade 20.12), 15.12 bağsız 100; Ocak alış 300; 17.01 Mahsup Et alış ↔ Aralık satışı 300 (açık tutarın tamamı).
//        Ayrılan = devirsiz kuyruğun mahsuba verdiği pay 300 (kilit sınırı: 400 − kilitli bağsız 100); K: satış 300 açık kalem; devirli = devirsiz (gecikmiş 0).
//   K3 (ayrı sunucu — Dönem Kilidi K'den ÖNCE 30.06, sonra K): Mayıs satış 400 (01.05, vadesiz), 15.06 bağsız 250 (kilitli dönemde); Ocak alış 150; 12.01 Mahsup Et alış ↔ Mayıs satışı 150.
//        Ayrılan 150; K: satış 150 açık kalem (vade 01.05); devirli = devirsiz.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const fixture = await import("./fixtures/devir-d3-esdeger.mjs");
const K = "2026-12-31";
const pay = { cash: [], cheques: [], endorse: [], rest: "open" };
const L = (name, price) => ({ name, qty: 1, unitPrice: price, discountRate: 0, vatRate: 0 });

async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}
const sale = (api, label, account, issueDate, lines, dueDate) => must(label, api.post("/api/workspace/invoices", { kind: "sale", accountId: account, issueDate, lines, payment: dueDate ? { ...pay, dueDate } : pay, force: true }));
const entry = async (api, label, account, body) => (await must(label, api.post(`/api/workspace/accounts/${account}/entries`, body))).entryId;
const DAYS = ["2027-01-01", "2027-01-06", "2027-01-10", "2027-01-19", "2027-01-20", "2027-02-01", "2027-03-01"];

describe("D3 tur 5 — S-T4-1 = A: kilitten sonra kurulan bağ kilitli bağsız kapanışı kaydırmaz (plan A'yı verir; devirsiz farkı ayrı sınıf)", () => {
  let ctx;
  let api;
  let job;
  const ids = {};
  before(async () => {
    ctx = await boot({ now: { time: "2027-01-05T10:00:00+03:00", fixed: true } });
    api = ctx.api;
    for (const key of ["k1", "k2", "k4"]) ids[key] = (await must(key, api.post("/api/workspace/accounts", { name: `Kilit Bağ ${key.toUpperCase()}`, type: "customer" }))).id;
    // ---- ≤K (belge numarası ile tarih sırası uyuşmalı: tarih sırasıyla) ----
    const f1 = await sale(api, "K1 FIS-1", ids.k1, "2026-05-13", [L("Hizmet A", 175.2), L("Hizmet B", 175.2)]);
    ids.f1 = f1.id;
    ids.g1 = (await sale(api, "K2 G-1", ids.k2, "2026-05-13", [L("Hizmet", 500)])).id;
    ids.f2 = (await sale(api, "K1 FIS-2", ids.k1, "2026-07-01", [L("Hizmet", 2673.2)], "2027-01-19")).id;
    ids.g2 = (await sale(api, "K2 G-2", ids.k2, "2026-07-01", [L("Hizmet", 1000)], "2027-01-19")).id;
    ids.r1 = (await must("K1 iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: ids.f1, issueDate: "2026-07-25", lines: [{ originLineId: f1.lines[0].id, qty: 1 }], payment: {} }))).id;
    ids.h1 = await entry(api, "K1 bağsız 1.603,00", ids.k1, { kind: "in", amount: "1603", date: "2026-08-11", note: "Havale" });
    ids.h2 = await entry(api, "K2 bağsız 700", ids.k2, { kind: "in", amount: "700", date: "2026-08-11", note: "Havale" });
    ids.f3 = (await sale(api, "K1 FIS-3", ids.k1, "2026-11-22", [L("Hizmet", 408)], "2026-12-22")).id;
    ids.g3 = (await sale(api, "K2 G-3", ids.k2, "2026-11-22", [L("Hizmet", 300)], "2026-12-22")).id;
    ids.s4 = (await sale(api, "K4 satış", ids.k4, "2026-12-01", [L("Hizmet", 400)], "2026-12-20")).id;
    ids.h4 = await entry(api, "K4 bağsız 100", ids.k4, { kind: "in", amount: "100", date: "2026-12-15", note: "Kısmi" });
    // ---- Dönem Kilidi K ----
    ctx.server.clock.set("2027-01-05T11:00:00+03:00");
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: K }));
    await ctx.app.ledger.snapshots.runPending();
    // ---- >K (kilitten sonra) ----
    ctx.server.clock.set("2027-01-06T12:00:00+03:00");
    ids.b1 = await entry(api, "K1 06.01 bağlı 128,00", ids.k1, { kind: "in", amount: "128", date: "2027-01-06", note: "Bağlı", invoiceId: ids.f1 });
    ids.b2 = await entry(api, "K2 06.01 bağlı 128,00", ids.k2, { kind: "in", amount: "128", date: "2027-01-06", note: "Bağlı", invoiceId: ids.g1 });
    ctx.server.clock.set("2027-02-10T12:00:00+03:00");
    ids.a4 = (await must("K4 Ocak alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.k4, number: "AL-K4", issueDate: "2027-01-10", lines: [L("Hizmet", 300)], payment: pay, force: true }))).id;
    await must("K4 mahsup", api.post(`/api/workspace/invoices/${ids.a4}/offsets`, { counterType: "invoice", counterId: ids.s4, amount: "300", date: "2027-01-17" }));
    job = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
  });
  after(() => ctx?.server.close());

  const nameOf = id => Object.entries(ids).find(([, value]) => value === id)?.[0] || id;
  const rowOf = key => job.result.plan.newYear.cariler.find(row => row.cari === ids[key]);
  const openOf = key => rowOf(key).satirlar.filter(row => row.tur === "acik-kalem").map(row => [row.kalemSinifi === "fatura" ? nameOf(row.belge.faturaId) : `${row.kalemSinifi}:${nameOf(row.belge.satirId)}`, row.tutarMinor, row.vade]);

  it("veri tabanı (ders 3): kilit K, bağlı tahsilatlar kilitten SONRA yazıldı ve ≤K faturaya bağlı; iade asıl faturaya bağlı", () => {
    assert.equal(ctx.store.get("SELECT value FROM settings WHERE key = 'ledger.lockedUntil'").value, K);
    const row = id => ctx.store.get("SELECT date, invoice_id AS inv, created_at AS at FROM account_entries WHERE id = ?", id);
    assert.deepEqual([row(ids.b1).inv, row(ids.b2).inv, row(ids.b1).date], [ids.f1, ids.g1, "2027-01-06"]);
    const lockAt = ctx.store.get("SELECT created_at AS at FROM audit_events WHERE type = 'ledger.period.locked' ORDER BY rowid DESC LIMIT 1").at;
    assert.ok(row(ids.b1).at > lockAt && row(ids.b2).at > lockAt, `bağ kilitten sonra (${row(ids.b1).at} > ${lockAt})`);
    assert.equal(ctx.store.get("SELECT original_id AS o FROM invoices WHERE id = ?", ids.r1).o, ids.f1);
  });

  it("K1 plan (elle; S-T4-1 = A): K'de FIS-3 408,00 + FIS-2 1.245,40 açık; FIS-1 kapalı; 128,00'in bağı ARŞİV BAŞVURUSU (FIS-1'in belge numarası); K bakiyesi 1.653,40", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job.state, "done", JSON.stringify(job.error));
    assert.deepEqual(openOf("k1"), [["f3", 40800, "2026-12-22"], ["f2", 124540, "2027-01-19"]]);
    assert.equal(rowOf("k1").kBakiyeMinor, 165340);
    const link = job.result.plan.newYear.baglar.find(row => row.satir === ids.b1);
    assert.deepEqual([link?.tur, nameOf(link?.eskiHedef), link?.yeniHedef, link?.arsiv?.tarih], ["arsiv-basvurusu", "f1", "", "2026-05-13"]);
    assert.match(link.arsiv.no, /^FIS\d+$/);
    assert.deepEqual(job.result.plan.sorunlar, []);
    assert.deepEqual(job.result.onDenetim.durdurur.map(row => row.kod), []);
  });

  it("K1 DEVİRLİ görünüm (sayılar AYNEN): 280,00 (22.12.2026) + 1.245,40 (19.01.2027); 19.01'e kadar gecikmiş 280,00, 20.01'den 1.525,40; bakiye 1.525,40", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const eq = fixture.createEquivalence(ctx.store);
    for (const out of eq.compare(ids.k1, rowOf("k1"), K, DAYS, { redirect: true })) {
      assert.deepEqual(out.kalemDevirli, ["2026-12-22|28000", "2027-01-19|124540"], `${out.day} açık kalemler`);
      assert.equal(out.devirli, out.day <= "2027-01-19" ? 28000 : 152540, `${out.day} gecikmiş`);
    }
    const queue = eq.devirli(ids.k1, rowOf("k1"), K, "2027-01-10", { redirect: true });
    const balance = queue.items.reduce((sum, item) => sum + Math.round(item.remaining * 100) * (item.side === "receivable" ? 1 : -1), 0);
    assert.equal(balance, 152540, "bakiye 1.525,40");
    const detail = await must("K1 cari kartı", api.get(`/api/workspace/accounts/${ids.k1}`));
    assert.equal(Math.round(detail.totals.balance * 100), 152540, "programın cari bakiyesi 1.525,40");
  });

  it("K1 DEVİRSİZ (programın bugünkü tek borç sırası): ya S-T4-1 öncesi 408,00 / 1.117,40 (BEKLENEN FARK — imza: bağ 128,00 kilitli bağsız kapanışı kaydırıyor) ya kilit paketi sonrası A; başkası BAŞARISIZ", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const eq = fixture.createEquivalence(ctx.store);
    const outs = eq.compare(ids.k1, rowOf("k1"), K, DAYS, { redirect: true });
    const before = JSON.stringify(outs[0].kalemDevirsiz) === JSON.stringify(["2026-12-22|40800", "2027-01-19|111740"]);
    const fixed = outs.every(out => out.devirli === out.devirsiz && JSON.stringify(out.kalemDevirli) === JSON.stringify(out.kalemDevirsiz));
    assert.ok(before || fixed, `devirsiz ne S-T4-1 öncesi ne A: ${JSON.stringify(outs[0])}`);
    const sign = eq.kilitBagImzasi(ids.k1, job.result.plan, outs);
    if (before) {
      for (const out of outs) assert.equal(out.devirsiz, out.day <= "2027-01-19" ? 40800 : 152540, `${out.day} devirsiz gecikmiş (bugünkü program)`);
      assert.deepEqual(sign && [sign.sinif, sign.tutarMinor, sign.baglar.map(nameOf)], ["S-T4-1", 12800, ["b1"]], "fark S-T4-1 imzasıyla açıklanmalı");
    } else assert.equal(sign, null, "kilit paketinden sonra imza kalmaz");
  });

  it("K2 (iadesiz aynı sınıf) ve K4 (kilit K, kısmi bağsız kapanmış belgeye Ocak mahsubu): devirli = devirsiz, S-T4-1 imzası YOK; K4'te ayrılan = devirsiz kuyruğun payı 300", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.deepEqual(openOf("k2"), [["g3", 30000, "2026-12-22"], ["g2", 80000, "2027-01-19"]]);
    assert.deepEqual(openOf("k4"), [["s4", 30000, "2026-12-20"]]);
    assert.deepEqual(job.result.plan.newYear.mahsupAyirmalari.map(row => [nameOf(row.cari), row.tur, row.tutarMinor]), [["k4", "yeni-yila-ayrildi", 30000]]);
    const eq = fixture.createEquivalence(ctx.store);
    for (const key of ["k2", "k4"]) {
      const outs = eq.compare(ids[key], rowOf(key), K, DAYS, { redirect: true });
      for (const out of outs) {
        assert.equal(out.devirli, out.devirsiz, `${key} ${out.day} gecikmiş`);
        assert.deepEqual(out.kalemDevirli, out.kalemDevirsiz, `${key} ${out.day} açık kalemler`);
      }
      assert.equal(eq.kilitBagImzasi(ids[key], job.result.plan, outs), null, `${key}: imza yok`);
    }
    const k2 = eq.compare(ids.k2, rowOf("k2"), K, ["2027-01-10"], { redirect: true })[0];
    assert.deepEqual([k2.devirli, k2.kalemDevirli], [17200, ["2026-12-22|17200", "2027-01-19|80000"]]);
  });

  it("imza başka farkları yutmaz: K1'in devirli satırları bozulursa (kalem tutarı değişir — bakiye kayar) imza null", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const eq = fixture.createEquivalence(ctx.store);
    const row = rowOf("k1");
    const broken = { ...row, satirlar: row.satirlar.map(line => (line.tur === "acik-kalem" && line.vade === "2027-01-19" ? { ...line, tutarMinor: line.tutarMinor - 5000 } : line)) };
    const outs = eq.compare(ids.k1, broken, K, DAYS, { redirect: true });
    assert.ok(outs.some(out => out.devirli !== out.devirsiz || JSON.stringify(out.kalemDevirli) !== JSON.stringify(out.kalemDevirsiz)), "bozuk satır fark üretmeli");
    assert.equal(eq.kilitBagImzasi(ids.k1, job.result.plan, outs), null);
  });
});

describe("D3 tur 5 — Dönem Kilidi K'den ÖNCE (30.06): kilitli dönemdeki belgeye K sonrası Mahsup Et (DOĞRULANMADI-2)", () => {
  let ctx;
  let api;
  let job;
  const ids = {};
  before(async () => {
    ctx = await boot({ now: { time: "2026-07-05T10:00:00+03:00", fixed: true } });
    api = ctx.api;
    ids.k3 = (await must("k3", api.post("/api/workspace/accounts", { name: "Kilit Bağ K3", type: "customer" }))).id;
    ids.s3 = (await sale(api, "K3 Mayıs satış", ids.k3, "2026-05-01", [L("Hizmet", 400)])).id;
    await entry(api, "K3 bağsız 250 (kilitli dönemde)", ids.k3, { kind: "in", amount: "250", date: "2026-06-15", note: "Kısmi" });
    ctx.server.clock.set("2026-07-05T11:00:00+03:00");
    await must("kilit 30.06", api.put("/api/admin/period-lock", { lockedUntil: "2026-06-30" }));
    await ctx.app.ledger.snapshots.runPending();
    ctx.server.clock.set("2027-01-05T11:00:00+03:00");
    await must("kilit K", api.put("/api/admin/period-lock", { lockedUntil: K }));
    await ctx.app.ledger.snapshots.runPending();
    ctx.server.clock.set("2027-02-10T12:00:00+03:00");
    ids.a3 = (await must("K3 Ocak alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.k3, number: "AL-K3", issueDate: "2027-01-10", lines: [L("Hizmet", 150)], payment: pay, force: true }))).id;
    await must("K3 mahsup", api.post(`/api/workspace/invoices/${ids.a3}/offsets`, { counterType: "invoice", counterId: ids.s3, amount: "150", date: "2027-01-12" }));
    job = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
  });
  after(() => ctx?.server.close());

  it("K3: ayrılan 150 = devirsiz kuyruğun payı (kilit sınırı dahil); K'de satış 150 açık kalem (vade 01.05); devirli = devirsiz her gün", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const row = job.result.plan.newYear.cariler.find(item => item.cari === ids.k3);
    assert.deepEqual(row.satirlar.filter(line => line.tur === "acik-kalem").map(line => [line.belge.faturaId === ids.s3, line.tutarMinor, line.vade]), [[true, 15000, "2026-05-01"]]);
    assert.equal(row.kBakiyeMinor, 15000);
    assert.deepEqual(job.result.plan.newYear.mahsupAyirmalari.map(item => [item.tur, item.tutarMinor]), [["yeni-yila-ayrildi", 15000]]);
    const eq = fixture.createEquivalence(ctx.store);
    const offset = eq.devirsiz(ids.k3, "2027-01-20").invoices.get(ids.s3).closers.filter(closer => closer.mode === "offset").reduce((sum, closer) => sum + Math.round(closer.amount * 100), 0);
    assert.equal(offset, 15000, "devirsiz kuyruğun mahsuba verdiği pay");
    for (const out of eq.compare(ids.k3, row, K, DAYS, { redirect: true })) {
      assert.equal(out.devirli, out.devirsiz, `${out.day} gecikmiş`);
      assert.deepEqual(out.kalemDevirli, out.kalemDevirsiz, `${out.day} açık kalemler`);
    }
  });
});
