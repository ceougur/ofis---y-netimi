// 2.5.0 Ç6-HESAP tur 1 — Gelir Tablosu hesabı (docs/erp/C6-HESAP-TASARIM.md §4, §5, §7; kural kitabı §4, §7.1, §7.4, §7.5; KG-11 A, KG-13 A; EK-1 M6; çekirdek §13 7/A).
// Girdi: yevmiye maddeleri el ile (book() biçimi: { id, date, lines: [{ account, sub?, debit, credit }] }, kuruş). BEKLENENLER ELLE HESAPLANDI (aşağıda yazılı), programın çıktısından değil.
//
// 2026 maddeleri (kuruş):
//   01.05 alış B 153 60.000 / A 320 (stok: 10 Adet × 60,00)          01.15 satış B 120 / A 600 1.000.000, A 391 180.000 (stok: 4 Adet satıldı)
//   02.10 belgesiz satış A 600.90 50.000                              02.20 satıştan iade B 610 100.000
//   03.05 kasa gideri B 770.90 30.000                                 03.10 POS komisyonu B 653 4.000
//   03.15 carisiz kasa girişi A 649.90 7.000                          03.20 gecikme zammı B 689 1.000
//   03.25 faiz geliri A 642 2.000                                     03.31 reklam B 760 20.000
//   03.28 KAPANIŞ SINIFI (voucher-close) B 600 999.999 / A 690 — gelir tablosuna GİRMEZ
//   04.01 kredi faizi B 780 15.000 (çeyrek sınırı: Q1'de yok)
// Satışların maliyeti (tahmini; T(t) = DSS_(Y−1) + 153 hareketi [1 Ocak, t] − DSS_t): DSS_2025 = 0; 31.03 miktar 6 × 60 = 360,00 → T(31.03) = 0 + 600,00 − 360,00 = 240,00.
// Q1 [01.01, 31.03]: A = 10.000 + 500 = 10.500,00; B = 1.000,00; Net = 9.500,00; D = 240,00; BSK = 9.260,00; E = 631 (← 760) 200 + 632 (← 770.90) 300 = 500,00; FK = 8.760,00;
//   F = 642 20 + 649.90 70 = 90,00; G = 653 40,00; H = 0; OK = 8.810,00; I = 0; J = 689 10,00; DK = 8.800,00; K = 0; DNK = 8.800,00.
// Q2 [01.04, 30.06]: H = 660 (← 780) 150,00; SMM = T(30.06) − T(31.03) = 240 − 240 = 0; DNK = −150,00.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACCOUNT_PLAN, incomeStatementItemOf } from "../server/lib/general-ledger.mjs";
import { footnotes, incomeLineOf, incomeStatement, notFinalReasons } from "../server/lib/financial-statements.mjs";
import { MOVE_CLASS, createStockValuation } from "../server/lib/stock-valuation.mjs";

const L = (account, debit, credit, sub) => ({ account, debit, credit, ...(sub ? { sub } : {}) });
const E = (id, date, ...lines) => ({ id, date, source: "test", text: id, lines });
const ENTRIES = [
  E("invoice:a1", "2026-01-05", L("153", 60000, 0), L("320", 0, 60000)),
  E("invoice:s1", "2026-01-15", L("120", 1180000, 0), L("600", 0, 1000000), L("391", 0, 180000)),
  E("stock:b1", "2026-02-10", L("100", 50000, 0), L("600", 0, 50000, "600.90")),
  E("invoice:r1", "2026-02-20", L("610", 100000, 0), L("120", 0, 100000)),
  E("cash:g1", "2026-03-05", L("770", 30000, 0, "770.90"), L("100", 0, 30000)),
  E("bank:k1", "2026-03-10", L("653", 4000, 0), L("108", 0, 4000)),
  E("cash:i1", "2026-03-15", L("100", 7000, 0), L("649", 0, 7000, "649.90")),
  E("cash:z1", "2026-03-20", L("689", 1000, 0), L("100", 0, 1000)),
  E("bank:f1", "2026-03-25", L("102", 2000, 0), L("642", 0, 2000)),
  E("voucher-close:x1", "2026-03-28", L("600", 999999, 0), L("690", 0, 999999)),
  E("invoice:m1", "2026-03-31", L("760", 20000, 0), L("320", 0, 20000)),
  E("bank:c1", "2026-04-01", L("780", 15000, 0), L("102", 0, 15000)),
];
const VALUATION = () => createStockValuation({
  items: [{ id: "P", code: "P", name: "Ürün P", unit: "Adet", unitPriceE4: 600000, deletedDay: "" }],
  moves: [{ itemId: "P", date: "2026-01-05", cls: MOVE_CLASS.purchase, qtyMilli: 10000, valueMinor: 60000 }, { itemId: "P", date: "2026-01-15", cls: MOVE_CLASS.quantity, qtyMilli: -4000, valueMinor: 0 }],
});
const gt = (from, to, extra = {}) => incomeStatement({ entries: ENTRIES, valuation: VALUATION(), from, to, bookType: "balance", ...extra });
const item = (out, kod) => out.items.find(row => row.kod === kod);
const rowOf = (out, kod, hesap) => item(out, kod).hesaplar.find(row => row.hesap === hesap);

describe("Ç6-HESAP Gelir Tablosu — sınıflama hesap önekinden, planla tutarlı", () => {
  it("planda gelir tablosu kalemi olan her hesap önek sınıflamasıyla AYNI kaleme ve satıra düşer", () => {
    let checked = 0;
    for (const code of Object.keys(ACCOUNT_PLAN)) {
      const plan = incomeStatementItemOf(code);
      if (!plan) continue;
      const place = incomeLineOf(code);
      assert.deepEqual(place, { kalem: plan.kod, satir: plan.hesap }, code);
      checked += 1;
    }
    assert.ok(checked >= 20, `denetlenen hesap ${checked}`);
  });
  it("planda olmayan önekler: 601 A, 611 B, 661 H, 679 I; 690 / 692 / 650 sınıflanamaz; 1–5 sınıfı gelir tablosu dışı; alt hesap ana önekle", () => {
    assert.deepEqual(incomeLineOf("601"), { kalem: "A", satir: "601" });
    assert.deepEqual(incomeLineOf("611"), { kalem: "B", satir: "611" });
    assert.deepEqual(incomeLineOf("661"), { kalem: "H", satir: "661" });
    assert.deepEqual(incomeLineOf("679"), { kalem: "I", satir: "679" });
    assert.deepEqual(incomeLineOf("770.90"), { kalem: "E", satir: "632" });
    for (const code of ["690", "692", "650", "790"]) assert.equal(incomeLineOf(code), "unclassified", code);
    for (const code of ["100", "153", "391", "590"]) assert.equal(incomeLineOf(code), null, code);
  });
});

describe("Ç6-HESAP Gelir Tablosu — elle hesaplanmış örnek (Q1, Q2, yıl, aylar)", () => {
  it("Q1: kalemler, 7/A yansıtma, .90 alt satırlar, ara toplamlar, tahmini satışların maliyeti", () => {
    const out = gt("2026-01-01", "2026-03-31");
    assert.deepEqual(out.items.map(row => [row.kod, row.tutarMinor]), [["A", 1050000], ["B", 100000], ["D", 24000], ["E", 50000], ["F", 9000], ["G", 4000], ["H", 0], ["I", 0], ["J", 1000], ["K", 0]]);
    assert.deepEqual(out.subtotals, { netSatislar: 950000, brutSatisKari: 926000, faaliyetKari: 876000, olaganKar: 881000, donemKari: 880000, donemNetKari: 880000 });
    assert.deepEqual(rowOf(out, "A", "600").altlar.map(part => [part.hesap, part.tutarMinor]), [["600", 1000000], ["600.90", 50000]]);
    assert.deepEqual(rowOf(out, "E", "632").altlar.map(part => [part.hesap, part.ad, part.tutarMinor]), [["770.90", "Sınıflandırılmamış Kasa / Banka Giderleri", 30000]]);
    assert.deepEqual(rowOf(out, "E", "631").altlar.map(part => [part.hesap, part.tutarMinor]), [["760", 20000]]);
    assert.deepEqual(rowOf(out, "F", "649").altlar.map(part => [part.hesap, part.ad, part.tutarMinor]), [["649.90", "Sınıflandırılmamış Kasa Gelirleri", 7000]]);
    const cost = rowOf(out, "D", "621");
    assert.equal(cost.tahmini, true);
    assert.equal(cost.ad, "Satışların Maliyeti (Tahmini)");
    assert.equal(out.smm.minor, 24000);
    assert.equal(out.smm.dssMinor, 36000);
    assert.equal(out.smm.differenceMinor, 0, "153 defter hareketi = stok hareketlerinin tutarı");
    assert.equal(item(out, "K").tutarMinor, 0);
    assert.match(item(out, "K").aciklama, /vergi öncesi/);
    assert.deepEqual(out.kesinDegil.map(row => row.kod), ["smm-tahmini"]);
    assert.equal(out.bilgiAmacli, false);
  });
  it("Q2: 780 → 660 Finansman Giderleri; satışların maliyeti T(30.06) − T(31.03) = 0; kapanış sınıfı maddesi hiçbir dönemde yok", () => {
    const out = gt("2026-04-01", "2026-06-30");
    assert.equal(item(out, "H").tutarMinor, 15000);
    assert.deepEqual(rowOf(out, "H", "660").altlar.map(part => [part.hesap, part.tutarMinor]), [["780", 15000]]);
    assert.equal(item(out, "D").tutarMinor, 0);
    assert.equal(out.subtotals.donemNetKari, -15000);
    assert.equal(gt("2026-03-28", "2026-03-28").items.find(row => row.kod === "A").tutarMinor, 0, "kapanış sınıfı (voucher-close) gelir tablosuna girmez");
  });
  it("aylar toplamı = çeyrek = yıl (her kalem, satışların maliyeti dahil — EK-1 M6)", () => {
    const year = gt("2026-01-01", "2026-12-31");
    const months = [["01-01", "01-31"], ["02-01", "02-28"], ["03-01", "03-31"], ["04-01", "04-30"], ["05-01", "05-31"], ["06-01", "06-30"], ["07-01", "07-31"], ["08-01", "08-31"], ["09-01", "09-30"], ["10-01", "10-31"], ["11-01", "11-30"], ["12-01", "12-31"]]
      .map(([a, b]) => gt(`2026-${a}`, `2026-${b}`));
    for (const kod of ["A", "B", "D", "E", "F", "G", "H", "J"]) assert.equal(months.reduce((sum, out) => sum + item(out, kod).tutarMinor, 0), item(year, kod).tutarMinor, kod);
    assert.equal(months.reduce((sum, out) => sum + out.subtotals.donemNetKari, 0), year.subtotals.donemNetKari);
    assert.equal(item(months[0], "D").tutarMinor, 24000, "Ocak: T(31.01) = 600 − 360 = 240,00");
    assert.equal(year.subtotals.donemNetKari, 880000 - 15000);
    const q1 = gt("2026-01-01", "2026-03-31");
    const q2 = gt("2026-04-01", "2026-06-30");
    const h1 = gt("2026-01-01", "2026-06-30");
    assert.equal(q1.subtotals.donemNetKari + q2.subtotals.donemNetKari, h1.subtotals.donemNetKari);
  });
  it("dönem sınırı: 31.03 maddesi Q1'de, 01.04 maddesi Q2'de (bir gün kaydırma yakalanır)", () => {
    assert.equal(item(gt("2026-03-31", "2026-03-31"), "E").tutarMinor, 20000);
    assert.equal(item(gt("2026-04-01", "2026-04-01"), "H").tutarMinor, 15000);
    assert.equal(item(gt("2026-04-02", "2026-04-30"), "H").tutarMinor, 0);
    assert.equal(item(gt("2026-01-01", "2026-03-30"), "E").tutarMinor, 30000);
  });
  it("boş dönem: bütün kalemler 0, Kesin Değil yok (stok etkilenmedi), dipnotlar var", () => {
    const out = incomeStatement({ entries: [], valuation: createStockValuation({}), from: "2026-01-01", to: "2026-12-31", bookType: "balance" });
    assert.ok(out.items.every(row => row.tutarMinor === 0 && row.hesaplar.length === 0));
    assert.deepEqual(out.kesinDegil, []);
    assert.deepEqual(out.footnotes.map(row => row.kod), ["yasal-degil", "donem-sonu", "kasa-banka-gider"]);
    assert.equal(out.smm.estimated, false);
  });
  it("tek kayıt: yalnız bir satış faturası", () => {
    const out = incomeStatement({ entries: [ENTRIES[1]], valuation: createStockValuation({}), from: "2026-01-01", to: "2026-01-31", bookType: "balance" });
    assert.equal(out.subtotals.donemNetKari, 1000000);
    assert.equal(out.entryCount, 1);
  });
});

describe("Ç6-HESAP Gelir Tablosu — Kesin Değil, dipnotlar, hata", () => {
  it("dengesiz madde, sınıflandırılmamış hesap (690 olağan maddede), Kural Değişikliği Farkı (yıl satırı), Bilgi Amaçlı — TEK toplayıcı sırası", () => {
    const entries = [...ENTRIES, E("cash:bozuk", "2026-02-02", L("100", 500, 0), L("600", 0, 400)), E("voucher:y", "2026-02-03", L("690", 300, 0), L("100", 0, 300))];
    const ruleDiff = { balances: [{ year: 2026, account: "602", sub: "", party: "", frozenMinor: 0, liveMinor: -100, differenceMinor: -100 }, { year: 2024, account: "600", sub: "", party: "", differenceMinor: 5 }] };
    const out = incomeStatement({ entries, valuation: VALUATION(), from: "2026-01-01", to: "2026-03-31", bookType: "professional", ruleDiff });
    assert.deepEqual(out.kesinDegil.map(row => row.kod), ["smm-tahmini", "defter-farki", "kural-farki", "siniflandirilmamis-hesap", "bilgi-amacli"]);
    assert.match(out.kesinDegil[1].aciklama, /1 madde/);
    assert.deepEqual(out.kesinDegil[2].ayrinti, ["2026 · 602: −1,00 TL"], "yalnız dönemin yılı");
    assert.deepEqual(out.kesinDegil[3].ayrinti, ["690: 3,00 TL"]);
    assert.equal(out.bilgiAmacli, true);
    assert.ok(out.footnotes.some(row => row.kod === "serbest-meslek"));
    assert.equal(item(out, "A").tutarMinor, 1050400, "dengesiz maddenin 600 satırı yine sayılır (gizlenmez)");
  });
  it("eksi stok (KG-9) Kesin Değil nedeni", () => {
    const valuation = createStockValuation({ items: [{ id: "N", code: "N", name: "Ürün N", unit: "Adet", unitPriceE4: 0, deletedDay: "" }], moves: [{ itemId: "N", date: "2026-01-10", cls: MOVE_CLASS.quantity, qtyMilli: -3000, valueMinor: 0 }] });
    const out = incomeStatement({ entries: [], valuation, from: "2026-01-01", to: "2026-01-31", bookType: "balance" });
    assert.deepEqual(out.kesinDegil.map(row => [row.kod, row.ayrinti]), [["smm-tahmini", undefined], ["eksi-stok", ["Ürün N (-3 Adet)"]]]);
  });
  it("yılda 621 hareketi (N-01 yazılmış) varsa o yıl kesin: tahmin eklenmez, defterdeki 621 D kaleminde", () => {
    const entries = [...ENTRIES, E("voucher-end:n1", "2026-12-31", L("621", 24000, 0), L("153", 0, 24000))];
    const out = incomeStatement({ entries, valuation: VALUATION(), from: "2026-01-01", to: "2026-12-31", bookType: "balance" });
    assert.equal(out.smm.estimated, false);
    assert.deepEqual(item(out, "D").hesaplar.map(row => [row.hesap, row.tutarMinor, Boolean(row.tahmini)]), [["621", 24000, false]]);
    assert.ok(!out.kesinDegil.some(row => row.kod === "smm-tahmini"));
    assert.equal(out.smm.stockFlowMinor, 60000, "153 akışı N-01 (dönem sonu sınıfı) maddesini saymaz");
    assert.equal(out.smm.differenceMinor, 0);
  });
  it("dipnot 3 (770.90 tutarı) ve dipnot 6 (.90 gelir / gider)", () => {
    const out = gt("2026-01-01", "2026-03-31");
    const cash = out.footnotes.find(row => row.kod === "kasa-banka-gider");
    assert.equal(cash.tutarMinor, 30000);
    assert.match(cash.metin, /\(300,00 TL\)/);
    const other = out.footnotes.find(row => row.kod === "siniflandirilmamis");
    assert.deepEqual([other.gelirMinor, other.giderMinor], [57000, 30000]);
    assert.deepEqual(footnotes({ balanceSheet: true }).map(row => row.kod), ["yasal-degil", "donem-sonu", "kasa-banka-gider", "kredi-vade"]);
  });
  it("çapraz yıl ve geçersiz aralık 400 (kodlanmadı — tasarım §10 S-b)", () => {
    assert.throws(() => gt("2025-12-01", "2026-01-31"), error => error.status === 400 && error.code === "gelir-tablosu-tek-yil");
    assert.throws(() => gt("2026-03-01", "2026-02-01"), error => error.status === 400 && error.code === "gelir-tablosu-aralik");
    assert.throws(() => gt("2026-02-30", "2026-03-01"), error => error.status === 400);
  });
  it("toplayıcı: verilmeyen bulgu neden yazmaz; Bilanço nedenleri aynı işlevden (tur 2)", () => {
    assert.deepEqual(notFinalReasons({}), []);
    assert.deepEqual(notFinalReasons({ openingMinor: 100, debitTax: true, openYears: [2024], bookType: "unset" }).map(row => row.kod), ["tamamlanmamis-acilis", "borclu-360", "kapanmamis-yil", "bilgi-amacli"]);
  });
});
