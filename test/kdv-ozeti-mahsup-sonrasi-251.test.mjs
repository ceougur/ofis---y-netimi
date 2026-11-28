// 2.5.1 M1 küçük tur — KDV Özeti: mahsup fişinden SONRA değişen ay.
//   S-DKM1-1 = A (kullanıcı 27.11.2026 14:18 "önerilerini uygula açık sorulara"): mahsup fişi kesilmiş ayın kayıtları sonradan İndirilecek KDV'yi AZALTIRSA o ayın sonucu
//     kesilmiş fişten (azalma S4 kuralıyla sonraki mahsupta düşülür; bugünkü kayıtlardan hesaplanırsa azalma iki kez sayılıyordu); o aya "bu ayın kayıtları fişten sonra
//     değişti" notu. Kararın örneği (ELLE): Ocak satış KDV 1.000, alış KDV 500 → Ocak mahsubu 500; Ocak alışı iptal; Şubat satış KDV 200 → Şubat fişi 700; Mart 400 → fiş 400;
//     rapor Ocak 500 / Şubat 700 / Mart 400, Ocak–Mart Ödenecek 1.600 = fişler = 391 (taban: Ocak 1.000, Ocak–Mart 2.100).
//   S-M1-3 = C: fişten sonra ARTIRAN değişiklik olan ayda sayılar bugünkü kayıtlardan kalır + "mahsup fişi güncel değil — mahsubu geri alıp yeniden mahsup edin".
//   S-M1-2 (BAŞ MİMAR = B): kopuk zincirde fişin YÖNÜ zincirle tersse sayılar aynı (zincir), not yön farkını da yazar.
//   Dar kontrol L (DÜŞÜK-1, aynı koşul): mahsupsuz ay İndirilecek KDV'deki azalmayı zincirde zaten düşmüşken sonraki ayın fişi aynı azalmayı defter sırasıyla yeniden düşmüşse
//     fiş zincirde DEĞİLDİR → rapor zinciri gösterir + "Zincirle Uyuşmayan Mahsup Fişi" notu (taban: not yok, Ocak–Mart 2.100).
//   Dar kontrolün yaşayan iki mutantı için sınama: mahsupsuz ayın S4 emilimi zincirde (002 Şubat–Mart, tabanda da YEŞİL — mutantta kırmızı) ve "Mahsup Edilmemiş Ay" en çok
//     6 ay sınırı (6 ve 7 ay; tabanda YEŞİL — mutantta kırmızı).
// KÂHİN ELLE (karar metinlerinden ve aşağıdaki elle hesaptan; programın kodundan türetilmedi — ders 5). Veri programın API'sinden; sahte saat (ders 13); KDV %20.
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
const REDUCED_TEXT = "(bu ayın kayıtları fişten sonra değişti; ayın sonucu kesilmiş mahsup fişinden, İndirilecek KDV'deki azalma sonraki mahsupta düşülür)";
const STALE_TEXT = "(mahsup fişi güncel değil — mahsubu geri alıp yeniden mahsup edin)";
const MISMATCH_TAIL = " (raporda sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)";
const PENDING_TAIL = " (devreden ve ödenecek KDV bu aylar sırayla mahsup edilmiş gibi hesaplandı; KDV Mahsup Fişi ön izlemesi defterdeki devredeni gösterir, ayları sırayla mahsup edin)";
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
    q2,
    buy: async (tag, date, net) => (await must(`alış ${tag} ${date}`, api.post(amp(INV, qOf(tag)), { kind: "purchase", scenario: "expense_purchase", accountId: ids[`T${tag}`], issueDate: date, number: `${prefix}-${tag}-${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id,
    sell: async (tag, date, net) => (await must(`satış ${tag} ${date}`, api.post(amp(INV, qOf(tag)), { scenario: "service_sale", accountId: ids[`M${tag}`], issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }))).id,
    cancel: async (tag, id) => must(`İptal Et ${tag}`, api.post(amp(`${INV}/${id}/cancel`, qOf(tag)), { reason: "Hatalı fatura", force: true })),
    offset: async (tag, month) => (await must(`mahsup ${tag} ${month}`, api.post(amp(`${TAX}/vat-offset`, qOf(tag)), { month }))).offset,
    reverse: async (tag, month) => {
      const list = (await must("mahsup listesi", api.get(amp(`${TAX}/vat-offset`, qOf(tag))))).offsets;
      const row = list.find(item => item.month === month && item.status === "active");
      assert.ok(row, `${tag} ${month} etkin fiş`);
      return must(`geri al ${tag} ${month}`, api.post(amp(`${TAX}/vat-offset/${row.id}/reverse`, qOf(tag)), {}));
    },
    offsets: async tag => (await must("mahsup listesi", api.get(amp(`${TAX}/vat-offset`, qOf(tag))))).offsets.filter(item => item.status === "active").map(item => [item.month, item.carryInMinor, item.payableMinor, item.carryOutMinor]),
    preview: async (tag, month) => {
      const p = (await must(`ön izleme ${tag} ${month}`, api.get(amp(`${TAX}/vat-offset?month=${month}`, qOf(tag))))).preview;
      return [p.carryInMinor, p.payableMinor, p.carryOutMinor];
    },
    /** Rapor (ekran JSON'u): özet, üç sonuç (önceki / ödenecek / sonraki), ay satırları; tablo altı = özet. */
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

describe("2.5.1 M1 küçük tur — KDV Özeti: fişten sonra azalan İndirilecek KDV (S-DKM1-1 = A) ve S4 emilimiyle kopuk fiş (dar kontrol L)", () => {
  let h;
  before(async () => {
    h = await program("2026-05-20T12:00:00+03:00", "MS");
    // 001 — kararın örneği (dar kontrol L2): bütün aylar SIRAYLA mahsuplu.
    await h.sell("001", "2026-01-05", 5000); // 391 1.000
    const jan001 = await h.buy("001", "2026-01-10", 2500); // 191 500
    await h.offset("001", "2026-01"); // ödenecek 500
    await h.cancel("001", jan001); // Ocak 191 → 0 (fişten SONRA azalan)
    await h.sell("001", "2026-02-10", 1000); // 391 200
    await h.offset("001", "2026-02"); // 200 + 500 (S4) = 700
    await h.sell("001", "2026-03-10", 2000); // 391 400
    await h.offset("001", "2026-03"); // 400
    // 002 — dar kontrol L: Şubat MAHSUPSUZ (zincir azalmayı Şubat'ta düşer); Mart fişi sonra kesilecek.
    await h.sell("002", "2026-01-05", 5000);
    const jan002 = await h.buy("002", "2026-01-10", 2500);
    await h.offset("002", "2026-01");
    await h.cancel("002", jan002);
    await h.sell("002", "2026-02-10", 1000);
    await h.sell("002", "2026-03-10", 2000);
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 kararın örneği: Ocak 500 / Şubat 700 / Mart 400 (fişten), Ocak–Mart Ödenecek 1.600 = fişler = 391; Ocak'ta not; ön izleme ve defter değişmez; ekran = PDF = Excel", async () => {
    assert.deepEqual(await h.offsets("001"), [["2026-01", 0, 50000, 0], ["2026-02", 0, 70000, 0], ["2026-03", 0, 40000, 0]], "fişler (veri tabanı): 500 / 700 / 400");
    const jan = await h.report("001", monthRange("2026-01"), "001 Ocak");
    assert.deepEqual(jan.three, [0, 50000, 0], `Ocak sonucu kesilmiş fişten (taban: bugünkü kayıtlarla 1.000) ${JSON.stringify(jan.data.summary)}`);
    assert.equal(jan.summary[CHANGED], `Ocak 2026 ${REDUCED_TEXT}`, "Ocak notu");
    assert.deepEqual([jan.h391, jan.h191], [100000, 0], "Ocak 391 / 191 bugünkü kayıtlardan (değişmedi)");
    const feb = await h.report("001", monthRange("2026-02"), "001 Şubat");
    assert.deepEqual(feb.three, [0, 70000, 0], "Şubat (fiş = S4 taşıması)");
    assert.ok(!(CHANGED in feb.summary), `Şubat notsuz ${JSON.stringify(feb.data.summary)}`);
    assert.deepEqual((await h.report("001", monthRange("2026-03"), "001 Mart")).three, [0, 40000, 0], "Mart");
    const q1 = await h.report("001", { from: "2026-01-01", to: "2026-03-31" }, "001 Ocak–Mart");
    assert.deepEqual(q1.three, [0, 160000, 0], `Ocak–Mart Ödenecek 1.600 (taban 2.100) ${JSON.stringify(q1.data.summary)}`);
    assert.deepEqual([q1.h391, q1.h191], [160000, 0], "391 1.600 − 191 0 = Ödenecek");
    assert.deepEqual(q1.lines, [["Ocak 2026", "Ödenecek KDV", 50000], ["Şubat 2026", "Ödenecek KDV", 70000], ["Mart 2026", "Ödenecek KDV", 40000]], "ay satırları");
    assert.equal(q1.summary[CHANGED], `Ocak 2026 ${REDUCED_TEXT}`, "Ocak–Mart notu yalnız Ocak");
    assert.ok(!(MISMATCH in q1.summary) && !(PENDING in q1.summary), "zincir kopuk değil, mahsupsuz ay yok");
    const tb = await trialBalances(h.api, "?to=2026-03-31");
    assert.equal(Math.abs(Math.round((tb["360"] ?? 0) * 100)), 160000, "defterde 360 = 1.600 (fişlerin toplamı; defter DEĞİŞMEDİ)");
    assert.equal(Math.round((tb["190"] ?? 0) * 100), 0, "defterde 190 yok");
    // Ön izleme DEĞİŞMEDİ: Ocak bugünkü kayıtlarla 1.000 (fiş 500); Şubat / Mart fişle aynı.
    assert.deepEqual(await h.preview("001", "2026-01"), [0, 100000, 0], "Ocak ön izlemesi bugünkü kayıtlardan");
    assert.deepEqual(await h.preview("001", "2026-02"), [0, 70000, 0], "Şubat ön izlemesi");
    assert.deepEqual(await h.preview("001", "2026-03"), [0, 40000, 0], "Mart ön izlemesi");
    await h.sameFiles("001", { from: "2026-01-01", to: "2026-03-31" }, "001 Ocak–Mart");
  });

  it("001 aralığın kenarları: Ocak–Şubat 1.200, Şubat–Mart 1.100 (notsuz), Tüm Zamanlar 1.600, Mart–Nisan önceki 0; gelecek ay devreden 0", async () => {
    assert.deepEqual((await h.report("001", { from: "2026-01-01", to: "2026-02-28" })).three, [0, 120000, 0], "Ocak–Şubat (aralık azalan ayla başlar)");
    const late = await h.report("001", { from: "2026-02-01", to: "2026-03-31" });
    assert.deepEqual(late.three, [0, 110000, 0], "Şubat–Mart (aralık azalan aydan sonra başlar)");
    assert.ok(!(CHANGED in late.summary), "Şubat–Mart: azalan ay aralıkta değil — not yok");
    assert.deepEqual((await h.report("001", { preset: "all" })).three, [0, 160000, 0], "Tüm Zamanlar");
    assert.deepEqual((await h.report("001", { from: "2026-03-01", to: "2026-04-30" })).three, [0, 40000, 0], "Mart–Nisan");
    assert.deepEqual((await h.report("001", monthRange("2026-06"))).three, [0, 0, 0], "gelecek ay");
  });

  it("002 mahsupsuz Şubat İndirilecek KDV'deki azalmayı zincirde düşer (S4 emilimi): Şubat 700, Mart 400, Şubat–Mart 1.100 — Mart ikinci kez düşmez", async () => {
    // Dar kontrolün yaşayan mutantı M3 (mahsupsuz ayın saklı İ'si = bugünkü İ): Mart azalmayı yeniden düşer → 900.
    const feb = await h.report("002", monthRange("2026-02"), "002 Şubat");
    assert.deepEqual(feb.three, [0, 70000, 0], "Şubat zincirde: 200 + 500 (S4)");
    const mar = await h.report("002", monthRange("2026-03"), "002 Mart");
    assert.deepEqual(mar.three, [0, 40000, 0], `Mart: azalma Şubat'ta düşüldü (M3 mutantında 900) ${JSON.stringify(mar.data.summary)}`);
    assert.match(mar.summary[PENDING] || "", /^Şubat 2026 \(/, "Mart: Şubat mahsupsuz");
    assert.deepEqual((await h.report("002", { from: "2026-02-01", to: "2026-03-31" })).three, [0, 110000, 0], "Şubat–Mart");
  });

  it("002 dar kontrol L: Şubat atlanıp Mart fişi defter sırasıyla (azalmayı yeniden düşerek) 900 kesilir → rapor zinciri gösterir (Mart 400, Ocak–Mart 1.600) + 'Zincirle Uyuşmayan Mahsup Fişi'; onarım", async () => {
    const fis = await h.offset("002", "2026-03");
    assert.deepEqual([fis.carryInMinor, fis.payableMinor, fis.carryOutMinor], [0, 90000, 0], "Mart fişi (ön izleme DEĞİŞMEDİ: 400 + 500)");
    const mar = await h.report("002", monthRange("2026-03"), "002 Mart (fişli)");
    assert.deepEqual(mar.three, [0, 40000, 0], "Mart zincir");
    assert.equal(mar.summary[MISMATCH], `Mart 2026 fişi ödenecek KDV 900,00 TL yazmış, sırayla mahsupta ödenecek KDV 400,00 TL olmalıydı — İndirilecek KDV'deki azalma sırayla mahsupta daha önceki bir ayda düşülür${MISMATCH_TAIL}`, `Mart notu (taban: not yok) ${JSON.stringify(mar.data.summary)}`);
    assert.deepEqual(await h.preview("002", "2026-03"), [0, 90000, 0], "Mart ön izlemesi değişmedi");
    const q1 = await h.report("002", { from: "2026-01-01", to: "2026-03-31" }, "002 Ocak–Mart");
    assert.deepEqual(q1.three, [0, 160000, 0], `Ocak–Mart 1.600 = 391 (taban 2.100) ${JSON.stringify(q1.data.summary)}`);
    assert.deepEqual(q1.lines, [["Ocak 2026", "Ödenecek KDV", 50000], ["Şubat 2026", "Ödenecek KDV", 70000], ["Mart 2026", "Ödenecek KDV", 40000]], "002 ay satırları");
    assert.equal(q1.summary[CHANGED], `Ocak 2026 ${REDUCED_TEXT}`, "Ocak notu");
    await h.sameFiles("002", monthRange("2026-03"), "002 Mart");
    // Onarım: Mart geri al, Şubat ve Mart sırayla → fişler 700 / 400; rapor aynı sayı, uyuşmazlık kalkar.
    await h.reverse("002", "2026-03");
    const febFis = await h.offset("002", "2026-02");
    assert.deepEqual([febFis.carryInMinor, febFis.payableMinor, febFis.carryOutMinor], [0, 70000, 0], "Şubat fişi");
    const marFis = await h.offset("002", "2026-03");
    assert.deepEqual([marFis.carryInMinor, marFis.payableMinor, marFis.carryOutMinor], [0, 40000, 0], "Mart fişi yeniden");
    const fixed = await h.report("002", { from: "2026-01-01", to: "2026-03-31" }, "002 onarım");
    assert.deepEqual(fixed.three, [0, 160000, 0], "onarımdan sonra aynı");
    assert.ok(!(MISMATCH in fixed.summary) && !(PENDING in fixed.summary), "notlar kalkar");
    await integrityOk(h.api, "002 L");
  });

  it("001 mahsubu geri alınan ay: Mart, Şubat, Ocak sırayla geri alınır — toplam her adımda 1.600; Ocak geri alınınca Ocak 1.000 / Şubat 200 (bugünkü kayıtlar), not kalkar; yeniden kesilince 1.000 / 200 / 400", async () => {
    await h.reverse("001", "2026-03");
    let q1 = await h.report("001", { from: "2026-01-01", to: "2026-03-31" }, "001 Mart geri alındı");
    assert.deepEqual(q1.three, [0, 160000, 0], "Mart geri alındı");
    assert.deepEqual(q1.lines.map(line => line[2]), [50000, 70000, 40000], "ay ay aynı");
    await h.reverse("001", "2026-02");
    q1 = await h.report("001", { from: "2026-01-01", to: "2026-03-31" }, "001 Şubat geri alındı");
    assert.deepEqual(q1.three, [0, 160000, 0], "Şubat geri alındı");
    assert.deepEqual(q1.lines.map(line => line[2]), [50000, 70000, 40000], "Şubat zincirde azalmayı düşer");
    assert.equal(q1.summary[CHANGED], `Ocak 2026 ${REDUCED_TEXT}`, "Ocak fişi duruyor: not");
    await h.reverse("001", "2026-01");
    q1 = await h.report("001", { from: "2026-01-01", to: "2026-03-31" }, "001 hepsi geri alındı");
    assert.deepEqual(q1.three, [0, 160000, 0], "hepsi geri alındı");
    assert.deepEqual(q1.lines.map(line => line[2]), [100000, 20000, 40000], "Ocak bugünkü kayıtlardan 1.000, Şubat 200");
    assert.ok(!(CHANGED in q1.summary), "fiş yok: not yok");
    for (const month of ["2026-01", "2026-02", "2026-03"]) await h.offset("001", month);
    assert.deepEqual(await h.offsets("001"), [["2026-01", 0, 100000, 0], ["2026-02", 0, 20000, 0], ["2026-03", 0, 40000, 0]], "yeniden kesilen fişler");
    q1 = await h.report("001", { from: "2026-01-01", to: "2026-03-31" }, "001 yeniden");
    assert.deepEqual(q1.three, [0, 160000, 0], "yeniden kesilince aynı");
    assert.ok(!(CHANGED in q1.summary) && !(PENDING in q1.summary), "not yok");
    await integrityOk(h.api, "001 geri al");
  });
});

describe("2.5.1 M1 küçük tur — KDV Özeti: yön notu (S-M1-2), yıl dönümünde azalan ay, sonraki fişten sonra gelen azalma, 'Mahsup Edilmemiş Ay' 6 ay sınırı", () => {
  let h;
  let dec001 = "";
  before(async () => {
    h = await program("2027-01-20T12:00:00+03:00", "MY");
    // 001 — S-M1-2: Ocak alış KDV 2.000 + mahsup; Şubat satış KDV 1.800 MAHSUPSUZ; Mart satış KDV 1.000, Mart fişi defterdeki 2.000'le (sonraki 1.000).
    await h.buy("001", "2026-01-10", 10000);
    await h.offset("001", "2026-01");
    await h.sell("001", "2026-02-10", 9000);
    await h.sell("001", "2026-03-10", 5000);
    await h.offset("001", "2026-03");
    // 002 — azalma SONRAKİ ayın fişinden sonra: Ocak (satış 1.000, alış 500) ve Şubat (satış 200) mahsuplu; sonra Ocak alışı iptal; Mart satış 400 + mahsup (defter: 900).
    await h.sell("002", "2026-01-05", 5000);
    const jan002 = await h.buy("002", "2026-01-10", 2500);
    await h.offset("002", "2026-01");
    await h.sell("002", "2026-02-10", 1000);
    await h.offset("002", "2026-02");
    await h.cancel("002", jan002);
    await h.sell("002", "2026-03-10", 2000);
    await h.offset("002", "2026-03");
    // 002 — Nisan … Ekim her ay satış KDV 200, hiçbiri mahsup edilmez (7 ay).
    for (const month of ["04", "05", "06", "07", "08", "09", "10"]) await h.sell("002", `2026-${month}-10`, 1000);
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 S-M1-2: fiş 'sonraki döneme devreden 1.000', zincir 'ödenecek 800' → rapor zinciri (200 / 800 / 0) gösterir, not yön farkını da yazar; ön izleme değişmez", async () => {
    assert.deepEqual(await h.offsets("001"), [["2026-01", 0, 0, 200000], ["2026-03", 200000, 0, 100000]], "fişler");
    const mar = await h.report("001", monthRange("2026-03"), "001 Mart");
    assert.deepEqual(mar.three, [20000, 80000, 0], "Mart zincir: 1.000 − 200");
    assert.equal(mar.summary[MISMATCH], `Mart 2026 fişi 2.000,00 TL devredenle kesilmiş, sırayla mahsupta 200,00 TL olmalıydı; fiş sonraki döneme devreden KDV 1.000,00 TL yazmış, sırayla mahsupta ödenecek KDV 800,00 TL çıkar${MISMATCH_TAIL}`, `yön notu (taban: yön farkı yazılmıyor) ${JSON.stringify(mar.data.summary)}`);
    assert.deepEqual(await h.preview("001", "2026-03"), [200000, 0, 100000], "Mart ön izlemesi (fiş) değişmedi");
    await h.sameFiles("001", monthRange("2026-03"), "001 Mart yön");
    // Onarım: Mart geri al → Şubat ve Mart sırayla → 190 = 0 (yıl dönümü sınamasının başlangıcı).
    await h.reverse("001", "2026-03");
    await h.offset("001", "2026-02");
    const marFis = await h.offset("001", "2026-03");
    assert.deepEqual([marFis.carryInMinor, marFis.payableMinor, marFis.carryOutMinor], [20000, 80000, 0], "Mart fişi yeniden");
    const fixed = await h.report("001", monthRange("2026-03"));
    assert.ok(!(MISMATCH in fixed.summary), "onarımdan sonra not yok");
  });

  it("001 yıl dönümü: Aralık 2026 fişi (ödenecek 400), Aralık alışı Ocak'ta iptal → Aralık 400 (fişten) + not; Ocak 2027 200 + 200 = 400; Bu Yıl 400; 2026 yılı 1.200; Aralık–Ocak 800 = 391", async () => {
    await h.sell("001", "2026-12-05", 3000); // 391 600
    dec001 = await h.buy("001", "2026-12-10", 1000); // 191 200
    const fis = await h.offset("001", "2026-12");
    assert.deepEqual([fis.carryInMinor, fis.payableMinor, fis.carryOutMinor], [0, 40000, 0], "Aralık fişi");
    await h.cancel("001", dec001);
    await h.sell("001", "2027-01-10", 1000); // 391 200
    const dec = await h.report("001", monthRange("2026-12"), "001 Aralık");
    assert.deepEqual(dec.three, [0, 40000, 0], `Aralık fişten (taban: 600) ${JSON.stringify(dec.data.summary)}`);
    assert.equal(dec.summary[CHANGED], `Aralık 2026 ${REDUCED_TEXT}`, "Aralık notu");
    const jan = await h.report("001", monthRange("2027-01"), "001 Ocak 2027");
    assert.deepEqual(jan.three, [0, 40000, 0], "Ocak 2027: 200 + 200 (S4)");
    assert.deepEqual(await h.preview("001", "2027-01"), [0, 40000, 0], "Ocak 2027 ön izleme = rapor");
    assert.deepEqual((await h.report("001", { preset: "thisYear" }, "Bu Yıl")).three, [0, 40000, 0], "Bu Yıl (2027)");
    const year = await h.report("001", { from: "2026-01-01", to: "2026-12-31" }, "001 2026");
    assert.deepEqual(year.three, [0, 120000, 0], "2026: Mart 800 + Aralık 400");
    const cross = await h.report("001", { from: "2026-12-01", to: "2027-01-31" }, "001 Aralık–Ocak");
    assert.deepEqual(cross.three, [0, 80000, 0], "Aralık–Ocak 800");
    assert.deepEqual([cross.h391, cross.h191], [80000, 0], "391 800 − 191 0");
    await h.sameFiles("001", { from: "2026-12-01", to: "2027-01-31" }, "001 Aralık–Ocak");
  });

  it("002 azalma sonraki ayın fişinden SONRA: Ocak 500 (fişten, not), Şubat 200 (fişten, NOT YOK — Şubat'ın kaydı değişmedi), Mart 900 (zincirde, azalmayı düşer); Ocak–Mart 1.600", async () => {
    assert.deepEqual(await h.offsets("002"), [["2026-01", 0, 50000, 0], ["2026-02", 0, 20000, 0], ["2026-03", 0, 90000, 0]], "fişler");
    const jan = await h.report("002", monthRange("2026-01"), "002 Ocak");
    assert.deepEqual(jan.three, [0, 50000, 0], "Ocak fişten");
    assert.equal(jan.summary[CHANGED], `Ocak 2026 ${REDUCED_TEXT}`, "Ocak notu");
    const feb = await h.report("002", monthRange("2026-02"), "002 Şubat");
    assert.deepEqual(feb.three, [0, 20000, 0], `Şubat fişten (taban: 700) ${JSON.stringify(feb.data.summary)}`);
    assert.ok(!(CHANGED in feb.summary), `Şubat notsuz ${JSON.stringify(feb.data.summary)}`);
    const mar = await h.report("002", monthRange("2026-03"), "002 Mart");
    assert.deepEqual(mar.three, [0, 90000, 0], "Mart fişi zincirde");
    assert.ok(!(MISMATCH in mar.summary) && !(CHANGED in mar.summary), "Mart notsuz");
    const q1 = await h.report("002", { from: "2026-01-01", to: "2026-03-31" }, "002 Ocak–Mart");
    assert.deepEqual(q1.three, [0, 160000, 0], "Ocak–Mart 1.600 = 391");
    assert.equal(q1.summary[CHANGED], `Ocak 2026 ${REDUCED_TEXT}`, "yalnız Ocak");
  });

  it("002 'Mahsup Edilmemiş Ay' en çok 6 ay: Ekim (6 ay: Nisan–Eylül, eksiksiz) ve Kasım (7 ay: 6 ay + 've 1 ay daha')", async () => {
    // Dar kontrolün yaşayan mutantı M7 (sınır 5): Ekim "… ve 1 ay daha", Kasım "… ve 2 ay daha".
    const six = "Nisan 2026, Mayıs 2026, Haziran 2026, Temmuz 2026, Ağustos 2026, Eylül 2026";
    const oct = await h.report("002", monthRange("2026-10"), "002 Ekim");
    assert.equal(oct.summary[PENDING], `${six}${PENDING_TAIL}`, "Ekim: altı ay, eksiksiz");
    const nov = await h.report("002", monthRange("2026-11"), "002 Kasım");
    assert.equal(nov.summary[PENDING], `${six} ve 1 ay daha${PENDING_TAIL}`, "Kasım: yedi ay");
    assert.deepEqual(nov.three, [0, 0, 0], "Kasım hareketsiz: ödenecek 0, devreden 0");
  });
});
