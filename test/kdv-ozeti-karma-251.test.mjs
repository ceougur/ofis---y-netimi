// 2.5.1 M1 küçük tur 2 — KDV Özeti: KARMA AY (S-M1K-1 = A).
//   KULLANICI 27.11.2026 16:16 UTC ("önerilerini uygula açık sorulara") — S-M1K-1 = A: mahsup fişinden sonra aynı ayda hem İndirilecek KDV azalmış hem satış KDV'si (391)
//   değişmişse: İndirilecek KDV FİŞTEN, satış KDV'si BUGÜNKÜ kayıtlardan; her değişiklik bir kez sayılır. Örnek (AYNEN): Ocak fişi 500 kesildi; sonra Ocak alışı iptal edildi ve
//   Ocak'a KDV'si 100 olan satış girildi; Şubat fişi 700 → Ocak 600, Ocak–Şubat 1.300 (= 391). Bugün (taban): Ocak 1.100, Ocak–Şubat 1.800.
//   Önceki kararlar DEĞİŞMEZ: S-DKM1-1 = A (yalnız İ azalmışsa ayın sonucu fişten), S-M1-3 = C (yalnız 391 değişti / İ arttı — "güncel değil", bugünkü kayıtlar), S-M1-1 = B
//   (zincirli devreden), S-M1-2 = B (yön notu). Bu dosya dördünün yeni kuralla birlikte tutarlılığını tablo sınamayla gösterir (yalnız azalma / yalnız 391 / ikisi / hiçbiri /
//   İ arttı + 391): her durumda aralık Ödenecek = 391 − 191 ve rapor = ayları sonradan sırayla yeniden mahsup edince kesilen fişlerin toplamı.
// KÂHİN ELLE (karar metni + elle hesap; programın kodundan türetilmedi — ders 5). Veri programın API'sinden; sahte saat (ders 13); KDV %20. Sayılar yanıt gövdesinden ve
// veri tabanından (mahsup fişi listesi, mizan) okunur (ders 3).
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

/** Aralığın sonucu 391 − 191'e eşit mi (aralık, azalmanın düşüldüğü ayı da içeriyorsa — her değişiklik bir kez). */
const balanced = (r, label) => assert.equal(r.three[1] - r.three[2] + r.three[0], r.h391 - r.h191, `${label}: Ödenecek − Sonraki + Önceki = 391 − 191 (${JSON.stringify(r.three)}, 391 ${r.h391}, 191 ${r.h191})`);

describe("2.5.1 M1 küçük tur 2 — KDV Özeti karma ay (S-M1K-1 = A): kararın örneği AYNEN, satış silinmesi + alış iptali, iki şirket", () => {
  let h;
  before(async () => {
    h = await program("2026-05-20T12:00:00+03:00", "KR");
    // 001 — kararın örneği AYNEN: Ocak satış KDV 1.000, alış KDV 500 → Ocak fişi 500; Ocak alışı iptal + Ocak satış KDV 100; Şubat satış KDV 200 → Şubat fişi 700.
    await h.sell("001", "2026-01-05", 5000);
    const buy = await h.buy("001", "2026-01-10", 2500);
    assert.deepEqual(await h.offset("001", "2026-01"), [0, 50000, 0], "001 Ocak fişi 500");
    await h.cancel("001", buy);
    await h.sell("001", "2026-01-20", 500);
    await h.sell("001", "2026-02-10", 1000);
    assert.deepEqual(await h.offset("001", "2026-02"), [0, 70000, 0], "001 Şubat fişi 700 (200 + S4 500)");
    // 002 — satış silinmesi (391 AZALIR) + alış iptali aynı ayda: Ocak satış KDV 900 + 100, alış 500 → fiş 500; sonra 100'lük satış ve alış İptal Et; Şubat satış 200 → fiş 700.
    await h.sell("002", "2026-01-05", 4500);
    const small = await h.sell("002", "2026-01-06", 500);
    const buy2 = await h.buy("002", "2026-01-10", 2500);
    assert.deepEqual(await h.offset("002", "2026-01"), [0, 50000, 0], "002 Ocak fişi 500");
    await h.cancel("002", small);
    await h.cancel("002", buy2);
    await h.sell("002", "2026-02-10", 1000);
    assert.deepEqual(await h.offset("002", "2026-02"), [0, 70000, 0], "002 Şubat fişi 700");
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 kararın örneği: Ocak 600 (İ fişten 500, 391 bugünkü 1.100), Şubat 700, Ocak–Şubat 1.300 = 391; karma notu; fişler, ön izleme ve defter değişmez; ekran = PDF = Excel", async () => {
    assert.deepEqual(await h.offsets("001"), [["2026-01", 0, 50000, 0, true], ["2026-02", 0, 70000, 0, false]], "fişler (veri tabanı): 500 / 700; Ocak güncel değil");
    const jan = await h.report("001", monthRange("2026-01"), "001 Ocak");
    assert.deepEqual(jan.three, [0, 60000, 0], `Ocak 600 (taban: bugünkü kayıtlarla 1.100) ${JSON.stringify(jan.data.summary)}`);
    assert.equal(jan.summary[CHANGED], `Ocak 2026 ${MIXED_TEXT}`, "Ocak karma notu (tek not; azalan / güncel değil notlarında yinelenmez)");
    assert.deepEqual([jan.h391, jan.h191], [110000, 0], "Ocak 391 / 191 bugünkü kayıtlardan");
    const feb = await h.report("001", monthRange("2026-02"), "001 Şubat");
    assert.deepEqual(feb.three, [0, 70000, 0], "Şubat fişten (S4 500 bir kez)");
    assert.ok(!(CHANGED in feb.summary), `Şubat notsuz ${JSON.stringify(feb.data.summary)}`);
    const both = await h.report("001", { from: "2026-01-01", to: "2026-02-28" }, "001 Ocak–Şubat");
    assert.deepEqual(both.three, [0, 130000, 0], `Ocak–Şubat 1.300 (taban 1.800) ${JSON.stringify(both.data.summary)}`);
    assert.deepEqual([both.h391, both.h191], [130000, 0], "391 1.300 − 191 0");
    balanced(both, "001 Ocak–Şubat");
    assert.deepEqual(both.lines, [["Ocak 2026", "Ödenecek KDV", 60000], ["Şubat 2026", "Ödenecek KDV", 70000]], "ay satırları");
    assert.equal(both.summary[CHANGED], `Ocak 2026 ${MIXED_TEXT}`, "Ocak–Şubat notu yalnız Ocak");
    assert.ok(!(MISMATCH in both.summary) && !(PENDING in both.summary), "zincir kopuk değil, mahsupsuz ay yok");
    const tb = await trialBalances(h.api, "?to=2026-02-28");
    assert.equal(Math.abs(Math.round((tb["360"] ?? 0) * 100)), 120000, "defterde 360 = 1.200 (fişlerin toplamı; defter DEĞİŞMEDİ)");
    assert.equal(Math.round((tb["190"] ?? 0) * 100), 0, "defterde 190 yok");
    assert.deepEqual(await h.preview("001", "2026-01"), [0, 110000, 0], "Ocak ön izlemesi bugünkü kayıtlardan (DEĞİŞMEDİ)");
    assert.deepEqual(await h.preview("001", "2026-02"), [0, 70000, 0], "Şubat ön izlemesi");
    await h.sameFiles("001", { from: "2026-01-01", to: "2026-02-28" }, "001 Ocak–Şubat");
    await h.sameFiles("001", monthRange("2026-01"), "001 Ocak");
  });

  it("001 aralıklar: Mart fişi 400 → Ocak–Mart 1.700, Şubat–Mart 1.100 (notsuz), Bu Yıl ve Tüm Zamanlar 1.700 — hepsi 391 − 191", async () => {
    await h.sell("001", "2026-03-10", 2000);
    assert.deepEqual(await h.offset("001", "2026-03"), [0, 40000, 0], "Mart fişi 400");
    const q1 = await h.report("001", { from: "2026-01-01", to: "2026-03-31" }, "001 Ocak–Mart");
    assert.deepEqual(q1.three, [0, 170000, 0], `Ocak–Mart 1.700 (taban 2.200) ${JSON.stringify(q1.data.summary)}`);
    balanced(q1, "001 Ocak–Mart");
    assert.deepEqual(q1.lines.map(line => line[2]), [60000, 70000, 40000], "ay satırları 600 / 700 / 400");
    const late = await h.report("001", { from: "2026-02-01", to: "2026-03-31" }, "001 Şubat–Mart");
    assert.deepEqual(late.three, [0, 110000, 0], "Şubat–Mart 1.100");
    assert.ok(!(CHANGED in late.summary), "Şubat–Mart: karma ay aralıkta değil — not yok");
    for (const preset of ["thisYear", "all"]) {
      const r = await h.report("001", { preset }, `001 ${preset}`);
      assert.deepEqual(r.three, [0, 170000, 0], `${preset} 1.700`);
      balanced(r, `001 ${preset}`);
    }
  });

  it("002 satış silinmesi + alış iptali (391 azaldı, İ azaldı): Ocak 400 (900 − 500 fişten), Şubat 700, Ocak–Şubat 1.100 = 391; karma notu; 001 etkilenmez", async () => {
    assert.deepEqual(await h.offsets("002"), [["2026-01", 0, 50000, 0, true], ["2026-02", 0, 70000, 0, false]], "002 fişler");
    const jan = await h.report("002", monthRange("2026-01"), "002 Ocak");
    assert.deepEqual(jan.three, [0, 40000, 0], `Ocak 400 (taban: 900) ${JSON.stringify(jan.data.summary)}`);
    assert.equal(jan.summary[CHANGED], `Ocak 2026 ${MIXED_TEXT}`, "002 Ocak karma notu");
    const both = await h.report("002", { from: "2026-01-01", to: "2026-02-28" }, "002 Ocak–Şubat");
    assert.deepEqual(both.three, [0, 110000, 0], `Ocak–Şubat 1.100 (taban 1.600) ${JSON.stringify(both.data.summary)}`);
    assert.deepEqual([both.h391, both.h191], [110000, 0], "391 1.100 − 191 0");
    assert.deepEqual(await h.preview("002", "2026-01"), [0, 90000, 0], "002 Ocak ön izlemesi bugünkü kayıtlardan");
    await h.sameFiles("002", { from: "2026-01-01", to: "2026-02-28" }, "002 Ocak–Şubat");
    assert.deepEqual((await h.report("001", { from: "2026-01-01", to: "2026-02-28" })).three, [0, 130000, 0], "001 aynı (şirketler ayrı)");
    // Onarım: Şubat ve Ocak geri alınıp sırayla yeniden mahsup → fişler 900 / 200 (toplam 1.100 = raporun söylediği); not kalkar.
    await h.reverse("002", "2026-02");
    await h.reverse("002", "2026-01");
    assert.deepEqual(await h.offset("002", "2026-01"), [0, 90000, 0], "Ocak yeniden 900");
    assert.deepEqual(await h.offset("002", "2026-02"), [0, 20000, 0], "Şubat yeniden 200");
    const fixed = await h.report("002", { from: "2026-01-01", to: "2026-02-28" }, "002 onarım");
    assert.deepEqual(fixed.three, [0, 110000, 0], "onarımdan sonra aynı toplam");
    assert.ok(!(CHANGED in fixed.summary), "not kalkar");
    await integrityOk(h.api, "002 onarım");
  });
});

describe("2.5.1 M1 küçük tur 2 — KDV Özeti karma ay: devreden yönde, yön dönmesi ve yıl dönümü", () => {
  let h;
  before(async () => {
    h = await program("2027-02-05T12:00:00+03:00", "KD");
    // 001 — devreden yönde: Mart alış KDV 600 + 400, satış KDV 200 → Mart fişi sonraki döneme devreden 800; sonra 400'lük alış İptal Et + Mart satış KDV 100;
    // Nisan satış KDV 1.000 → Nisan fişi (defterdeki 800 devredenle, S4 −400): 1.000 + 400 − 800 = 600.
    await h.buy("001", "2026-03-05", 3000);
    const b400 = await h.buy("001", "2026-03-06", 2000);
    await h.sell("001", "2026-03-10", 1000);
    assert.deepEqual(await h.offset("001", "2026-03"), [0, 0, 80000], "Mart fişi devreden 800");
    await h.cancel("001", b400);
    await h.sell("001", "2026-03-20", 500);
    await h.sell("001", "2026-04-10", 5000);
    assert.deepEqual(await h.offset("001", "2026-04"), [80000, 60000, 0], "Nisan fişi 600 (defterin 800 devredeniyle)");
    // 002 — yön dönmesi + yıl dönümü: Aralık 2026 satış KDV 800 + 200, alış 500 → fiş ödenecek 500; sonra 800'lük satış ve alış İptal Et; Ocak 2027 satış KDV 200 (mahsupsuz).
    const s800 = await h.sell("002", "2026-12-05", 4000);
    await h.sell("002", "2026-12-06", 1000);
    const b500 = await h.buy("002", "2026-12-10", 2500);
    assert.deepEqual(await h.offset("002", "2026-12"), [0, 50000, 0], "Aralık fişi 500");
    await h.cancel("002", s800);
    await h.cancel("002", b500);
    await h.sell("002", "2027-01-10", 1000);
    await integrityOk(h.api, "veri girildi");
  });
  after(() => h?.ctx.server.close());

  it("001 devreden yönde karma: Mart 300 − 1.000 → sonraki 700 (taban 300); Nisan zincirde 700 devredenle 700 + 'Zincirle Uyuşmayan' (fiş 800'le); Mart–Nisan 700 = 391 − 191; onarımda aynı", async () => {
    const mar = await h.report("001", monthRange("2026-03"), "001 Mart");
    assert.deepEqual(mar.three, [0, 0, 70000], `Mart: 391 bugünkü 300, İ fişten 1.000 → devreden 700 ${JSON.stringify(mar.data.summary)}`);
    assert.equal(mar.summary[CHANGED], `Mart 2026 ${MIXED_TEXT}`, "Mart karma notu");
    const apr = await h.report("001", monthRange("2026-04"), "001 Nisan");
    assert.deepEqual(apr.three, [70000, 70000, 0], `Nisan: 1.000 + 400 (S4) − 700 = 700 (taban: 800 / 600) ${JSON.stringify(apr.data.summary)}`);
    assert.equal(apr.summary[MISMATCH], `Nisan 2026 fişi 800,00 TL devredenle kesilmiş, sırayla mahsupta 700,00 TL olmalıydı${mismatchTail("Mart 2026")}`, "Nisan uyuşmazlık notu");
    const both = await h.report("001", { from: "2026-03-01", to: "2026-04-30" }, "001 Mart–Nisan");
    assert.deepEqual(both.three, [0, 70000, 0], `Mart–Nisan 700 (taban 600) ${JSON.stringify(both.data.summary)}`);
    assert.deepEqual([both.h391, both.h191], [130000, 60000], "391 1.300, 191 600");
    balanced(both, "001 Mart–Nisan");
    assert.deepEqual(both.lines, [["Mart 2026", "Sonraki Döneme Devreden KDV", 70000], ["Nisan 2026", "Önceki Dönemden Devreden KDV", 70000], ["Nisan 2026", "Ödenecek KDV", 70000]], "ay satırları");
    assert.deepEqual(await h.preview("001", "2026-03"), [0, 0, 30000], "Mart ön izlemesi bugünkü kayıtlardan (DEĞİŞMEDİ)");
    assert.deepEqual(await h.preview("001", "2026-04"), [80000, 60000, 0], "Nisan ön izlemesi defterin devredeniyle (DEĞİŞMEDİ)");
    await h.sameFiles("001", { from: "2026-03-01", to: "2026-04-30" }, "001 Mart–Nisan");
    // Onarım: Nisan ve Mart geri alınır, sırayla yeniden mahsup → Mart devreden 300, Nisan 1.000 − 300 = 700 (toplam = raporun söylediği 700); notlar kalkar.
    await h.reverse("001", "2026-04");
    await h.reverse("001", "2026-03");
    assert.deepEqual(await h.offset("001", "2026-03"), [0, 0, 30000], "Mart yeniden devreden 300");
    assert.deepEqual(await h.offset("001", "2026-04"), [30000, 70000, 0], "Nisan yeniden 700");
    const fixed = await h.report("001", { from: "2026-03-01", to: "2026-04-30" }, "001 onarım");
    assert.deepEqual(fixed.three, [0, 70000, 0], "onarımdan sonra aynı toplam");
    assert.ok(!(CHANGED in fixed.summary) && !(MISMATCH in fixed.summary), "notlar kalkar");
    await integrityOk(h.api, "001 onarım");
  });

  it("002 yön dönmesi + yıl dönümü: Aralık 200 − 500 → sonraki 300 (taban: ödenecek 200); Ocak 2027 mahsupsuz 300 devredenle 400; Aralık–Ocak 400 = 391; Bu Yıl önceki 300; Ocak fişi sonra kesilirse uyuşmazlık; onarım", async () => {
    const dec = await h.report("002", monthRange("2026-12"), "002 Aralık");
    assert.deepEqual(dec.three, [0, 0, 30000], `Aralık: 391 bugünkü 200, İ fişten 500 → devreden 300 ${JSON.stringify(dec.data.summary)}`);
    assert.equal(dec.summary[CHANGED], `Aralık 2026 ${MIXED_TEXT}`, "Aralık karma notu");
    const jan = await h.report("002", monthRange("2027-01"), "002 Ocak 2027");
    assert.deepEqual(jan.three, [30000, 40000, 0], `Ocak 2027: 200 + 500 (S4) − 300 = 400 (taban: 0 / 700) ${JSON.stringify(jan.data.summary)}`);
    assert.ok(!(PENDING in jan.summary), "Ocak 2027: önceki ay mahsuplu — 'Mahsup Edilmemiş Ay' yok");
    const cross = await h.report("002", { from: "2026-12-01", to: "2027-01-31" }, "002 Aralık–Ocak");
    assert.deepEqual(cross.three, [0, 40000, 0], `Aralık–Ocak 400 (taban 900) ${JSON.stringify(cross.data.summary)}`);
    assert.deepEqual([cross.h391, cross.h191], [40000, 0], "391 400 − 191 0");
    assert.deepEqual((await h.report("002", { preset: "thisYear" }, "002 Bu Yıl")).three, [30000, 40000, 0], "Bu Yıl (2027): önceki 300, ödenecek 400");
    assert.deepEqual((await h.report("002", { from: "2026-01-01", to: "2026-12-31" }, "002 2026")).three, [0, 0, 30000], "2026 yılı: sonraki döneme devreden 300 (azalma 2027 Ocak'ta düşülür)");
    await h.sameFiles("002", { from: "2026-12-01", to: "2027-01-31" }, "002 Aralık–Ocak");
    // Ocak 2027 fişi ön izlemeyle (defterin devredeni 0) kesilir → 700; rapor zinciri gösterir (400) + uyuşmazlık notu; toplam aynı.
    assert.deepEqual(await h.preview("002", "2027-01"), [0, 70000, 0], "Ocak 2027 ön izlemesi (DEĞİŞMEDİ)");
    assert.deepEqual(await h.offset("002", "2027-01"), [0, 70000, 0], "Ocak 2027 fişi 700");
    const after1 = await h.report("002", { from: "2026-12-01", to: "2027-01-31" }, "002 Ocak fişli");
    assert.deepEqual(after1.three, [0, 40000, 0], "Ocak fişinden sonra da 400");
    assert.equal(after1.summary[MISMATCH], `Ocak 2027 fişi 0,00 TL devredenle kesilmiş, sırayla mahsupta 300,00 TL olmalıydı${mismatchTail("Aralık 2026")}`, "Ocak 2027 uyuşmazlık notu");
    // Onarım: Ocak ve Aralık geri alınır, sırayla → 200 / 200 (toplam 400).
    await h.reverse("002", "2027-01");
    await h.reverse("002", "2026-12");
    assert.deepEqual(await h.offset("002", "2026-12"), [0, 20000, 0], "Aralık yeniden 200");
    assert.deepEqual(await h.offset("002", "2027-01"), [0, 20000, 0], "Ocak 2027 yeniden 200");
    const fixed = await h.report("002", { from: "2026-12-01", to: "2027-01-31" }, "002 onarım");
    assert.deepEqual(fixed.three, [0, 40000, 0], "onarımdan sonra aynı toplam");
    assert.ok(!(CHANGED in fixed.summary) && !(MISMATCH in fixed.summary), "notlar kalkar");
    await integrityOk(h.api, "002 onarım");
  });
});

// Tutarlılık tablosu: aynı başlangıç (Ocak satış KDV 1.000, alış KDV 300 + 200 → Ocak fişi 500), Ocak'ta fişten SONRA tek değişiklik grubu, Şubat satış KDV 200 + mahsup.
// Beklenen (ELLE): Ocak sonucu, notu, Şubat fişi, Ocak–Şubat Ödenecek (= 391 − 191) ve onarımdan (geri al + sırayla yeniden mahsup) sonraki fiş toplamı (= rapor).
const TABLE = [
  { name: "hiçbiri", change: async () => {}, jan: 50000, note: null, feb: 20000, total: 70000, h391: 120000, h191: 50000, redo: [50000, 20000] },
  { name: "yalnız İ azaldı (S-DKM1-1 = A)", change: async (h, tag, ids) => h.cancel(tag, ids.b200), jan: 50000, note: REDUCED_TEXT, feb: 40000, total: 90000, h391: 120000, h191: 30000, redo: [70000, 20000] },
  { name: "yalnız 391 değişti (S-M1-3 = C)", change: async (h, tag) => h.sell(tag, "2026-01-20", 500), jan: 60000, note: STALE_TEXT, feb: 20000, total: 80000, h391: 130000, h191: 50000, redo: [60000, 20000] },
  {
    name: "ikisi birden (S-M1K-1 = A)",
    change: async (h, tag, ids) => {
      await h.cancel(tag, ids.b200);
      await h.sell(tag, "2026-01-20", 500);
    },
    jan: 60000,
    note: MIXED_TEXT,
    feb: 40000,
    total: 100000,
    h391: 130000,
    h191: 30000,
    redo: [80000, 20000],
  },
  {
    name: "İ arttı + 391 değişti (S-M1-3 = C)",
    change: async (h, tag) => {
      await h.buy(tag, "2026-01-20", 500);
      await h.sell(tag, "2026-01-21", 500);
    },
    jan: 50000,
    note: STALE_TEXT,
    feb: 20000,
    total: 70000,
    h391: 130000,
    h191: 60000,
    redo: [50000, 20000],
  },
];

describe("2.5.1 M1 küçük tur 2 — KDV Özeti tutarlılık tablosu: yalnız azalma / yalnız 391 / ikisi birden / hiçbiri / İ arttı (her biri ayrı şirkette)", () => {
  const pairs = [TABLE.slice(0, 2), TABLE.slice(2, 4), TABLE.slice(4)];
  for (const pair of pairs) {
    describe(pair.map(row => row.name).join(" + "), () => {
      let h;
      before(async () => {
        h = await program("2026-04-05T12:00:00+03:00", "KT");
        for (const [index, row] of pair.entries()) {
          const tag = index ? "002" : "001";
          await h.sell(tag, "2026-01-05", 5000);
          await h.buy(tag, "2026-01-10", 1500);
          const ids = { b200: await h.buy(tag, "2026-01-11", 1000) };
          assert.deepEqual(await h.offset(tag, "2026-01"), [0, 50000, 0], `${row.name}: Ocak fişi 500`);
          await row.change(h, tag, ids);
          await h.sell(tag, "2026-02-10", 1000);
          assert.deepEqual(await h.offset(tag, "2026-02"), [0, row.feb, 0], `${row.name}: Şubat fişi`);
        }
        await integrityOk(h.api, "veri girildi");
      });
      after(() => h?.ctx.server.close());
      for (const [index, row] of pair.entries()) {
        const tag = index ? "002" : "001";
        it(`${tag} ${row.name}: Ocak ${row.jan / 100}, Ocak–Şubat ${row.total / 100} = 391 − 191; not; onarımda fişler ${row.redo.map(v => v / 100).join(" / ")} (toplam = rapor)`, async () => {
          const jan = await h.report(tag, monthRange("2026-01"), `${row.name} Ocak`);
          assert.deepEqual(jan.three, [0, row.jan, 0], `${row.name}: Ocak ${JSON.stringify(jan.data.summary)}`);
          if (row.note) assert.equal(jan.summary[CHANGED], `Ocak 2026 ${row.note}`, `${row.name}: Ocak notu`);
          else assert.ok(!(CHANGED in jan.summary), `${row.name}: Ocak notsuz ${JSON.stringify(jan.data.summary)}`);
          const both = await h.report(tag, { from: "2026-01-01", to: "2026-02-28" }, `${row.name} Ocak–Şubat`);
          assert.deepEqual(both.three, [0, row.total, 0], `${row.name}: Ocak–Şubat ${JSON.stringify(both.data.summary)}`);
          assert.deepEqual([both.h391, both.h191], [row.h391, row.h191], `${row.name}: 391 / 191`);
          balanced(both, row.name);
          assert.deepEqual(both.lines.map(line => line[2]), [row.jan, row.feb], `${row.name}: ay satırları`);
          assert.ok(!(MISMATCH in both.summary) && !(PENDING in both.summary), `${row.name}: zincir kopuk değil`);
          await h.reverse(tag, "2026-02");
          await h.reverse(tag, "2026-01");
          const redo = [(await h.offset(tag, "2026-01"))[1], (await h.offset(tag, "2026-02"))[1]];
          assert.deepEqual(redo, row.redo, `${row.name}: onarımda kesilen fişler`);
          assert.equal(redo[0] + redo[1], row.total, `${row.name}: onarımın fiş toplamı = raporun Ocak–Şubat'ı`);
          const fixed = await h.report(tag, { from: "2026-01-01", to: "2026-02-28" }, `${row.name} onarım`);
          assert.deepEqual(fixed.three, [0, row.total, 0], `${row.name}: onarımdan sonra aynı`);
          assert.ok(!(CHANGED in fixed.summary), `${row.name}: onarımdan sonra not yok`);
        });
      }
    });
  }
});
