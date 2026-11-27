// 2.5.1 D3 TUR 2 — tur 1'in DOĞRULANMADI maddeleri: (e) K'den SONRA faturaya bağlı tahsilatı olan ŞÜPHELİ cari (planın K'deki şüpheli payı; yanlış DURDURMA da hata), (f) K'den
// SONRA "Borçta Kalsın" ile kapanan taksit kartı (tur 1 BM-5), BM-1 (şüpheli carinin "Alacak Toplamı" — bugünkü sayılar SABİT, BAŞ MİMAR 27.11 BM-1: davranış DEĞİŞMEZ),
// BM-6 (ödeme rolündeki açık kalemin ÖDEME satırı yazmaya yetecek alanları). Veri programın KENDİ API'sinden; beklenen sayılar ELLE. K = 31.12.2026, bugün 10.02.2027.
//   D1: S1 satış 1.000 (01.10, vade 01.11) · 15.11 Şüpheliye Al 600 · 10.01.2027 tahsilat 300 S1'e BAĞLI.
//       ELLE K: şüpheli kalan 600 (≤K tahsilat yok) → 128 = 600; CH = 1.000 − 600 = 400; açık kalem S1 = 1.000 − 600 (şüpheli pay, M13) = 400; Borç Toplamı 600, Alacak Toplamı 600 (BM-1).
//   D2: S2 satış 800 (05.10, vade 05.11) · 20.11 Şüpheliye Al 800 · 10.12 tahsilat 200 S2'ye bağlı · 12.01.2027 tahsilat 300 S2'ye bağlı.
//       ELLE K: şüpheli kalan 800 − 200 = 600 → 128 = 600; CH = 800 − 800 (şüpheliye) = 0 … tahsilat 200 şüpheliden düşer (CH'ye değil): 128 = 600, CH = 0; açık kalem YOK.
//   D3: S3 satış 500 (10.10) · 25.11 Şüpheliye Al 500 · 15.12 Karşılık 500 · 15.01.2027 Değersiz 500. ELLE K: 128 = 500, 129 = −500 (karşılık 500); CH 0; açık kalem YOK.
//   KC (f): S4 satış 1.200 (01.09) · 01.10 kart "Carinin Mevcut Borcunu Taksitlendir" 4 × 300 (ilk vade 01.11, aylık) · 05.11 kart tahsilatı 300 · 10.01.2027 Kartı Kapat — Borçta Kalsın.
//       ELLE K: kart AÇIK (kapanış K'den sonra), ödenen 300, kalan 900; taksitler 2–4 kalan 300'er; kartın taşıdığı kalem açık kalem DEĞİL (M2).
//       Taksit VADESİ: Borçta Kalsın (S205 = A; lib/accounts.mjs keptDueSql) kalemin vadesini MIN(asıl vade, kapanış günü) yapar — GERİYE DÖNÜK (bugünkü kapanış K durumuna da işler): taksit 2 01.12, taksit 3 01.01.2027, taksit 4 MIN(01.02, 10.01) = 10.01.2027. Devirsiz program bugün böyle gösterir; plan da (DEVİRLİ = DEVİRSİZ).
//   KD (f kontrol): S5 satış 600 (01.10) · 02.10 kart 2 × 300 (ilk vade 15.11) · 20.12.2026 Kartı Kapat — Borçta Kalsın. ELLE K: kart KAPALI, kalanı açık kalem "kart-kalani" 2 × 300, vadeler MIN(asıl, 20.12) = 15.11 ve 15.12.
//   V (BM-6): 10.11 tedarikçiye faturasız ödeme (avans) 500 → açık kalem rol "odeme", vade = asıl tarih 10.11, tutar 500, yön borç, karşı kalem = ödeme satırının kimliği.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const fixture = await import("./fixtures/devir-d3-esdeger.mjs");
const K = "2026-12-31";
const pay = { cash: [], cheques: [], endorse: [], rest: "open" };
const line = price => [{ name: "Hizmet", qty: 1, unitPrice: price, discountRate: 0, vatRate: 0 }];

async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 tur 2 — şüpheli cari (K sonrası bağlı tahsilat), K sonrası Borçta Kalsın kartı, BM-1, BM-6", () => {
  let ctx;
  let api;
  let job;
  const ids = {};
  const sale = async (label, account, issueDate, price, dueDate) => (await must(label, api.post("/api/workspace/invoices", { kind: "sale", accountId: account, issueDate, lines: line(price), payment: dueDate ? { ...pay, dueDate } : pay, force: true }))).id;
  const entry = (label, account, body) => must(label, api.post(`/api/workspace/accounts/${account}/entries`, body));
  const doubt = async (label, account, amount, date) => {
    const r = await must(label, api.post(`/api/workspace/accounts/${account}/doubtful`, { amount, date, reason: "other" }));
    return r.record?.id ?? r.id;
  };
  before(async () => {
    ctx = await boot({ now: { time: "2026-12-20T10:00:00+03:00", fixed: true } });
    api = ctx.api;
    for (const [key, name, type] of [["d1", "Şüpheli Bir", "customer"], ["d2", "Şüpheli İki", "customer"], ["d3", "Şüpheli Üç", "customer"], ["kc", "Kartlı Bir", "customer"], ["kd", "Kartlı İki", "customer"], ["v", "Avans Tedarikçisi", "supplier"]]) {
      ids[key] = (await must(key, api.post("/api/workspace/accounts", { name, type }))).id;
    }
    ids.s4 = await sale("S4", ids.kc, "2026-09-01", 1200, "");
    ids.s1 = await sale("S1", ids.d1, "2026-10-01", 1000, "2026-11-01");
    ids.s5 = await sale("S5", ids.kd, "2026-10-01", 600, "");
    ids.s2 = await sale("S2", ids.d2, "2026-10-05", 800, "2026-11-05");
    ids.s3 = await sale("S3", ids.d3, "2026-10-10", 500, "");
    ids.kart = (await must("KC kart", api.post("/api/workspace/plans", { name: "Kartlı Bir", registeredOn: "2026-10-01", total: "1200", accountId: ids.kc, mode: "auto", count: "4", firstDue: "2026-11-01", coversBalance: true }))).id;
    ids.kart2 = (await must("KD kart", api.post("/api/workspace/plans", { name: "Kartlı İki", registeredOn: "2026-10-02", total: "600", accountId: ids.kd, mode: "auto", count: "2", firstDue: "2026-11-15", coversBalance: true }))).id;
    await must("KC kart tahsilatı", api.post(`/api/workspace/plans/${ids.kart}/entries`, { kind: "in", amount: "300", date: "2026-11-05", method: "cash", cashForce: true, similarOk: true }));
    await entry("V avans", ids.v, { kind: "out", amount: "500", date: "2026-11-10", note: "Avans", cashForce: true });
    ids.avans = ctx.store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'out'", ids.v).id;
    ids.r1 = await doubt("D1 şüpheli", ids.d1, "600", "2026-11-15");
    ids.r2 = await doubt("D2 şüpheli", ids.d2, "800", "2026-11-20");
    ids.r3 = await doubt("D3 şüpheli", ids.d3, "500", "2026-11-25");
    await entry("D2 ≤K bağlı", ids.d2, { kind: "in", amount: "200", date: "2026-12-10", note: "Kısmi", invoiceId: ids.s2 });
    await must("D3 karşılık", api.post(`/api/workspace/accounts/${ids.d3}/doubtful/${ids.r3}/provision`, { amount: "500", date: "2026-12-15" }));
    await must("KD Borçta Kalsın (≤K)", api.put(`/api/workspace/plans/${ids.kart2}`, { status: "closed" }));
    // ---- K'den sonra ----
    ctx.server.clock.set("2027-01-10T10:00:00+03:00");
    await must("KC Borçta Kalsın (>K)", api.put(`/api/workspace/plans/${ids.kart}`, { status: "closed" }));
    ctx.server.clock.set("2027-02-10T12:00:00+03:00");
    await entry("D1 >K bağlı", ids.d1, { kind: "in", amount: "300", date: "2027-01-10", note: "Ocak", invoiceId: ids.s1 });
    await entry("D2 >K bağlı", ids.d2, { kind: "in", amount: "300", date: "2027-01-12", note: "Ocak", invoiceId: ids.s2 });
    await must("D3 değersiz", api.post(`/api/workspace/accounts/${ids.d3}/doubtful/${ids.r3}/write-off`, { amount: "500", date: "2027-01-15" }));
    job = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
  });
  after(() => ctx?.server.close());

  const rowOf = key => job.result.plan.newYear.cariler.find(row => row.cari === ids[key]);
  const rows = key => rowOf(key).satirlar.map(row => [row.tur, row.yon, row.tutarMinor, row.vade]);

  it("(e) şüpheli K payı (elle): D1 128 = 600 (K sonrası bağlı tahsilat düşmez), D2 128 = 600 (yalnız ≤K tahsilat), D3 128 = 500 / 129 = 500 (Değersiz K sonrası); şüpheli farkı YOK, DURDURUR YOK", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const supheli = Object.fromEntries(job.result.plan.newYear.supheli.map(row => [Object.entries(ids).find(([, v]) => v === row.kayit)?.[0], [row.kalanMinor, row.karsilikMinor]]));
    assert.deepEqual(supheli, { r1: [60000, 0], r2: [60000, 0], r3: [50000, 50000] });
    const cells = Object.fromEntries(job.result.plan.archive.kapanisBakiyeleri.filter(row => row.hesap === "128" || row.hesap === "129").map(row => [`${row.hesap}|${row.cari ? Object.entries(ids).find(([, v]) => v === row.cari)?.[0] : ""}`, row.minor]));
    // 129 programın defterinde CARİSİZ (Karşılık Ayır B 654 / A 129 — lib/doubtful-gl.mjs); tur 1'in planı onu cari boyutunda bekliyordu → yanlış DURDURMA (bu turda düzeltildi).
    assert.deepEqual(cells, { "128|d1": 60000, "128|d2": 60000, "128|d3": 50000, "129|": -50000 });
    assert.deepEqual(job.result.plan.sorunlar, []);
    assert.deepEqual(job.result.onDenetim.durdurur.map(row => row.kod), []);
    assert.deepEqual([rowOf("d2").kBakiyeMinor, rowOf("d2").acikKalemSayisi, rowOf("d3").kBakiyeMinor, rowOf("d3").acikKalemSayisi], [0, 0, 0, 0]);
  });

  it("BM-1 (SABİT — kâhin sonucu beklenir; davranış değişmez): D1 Borç Toplamı 600,00 · Alacak Toplamı 600,00 · açık kalem S1 400,00 (vade 01.11); CH K bakiyesi 400,00", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(rowOf("d1").kBakiyeMinor, 40000);
    assert.deepEqual(rows("d1"), [["borc-toplami", "debt", 60000, ""], ["alacak-toplami", "credit", 60000, ""], ["acik-kalem", "debt", 40000, "2026-11-01"]]);
  });

  it("(f) K'den SONRA Borçta Kalsın: kart K'de AÇIK, ödenen 300 / kalan 900; taksitler 2–4 300'er; kartın taşıdığı kalem açık kalem DEĞİL; ≤K Borçta Kalsın kartı KAPALI, kalanı açık kalem 2 × 300 (vade 15.11 / 15.12)", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const kc = job.result.plan.newYear.kartlar.find(row => row.kart === ids.kart);
    assert.deepEqual([kc.durum, kc.odenenMinor, kc.kalanMinor, kc.kapanisKurali], ["acik", 30000, 90000, "keep"]);
    assert.deepEqual(kc.taksitler.map(row => [row.sira, row.kalanMinor]), [[1, 0], [2, 30000], [3, 30000], [4, 30000]]);
    assert.equal(rowOf("kc").acikKalemSayisi, 0);
    const kd = job.result.plan.newYear.kartlar.find(row => row.kart === ids.kart2);
    assert.deepEqual([kd.durum, kd.kalanMinor], ["kapali", 0]);
    assert.deepEqual(rowOf("kd").satirlar.filter(row => row.tur === "acik-kalem").map(row => [row.kalemSinifi, row.tutarMinor, row.vade]), [["kart-kalani", 30000, "2026-11-15"], ["kart-kalani", 30000, "2026-12-15"]]);
  });

  it("(f) DEVİRSİZ EŞDEĞER (taksitler): planın taksit vadesi ve kalanı = devirsiz programın bugünkü taksitleri (S205 = A: Borçta Kalsın kalemin vadesi MIN(asıl, kapanış günü 10.01.2027) — elle)", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const kc = job.result.plan.newYear.kartlar.find(row => row.kart === ids.kart);
    const eq = fixture.createEquivalence(ctx.store);
    const today = eq.devirsiz(ids.kc, "2027-02-10");
    const program = [...(today.installments.get(ids.kart) || new Map())].filter(([key]) => key !== "rest" && key !== "back").map(([, row]) => [row.seq, row.vade, Math.round(row.remaining * 100)]).sort((a, b) => a[0] - b[0]);
    assert.deepEqual(kc.taksitler.map(row => [row.sira, row.vade, row.kalanMinor]), program);
    assert.deepEqual(kc.taksitler.filter(row => row.kalanMinor > 0).map(row => row.vade), ["2026-12-01", "2027-01-01", "2027-01-10"], "elle (S205 = A)");
    // gecikmiş(t): taksitlerin kalanı vade < t → 11.01'de 900,00, 10.01'de 600,00 (taksit 4'ün vadesi 10.01 — vade günü gecikmiş değil, M1f).
    assert.equal(Math.round(today.overdue("2027-01-11").amount * 100), 90000);
    assert.equal(Math.round(today.overdue("2027-01-10").amount * 100), 60000);
  });

  it("BM-6: ödeme rolündeki açık kalem ÖDEME satırı yazmaya yetecek alanları taşır — rol, asıl tarih (vade), tutar, yön, karşı kalem (kaynak satırın kimliği, veri tabanında)", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const [item] = rowOf("v").satirlar.filter(row => row.tur === "acik-kalem");
    assert.deepEqual([item.rol, item.vade, item.tutarMinor, item.yon, item.belge.tarih, item.belge.satirId, item.kaynakKimlik], ["odeme", "2026-11-10", 50000, "debt", "2026-11-10", ids.avans, `line:${ids.avans}`]);
    const db = ctx.store.get("SELECT kind, amount, date FROM account_entries WHERE id = ?", item.belge.satirId);
    assert.deepEqual([db.kind, Number(db.amount), db.date], ["out", 500, "2026-11-10"]);
  });
});
