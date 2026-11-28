// 2.5.1 M1 tur 2 — S-M1-1 (kullanıcıya soruldu 27.11.2026; ÖNERİ B uygulanıyor): KDV Özeti'nde devreden KDV ZİNCİRLİ — her ayın "Önceki Dönemden Devreden KDV"si bir önceki
// ayın "Sonraki Döneme Devreden KDV"sidir; mahsup fişi kesilmemiş ay, o ay sırayla mahsup edilmiş olsaydı çıkacak sayıdır (mahsup formülüyle). BAŞ MİMAR KARARLARI 27.11:
// (1) takvim sırası, devreden yön taşınır, ödenecek yön taşınmaz, hareketsiz ay aynen taşır; (2) başlangıç = ilk KDV ayından önceki 190 (açılış yoksa 0); (3) bütün aylar sırayla
// mahsupluysa zincir = defter = ön izleme; atlanan aydan sonra kesilmiş fiş → rapor zinciri gösterir + "Zincirle Uyuşmayan Mahsup Fişi" notu (iki sayı); (4) "Mahsup Edilmemiş
// Ay" notu zincirli hesabı söyler; (6) ön izleme / fiş DEĞİŞMEZ (mahsupsuz ayda rapor ile ön izleme ayrışır).
// Tur 1 kodunda (t251-m1-tur1, A: defterdeki 190) kırmızı: hiç mahsupsuz şirkette Haziran "önceki 0 / ödenecek 200" (B 400 / 0 / 200), yıl "ödenecek 2.700, sonraki 0" (B 500 / 200);
// kopuk zincirde Mart "önceki 2.000" (B 1.600), "Zincirle Uyuşmayan Mahsup Fişi" notu yok.
//
// KÂHİN (ELLE — karar metninden ve aşağıdaki elle hesaptan; programın kodundan türetilmedi, ders 5). Sahte saat 20.01.2027 (ders 13); veri programın API'sinden; KDV %20.
//   Şirket 001 (hiç mahsup fişi yok): Ocak alış 10.000 (KDV 2.000) → 0 / 0 / 2.000 · Şubat satış 5.000 (KDV 1.000) → 2.000 / 0 / 1.000 · Mart hareketsiz → 1.000 / 0 / 1.000 ·
//     Nisan satış 7.500 (KDV 1.500) → 1.000 / 500 / 0 · Mayıs alış 2.000 (KDV 400) → 0 / 0 / 400 (ödenecek aydan sonra yeniden devreden) · Haziran satış 1.000 (KDV 200)
//     → 400 / 0 / 200. Yıl 2026: 0 / 500 / 200 · Mart–Mayıs: 1.000 / 500 / 400. Sonra aylar SIRAYLA mahsup edilir → her adımda rapor aynı; sonunda rapor = ön izleme = 190 (200).
//   Şirket 002 (kopuk zincir): Ocak alış 10.000 (KDV 2.000) → Ocak mahsubu (devreden 2.000) · Şubat satış 2.000 (KDV 400) MAHSUPSUZ · Mart satış 5.000 (KDV 1.000) → Mart
//     mahsubu defterdeki 2.000'le kesilir (fiş: sonraki 1.000) · Nisan satış 4.000 (KDV 800). Zincir: Şubat 2.000 / 0 / 1.600 · Mart 1.600 / 0 / 600 (fişin 2.000'i değil) ·
//     Nisan 600 / 200 / 0 (ön izleme defterden 1.000 / 0 / 200). Onarım (Mart geri al, Şubat ve Mart sırayla) → rapor aynı, ön izleme = rapor, not yok.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, integrityOk, must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { trialBalances } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const INV = "/api/workspace/invoices";
const TAX = "/api/workspace/tax";
const NOW = "2027-01-20T12:00:00+03:00";
const RESULT_LABELS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"];
const DOC_KINDS = ["Satış", "Serbest Meslek Makbuzu", "Satıştan İade", "Alış", "Alıştan İade"];
const minor = text => {
  const raw = String(text ?? "").trim();
  if (!/TL$/.test(raw)) return null;
  const sign = /^[-−]/.test(raw) ? -1 : 1;
  return sign * Number(raw.replace(/[^\d,]/g, "").replace(",", ""));
};
const qs = query => new URLSearchParams(query).toString();
const monthRange = month => {
  const [year, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10) };
};

describe("2.5.1 M1 tur 2 — KDV Özeti: zincirli devreden KDV (S-M1-1 = B)", () => {
  let ctx;
  let api;
  let q2 = "";
  const ids = {};
  let n = 0;
  const amp = (url, q) => (q ? `${url}${url.includes("?") ? "&" : "?"}${q}` : url);
  before(async () => {
    ctx = await boot({ now: NOW, maxCompanies: 2 });
    api = ctx.api;
    const created = await must("002", api.post("/api/companies", { name: "KDV Zincir İkinci Şirket", select: false }));
    q2 = `hofCompany=${encodeURIComponent((created.company || created).id)}`;
    for (const [tag, q] of [["001", ""], ["002", q2]]) {
      ids[`M${tag}`] = (await must(`müşteri ${tag}`, api.post(amp("/api/workspace/accounts", q), { name: `Zincir Müşteri ${tag}`, type: "customer", registeredOn: "2026-01-01" }))).id;
      ids[`T${tag}`] = (await must(`tedarikçi ${tag}`, api.post(amp("/api/workspace/accounts", q), { name: `Zincir Tedarikçi ${tag}`, type: "supplier", registeredOn: "2026-01-01" }))).id;
    }
    // 001: hiç mahsup fişi yok.
    await buy("001", "2026-01-10", 10000);
    await sell("001", "2026-02-10", 5000);
    await sell("001", "2026-04-10", 7500);
    await buy("001", "2026-05-10", 2000);
    await sell("001", "2026-06-10", 1000);
    // 002: kopuk zincir (Şubat atlanıp Mart mahsup edilir).
    await buy("002", "2026-01-10", 10000);
    await offset("2026-01", q2);
    await sell("002", "2026-02-10", 2000);
    await sell("002", "2026-03-10", 5000);
    await sell("002", "2026-04-10", 4000);
    await integrityOk(api, "veri girildi");
  });
  after(() => ctx?.server.close());

  async function buy(tag, date, net) {
    const q = tag === "002" ? q2 : "";
    return (await must(`alış ${tag} ${date}`, api.post(amp(INV, q), { kind: "purchase", scenario: "expense_purchase", accountId: ids[`T${tag}`], issueDate: date, number: `KZ-${tag}-${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id;
  }
  async function sell(tag, date, net) {
    const q = tag === "002" ? q2 : "";
    return (await must(`satış ${tag} ${date}`, api.post(amp(INV, q), { scenario: "service_sale", accountId: ids[`M${tag}`], issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }))).id;
  }
  async function offset(month, q = "") {
    return (await must(`mahsup ${month} ${q ? "002" : "001"}`, api.post(amp(`${TAX}/vat-offset`, q), { month }))).offset;
  }
  const preview = async (month, q = "") => {
    const p = (await must(`ön izleme ${month}`, api.get(amp(`${TAX}/vat-offset?month=${month}`, q)))).preview;
    return [p.carryInMinor, p.payableMinor, p.carryOutMinor];
  };
  async function report(query, q = "", tag = qs(query)) {
    const res = await api.get(amp(`${RC}/kdv-ozeti?${qs(query)}`, q));
    assert.equal(res.status, 200, `${tag}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    const data = res.data;
    const summary = Object.fromEntries(data.summary);
    const g = data.headers.indexOf("Belge Türü");
    const k = data.headers.indexOf("KDV");
    const three = RESULT_LABELS.map(label => minor(summary[label]));
    const foot = (data.footers || []).filter(line => RESULT_LABELS.includes(line[g])).map(line => minor(line[k]));
    if (data.rows.length) assert.deepEqual(foot, three, `${tag}: tablo altı = özet`);
    const lines = data.rows.filter(row => !DOC_KINDS.includes(row[g])).map(row => [row[0], row[g], minor(row[k])]);
    return { data, summary, three, lines };
  }
  /** Ekran = PDF = Excel (özet sayfası dahil). */
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
      row.forEach((cell, c) => {
        const want = minor(cell);
        const got = sheet[1 + index][c];
        if (want !== null) assert.equal(typeof got === "number" ? Math.round(got * 100) : minor(got), want, `${tag} Excel satır ${index + 1} ${data.headers[c]}`);
      });
    });
    const book = sheets.find(rows => rows.some(row => String(row[0]).trim() === "Önceki Dönemden Devreden KDV"));
    assert.ok(book, `${tag} Excel özet sayfası`);
    for (const [label, value] of data.summary) {
      const row = book.find(item => String(item[0]).trim() === label);
      assert.ok(row, `${tag} Excel özet satırı ${label}`);
      const want = minor(value);
      if (want !== null) assert.equal(typeof row[1] === "number" ? Math.round(row[1] * 100) : minor(row[1]), want, `${tag} Excel özet ${label}`);
      else assert.equal(String(row[1]).trim(), String(value).trim(), `${tag} Excel özet ${label}`);
    }
  }
  const YEAR_001_LINES = [
    ["Ocak 2026", "Sonraki Döneme Devreden KDV", 200000],
    ["Şubat 2026", "Önceki Dönemden Devreden KDV", 200000],
    ["Şubat 2026", "Sonraki Döneme Devreden KDV", 100000],
    ["Nisan 2026", "Önceki Dönemden Devreden KDV", 100000],
    ["Nisan 2026", "Ödenecek KDV", 50000],
    ["Mayıs 2026", "Sonraki Döneme Devreden KDV", 40000],
    ["Haziran 2026", "Önceki Dönemden Devreden KDV", 40000],
    ["Haziran 2026", "Sonraki Döneme Devreden KDV", 20000],
  ];
  const MONTHS_001 = { "2026-01": [0, 0, 200000], "2026-02": [200000, 0, 100000], "2026-03": [100000, 0, 100000], "2026-04": [100000, 50000, 0], "2026-05": [0, 0, 40000], "2026-06": [40000, 0, 20000] };

  it("001 hiç mahsup fişi yok: ay ay zincir (elle), yıl 0 / 500 / 200, Mart–Mayıs 1.000 / 500 / 400; ön izleme defterden (değişmedi); not bütün mahsupsuz ayları söyler", async () => {
    for (const [month, want] of Object.entries(MONTHS_001)) {
      const r = await report(monthRange(month), "", `001 ${month}`);
      assert.deepEqual(r.three, want, `001 ${month} zincir ${JSON.stringify(r.data.summary)}`);
    }
    const jun = await report(monthRange("2026-06"), "", "001 Haziran");
    assert.equal(jun.summary["Mahsup Edilmemiş Ay"], "Ocak 2026, Şubat 2026, Nisan 2026, Mayıs 2026 (devreden ve ödenecek KDV bu aylar sırayla mahsup edilmiş gibi hesaplandı; KDV Mahsup Fişi ön izlemesi defterdeki devredeni gösterir, ayları sırayla mahsup edin)");
    assert.ok(!("Zincirle Uyuşmayan Mahsup Fişi" in jun.summary), "mahsup fişi yok: uyuşmazlık yok");
    // Ön izleme DEĞİŞMEDİ (karar (6)): defterde 190 yok → Haziran 0 / 200 / 0 (rapor 400 / 0 / 200 — ayrışma notla söylenir).
    assert.deepEqual(await preview("2026-06"), [0, 20000, 0], "Haziran ön izlemesi (defterdeki 190 = 0)");
    const mar = await report(monthRange("2026-03"), "", "001 Mart");
    assert.equal(mar.data.rows.length, 0, "hareketsiz Mart: tablo boş");
    assert.match(mar.summary["Mahsup Edilmemiş Ay"] || "", /^Ocak 2026, Şubat 2026 \(/, "Mart: önceki mahsupsuz aylar");
    const year = await report({ from: "2026-01-01", to: "2026-12-31" }, "", "001 yıl");
    assert.deepEqual(year.three, [0, 50000, 20000], `001 yıl (tur 1: ödenecek 2.700, sonraki 0) ${JSON.stringify(year.data.summary)}`);
    assert.deepEqual(year.lines, YEAR_001_LINES, "001 yıl ay satırları (elle)");
    const spring = await report({ from: "2026-03-01", to: "2026-05-31" }, "", "001 Mart–Mayıs");
    assert.deepEqual(spring.three, [100000, 50000, 40000], "Mart–Mayıs: önceki Şubat sonu 1.000 (aralıktan önceki aylar zincire girer)");
    const all = await report({ preset: "all" }, "", "001 Tüm Zamanlar");
    assert.deepEqual(all.three, [0, 50000, 20000], "Tüm Zamanlar");
    const earlier = await report({ from: "2025-01-01", to: "2025-12-31" }, "", "001 2025");
    assert.deepEqual(earlier.three, [0, 0, 0], "verinin ilk ayından önce");
    assert.ok(!("Mahsup Edilmemiş Ay" in earlier.summary), "2025: not yok");
    const future = await report(monthRange("2027-03"), "", "001 Mart 2027");
    assert.deepEqual(future.three, [20000, 0, 20000], "gelecek dönem: zincirin son devredeni aynen");
    const tb = await trialBalances(api, "?to=2026-12-31");
    assert.equal(Math.round((tb["190"] ?? 0) * 100), 0, "defterde 190 yok (mahsup yok — defter DEĞİŞMEDİ)");
    await sameFiles({ from: "2026-01-01", to: "2026-12-31" }, "", "001 yıl");
  });

  it("001 aylar SIRAYLA mahsup edilir: her adımda rapor aynı (zincir mahsuptan bağımsız); sonunda rapor = ön izleme = fiş = 190 (A = B)", async () => {
    const fis = {};
    for (const month of ["2026-01", "2026-02", "2026-04", "2026-05", "2026-06"]) {
      fis[month] = await offset(month);
      const year = await report({ from: "2026-01-01", to: "2026-12-31" }, "", `001 yıl (${month} mahsubundan sonra)`);
      assert.deepEqual(year.three, [0, 50000, 20000], `${month} mahsubundan sonra yıl aynı`);
      assert.deepEqual(year.lines, YEAR_001_LINES, `${month} mahsubundan sonra ay satırları aynı`);
    }
    // Fişler zincirin sayılarıyla kesildi (defter = zincir).
    assert.deepEqual(Object.fromEntries(Object.entries(fis).map(([month, item]) => [month, [item.carryInMinor, item.payableMinor, item.carryOutMinor]])), { "2026-01": [0, 0, 200000], "2026-02": [200000, 0, 100000], "2026-04": [100000, 50000, 0], "2026-05": [0, 0, 40000], "2026-06": [40000, 0, 20000] }, "fişler");
    for (const [month, want] of Object.entries(MONTHS_001)) {
      const r = await report(monthRange(month), "", `001 ${month} mahsuplu`);
      assert.deepEqual(r.three, want, `001 ${month} rapor`);
      assert.deepEqual(await preview(month), want, `001 ${month} ön izleme = rapor`);
      assert.ok(!("Mahsup Edilmemiş Ay" in r.summary) && !("Zincirle Uyuşmayan Mahsup Fişi" in r.summary), `001 ${month}: not yok`);
    }
    const tb = await trialBalances(api, "?to=2026-06-30");
    assert.equal(Math.round((tb["190"] ?? 0) * 100), 20000, "defterde 190 = 200 = Haziran sonraki");
    await integrityOk(api, "001 sırayla mahsup");
  });

  it("002 kopuk zincir: Şubat atlanıp Mart mahsup edilmiş → rapor zinciri gösterir (Mart 1.600 / 0 / 600) + 'Zincirle Uyuşmayan Mahsup Fişi' notu; ön izleme ve defter değişmez", async () => {
    const marFis = await offset("2026-03", q2);
    assert.deepEqual([marFis.carryInMinor, marFis.payableMinor, marFis.carryOutMinor], [200000, 0, 100000], "Mart fişi defterdeki 2.000'le kesildi (ön izleme DEĞİŞMEDİ)");
    const feb = await report(monthRange("2026-02"), q2, "002 Şubat");
    assert.deepEqual(feb.three, [200000, 0, 160000], "Şubat (mahsupsuz): 2.000 − 400");
    const mar = await report(monthRange("2026-03"), q2, "002 Mart");
    assert.deepEqual(mar.three, [160000, 0, 60000], `Mart zincir (tur 1: 2.000 / 0 / 1.000) ${JSON.stringify(mar.data.summary)}`);
    assert.equal(mar.summary["Zincirle Uyuşmayan Mahsup Fişi"], "Mart 2026 fişi 2.000,00 TL devredenle kesilmiş, sırayla mahsupta 1.600,00 TL olmalıydı (raporda sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)");
    assert.match(mar.summary["Mahsup Edilmemiş Ay"] || "", /^Şubat 2026 \(/, "Mart: Şubat mahsupsuz");
    assert.deepEqual(await preview("2026-03", q2), [200000, 0, 100000], "Mart ön izlemesi (fiş) değişmedi");
    const apr = await report(monthRange("2026-04"), q2, "002 Nisan");
    assert.deepEqual(apr.three, [60000, 20000, 0], "Nisan zincir: 800 − 600 = 200 ödenecek");
    assert.deepEqual(await preview("2026-04", q2), [100000, 0, 20000], "Nisan ön izlemesi defterden: 800 − 1.000 → devreden 200 (karar (6): ayrışır)");
    assert.match(apr.summary["Zincirle Uyuşmayan Mahsup Fişi"] || "", /^Mart 2026 fişi /, "Nisan: Mart'ın uyuşmazlığı Nisan'ın sayısını etkiler");
    const jan = await report(monthRange("2026-01"), q2, "002 Ocak");
    assert.ok(!("Zincirle Uyuşmayan Mahsup Fişi" in jan.summary), "Ocak: uyuşmazlık aralıktan sonra — not yok");
    const year = await report({ from: "2026-01-01", to: "2026-12-31" }, q2, "002 yıl");
    assert.deepEqual(year.three, [0, 20000, 0], "002 yıl");
    assert.deepEqual(year.lines, [["Ocak 2026", "Sonraki Döneme Devreden KDV", 200000], ["Şubat 2026", "Önceki Dönemden Devreden KDV", 200000], ["Şubat 2026", "Sonraki Döneme Devreden KDV", 160000], ["Mart 2026", "Önceki Dönemden Devreden KDV", 160000], ["Mart 2026", "Sonraki Döneme Devreden KDV", 60000], ["Nisan 2026", "Önceki Dönemden Devreden KDV", 60000], ["Nisan 2026", "Ödenecek KDV", 20000]], "002 yıl ay satırları");
    const tb = await trialBalances(api, `?to=2026-12-31&${q2}`);
    assert.equal(Math.round((tb["190"] ?? 0) * 100), 100000, "defterde 190 = Mart fişinin 1.000'i (defter DEĞİŞMEDİ)");
    await sameFiles(monthRange("2026-03"), q2, "002 Mart");
    // Onarım: Mart geri alınır, Şubat ve Mart sırayla mahsup edilir → rapor aynı sayı, ön izleme = rapor, not yok.
    await must("Mart geri al", api.post(amp(`${TAX}/vat-offset/${marFis.id}/reverse`, q2), {}));
    const febFis = await offset("2026-02", q2);
    assert.deepEqual([febFis.carryInMinor, febFis.carryOutMinor], [200000, 160000], "Şubat fişi");
    const marFis2 = await offset("2026-03", q2);
    assert.deepEqual([marFis2.carryInMinor, marFis2.payableMinor, marFis2.carryOutMinor], [160000, 0, 60000], "Mart fişi yeniden: zincirin sayısı");
    for (const [month, want] of Object.entries({ "2026-02": [200000, 0, 160000], "2026-03": [160000, 0, 60000], "2026-04": [60000, 20000, 0] })) {
      const r = await report(monthRange(month), q2, `002 ${month} onarım`);
      assert.deepEqual(r.three, want, `002 ${month} rapor (onarımdan sonra aynı)`);
      assert.deepEqual(await preview(month, q2), want, `002 ${month} ön izleme = rapor`);
      assert.ok(!("Mahsup Edilmemiş Ay" in r.summary) && !("Zincirle Uyuşmayan Mahsup Fişi" in r.summary), `002 ${month}: not yok`);
    }
    await integrityOk(api, "002 kopuk zincir");
  });

  it("iki şirket karışmaz: 001'in mahsupları 002'nin zincirine, 002'ninki 001'e girmez", async () => {
    const one = await report({ from: "2026-01-01", to: "2026-12-31" }, "", "001 yıl");
    assert.deepEqual(one.three, [0, 50000, 20000]);
    const two = await report({ from: "2026-01-01", to: "2026-12-31" }, q2, "002 yıl");
    assert.deepEqual(two.three, [0, 20000, 0]);
  });

  it("001 mahsuptan sonra artıran kayıt (Haziran 'Güncel Değil'): ay ay rapor = ön izleme (A = B, karar (3)); aralığın sonraki devredeni son KDV'li ayın sonucu", async () => {
    // Haziran mahsup edildikten sonra Haziran tarihli alış 500 (KDV 100): Haziran (bugünkü sayılarla) 200 − 100 − 400 → sonraki 300; fiş ve defter 200'de kalır ("Güncel Değil").
    await buy("001", "2026-06-20", 500);
    const jun = await report(monthRange("2026-06"), "", "001 Haziran (Güncel Değil)");
    assert.deepEqual(jun.three, [40000, 0, 30000], "Haziran bugünkü sayılarla (elle)");
    assert.deepEqual(await preview("2026-06"), [40000, 0, 30000], "Haziran ön izleme = rapor");
    assert.equal(jun.summary["Mahsuptan Sonra Değişen Ay"], "Haziran 2026 (mahsup fişi güncel değil — mahsubu geri alıp yeniden mahsup edin)", "Haziran mahsubu güncel değil (S-M1-3 = C: sayılar bugünkü kayıtlardan + not)");
    // Temmuz hareketsiz. 2.5.1 M1 küçük tur 4 — S-M1K3-1 = A (27.11 20:59 UTC, kullanıcının 20:26 yetkisiyle öneri uygulandı): HER 'güncel değil' ayında sonraki aya BU AYIN
    // bugünkü devredeni taşınır → zincir Temmuz'a Haziran'ın bugünkü 300'ünü taşır (tur 2–3: fişin 200'ü). Ön izleme DEĞİŞMEDİ: defterdeki 190 = 200 (karar (6): mahsupsuz ayda
    // rapor ile ön izleme ayrışabilir); artış S4'e girmez (yalnız azaltan taşınır) — bir kez, devredenle sayılır.
    const jul = await report(monthRange("2026-07"), "", "001 Temmuz");
    assert.deepEqual(jul.three, [30000, 0, 30000], "Temmuz = Haziran'ın bugünkü devredeni 300 (S-M1K3-1 = A; tur 2–3: 200)");
    assert.deepEqual(await preview("2026-07"), [20000, 0, 20000], "Temmuz ön izleme = defterdeki 190 (DEĞİŞMEDİ)");
    // Haziran–Temmuz: önceki Mayıs sonu 400, ödenecek 0, sonraki = son KDV'li ayın (Haziran) sonucu 300 — tur 1 (A) ile aynı.
    const both = await report({ from: "2026-06-01", to: "2026-07-31" }, "", "001 Haziran–Temmuz");
    assert.deepEqual(both.three, [40000, 0, 30000], "Haziran–Temmuz");
  });
});
