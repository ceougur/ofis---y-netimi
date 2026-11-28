// 2.5.1 M1 küçük tur 7 — KDV Özeti 'Zincirle Uyuşmayan Mahsup Fişi' notunun DEVREDEN FARKI kolunun onarım cümlesi (YALNIZ METİN; sayılar DEĞİŞMEZ). Kaynak: KDV Özeti küçük tur 6
//   raporunun BAŞ MİMAR KARARI 28.11 08:49 UTC (1) (kullanıcıya gösterilecek, değiştirebilir): önceki ay devreden yönde 'güncel değil'ken sonraki ayın fişi eski devredenle kesilmişse
//   notun onarımı ('bu ayın ve sonraki mahsupları geri alıp …') sonuç vermiyordu — yalnız bu ay ve sonrası yeniden kesilince ön izleme yine defterdeki eski devredeni okur, not kalır.
//   Karar: tur 6'nın eksi yön düzeni bu kola da — önceki aylarda mahsup fişi güncel olmayan ay varsa cümle 'mahsup fişi güncel olmayan ilk aydan (ay adıyla, yıl dönümünde yılıyla)
//   başlayarak mahsupları geri alın, ayları sırayla yeniden mahsup edin'; yoksa bugünkü cümle AYNEN. Neden cümlesi ('… devredenle kesilmiş, sırayla mahsupta … olmalıydı') değişmez.
//   Taban (t251-m1k6): devreden farkında her zaman 'bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin'.
// KÂHİN ELLE (karar metni + elle hesap; programın kodundan türetilmedi — ders 5). Veri programın API'sinden; sahte saat (ders 13); KDV %20. Sayılar yanıt gövdesinden ve veri
// tabanından (mahsup fişi listesi, mizan) okunur (ders 3). Yardımcılar test/kdv-ozeti-uyusmazlik-yonu-251.test.mjs kalıbında.
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
const OLD_TAIL = " (raporda sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)";
const newTail = restart => ` (raporda sırayla mahsup sayıları; mahsup fişi güncel olmayan ilk aydan (${restart}) başlayarak mahsupları geri alın, ayları sırayla yeniden mahsup edin)`;
/** Devreden farkı kolunun neden cümlesi (DEĞİŞMEZ) + onarım (restart yoksa bugünkü cümle AYNEN). */
const carryNote = (label, used, chain, restart) => `${label} fişi ${used} devredenle kesilmiş, sırayla mahsupta ${chain} olmalıydı${restart ? newTail(restart) : OLD_TAIL}`;
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
    /** Ekran = PDF = Excel: tablo, tablo altı ve özet; not satırlarının METNİ Excel'de birebir, PDF'te not başlığı (PDF'in özet kartı uzun metni kısaltır — tur 6 SONRAKİ SÜRÜME). */
    sameFiles: async (tag, query, label) => {
      const { data } = await h.report(tag, query, label);
      const pdf = await api.raw("GET", amp(`${RC}/kdv-ozeti/pdf?${qs(query)}`, qOf(tag)));
      assert.equal(pdf.status, 200, `${label} PDF`);
      const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
      const flat = text.replace(/\s+/g, "");
      for (const row of [...data.rows, ...data.footers]) for (const cell of row) if (String(cell).trim()) assert.ok(text.includes(String(cell).trim()), `${label} PDF hücresi: "${cell}"`);
      for (const [name, value] of data.summary) {
        if (minor(value) !== null) assert.ok(text.includes(String(value).trim()), `${label} PDF özet ${name}: "${value}"`);
        else assert.ok(flat.includes(name.replace(/\s+/g, "")), `${label} PDF not başlığı ${name}`);
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
/** Geri al (en yeniden), sonra sırayla yeniden mahsup; yeni fişler [önceki, ödenecek, sonraki]. */
async function redo(h, tag, months) {
  for (const month of [...months].reverse()) await h.reverse(tag, month);
  const fis = [];
  for (const month of months) fis.push(await h.offset(tag, month));
  return fis;
}

describe("2.5.1 M1 küçük tur 7 — devreden farkı kolu: önceki 'güncel değil' Şubat (devreden yönde) + eski devredenle kesilmiş Mart (tur 6 s5 vakası AYNEN) / önceki güncel olmayan fiş YOK (cümle AYNEN) + zincirleme uyuşmazlık", () => {
  let h;
  before(async () => {
    h = await program("2026-07-15T12:00:00+03:00", "D7");
    // 001 — tur 6 s5 vakası AYNEN: Ocak alış KDV 1.000 (fiş 0 / 0 / 1.000); Şubat satış 1.000 alış 500 (fiş 1.000 / 0 / 500); Mart satış 2.000 alış 200 (fiş 500 / 1.300 / 0);
    // Nisan satış 1.000 alış 200 + 100 (fiş 0 / 700 / 0); Mayıs satış 500 fişsiz; fişlerden SONRA Şubat'a alış KDV +300 ve Nisan'ın 200'lük alışı İptal Et.
    await h.buy("001", "2026-01-10", 5000);
    assert.deepEqual(await h.offset("001", "2026-01"), [0, 0, 100000], "001 Ocak fişi 0 / 0 / 1.000");
    await h.sell("001", "2026-02-10", 5000);
    await h.buy("001", "2026-02-11", 2500);
    assert.deepEqual(await h.offset("001", "2026-02"), [100000, 0, 50000], "001 Şubat fişi 1.000 / 0 / 500");
    await h.sell("001", "2026-03-10", 10000);
    await h.buy("001", "2026-03-11", 1000);
    assert.deepEqual(await h.offset("001", "2026-03"), [50000, 130000, 0], "001 Mart fişi 500 / 1.300 / 0 (değişiklikten ÖNCE, sırayla doğru)");
    await h.sell("001", "2026-04-10", 5000);
    const apr = await h.buy("001", "2026-04-11", 1000);
    await h.buy("001", "2026-04-12", 500);
    assert.deepEqual(await h.offset("001", "2026-04"), [0, 70000, 0], "001 Nisan fişi 0 / 700 / 0");
    await h.sell("001", "2026-05-10", 2500);
    await h.buy("001", "2026-02-20", 1500);
    await h.cancel("001", apr);
    // 002 — önceki güncel olmayan fiş YOK: Ocak alış KDV 1.000 (fiş 0 / 0 / 1.000); Şubat satış 400 MAHSUPSUZ; Mart satış 200, Mart fişi defterin 1.000'iyle (ön izleme) → 1.000 / 0 / 800.
    await h.buy("002", "2026-01-10", 5000);
    assert.deepEqual(await h.offset("002", "2026-01"), [0, 0, 100000], "002 Ocak fişi 0 / 0 / 1.000");
    await h.sell("002", "2026-02-10", 2000);
    await h.sell("002", "2026-03-10", 1000);
    assert.deepEqual(await h.offset("002", "2026-03"), [100000, 0, 80000], "002 Mart fişi defterin 1.000'iyle 1.000 / 0 / 800 (Şubat atlandı)");
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 D0: Ocak–Mayıs 2.400 = 391 4.500 − 191 2.100 (DEĞİŞMEDİ); Mart notu onarımı Şubat'tan söyler (Ocak–Mayıs, Mart tek ay, Nisan tek ay); ekran = PDF = Excel", async () => {
    const all = await h.report("001", { from: "2026-01-01", to: "2026-05-31" }, "001 Ocak–Mayıs");
    assert.deepEqual(all.three, [0, 240000, 0], `Ocak–Mayıs 2.400 (DEĞİŞMEDİ) ${json(all)}`);
    assert.deepEqual([all.h391, all.h191], [450000, 210000], "391 4.500, 191 2.100");
    balanced(all, "001 Ocak–Mayıs");
    const want = carryNote("Mart 2026", "500,00 TL", "800,00 TL", "Şubat 2026");
    assert.equal(all.summary[MISMATCH], want, `Mart uyuşmazlık notu (tam cümle) ${json(all)}`);
    assert.match(all.summary[CHANGED] || "", /^Şubat 2026 \(mahsup fişi güncel değil/, "Şubat 'güncel değil' notu durur");
    for (const query of [monthRange("2026-03"), monthRange("2026-04"), { from: "2026-03-01", to: "2026-05-31" }, { preset: "all" }]) {
      const r = await h.report("001", query, `001 ${qs(query)}`);
      assert.equal(r.summary[MISMATCH], want, `${qs(query)}: aynı not (onarım ayı aralık dışında da adıyla) ${json(r)}`);
    }
    const mar = await h.report("001", monthRange("2026-03"), "001 Mart");
    assert.deepEqual(mar.three, [80000, 100000, 0], "Mart sırayla mahsup 800 devredenle 1.000 (DEĞİŞMEDİ)");
    await h.sameFiles("001", { from: "2026-01-01", to: "2026-05-31" }, "001 Ocak–Mayıs");
    await h.sameFiles("001", monthRange("2026-03"), "001 Mart");
  });

  it("001 tabanın önerdiği onarım (yalnız Mart ve sonrası) notu kaldırmaz; notun YENİ cümlesinin adımları (Şubat'tan) kaldırır: fişler Şubat 1.000 / 0 / 800, Mart 800 / 1.000 / 0, Nisan 0 / 900 / 0; Ocak–Mayıs 2.400 = 391 − 191", async () => {
    assert.deepEqual(await redo(h, "001", ["2026-03", "2026-04"]), [[50000, 130000, 0], [0, 90000, 0]], "yalnız Mart ve Nisan yeniden: Mart yine defterdeki 500'le");
    const d1 = await h.report("001", { from: "2026-01-01", to: "2026-05-31" }, "001 D1");
    assert.equal(d1.summary[MISMATCH], carryNote("Mart 2026", "500,00 TL", "800,00 TL", "Şubat 2026"), `D1: not kalır, yine Şubat'ı söyler ${json(d1)}`);
    assert.deepEqual(await redo(h, "001", ["2026-02", "2026-03", "2026-04"]), [[100000, 0, 80000], [80000, 100000, 0], [0, 90000, 0]], "notun adımları: Şubat'tan geri al + sırayla");
    const fixed = await h.report("001", { from: "2026-01-01", to: "2026-05-31" }, "001 onarım");
    assert.deepEqual(fixed.three, [0, 240000, 0], "onarımdan sonra 2.400");
    balanced(fixed, "001 onarım");
    assert.deepEqual(fixed.lines.filter(line => line[1] === "Ödenecek KDV").map(line => line[2]), [100000, 90000, 50000], "rapor = fişler (Mart 1.000, Nisan 900) + Mayıs 500 (fişsiz)");
    for (const query of [{ from: "2026-01-01", to: "2026-05-31" }, monthRange("2026-03"), monthRange("2026-04")]) {
      const r = await h.report("001", query, `001 ${qs(query)} (onarım)`);
      assert.ok(!(MISMATCH in r.summary) && !(CHANGED in r.summary) && !(PRIOR in r.summary), `${qs(query)}: notlar kalkar ${json(r)}`);
    }
    assert.deepEqual((await h.offsets("001")).map(row => row[4]), [false, false, false, false], "hiçbir fiş 'güncel değil' değil (veri tabanı)");
    const tb = await trialBalances(h.api, "?to=2026-04-30");
    assert.equal(Math.abs(Math.round((tb["360"] ?? 0) * 100)), 190000, "defterde 360 = Mart 1.000 + Nisan 900");
    await integrityOk(h.api, "001 onarım");
  });

  it("002 önceki güncel olmayan fiş YOK (yalnız mahsupsuz Şubat): Mart cümlesi AYNEN 'bu ayın ve sonraki …'; zincirleme Nisan (Mart'ın uyuşmayan fişinden) → onarım Mart'tan; adımlarla notlar kalkar", async () => {
    const mar = await h.report("002", monthRange("2026-03"), "002 Mart");
    assert.deepEqual(mar.three, [60000, 0, 40000], `Mart zincir 600 devredenle sonraki 400 (DEĞİŞMEDİ) ${json(mar)}`);
    assert.equal(mar.summary[MISMATCH], carryNote("Mart 2026", "1.000,00 TL", "600,00 TL", ""), `öncesiz: cümle AYNEN ${json(mar)}`);
    assert.match(mar.summary[PENDING] || "", /^Şubat 2026 \(/, "Şubat mahsupsuz notu");
    await h.sameFiles("002", monthRange("2026-03"), "002 Mart");
    // Zincirleme: Nisan satış KDV 200, Nisan fişi defterin 800'üyle (Mart'ın uyuşmayan fişinden) → 800 / 0 / 600; zincir 400 devredenle sonraki 200.
    await h.sell("002", "2026-04-10", 1000);
    assert.deepEqual(await h.offset("002", "2026-04"), [80000, 0, 60000], "002 Nisan fişi defterin 800'üyle 800 / 0 / 600");
    const span = await h.report("002", { from: "2026-03-01", to: "2026-04-30" }, "002 Mart–Nisan");
    assert.deepEqual(span.three, [60000, 0, 20000], `Mart–Nisan zincir 600 devredenle sonraki 200 (DEĞİŞMEDİ) ${json(span)}`);
    assert.equal(
      span.summary[MISMATCH],
      `Mart 2026 fişi 1.000,00 TL devredenle kesilmiş, sırayla mahsupta 600,00 TL olmalıydı; Nisan 2026 fişi 800,00 TL devredenle kesilmiş, sırayla mahsupta 400,00 TL olmalıydı${newTail("Mart 2026")}`,
      `zincirleme: onarım ilk uyuşmayan fişten (Mart 2026) ${json(span)}`,
    );
    assert.equal((await h.report("002", monthRange("2026-03"), "002 Mart (Nisan fişli)")).summary[MISMATCH], carryNote("Mart 2026", "1.000,00 TL", "600,00 TL", ""), "Mart tek ay: cümle yine AYNEN");
    // Notların adımları: Mart'tan geri al (Nisan → Mart), Şubat'ı (mahsupsuz) ve sonrasını sırayla mahsup et.
    await h.reverse("002", "2026-04");
    await h.reverse("002", "2026-03");
    const fis = [];
    for (const month of ["2026-02", "2026-03", "2026-04"]) fis.push(await h.offset("002", month));
    assert.deepEqual(fis, [[100000, 0, 60000], [60000, 0, 40000], [40000, 0, 20000]], "Şubat 1.000 / 0 / 600, Mart 600 / 0 / 400, Nisan 400 / 0 / 200");
    const fixed = await h.report("002", { from: "2026-01-01", to: "2026-04-30" }, "002 onarım");
    assert.deepEqual(fixed.three, [0, 0, 20000], "Ocak–Nisan sonraki 200 = 191 1.000 − 391 800");
    balanced(fixed, "002 onarım");
    assert.ok(!(MISMATCH in fixed.summary) && !(PENDING in fixed.summary), `notlar kalkar ${json(fixed)}`);
    await integrityOk(h.api, "002 onarım");
  });
});

describe("2.5.1 M1 küçük tur 7 — iki 'güncel değil' ay (onarım İLKİNDEN), yıl dönümü (Aralık 2026 → Ocak 2027, fiş değişiklikten SONRA)", () => {
  let h;
  before(async () => {
    h = await program("2027-03-15T12:00:00+03:00", "D7B");
    // 001 — Ocak satış KDV 1.000 + 100 alış 500 (fiş 0 / 600 / 0); Şubat alış 1.000 satış 200 + 100 (fiş 0 / 0 / 700); Mart satış 1.000 fişi Şubat'ın 700'üyle (700 / 300 / 0 —
    // değişiklikten ÖNCE); sonra Ocak'ın 100'lük satışı İptal Et (ödenecek yönde 'güncel değil'; devreden 0 = 0) ve Şubat'ın 100'lük satışı İptal Et (devreden yönde 'güncel değil';
    // bugün 800). (Satış serisi tarih sırasını korur — geriye tarihli satış girilemez; değişiklik İptal Et ile.)
    await h.sell("001", "2026-01-10", 5000);
    const jan100 = await h.sell("001", "2026-01-20", 500);
    await h.buy("001", "2026-01-11", 2500);
    assert.deepEqual(await h.offset("001", "2026-01"), [0, 60000, 0], "001 Ocak fişi 0 / 600 / 0");
    await h.buy("001", "2026-02-10", 5000);
    await h.sell("001", "2026-02-11", 1000);
    const feb100 = await h.sell("001", "2026-02-20", 500);
    assert.deepEqual(await h.offset("001", "2026-02"), [0, 0, 70000], "001 Şubat fişi 0 / 0 / 700");
    await h.sell("001", "2026-03-10", 5000);
    assert.deepEqual(await h.offset("001", "2026-03"), [70000, 30000, 0], "001 Mart fişi 700 / 300 / 0");
    await h.cancel("001", jan100);
    await h.cancel("001", feb100);
    // 002 — yıl dönümü: Kasım 2026 alış KDV 1.000 (fiş 0 / 0 / 1.000); Aralık satış 500 (fiş 1.000 / 0 / 500); sonra Aralık'a satış KDV +300 (bugün devreden 200);
    // Ocak 2027 satış 1.000, fişi değişiklikten SONRA ön izlemeyle (defterin 500'ü) → 500 / 500 / 0.
    await h.buy("002", "2026-11-10", 5000);
    assert.deepEqual(await h.offset("002", "2026-11"), [0, 0, 100000], "002 Kasım fişi");
    await h.sell("002", "2026-12-10", 2500);
    assert.deepEqual(await h.offset("002", "2026-12"), [100000, 0, 50000], "002 Aralık fişi 1.000 / 0 / 500");
    await h.sell("002", "2026-12-20", 1500);
    await h.sell("002", "2027-01-10", 5000);
    assert.deepEqual(await h.offset("002", "2027-01"), [50000, 50000, 0], "002 Ocak 2027 fişi defterin 500'üyle 500 / 500 / 0");
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 iki 'güncel değil' (Ocak ödenecek yönde, Şubat devreden yönde): Mart notu onarımı İLK aydan (Ocak 2026); notun adımlarıyla kalkar; Ocak–Mart 700 = 391 2.200 − 191 1.500", async () => {
    assert.deepEqual((await h.offsets("001")).map(row => row[4]), [true, true, false], "Ocak ve Şubat 'güncel değil' (veri tabanı)");
    const all = await h.report("001", { from: "2026-01-01", to: "2026-03-31" }, "001 Ocak–Mart");
    assert.deepEqual(all.three, [0, 70000, 0], `Ocak–Mart 500 + 200 (DEĞİŞMEDİ) ${json(all)}`);
    assert.deepEqual([all.h391, all.h191], [220000, 150000], "391 2.200, 191 1.500");
    balanced(all, "001 Ocak–Mart");
    assert.equal(all.summary[MISMATCH], carryNote("Mart 2026", "700,00 TL", "800,00 TL", "Ocak 2026"), `onarım İLK 'güncel değil' aydan ${json(all)}`);
    assert.equal((await h.report("001", monthRange("2026-03"), "001 Mart")).summary[MISMATCH], carryNote("Mart 2026", "700,00 TL", "800,00 TL", "Ocak 2026"), "Mart tek ay: aynı");
    assert.deepEqual(await redo(h, "001", ["2026-01", "2026-02", "2026-03"]), [[0, 50000, 0], [0, 0, 80000], [80000, 20000, 0]], "yeniden fişler Ocak 500 / Şubat devreden 800 / Mart 200");
    const fixed = await h.report("001", { from: "2026-01-01", to: "2026-03-31" }, "001 onarım");
    assert.deepEqual(fixed.three, [0, 70000, 0], "onarımdan sonra 700");
    assert.deepEqual(fixed.lines.filter(line => line[1] === "Ödenecek KDV").map(line => line[2]), [50000, 20000], "rapor = fişler");
    assert.ok(!(MISMATCH in fixed.summary) && !(CHANGED in fixed.summary), `notlar kalkar ${json(fixed)}`);
  });

  it("002 yıl dönümü: Bu Yıl (2027) ve Ocak 2027 notu onarımı '(Aralık 2026)' yılıyla söyler; notun adımlarıyla kalkar; Bu Yıl Ödenecek 800 = 391 1.000 − önceki devreden 200", async () => {
    const want = carryNote("Ocak 2027", "500,00 TL", "200,00 TL", "Aralık 2026");
    const year = await h.report("002", { preset: "thisYear" }, "002 Bu Yıl");
    assert.deepEqual(year.three, [20000, 80000, 0], `Bu Yıl önceki 200 · ödenecek 800 (DEĞİŞMEDİ) ${json(year)}`);
    balanced(year, "002 Bu Yıl");
    assert.equal(year.summary[MISMATCH], want, `yıl dönümü notu ${json(year)}`);
    assert.equal((await h.report("002", monthRange("2027-01"), "002 Ocak 2027")).summary[MISMATCH], want, "Ocak 2027 tek ay: aynı");
    await h.sameFiles("002", { preset: "thisYear" }, "002 Bu Yıl");
    assert.deepEqual(await redo(h, "002", ["2026-12", "2027-01"]), [[100000, 0, 20000], [20000, 80000, 0]], "yeniden fişler Aralık devreden 200 / Ocak 2027 800");
    const fixed = await h.report("002", { preset: "thisYear" }, "002 Bu Yıl (onarım)");
    assert.deepEqual(fixed.three, [20000, 80000, 0], "onarımdan sonra aynı");
    assert.ok(!(MISMATCH in fixed.summary) && !(CHANGED in fixed.summary) && !(PRIOR in fixed.summary), `notlar kalkar ${json(fixed)}`);
    const last = await h.report("002", { from: "2026-01-01", to: "2026-12-31" }, "002 2026");
    assert.ok(!(MISMATCH in last.summary) && !(CHANGED in last.summary), `2026 yılı: notlar kalkar ${json(last)}`);
    await integrityOk(h.api, "002 onarım");
  });
});
