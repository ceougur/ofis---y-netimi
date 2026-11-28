// 2.5.1 M1 küçük tur 5 — KDV Özeti: 'güncel değil' (İndirilecek KDV'si fişten sonra ARTMIŞ) ay S4 birikimine bugünkü İ'siyle girer (S-DKM1K-1 = A).
//   KDV Özeti tek dar kontrolü ORTA-1 (28.11): 'güncel değil' ay zincire fişin saklı İ'siyle giriyordu → artış sonraki azalan ayın azalmasını götürüyor, azalma hiçbir ayda
//   sayılmıyordu. KULLANICI KARARIYLA ÖNERİ UYGULANDI (27.11 20:26 yetkisi, AYNEN: "bir süre ekran başında olmayacağım. sorularına baş mimar önerilerini uygula") = A (28.11 03:55
//   UTC): Mart'ın 200'lük azalması Nisan'da (S-DKM1-1 = A metni) — Nisan 700, Ocak–Nisan 1.600 = 391 − 191; Nisan raporu Nisan ön izlemesinden (500) ayrılır; Şubat'ın 'güncel
//   değil' notu durur. Örnek (AYNEN): Ocak alış KDV 1.000 fiş 0 / 0 / 1.000; Şubat satış 2.000 alış 500 fiş 1.000 / 500 / 0; Mart satış 1.000 alış 200 + 100 fiş 0 / 700 / 0;
//   Nisan satış 500 fişsiz; fişlerden sonra Şubat'a alış KDV +300, Mart'ın 200'lük alışı İptal Et. Bugün (taban t251-m1k4): Ocak–Nisan 1.400, Nisan 500.
//   Önceki kararlar DEĞİŞMEZ: S-DKM1-1 = A, S-M1K-1 = A, S-M1K2-1 = A, S-M1K3-1 = A (öbür dosyalarda sınamalı). Defter / mahsup fişi / ön izleme DEĞİŞMEZ.
// KÂHİN ELLE (karar metni + elle hesap; programın kodundan türetilmedi — ders 5). Veri programın API'sinden; sahte saat (ders 13); KDV %20. Sayılar yanıt gövdesinden ve
// veri tabanından (mahsup fişi listesi, mizan) okunur (ders 3). Yardımcılar test/kdv-ozeti-yalniz391-251.test.mjs'ten AYNEN (o dosyanın kalıbı).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, integrityOk, must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { trialBalances } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const INV = "/api/workspace/invoices";
const TAX = "/api/workspace/tax";
const RESULT_LABELS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"];
const DOC_KINDS = ["Satış", "Serbest Meslek Makbuzu", "Satıştan İade", "Alış", "Alıştan İade"];
const CHANGED = "Mahsuptan Sonra Değişen Ay";
const MISMATCH = "Zincirle Uyuşmayan Mahsup Fişi";
const PENDING = "Mahsup Edilmemiş Ay";
const MIXED_TEXT = "(mahsup fişi güncel değil — Hesaplanan KDV bugünkü kayıtlardan, İndirilecek KDV kesilmiş mahsup fişinden alındı, azalma sonraki mahsupta düşülür; mahsubu geri alıp yeniden mahsup edin)";
const REDUCED_TEXT = "(bu ayın kayıtları fişten sonra değişti; ayın sonucu kesilmiş mahsup fişinden, İndirilecek KDV'deki azalma sonraki mahsupta düşülür)";
const STALE_TEXT = "(mahsup fişi güncel değil — mahsubu geri alıp yeniden mahsup edin)";
// 2.5.1 M1 küçük tur 7 (tur 6 raporunun BAŞ MİMAR KARARI (1)): devreden farkı kolunda önceki aylarda güncel olmayan fiş varsa onarım o İLK aydan (bu dosyadaki uyuşmazlıkların hepsinde var).
const mismatchTail = restart => ` (raporda sırayla mahsup sayıları; mahsup fişi güncel olmayan ilk aydan (${restart}) başlayarak mahsupları geri alın, ayları sırayla yeniden mahsup edin)`;
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
const amp = (url, q) => (q ? `${url}${url.includes("?") ? "&" : "?"}${q}` : url);

/** İki şirketli program (001 + 002) ve API yardımcıları; sayılar yanıt gövdesinden (ders 3). */
async function program(now, prefix) {
  const ctx = await boot({ now, maxCompanies: 2 });
  const api = ctx.api;
  const created = await must("002", api.post("/api/companies", { name: `${prefix} İkinci Şirket`, select: false }));
  const q2 = `hofCompany=${encodeURIComponent((created.company || created).id)}`;
  const qOf = tag => (tag === "002" ? q2 : "");
  const ids = {};
  for (const tag of ["001", "002"]) {
    ids[`M${tag}`] = (await must(`müşteri ${tag}`, api.post(amp("/api/workspace/accounts", qOf(tag)), { name: `${prefix} Müşteri ${tag}`, type: "customer", registeredOn: "2025-01-01" }))).id;
    ids[`T${tag}`] = (await must(`tedarikçi ${tag}`, api.post(amp("/api/workspace/accounts", qOf(tag)), { name: `${prefix} Tedarikçi ${tag}`, type: "supplier", registeredOn: "2025-01-01" }))).id;
  }
  let n = 0;
  const h = {
    ctx,
    api,
    buy: async (tag, date, net) => (await must(`alış ${tag} ${date}`, api.post(amp(INV, qOf(tag)), { kind: "purchase", scenario: "expense_purchase", accountId: ids[`T${tag}`], issueDate: date, number: `${prefix}-${tag}-${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id,
    sell: async (tag, date, net) => (await must(`satış ${tag} ${date}`, api.post(amp(INV, qOf(tag)), { scenario: "service_sale", accountId: ids[`M${tag}`], issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }))).id,
    cancel: async (tag, id) => must(`İptal Et ${tag}`, api.post(amp(`${INV}/${id}/cancel`, qOf(tag)), { reason: "Hatalı fatura", force: true })),
    offset: async (tag, month) => {
      const o = (await must(`mahsup ${tag} ${month}`, api.post(amp(`${TAX}/vat-offset`, qOf(tag)), { month }))).offset;
      return [o.carryInMinor, o.payableMinor, o.carryOutMinor];
    },
    reverse: async (tag, month) => {
      const list = (await must("mahsup listesi", api.get(amp(`${TAX}/vat-offset`, qOf(tag))))).offsets;
      const row = list.find(item => item.month === month && item.status === "active");
      assert.ok(row, `${tag} ${month} etkin fiş`);
      return must(`geri al ${tag} ${month}`, api.post(amp(`${TAX}/vat-offset/${row.id}/reverse`, qOf(tag)), {}));
    },
    /** Etkin fişler (veri tabanından): [ay, önceki, ödenecek, sonraki, güncel değil]. */
    offsets: async tag => (await must("mahsup listesi", api.get(amp(`${TAX}/vat-offset`, qOf(tag))))).offsets.filter(item => item.status === "active").map(item => [item.month, item.carryInMinor, item.payableMinor, item.carryOutMinor, item.stale]),
    preview: async (tag, month) => {
      const p = (await must(`ön izleme ${tag} ${month}`, api.get(amp(`${TAX}/vat-offset?month=${month}`, qOf(tag))))).preview;
      return [p.carryInMinor, p.payableMinor, p.carryOutMinor];
    },
    report: async (tag, query, label = `${tag} ${qs(query)}`) => {
      const res = await api.get(amp(`${RC}/kdv-ozeti?${qs(query)}`, qOf(tag)));
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      const data = res.data;
      const summary = Object.fromEntries(data.summary);
      const g = data.headers.indexOf("Belge Türü");
      const k = data.headers.indexOf("KDV");
      const three = RESULT_LABELS.map(name => minor(summary[name]));
      const foot = (data.footers || []).filter(line => RESULT_LABELS.includes(line[g])).map(line => minor(line[k]));
      if (data.rows.length) assert.deepEqual(foot, three, `${label}: tablo altı = özet`);
      const lines = data.rows.filter(row => !DOC_KINDS.includes(row[g])).map(row => [row[0], row[g], minor(row[k])]);
      return { data, summary, three, lines, h391: minor(summary["Hesaplanan KDV (391) (İadeler Düşülmüş)"]), h191: minor(summary["İndirilecek KDV (191) (İadeler Düşülmüş)"]) };
    },
    /** Ekran = PDF = Excel (tablo, tablo altı ve özet — not satırlarının metni dahil). */
    sameFiles: async (tag, query, label) => {
      const { data } = await h.report(tag, query, label);
      const pdf = await api.raw("GET", amp(`${RC}/kdv-ozeti/pdf?${qs(query)}`, qOf(tag)));
      assert.equal(pdf.status, 200, `${label} PDF`);
      const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
      for (const row of [...data.rows, ...data.footers]) for (const cell of row) if (String(cell).trim()) assert.ok(text.includes(String(cell).trim()), `${label} PDF hücresi: "${cell}"`);
      for (const [name, value] of data.summary) if (minor(value) !== null) assert.ok(text.includes(String(value).trim()), `${label} PDF özet ${name}: "${value}"`);
      const xlsx = await api.raw("GET", amp(`${RC}/kdv-ozeti/xlsx?${qs(query)}`, qOf(tag)));
      assert.equal(xlsx.status, 200, `${label} Excel`);
      const sheets = Object.values(xlsxSheets(xlsx.buffer));
      const sheet = sheets[0].slice(Math.max(0, sheets[0].findIndex(row => row.length > 1)));
      assert.equal(sheet.length, 1 + data.rows.length + (data.rows.length ? data.footers.length : 0), `${label} Excel satır sayısı`);
      [...data.rows, ...data.footers].forEach((row, index) => {
        row.forEach((cell, c) => {
          const want = minor(cell);
          const got = sheet[1 + index][c];
          if (want !== null) assert.equal(typeof got === "number" ? Math.round(got * 100) : minor(got), want, `${label} Excel satır ${index + 1} ${data.headers[c]}`);
        });
      });
      const book = sheets.find(rows => rows.some(row => String(row[0]).trim() === "Önceki Dönemden Devreden KDV"));
      assert.ok(book, `${label} Excel özet sayfası`);
      for (const [name, value] of data.summary) {
        const row = book.find(item => String(item[0]).trim() === name);
        assert.ok(row, `${label} Excel özet satırı ${name}`);
        const want = minor(value);
        if (want !== null) assert.equal(typeof row[1] === "number" ? Math.round(row[1] * 100) : minor(row[1]), want, `${label} Excel özet ${name}`);
        else assert.equal(String(row[1]).trim(), String(value).trim(), `${label} Excel özet ${name}`);
      }
    },
  };
  return h;
}

const balanced = (r, label) => assert.equal(r.three[1] - r.three[2] + r.three[0], r.h391 - r.h191, `${label}: Ödenecek − Sonraki + Önceki = 391 − 191 (${JSON.stringify(r.three)}, 391 ${r.h391}, 191 ${r.h191})`);

describe("2.5.1 M1 küçük tur 5 — S-DKM1K-1 = A: 'güncel değil' (İ artmış) aydan sonra azalan ay — kararın örneği AYNEN, yan etki (Nisan mahsubu), onarım, yıl dönümü", () => {
  let h;
  let marBuy;
  before(async () => {
    h = await program("2027-03-15T12:00:00+03:00", "S5");
    // 001 — kararın örneği AYNEN: Ocak alış KDV 1.000 (fiş 0 / 0 / 1.000); Şubat satış 2.000 alış 500 (fiş 1.000 / 500 / 0); Mart satış 1.000 alış 200 + 100 (fiş 0 / 700 / 0);
    // Nisan satış 500 fişsiz; fişlerden sonra Şubat'a alış KDV +300, Mart'ın 200'lük alışı İptal Et.
    await h.buy("001", "2026-01-10", 5000);
    assert.deepEqual(await h.offset("001", "2026-01"), [0, 0, 100000], "001 Ocak fişi 0 / 0 / 1.000");
    await h.sell("001", "2026-02-10", 10000);
    await h.buy("001", "2026-02-11", 2500);
    assert.deepEqual(await h.offset("001", "2026-02"), [100000, 50000, 0], "001 Şubat fişi 1.000 / 500 / 0");
    await h.sell("001", "2026-03-10", 5000);
    marBuy = await h.buy("001", "2026-03-11", 1000);
    await h.buy("001", "2026-03-12", 500);
    assert.deepEqual(await h.offset("001", "2026-03"), [0, 70000, 0], "001 Mart fişi 0 / 700 / 0");
    await h.sell("001", "2026-04-10", 2500);
    await h.buy("001", "2026-02-20", 1500);
    await h.cancel("001", marBuy);
    // 002 — aynı örnek yıl dönümünde: Kasım 2026 (fiş devreden 1.000), Aralık 2026 = 'güncel değil' ay (alış KDV +300), Ocak 2027 = azalan ay (200'lük alış İptal Et), Şubat 2027 fişsiz.
    await h.buy("002", "2026-11-10", 5000);
    assert.deepEqual(await h.offset("002", "2026-11"), [0, 0, 100000], "002 Kasım fişi");
    await h.sell("002", "2026-12-10", 10000);
    await h.buy("002", "2026-12-11", 2500);
    assert.deepEqual(await h.offset("002", "2026-12"), [100000, 50000, 0], "002 Aralık fişi");
    await h.sell("002", "2027-01-10", 5000);
    const janBuy = await h.buy("002", "2027-01-11", 1000);
    await h.buy("002", "2027-01-12", 500);
    assert.deepEqual(await h.offset("002", "2027-01"), [0, 70000, 0], "002 Ocak 2027 fişi");
    await h.sell("002", "2027-02-10", 2500);
    await h.buy("002", "2026-12-20", 1500);
    await h.cancel("002", janBuy);
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 kararın örneği: Nisan 700, Ocak–Nisan 1.600 = 391 3.500 − 191 1.900; Şubat 'güncel değil' notu durur; fiş / ön izleme / defter değişmez; ekran = PDF = Excel", async () => {
    assert.deepEqual(await h.offsets("001"), [["2026-01", 0, 0, 100000, false], ["2026-02", 100000, 50000, 0, true], ["2026-03", 0, 70000, 0, false]], "fişler (veri tabanı): Şubat güncel değil");
    const all = await h.report("001", { from: "2026-01-01", to: "2026-04-30" }, "001 Ocak–Nisan");
    assert.deepEqual([all.h391, all.h191], [350000, 190000], "391 3.500, 191 1.900 (bugünkü kayıtlar)");
    assert.deepEqual(all.three, [0, 160000, 0], `Ocak–Nisan Ödenecek 1.600 (taban 1.400 — Mart'ın 200'lük azalması hiçbir ayda sayılmıyordu) ${JSON.stringify(all.data.summary)}`);
    balanced(all, "001 Ocak–Nisan");
    assert.deepEqual(
      all.lines,
      [["Ocak 2026", "Sonraki Döneme Devreden KDV", 100000], ["Şubat 2026", "Önceki Dönemden Devreden KDV", 100000], ["Şubat 2026", "Ödenecek KDV", 20000], ["Mart 2026", "Ödenecek KDV", 70000], ["Nisan 2026", "Önceki Dönem İndirilecek KDV Azalışı (Mart 2026)", 20000], ["Nisan 2026", "Ödenecek KDV", 70000]],
      "ay satırları: Şubat bugünkü kayıtlardan 200, Mart fişten 700, Nisan 500 + 200 = 700",
    );
    assert.equal(all.summary[CHANGED], `Şubat 2026 ${STALE_TEXT}; Mart 2026 ${REDUCED_TEXT}`, "Şubat 'güncel değil' notu durur; Mart azalan ay notu");
    assert.ok(!(MISMATCH in all.summary) && !(PENDING in all.summary), `uyuşmazlık / mahsupsuz notu yok ${JSON.stringify(all.data.summary)}`);
    const apr = await h.report("001", monthRange("2026-04"), "001 Nisan");
    assert.deepEqual(apr.three, [0, 70000, 0], `Nisan 700 (taban 500) ${JSON.stringify(apr.data.summary)}`);
    const mar = await h.report("001", monthRange("2026-03"), "001 Mart");
    assert.deepEqual(mar.three, [0, 70000, 0], "Mart sonucu kesilmiş fişten (S-DKM1-1 = A)");
    assert.equal(mar.summary[CHANGED], `Mart 2026 ${REDUCED_TEXT}`, "Mart notu");
    const feb = await h.report("001", monthRange("2026-02"), "001 Şubat");
    assert.deepEqual(feb.three, [100000, 20000, 0], "Şubat bugünkü kayıtlardan (S-M1-3 = C)");
    assert.equal(feb.summary[CHANGED], `Şubat 2026 ${STALE_TEXT}`, "Şubat notu");
    for (const query of [{ preset: "all" }, { from: "2026-01-01", to: "2026-12-31" }]) {
      const r = await h.report("001", query, `001 ${qs(query)}`);
      assert.deepEqual(r.three, [0, 160000, 0], `${qs(query)} 1.600`);
      balanced(r, `001 ${qs(query)}`);
    }
    // Ön izleme DEĞİŞMEDİ (defterin saklı İ'leriyle): Nisan 500 — rapor (700) ön izlemeden ayrılır (karar metni).
    assert.deepEqual(await h.preview("001", "2026-02"), [100000, 20000, 0], "Şubat ön izlemesi");
    assert.deepEqual(await h.preview("001", "2026-03"), [0, 90000, 0], "Mart ön izlemesi");
    assert.deepEqual(await h.preview("001", "2026-04"), [0, 50000, 0], "Nisan ön izlemesi 500 (DEĞİŞMEDİ)");
    const tb = await trialBalances(h.api, "?to=2026-04-30");
    assert.equal(Math.abs(Math.round((tb["360"] ?? 0) * 100)), 120000, "defterde 360 = 1.200 (Şubat 500 + Mart 700; defter DEĞİŞMEDİ)");
    assert.equal(Math.round((tb["190"] ?? 0) * 100), 0, "defterde 190 = 0");
    await h.sameFiles("001", { from: "2026-01-01", to: "2026-04-30" }, "001 Ocak–Nisan");
    await h.sameFiles("001", monthRange("2026-04"), "001 Nisan");
  });

  it("002 yıl dönümü: Bu Yıl (2027) 1.400 = 391 − 191 (Şubat 2027 700); 2026 yılı 200; Kasım–Şubat 1.600; 001 etkilenmez", async () => {
    const year = await h.report("002", { preset: "thisYear" }, "002 Bu Yıl");
    assert.deepEqual(year.three, [0, 140000, 0], `Bu Yıl (2027): Ocak 700 (fiş) + Şubat 700 (taban 500) ${JSON.stringify(year.data.summary)}`);
    assert.deepEqual([year.h391, year.h191], [150000, 10000], "2027: 391 1.500, 191 100");
    balanced(year, "002 Bu Yıl");
    assert.equal(year.summary[CHANGED], `Ocak 2027 ${REDUCED_TEXT}`, "Ocak 2027 azalan ay notu");
    const feb = await h.report("002", monthRange("2027-02"), "002 Şubat 2027");
    assert.deepEqual(feb.three, [0, 70000, 0], "Şubat 2027: 500 + 200 (Ocak'ın azalması)");
    const last = await h.report("002", { from: "2026-01-01", to: "2026-12-31" }, "002 2026");
    assert.deepEqual(last.three, [0, 20000, 0], "2026 yılı: Aralık bugünkü kayıtlardan 200");
    balanced(last, "002 2026");
    assert.equal(last.summary[CHANGED], `Aralık 2026 ${STALE_TEXT}`, "Aralık 'güncel değil' notu durur");
    const span = await h.report("002", { from: "2026-11-01", to: "2027-02-28" }, "002 Kasım–Şubat");
    assert.deepEqual(span.three, [0, 160000, 0], `Kasım–Şubat 1.600 (taban 1.400) ${JSON.stringify(span.data.summary)}`);
    balanced(span, "002 Kasım–Şubat");
    assert.deepEqual(await h.preview("002", "2027-02"), [0, 50000, 0], "Şubat 2027 ön izlemesi 500 (DEĞİŞMEDİ)");
    await h.sameFiles("002", { preset: "thisYear" }, "002 Bu Yıl");
    assert.deepEqual((await h.report("001", { from: "2026-01-01", to: "2026-04-30" }, "001 Ocak–Nisan")).three, [0, 160000, 0], "001 aynı (şirketler ayrı)");
  });

  it("001 yan etki: Nisan ön izlemeyle (500) mahsup edilirse fiş zincirle uyuşmaz, rapor 700 ve 1.600 kalır; onarımda (geri al + sırayla) rapor = fişler = 391 − 191", async () => {
    assert.deepEqual(await h.offset("001", "2026-04"), [0, 50000, 0], "Nisan fişi ön izlemeyle 500");
    assert.deepEqual((await h.offsets("001")).at(-1), ["2026-04", 0, 50000, 0, false], "Nisan fişi (veri tabanı) — programın 'Güncel Değil'i yok");
    const apr = await h.report("001", monthRange("2026-04"), "001 Nisan (fişli)");
    assert.deepEqual(apr.three, [0, 70000, 0], `Nisan raporu sırayla mahsup sayısı 700 (fiş 500) ${JSON.stringify(apr.data.summary)}`);
    // 2.5.1 M1 küçük tur 6 (baş mimar kararı 28.11 07:40 (1)(a)): zincirin S4 emilimi fişinkinden eksi → neden 'fiş azalmayı düşmemiş', onarım güncel olmayan ilk aydan (Şubat).
    assert.equal(
      apr.summary[MISMATCH],
      "Nisan 2026 fişi ödenecek KDV 500,00 TL yazmış, sırayla mahsupta ödenecek KDV 700,00 TL olmalıydı — fiş İndirilecek KDV'deki azalmayı düşmemiş (raporda sırayla mahsup sayıları; mahsup fişi güncel olmayan ilk aydan (Şubat 2026) başlayarak mahsupları geri alın, ayları sırayla yeniden mahsup edin)",
      `Nisan uyuşmazlık notu: ${apr.summary[MISMATCH]}`,
    );
    const all = await h.report("001", { from: "2026-01-01", to: "2026-04-30" }, "001 Ocak–Nisan (Nisan fişli)");
    assert.deepEqual(all.three, [0, 160000, 0], "Ocak–Nisan yine 1.600");
    balanced(all, "001 Ocak–Nisan (Nisan fişli)");
    assert.equal(all.summary["KDV Mahsup Fişi"], "Ocak 2026, Şubat 2026, Mart 2026, Nisan 2026", "dört fiş");
    const tb = await trialBalances(h.api, "?to=2026-04-30");
    assert.equal(Math.abs(Math.round((tb["360"] ?? 0) * 100)), 170000, "defterde 360 = 1.700 (fişler 500 + 700 + 500; defter rapordan ayrı — Şubat fişi güncel değil)");
    await h.sameFiles("001", monthRange("2026-04"), "001 Nisan (fişli)");
    // Onarım: Nisan, Mart, Şubat geri alınır; aylar sırayla yeniden mahsup → Şubat 200, Mart 900, Nisan 500 = 1.600; notlar kalkar; defter = rapor.
    for (const month of ["2026-04", "2026-03", "2026-02"]) await h.reverse("001", month);
    assert.deepEqual(await h.offset("001", "2026-02"), [100000, 20000, 0], "Şubat yeniden 200");
    assert.deepEqual(await h.offset("001", "2026-03"), [0, 90000, 0], "Mart yeniden 900");
    assert.deepEqual(await h.offset("001", "2026-04"), [0, 50000, 0], "Nisan yeniden 500");
    const fixed = await h.report("001", { from: "2026-01-01", to: "2026-04-30" }, "001 onarım");
    assert.deepEqual(fixed.three, [0, 160000, 0], "onarımdan sonra 1.600");
    assert.deepEqual(fixed.lines.filter(line => line[1] === "Ödenecek KDV").map(line => line[2]), [20000, 90000, 50000], "rapor = fişler");
    assert.ok(!(CHANGED in fixed.summary) && !(MISMATCH in fixed.summary), `notlar kalkar ${JSON.stringify(fixed.data.summary)}`);
    const tb2 = await trialBalances(h.api, "?to=2026-04-30");
    assert.equal(Math.abs(Math.round((tb2["360"] ?? 0) * 100)), 160000, "onarımdan sonra defterde 360 = 1.600 = rapor");
    await integrityOk(h.api, "001 onarım");
  });
});

describe("2.5.1 M1 küçük tur 5 — S-DKM1K-1 = A: iki ardışık 'güncel değil' ay; devreden yönlü 'güncel değil' ay + araya zincirle uyuşmayan ay", () => {
  let h;
  before(async () => {
    h = await program("2026-07-15T12:00:00+03:00", "S5B");
    // 001 — Şubat ve Mart 'güncel değil' (İ +300, +100; ödenecek yönde kalırlar), Nisan azalan ay (200'lük alış İptal Et), Mayıs fişsiz.
    await h.buy("001", "2026-01-10", 5000);
    assert.deepEqual(await h.offset("001", "2026-01"), [0, 0, 100000], "001 Ocak");
    await h.sell("001", "2026-02-10", 10000);
    await h.buy("001", "2026-02-11", 2500);
    assert.deepEqual(await h.offset("001", "2026-02"), [100000, 50000, 0], "001 Şubat");
    await h.sell("001", "2026-03-10", 5000);
    await h.buy("001", "2026-03-11", 1000);
    assert.deepEqual(await h.offset("001", "2026-03"), [0, 80000, 0], "001 Mart");
    await h.sell("001", "2026-04-10", 5000);
    const aprBuy = await h.buy("001", "2026-04-11", 1000);
    await h.buy("001", "2026-04-12", 500);
    assert.deepEqual(await h.offset("001", "2026-04"), [0, 70000, 0], "001 Nisan");
    await h.sell("001", "2026-05-10", 2500);
    await h.buy("001", "2026-02-20", 1500);
    await h.buy("001", "2026-03-20", 500);
    await h.cancel("001", aprBuy);
    // 002 — Şubat DEVREDEN yönde kesilmiş (500), sonra İ +300 → bugün devreden 800; Mart fişi 500 devredenle (zincirle uyuşmaz); Nisan azalan ay; Mayıs fişsiz.
    await h.buy("002", "2026-01-10", 5000);
    assert.deepEqual(await h.offset("002", "2026-01"), [0, 0, 100000], "002 Ocak");
    await h.sell("002", "2026-02-10", 5000);
    await h.buy("002", "2026-02-11", 2500);
    assert.deepEqual(await h.offset("002", "2026-02"), [100000, 0, 50000], "002 Şubat devreden 500");
    await h.sell("002", "2026-03-10", 10000);
    await h.buy("002", "2026-03-11", 1000);
    assert.deepEqual(await h.offset("002", "2026-03"), [50000, 130000, 0], "002 Mart 1.300");
    await h.sell("002", "2026-04-10", 5000);
    const aprBuy2 = await h.buy("002", "2026-04-11", 1000);
    await h.buy("002", "2026-04-12", 500);
    assert.deepEqual(await h.offset("002", "2026-04"), [0, 70000, 0], "002 Nisan");
    await h.sell("002", "2026-05-10", 2500);
    await h.buy("002", "2026-02-20", 1500);
    await h.cancel("002", aprBuy2);
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 iki ardışık 'güncel değil': Mayıs 700, Ocak–Mayıs 2.300 = 391 4.500 − 191 2.200 (taban 2.100); notlar; Mayıs ön izlemesi 500 (DEĞİŞMEDİ)", async () => {
    const all = await h.report("001", { from: "2026-01-01", to: "2026-05-31" }, "001 Ocak–Mayıs");
    assert.deepEqual([all.h391, all.h191], [450000, 220000], "391 4.500, 191 2.200");
    assert.deepEqual(all.three, [0, 230000, 0], `Ocak–Mayıs 2.300 ${JSON.stringify(all.data.summary)}`);
    balanced(all, "001 Ocak–Mayıs");
    assert.deepEqual(all.lines.filter(line => line[1] === "Ödenecek KDV"), [["Şubat 2026", "Ödenecek KDV", 20000], ["Mart 2026", "Ödenecek KDV", 70000], ["Nisan 2026", "Ödenecek KDV", 70000], ["Mayıs 2026", "Ödenecek KDV", 70000]], "ay satırları");
    assert.equal(all.summary[CHANGED], `Şubat 2026, Mart 2026 ${STALE_TEXT}; Nisan 2026 ${REDUCED_TEXT}`, "notlar");
    assert.deepEqual((await h.report("001", monthRange("2026-05"), "001 Mayıs")).three, [0, 70000, 0], "Mayıs 500 + 200 (taban 500)");
    assert.deepEqual(await h.preview("001", "2026-05"), [0, 50000, 0], "Mayıs ön izlemesi (DEĞİŞMEDİ)");
    await h.sameFiles("001", { from: "2026-01-01", to: "2026-05-31" }, "001 Ocak–Mayıs");
  });

  it("002 devreden yönlü 'güncel değil' + uyuşmayan Mart: Mayıs 700, Ocak–Mayıs 2.400 = 391 4.500 − 191 2.100 (taban 2.200); Mart uyuşmazlık notu", async () => {
    const all = await h.report("002", { from: "2026-01-01", to: "2026-05-31" }, "002 Ocak–Mayıs");
    assert.deepEqual([all.h391, all.h191], [450000, 210000], "391 4.500, 191 2.100");
    assert.deepEqual(all.three, [0, 240000, 0], `Ocak–Mayıs 2.400 ${JSON.stringify(all.data.summary)}`);
    balanced(all, "002 Ocak–Mayıs");
    assert.deepEqual(
      all.lines,
      [
        ["Ocak 2026", "Sonraki Döneme Devreden KDV", 100000],
        ["Şubat 2026", "Önceki Dönemden Devreden KDV", 100000],
        ["Şubat 2026", "Sonraki Döneme Devreden KDV", 80000],
        ["Mart 2026", "Önceki Dönemden Devreden KDV", 80000],
        ["Mart 2026", "Ödenecek KDV", 100000],
        ["Nisan 2026", "Ödenecek KDV", 70000],
        ["Mayıs 2026", "Önceki Dönem İndirilecek KDV Azalışı (Nisan 2026)", 20000],
        ["Mayıs 2026", "Ödenecek KDV", 70000],
      ],
      "ay satırları: Şubat bugünkü devreden 800 → Mart 1.000 (zincir), Nisan fişten 700, Mayıs 500 + 200",
    );
    assert.equal(all.summary[MISMATCH], `Mart 2026 fişi 500,00 TL devredenle kesilmiş, sırayla mahsupta 800,00 TL olmalıydı${mismatchTail("Şubat 2026")}`, "Mart uyuşmazlık notu");
    assert.equal(all.summary[CHANGED], `Şubat 2026 ${STALE_TEXT}; Nisan 2026 ${REDUCED_TEXT}`, "notlar");
    assert.deepEqual(await h.preview("002", "2026-05"), [0, 50000, 0], "Mayıs ön izlemesi (DEĞİŞMEDİ)");
    await h.sameFiles("002", { from: "2026-01-01", to: "2026-05-31" }, "002 Ocak–Mayıs");
  });
});

describe("2.5.1 M1 küçük tur 5 — DEĞİŞMEYENLER (tabanda da yeşil): yalnız İ artışı (azalma yok); azalan ay ÖNCE, 'güncel değil' ay SONRA", () => {
  let h;
  before(async () => {
    h = await program("2026-06-15T12:00:00+03:00", "S5C");
    // 001 — kararın örneği, Mart'ın alışı İptal EDİLMEZ: yalnız Şubat İ +300.
    await h.buy("001", "2026-01-10", 5000);
    assert.deepEqual(await h.offset("001", "2026-01"), [0, 0, 100000], "001 Ocak");
    await h.sell("001", "2026-02-10", 10000);
    await h.buy("001", "2026-02-11", 2500);
    assert.deepEqual(await h.offset("001", "2026-02"), [100000, 50000, 0], "001 Şubat");
    await h.sell("001", "2026-03-10", 5000);
    await h.buy("001", "2026-03-11", 1000);
    await h.buy("001", "2026-03-12", 500);
    assert.deepEqual(await h.offset("001", "2026-03"), [0, 70000, 0], "001 Mart");
    await h.sell("001", "2026-04-10", 2500);
    await h.buy("001", "2026-02-20", 1500);
    // 002 — Şubat azalan ay (200'lük alış İptal Et), Mart 'güncel değil' (İ +300), Nisan fişsiz.
    await h.buy("002", "2026-01-10", 5000);
    assert.deepEqual(await h.offset("002", "2026-01"), [0, 0, 100000], "002 Ocak");
    await h.sell("002", "2026-02-10", 10000);
    const febBuy = await h.buy("002", "2026-02-11", 1000);
    await h.buy("002", "2026-02-12", 1500);
    assert.deepEqual(await h.offset("002", "2026-02"), [100000, 50000, 0], "002 Şubat");
    await h.sell("002", "2026-03-10", 5000);
    await h.buy("002", "2026-03-11", 1000);
    assert.deepEqual(await h.offset("002", "2026-03"), [0, 80000, 0], "002 Mart");
    await h.sell("002", "2026-04-10", 2500);
    await h.cancel("002", febBuy);
    await h.buy("002", "2026-03-20", 1500);
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 yalnız İ artışı: Nisan 500, Ocak–Nisan 1.400 = 391 3.500 − 191 2.100 (artış bir kez)", async () => {
    const all = await h.report("001", { from: "2026-01-01", to: "2026-04-30" }, "001 Ocak–Nisan");
    assert.deepEqual([all.h391, all.h191], [350000, 210000], "391 3.500, 191 2.100");
    assert.deepEqual(all.three, [0, 140000, 0], `Ocak–Nisan 1.400 ${JSON.stringify(all.data.summary)}`);
    balanced(all, "001 Ocak–Nisan");
    assert.deepEqual(all.lines.filter(line => line[1] === "Ödenecek KDV").map(line => line[2]), [20000, 70000, 50000], "Şubat 200 (bugün), Mart 700 (fiş), Nisan 500");
    assert.equal(all.summary[CHANGED], `Şubat 2026 ${STALE_TEXT}`, "yalnız Şubat notu");
    assert.deepEqual(await h.preview("001", "2026-04"), [0, 50000, 0], "Nisan ön izlemesi = rapor");
  });

  it("002 azalan ay önce, 'güncel değil' sonra: Mart azalmayı kendisi düşer (700), Nisan 500; Ocak–Nisan 1.700 = 391 3.500 − 191 1.800", async () => {
    const all = await h.report("002", { from: "2026-01-01", to: "2026-04-30" }, "002 Ocak–Nisan");
    assert.deepEqual([all.h391, all.h191], [350000, 180000], "391 3.500, 191 1.800");
    assert.deepEqual(all.three, [0, 170000, 0], `Ocak–Nisan 1.700 ${JSON.stringify(all.data.summary)}`);
    balanced(all, "002 Ocak–Nisan");
    assert.deepEqual(all.lines.filter(line => line[1] === "Ödenecek KDV").map(line => line[2]), [50000, 70000, 50000], "Şubat 500 (fiş), Mart 1.000 − 500 + 200 = 700 (bugün), Nisan 500");
    assert.equal(all.summary[CHANGED], `Mart 2026 ${STALE_TEXT}; Şubat 2026 ${REDUCED_TEXT}`, "notlar");
    assert.deepEqual(await h.preview("002", "2026-04"), [0, 50000, 0], "Nisan ön izlemesi = rapor");
  });
});
