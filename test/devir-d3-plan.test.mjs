// 2.5.1 D3 — devir planının saf hesabı, ELLE HESAPLANMIŞ örneklerle (docs/devir/D3-D4-TASARIM.md §3.5–§3.8, §3.12 (a)). Girdi: yevmiye maddeleri el ile (book() biçimi, kuruş),
// değerleme hareketleri ve tek borç sırasının (TYK) K'deki kalemleri el ile. BEKLENENLER ELLE (kural kitabının formülleriyle; programın çıktısından DEĞİL) — aşağıda yazılı.
//
// ÖRNEK A (K = 31.12.2026; 2025 kapanmamış önceki yıl; 7/A; 691 ≠ 0):
//   2025: 02.01 Kasa açılışı B 100 / A 519 1.000,00 · 01.03 alış B 153 500,00 + B 191 100,00 / A 320 (S1) 600,00 (P 10 Adet × 50,00) · 01.05 satış B 120 (C1) 1.200,00 / A 600 1.000,00 + A 391 200,00 (P −6)
//         · 01.06 Kasa gideri B 770 (770.90) / A 100 50,00. DSS_2025 = 4 × 50 = 200,00 → SMM_2025 = 500 − 200 = 300,00 → 2025 sonucu 1.000 − 300 − 50 = 650,00 (kâr → 570.2025).
//   2026: 01.02 satış B 120 (C2) 240,00 / A 600 200,00 + A 391 40,00 (P −2) · 10.02 banka masrafı B 780 / A 102 (102.01) 30,00 · 01.03 tahsilat B 100 / A 120 (C1) 500,00
//         · 01.04 gider B 760 / A 100 20,00 · 01.05 vergi karşılığı B 691 / A 360 10,00 (programda yolu yok — EK-2 S40 sınaması). DSS_2026 = 2 × 50 = 100,00 → SMM_2026 = 200 − 100 = 100,00.
//   Kapanış (EK-1 M4, EK-2 S25 / S40, kitap N-01 … N-07):
//     Önceki Yıl Sonucu Fişi (2025): B 600 1.000,00 / A 770 (770.90) 50,00, A 153 300,00, A 570 (570.2025) 650,00
//     N-01: B 621 / A 153 100,00 · N-02: B 631 / A 761 20,00; B 660 / A 781 30,00 · N-03: B 761 / A 760 20,00; B 781 / A 780 30,00
//     N-04: B 600 200,00 / A 621 100,00, A 631 20,00, A 660 30,00, A 690 50,00 (691 HARİÇ) · N-06: B 690 / A 692 50,00; B 692 / A 691 10,00 · N-07: B 692 / A 590 40,00
//     Dönem Net Kârı 2026 = 200 − 100 − 20 − 30 − 10 = 40,00.
//   Arşiv K kapanışı: 100 1.430,00 · 102.01 −30,00 · 120 C1 700,00 · 120 C2 240,00 · 153 100,00 · 191 100,00 · 320 S1 −600,00 · 360 −10,00 · 391 −240,00 · 519 −1.000,00 · 570.2025 −650,00 · 590 −40,00.
//   N-13 (yalnız alt defteri olmayan hesaplar): A 570 (570.2025) 650,00, A 590 40,00 / B 519 690,00 → yeni yıl 519 = −1.692 + 692 … = −1.000,00 (= arşiv 519).
//   Cariler: C1 açık kalem = fatura kalanı 700,00 (vade 01.05.2025); Borç Toplamı = 1.200 − 700 = 500,00, Alacak Toplamı = 500 − 0 = 500,00; net 0 → kuyruğa 0 girer.
//            C2 kalem 240,00, toplam satırları 0 (yazılmaz). S1 alış faturası 600,00 alacak kalemi. C3 bakiyesi 0 + kalemsiz → satır YOK (M12).
//
// ÖRNEK B (K = 31.12.2026; tek yıl): şüpheli (M13), kart (M1e / M2), Borçta Kalsın kartı, carisiz kart, eksi / silinmiş / sıfır stok (KG-9, M5, S207), KDV dönem boyutu (M8).
//   C5: 01.03 satış B 120 / A 600 1.000,00 (vade 01.04) · 01.09 şüpheliye alma B 128 / A 120 400,00 · 01.10 karşılık B 654 / A 129 100,00 → CH 600,00 = fatura kalanı 1.000 − şüpheli 400.
//   C6: 01.02 Borç Yaz B 120 / A 602 (602.90) 300,00, "Carinin Mevcut Borcu" kartı (açık); kart tahsilatı B 100 / A 120 100,00 → CH 200,00; kart taksitleri kartta (açık kalem DEĞİL)
//       → Borç Toplamı 300,00, Alacak Toplamı 100,00, kuyruğa net 200,00 girer.
//   C7: ayrı kart (Yeni Borç) B 120 / A 602 100,00; tahsilat 50,00; kart Borçta Kalsın ile kapandı → kalan 50,00 AÇIK KALEM ("Taksit Kartı Kalanı"), net 0.
//   P9 (carisiz kart): B 127 / A 602 200,00; tahsilat B 100 / A 127 50,00 → 127 = 150,00 = kartın kalanı.
//   Stok: Q açılış 5 × 10,00, satış 8 → −3 Adet (değer 0, eksi); R açılış 3 × 20,00, 01.06'da silindi (açılış YOK); S açılış 2 × 10,00, satış 2 (miktar 0 → açılış YOK).
//         DSS = 0; SMM = 50 + 60 + 20 = 130,00 = N-01.
//   S2: 20.11 alış B 770 50,00 + B 191 10,00 / A 320 60,00 (KDV dönemi Kasım) · 20.12 alış B 770 100,00 + B 191 20,00 / A 320 120,00 (KDV İndirim Dönemi OCAK 2027).
//       → 191 açılışı dönem boyutuyla: 2026-11 10,00 (önceki yıl: yeni yılın hiçbir mahsubuna girmez), 2027-01 20,00 (Ocak mahsubuna girer).
//   Dönem Net Kârı = 1.000 + 300 + 100 + 200 − 100 − 130 − 150 = 1.220,00.
import assert from "node:assert/strict";
import { katalogaYaz } from "./fixtures/devir-d3-ileti-katalog.mjs";
import { describe, it } from "node:test";
import { createStockValuation, MOVE_CLASS } from "../server/lib/stock-valuation.mjs";

// Yeni modül eski kodda YOK → test beklenen nedenle ("D3 devir planı modülü yok") kırmızı olur; çökmez (ders 7 / 38).
const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const preflightModule = await import("../server/lib/devir/preflight.mjs").catch(() => null);
const readerModule = await import("../server/lib/devir/plan-reader.mjs").catch(() => null);
const need = () => assert.ok(planModule && preflightModule, "D3 devir planı modülü yok (eski kod)");

const L = (account, debit, credit, sub = "", party = "") => ({ account, debit, credit, ...(sub ? { sub } : {}), ...(party ? { party } : {}) });
const E = (id, date, ...lines) => ({ id, date, source: "test", text: id, lines });
const D = (account, sub, debit, credit, party = "") => ({ account, sub, party, debit, credit });
const item = (key, side, remaining, vade, extra = {}) => ({ key, kind: "invoice", side, remaining, doubtful: 0, vade, date: vade, due: true, at: "", rank: 0, sub: 0, promise: "", invoiceId: key.replace(/^inv:/, ""), lineId: "", planId: "", ...extra });

// ---------- ÖRNEK A ----------
const ENTRIES_A = [
  E("cash:a", "2025-01-02", L("100", 100000, 0), L("519", 0, 100000)),
  E("invoice:a1", "2025-03-01", L("153", 50000, 0), L("191", 10000, 0), L("320", 0, 60000, "", "S1")),
  E("invoice:s1", "2025-05-01", L("120", 120000, 0, "", "C1"), L("600", 0, 100000), L("391", 0, 20000)),
  E("cash:g", "2025-06-01", L("770", 5000, 0, "770.90"), L("100", 0, 5000)),
  E("invoice:s2", "2026-02-01", L("120", 24000, 0, "", "C2"), L("600", 0, 20000), L("391", 0, 4000)),
  E("bank:m", "2026-02-10", L("780", 3000, 0), L("102", 0, 3000, "102.01")),
  E("account:t1", "2026-03-01", L("100", 50000, 0), L("120", 0, 50000, "", "C1")),
  E("cash:g2", "2026-04-01", L("760", 2000, 0), L("100", 0, 2000)),
  E("voucher:v691", "2026-05-01", L("691", 1000, 0), L("360", 0, 1000)),
  // K'den SONRA: plana girmez (yeni yılda kendi yerinde kalır).
  E("account:t2", "2027-01-05", L("100", 10000, 0), L("120", 0, 10000, "", "C1")),
];
const VALUATION_A = () => createStockValuation({
  items: [{ id: "P", code: "P", name: "Ürün P", unit: "Adet", unitPriceE4: 500000, deletedDay: "" }],
  moves: [
    { itemId: "P", date: "2025-03-01", cls: MOVE_CLASS.purchase, qtyMilli: 10000, valueMinor: 50000 },
    { itemId: "P", date: "2025-05-01", cls: MOVE_CLASS.quantity, qtyMilli: -6000, valueMinor: 0 },
    { itemId: "P", date: "2026-02-01", cls: MOVE_CLASS.quantity, qtyMilli: -2000, valueMinor: 0 },
  ],
});
const FACTS_A = () => ({
  K: "2026-12-31",
  company: { id: "sirket-001", code: "001", name: "Deneme", label: "001 · Deneme" },
  bookType: "balance",
  entries: ENTRIES_A,
  valuation: VALUATION_A(),
  closedOn: "",
  parties: [
    { id: "C1", name: "Müşteri Bir", type: "customer", deleted: false },
    { id: "C2", name: "Müşteri İki", type: "customer", deleted: false },
    { id: "C3", name: "Bakiyesiz", type: "customer", deleted: false },
    { id: "S1", name: "Tedarikçi Bir", type: "supplier", deleted: false },
  ],
  obligations: new Map([
    ["C1", [item("inv:s1", "receivable", 700, "2025-05-01")]],
    ["C2", [item("inv:s2", "receivable", 240, "2026-02-01")]],
    ["S1", [item("inv:a1", "payable", 600, "2025-03-01")]],
  ]),
  invoiceDocs: new Map([["s1", { number: "SAT-1", kind: "sale", date: "2025-05-01" }], ["s2", { number: "SAT-2", kind: "sale", date: "2026-02-01" }], ["a1", { number: "AL-1", kind: "purchase", date: "2025-03-01" }]]),
  cards: [],
  cheques: [],
  bankAccounts: [{ id: "BA1", name: "Vadesiz Hesap", kind: "demand", gl: "102", sub: "102.01" }],
  doubtful: [],
  counts: [],
});

describe("D3 devir planı — ÖRNEK A (elle): kapanış sırası, 7/A, 691 → 692, önceki yıl, N-13, cari satırları", () => {
  it("kesim tarihi: yalnız geçmiş bir yılın 31 Aralık'ı (EK-1 M11)", () => {
    need();
    const { checkCutoff } = planModule;
    assert.throws(() => checkCutoff("2026-06-30", "2027-01-20"), error => error.code === "DEVIR_K_31_ARALIK" && error.status === 400);
    assert.throws(() => checkCutoff("2026-12-30", "2027-01-20"), error => error.code === "DEVIR_K_31_ARALIK");
    assert.throws(() => checkCutoff("2027-12-31", "2027-12-31"), error => error.code === "DEVIR_K_GELECEK");
    assert.throws(() => checkCutoff("2026-12-31", "2026-12-31"), error => error.code === "DEVIR_K_GELECEK", "yılın son günü henüz geçmiş yıl değil");
    assert.doesNotThrow(() => checkCutoff("2026-12-31", "2027-01-01"));
  });

  it("kapanış fişleri elle hesaplanan satırlarla ve sırayla: önceki yıl (570.2025) → N-01 → N-02 → N-03 → N-04 (691 hariç) → N-06 (691 → 692) → N-07", () => {
    need();
    const plan = planModule.buildDevirPlan(FACTS_A());
    const fis = plan.archive.kapanisFisleri;
    assert.deepEqual(fis.map(v => [v.kod, v.type, v.journalClass, v.date]), [
      ["onceki-yil-2025", "prior-year-result", "closing", "2026-12-31"],
      ["N-01", "closing", "period-end", "2026-12-31"],
      ["N-02", "closing", "closing", "2026-12-31"],
      ["N-03", "closing", "closing", "2026-12-31"],
      ["N-04", "closing", "closing", "2026-12-31"],
      ["N-06", "closing", "closing", "2026-12-31"],
      ["N-07", "closing", "closing", "2026-12-31"],
    ]);
    const lines = kod => fis.find(v => v.kod === kod).lines.map(({ account, sub, party, debit, credit }) => ({ account, sub, party, debit, credit }));
    assert.deepEqual(lines("onceki-yil-2025"), [D("600", "", 100000, 0), D("770", "770.90", 0, 5000), D("153", "", 0, 30000), D("570", "570.2025", 0, 65000)]);
    assert.deepEqual(lines("N-01"), [D("621", "", 10000, 0), D("153", "", 0, 10000)]);
    assert.deepEqual(lines("N-02"), [D("631", "", 2000, 0), D("761", "", 0, 2000), D("660", "", 3000, 0), D("781", "", 0, 3000)]);
    assert.deepEqual(lines("N-03"), [D("761", "", 2000, 0), D("760", "", 0, 2000), D("781", "", 3000, 0), D("780", "", 0, 3000)]);
    assert.deepEqual(lines("N-04"), [D("600", "", 20000, 0), D("621", "", 0, 10000), D("631", "", 0, 2000), D("660", "", 0, 3000), D("690", "", 0, 5000)]);
    assert.deepEqual(lines("N-06"), [D("692", "", 0, 5000), D("690", "", 5000, 0), D("692", "", 1000, 0), D("691", "", 0, 1000)], "691, 690'a DEĞİL 692'ye kapanır (EK-2 S40)");
    assert.deepEqual(lines("N-07"), [D("692", "", 4000, 0), D("590", "", 0, 4000)]);
    for (const v of fis) assert.equal(v.lines.reduce((s, l) => s + l.debit - l.credit, 0), 0, `${v.kod} dengede`);
    assert.equal(plan.archive.donemSonucuMinor, 4000);
    assert.deepEqual(plan.archive.oncekiYillar, [{ yil: 2025, tutarMinor: 65000, smmMinor: 30000 }]);
  });

  it("arşiv K kapanışı ve değişmezler: 6 / 7 = 0, 153 = DSS, 590 = Ç6 Dönem Net Kârı, Σ önceki yıl = Ç6 Geçmiş Yıllar, yeni yıl 519 = arşiv 519, bilanço dengede", () => {
    need();
    const plan = planModule.buildDevirPlan(FACTS_A());
    const bal = Object.fromEntries(plan.archive.kapanisBakiyeleri.map(r => [`${r.hesap}|${r.alt}|${r.cari}`, r.minor]));
    assert.deepEqual(bal, { "100||": 143000, "102|102.01|": -3000, "120||C1": 70000, "120||C2": 24000, "153||": 10000, "191||": 10000, "320||S1": -60000, "360||": -1000, "391||": -24000, "519||": -100000, "570|570.2025|": -65000, "590||": -4000 });
    assert.deepEqual(plan.degismezler.filter(r => !r.ok), []);
    const inv = Object.fromEntries(plan.degismezler.map(r => [r.kod, r.bulunanMinor]));
    assert.equal(inv["donem-sonucu"], 4000);
    assert.equal(inv["onceki-yillar"], 65000);
    assert.equal(inv["stok-dss"], 10000);
    assert.equal(inv["gecici-hesap"], -100000);
    assert.deepEqual(plan.sorunlar, []);
  });

  it("N-13 fişi yalnız alt defteri olmayan hesaplara (570.2025, 590) ve 519'a; modül açılışları (kasa, banka, stok, KDV) alt defterden; S-1 = A (590 aynen)", () => {
    need();
    const plan = planModule.buildDevirPlan(FACTS_A());
    assert.equal(planModule.DEVIR_DECISIONS.S1, "A");
    const fis = plan.newYear.acilisFisi;
    assert.deepEqual([fis.kod, fis.type, fis.journalClass, fis.date], ["N-13", "opening", "opening", "2027-01-01"]);
    assert.deepEqual(fis.lines.map(({ account, sub, debit, credit }) => [account, sub, debit, credit]), [["570", "570.2025", 0, 65000], ["590", "", 0, 4000], ["519", "", 69000, 0]]);
    assert.equal(plan.newYear.kasa.minor, 143000);
    assert.deepEqual(plan.newYear.banka.map(r => [r.hesap, r.alt, r.ad, r.bankaHesabi, r.minor]), [["102", "102.01", "Vadesiz Hesap", "BA1", -3000]]);
    assert.deepEqual(plan.newYear.stok.map(r => [r.urun, r.miktar, r.birimMaliyet, r.degerMinor, r.eksi]), [["P", 2, 50, 10000, false]]);
    assert.deepEqual(plan.newYear.vergi.map(r => [r.hesap, r.donem, r.minor, r.oncekiYil]), [["191", "2025-03", 10000, true], ["360", "", -1000, false], ["391", "2025-05", -20000, true], ["391", "2026-02", -4000, true]]);
  });

  it("cari satırları (M12): Borç Toplamı / Alacak Toplamı + açık kalemler (asıl vade; açıklama belge no + tarih); bakiyesi 0 + kalemsiz cariye satır YOK; satırlar = K bakiyesi", () => {
    need();
    const plan = planModule.buildDevirPlan(FACTS_A());
    const rowsOf = id => plan.newYear.cariler.find(r => r.cari === id).satirlar.map(r => [r.tur, r.yon, r.tutarMinor, r.vade, r.tarih, r.aciklama]);
    assert.deepEqual(rowsOf("C1"), [
      ["borc-toplami", "debt", 50000, "", "2027-01-01", "Devir — Borç Toplamı"],
      ["alacak-toplami", "credit", 50000, "", "2027-01-01", "Devir — Alacak Toplamı"],
      ["acik-kalem", "debt", 70000, "2025-05-01", "2027-01-01", "Devir: SAT-1 (01.05.2025)"],
    ]);
    assert.deepEqual(rowsOf("C2"), [["acik-kalem", "debt", 24000, "2026-02-01", "2027-01-01", "Devir: SAT-2 (01.02.2026)"]]);
    assert.deepEqual(rowsOf("S1"), [["acik-kalem", "credit", 60000, "2025-03-01", "2027-01-01", "Devir: AL-1 (01.03.2025)"]]);
    assert.deepEqual(rowsOf("C3"), [], "bakiyesi 0 ve açık kalemi olmayan cariye satır yazılmaz");
    const c1 = plan.newYear.cariler.find(r => r.cari === "C1");
    assert.deepEqual([c1.kBakiyeMinor, c1.netMinor, c1.acikKalemSayisi, c1.satirlar[0].kuyrugaGirenMinor], [70000, 0, 1, 0], "iki satır kuyruğa girmeden netleşir (BAŞ MİMAR 27.11 (2))");
    assert.equal(plan.newYear.cariler.find(r => r.cari === "C1").satirlar[2].kimlik, "devir-2026-kalem-inv:s1");
    assert.deepEqual([plan.sayilar.cariAcilis, plan.sayilar.cariKarti, plan.sayilar.acikFatura.satis, plan.sayilar.acikFatura.satisMinor, plan.sayilar.acikFatura.alis, plan.sayilar.acikFatura.alisMinor], [3, 4, 2, 94000, 1, 60000]);
  });

  it("Sadece Bakiyeyi Aktar: tek Devir Bakiyesi satırı (net ≠ 0 ise) + aynı açık kalemler; iki seçenekte kuyruğa giren net AYNI", () => {
    need();
    const both = planModule.buildDevirPlan(FACTS_A(), { option: "borc-alacak" });
    const one = planModule.buildDevirPlan(FACTS_A(), { option: "sadece-bakiye" });
    for (const id of ["C1", "C2", "S1"]) {
      const a = both.newYear.cariler.find(r => r.cari === id);
      const b = one.newYear.cariler.find(r => r.cari === id);
      assert.deepEqual(a.satirlar.filter(r => r.tur === "acik-kalem"), b.satirlar.filter(r => r.tur === "acik-kalem"), id);
      assert.equal(a.netMinor, b.netMinor, id);
    }
    assert.deepEqual(one.newYear.cariler.find(r => r.cari === "C1").satirlar.map(r => r.tur), ["acik-kalem"], "net 0 → Devir Bakiyesi satırı yazılmaz");
    // Net = K bakiyesi − açık borç kalemleri + açık alacak kalemleri: S1 −600 − 0 + 600 = 0 → Devir Bakiyesi yok; satırlar = K bakiyesi (sorun yok).
    assert.deepEqual(["C1", "C2", "S1"].map(id => one.newYear.cariler.find(r => r.cari === id).netMinor), [0, 0, 0]);
    assert.deepEqual(one.newYear.cariler.find(r => r.cari === "S1").satirlar.map(r => [r.tur, r.yon, r.tutarMinor]), [["acik-kalem", "credit", 60000]]);
    assert.deepEqual(one.sorunlar, []);
    assert.throws(() => planModule.buildDevirPlan(FACTS_A(), { option: "yok" }), error => error.code === "DEVIR_SECENEK");
  });

  it("belirlenimli: aynı olgular → bayt bayt aynı plan (iki koşu)", () => {
    need();
    assert.equal(JSON.stringify(planModule.buildDevirPlan(FACTS_A())), JSON.stringify(planModule.buildDevirPlan(FACTS_A())));
  });

  it("zarar yılı: 692 → 591 (B 591 / A 692)", () => {
    need();
    const facts = FACTS_A();
    facts.entries = [...ENTRIES_A, E("cash:zarar", "2026-12-31", L("770", 100000, 0), L("100", 0, 100000))];
    const plan = planModule.buildDevirPlan(facts);
    const n07 = plan.archive.kapanisFisleri.find(v => v.kod === "N-07");
    assert.deepEqual(n07.lines.map(({ account, debit, credit }) => [account, debit, credit]), [["591", 96000, 0], ["692", 0, 96000]], "40 − 1.000 = −960,00");
    assert.equal(plan.archive.donemSonucuMinor, -96000);
    assert.deepEqual(plan.degismezler.filter(r => !r.ok), []);
  });

  it("carisiz cari kontrol hücresi (336.90 kayıt tahsilatları — KG-3 A) ayrı listede; modül farkı DEĞİL", () => {
    need();
    const facts = FACTS_A();
    facts.entries = [...ENTRIES_A, E("payment:k1", "2026-06-01", L("100", 5000, 0), L("336", 0, 5000, "336.90"))];
    const plan = planModule.buildDevirPlan(facts);
    assert.deepEqual(plan.newYear.digerAltDefter.map(r => [r.hesap, r.alt, r.minor, r.neden, r.kimlik]), [["336", "336.90", -5000, "kayit-tahsilati", "devir-2026-altdefter-336.90"]]);
    assert.equal(plan.newYear.kasa.minor, 148000);
    assert.deepEqual(plan.sorunlar, []);
    assert.deepEqual(plan.degismezler.filter(r => !r.ok), []);
  });

  it("K yılı zaten kapanmış (Kapanış Fişi var) → plan sorunu, ön denetim DURDURUR", () => {
    need();
    const plan = planModule.buildDevirPlan({ ...FACTS_A(), closedOn: "2026-12-31" });
    assert.ok(plan.sorunlar.some(p => p.kod === "yil-kapanmis"), JSON.stringify(plan.sorunlar));
    assert.equal(plan.archive.kapanisFisleri.filter(v => v.type === "closing").length, 0, "K yılına ikinci kapanış fişi önerilmez");
    const out = preflightModule.devirPreflight({}, plan, {});
    assert.equal(out.gecebilir, false);
    assert.ok(out.durdurur.some(r => r.kod === "plan-yil-kapanmis"));
  });
});

// ---------- ÖRNEK B ----------
const ENTRIES_B = [
  E("invoice:s5", "2026-03-01", L("120", 100000, 0, "", "C5"), L("600", 0, 100000)),
  E("doubtful-take:d1", "2026-09-01", L("128", 40000, 0, "", "C5"), L("120", 0, 40000, "", "C5")),
  E("doubtful-provision:p1", "2026-10-01", L("654", 10000, 0), L("129", 0, 10000, "", "C5")),
  E("account:b6", "2026-02-01", L("120", 30000, 0, "", "C6"), L("602", 0, 30000, "602.90")),
  E("plan-entry:t6", "2026-03-01", L("100", 10000, 0), L("120", 0, 10000, "", "C6")),
  E("plan:k7", "2026-04-01", L("120", 10000, 0, "", "C7"), L("602", 0, 10000)),
  E("plan-entry:t7", "2026-05-01", L("100", 5000, 0), L("120", 0, 5000, "", "C7")),
  E("plan:p9", "2026-04-01", L("127", 20000, 0, "", "plan:P9"), L("602", 0, 20000)),
  E("plan-entry:t9", "2026-05-01", L("100", 5000, 0), L("127", 0, 5000, "", "plan:P9")),
  E("stock-open:q", "2026-01-05", L("153", 5000, 0), L("519", 0, 5000)),
  E("stock-open:r", "2026-01-05", L("153", 6000, 0), L("519", 0, 6000)),
  E("stock-open:s", "2026-01-05", L("153", 2000, 0), L("519", 0, 2000)),
  E("invoice:a11", "2026-11-20", L("770", 5000, 0), L("191", 1000, 0), L("320", 0, 6000, "", "S2")),
  E("invoice:a12", "2026-12-20", L("770", 10000, 0), L("191", 2000, 0), L("320", 0, 12000, "", "S2")),
];
const VALUATION_B = () => createStockValuation({
  items: [
    { id: "Q", code: "Q", name: "Ürün Q", unit: "Adet", unitPriceE4: 100000, deletedDay: "" },
    { id: "R", code: "R", name: "Ürün R", unit: "Adet", unitPriceE4: 200000, deletedDay: "2026-06-01" },
    { id: "S", code: "S", name: "Ürün S", unit: "Adet", unitPriceE4: 100000, deletedDay: "" },
  ],
  moves: [
    { itemId: "Q", date: "2026-01-05", cls: MOVE_CLASS.opening, qtyMilli: 5000, valueMinor: 5000 },
    { itemId: "R", date: "2026-01-05", cls: MOVE_CLASS.opening, qtyMilli: 3000, valueMinor: 6000 },
    { itemId: "S", date: "2026-01-05", cls: MOVE_CLASS.opening, qtyMilli: 2000, valueMinor: 2000 },
    { itemId: "Q", date: "2026-02-01", cls: MOVE_CLASS.quantity, qtyMilli: -8000, valueMinor: 0 },
    { itemId: "S", date: "2026-02-01", cls: MOVE_CLASS.quantity, qtyMilli: -2000, valueMinor: 0 },
  ],
});
const FACTS_B = () => ({
  K: "2026-12-31",
  bookType: "balance",
  entries: ENTRIES_B,
  valuation: VALUATION_B(),
  closedOn: "",
  parties: ["C5", "C6", "C7"].map(id => ({ id, name: id, type: "customer", deleted: false })).concat([{ id: "S2", name: "S2", type: "supplier", deleted: false }]),
  obligations: new Map([
    ["C5", [item("inv:s5", "receivable", 1000, "2026-04-01", { doubtful: 400 })]],
    ["C6", [item("plan:K6:1", "receivable", 100, "2026-06-01", { kind: "installment", planId: "K6", invoiceId: "" }), item("plan:K6:2", "receivable", 100, "2027-02-01", { kind: "installment", planId: "K6", invoiceId: "" })]],
    ["C7", [item("plan:K7:1", "receivable", 50, "2026-07-02", { kind: "installment", planId: "K7", invoiceId: "", date: "2026-04-01" })]],
    ["S2", [item("inv:a11", "payable", 60, "2026-11-20"), item("inv:a12", "payable", 120, "2026-12-20")]],
  ]),
  invoiceDocs: new Map([["s5", { number: "SAT-5", kind: "sale", date: "2026-03-01" }], ["a11", { number: "AL-11", kind: "purchase", date: "2026-11-20" }], ["a12", { number: "AL-12", kind: "purchase", date: "2026-12-20" }]]),
  cards: [
    { id: "K6", party: "C6", totalMinor: 30000, paidMinor: 10000, closedAtK: false, closeRule: "keep", coversBalance: true, invoiceId: "", installments: [{ itemId: "1", seq: 1, vade: "2026-06-01", remainingMinor: 10000 }, { itemId: "2", seq: 2, vade: "2027-02-01", remainingMinor: 10000 }] },
    { id: "K7", party: "C7", totalMinor: 10000, paidMinor: 5000, closedAtK: true, closeRule: "keep", coversBalance: false, invoiceId: "", installments: [{ itemId: "1", seq: 1, vade: "2026-07-02", remainingMinor: 5000 }] },
    { id: "P9", party: "", totalMinor: 20000, paidMinor: 5000, closedAtK: false, closeRule: "keep", coversBalance: false, invoiceId: "", installments: [] },
  ],
  cheques: [],
  bankAccounts: [],
  doubtful: [{ id: "D1", party: "C5", date: "2026-09-01", remainingMinor: 40000, provisionMinor: 10000 }],
  vatPeriods: new Map([["invoice:a12", "2027-01"]]),
  counts: [],
});

describe("D3 devir planı — ÖRNEK B (elle): şüpheli, kartlar, stok, KDV dönem boyutu", () => {
  it("kapanış: N-01 = SMM 130,00; 770 → 632 yansıtma; Dönem Net Kârı 1.220,00; değişmezler tutar", () => {
    need();
    const plan = planModule.buildDevirPlan(FACTS_B());
    const lines = kod => plan.archive.kapanisFisleri.find(v => v.kod === kod).lines.map(({ account, sub, debit, credit }) => [account, sub, debit, credit]);
    assert.deepEqual(lines("N-01"), [["621", "", 13000, 0], ["153", "", 0, 13000]]);
    assert.deepEqual(lines("N-02"), [["632", "", 15000, 0], ["771", "", 0, 15000]]);
    assert.deepEqual(lines("N-04"), [["600", "", 100000, 0], ["602", "602.90", 30000, 0], ["602", "", 30000, 0], ["621", "", 0, 13000], ["632", "", 0, 15000], ["654", "", 0, 10000], ["690", "", 0, 122000]]);
    assert.equal(plan.archive.donemSonucuMinor, 122000);
    assert.deepEqual(plan.degismezler.filter(r => !r.ok), []);
    assert.deepEqual(plan.sorunlar, []);
  });

  it("şüpheli (M13): CH açık kalemi = fatura kalanı − şüpheli pay (600,00); 128 / 129 ayrı açılış; aynı tutar iki kez taşınmaz", () => {
    need();
    const plan = planModule.buildDevirPlan(FACTS_B());
    const c5 = plan.newYear.cariler.find(r => r.cari === "C5");
    // CH muavini (M3): ≤K borç 1.000,00, alacak 400,00 (şüpheliye aktarma CH'yi alacaklandırır) → Borç Toplamı 1.000 − 600 = 400,00; Alacak Toplamı 400 − 0 = 400,00.
    assert.deepEqual(c5.satirlar.map(r => [r.tur, r.yon, r.tutarMinor, r.vade]), [["borc-toplami", "debt", 40000, ""], ["alacak-toplami", "credit", 40000, ""], ["acik-kalem", "debt", 60000, "2026-04-01"]]);
    assert.deepEqual([c5.kBakiyeMinor, c5.supheliMinor, c5.karsilikMinor], [60000, 40000, 10000]);
    assert.deepEqual(plan.newYear.supheli.map(r => [r.kayit, r.cari, r.kalanMinor, r.karsilikMinor, r.tarih, r.kayitTarihi]), [["D1", "C5", 40000, 10000, "2027-01-01", "2026-09-01"]]);
  });

  it("kartlar: açık kartın taksitleri açık kalem DEĞİL (net satırda — M2); Borçta Kalsın kalanı açık kalem; kapalı kart da tek açılış; carisiz kart 127", () => {
    need();
    const plan = planModule.buildDevirPlan(FACTS_B());
    const rows = id => plan.newYear.cariler.find(r => r.cari === id).satirlar.map(r => [r.tur, r.yon, r.tutarMinor, r.vade, r.kalemSinifi || "", r.kuyrugaGirenMinor ?? null]);
    assert.deepEqual(rows("C6"), [["borc-toplami", "debt", 30000, "", "", 20000], ["alacak-toplami", "credit", 10000, "", "", 0]]);
    // C7: ≤K borç 100,00 (kart), alacak 50,00 (tahsilat); açık kalem 50,00 → Borç Toplamı 50,00, Alacak Toplamı 50,00, net 0.
    assert.deepEqual(rows("C7"), [["borc-toplami", "debt", 5000, "", "", 0], ["alacak-toplami", "credit", 5000, "", "", 0], ["acik-kalem", "debt", 5000, "2026-07-02", "kart-kalani", null]]);
    assert.equal(plan.newYear.cariler.find(r => r.cari === "C7").satirlar[2].aciklama, "Devir: Taksit Kartı Kalanı (01.04.2026)");
    assert.deepEqual(plan.newYear.kartlar.map(r => [r.kart, r.cari, r.durum, r.odenenMinor, r.kalanMinor, r.taksitler.length]), [["K6", "C6", "acik", 10000, 20000, 2], ["K7", "C7", "kapali", 5000, 0, 1], ["P9", "", "acik", 5000, 15000, 0]]);
    assert.deepEqual(plan.sayilar.taksitKarti, { acik: 2, kalanMinor: 35000, kapali: 1 });
  });

  it("stok (KG-9, M5, S207): eksi miktar devreder, değer 0; silinmiş ve sıfır miktarlı ürüne açılış YOK; eksi stoklu ürün sayısı", () => {
    need();
    const plan = planModule.buildDevirPlan(FACTS_B());
    assert.deepEqual(plan.newYear.stok.map(r => [r.urun, r.miktar, r.degerMinor, r.eksi, r.kimlik]), [["Q", -3, 0, true, "devir-2026-stok-Q"]]);
    assert.deepEqual(plan.sayilar.stok, { urun: 1, degerMinor: 0, eksi: 1 });
  });

  it("KDV dönem boyutu (M8): Aralık alışının dönemi Ocak → 191@2027-01 (yeni yılın Ocak mahsubuna girer); Kasım 191'i önceki yıl", () => {
    need();
    const plan = planModule.buildDevirPlan(FACTS_B());
    assert.deepEqual(plan.newYear.vergi.map(r => [r.hesap, r.donem, r.minor, r.oncekiYil, r.kimlik]), [["191", "2026-11", 1000, true, "devir-2026-vergi-191-2026-11"], ["191", "2027-01", 2000, false, "devir-2026-vergi-191-2027-01"]]);
    const s2 = plan.newYear.cariler.find(r => r.cari === "S2");
    assert.deepEqual(s2.satirlar.map(r => [r.tur, r.yon, r.tutarMinor, r.vade, r.aciklama]), [["acik-kalem", "credit", 6000, "2026-11-20", "Devir: AL-11 (20.11.2026)"], ["acik-kalem", "credit", 12000, "2026-12-20", "Devir: AL-12 (20.12.2026)"]]);
  });

  it("modül ↔ Ana Defter farkı (kartın ödenen tutarı defterle tutmuyor) → plan sorunu 'modul-farki', ön denetim DURDURUR", () => {
    need();
    const facts = FACTS_B();
    facts.cards = facts.cards.map(card => (card.id === "P9" ? { ...card, paidMinor: 4000 } : card));
    const plan = planModule.buildDevirPlan(facts);
    assert.deepEqual(plan.sorunlar.map(p => [p.kod, p.hesap, p.cari, p.beklenenMinor, p.bulunanMinor]), [["modul-farki", "127", "plan:P9", 15000, 16000]]);
    assert.ok(preflightModule.devirPreflight({}, plan, {}).durdurur.some(r => r.kod === "plan-modul-farki"));
  });
});

describe("D3 ön denetim (DEVIR-PLANI §5 + G4 + S-2 / S-3)", () => {
  const planOf = () => planModule.buildDevirPlan(FACTS_A());
  const base = { aralikMahsubu: { ay: "2026-12", yapildi: true }, defterMutabakati: { ok: true, dengeli: true, farklar: [] }, kuralFarki: { satir: 0, altDefter: 0, tutarMinor: 0 } };
  const codes = list => list.map(r => r.kod);
  it("temiz veri: DURDURUR yok, geçilebilir", () => {
    need();
    const out = preflightModule.devirPreflight(base, planOf(), { today: "2027-03-15" });
    assert.deepEqual(codes(out.durdurur), []);
    assert.equal(out.gecebilir, true);
    assert.deepEqual(codes(out.uyarir), []);
  });
  it("her DURDURUR maddesi kendi olgusuyla (Türkçe cümle + gidilecek yer)", () => {
    need();
    const cases = [
      [{ eBelgeBekleyen: { adet: 2, ornek: [] } }, "e-belge-bekleyen", "Faturalar › Gönderilecekler"],
      [{ eBelgeListedenSilinen: { adet: 1, ornek: [] } }, "e-belge-listeden-silinen", "Faturalar › Gönderilecekler"],
      [{ eBelgeBelirsiz: { adet: 1, ornek: [] } }, "e-belge-belirsiz", "Faturalar"],
      [{ taslakFatura: { adet: 3, ornek: [] } }, "taslak-fatura", "Faturalar"],
      [{ bankaIsi: { adet: 1 } }, "banka-isi", "Banka › Bekleyen İşler"],
      [{ defterMutabakati: { ok: false, dengeli: true, farklar: [{ hesap: "100", fark: 12.5 }] } }, "defter-mutabakati", "Raporlar › Ana Defter › Defter Mutabakatı"],
      [{ acilisOlabilir: { adet: 4 } }, "acilis-olabilir", "Yönetim › Sistem › Açılış Olabilir Kayıtlar"],
      [{ kuralFarki: { satir: 2, altDefter: 0, tutarMinor: 300000 } }, "kural-farki", "Yönetim › Sistem › Kural Farkı Düzeltme Fişi"],
      // D3 tur 3 (S-KD-1 = A): fişin düzeltemediği alt defter farkı AYRI madde — çare "Kilidi Aç → Yeniden Kilitle", gidilecek yer Dönem Kilidi (tur 1-2'de "kural-farki" / Kural Farkı Düzeltme Fişi).
      [{ kuralFarki: { satir: 0, altDefter: 1, tutarMinor: 0 } }, "kural-farki-alt-defter", "Yönetim › Sistem › Dönem Kilidi"],
      [{ kuralFarki: { satir: 0, altDefter: 0, tutarMinor: 0, dondurmaSuruyor: true } }, "dondurma-suruyor", "Yönetim › Sistem › Dönem Kilidi"],
    ];
    for (const [facts, kod, ekran] of cases) {
      const out = preflightModule.devirPreflight({ ...base, ...facts }, planOf(), { today: "2027-03-15" });
      assert.deepEqual(codes(out.durdurur), [kod], kod);
      assert.equal(out.gecebilir, false, kod);
      assert.equal(out.durdurur[0].git.ekran, ekran, kod);
      assert.ok(out.durdurur[0].metin.length > 20 && /[.]$/.test(out.durdurur[0].metin), `${kod}: cümle`);
      // D3 tur 3: dört alan dolu (ileti düzeni) — katalog için olgu düzeyindeki ileti kaydedilir.
      assert.ok(out.durdurur[0].neOldu && out.durdurur[0].neden && out.durdurur[0].neYapmali?.length && out.durdurur[0].nereye?.ekran, `${kod}: dört alan`);
      katalogaYaz("devir-d3-plan", `olgu düzeyi: ${JSON.stringify(facts)}`, out.durdurur[0], "olgu (ön denetim olgusu elle)");
    }
    const s2 = preflightModule.devirPreflight({ ...base, acilisOlabilir: { adet: 4 } }, planOf(), { today: "2027-03-15" });
    assert.match(s2.durdurur[0].metin, /31\.12\.2026 ve öncesi tarihli 4 kayıt "Açılış Olabilir" listesinde onay bekliyor/);
    assert.equal(s2.durdurur[0].baslik, "Açılış Olabilir Kayıtları Onaylayın");
  });
  it("S-2 / S-3 tek yerden: B seçilirse UYARIR, C seçilirse hiç söylenmez", () => {
    need();
    const facts = { ...base, acilisOlabilir: { adet: 1 }, kuralFarki: { satir: 1, altDefter: 0, tutarMinor: 100 } };
    const b = preflightModule.devirPreflight(facts, planOf(), { today: "2027-03-15", decisions: { S1: "A", S2: "B", S3: "B" } });
    assert.deepEqual([codes(b.durdurur), codes(b.uyarir)], [[], ["acilis-olabilir", "kural-farki"]]);
    const c = preflightModule.devirPreflight(facts, planOf(), { today: "2027-03-15", decisions: { S1: "A", S2: "C", S3: "C" } });
    assert.deepEqual([codes(c.durdurur), codes(c.uyarir)], [[], []]);
    assert.deepEqual(planModule.DEVIR_DECISIONS, { S1: "A", S2: "A", S3: "A" });
  });
  it("UYARIR maddeleri: Aralık mahsubu (belirgin + bağlantı), içe aktarma, şablon, gelen kutusu, iptal süresi, eksi stok, eksi kasa, 001 yeniden başlatma, erken devir", () => {
    need();
    const plan = planModule.buildDevirPlan(FACTS_B());
    plan.newYear.sablonlar = [{ tekrar: "r1", sablon: "f1", sablonNo: "SAT-9", sonrakiTarih: "2027-01-15", taslakKimlik: "devir-2026-sablon-f1" }];
    plan.newYear.kasa = { ...plan.newYear.kasa, minor: -500 };
    const out = preflightModule.devirPreflight({ ...base, aralikMahsubu: { ay: "2026-12", yapildi: false }, iceAktarma: { adet: 2 }, gelenKutusu: { adet: 1 }, iptalSuresi: { adet: 1 } }, plan, { isRoot: true, today: "2027-01-10" });
    assert.deepEqual(codes(out.durdurur), []);
    assert.deepEqual(codes(out.uyarir), ["aralik-mahsubu", "ice-aktarma", "tekrarlayan-sablon", "gelen-kutusu", "iptal-suresi", "eksi-stok", "eksi-kasa", "yeniden-baslatma", "erken-devir"]);
    const offset = out.uyarir[0];
    assert.deepEqual([offset.baslik, offset.belirgin, offset.git.ekran], ["Önce Aralık Mahsubunu Yapın", true, "Vergi › KDV Mahsup Fişi"]);
    assert.match(out.uyarir.at(-1).metin, /üzerinden 10 gün geçti/);
    for (const row of out.uyarir) {
      assert.ok(row.neOldu && row.neden && row.neYapmali?.length && row.nereye?.ekran, `${row.kod}: dört alan`);
      katalogaYaz("devir-d3-plan", "olgu düzeyi: Aralık mahsubu yok, 2 içe aktarma, 1 şablon, 1 gelen e-Fatura, 1 iptal süresi, eksi stok, kasa -5,00 TL, 001, bugün 10.01.2027", row, "olgu (ön denetim olgusu elle)");
    }
  });
});

describe("D3 tablo sınıflaması (plan §8.16; tasarım §2): şemadaki her tablo bir sınıfta", () => {
  it("bugünkü şemanın 86 tablosu DEVIR_TABLE_CLASSES'ta; ortak katman O; beş defter tablosu B (BAŞ MİMAR 27.11 (4))", async () => {
    assert.ok(readerModule, "D3 okuyucu modülü yok (eski kod)");
    const { DatabaseSync } = await import("node:sqlite");
    const { runMigrations } = await import("../server/lib/migrations.mjs").then(mod => ({ runMigrations: mod.runMigrations || mod.migrate }));
    const { createStore } = await import("../server/lib/db.mjs");
    const db = new DatabaseSync(":memory:");
    const store = createStore(db);
    runMigrations(store);
    const tables = store.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(row => row.name);
    db.close();
    const missing = tables.filter(name => !readerModule.DEVIR_TABLE_CLASSES[name]);
    assert.deepEqual(missing, [], "yeni tablo eklendiyse devirdeki sınıfı DEVIR_TABLE_CLASSES'a yazılmalı");
    for (const name of ["users", "roles", "sessions", "mobile_access", "mobile_codes", "mobile_devices", "mobile_sessions"]) assert.equal(readerModule.DEVIR_TABLE_CLASSES[name].sinif, "O", name);
    for (const name of ["ledger_vouchers", "ledger_voucher_lines", "ledger_snapshot_runs", "ledger_snapshots", "ledger_valuation_cards"]) assert.equal(readerModule.DEVIR_TABLE_CLASSES[name].sinif, "B", name);
    for (const name of ["audit_events", "edoc_usage", "edoc_usage_meta", "einvoice_inbox", "integrity_log"]) assert.equal(readerModule.DEVIR_TABLE_CLASSES[name].sinif, "D", name);
    assert.equal(readerModule.DEVIR_TABLE_CLASSES.trash.sinif, "A");
  });
});
