// 2.5.0 Ç7b tur 2e — B-11 = A (BAŞ MİMAR KARARI 19.11 09:29; KG-7, KDVK 29/3; docs/erp/C7B-FATURA-TASARIM.md §15.1): KDV Özeti (Beyanname Hazırlığı) alış satırlarını "KDV İndirim Dönemi"ne
// göre gruplar (boşsa belge ayı); aralık süzgeci de bu aya (dönem ayının İLK günü). Satış ve iadeler belge tarihinde (§14.4). KDV Mahsup Fişi ile ay ay aynı İndirilecek KDV.
// KÂHİN (elle; programın kodundan türetilmedi — ders 5). Sahte saat 10.02.2027 (ders 13); belge tarihi 31.12 (ay / yıl sonu):
//   S1 satış 10.12.2026 10.000 (KDV 2.000) · P1 alış 15.12.2026 2 × 500 (KDV 200; dönem boş) · P2 alış 31.12.2026 2.000 (KDV 400; dönem Ocak 2027) · P4 alış 20.12.2026 300 (KDV 60; dönem Mart 2027)
//   S2 satış 10.01.2027 1.000 (KDV 200) · R1 alıştan iade 15.01.2027 (P1'in 1 adedi: 500, KDV 100) · P3 alış 20.01.2027 500 (KDV 100) · P5 alış 05.02.2027 200 (KDV 40).
//   Aralık 2026 (01.12–31.12): Alış P1 → 1 belge, matrah 1.000, KDV 200; Satış 2.000; İndirilecek (191) 200; Ödenecek 1.800. Mahsup Aralık İ 200.
//   Ocak 2027 (Geçen Ay): Alış P2 + P3 → 2 belge, 2.500, KDV 500; Alıştan İade R1 1 belge 500 / 100; Satış 200; 191 = 500 − 100 = 400; Net KDV (Devreden) 200. Mahsup Ocak İ 500.
//   Şubat 2027 (Bu Ay): Alış P5 1 belge 200 / 40. Mart 2027: Alış P4 1 belge 300 / 60. Bu Yıl (2027): TOPLAM Alış 4 belge, 3.000, KDV 600.
//   Tüm Zamanlar (bugüne kadar): Aralık 200 + Ocak 500 + Şubat 40 = TOPLAM Alış 740 (P4 Mart'ta — dönemi henüz başlamadı).
//   Son 30 Gün (11.01–10.02): P2'nin KDV günü 01.01 → DIŞARIDA; Alış P3 100 + P5 40 = 140; Alıştan İade 100.
//   Bölünmüş aralık: 16.12.2026–15.01.2027 Alış P2 400 (+ İade R1); 16.01–15.02.2027 Alış P3 + P5 = 140; birleşik 16.12–15.02 = 540 (= 400 + 140; çift sayım / kayıp yok). 15.12–15.01: P1 + P2 = 600.
//   Düzenle: P2'nin dönemi Şubat → Ocak Alış 100, Şubat Alış 440.
// NASIL BOZARIM (§15.5): rapor belge ayına (Aralık 660, Ocak 100); özet sorgusu satırlardan farklı kural (191 ≠ TOPLAM Alış − İade); alıştan iadeyi dönemle gruplamak; süzgeci belge tarihine
//   uygulamak (bölünmüş aralıkta P2 kaybolur / iki kez); PDF / Excel ekrandan farklı.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk, must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { BANK, bootBank } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const INV = "/api/workspace/invoices";
const TAX = "/api/workspace/tax";
const NOW = "2027-02-10T12:00:00+03:00";
const minor = text => {
  const raw = String(text ?? "").trim();
  if (!/TL$/.test(raw)) return null;
  const sign = /^[-−]/.test(raw) ? -1 : 1;
  return sign * Number(raw.replace(/[^\d,]/g, "").replace(",", ""));
};
const count = text => (/^\d+$/.test(String(text ?? "").trim()) ? Number(text) : null);
const qs = query => new URLSearchParams(query).toString();
const RESULTS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"];
const GROUPS = { "TOPLAM Satış": ["Satış", "Serbest Meslek Makbuzu"], "TOPLAM Satıştan İade": ["Satıştan İade"], "TOPLAM Alış": ["Alış"], "TOPLAM Alıştan İade": ["Alıştan İade"] };

describe("Ç7b B-11 — KDV Özeti (Beyanname Hazırlığı) alış KDV'si KDV İndirim Dönemi'nin ayında", () => {
  let ctx;
  let api;
  const ids = {};
  let n = 0;
  before(async () => {
    ctx = await bootBank({ now: NOW });
    api = ctx.api;
    await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
    const M = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Özet Müşteri", type: "customer", registeredOn: "2026-12-01" }))).id;
    const T = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Özet Tedarikçi", type: "supplier", registeredOn: "2026-12-01" }))).id;
    ids.T = T;
    const buy = async (date, qty, price, extra = {}) => (await must(`alış ${date}`, api.post(INV, { kind: "purchase", scenario: "expense_purchase", accountId: T, issueDate: date, number: `OZ-${(n += 1)}`, lines: [{ name: "Kırtasiye", qty, unitPrice: price, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" }, ...extra }))).id;
    const sell = async (date, net) => (await must(`satış ${date}`, api.post(INV, { scenario: "service_sale", accountId: M, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }))).id;
    await sell("2026-12-10", 10000);
    ids.P1 = await buy("2026-12-15", 2, 500);
    ids.P2 = await buy("2026-12-31", 1, 2000, { vatPeriod: "2027-01" });
    ids.P4 = await buy("2026-12-20", 1, 300, { vatPeriod: "2027-03" });
    await sell("2027-01-10", 1000);
    const p1 = await must("P1 belge", api.get(`${INV}/${ids.P1}`));
    await must("alıştan iade", api.post(INV, { kind: "purchase_return", accountId: T, originalId: ids.P1, issueDate: "2027-01-15", number: "OZ-IADE-1", lines: [{ originLineId: p1.lines[0].id, qty: 1 }], payment: { cash: [] }, force: true }));
    ids.P3 = await buy("2027-01-20", 1, 500);
    ids.P5 = await buy("2027-02-05", 1, 200);
    // Ön koşul (veri tabanından): dönemler saklandı.
    assert.deepEqual(ctx.store.all("SELECT vat_period AS v FROM invoices WHERE id IN (?, ?, ?, ?) ORDER BY issue_date", ids.P1, ids.P4, ids.P2, ids.P3).map(row => row.v), ["", "2027-03", "2027-01", ""], "ön koşul: dönemler");
    await integrityOk(api, "veri girildi");
  });
  after(() => ctx?.server.close());

  const footersOf = data => (Array.isArray(data.footers) ? data.footers : data.footer ? [data.footer] : []);
  /** Ekran (JSON) → TOPLAM satırları kendi satırlarının toplamı; özetin 391 / 191'i = TOPLAM'lar; PDF ve Excel ekranla aynı (ders 11). Dönüş: ay → tür → { belge, matrah, kdv }. */
  async function report(query, tag) {
    const res = await api.get(`${RC}/kdv-ozeti?${qs(query)}`);
    assert.equal(res.status, 200, `${tag}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    const data = res.data;
    const col = name => data.headers.indexOf(name);
    const g = col("Belge Türü");
    const lines = footersOf(data);
    const sums = {};
    // Tek yön kalınca (2.4.3 UX24) tek TOPLAM satırı: satırların tek yönüne bağlanır.
    const present = Object.keys(GROUPS).filter(label => data.rows.some(row => GROUPS[label].includes(row[g])));
    // 2.5.1 M1: altta üç sonuç satırı (Önceki Dönemden Devreden / Ödenecek / Sonraki Döneme Devreden KDV) belge TOPLAM'ı değildir.
    const docLines = lines.filter(line => !RESULTS.includes(line[g]));
    const labelOf = line => (GROUPS[line[g]] ? line[g] : docLines.length === 1 && present.length === 1 && line.some(cell => String(cell).startsWith("TOPLAM")) ? present[0] : "");
    for (const line of lines) {
      const members = GROUPS[labelOf(line)];
      if (!members) continue;
      const rows = data.rows.filter(row => members.includes(row[g]));
      assert.ok(rows.length, `${tag}: "${line[g]}" satırı var ama satırı yok`);
      for (const name of ["Matrah", "KDV", "Tevkifat"]) assert.equal(minor(line[col(name)]), rows.reduce((a, row) => a + minor(row[col(name)]), 0), `${tag}: ${line[g]} ${name} = satırlar`);
      assert.equal(count(line[col("Belge")]), rows.reduce((a, row) => a + count(row[col("Belge")]), 0), `${tag}: ${line[g]} Belge = satırlar`);
      sums[labelOf(line)] = minor(line[col("KDV")]);
    }
    for (const [label, members] of Object.entries(GROUPS)) if (data.rows.some(row => members.includes(row[g]))) assert.ok(label in sums, `${tag}: ${label} satırı var`);
    const summary = Object.fromEntries(data.summary);
    assert.equal(minor(summary["İndirilecek KDV (191) (İadeler Düşülmüş)"]), (sums["TOPLAM Alış"] || 0) - (sums["TOPLAM Alıştan İade"] || 0), `${tag}: özetin 191'i = TOPLAM Alış − TOPLAM Alıştan İade`);
    assert.equal(minor(summary["Hesaplanan KDV (391) (İadeler Düşülmüş)"]), (sums["TOPLAM Satış"] || 0) - (sums["TOPLAM Satıştan İade"] || 0), `${tag}: özetin 391'i = TOPLAM Satış − TOPLAM Satıştan İade`);
    // PDF: bütün satır ve TOPLAM hücreleri metinde.
    const pdf = await api.raw("GET", `${RC}/kdv-ozeti/pdf?${qs(query)}`);
    assert.equal(pdf.status, 200, `${tag} PDF`);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    for (const row of [...data.rows, ...lines]) for (const cell of row) if (String(cell).trim()) assert.ok(text.includes(String(cell).trim()), `${tag} PDF hücresi: "${cell}"`);
    // Excel: başlık + satırlar + TOPLAM satırları; para hücreleri sayı olarak ekrandakiyle aynı.
    const xlsx = await api.raw("GET", `${RC}/kdv-ozeti/xlsx?${qs(query)}`);
    assert.equal(xlsx.status, 200, `${tag} Excel`);
    const book = Object.values(xlsxSheets(xlsx.buffer))[0];
    const sheet = book.slice(Math.max(0, book.findIndex(row => row.length > 1)));
    assert.equal(sheet.length, 1 + data.rows.length + (data.rows.length ? lines.length : 0), `${tag} Excel satır sayısı`);
    [...data.rows, ...lines].forEach((row, k) => {
      const got = sheet[1 + k];
      row.forEach((cell, c) => {
        const want = minor(cell);
        if (want !== null) assert.equal(typeof got[c] === "number" ? Math.round(got[c] * 100) : minor(got[c]), want, `${tag} Excel satır ${k + 1} ${data.headers[c]}`);
        else if (/^%\d+$/.test(String(cell).trim()) && typeof got[c] === "number") assert.equal(Math.round(got[c] * 100), Number(String(cell).trim().slice(1)), `${tag} Excel satır ${k + 1} ${data.headers[c]} (yüzde)`);
        else if (String(cell).trim()) assert.equal(String(got[c]).trim(), String(cell).trim(), `${tag} Excel satır ${k + 1} ${data.headers[c]}`);
      });
    });
    // Ay → tür → tutarlar (kâhinle karşılaştırma için; 2.5.1 M1: çok aylı aralıktaki ayın sonuç satırları belge değildir).
    const by = {};
    for (const row of data.rows.filter(item => !RESULTS.includes(item[g]))) {
      const month = row[col("Ay")];
      const kind = row[g];
      const item = ((by[month] ||= {})[kind] ||= { belge: 0, matrah: 0, kdv: 0 });
      item.belge += count(row[col("Belge")]);
      item.matrah += minor(row[col("Matrah")]);
      item.kdv += minor(row[col("KDV")]);
    }
    return { by, sums, summary };
  }

  it("ay grupları: Aralık'ta P2 / P4 YOK, Ocak'ta P2 VAR, Mart'ta P4; alıştan iade kendi ayında (kâhin)", async () => {
    const dec = await report({ from: "2026-12-01", to: "2026-12-31" }, "Aralık");
    assert.deepEqual(dec.by, { "Aralık 2026": { Alış: { belge: 1, matrah: 100000, kdv: 20000 }, Satış: { belge: 1, matrah: 1000000, kdv: 200000 } } }, "Aralık (kâhin)");
    assert.equal(minor(dec.summary["Ödenecek KDV"]), 180000, "Aralık Ödenecek 1.800");
    const jan = await report({ preset: "lastMonth" }, "Geçen Ay (Ocak)");
    assert.deepEqual(jan.by, { "Ocak 2027": { Alış: { belge: 2, matrah: 250000, kdv: 50000 }, "Alıştan İade": { belge: 1, matrah: 50000, kdv: 10000 }, Satış: { belge: 1, matrah: 100000, kdv: 20000 } } }, "Ocak (kâhin)");
    assert.equal(minor(jan.summary["Sonraki Döneme Devreden KDV"]), 20000, "Ocak Devreden 200");
    const janCustom = await report({ from: "2027-01-01", to: "2027-01-31" }, "Ocak (elle)");
    assert.deepEqual(janCustom.by, jan.by, "elle Ocak = Geçen Ay");
    const feb = await report({ preset: "thisMonth" }, "Bu Ay (Şubat)");
    assert.deepEqual(feb.by, { "Şubat 2027": { Alış: { belge: 1, matrah: 20000, kdv: 4000 } } }, "Şubat (kâhin)");
    const mar = await report({ from: "2027-03-01", to: "2027-03-31" }, "Mart");
    assert.deepEqual(mar.by, { "Mart 2027": { Alış: { belge: 1, matrah: 30000, kdv: 6000 } } }, "Mart: dönemi ileri alınan P4");
    const year = await report({ preset: "thisYear" }, "Bu Yıl");
    assert.equal(year.sums["TOPLAM Alış"], 60000, "Bu Yıl TOPLAM Alış 600 (Ocak 500 + Şubat 40 + Mart 60)");
    assert.deepEqual(Object.keys(year.by), ["Ocak 2027", "Şubat 2027", "Mart 2027"]);
    const all = await report({ preset: "all" }, "Tüm Zamanlar");
    assert.equal(all.sums["TOPLAM Alış"], 74000, "Tüm Zamanlar (bugüne kadar) TOPLAM Alış 740: P4'ün dönemi (Mart) henüz başlamadı");
    assert.deepEqual(Object.keys(all.by), ["Aralık 2026", "Ocak 2027", "Şubat 2027"]);
    const last30 = await report({ preset: "last30" }, "Son 30 Gün");
    assert.deepEqual([last30.by["Ocak 2027"]?.Alış, last30.by["Ocak 2027"]?.["Alıştan İade"]?.kdv, last30.by["Şubat 2027"]?.Alış?.kdv], [{ belge: 1, matrah: 50000, kdv: 10000 }, 10000, 4000], "Son 30 Gün (11.01–10.02): P2'nin KDV günü 01.01 dışarıda");
  });

  it("bölünmüş aralık: iki bitişik aralığın alış KDV'si birleşik aralığa eşit (dönemi ileri alınan fatura YALNIZ bir aralıkta)", async () => {
    const a = await report({ from: "2026-12-16", to: "2027-01-15" }, "16.12–15.01");
    const b = await report({ from: "2027-01-16", to: "2027-02-15" }, "16.01–15.02");
    const ab = await report({ from: "2026-12-16", to: "2027-02-15" }, "16.12–15.02");
    assert.deepEqual([a.sums["TOPLAM Alış"], b.sums["TOPLAM Alış"], ab.sums["TOPLAM Alış"]], [40000, 14000, 54000], "400 + 140 = 540 (kâhin)");
    assert.equal(a.sums["TOPLAM Alıştan İade"], 10000, "iade 15.01'de (kendi günü)");
    const mid = await report({ from: "2026-12-15", to: "2027-01-15" }, "15.12–15.01");
    assert.equal(mid.sums["TOPLAM Alış"], 60000, "P1 200 + P2 400");
  });

  it("KDV Mahsup Fişi ile ay ay aynı İndirilecek KDV (ön izleme İ = raporun TOPLAM Alış'ı; F-08: alıştan iade 391'de)", async () => {
    for (const [month, from, to, want] of [["2026-12", "2026-12-01", "2026-12-31", 20000], ["2027-01", "2027-01-01", "2027-01-31", 50000], ["2027-02", "2027-02-01", "2027-02-28", 4000], ["2027-03", "2027-03-01", "2027-03-31", 6000]]) {
      const preview = (await must(`ön izleme ${month}`, api.get(`${TAX}/vat-offset?month=${month}`))).preview;
      const rep = await report({ from, to }, `ay ${month}`);
      assert.equal(preview.inMinor, want, `${month} mahsup İ (kâhin)`);
      assert.equal(rep.sums["TOPLAM Alış"], preview.inMinor, `${month}: rapor TOPLAM Alış = mahsup İ`);
    }
  });

  it("Düzenle: P2'nin dönemi Şubat'a alınınca rapor Ocak'tan Şubat'a taşır (kâhin: Ocak 100, Şubat 440)", async () => {
    const doc = await must("P2 belge", api.get(`${INV}/${ids.P2}`));
    await must("P2 Düzenle", api.post(`${INV}/${ids.P2}/edit`, { kind: doc.kind, scenario: doc.scenario, accountId: doc.accountId, issueDate: doc.issueDate, issueTime: doc.issueTime, number: doc.number, lines: doc.lines.map(line => ({ name: line.name, qty: line.qty, unitPrice: line.unitPrice, vatRate: line.vatRate, expenseCode: line.expenseCode })), payment: { rest: "open" }, vatPeriod: "2027-02" }));
    assert.equal(ctx.store.get("SELECT vat_period AS v FROM invoices WHERE id = ?", ids.P2).v, "2027-02", "veri tabanı");
    const jan = await report({ from: "2027-01-01", to: "2027-01-31" }, "Ocak (Düzenle sonrası)");
    const feb = await report({ from: "2027-02-01", to: "2027-02-28" }, "Şubat (Düzenle sonrası)");
    assert.deepEqual([jan.sums["TOPLAM Alış"], feb.sums["TOPLAM Alış"]], [10000, 44000]);
    await integrityOk(api, "B-11 sonu");
  });
});
