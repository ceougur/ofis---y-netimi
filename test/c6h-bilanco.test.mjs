// 2.5.0 Ç6-HESAP tur 2 — Bilanço HESABI (docs/erp/C6-HESAP-TASARIM.md §6, §7; kural kitabı §4, §7.2, §7.3, §7.4, §8; KG-11 A, KG-12 A, KG-14 A; EK-1 M4; EK-2 S. 36).
// Girdi: yevmiye maddeleri el ile (book() biçimi, kuruş). BEKLENENLER ELLE HESAPLANDI (aşağıda yazılı; kitabın formülüyle), programın çıktısından değil.
//
// 2025 (kapanmamış önceki yıl):
//   02.01 Kasa açılışı B 100 / A 519 100.000          01.03 alış B 153 50.000, B 191 10.000 / A 320 (S1) 60.000 (stok: P 10 Adet × 50,00)
//   01.05 satış B 120 (C1) 120.000 / A 600 100.000, A 391 20.000 (stok: P −6)       01.06 kasa gideri B 770 (770.90) 5.000 / A 100 5.000
//   DSS_2025 = 4 × 50,00 = 200,00 → T_2025 = 0 + 500,00 − 200,00 = 300,00; 2025 sonucu = 1.000 − 300 − 50 = 650,00 (kâr → 570 kısmı).
// 2026 (t = 30.06.2026):
//   10.01 C1'den fazla tahsilat B 100 / A 120 (C1) 150.000 → C1 = −300,00 (alacaklı → III.D 340)
//   15.01 S1'e fazla ödeme B 320 (S1) / A 100 70.000 → S1 = +100,00 (borçlu → I.E 159)
//   01.02 satış B 120 (C2) 24.000 / A 600 20.000, A 391 4.000 (stok: P −2)
//   10.02 banka masrafı B 770 / A 102 (102.01) 3.000 → 102.01 = −30,00 (KMH → III.A 300)   11.02 banka faizi B 102 (102.02) / A 649 8.000
//   01.03 vergi ödemesi B 360 / A 100 2.000 → 360 borçlu 20,00 (KG-14 A → I.H 198 + Kesin Değil)
//   04.03 tedarikçi S2 gideri B 770 / A 320 (S2) 5.000; 05.03 S2'ye çek B 320 (S2) / A 103 5.000 → 103 = −50,00 (düzenleyici, I.A içinde eksi)
//   DSS_t: miktar 2, birim (200 + 0) / 4 = 50,00 → 100,00; T_2026(t) = 200,00 + 0 − 100,00 = 100,00.
//   Gelir Tablosu [01.01.2026, 30.06.2026]: A 200,00 · D 100,00 (tahmini) · E 632 ← 770 30 + 50 = 80,00 · F 649 80,00 → Dönem Net Kârı 100,00.
// Bilanço 30.06.2026:
//   AKTİF I.A 100 1.730,00 + 102.02 80,00 + 103 −50,00 = 1.760,00 · I.C 120 (C2) 240,00 · I.E 153 100,00 (tahmini) + 159 ← 320 (S1) 100,00 = 200,00 · I.H 191 100,00 + 198 ← 360 20,00 = 120,00
//         → 2.320,00
//   PASİF III.A 300 ← 102.01 30,00 · III.D 340 ← 120 (C1) 300,00 · III.I 391 240,00 · V.F hesaplanmış 100,00 · Geçmiş Yıllar — Kapanmamış 570 (2025) 650,00 · V.G 519 1.000,00 → 2.320,00
//   Kesin Değil: tamamlanmamis-acilis, smm-tahmini, borclu-360, kapanmamis-yil (2025).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { balanceSheet, incomeStatement } from "../server/lib/financial-statements.mjs";
import { MOVE_CLASS, createStockValuation } from "../server/lib/stock-valuation.mjs";

const L = (account, debit, credit, sub = "", party = "") => ({ account, debit, credit, ...(sub ? { sub } : {}), ...(party ? { party } : {}) });
const E = (id, date, ...lines) => ({ id, date, source: "test", text: id, lines });
const Y2025 = [
  E("cash:a", "2025-01-02", L("100", 100000, 0), L("519", 0, 100000)),
  E("invoice:a1", "2025-03-01", L("153", 50000, 0), L("191", 10000, 0), L("320", 0, 60000, "", "S1")),
  E("invoice:s1", "2025-05-01", L("120", 120000, 0, "", "C1"), L("600", 0, 100000), L("391", 0, 20000)),
  E("cash:g", "2025-06-01", L("770", 5000, 0, "770.90"), L("100", 0, 5000)),
];
const Y2026 = [
  E("account:t1", "2026-01-10", L("100", 150000, 0), L("120", 0, 150000, "", "C1")),
  E("account:o1", "2026-01-15", L("320", 70000, 0, "", "S1"), L("100", 0, 70000)),
  E("invoice:s2", "2026-02-01", L("120", 24000, 0, "", "C2"), L("600", 0, 20000), L("391", 0, 4000)),
  E("bank:m", "2026-02-10", L("770", 3000, 0), L("102", 0, 3000, "102.01")),
  E("bank:f", "2026-02-11", L("102", 8000, 0, "102.02"), L("649", 0, 8000)),
  E("bank:v", "2026-03-01", L("360", 2000, 0), L("100", 0, 2000)),
  E("invoice:g2", "2026-03-04", L("770", 5000, 0), L("320", 0, 5000, "", "S2")),
  E("cheque:c", "2026-03-05", L("320", 5000, 0, "", "S2"), L("103", 0, 5000)),
];
const ENTRIES = [...Y2025, ...Y2026];
const MOVES = [
  { itemId: "P", date: "2025-03-01", cls: MOVE_CLASS.purchase, qtyMilli: 10000, valueMinor: 50000 },
  { itemId: "P", date: "2025-05-01", cls: MOVE_CLASS.quantity, qtyMilli: -6000, valueMinor: 0 },
  { itemId: "P", date: "2026-02-01", cls: MOVE_CLASS.quantity, qtyMilli: -2000, valueMinor: 0 },
];
const VALUATION = (moves = MOVES) => createStockValuation({ items: [{ id: "P", code: "P", name: "Ürün P", unit: "Adet", unitPriceE4: 500000, deletedDay: "" }], moves });
const bs = (date, extra = {}) => balanceSheet({ entries: ENTRIES, valuation: VALUATION(), date, bookType: "balance", closedOn: "", ...extra });
const itemOf = (out, kod) => [...out.aktif.gruplar, ...out.pasif.gruplar].flatMap(grup => grup.kalemler).find(row => row.kod === kod);
const rowOf = (out, kod, hesap) => itemOf(out, kod).hesaplar.find(row => row.hesap === hesap);
const amounts = out => Object.fromEntries([...out.aktif.gruplar, ...out.pasif.gruplar].flatMap(grup => grup.kalemler).filter(row => row.tutarMinor !== 0).map(row => [row.kod, row.tutarMinor]));

describe("Ç6-HESAP Bilanço — elle hesaplanmış örnek (30.06.2026; kapanmamış 2025)", () => {
  it("kalemler: brütleştirme (alacaklı 120 → 340, borçlu 320 → 159, KMH 102 → 300, borçlu 360 → 198), düzenleyici 103 eksi, 153 = DSS_t, Aktif = Pasif", () => {
    const out = bs("2026-06-30");
    assert.deepEqual(amounts(out), { "I.A": 176000, "I.C": 24000, "I.E": 20000, "I.H": 12000, "III.A": 3000, "III.D": 30000, "III.I": 24000, "V.F": 10000, "V.GY": 65000, "V.G": 100000 });
    assert.deepEqual(out.toplamlar, { aktifMinor: 232000, pasifMinor: 232000, farkMinor: 0 });
    assert.equal(out.fark, null);
    assert.deepEqual(rowOf(out, "I.A", "102").altlar.map(row => [row.hesap, row.tutarMinor]), [["102.02", 8000]], "yalnız borçlu alt hesap kendi kaleminde");
    assert.equal(rowOf(out, "I.A", "103").tutarMinor, -5000, "düzenleyici hesap kendi kaleminde eksi");
    assert.equal(rowOf(out, "I.C", "120").tutarMinor, 24000, "netleştirme yok: C1'in alacağı C2'den düşülmez");
    assert.equal(rowOf(out, "I.C", "120").cariSayisi, 1);
    assert.deepEqual(rowOf(out, "III.D", "340").kaynaklar.map(row => [row.hesap, row.adet, row.tutarMinor]), [["120", 1, 30000]]);
    assert.deepEqual(rowOf(out, "I.E", "159").kaynaklar.map(row => [row.hesap, row.tutarMinor]), [["320", 10000]]);
    assert.deepEqual(rowOf(out, "III.A", "300").kaynaklar.map(row => [row.hesap, row.tutarMinor]), [["102", 3000]]);
    assert.deepEqual(rowOf(out, "I.H", "198").kaynaklar.map(row => [row.hesap, row.tutarMinor]), [["360", 2000]]);
    assert.equal(rowOf(out, "III.B", "320"), undefined, "S2'nin bakiyesi 0, S1 159'da");
    const stock = rowOf(out, "I.E", "153");
    assert.deepEqual([stock.tutarMinor, stock.tahmini, stock.ad], [10000, true, "Ticari Mallar (Tahmini Değerleme)"]);
    assert.equal(rowOf(out, "V.G", "519").tutarMinor, 100000);
  });
  it("hesaplanmış Dönem Net Kârı = aynı t'nin Gelir Tablosu (1 Ocak – t) Dönem Net Kârı; Geçmiş Yıllar — Kapanmamış yıl yıl (2025 kâr → 570 kısmı)", () => {
    const out = bs("2026-06-30");
    const gt = incomeStatement({ entries: ENTRIES, valuation: VALUATION(), from: "2026-01-01", to: "2026-06-30", bookType: "balance" });
    assert.equal(gt.subtotals.donemNetKari, 10000, "elle: 200 − 100 − 80 + 80");
    assert.deepEqual(out.hesaplanmis.donemNetKari, { yil: 2026, from: "2026-01-01", to: "2026-06-30", tutarMinor: gt.subtotals.donemNetKari, tahmini: true });
    assert.deepEqual(out.hesaplanmis.gecmisYillar, [{ yil: 2025, tutarMinor: 65000, tahmini: true }]);
    assert.deepEqual(itemOf(out, "V.GY").hesaplar.map(row => [row.hesap, row.tutarMinor, row.yillar.map(y => y.yil)]), [["570", 65000, [2025]]]);
    const vf = itemOf(out, "V.F").hesaplar.find(row => row.hesaplanmis);
    assert.deepEqual([vf.ad, vf.tutarMinor], ["Dönem Net Kârı (Zararı)", 10000]);
  });
  it("Kesin Değil (TEK toplayıcı, kitap §7.4 sırası): açılış, tahmin, borçlu 360, kapanmamış yıl", () => {
    const out = bs("2026-06-30");
    assert.deepEqual(out.kesinDegil.map(row => row.kod), ["tamamlanmamis-acilis", "smm-tahmini", "borclu-360", "kapanmamis-yil"]);
    assert.deepEqual(out.kesinDegil.find(row => row.kod === "kapanmamis-yil").ayrinti, ["2025"]);
    assert.ok(out.footnotes.some(row => row.kod === "kredi-vade"), "Bilanço dipnotu 4");
  });
  it("iç tutarlılık: hesap başına bilançoda gösterilen = defter bakiyesi (153 hariç: DSS_t); brütleştirme yalnız kalem değiştirir", () => {
    const out = bs("2026-06-30");
    const book = new Map();
    for (const entry of ENTRIES) for (const line of entry.lines) if (/^[1-5]/.test(line.account)) book.set(line.account, (book.get(line.account) || 0) + line.debit - line.credit);
    for (const row of out.accounts) {
      assert.equal(row.defterMinor, book.get(row.hesap), row.hesap);
      assert.equal(row.bilancoMinor, row.hesap === "153" ? 10000 : row.defterMinor, row.hesap);
    }
    assert.deepEqual(out.accounts.find(row => row.hesap === "120").dagilim.map(part => [part.kalem, part.hesap, part.minor]), [["I.C", "120", 24000], ["III.D", "340", -30000]]);
    assert.equal(out.smm.defter153Minor, 50000);
  });
  it("yıl ortası t (2026-02-28): T(t) aynı işlevden; Aktif = Pasif", () => {
    const out = bs("2026-02-28");
    assert.equal(out.toplamlar.farkMinor, 0);
    const gt = incomeStatement({ entries: ENTRIES, valuation: VALUATION(), from: "2026-01-01", to: "2026-02-28", bookType: "balance" });
    assert.equal(out.hesaplanmis.donemNetKari.tutarMinor, gt.subtotals.donemNetKari);
    assert.equal(out.hesaplanmis.donemNetKari.tutarMinor, 20000 - 10000 - 3000 + 8000, "elle: satış 200 − maliyet 100 − masraf 30 + faiz 80");
  });
});

describe("Ç6-HESAP Bilanço — kapanmış yıl, ters kayıt, boş veri, tarih", () => {
  // 2025 kapanışı (EK-1 M4 sırası, elle): N-01 B 621 / A 153 30.000 (153 = DSS 200,00); kapanış B 600 100.000 / A 621 30.000, A 770 5.000, A 590 65.000.
  const CLOSE = [E("voucher-end:n01", "2025-12-31", L("621", 30000, 0), L("153", 0, 30000)), E("voucher-close:k1", "2025-12-31", L("600", 100000, 0), L("621", 0, 30000), L("770", 0, 5000, "770.90"), L("590", 0, 65000))];
  it("kapanmış 2025: Geçmiş Yıllar — Kapanmamış'a GİRMEZ, sonucu 590'da (V.F); Aktif = Pasif; kapanmamis-yil yok", () => {
    const out = balanceSheet({ entries: [...ENTRIES, ...CLOSE], valuation: VALUATION(), date: "2026-06-30", bookType: "balance", closedOn: "2025-12-31" });
    assert.deepEqual(out.hesaplanmis.gecmisYillar, []);
    assert.equal(itemOf(out, "V.GY").tutarMinor, 0);
    assert.equal(rowOf(out, "V.F", "590").tutarMinor, 65000);
    assert.equal(itemOf(out, "V.F").tutarMinor, 65000 + 10000);
    assert.deepEqual(out.toplamlar, { aktifMinor: 232000, pasifMinor: 232000, farkMinor: 0 });
    assert.ok(!out.kesinDegil.some(row => row.kod === "kapanmamis-yil"));
    assert.equal(out.smm.closedYear, 2025);
  });
  it("kapanış fişi ters kaydedilmiş (closedOn boş): 2025 kapanmamış sayılır, sonucu 570 kısmında; 590 = 0; Aktif = Pasif", () => {
    const reversal = E("voucher-close:k1r", "2026-01-05", L("600", 0, 100000), L("621", 30000, 0), L("770", 5000, 0, "770.90"), L("590", 65000, 0));
    const out = balanceSheet({ entries: [...ENTRIES, ...CLOSE, reversal], valuation: VALUATION(), date: "2026-06-30", bookType: "balance", closedOn: "" });
    assert.deepEqual(out.hesaplanmis.gecmisYillar, [{ yil: 2025, tutarMinor: 65000, tahmini: false }], "2025'in maliyeti N-01'in 621'i (kesin)");
    assert.equal(out.toplamlar.farkMinor, 0);
  });
  it("t = 31.12 ve yıl kapanmış: hesaplanmış satır YOK, 153 defterden (N-01 sonrası = DSS)", () => {
    const out = balanceSheet({ entries: [...Y2025, ...CLOSE], valuation: VALUATION(), date: "2025-12-31", bookType: "balance", closedOn: "2025-12-31" });
    assert.equal(out.hesaplanmis.donemNetKari, null);
    assert.equal(rowOf(out, "I.E", "153").tutarMinor, 20000);
    assert.equal(rowOf(out, "I.E", "153").tahmini, undefined);
    assert.equal(out.toplamlar.farkMinor, 0);
    assert.ok(!out.kesinDegil.some(row => row.kod === "smm-tahmini"));
  });
  it("boş veri: bütün kalemler 0, Aktif = Pasif = 0, Kesin Değil yok", () => {
    const out = balanceSheet({ entries: [], valuation: createStockValuation({}), date: "2026-06-30", bookType: "balance", closedOn: "" });
    assert.deepEqual(out.toplamlar, { aktifMinor: 0, pasifMinor: 0, farkMinor: 0 });
    assert.deepEqual(out.kesinDegil, []);
    assert.deepEqual(out.hesaplanmis, { donemNetKari: { yil: 2026, from: "2026-01-01", to: "2026-06-30", tutarMinor: 0, tahmini: false }, gecmisYillar: [] });
  });
  it("tek kayıt: yalnız Kasa açılışı → 100 = 519", () => {
    const out = balanceSheet({ entries: [Y2025[0]], valuation: createStockValuation({}), date: "2025-01-02", bookType: "balance", closedOn: "" });
    assert.deepEqual(amounts(out), { "I.A": 100000, "V.G": 100000 });
    assert.deepEqual(out.kesinDegil.map(row => row.kod), ["tamamlanmamis-acilis"]);
  });
  it("t'den sonraki madde sayılmaz (ileri tarihli hareket); bir gün önce farklı", () => {
    const at = bs("2026-01-14");
    const before = bs("2026-01-09");
    assert.equal(rowOf(at, "III.D", "340").tutarMinor, 30000);
    assert.equal(rowOf(before, "III.D", "340"), undefined, "10.01 tahsilatından önce C1 borçlu");
    assert.equal(rowOf(before, "I.C", "120").tutarMinor, 120000);
    assert.equal(before.toplamlar.farkMinor, 0);
  });
  it("aynı gün kayıtlarının sırası sonucu değiştirmez (ders 31)", () => {
    const shuffled = [...ENTRIES].reverse();
    assert.deepEqual(balanceSheet({ entries: shuffled, valuation: VALUATION(), date: "2026-06-30", bookType: "balance", closedOn: "" }), bs("2026-06-30"));
  });
  it("geçersiz tarih 400 (29 Şubat 2026 yok); 29 Şubat 2028 geçerli", () => {
    assert.throws(() => bs("2026-02-29"), error => error.status === 400 && error.code === "bilanco-tarih");
    assert.equal(bs("2028-02-29").toplamlar.farkMinor, 0);
  });
  it("Bilgi Amaçlı: Defter Türü bilanço esası değil", () => {
    const out = bs("2026-06-30", { bookType: "operating" });
    assert.equal(out.bilgiAmacli, true);
    assert.equal(out.kesinDegil.at(-1).kod, "bilgi-amacli");
  });
});

describe("Ç6-HESAP Bilanço — imkânsız ters bakiye, eksi stok, 127", () => {
  it("eksi kasa ve borçlu 300 (kesinDegil kuralı): kendi kaleminde işaretli + İmkânsız Ters Bakiye", () => {
    const entries = [E("cash:x", "2026-01-05", L("770", 1000, 0), L("100", 0, 1000)), E("bank:y", "2026-01-06", L("300", 4000, 0, "300.01"), L("649", 0, 4000))];
    const out = balanceSheet({ entries, valuation: createStockValuation({}), date: "2026-01-31", bookType: "balance", closedOn: "" });
    assert.equal(rowOf(out, "I.A", "100").tutarMinor, -1000);
    assert.equal(rowOf(out, "III.A", "300").tutarMinor, -4000, "borçlu kredi hesabı Mali Borçlar'da eksi");
    assert.deepEqual(out.kesinDegil.find(row => row.kod === "eksi-bakiye").ayrinti, ["100 Kasa (Nakit): −10,00 TL", "300 Banka Kredileri (300.01): 40,00 TL"]);
    assert.equal(out.toplamlar.farkMinor, 0);
  });
  it("eksi stok (KG-9): ürün değeri 0, Kesin Değil; Aktif = Pasif (fark dönem sonucunda)", () => {
    const valuation = createStockValuation({ items: [{ id: "N", code: "N", name: "Ürün N", unit: "Adet", unitPriceE4: 0, deletedDay: "" }], moves: [{ itemId: "N", date: "2026-01-02", cls: MOVE_CLASS.purchase, qtyMilli: 1000, valueMinor: 1000 }, { itemId: "N", date: "2026-01-10", cls: MOVE_CLASS.quantity, qtyMilli: -3000, valueMinor: 0 }] });
    const entries = [E("invoice:n", "2026-01-02", L("153", 1000, 0), L("320", 0, 1000, "", "S"))];
    const out = balanceSheet({ entries, valuation, date: "2026-01-31", bookType: "balance", closedOn: "" });
    assert.equal(rowOf(out, "I.E", "153"), undefined, "DSS = 0");
    assert.deepEqual(out.kesinDegil.find(row => row.kod === "eksi-stok").ayrinti, ["Ürün N (-2 Adet)"]);
    assert.equal(out.hesaplanmis.donemNetKari.tutarMinor, -1000);
    assert.equal(out.toplamlar.farkMinor, 0);
  });
  it("alacaklı 127 (carisiz taksit kartı) kart bazında III.D 340'a (EK-2 S. 36; tasarım §10 B-f); borçlu kart 127'de kalır", () => {
    const entries = [
      E("plan:a", "2026-01-02", L("127", 10000, 0, "", "plan:a"), L("602", 0, 10000)),
      E("plan-entry:a1", "2026-01-03", L("100", 12000, 0), L("127", 0, 12000, "", "plan:a")),
      E("plan:b", "2026-01-04", L("127", 5000, 0, "", "plan:b"), L("602", 0, 5000)),
    ];
    const out = balanceSheet({ entries, valuation: createStockValuation({}), date: "2026-01-31", bookType: "balance", closedOn: "" });
    assert.equal(rowOf(out, "I.C", "127").tutarMinor, 5000);
    assert.deepEqual(rowOf(out, "III.D", "340").kaynaklar.map(row => [row.hesap, row.tutarMinor]), [["127", 2000]]);
    assert.equal(out.toplamlar.farkMinor, 0);
  });
  it("borçlu 336 cari (iki alt hesaplı satır) TEK grup: I.D 136'ya, kaynak adedi 1, alt hesap kırılımı korunur", () => {
    const entries = [E("account:d1", "2026-01-05", L("336", 3000, 0, "336.90", "P1"), L("649", 0, 3000)), E("account:d2", "2026-01-06", L("336", 2000, 0, "", "P1"), L("649", 0, 2000))];
    const out = balanceSheet({ entries, valuation: createStockValuation({}), date: "2026-01-31", bookType: "balance", closedOn: "" });
    const row = rowOf(out, "I.D", "136");
    assert.deepEqual([row.tutarMinor, row.cariSayisi, row.kaynaklar.map(source => [source.hesap, source.adet, source.tutarMinor]), row.altlar.map(part => [part.hesap, part.tutarMinor])], [5000, 1, [["336", 1, 5000]], [["336.90", 3000]]]);
    assert.equal(out.toplamlar.farkMinor, 0);
  });
});

describe("Ç6-HESAP Bilanço — Kesin Değil'in tur 2 nedenleri (B-d, Aktif ≠ Pasif, Kural Değişikliği Farkı)", () => {
  it("dengesiz madde: fark satırı (kayıt değil) + 'Defter Mutabakatı Farkı ya da Dengesiz Madde' + 'Aktif ile Pasif Eşit Değil' (elle: B 100 5,00 / A 600 4,00 → fark 1,00)", () => {
    const out = balanceSheet({ entries: [...ENTRIES, E("cash:bozuk", "2026-04-01", L("100", 500, 0), L("600", 0, 400))], valuation: VALUATION(), date: "2026-06-30", bookType: "balance", closedOn: "" });
    assert.deepEqual(out.toplamlar, { aktifMinor: 232500, pasifMinor: 232400, farkMinor: 100 });
    assert.deepEqual(out.fark, { ad: "Aktif ile Pasif Arasındaki Fark", tutarMinor: 100 });
    const codes = out.kesinDegil.map(row => row.kod);
    assert.deepEqual(codes.slice(0, 4), ["tamamlanmamis-acilis", "smm-tahmini", "defter-farki", "aktif-pasif-farki"]);
    assert.match(out.kesinDegil[2].aciklama, /1 madde/);
    assert.match(out.kesinDegil[3].aciklama, /1,00 TL/);
  });
  it("B-d: Defter Mutabakatı başarısızsa (ledger.check() → reconcile) neden + ayrıntı; verilmezse denetlenmemiş (neden yok); başarılıysa yok", () => {
    const failed = { ok: false, balanced: true, checks: [{ code: "120", name: "Alıcılar (Müşteri Carileri)", ok: false, ledger: 10, subledger: 12.5, difference: -2.5 }, { code: "100", name: "Kasa", ok: true }] };
    const out = bs("2026-06-30", { reconciliation: failed });
    const reason = out.kesinDegil.find(row => row.kod === "defter-farki");
    assert.match(reason.aciklama, /Defter Mutabakatı/);
    assert.deepEqual(reason.ayrinti, ["120 Alıcılar (Müşteri Carileri): defter 10,00 TL, alt defter 12,50 TL (fark −2,50 TL)"]);
    assert.ok(!bs("2026-06-30", { reconciliation: { ok: true, balanced: true, checks: [] } }).kesinDegil.some(row => row.kod === "defter-farki"));
    assert.ok(!bs("2026-06-30").kesinDegil.some(row => row.kod === "defter-farki"));
  });
  it("Kural Değişikliği Farkı (Ç3): t'ye kadarki yılların satırları; t'den sonraki yıl sayılmaz", () => {
    const ruleDiff = { balances: [{ year: 2025, account: "120", sub: "", party: "", differenceMinor: 100 }, { year: 2027, account: "600", sub: "", party: "", differenceMinor: 5 }] };
    const out = bs("2026-06-30", { ruleDiff });
    assert.deepEqual(out.kesinDegil.find(row => row.kod === "kural-farki").ayrinti, ["2025 · 120: 1,00 TL"]);
  });
});
