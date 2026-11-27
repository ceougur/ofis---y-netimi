// 2.5.1 M1 — S261 (mali müşavir ara kabulü ORTA-1; kullanıcı 22.11.2026 19:47 "orta bulguyu 2.5.1 de düzeltelim"): KDV Özeti (Beyanname Hazırlığı) önceki aydan devreden
// KDV'yi görmüyordu. Artık özet ve tablo altı "Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV" satırlarını KDV Mahsup Fişi ön izlemesinin AYNI
// hesabıyla verir (devreden = ay başına kadar defterdeki 190; fark 391 − 191 − devreden); 391 / 191 satırlarının adında "(İadeler Düşülmüş)". Defter ve mahsup fişi DEĞİŞMEZ.
// Taban (t251-taban) kodunda kırmızı: Şubat "Ödenecek KDV 1.200,00 TL" (devreden 2.000 görülmüyor), "Önceki Dönemden Devreden KDV" satırı yok.
//
// KÂHİN (elle; mali müşavirin ma-rapor.md ORTA-1 sayıları ve S261 metni — programın kodundan türetilmedi, ders 5). Sahte saat 20.01.2027 (ders 13); veri programın API'sinden.
//   Şirket 002 (S261): Ocak 2026 alış 10.000 + KDV 2.000 → Ocak mahsubu (sonraki aya devreden 2.000) · Şubat satış 6.000 + KDV 1.200
//     → Şubat KDV Özeti: Önceki Dönemden Devreden 2.000 · Ödenecek 0 · Sonraki Döneme Devreden 800 (mahsup ön izlemesi 2.000 / 800 / 0).
//   Şirket 001 (MA): Şubat alış 5.700 + KDV 1.140 → mahsup (devreden 1.140) · Mart, Nisan hareketsiz → mahsupla taşınır · Mayıs satış 6.000 + KDV 1.200 → Mayıs ödenecek 60
//     · Temmuz alış 10.000 + KDV 2.000 → mahsup (devreden 2.000) · Ağustos hareketsiz (mahsup YOK) · Eylül satış 3.300 + KDV 660, alış 3.100 + KDV 620 → Eylül ödenecek 0,
//     sonraki aya devreden 1.960 · Yıl 2026 (Ocak–Aralık): önceki 0, ödenecek 60, sonraki 1.960 = defterdeki 190.
//   Nasıl bozulur (docs/devir/2.5.1-DEVAM/m1-rapor.md §0) maddeleri ayrı it'lerde; beklenenler yine elle yazılı.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, boot, integrityOk, must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { lockPeriod, trialBalances } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const INV = "/api/workspace/invoices";
const TAX = "/api/workspace/tax";
const NOW = "2027-01-20T12:00:00+03:00";
const minor = text => {
  const raw = String(text ?? "").trim();
  if (!/TL$/.test(raw)) return null;
  const sign = /^[-−]/.test(raw) ? -1 : 1;
  return sign * Number(raw.replace(/[^\d,]/g, "").replace(",", ""));
};
const qs = query => new URLSearchParams(query).toString();
const RESULT_LABELS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"];
const DOC_KINDS = ["Satış", "Serbest Meslek Makbuzu", "Satıştan İade", "Alış", "Alıştan İade"];

describe("2.5.1 M1 — KDV Özeti: Önceki Dönemden Devreden KDV ve mahsup formülüyle Ödenecek / Sonraki Döneme Devreden", () => {
  let ctx;
  let api;
  let q2 = "";
  const ids = {};
  let n = 0;
  const amp = (url, q) => (q ? `${url}${url.includes("?") ? "&" : "?"}${q}` : url);
  before(async () => {
    ctx = await boot({ now: NOW, maxCompanies: 2 });
    api = ctx.api;
    const created = await must("002", api.post("/api/companies", { name: "KDV İkinci Şirket", select: false }));
    q2 = `hofCompany=${encodeURIComponent((created.company || created).id)}`;
    for (const [tag, q] of [["001", ""], ["002", q2]]) {
      ids[`M${tag}`] = (await must(`müşteri ${tag}`, api.post(amp("/api/workspace/accounts", q), { name: `KDV Müşteri ${tag}`, type: "customer", registeredOn: "2026-01-01" }))).id;
      ids[`T${tag}`] = (await must(`tedarikçi ${tag}`, api.post(amp("/api/workspace/accounts", q), { name: `KDV Tedarikçi ${tag}`, type: "supplier", registeredOn: "2026-01-01" }))).id;
    }
    // 002: S261.
    await buy("002", "2026-01-10", 10000);
    await offset("2026-01", q2);
    await sell("002", "2026-02-10", 6000);
    // 001: mali müşavirin senaryosu (ORTA-1).
    await buy("001", "2026-02-12", 5700);
    for (const month of ["2026-02", "2026-03", "2026-04"]) await offset(month);
    await sell("001", "2026-05-15", 6000);
    await offset("2026-05");
    await buy("001", "2026-07-05", 10000);
    await offset("2026-07");
    await sell("001", "2026-09-10", 3300);
    await buy("001", "2026-09-20", 3100);
    await offset("2026-09");
    await integrityOk(api, "veri girildi");
  });
  after(() => ctx?.server.close());

  async function buy(tag, date, net, extra = {}) {
    const q = tag === "002" ? q2 : "";
    return (await must(`alış ${tag} ${date}`, api.post(amp(INV, q), { kind: "purchase", scenario: "expense_purchase", accountId: ids[`T${tag}`], issueDate: date, number: `KD-${tag}-${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" }, ...extra }))).id;
  }
  async function sell(tag, date, net, qty = 1) {
    const q = tag === "002" ? q2 : "";
    return (await must(`satış ${tag} ${date}`, api.post(amp(INV, q), { scenario: "service_sale", accountId: ids[`M${tag}`], issueDate: date, lines: [{ name: "Danışmanlık", qty, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }))).id;
  }
  async function offset(month, q = "") {
    return (await must(`mahsup ${month} ${q ? "002" : "001"}`, api.post(amp(`${TAX}/vat-offset`, q), { month }))).offset;
  }
  const preview = async (month, q = "") => (await must(`ön izleme ${month}`, api.get(amp(`${TAX}/vat-offset?month=${month}`, q)))).preview;
  /** Rapor (ekran JSON'u); özet → { etiket: kuruş/metin }; tablo altı → { etiket: KDV kuruşu }. PDF ve Excel ekranla aynı (ders 11; anayasa: ekran = PDF = Excel). */
  async function report(query, q = "", tag = qs(query), client = api) {
    const res = await client.get(amp(`${RC}/kdv-ozeti?${qs(query)}`, q));
    assert.equal(res.status, 200, `${tag}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    const data = res.data;
    const summary = Object.fromEntries(data.summary);
    const g = data.headers.indexOf("Belge Türü");
    const k = data.headers.indexOf("KDV");
    const foot = Object.fromEntries((data.footers || []).filter(line => RESULT_LABELS.includes(line[g])).map(line => [line[g], minor(line[k])]));
    return { data, summary, foot, value: label => minor(summary[label]), g, k };
  }
  async function sameFiles(query, q, tag) {
    const { data } = await report(query, q, tag);
    const pdf = await api.raw("GET", amp(`${RC}/kdv-ozeti/pdf?${qs(query)}`, q));
    assert.equal(pdf.status, 200, `${tag} PDF`);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    for (const row of [...data.rows, ...data.footers]) for (const cell of row) if (String(cell).trim()) assert.ok(text.includes(String(cell).trim()), `${tag} PDF hücresi: "${cell}"`);
    for (const [label, value] of data.summary) if (minor(value) !== null) assert.ok(text.includes(String(value).trim()), `${tag} PDF özet ${label}: "${value}"`);
    const xlsx = await api.raw("GET", amp(`${RC}/kdv-ozeti/xlsx?${qs(query)}`, q));
    assert.equal(xlsx.status, 200, `${tag} Excel`);
    const sheets = Object.values(xlsxSheets(xlsx.buffer));
    const sheet = sheets[0].slice(Math.max(0, sheets[0].findIndex(row => row.length > 1)));
    assert.equal(sheet.length, 1 + data.rows.length + (data.rows.length ? data.footers.length : 0), `${tag} Excel satır sayısı`);
    [...data.rows, ...data.footers].forEach((row, index) => {
      const got = sheet[1 + index];
      row.forEach((cell, c) => {
        const want = minor(cell);
        if (want !== null) assert.equal(typeof got[c] === "number" ? Math.round(got[c] * 100) : minor(got[c]), want, `${tag} Excel satır ${index + 1} ${data.headers[c]}`);
        else if (String(cell).trim() && !/^%\d+$/.test(String(cell).trim())) assert.equal(String(got[c]).trim(), String(cell).trim(), `${tag} Excel satır ${index + 1} ${data.headers[c]}`);
      });
    });
    const book = sheets.find(rows => rows.some(row => String(row[0]).trim() === "Önceki Dönemden Devreden KDV"));
    assert.ok(book, `${tag} Excel özet sayfasında Önceki Dönemden Devreden KDV`);
    for (const [label, value] of data.summary) {
      const row = book.find(item => String(item[0]).trim() === label);
      assert.ok(row, `${tag} Excel özet satırı ${label}`);
      const want = minor(value);
      if (want !== null) assert.equal(typeof row[1] === "number" ? Math.round(row[1] * 100) : minor(row[1]), want, `${tag} Excel özet ${label}`);
    }
    return data;
  }
  /** Rapor = KDV Mahsup Fişi ön izlemesi (aynı ay, aynı veri): önceki / ödenecek / sonraki aynı kuruş. */
  async function sameAsPreview(month, q = "") {
    const [year, m] = month.split("-").map(Number);
    const end = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
    const r = await report({ from: `${month}-01`, to: end }, q, `rapor ${month}`);
    const p = await preview(month, q);
    assert.deepEqual([r.value("Önceki Dönemden Devreden KDV"), r.value("Ödenecek KDV"), r.value("Sonraki Döneme Devreden KDV")], [p.carryInMinor, p.payableMinor, p.carryOutMinor], `${month}: rapor = mahsup ön izlemesi`);
    // Tablo boşsa (ayda belge yok) TOPLAM satırı da yok (Rapor Merkezi kuralı); sayılar özette.
    if (r.data.rows.length) assert.deepEqual([r.foot["Önceki Dönemden Devreden KDV"], r.foot["Ödenecek KDV"], r.foot["Sonraki Döneme Devreden KDV"]], [p.carryInMinor, p.payableMinor, p.carryOutMinor], `${month}: tablo altı = mahsup ön izlemesi`);
    else assert.equal((r.data.footers || []).length, 0, `${month}: boş tabloda TOPLAM yok`);
    return r;
  }

  it("S261 (002): Şubat KDV Özeti — Önceki Dönemden Devreden 2.000, Ödenecek 0, Sonraki Döneme Devreden 800; mahsup ön izlemesiyle aynı; ekran = PDF = Excel", async () => {
    const feb = await report({ from: "2026-02-01", to: "2026-02-28" }, q2, "002 Şubat");
    assert.equal(feb.summary["Ödenecek KDV"], "0,00 TL", `Şubat Ödenecek KDV (taban: 1.200,00 — devreden görülmüyordu) ${JSON.stringify(feb.data.summary)}`);
    assert.equal(feb.value("Önceki Dönemden Devreden KDV"), 200000, "Şubat önceki dönemden devreden 2.000 (Ocak mahsubu)");
    assert.equal(feb.value("Sonraki Döneme Devreden KDV"), 80000, "Şubat sonraki döneme devreden 800 (2.000 − 1.200)");
    assert.equal(feb.value("Hesaplanan KDV (391) (İadeler Düşülmüş)"), 120000);
    assert.equal(feb.value("İndirilecek KDV (191) (İadeler Düşülmüş)"), 0);
    assert.ok(!("Devreden KDV" in feb.summary) && !("Hesaplanan KDV (391)" in feb.summary), "eski adlar yok");
    assert.deepEqual(feb.foot, { "Önceki Dönemden Devreden KDV": 200000, "Ödenecek KDV": 0, "Sonraki Döneme Devreden KDV": 80000 }, "tablo altı = özet");
    assert.ok(!(feb.data.footers || []).some(line => /^Net KDV/.test(String(line[feb.g]))), "eski Net KDV satırı yok");
    const p = await preview("2026-02", q2);
    assert.deepEqual([p.carryInMinor, p.carryOutMinor, p.payableMinor], [200000, 80000, 0], "Şubat mahsup ön izlemesi 2.000 / 800 / 0 (S261 — değişmedi)");
    await sameAsPreview("2026-02", q2);
    await sameFiles({ from: "2026-02-01", to: "2026-02-28" }, q2, "002 Şubat");
  });

  it("MA (001): Mayıs ödenecek 60 (1.200 − 1.140); Mart / Nisan devreden 1.140 taşınır; Eylül ödenecek 0, sonraki 1.960 (kâhin: mali müşavir)", async () => {
    const may = await sameAsPreview("2026-05");
    assert.deepEqual([may.value("Önceki Dönemden Devreden KDV"), may.value("Ödenecek KDV"), may.value("Sonraki Döneme Devreden KDV")], [114000, 6000, 0], "Mayıs 1.140 / 60 / 0 (taban: Ödenecek 1.200)");
    for (const month of ["2026-03", "2026-04"]) {
      const r = await sameAsPreview(month);
      assert.deepEqual([r.value("Önceki Dönemden Devreden KDV"), r.value("Ödenecek KDV"), r.value("Sonraki Döneme Devreden KDV")], [114000, 0, 114000], `${month} devreden 1.140 taşınır`);
    }
    const sep = await sameAsPreview("2026-09");
    assert.deepEqual([sep.value("Önceki Dönemden Devreden KDV"), sep.value("Ödenecek KDV"), sep.value("Sonraki Döneme Devreden KDV")], [200000, 0, 196000], "Eylül 2.000 / 0 / 1.960 (taban: Net KDV (Ödenecek) 40)");
    assert.deepEqual([sep.value("Hesaplanan KDV (391) (İadeler Düşülmüş)"), sep.value("İndirilecek KDV (191) (İadeler Düşülmüş)")], [66000, 62000]);
    const aug = await sameAsPreview("2026-08");
    assert.deepEqual([aug.value("Önceki Dönemden Devreden KDV"), aug.value("Ödenecek KDV"), aug.value("Sonraki Döneme Devreden KDV")], [200000, 0, 200000], "Ağustos hareketsiz, mahsupsuz: devreden aynen");
    assert.equal(aug.data.rows.length, 0, "Ağustos tablosu boş (tek ay: ay satırı eklenmez)");
    assert.ok(!("Mahsup Edilmemiş Ay" in aug.summary), "hareketsiz ay mahsup edilmemiş sayılmaz");
    await sameFiles({ from: "2026-09-01", to: "2026-09-30" }, "", "001 Eylül");
  });

  it("MA (001) yıllık 2026: Önceki 0, Ödenecek 60, Sonraki 1.960 = defterdeki 190; ay ay satırlar kendi devreden / ödenecek değeriyle; ekran = PDF = Excel", async () => {
    const year = await report({ from: "2026-01-01", to: "2026-12-31" }, "", "001 yıl");
    assert.deepEqual([year.value("Önceki Dönemden Devreden KDV"), year.value("Ödenecek KDV"), year.value("Sonraki Döneme Devreden KDV")], [0, 6000, 196000], `yıl (taban: Devreden KDV 1.900) ${JSON.stringify(year.data.summary)}`);
    assert.deepEqual(year.foot, { "Önceki Dönemden Devreden KDV": 0, "Ödenecek KDV": 6000, "Sonraki Döneme Devreden KDV": 196000 }, "tablo altı = özet");
    const tb = await trialBalances(api, "?to=2026-12-31");
    assert.equal(Math.round((tb["190"] ?? 0) * 100), 196000, "defterde 190 = 1.960 (değişmedi)");
    const lines = year.data.rows.filter(row => !DOC_KINDS.includes(row[year.g])).map(row => [row[0], row[year.g], minor(row[year.k])]);
    assert.deepEqual(
      lines,
      [
        ["Şubat 2026", "Sonraki Döneme Devreden KDV", 114000],
        ["Mart 2026", "Önceki Dönemden Devreden KDV", 114000],
        ["Mart 2026", "Sonraki Döneme Devreden KDV", 114000],
        ["Nisan 2026", "Önceki Dönemden Devreden KDV", 114000],
        ["Nisan 2026", "Sonraki Döneme Devreden KDV", 114000],
        ["Mayıs 2026", "Önceki Dönemden Devreden KDV", 114000],
        ["Mayıs 2026", "Ödenecek KDV", 6000],
        ["Temmuz 2026", "Sonraki Döneme Devreden KDV", 200000],
        ["Eylül 2026", "Önceki Dönemden Devreden KDV", 200000],
        ["Eylül 2026", "Sonraki Döneme Devreden KDV", 196000],
      ],
      "ay ay satırlar (kâhin)",
    );
    // Ayın satırları ayın belgelerinin altında: Eylül'de Satış ve Alış önce, sonuç sonra.
    const sepRows = year.data.rows.filter(row => row[0] === "Eylül 2026").map(row => row[year.g]);
    assert.deepEqual(sepRows, ["Alış", "Satış", "Önceki Dönemden Devreden KDV", "Sonraki Döneme Devreden KDV"], "Eylül: belgeler önce, ayın sonucu altında");
    // TOPLAM satırları yalnız belge satırlarından (devreden satırları toplanmaz).
    const g = year.g;
    const totalSale = (year.data.footers || []).find(line => line[g] === "TOPLAM Satış");
    assert.equal(minor(totalSale[year.k]), 120000 + 66000, "TOPLAM Satış KDV 1.860");
    assert.equal(minor((year.data.footers || []).find(line => line[g] === "TOPLAM Alış")[year.k]), 114000 + 200000 + 62000, "TOPLAM Alış KDV 3.760");
    assert.ok(!("Mahsup Edilmemiş Ay" in year.summary), "hepsi mahsup edildi: not yok");
    assert.equal(year.summary["KDV Mahsup Fişi"], "Şubat 2026, Mart 2026, Nisan 2026, Mayıs 2026, Temmuz 2026, Eylül 2026");
    await sameFiles({ from: "2026-01-01", to: "2026-12-31" }, "", "001 yıl");
    // Çeyrek (Nisan–Haziran): önceki 1.140 (Mart sonu 190), ödenecek 60, sonraki 0 (Mayıs).
    const q = await report({ from: "2026-04-01", to: "2026-06-30" }, "", "001 2. çeyrek");
    assert.deepEqual([q.value("Önceki Dönemden Devreden KDV"), q.value("Ödenecek KDV"), q.value("Sonraki Döneme Devreden KDV")], [114000, 6000, 0], "2. çeyrek");
  });

  it("boş ve gelecek dönem; iki şirket karışmaz; aralık yalnız mahsupsuz hareketsiz aylarsa devreden aynen", async () => {
    const empty002 = await report({ from: "2026-06-01", to: "2026-06-30" }, q2, "002 Haziran");
    assert.deepEqual([empty002.value("Önceki Dönemden Devreden KDV"), empty002.value("Ödenecek KDV"), empty002.value("Sonraki Döneme Devreden KDV")], [200000, 0, 200000], "002: 190 = Ocak mahsubunun 2.000'i (Şubat mahsup edilmedi; 001'in mahsupları karışmaz)");
    assert.equal(empty002.data.rows.length, 0);
    const future = await report({ from: "2027-03-01", to: "2027-03-31" }, "", "001 gelecek Mart 2027");
    assert.deepEqual([future.value("Önceki Dönemden Devreden KDV"), future.value("Ödenecek KDV"), future.value("Sonraki Döneme Devreden KDV")], [196000, 0, 196000], "gelecek dönem: bugünkü 190");
    const before = await report({ from: "2025-01-01", to: "2025-12-31" }, "", "001 2025");
    assert.deepEqual([before.value("Önceki Dönemden Devreden KDV"), before.value("Ödenecek KDV"), before.value("Sonraki Döneme Devreden KDV")], [0, 0, 0], "veri öncesi boş yıl");
    assert.equal(before.data.rows.length, 0);
    assert.equal((before.data.footers || []).length, 0, "boş dönemde TOPLAM satırı yok");
  });

  it("mahsup fişi kesilmemiş ay: rapor ön izlemeyle aynı sayı + 'Mahsup Edilmemiş Ay' notu; mahsup kesilince / geri alınınca / yeniden kesilince rapor uyar", async () => {
    await sell("001", "2026-10-05", 2000); // Ekim KDV 400
    await sell("001", "2026-11-05", 5000); // Kasım KDV 1.000
    // Ekim mahsup edilmedi: Kasım ön izlemesi devredeni defterdeki 190'dan (1.960) alır → 1.000 − 1.960 → sonraki 960.
    let nov = await sameAsPreview("2026-11");
    assert.deepEqual([nov.value("Önceki Dönemden Devreden KDV"), nov.value("Ödenecek KDV"), nov.value("Sonraki Döneme Devreden KDV")], [196000, 0, 96000], "Kasım (Ekim mahsupsuz)");
    assert.match(nov.summary["Mahsup Edilmemiş Ay"] || "", /^Ekim 2026 /, `not: ${JSON.stringify(nov.data.summary)}`);
    const both = await report({ from: "2026-10-01", to: "2026-11-30" }, "", "Ekim–Kasım");
    assert.deepEqual([both.value("Önceki Dönemden Devreden KDV"), both.value("Ödenecek KDV"), both.value("Sonraki Döneme Devreden KDV")], [196000, 0, 96000], "Ekim–Kasım (ay ay ön izleme)");
    assert.match(both.summary["Mahsup Edilmemiş Ay"] || "", /^Ekim 2026 /);
    const oct = await offset("2026-10");
    assert.deepEqual([oct.carryInMinor, oct.carryOutMinor, oct.payableMinor], [196000, 156000, 0], "Ekim mahsubu 1.960 − 400 = 1.560 devreden");
    nov = await sameAsPreview("2026-11");
    assert.deepEqual([nov.value("Önceki Dönemden Devreden KDV"), nov.value("Ödenecek KDV"), nov.value("Sonraki Döneme Devreden KDV")], [156000, 0, 56000], "Kasım (Ekim mahsuplu): 1.000 − 1.560");
    assert.ok(!("Mahsup Edilmemiş Ay" in nov.summary), "mahsuptan sonra not kalkar");
    await must("Ekim geri al", api.post(`${TAX}/vat-offset/${oct.id}/reverse`, {}));
    nov = await sameAsPreview("2026-11");
    assert.deepEqual([nov.value("Önceki Dönemden Devreden KDV"), nov.value("Sonraki Döneme Devreden KDV")], [196000, 96000], "geri alınınca eski hâl");
    assert.match(nov.summary["Mahsup Edilmemiş Ay"] || "", /^Ekim 2026 /);
    await offset("2026-10");
    nov = await sameAsPreview("2026-11");
    assert.deepEqual([nov.value("Önceki Dönemden Devreden KDV"), nov.value("Sonraki Döneme Devreden KDV")], [156000, 56000], "yeniden kesilince yeni hâl");
    await integrityOk(api, "mahsup kesilmemiş ay");
  });

  it("ödenecek aydan sonra yeniden devreden; aralık yıl başını aşar (Aralık 2026 → Ocak 2027)", async () => {
    await offset("2026-11"); // Kasım: sonraki 560
    await sell("001", "2026-12-08", 10000); // Aralık KDV 2.000 → ödenecek 2.000 − 560 = 1.440
    const dec = await sameAsPreview("2026-12");
    assert.deepEqual([dec.value("Önceki Dönemden Devreden KDV"), dec.value("Ödenecek KDV"), dec.value("Sonraki Döneme Devreden KDV")], [56000, 144000, 0], "Aralık");
    await offset("2026-12");
    await buy("001", "2027-01-08", 3000); // Ocak 2027 alış KDV 600 → devreden 600
    const jan = await sameAsPreview("2027-01");
    assert.deepEqual([jan.value("Önceki Dönemden Devreden KDV"), jan.value("Ödenecek KDV"), jan.value("Sonraki Döneme Devreden KDV")], [0, 0, 60000], "Ocak 2027 (ödenecek aydan sonra yeni devreden)");
    const cross = await report({ from: "2026-12-01", to: "2027-01-31" }, "", "Aralık–Ocak");
    assert.deepEqual([cross.value("Önceki Dönemden Devreden KDV"), cross.value("Ödenecek KDV"), cross.value("Sonraki Döneme Devreden KDV")], [56000, 144000, 60000], "yıl dönümü aralığı");
    const year = await report({ from: "2026-01-01", to: "2026-12-31" }, "", "2026 yeniden");
    assert.deepEqual([year.value("Önceki Dönemden Devreden KDV"), year.value("Ödenecek KDV"), year.value("Sonraki Döneme Devreden KDV")], [0, 6000 + 144000, 0], "yıl: ödenecek 60 + 1.440, Aralık sonrası devreden yok");
    const thisYear = await report({ preset: "thisYear" }, "", "Bu Yıl (2027)");
    assert.deepEqual([thisYear.value("Önceki Dönemden Devreden KDV"), thisYear.value("Ödenecek KDV"), thisYear.value("Sonraki Döneme Devreden KDV")], [0, 0, 60000], "Bu Yıl 2027: önceki yıldan devreden 0 (Aralık ödenecekti)");
    const all = await report({ preset: "all" }, "", "Tüm Zamanlar");
    assert.deepEqual([all.value("Önceki Dönemden Devreden KDV"), all.value("Ödenecek KDV"), all.value("Sonraki Döneme Devreden KDV")], [0, 150000, 60000], "Tüm Zamanlar");
    await integrityOk(api, "yıl dönümü");
  });

  it("iadeler, alıcı olarak kesilen tevkifat, KDV İndirim Dönemi başka aya atılmış alış (002): rapor = mahsup ön izlemesi ay ay; 391 / 191 iadeler düşülmüş", async () => {
    await offset("2026-02", q2); // Şubat: sonraki 800
    const saleId = await sell("002", "2026-03-05", 1000, 2); // KDV 400
    const detail = await must("satış ayrıntı", api.get(amp(`${INV}/${saleId}`, q2)));
    await must("satıştan iade", api.post(amp(INV, q2), { kind: "sale_return", originalId: saleId, issueDate: "2026-03-12", lines: [{ originLineId: detail.lines[0].id, qty: 1 }], payment: { rest: "open" }, force: true })); // KDV 200
    await must("tevkifatlı alış", api.post(amp(INV, q2), { kind: "purchase", scenario: "expense_purchase", accountId: ids.T002, issueDate: "2026-03-15", number: "KD-TEV-1", profile: "KAGIT", lines: [{ name: "Temizlik Hizmeti", qty: 1, unitPrice: 2000, vatRate: 20, withholdingCode: "612", expenseCode: "cleaning" }], payment: { rest: "open" } })); // KDV 400, tevkifat 360
    await buy("002", "2026-03-20", 1000, { vatPeriod: "2026-04" }); // KDV 200 → Nisan'da indirilir
    // Mart: 391 (iadeler düşülmüş) 400 − 200 = 200; 191 400; devreden 800 → 200 − 400 − 800 = −1.000 → sonraki 1.000.
    const mar = await sameAsPreview("2026-03", q2);
    assert.deepEqual([mar.value("Hesaplanan KDV (391) (İadeler Düşülmüş)"), mar.value("İndirilecek KDV (191) (İadeler Düşülmüş)"), mar.value("Alıcı Olarak Kesilen Tevkifat (2 No.lu)")], [20000, 40000, 36000], "Mart 391 / 191 / tevkifat");
    assert.deepEqual([mar.value("Önceki Dönemden Devreden KDV"), mar.value("Ödenecek KDV"), mar.value("Sonraki Döneme Devreden KDV")], [80000, 0, 100000], "Mart");
    // Nisan (Mart mahsupsuz): ön izleme 190'dan 800 → 0 − 200 − 800 → sonraki 1.000; not Mart.
    let apr = await sameAsPreview("2026-04", q2);
    assert.deepEqual([apr.value("İndirilecek KDV (191) (İadeler Düşülmüş)"), apr.value("Önceki Dönemden Devreden KDV"), apr.value("Sonraki Döneme Devreden KDV")], [20000, 80000, 100000], "Nisan (Mart mahsupsuz)");
    assert.match(apr.summary["Mahsup Edilmemiş Ay"] || "", /^Mart 2026 /);
    await offset("2026-03", q2);
    apr = await sameAsPreview("2026-04", q2);
    assert.deepEqual([apr.value("Önceki Dönemden Devreden KDV"), apr.value("Sonraki Döneme Devreden KDV")], [100000, 120000], "Nisan (Mart mahsuplu): 1.000 + 200");
    await sameFiles({ from: "2026-01-01", to: "2026-12-31" }, q2, "002 yıl");
    await integrityOk(api, "iade / tevkifat / dönem");
  });

  it("S4 (002): Mart mahsubundan sonra Mart'ın tevkifatlı alışı İptal Et (191 −400) → Nisan: rapor = ön izleme (azaltan fark Nisan'a taşınır): önceki 1.000, sonraki 800", async () => {
    const id = ctx.store.get("SELECT id FROM invoices WHERE number = 'KD-TEV-1'")?.id ?? null;
    const viaApi = id ? null : (await must("fatura listesi", api.get(amp(`${INV}?q=KD-TEV-1`, q2)))).invoices?.find(item => item.number === "KD-TEV-1")?.id;
    const target = id || viaApi;
    assert.ok(target, "tevkifatlı alış bulundu");
    await must("İptal Et", api.post(amp(`${INV}/${target}/cancel`, q2), { reason: "Hatalı fatura", payments: "drop", refund: "none" }));
    // Elle: Nisan 191 = 200 (dönemi Nisan'a alınan alış) − 400 (Mart mahsubundan sonra azalan) = −200; devreden 1.000 (Mart mahsubu) → 0 − (−200) − 1.000 = −800.
    const apr = await sameAsPreview("2026-04", q2);
    assert.deepEqual([apr.value("Önceki Dönemden Devreden KDV"), apr.value("Ödenecek KDV"), apr.value("Sonraki Döneme Devreden KDV")], [100000, 0, 80000], "Nisan (S4 taşıması)");
    const p = await preview("2026-04", q2);
    assert.equal(p.carriedInMinor, -40000, "ön izleme: azaltan fark −400 Nisan'a taşındı");
    const year = await report({ from: "2026-01-01", to: "2026-12-31" }, q2, "002 yıl (S4)");
    assert.deepEqual([year.value("Önceki Dönemden Devreden KDV"), year.value("Ödenecek KDV"), year.value("Sonraki Döneme Devreden KDV")], [0, 0, 80000], "002 yıl: sonraki 800 (Nisan)");
    await integrityOk(api, "S4");
  });

  it("kilitli dönem ve Defter Türü (işletme): rapor sayıları değişmez; ay ortasında biten aralıkta not", async () => {
    const before = (await report({ from: "2026-05-01", to: "2026-05-31" }, "", "Mayıs kilitsiz")).data;
    await lockPeriod(api, "2026-06-30");
    const locked = (await report({ from: "2026-05-01", to: "2026-05-31" }, "", "Mayıs kilitli")).data;
    assert.deepEqual(locked.summary, before.summary, "kilit sayıları değiştirmez");
    await lockPeriod(api, "");
    const mar = (await report({ from: "2026-03-01", to: "2026-03-31" }, q2, "002 Mart bilanço")).data;
    await must("defter türü işletme", api.put(amp(`${INV}/settings`, q2), { bookType: "operating" }));
    const operating = (await report({ from: "2026-03-01", to: "2026-03-31" }, q2, "002 Mart işletme")).data;
    assert.deepEqual(operating.summary, mar.summary, "Defter Türü KDV hesabını değiştirmez");
    const mid = await report({ from: "2026-05-01", to: "2026-05-14" }, "", "1–14 Mayıs");
    assert.equal(mid.data.rows.length, 0, "Mayıs satışı 15'inde: aralıkta belge yok");
    assert.deepEqual([mid.value("Önceki Dönemden Devreden KDV"), mid.value("Ödenecek KDV")], [114000, 6000], "devreden / ödenecek ayın tamamından");
    assert.match(mid.summary.Not || "", /ayın tamamından/, "ay ortası notu");
    const full = await report({ from: "2026-05-01", to: "2026-05-31" }, "", "Mayıs tam");
    assert.ok(!("Not" in full.summary), "tam ayda not yok");
  });

  it("yetki: finans raporu yetkisi olmayan 403; muhasebe aynı sayıları görür", async () => {
    const staff = apiOf(await createUser(ctx.server, api.client, { username: "m1-personel", role: "personel" }));
    const res = await staff.get(`${RC}/kdv-ozeti?from=2026-05-01&to=2026-05-31`);
    assert.equal(res.status, 403, `personel ${res.status}`);
    const accountant = apiOf(await createUser(ctx.server, api.client, { username: "m1-muhasebe", role: "muhasebe" }));
    const mine = await report({ from: "2026-05-01", to: "2026-05-31" }, "", "Mayıs yönetici");
    const theirs = await report({ from: "2026-05-01", to: "2026-05-31" }, "", "Mayıs muhasebe", accountant);
    assert.deepEqual(theirs.data.summary, mine.data.summary, "muhasebe = yönetici");
  });
});
