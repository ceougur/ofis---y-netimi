// 2.5.1 M1 küçük tur 6 — KDV Özeti notları (YALNIZ METİN; sayılar DEĞİŞMEZ): KDV tur 5 dar kontrolünün ORTA-1'i, BAŞ MİMAR KARARI 28.11 07:40 UTC (1)(a)–(c) (kullanıcıya
//   gösterilecek, değiştirebilir). (a) 'Zincirle Uyuşmayan Mahsup Fişi' notunun YÖNÜ ayrılır: zincirin S4 emilimi fişinkinden EKSİYSE (önceki 'güncel değil' ay) neden cümlesi
//   'fiş İndirilecek KDV'deki azalmayı düşmemiş', onarım 'mahsup fişi güncel olmayan ilk aydan (ör. Şubat 2026) başlayarak mahsupları geri alın, ayları sırayla yeniden mahsup
//   edin' — ve notun söylediği adımlar uygulanınca not KALKAR, rapor = fişler = 391 − 191; öbür yönün metni AYNEN (test/kdv-ozeti-mahsup-sonrasi-251.test.mjs dar kontrol L).
//   (b) tek ay / kısmi aralıkta aralığın sayısını aralık DIŞINDAKİ 'güncel değil' fiş etkiliyorsa kısa not ('Önceki aylarda güncel olmayan mahsup fişi var (Şubat 2026); bu ayın
//   sayıları mahsup ön izlemesinden ayrılır'); etkilemiyorsa not YOK.
//   Taban (t251-m1k6-taban): uyuşmazlık notu 'İndirilecek KDV'deki azalma sırayla mahsupta daha önceki bir ayda düşülür' + 'bu ayın ve sonraki mahsupları geri alıp …' (ters neden,
//   sonuç vermeyen onarım); kısa not hiç yok.
//   Örnek (S-DKM1K-1 = A'nın örneği AYNEN): Ocak alış KDV 1.000 fiş 0 / 0 / 1.000; Şubat satış 2.000 alış 500 fiş 1.000 / 500 / 0; Mart satış 1.000 alış 200 + 100 fiş 0 / 700 / 0;
//   Nisan satış 500; fişlerden sonra Şubat'a alış KDV +300, Mart'ın 200'lük alışı İptal Et → Nisan 700 (ön izleme 500), Ocak–Nisan 1.600 = 391 3.500 − 191 1.900.
// KÂHİN ELLE (karar metni + elle hesap; programın kodundan türetilmedi — ders 5). Veri programın API'sinden; sahte saat (ders 13); KDV %20. Sayılar yanıt gövdesinden ve veri
// tabanından (mahsup fişi listesi, mizan) okunur (ders 3). Yardımcılar test/kdv-ozeti-s4-guncel-degil-251.test.mjs kalıbında.
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
const PRIOR = "Güncel Olmayan Önceki Fiş";
/** (a) eksi yönlü uyuşmazlığın tam cümlesi. */
const shortNote = (label, fis, chain, restart) =>
  `${label} fişi ödenecek KDV ${fis} yazmış, sırayla mahsupta ödenecek KDV ${chain} olmalıydı — fiş İndirilecek KDV'deki azalmayı düşmemiş (raporda sırayla mahsup sayıları; mahsup fişi güncel olmayan ilk aydan (${restart}) başlayarak mahsupları geri alın, ayları sırayla yeniden mahsup edin)`;
/** (b) kısa not. */
const priorNote = (months, unit) => `Önceki aylarda güncel olmayan mahsup fişi var (${months}); bu ${unit} sayıları mahsup ön izlemesinden ayrılır`;
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
      assert.equal(Object.keys(summary).length, data.summary.length, `${label}: özet başlıkları tekil`);
      const g = data.headers.indexOf("Belge Türü");
      const k = data.headers.indexOf("KDV");
      const three = RESULT_LABELS.map(name => minor(summary[name]));
      const foot = (data.footers || []).filter(line => RESULT_LABELS.includes(line[g])).map(line => minor(line[k]));
      if (data.rows.length) assert.deepEqual(foot, three, `${label}: tablo altı = özet`);
      const lines = data.rows.filter(row => !DOC_KINDS.includes(row[g])).map(row => [row[0], row[g], minor(row[k])]);
      return { data, summary, three, lines, h391: minor(summary["Hesaplanan KDV (391) (İadeler Düşülmüş)"]), h191: minor(summary["İndirilecek KDV (191) (İadeler Düşülmüş)"]) };
    },
    /** Ekran = PDF = Excel: tablo, tablo altı ve özet; not satırlarının METNİ Excel'de birebir, PDF'te sözcük sözcük (satır kayması boşluğu bozmasın). */
    sameFiles: async (tag, query, label) => {
      const { data } = await h.report(tag, query, label);
      const pdf = await api.raw("GET", amp(`${RC}/kdv-ozeti/pdf?${qs(query)}`, qOf(tag)));
      assert.equal(pdf.status, 200, `${label} PDF`);
      const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
      const flat = text.replace(/\s+/g, "");
      for (const row of [...data.rows, ...data.footers]) for (const cell of row) if (String(cell).trim()) assert.ok(text.includes(String(cell).trim()), `${label} PDF hücresi: "${cell}"`);
      for (const [name, value] of data.summary) {
        if (minor(value) !== null) assert.ok(text.includes(String(value).trim()), `${label} PDF özet ${name}: "${value}"`);
        else {
          // PDF'in özet kartı uzun metni kart genişliğinde "…" ile kısaltır (tabanda da, bütün notlarda — rapordaki SONRAKİ SÜRÜME maddesi): PDF'te not başlığı aranır, tam metin Excel'de.
          assert.ok(flat.includes(name.replace(/\s+/g, "")), `${label} PDF not başlığı ${name}`);
        }
      }
      const xlsx = await api.raw("GET", amp(`${RC}/kdv-ozeti/xlsx?${qs(query)}`, qOf(tag)));
      assert.equal(xlsx.status, 200, `${label} Excel`);
      const sheets = Object.values(xlsxSheets(xlsx.buffer));
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
const json = r => JSON.stringify(r.data.summary);

/** S-DKM1K-1 = A'nın örneği AYNEN (Nisan fişi isteğe bağlı olarak değişikliklerden ÖNCE kesilir). */
async function example(h, tag, { aprilFirst = false } = {}) {
  await h.buy(tag, "2026-01-10", 5000);
  assert.deepEqual(await h.offset(tag, "2026-01"), [0, 0, 100000], `${tag} Ocak fişi 0 / 0 / 1.000`);
  await h.sell(tag, "2026-02-10", 10000);
  await h.buy(tag, "2026-02-11", 2500);
  assert.deepEqual(await h.offset(tag, "2026-02"), [100000, 50000, 0], `${tag} Şubat fişi 1.000 / 500 / 0`);
  await h.sell(tag, "2026-03-10", 5000);
  const mar = await h.buy(tag, "2026-03-11", 1000);
  await h.buy(tag, "2026-03-12", 500);
  assert.deepEqual(await h.offset(tag, "2026-03"), [0, 70000, 0], `${tag} Mart fişi 0 / 700 / 0`);
  await h.sell(tag, "2026-04-10", 2500);
  if (aprilFirst) assert.deepEqual(await h.offset(tag, "2026-04"), [0, 50000, 0], `${tag} Nisan fişi değişikliklerden ÖNCE sırayla 0 / 500 / 0`);
  await h.buy(tag, "2026-02-20", 1500);
  await h.cancel(tag, mar);
}

/** Notun söylediği onarım: güncel olmayan ilk aydan (Şubat) başlayarak geri al (en yeniden), ayları sırayla yeniden mahsup et. */
async function repairFromFebruary(h, tag, last = "2026-04") {
  const months = ["2026-02", "2026-03", "2026-04"].filter(month => month <= last);
  for (const month of [...months].reverse()) await h.reverse(tag, month);
  const fis = [];
  for (const month of months) fis.push(await h.offset(tag, month));
  return fis;
}

describe("2.5.1 M1 küçük tur 6 — (a) uyuşmazlığın yönü + onarım, (b) aralık dışındaki 'güncel değil' fiş için kısa not: kararın örneği (A) ve 'Nisan fişi önce' (B)", () => {
  let h;
  before(async () => {
    h = await program("2026-06-15T12:00:00+03:00", "U6");
    await example(h, "001");
    // 002 — B: Nisan fişi değişikliklerden ÖNCE sırayla ve doğru kesilmiş; Mayıs satış 500 fişsiz.
    await example(h, "002", { aprilFirst: true });
    await h.sell("002", "2026-05-10", 2500);
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 (b) Nisan fişsiz: Nisan tek ay 700 + kısa not (Şubat 2026); Mart–Nisan 'bu aralığın'; Şubat'ı içeren aralıkta, Mart tek ayda ve Tüm Zamanlar'da kısa not YOK; ekran = PDF = Excel", async () => {
    const apr = await h.report("001", monthRange("2026-04"), "001 Nisan");
    assert.deepEqual(apr.three, [0, 70000, 0], `Nisan 700 (sayı DEĞİŞMEDİ) ${json(apr)}`);
    assert.deepEqual([apr.h391, apr.h191], [50000, 0], "Nisan 391 500, 191 0");
    assert.equal(apr.summary[PRIOR], priorNote("Şubat 2026", "ayın"), `Nisan tek ay kısa not ${json(apr)}`);
    assert.ok(!(MISMATCH in apr.summary) && !(PENDING in apr.summary), `Nisan: uyuşmazlık / mahsupsuz notu yok ${json(apr)}`);
    assert.deepEqual(await h.preview("001", "2026-04"), [0, 50000, 0], "Nisan ön izlemesi 500 (DEĞİŞMEDİ) — kısa notun söylediği ayrılık");
    const span = await h.report("001", { from: "2026-03-01", to: "2026-04-30" }, "001 Mart–Nisan");
    assert.deepEqual(span.three, [0, 140000, 0], "Mart–Nisan 700 + 700");
    assert.equal(span.summary[PRIOR], priorNote("Şubat 2026", "aralığın"), `Mart–Nisan kısa not ${json(span)}`);
    const mar = await h.report("001", monthRange("2026-03"), "001 Mart");
    assert.deepEqual(mar.three, [0, 70000, 0], "Mart fişten 700");
    assert.ok(!(PRIOR in mar.summary), `Mart tek ay: sayısı fişten — Şubat etkilemiyor, kısa not YOK ${json(mar)}`);
    for (const query of [{ from: "2026-02-01", to: "2026-04-30" }, { from: "2026-01-01", to: "2026-04-30" }, { preset: "all" }, monthRange("2026-02"), monthRange("2026-01")]) {
      const r = await h.report("001", query, `001 ${qs(query)}`);
      assert.ok(!(PRIOR in r.summary), `${qs(query)}: 'güncel değil' ay aralıkta ya da aralıktan sonra — kısa not YOK ${json(r)}`);
    }
    const all = await h.report("001", { from: "2026-01-01", to: "2026-04-30" }, "001 Ocak–Nisan");
    assert.deepEqual(all.three, [0, 160000, 0], "Ocak–Nisan 1.600 (DEĞİŞMEDİ)");
    balanced(all, "001 Ocak–Nisan");
    await h.sameFiles("001", monthRange("2026-04"), "001 Nisan");
    await h.sameFiles("001", { from: "2026-03-01", to: "2026-04-30" }, "001 Mart–Nisan");
  });

  it("001 (a) Nisan ön izlemeyle (500) mahsup edilir: uyuşmazlık notu eksi yönde — 'azalmayı düşmemiş' + Şubat'tan onarım; yalnız Nisan'ı geri alıp yeniden kesmek notu kaldırmaz; notun adımlarıyla not kalkar, rapor = fişler = 391 − 191", async () => {
    assert.deepEqual(await h.offset("001", "2026-04"), [0, 50000, 0], "Nisan fişi ön izlemeyle 500");
    const want = shortNote("Nisan 2026", "500,00 TL", "700,00 TL", "Şubat 2026");
    const apr = await h.report("001", monthRange("2026-04"), "001 Nisan (fişli)");
    assert.deepEqual(apr.three, [0, 70000, 0], "Nisan raporu sırayla mahsup sayısı 700 (DEĞİŞMEDİ)");
    assert.equal(apr.summary[MISMATCH], want, `Nisan uyuşmazlık notu (tam cümle) ${json(apr)}`);
    assert.equal(apr.summary[PRIOR], priorNote("Şubat 2026", "ayın"), "Nisan tek ay kısa not da durur (sayısı Şubat'tan etkilenir)");
    for (const query of [{ from: "2026-01-01", to: "2026-04-30" }, { from: "2026-03-01", to: "2026-04-30" }, { preset: "all" }]) {
      const r = await h.report("001", query, `001 ${qs(query)} (Nisan fişli)`);
      assert.equal(r.summary[MISMATCH], want, `${qs(query)}: aynı not`);
    }
    const all = await h.report("001", { from: "2026-01-01", to: "2026-04-30" }, "001 Ocak–Nisan (Nisan fişli)");
    assert.deepEqual(all.three, [0, 160000, 0], "Ocak–Nisan 1.600 (DEĞİŞMEDİ)");
    balanced(all, "001 Ocak–Nisan (Nisan fişli)");
    await h.sameFiles("001", monthRange("2026-04"), "001 Nisan (fişli)");
    // Tabanın önerdiği onarım (yalnız bu ay): Nisan geri al + ön izlemeyle yeniden → fiş yine 500, not AYNEN kalır (onarım bu ay değil — not artık bunu söylemiyor).
    await h.reverse("001", "2026-04");
    assert.deepEqual(await h.offset("001", "2026-04"), [0, 50000, 0], "Nisan yeniden 500");
    assert.equal((await h.report("001", monthRange("2026-04"), "001 Nisan (yalnız Nisan yeniden)")).summary[MISMATCH], want, "yalnız Nisan'ı yeniden kesmek sonuç vermez");
    // Notun söylediği onarım: Şubat'tan başlayarak geri al, sırayla yeniden mahsup → Şubat 200, Mart 900, Nisan 500 = 1.600; notlar kalkar; defter = rapor.
    assert.deepEqual(await repairFromFebruary(h, "001"), [[100000, 20000, 0], [0, 90000, 0], [0, 50000, 0]], "yeniden fişler Şubat 200 / Mart 900 / Nisan 500");
    const fixed = await h.report("001", { from: "2026-01-01", to: "2026-04-30" }, "001 onarım");
    assert.deepEqual(fixed.three, [0, 160000, 0], "onarımdan sonra 1.600");
    balanced(fixed, "001 onarım");
    assert.deepEqual(fixed.lines.filter(line => line[1] === "Ödenecek KDV").map(line => line[2]), [20000, 90000, 50000], "rapor = fişler");
    for (const query of [{ from: "2026-01-01", to: "2026-04-30" }, monthRange("2026-04"), { from: "2026-03-01", to: "2026-04-30" }]) {
      const r = await h.report("001", query, `001 ${qs(query)} (onarım)`);
      assert.ok(!(MISMATCH in r.summary) && !(CHANGED in r.summary) && !(PRIOR in r.summary), `${qs(query)}: notlar kalkar ${json(r)}`);
    }
    assert.deepEqual((await h.offsets("001")).map(row => row[4]), [false, false, false, false], "hiçbir fiş 'güncel değil' değil");
    const tb = await trialBalances(h.api, "?to=2026-04-30");
    assert.equal(Math.abs(Math.round((tb["360"] ?? 0) * 100)), 160000, "defterde 360 = 1.600 = rapor = 391 − 191");
    await integrityOk(h.api, "001 onarım");
  });

  it("002 B — Nisan fişi değişikliklerden ÖNCE sırayla kesilmiş: aynı eksi yönlü not (Şubat); Mayıs tek ayda kısa not YOK (araya Nisan fişi girer); notun adımlarıyla not kalkar, Ocak–Mayıs 2.100", async () => {
    const all = await h.report("002", { from: "2026-01-01", to: "2026-05-31" }, "002 Ocak–Mayıs");
    assert.deepEqual(all.three, [0, 210000, 0], `Ocak–Mayıs 2.100 (DEĞİŞMEDİ) ${json(all)}`);
    assert.deepEqual([all.h391, all.h191], [400000, 190000], "391 4.000, 191 1.900");
    balanced(all, "002 Ocak–Mayıs");
    assert.equal(all.summary[MISMATCH], shortNote("Nisan 2026", "500,00 TL", "700,00 TL", "Şubat 2026"), `B uyuşmazlık notu ${json(all)}`);
    const may = await h.report("002", monthRange("2026-05"), "002 Mayıs");
    assert.deepEqual(may.three, [0, 50000, 0], "Mayıs 500");
    assert.deepEqual(await h.preview("002", "2026-05"), [0, 50000, 0], "Mayıs ön izlemesi 500 = rapor");
    assert.ok(!(PRIOR in may.summary), `Mayıs tek ay: Şubat sayıyı etkilemiyor — kısa not YOK ${json(may)}`);
    assert.deepEqual(await repairFromFebruary(h, "002"), [[100000, 20000, 0], [0, 90000, 0], [0, 50000, 0]], "yeniden fişler");
    const fixed = await h.report("002", { from: "2026-01-01", to: "2026-05-31" }, "002 onarım");
    assert.deepEqual(fixed.three, [0, 210000, 0], "onarımdan sonra 2.100");
    assert.deepEqual(fixed.lines.filter(line => line[1] === "Ödenecek KDV").map(line => line[2]), [20000, 90000, 50000, 50000], "rapor = fişler (+ Mayıs 500)");
    assert.ok(!(MISMATCH in fixed.summary) && !(CHANGED in fixed.summary) && !(PRIOR in fixed.summary), `notlar kalkar ${json(fixed)}`);
    await integrityOk(h.api, "002 onarım");
  });
});

describe("2.5.1 M1 küçük tur 6 — iki ardışık 'güncel değil' ay (onarım İLK aydan) ve yıl dönümü (Aralık 2026 → Bu Yıl 2027)", () => {
  let h;
  before(async () => {
    h = await program("2027-03-15T12:00:00+03:00", "U6B");
    // 001 — Şubat ve Mart 'güncel değil' (İ +300, +100; ödenecek yönde), Nisan azalan ay (200'lük alış İptal Et), Mayıs satış 500.
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
    // 002 — yıl dönümü: Kasım 2026 fiş devreden 1.000, Aralık 2026 'güncel değil' (alış KDV +300), Ocak 2027 azalan ay, Şubat 2027 satış 500.
    await h.buy("002", "2026-11-10", 5000);
    assert.deepEqual(await h.offset("002", "2026-11"), [0, 0, 100000], "002 Kasım");
    await h.sell("002", "2026-12-10", 10000);
    await h.buy("002", "2026-12-11", 2500);
    assert.deepEqual(await h.offset("002", "2026-12"), [100000, 50000, 0], "002 Aralık");
    await h.sell("002", "2027-01-10", 5000);
    const janBuy = await h.buy("002", "2027-01-11", 1000);
    await h.buy("002", "2027-01-12", 500);
    assert.deepEqual(await h.offset("002", "2027-01"), [0, 70000, 0], "002 Ocak 2027");
    await h.sell("002", "2027-02-10", 2500);
    await h.buy("002", "2026-12-20", 1500);
    await h.cancel("002", janBuy);
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 iki 'güncel değil' ay: Mayıs tek ay kısa not (Şubat 2026, Mart 2026); Mayıs fişi ön izlemeyle → not İLK aydan (Şubat 2026); notun adımlarıyla kalkar, Ocak–Mayıs 2.300", async () => {
    const may = await h.report("001", monthRange("2026-05"), "001 Mayıs");
    assert.deepEqual(may.three, [0, 70000, 0], "Mayıs 700 (DEĞİŞMEDİ)");
    assert.equal(may.summary[PRIOR], priorNote("Şubat 2026, Mart 2026", "ayın"), `Mayıs kısa not ${json(may)}`);
    const aprMay = await h.report("001", { from: "2026-04-01", to: "2026-05-31" }, "001 Nisan–Mayıs");
    assert.equal(aprMay.summary[PRIOR], priorNote("Şubat 2026, Mart 2026", "aralığın"), "Nisan–Mayıs kısa not");
    assert.ok(!(PRIOR in (await h.report("001", monthRange("2026-04"), "001 Nisan")).summary), "Nisan tek ay (fişten) kısa not YOK");
    assert.deepEqual(await h.offset("001", "2026-05"), [0, 50000, 0], "Mayıs fişi ön izlemeyle 500");
    const all = await h.report("001", { from: "2026-01-01", to: "2026-05-31" }, "001 Ocak–Mayıs (Mayıs fişli)");
    assert.deepEqual(all.three, [0, 230000, 0], "Ocak–Mayıs 2.300 (DEĞİŞMEDİ)");
    balanced(all, "001 Ocak–Mayıs");
    assert.equal(all.summary[MISMATCH], shortNote("Mayıs 2026", "500,00 TL", "700,00 TL", "Şubat 2026"), `onarım İLK 'güncel değil' aydan ${json(all)}`);
    for (const month of ["2026-05", "2026-04", "2026-03", "2026-02"]) await h.reverse("001", month);
    const fis = [];
    for (const month of ["2026-02", "2026-03", "2026-04", "2026-05"]) fis.push(await h.offset("001", month));
    assert.deepEqual(fis, [[100000, 20000, 0], [0, 70000, 0], [0, 90000, 0], [0, 50000, 0]], "yeniden fişler Şubat 200 / Mart 700 / Nisan 900 / Mayıs 500");
    const fixed = await h.report("001", { from: "2026-01-01", to: "2026-05-31" }, "001 onarım");
    assert.deepEqual(fixed.three, [0, 230000, 0], "onarımdan sonra 2.300");
    assert.deepEqual(fixed.lines.filter(line => line[1] === "Ödenecek KDV").map(line => line[2]), [20000, 70000, 90000, 50000], "rapor = fişler");
    assert.ok(!(MISMATCH in fixed.summary) && !(CHANGED in fixed.summary) && !(PRIOR in fixed.summary), `notlar kalkar ${json(fixed)}`);
  });

  it("002 yıl dönümü: Bu Yıl (2027) kısa not (Aralık 2026); 2026 yılında YOK; Şubat 2027 fişi ön izlemeyle → onarım Aralık 2026'dan; notun adımlarıyla kalkar", async () => {
    const year = await h.report("002", { preset: "thisYear" }, "002 Bu Yıl");
    assert.deepEqual(year.three, [0, 140000, 0], "Bu Yıl 1.400 (DEĞİŞMEDİ)");
    assert.equal(year.summary[PRIOR], priorNote("Aralık 2026", "aralığın"), `Bu Yıl kısa not ${json(year)}`);
    const feb = await h.report("002", monthRange("2027-02"), "002 Şubat 2027");
    assert.deepEqual(feb.three, [0, 70000, 0], "Şubat 2027 700");
    assert.equal(feb.summary[PRIOR], priorNote("Aralık 2026", "ayın"), "Şubat 2027 kısa not");
    const last = await h.report("002", { from: "2026-01-01", to: "2026-12-31" }, "002 2026");
    assert.ok(!(PRIOR in last.summary), `2026 yılı: 'güncel değil' ay aralıkta — kısa not YOK ${json(last)}`);
    await h.sameFiles("002", { preset: "thisYear" }, "002 Bu Yıl");
    assert.deepEqual(await h.offset("002", "2027-02"), [0, 50000, 0], "Şubat 2027 fişi ön izlemeyle 500");
    const year2 = await h.report("002", { preset: "thisYear" }, "002 Bu Yıl (Şubat fişli)");
    assert.deepEqual(year2.three, [0, 140000, 0], "Bu Yıl yine 1.400");
    assert.equal(year2.summary[MISMATCH], shortNote("Şubat 2027", "500,00 TL", "700,00 TL", "Aralık 2026"), `yıl dönümü onarımı Aralık 2026'dan ${json(year2)}`);
    for (const month of ["2027-02", "2027-01", "2026-12"]) await h.reverse("002", month);
    const fis = [];
    for (const month of ["2026-12", "2027-01", "2027-02"]) fis.push(await h.offset("002", month));
    assert.deepEqual(fis, [[100000, 20000, 0], [0, 90000, 0], [0, 50000, 0]], "yeniden fişler Aralık 200 / Ocak 900 / Şubat 500");
    const fixed = await h.report("002", { preset: "thisYear" }, "002 Bu Yıl (onarım)");
    assert.deepEqual(fixed.three, [0, 140000, 0], "onarımdan sonra 1.400 = 391 1.500 − 191 100");
    balanced(fixed, "002 Bu Yıl (onarım)");
    assert.ok(!(MISMATCH in fixed.summary) && !(PRIOR in fixed.summary) && !(CHANGED in fixed.summary), `notlar kalkar ${json(fixed)}`);
  });
});

describe("2.5.1 M1 küçük tur 6 — (b) kısa not yalnız ETKİLİYORSA: devreden yönde yalnız satış KDV'si değişen ay (etkiler) / ödenecek yönde yalnız 391 ya da yalnız İ artışı (etkilemez)", () => {
  let h;
  before(async () => {
    h = await program("2026-05-15T12:00:00+03:00", "U6C");
    // 001 — Şubat DEVREDEN yönde kesilmiş (500), sonra Şubat'a satış KDV +200 → bugün devreden 300 (S-M1K2-1 = A); Mart satış 1.000 fişsiz (ön izleme 500 devredenle).
    await h.buy("001", "2026-01-10", 5000);
    assert.deepEqual(await h.offset("001", "2026-01"), [0, 0, 100000], "001 Ocak");
    await h.sell("001", "2026-02-10", 5000);
    await h.buy("001", "2026-02-11", 2500);
    assert.deepEqual(await h.offset("001", "2026-02"), [100000, 0, 50000], "001 Şubat devreden 500");
    await h.sell("001", "2026-02-20", 1000);
    await h.sell("001", "2026-03-10", 5000);
    // 002 — Şubat ÖDENECEK yönde kesilmiş (500), sonra Şubat'a satış KDV +200 ve alış KDV +300 (ikisi de 'güncel değil'); Mart satış 1.000 fişsiz.
    await h.buy("002", "2026-01-10", 5000);
    assert.deepEqual(await h.offset("002", "2026-01"), [0, 0, 100000], "002 Ocak");
    await h.sell("002", "2026-02-10", 10000);
    await h.buy("002", "2026-02-11", 2500);
    assert.deepEqual(await h.offset("002", "2026-02"), [100000, 50000, 0], "002 Şubat");
    await h.sell("002", "2026-02-20", 1000);
    await h.sell("002", "2026-03-10", 5000);
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 devreden yönde 'güncel değil' Şubat: Mart tek ay Önceki 300 · Ödenecek 700 (ön izleme 500 devredenle 500) → kısa not (Şubat 2026)", async () => {
    assert.deepEqual((await h.offsets("001")).map(row => row[4]), [false, true], "Şubat 'güncel değil' (veri tabanı)");
    const mar = await h.report("001", monthRange("2026-03"), "001 Mart");
    assert.deepEqual(mar.three, [30000, 70000, 0], `Mart 300 / 700 / 0 (DEĞİŞMEDİ) ${json(mar)}`);
    assert.deepEqual(await h.preview("001", "2026-03"), [50000, 50000, 0], "Mart ön izlemesi 500 devredenle 500");
    assert.equal(mar.summary[PRIOR], priorNote("Şubat 2026", "ayın"), `Mart kısa not ${json(mar)}`);
    const all = await h.report("001", { from: "2026-01-01", to: "2026-03-31" }, "001 Ocak–Mart");
    assert.deepEqual(all.three, [0, 70000, 0], "Ocak–Mart 700 = 391 2.200 − 191 1.500");
    balanced(all, "001 Ocak–Mart");
    assert.ok(!(PRIOR in all.summary), "Ocak–Mart: Şubat aralıkta — kısa not YOK");
    await h.sameFiles("001", monthRange("2026-03"), "001 Mart");
  });

  it("002 ödenecek yönde 'güncel değil' Şubat (yalnız 391, sonra İ artışı da): Mart tek ay 1.000 = ön izleme → kısa not YOK", async () => {
    assert.deepEqual((await h.offsets("002")).map(row => row[4]), [false, true], "Şubat 'güncel değil' (veri tabanı)");
    const mar = await h.report("002", monthRange("2026-03"), "002 Mart");
    assert.deepEqual(mar.three, [0, 100000, 0], "Mart 1.000");
    assert.deepEqual(await h.preview("002", "2026-03"), [0, 100000, 0], "Mart ön izlemesi = rapor");
    assert.ok(!(PRIOR in mar.summary), `yalnız 391: Mart'ı etkilemiyor — kısa not YOK ${json(mar)}`);
    await h.buy("002", "2026-02-25", 1500);
    const mar2 = await h.report("002", monthRange("2026-03"), "002 Mart (İ artışı)");
    assert.deepEqual(mar2.three, [0, 100000, 0], "Mart yine 1.000");
    assert.deepEqual(await h.preview("002", "2026-03"), [0, 100000, 0], "Mart ön izlemesi = rapor");
    assert.ok(!(PRIOR in mar2.summary), `İ artışı (azalma yok): Mart'ı etkilemiyor — kısa not YOK ${json(mar2)}`);
    assert.ok(!(PRIOR in (await h.report("002", { preset: "all" }, "002 Tüm Zamanlar")).summary), "Tüm Zamanlar: kısa not YOK");
  });
});
