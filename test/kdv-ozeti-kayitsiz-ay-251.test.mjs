// 2.5.1 M1 küçük tur 8 — KDV Özeti: mahsuptan sonra azalan İndirilecek KDV'nin düşüldüğü KAYITSIZ ay (mali müşavir S ORTA-1; BAŞ MİMAR KARARI 28.11 14:27 UTC — S-DKM1-1 = A
//   "azalma yalnız sonraki ayda görünür", S-M1K3-1 = A "aralık toplamı her durumda 391 − 191"; aynı sınıf: dar kontrol tur 6 + 7 DOĞRULANMADI (fişsiz hareketsiz ay, tohum 86) ve
//   27.11 B maddesi (hareketsiz sonraki ay tek başına)).
//   Önce: zincir yalnız KDV'li ayları dolaşıyordu; sonraki aylar azalmadan ÖNCE mahsup edilmişse azalma hiçbir ayda düşülmüyordu — Bu Yıl Ödenecek 1.500 (391 − 191 = 2.000);
//   kayıtsız Temmuz'un raporu 0 / 0 / 0, ön izlemesi (defterin yazacağı) 0 / 500 / 0; Temmuz'a satış KDV 100 → rapor 600 ve açıklayan satır / not yok.
//   Sonra: zincir ilk KDV ayından bugünkü aya kadar kayıtsız ayları da dolaşır (S4 birikimi varsa adım); azalışın düşüldüğü ayda "Önceki Dönem İndirilecek KDV Azalışı (Şubat 2026)"
//   satırı (çok aylı tabloda ayın satırı; azalış aralığın başından önceki aydan geliyorsa özette tutar satırı) ve "İndirilecek KDV Azalışı Düşülen Ay" notu.
//   KÂHİN (elle; ana oturumun yeniden üretimi ms251rk/orta1.mjs AYNEN ve mali müşavir S raporunun sayıları — programın kodundan türetilmedi, ders 5). KDV %20. Sahte saat (ders 13).
//   Mahsup fişi, ön izleme ve defter DEĞİŞMEZ (sayılar elle; tabanla birebirlik ayrıca betikle — docs/kanit/2026-11-28/m1k8-*).
//   Taban (t251-aday-taban) kodunda beklenen kırmızı: Bu Yıl Ödenecek 1.500 (2.000 olmalı), kayıtsız ay 0 / 0 / 0 (ön izleme 0 / 500 / 0), satır / not yok.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { trialBalances } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const INV = "/api/workspace/invoices";
const TAX = "/api/workspace/tax";
const LABELS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"];
const R = "Önceki Dönem İndirilecek KDV Azalışı";
const NOTE = "İndirilecek KDV Azalışı Düşülen Ay";
const PENDING = "Mahsup Edilmemiş Ay";
const CHANGED = "Mahsuptan Sonra Değişen Ay";
const STALE_BEFORE = "Güncel Olmayan Önceki Fiş";
const NOTE_TAIL_ONE = "(önceki ayların mahsubundan sonra girilen, İndirilecek KDV'yi azaltan kayıtlar bu ayın İndirilecek KDV'sinden düşüldü; ödenecek ya da devreden KDV bununla hesaplandı)";
const minor = text => {
  const raw = String(text ?? "").trim();
  if (!/TL$/.test(raw)) return null;
  const sign = /^[-−]/.test(raw) ? -1 : 1;
  return sign * Number(raw.replace(/[^\d,]/g, "").replace(",", ""));
};
const monthEnd = month => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const monthRange = month => ({ from: `${month}-01`, to: monthEnd(month) });
const amp = (url, q) => (q ? `${url}${url.includes("?") ? "&" : "?"}${q}` : url);

/** Program (iki şirket — ders 17); sayılar yanıt gövdesinden / veri tabanından (ders 3). */
async function program(now, prefix) {
  const ctx = await boot({ now, maxCompanies: 2 });
  const api = ctx.api;
  const created = await must("002", api.post("/api/companies", { name: `${prefix} İkinci`, select: false }));
  const q = { "001": "", "002": `hofCompany=${encodeURIComponent((created.company || created).id)}` };
  const ids = {};
  for (const tag of ["001", "002"]) {
    ids[`M${tag}`] = (await must("müşteri", api.post(amp("/api/workspace/accounts", q[tag]), { name: `${prefix} Müşteri ${tag}`, type: "customer", registeredOn: "2025-01-01" }))).id;
    ids[`T${tag}`] = (await must("tedarikçi", api.post(amp("/api/workspace/accounts", q[tag]), { name: `${prefix} Tedarikçi ${tag}`, type: "supplier", registeredOn: "2025-01-01" }))).id;
  }
  let n = 0;
  const h = {
    ctx,
    api,
    buy: async (tag, date, net) => (await must(`alış ${tag} ${date}`, api.post(amp(INV, q[tag]), { kind: "purchase", scenario: "expense_purchase", accountId: ids[`T${tag}`], issueDate: date, number: `${prefix}-${tag}-A${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id,
    sell: async (tag, date, net) => (await must(`satış ${tag} ${date}`, api.post(amp(INV, q[tag]), { scenario: "service_sale", accountId: ids[`M${tag}`], issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }))).id,
    cancel: async (tag, id) => must("İptal Et", api.post(amp(`${INV}/${id}/cancel`, q[tag]), { reason: "Hatalı fatura", force: true })),
    /** Mahsup fişi (veri tabanına yazılan sayılar) ya da ret. */
    offset: async (tag, month) => {
      const r = await api.post(amp(`${TAX}/vat-offset`, q[tag]), { month });
      return r.status === 200 ? [r.data.offset.carryInMinor, r.data.offset.payableMinor, r.data.offset.carryOutMinor] : `RED ${r.status}`;
    },
    preview: async (tag, month) => {
      const p = (await must("ön izleme", api.get(amp(`${TAX}/vat-offset?month=${month}`, q[tag])))).preview;
      return [p.carryInMinor, p.payableMinor, p.carryOutMinor];
    },
    report: async (tag, query, label = JSON.stringify(query)) => {
      const res = await api.get(amp(`${RC}/kdv-ozeti?${new URLSearchParams(query).toString()}`, q[tag]));
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      const data = res.data;
      const summary = Object.fromEntries(data.summary);
      const g = data.headers.indexOf("Belge Türü");
      const k = data.headers.indexOf("KDV");
      const lines = data.rows.filter(row => LABELS.includes(row[g]) || String(row[g]).startsWith(R)).map(row => [row[0], row[g], minor(row[k])]);
      const reduction = Object.entries(summary).filter(([key]) => key.startsWith(R));
      return { data, summary, lines, reduction, three: LABELS.map(name => minor(summary[name])), h391: minor(summary["Hesaplanan KDV (391) (İadeler Düşülmüş)"]), h191: minor(summary["İndirilecek KDV (191) (İadeler Düşülmüş)"]) };
    },
    /** Ekran = PDF = Excel (anayasa): satırlar, tablo altı ve özetin her tutarı / notu PDF'te ve Excel'de. */
    sameFiles: async (tag, query, label) => {
      const res = await api.get(amp(`${RC}/kdv-ozeti?${new URLSearchParams(query).toString()}`, q[tag]));
      const data = res.data;
      const pdf = await api.raw("GET", amp(`${RC}/kdv-ozeti/pdf?${new URLSearchParams(query).toString()}`, q[tag]));
      assert.equal(pdf.status, 200, `${label} PDF`);
      const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
      for (const row of [...data.rows, ...(data.rows.length ? data.footers : [])]) for (const cell of row) if (String(cell).trim()) assert.ok(text.includes(String(cell).trim()), `${label} PDF hücresi: "${cell}"`);
      for (const [key, value] of data.summary) {
        assert.ok(text.includes(String(key).trim()), `${label} PDF özet adı: "${key}"`);
        if (minor(value) !== null) assert.ok(text.includes(String(value).trim()), `${label} PDF özet ${key}: "${value}"`);
      }
      const xlsx = await api.raw("GET", amp(`${RC}/kdv-ozeti/xlsx?${new URLSearchParams(query).toString()}`, q[tag]));
      assert.equal(xlsx.status, 200, `${label} Excel`);
      const sheets = Object.values(xlsxSheets(xlsx.buffer));
      const flat = sheets.flat().map(row => row.map(cell => String(cell ?? "").trim()));
      for (const row of data.rows) {
        const want = row.map(cell => String(cell).trim());
        assert.ok(
          flat.some(got => want.every((cell, c) => !cell || /^%\d+$/.test(cell) || got[c] === cell || (minor(cell) !== null && Math.round(Number(got[c]) * 100) === minor(cell)))),
          `${label} Excel satırı: ${JSON.stringify(row)}`,
        );
      }
      for (const [key, value] of data.summary) {
        const row = flat.find(item => item[0] === key);
        assert.ok(row, `${label} Excel özet satırı ${key}`);
        if (minor(value) !== null) assert.equal(Math.round(Number(row[1]) * 100), minor(value), `${label} Excel özet ${key}`);
      }
    },
    ledger: async (tag, to) => trialBalances(api, `?to=${to}${q[tag] ? `&${q[tag]}` : ""}`),
    close: () => ctx.server.close(),
  };
  return h;
}

/** Aralığın dengesi: Ödenecek − Sonraki + Önceki = 391 − 191 + aralıktan önceki aylardan gelip aralıkta düşülen azalış (özetteki satır). */
function balanced(r, label, reduction = 0) {
  const [carryIn, payable, carryOut] = r.three;
  assert.equal(payable - carryOut + carryIn, r.h391 - r.h191 + reduction, `${label}: Ödenecek ${payable} − Sonraki ${carryOut} + Önceki ${carryIn} = 391 ${r.h391} − 191 ${r.h191} + azalış ${reduction}`);
}

describe("2.5.1 M1 küçük tur 8 — ORTA-1 AYNEN (ana oturumun orta1 vakası; bugün 03.08.2026) + fişsiz hareketsiz ay (dar kontrol tohum 86 sınıfı, 002)", () => {
  let h;
  const fis = {};
  const ids = {};
  before(async () => {
    h = await program("2026-08-03T12:00:00+03:00", "K8");
    // 001: ana oturumun orta1.mjs'i AYNEN.
    await h.buy("001", "2026-01-10", 5000);
    await h.sell("001", "2026-02-10", 10000);
    ids.sb = await h.buy("001", "2026-02-12", 2500);
    await h.sell("001", "2026-03-10", 2000);
    await h.buy("001", "2026-03-12", 4000);
    await h.sell("001", "2026-04-10", 5000);
    await h.sell("001", "2026-05-10", 1500);
    await h.sell("001", "2026-06-10", 1000);
    await h.buy("001", "2026-06-12", 500);
    for (const m of ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]) fis[m] = await h.offset("001", m);
    // 002: Ocak satış KDV 2.000, alış 1.000 → fiş 1.000; Şubat satış 1.000, alış 300 → fiş 700; Mart HAREKETSİZ (mahsubu reddedilir); Nisan satış 500 (fişsiz).
    await h.sell("002", "2026-01-05", 10000);
    await h.buy("002", "2026-01-10", 5000);
    fis.o2 = await h.offset("002", "2026-01");
    await h.sell("002", "2026-02-05", 5000);
    ids.s2 = await h.buy("002", "2026-02-10", 1500);
    fis.s2 = await h.offset("002", "2026-02");
    fis.m2 = await h.offset("002", "2026-03");
    await h.sell("002", "2026-04-05", 2500);
  });
  after(() => h?.close());

  it("001 fişler (veri tabanı) ve iptalden önce Bu Yıl 1.500 = 391 3.900 − 191 2.400 (satır / not yok)", async () => {
    assert.deepEqual(fis["2026-01"], [0, 0, 100000], "Ocak fişi devreden 1.000");
    assert.deepEqual(fis["2026-02"], [100000, 50000, 0], "Şubat fişi ödenecek 500");
    assert.deepEqual(fis["2026-03"], [0, 0, 40000], "Mart fişi devreden 400");
    assert.deepEqual(fis["2026-04"], [40000, 60000, 0], "Nisan fişi ödenecek 600");
    assert.deepEqual(fis["2026-05"], [0, 30000, 0], "Mayıs fişi 300");
    assert.deepEqual(fis["2026-06"], [0, 10000, 0], "Haziran fişi 100");
    const year = await h.report("001", { preset: "thisYear" }, "Bu Yıl (iptalden önce)");
    assert.deepEqual([year.h391, year.h191, ...year.three], [390000, 240000, 0, 150000, 0], `Bu Yıl ${JSON.stringify(year.data.summary)}`);
    assert.ok(!(NOTE in year.summary) && !year.reduction.length && !year.lines.some(line => line[1].startsWith(R)), "azalış yok → satır / not yok");
    assert.deepEqual(await h.preview("001", "2026-07"), [0, 0, 0], "Temmuz ön izlemesi (azalış yok) 0 / 0 / 0");
    const jul = await h.report("001", monthRange("2026-07"), "Temmuz (iptalden önce)");
    assert.deepEqual(jul.three, [0, 0, 0], "Temmuz kayıtsız 0 / 0 / 0 = ön izleme");
    assert.ok(!(PENDING in jul.summary) && !(NOTE in jul.summary), `azalış yokken kayıtsız ay zincire girmez — not yok ${JSON.stringify(jul.data.summary)}`);
  });

  it("001 Şubat alışı İptal Et: Bu Yıl Ödenecek 2.000 = 391 3.900 − 191 1.900 (taban 1.500 — 500 KAYIP); Temmuz satırı 'Önceki Dönem İndirilecek KDV Azalışı (Şubat 2026)' 500 + not", async () => {
    await h.cancel("001", ids.sb);
    const year = await h.report("001", { preset: "thisYear" }, "Bu Yıl");
    assert.deepEqual([year.h391, year.h191], [390000, 190000], "391 3.900, 191 1.900 (bugünkü kayıtlar)");
    assert.deepEqual(year.three, [0, 200000, 0], `Bu Yıl Ödenecek 2.000 (taban 1.500) ${JSON.stringify(year.data.summary)}`);
    balanced(year, "Bu Yıl");
    assert.deepEqual(year.lines.filter(line => line[0] === "Temmuz 2026"), [["Temmuz 2026", `${R} (Şubat 2026)`, 50000], ["Temmuz 2026", "Ödenecek KDV", 50000]], "Temmuz (kayıtsız) ay satırları: azalış 500 → Ödenecek 500");
    assert.equal(year.summary[NOTE], `Temmuz 2026: 500,00 TL (Şubat 2026) ${NOTE_TAIL_ONE}`, "azalış notu");
    assert.ok(!year.reduction.length, "azalış aralığın içindeki aydan (Şubat) — özette ayrıca tutar satırı yok (191 toplamında zaten var)");
    assert.ok(String(year.summary[CHANGED]).startsWith("Şubat 2026 (bu ayın kayıtları fişten sonra değişti"), "Şubat azalan ay notu durur");
    assert.ok(!(PENDING in year.summary), "Temmuz aralığın son sonuç ayı — Mahsup Edilmemiş Ay notu yok");
    await h.sameFiles("001", { preset: "thisYear" }, "Bu Yıl");
    const all = await h.report("001", { preset: "all" }, "Tüm Zamanlar");
    assert.deepEqual(all.three, [0, 200000, 0], "Tüm Zamanlar 2.000");
    balanced(all, "Tüm Zamanlar");
    // S-DKM1-1 = A: azalma yalnız sonraki ayda — azalmanın düşüldüğü ayı (Temmuz) içermeyen aralıkta 391 − 191 aranmaz (kararın metni); not 'sonraki mahsupta düşülür' der.
    const h1 = await h.report("001", { from: "2026-01-01", to: "2026-06-30" }, "Ocak–Haziran");
    assert.deepEqual(h1.three, [0, 150000, 0], "Ocak–Haziran 1.500 (Şubat fişten; azalma Temmuz'da)");
    assert.ok(!(NOTE in h1.summary), "Ocak–Haziran'da azalış düşülen ay yok");
  });

  it("001 Temmuz kayıtsız: rapor 0 / 500 / 0 = ön izleme (taban rapor 0 / 0 / 0); özet satırı 500; Geçen Ay / Son 30 Gün / aralık sonu bugünden sonra; Ağustos (Bu Ay) Mahsup Edilmemiş Ay notuyla", async () => {
    const preview = await h.preview("001", "2026-07");
    assert.deepEqual(preview, [0, 50000, 0], "Temmuz ön izlemesi 0 / 500 / 0 (DEĞİŞMEDİ — defter 500 yazacak)");
    const jul = await h.report("001", monthRange("2026-07"), "Temmuz");
    assert.deepEqual(jul.three, preview, `Temmuz raporu = ön izleme (taban 0 / 0 / 0) ${JSON.stringify(jul.data.summary)}`);
    assert.deepEqual(jul.reduction, [[`${R} (Şubat 2026)`, "500,00 TL"]], "özet satırı: Şubat'tan gelen azalış 500");
    assert.equal(jul.summary[NOTE], `Temmuz 2026: 500,00 TL (Şubat 2026) ${NOTE_TAIL_ONE}`, "Temmuz notu");
    balanced(jul, "Temmuz", 50000);
    await h.sameFiles("001", monthRange("2026-07"), "Temmuz");
    const last = await h.report("001", { preset: "lastMonth" }, "Geçen Ay");
    assert.deepEqual([...last.three, last.summary[`${R} (Şubat 2026)`]], [0, 50000, 0, "500,00 TL"], "Geçen Ay = Temmuz");
    const d30 = await h.report("001", { preset: "last30" }, "Son 30 Gün");
    assert.deepEqual(d30.three, [0, 50000, 0], `Son 30 Gün (Temmuz–Ağustos, ay ortası) 500 ${JSON.stringify(d30.data.summary)}`);
    const future = await h.report("001", { from: "2026-07-01", to: "2026-12-31" }, "Temmuz–Aralık (sonu bugünden sonra)");
    assert.deepEqual(future.three, [0, 50000, 0], "Temmuz–Aralık: gelecek aylar zincire girmez, Temmuz 500");
    balanced(future, "Temmuz–Aralık", 50000);
    const aug = await h.report("001", { preset: "thisMonth" }, "Bu Ay (Ağustos)");
    assert.deepEqual(aug.three, [0, 0, 0], "Ağustos: azalış Temmuz'da düşüldü (zincir)");
    assert.ok(String(aug.summary[PENDING] || "").startsWith("Temmuz 2026 ("), `Ağustos ön izlemeden (500) ayrılır — Mahsup Edilmemiş Ay: Temmuz (${aug.summary[PENDING]})`);
    assert.deepEqual(await h.preview("001", "2026-08"), [0, 50000, 0], "Ağustos ön izlemesi (DEĞİŞMEDİ: Temmuz mahsup edilmediği için azalışı o da gösterir)");
  });

  it("001 Temmuz'a satış KDV 100: rapor 600 = ön izleme, satır + not açıklar (100 + 500); Bu Yıl 2.100 = 391 − 191; Temmuz mahsubu = rapor, sonra Ağustos = ön izleme; defter", async () => {
    await h.sell("001", "2026-07-10", 500);
    assert.deepEqual(await h.preview("001", "2026-07"), [0, 60000, 0], "ön izleme 600 (DEĞİŞMEDİ)");
    const jul = await h.report("001", monthRange("2026-07"), "Temmuz (satış 100)");
    assert.deepEqual([jul.h391, jul.h191, ...jul.three], [10000, 0, 0, 60000, 0], "Temmuz 391 100, Ödenecek 600");
    assert.deepEqual(jul.reduction, [[`${R} (Şubat 2026)`, "500,00 TL"]], "açıklayan özet satırı (taban: yok)");
    balanced(jul, "Temmuz (satış 100)", 50000);
    const year = await h.report("001", { preset: "thisYear" }, "Bu Yıl (Temmuz satışlı)");
    assert.deepEqual([year.h391, year.h191, ...year.three], [400000, 190000, 0, 210000, 0], "Bu Yıl 2.100");
    balanced(year, "Bu Yıl (Temmuz satışlı)");
    assert.deepEqual(await h.offset("001", "2026-07"), [0, 60000, 0], "Temmuz fişi (veri tabanı) 600 = rapor");
    const after = await h.report("001", monthRange("2026-07"), "Temmuz (fişli)");
    assert.deepEqual(after.three, [0, 60000, 0], "fişli Temmuz = fiş");
    assert.deepEqual(after.reduction, [[`${R} (Şubat 2026)`, "500,00 TL"]], "fişli ayda da azalış satırı (fiş azalışı düştü)");
    const aug = await h.report("001", { preset: "thisMonth" }, "Ağustos (Temmuz fişli)");
    assert.deepEqual(aug.three, await h.preview("001", "2026-08"), "Ağustos raporu = ön izleme (0 / 0 / 0)");
    assert.ok(!(PENDING in aug.summary) && !(NOTE in aug.summary), "not yok");
    const gl = await h.ledger("001", "2026-07-31");
    assert.equal(Math.abs(Math.round((gl["360"] ?? 0) * 100)), 50000 + 60000 + 30000 + 10000 + 60000, "defter 360 = fişlerin ödeneceği 2.100 (Şubat 500 + Nisan 600 + Mayıs 300 + Haziran 100 + Temmuz 600)");
    assert.equal(Math.round((gl["190"] ?? 0) * 100), 0, "defter 190 = 0");
  });

  it("002 fişsiz hareketsiz Mart (tohum 86 sınıfı): azalıştan önce zincire girmez; Şubat alışı İptal Et → Mart raporu 0 / 300 / 0 = ön izleme (taban 0 / 0 / 0) + satır; Nisan notla", async () => {
    assert.deepEqual([fis.o2, fis.s2], [[0, 100000, 0], [0, 70000, 0]], "002 fişler");
    assert.equal(fis.m2, "RED 409", "hareketsiz Mart mahsup edilemez (KDV hareketi yok)");
    const before = await h.report("002", monthRange("2026-03"), "002 Mart (iptalden önce)");
    assert.deepEqual(before.three, [0, 0, 0], "Mart 0 / 0 / 0");
    const nisan0 = await h.report("002", monthRange("2026-04"), "002 Nisan (iptalden önce)");
    assert.deepEqual(nisan0.three, [0, 50000, 0], "Nisan 500");
    assert.ok(!(PENDING in nisan0.summary), `hareketsiz Mart 'Mahsup Edilmemiş Ay' sayılmaz ${JSON.stringify(nisan0.data.summary)}`);
    await h.cancel("002", ids.s2);
    const preview = await h.preview("002", "2026-03");
    assert.deepEqual(preview, [0, 30000, 0], "Mart ön izlemesi 0 / 300 / 0 (DEĞİŞMEDİ)");
    const mar = await h.report("002", monthRange("2026-03"), "002 Mart");
    assert.deepEqual(mar.three, preview, `Mart raporu = ön izleme (taban 0 / 0 / 0) ${JSON.stringify(mar.data.summary)}`);
    assert.deepEqual(mar.reduction, [[`${R} (Şubat 2026)`, "300,00 TL"]], "Mart özet satırı");
    balanced(mar, "002 Mart", 30000);
    const nisan = await h.report("002", monthRange("2026-04"), "002 Nisan");
    assert.deepEqual(nisan.three, [0, 50000, 0], "Nisan 500 (azalış Mart'ta düşüldü)");
    assert.deepEqual(await h.preview("002", "2026-04"), [0, 80000, 0], "Nisan ön izlemesi 800 (DEĞİŞMEDİ — Mart mahsupsuz)");
    assert.ok(String(nisan.summary[PENDING] || "").startsWith("Mart 2026 ("), `Nisan ön izlemeden ayrılır — Mahsup Edilmemiş Ay: Mart (${nisan.summary[PENDING]})`);
    const q1 = await h.report("002", { from: "2026-01-01", to: "2026-04-30" }, "002 Ocak–Nisan");
    assert.deepEqual([q1.h391, q1.h191, ...q1.three], [350000, 100000, 0, 250000, 0], "Ocak–Nisan 2.500 = 391 3.500 − 191 1.000");
    assert.deepEqual(
      q1.lines,
      [["Ocak 2026", "Ödenecek KDV", 100000], ["Şubat 2026", "Ödenecek KDV", 70000], ["Mart 2026", `${R} (Şubat 2026)`, 30000], ["Mart 2026", "Ödenecek KDV", 30000], ["Nisan 2026", "Ödenecek KDV", 50000]],
      "ay satırları (kayıtsız Mart satırlı)",
    );
    await h.sameFiles("002", { from: "2026-01-01", to: "2026-04-30" }, "002 Ocak–Nisan");
    assert.deepEqual(await h.offset("002", "2026-03"), [0, 30000, 0], "Mart artık mahsup edilir — fiş 300 = rapor");
    const nisan2 = await h.report("002", monthRange("2026-04"), "002 Nisan (Mart fişli)");
    assert.deepEqual(nisan2.three, await h.preview("002", "2026-04"), "Nisan raporu = ön izleme (500)");
    assert.ok(!(PENDING in nisan2.summary), "not yok");
  });
});

describe("2.5.1 M1 küçük tur 8 — yıl dönümü (Aralık azalışı Ocak'ta), iki azalış ayı, 27.11 B (hareketsiz sonraki ay tek başına)", () => {
  let h;
  const ids = {};
  before(async () => {
    h = await program("2027-02-10T12:00:00+03:00", "K8Y");
    // 001: Kasım 2026 satış KDV 1.000, alış 400 → fiş 600; Aralık satış 600, alış 200 → fiş 400; sonra Aralık alışı İptal Et → Ocak 2027 (kayıtsız) 200.
    await h.sell("001", "2026-11-05", 5000);
    await h.buy("001", "2026-11-10", 2000);
    await h.sell("001", "2026-12-05", 3000);
    ids.d = await h.buy("001", "2026-12-10", 1000);
    // 002: Eylül–Aralık her ay satış KDV 1.000, alış 200 → fişler 800; sonra Ekim ve Kasım alışları İptal Et → Ocak 2027 (kayıtsız) 400.
    for (const m of ["2026-09", "2026-10", "2026-11", "2026-12"]) {
      await h.sell("002", `${m}-05`, 5000);
      ids[`b${m}`] = await h.buy("002", `${m}-10`, 1000);
    }
  });
  after(() => h?.close());

  it("001 yıl dönümü: Ocak 2027 kayıtsız 0 / 200 / 0 = ön izleme, satır '(Aralık 2026)'; Kasım 2026 – Ocak 2027 1.200 = 391 − 191; Şubat 2027 (Bu Ay) Mahsup Edilmemiş Ay notuyla", async () => {
    assert.deepEqual(await h.offset("001", "2026-11"), [0, 60000, 0], "Kasım fişi 600");
    assert.deepEqual(await h.offset("001", "2026-12"), [0, 40000, 0], "Aralık fişi 400");
    await h.cancel("001", ids.d);
    const preview = await h.preview("001", "2027-01");
    assert.deepEqual(preview, [0, 20000, 0], "Ocak 2027 ön izlemesi 200 (DEĞİŞMEDİ)");
    const jan = await h.report("001", monthRange("2027-01"), "Ocak 2027");
    assert.deepEqual(jan.three, preview, `Ocak 2027 raporu = ön izleme (taban 0 / 0 / 0) ${JSON.stringify(jan.data.summary)}`);
    assert.deepEqual(jan.reduction, [[`${R} (Aralık 2026)`, "200,00 TL"]], "yılıyla ay adı");
    const span = await h.report("001", { from: "2026-11-01", to: "2027-01-31" }, "Kasım–Ocak");
    assert.deepEqual([span.h391, span.h191, ...span.three], [160000, 40000, 0, 120000, 0], "Kasım 2026 – Ocak 2027: 1.200 = 391 1.600 − 191 400 (taban 1.000)");
    balanced(span, "Kasım–Ocak");
    assert.deepEqual(span.lines.filter(line => line[0] === "Ocak 2027"), [["Ocak 2027", `${R} (Aralık 2026)`, 20000], ["Ocak 2027", "Ödenecek KDV", 20000]], "Ocak 2027 satırları");
    const feb = await h.report("001", { preset: "thisMonth" }, "Şubat 2027");
    assert.deepEqual(feb.three, [0, 0, 0], "Şubat 2027 0");
    assert.ok(String(feb.summary[PENDING] || "").startsWith("Ocak 2027 ("), `Mahsup Edilmemiş Ay: Ocak 2027 (${feb.summary[PENDING]})`);
    const year26 = await h.report("001", { from: "2026-01-01", to: "2026-12-31" }, "2026");
    assert.deepEqual(year26.three, [0, 100000, 0], "2026 yılı 1.000 (S-DKM1-1 = A: Aralık fişten, azalma 2027 Ocak'ta)");
  });

  it("002 iki azalış ayı (Ekim + Kasım, sonraki fişler önce kesilmiş): Ocak 2027 400, satır '(Ekim 2026, Kasım 2026)'; Eylül–Ocak = 391 − 191; tek ay ve kısmi aralıkta özet satırı yalnız aralıktan önceki azalış", async () => {
    for (const m of ["2026-09", "2026-10", "2026-11", "2026-12"]) assert.deepEqual(await h.offset("002", m), [0, 80000, 0], `${m} fişi 800`);
    await h.cancel("002", ids["b2026-10"]);
    await h.cancel("002", ids["b2026-11"]);
    const jan = await h.report("002", monthRange("2027-01"), "002 Ocak 2027");
    assert.deepEqual(jan.three, await h.preview("002", "2027-01"), "Ocak 2027 raporu = ön izleme");
    assert.deepEqual(jan.three, [0, 40000, 0], "Ocak 2027 400");
    assert.deepEqual(jan.reduction, [[`${R} (Ekim 2026, Kasım 2026)`, "400,00 TL"]], "iki ay birlikte");
    assert.equal(jan.summary[NOTE], `Ocak 2027: 400,00 TL (Ekim 2026, Kasım 2026) ${NOTE_TAIL_ONE}`, "not");
    const span = await h.report("002", { from: "2026-09-01", to: "2027-01-31" }, "Eylül–Ocak");
    assert.deepEqual([span.h391, span.h191, ...span.three], [400000, 40000, 0, 360000, 0], "Eylül–Ocak 3.600 = 391 4.000 − 191 400 (taban 3.200)");
    assert.ok(!span.reduction.length, "iki azalış da aralıkta — özet tutar satırı yok");
    // Kasım–Ocak: Ekim'in azalışı aralıktan ÖNCE (özet satırı 200), Kasım'ınki aralıkta (191'de).
    const part = await h.report("002", { from: "2026-11-01", to: "2027-01-31" }, "Kasım–Ocak");
    assert.deepEqual(part.reduction, [[`${R} (Ekim 2026)`, "200,00 TL"]], "yalnız aralıktan önceki ayın azalışı");
    balanced(part, "Kasım–Ocak", 20000);
  });

  it("27.11 B: 'güncel değil' ayın (İ arttı) bugünkü devredeni hareketsiz sonraki aya — o ay tek başına seçilince rapor ön izlemeden ayrılır VE 'Güncel Olmayan Önceki Fiş' notu çıkar", async () => {
    const c = await program("2026-08-15T12:00:00+03:00", "K8B");
    try {
      await c.buy("001", "2026-05-10", 2000);
      assert.deepEqual(await c.offset("001", "2026-05"), [0, 0, 40000], "Mayıs fişi devreden 400");
      await c.sell("001", "2026-06-10", 1000);
      assert.deepEqual(await c.offset("001", "2026-06"), [40000, 0, 20000], "Haziran fişi devreden 200");
      await c.buy("001", "2026-06-20", 500);
      const jul = await c.report("001", monthRange("2026-07"), "Temmuz");
      assert.deepEqual(jul.three, [30000, 0, 30000], "Temmuz = Haziran'ın bugünkü devredeni 300 (S-M1K3-1 = A)");
      assert.deepEqual(await c.preview("001", "2026-07"), [20000, 0, 20000], "ön izleme defterdeki 200 (DEĞİŞMEDİ)");
      assert.ok(String(jul.summary[STALE_BEFORE] || "").startsWith("Önceki aylarda güncel olmayan mahsup fişi var (Haziran 2026)"), `not var (${jul.summary[STALE_BEFORE]})`);
      assert.ok(!(NOTE in jul.summary) && !jul.reduction.length, "azalış yok — satır / not yok");
      // 002 — devreden yönde azalış düşülen kayıtsız ay, ardından bir kayıtsız ay daha: Mayıs alış KDV 1.000 → fiş devreden 1.000; Haziran alış 200 → fiş devreden 1.200;
      // Haziran alışı İptal Et → Temmuz (kayıtsız) 1.200 devredenle −200 azalış → sonraki döneme 1.000 (= ön izleme); Ağustos o 1.000'i alır (Haziran'ın 1.200'ünü DEĞİL).
      await c.buy("002", "2026-05-10", 5000);
      assert.deepEqual(await c.offset("002", "2026-05"), [0, 0, 100000], "002 Mayıs fişi devreden 1.000");
      const hb = await c.buy("002", "2026-06-10", 1000);
      assert.deepEqual(await c.offset("002", "2026-06"), [100000, 0, 120000], "002 Haziran fişi devreden 1.200");
      await c.cancel("002", hb);
      const preview = await c.preview("002", "2026-07");
      assert.deepEqual(preview, [120000, 0, 100000], "002 Temmuz ön izlemesi 1.200 → 1.000 (DEĞİŞMEDİ)");
      const jul2 = await c.report("002", monthRange("2026-07"), "002 Temmuz");
      assert.deepEqual(jul2.three, preview, `002 Temmuz raporu = ön izleme (taban 1.200 / 0 / 1.200) ${JSON.stringify(jul2.data.summary)}`);
      assert.deepEqual(jul2.reduction, [[`${R} (Haziran 2026)`, "200,00 TL"]], "002 Temmuz özet satırı");
      balanced(jul2, "002 Temmuz", 20000);
      const aug2 = await c.report("002", monthRange("2026-08"), "002 Ağustos");
      assert.deepEqual(aug2.three, [100000, 0, 100000], "002 Ağustos: Temmuz'un sonraki döneme devredeni 1.000");
      assert.ok(String(aug2.summary[PENDING] || "").startsWith("Temmuz 2026 ("), `002 Ağustos Mahsup Edilmemiş Ay: Temmuz (${aug2.summary[PENDING]})`);
      const span2 = await c.report("002", { from: "2026-05-01", to: "2026-08-31" }, "002 Mayıs–Ağustos");
      assert.deepEqual([span2.h391, span2.h191, ...span2.three], [0, 100000, 0, 0, 100000], "002 Mayıs–Ağustos: sonraki 1.000 = 191 1.000 (taban 1.200)");
      balanced(span2, "002 Mayıs–Ağustos");
    } finally {
      await c.close();
    }
  });
});
