// Akıllı veri motoru (v1.6.0): doğrulayıcılar, kolon tanıma, sektör önerisi, veri sağlığı, göstergeler, kayıt kimliği,
// ofis profili (sektör, rol adları, modüller, kalemle başlıklar) ve uçların yetkileri.
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { sheetMatrix } from "../client/assets/hof-excel-format.js";
import { detectIdentity } from "../server/lib/dataset-identity.mjs";
import { analyzeDataset } from "../server/lib/insight/analyze.mjs";
import { analyzeColumn, analyzeColumns, CASE_NO, primaryColumns } from "../server/lib/insight/columns.mjs";
import { computeKpis, listRecords } from "../server/lib/insight/kpi.mjs";
import { assessQuality } from "../server/lib/insight/quality.mjs";
import { classifySector, SECTOR_GROUPS, SECTORS, sectorCatalog } from "../server/lib/insight/sectors.mjs";
import { createProfileService } from "../server/lib/profile.mjs";
import { isIban, isPlate, isProvince, isTckn, isTrPhone, isUrl, isVkn, parseAmount, parseDate } from "../server/lib/insight/validators.mjs";
import { matrixToRecords } from "../server/lib/sections.mjs";
import { columnOrder } from "../server/lib/sources.mjs";
import { CORPUS, corpusRows } from "./fixtures/sector-corpus.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const XLSX = await import("../client/assets/xlsx-DGuHH-KN.js");
const here = path.dirname(fileURLToPath(import.meta.url));
const RANK = { low: 0, medium: 1, high: 2 };

function fixtureRows(file) {
  const workbook = XLSX.read(readFileSync(path.join(here, "fixtures", file)), { type: "buffer", cellDates: false, cellNF: true });
  const rows = [];
  const tabs = [];
  for (const name of workbook.SheetNames) {
    const parsed = matrixToRecords(sheetMatrix(XLSX, workbook.Sheets[name]), name);
    for (const row of parsed.rows) rows.push({ ...row, __hofKey: row["DOSYA NO"] || `satir-${rows.length}` });
    tabs.push(...parsed.tabs);
  }
  return { rows, tabs, workbook };
}
const roleOf = (analyses, column) => analyses.find(item => item.column === column);
const excel = (fileName, sheets) => ({ kind: "excel", fileName, sheets: Object.entries(sheets).map(([name, matrix]) => ({ name, matrix })) });
const rowsOf = response => response.data.result.data.json;
const view = async client => rowsOf(await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: { sheetUrl: "dataset://ofis" } }))}`));
async function importExcel(admin, body, mode = "replace") {
  const staged = await admin.post("/api/workspace/dataset/stage", body);
  assert.equal(staged.status, 200, JSON.stringify(staged.data));
  const committed = await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode });
  assert.equal(committed.status, 200, JSON.stringify(committed.data));
  return { staged: staged.data.data, committed: committed.data.data };
}

describe("doğrulayıcılar", () => {
  it("T.C., VKN ve IBAN sağlamaları; telefon, plaka, il", () => {
    assert.equal(isTckn("10000000146"), true);
    assert.equal(isTckn("10000000147"), false, "kontrol hanesi yanlış");
    assert.equal(isTckn("01234567890"), false, "0 ile başlayamaz");
    assert.equal(isVkn("1234567890"), true);
    assert.equal(isVkn("1234567891"), false);
    assert.equal(isIban("TR33 0006 1005 1978 6457 8413 26"), true);
    assert.equal(isIban("TR33 0006 1005 1978 6457 8413 27"), false);
    assert.equal(isIban("TR3300061005197864578413"), false, "Türkiye IBAN'ı 26 karakter");
    assert.equal(isTrPhone("0532 101 11 11"), true);
    assert.equal(isTrPhone("+90 (212) 555 44 33"), true);
    assert.equal(isTrPhone("1234567890"), false);
    assert.equal(isPlate("34 ABC 123"), true);
    assert.equal(isPlate("99 AB 123"), false, "il kodu 01-81");
    assert.equal(isProvince("İSTANBUL"), true);
    assert.equal(isProvince("Maraş"), true);
    assert.equal(isProvince("Paris"), false);
  });

  it("tarih takvimde olmalı; tutarlar Türkçe ve İngilizce yazımla okunur", () => {
    assert.equal(parseDate("31.02.2026"), null);
    assert.equal(parseDate("29.02.2028").toISOString().slice(0, 10), "2028-02-29");
    assert.equal(parseDate("2026-10-15").toISOString().slice(0, 10), "2026-10-15");
    assert.equal(parseAmount("40.000,00 TL"), 40000);
    assert.equal(parseAmount("₺1.500,50"), 1500.5);
    assert.equal(parseAmount("1,234.56"), 1234.56);
    assert.equal(parseAmount("(250)"), -250);
    assert.equal(parseAmount("15.10.2026"), null, "tarih tutar sayılmaz");
    assert.equal(parseAmount("Ali"), null);
  });
});

describe("kolon tanıma", () => {
  it("örnek icra tablosunda her kolonun türü doğru", () => {
    const { rows } = fixtureRows("ornek-dosyalar.xlsx");
    const analyses = analyzeColumns(rows, columnOrder(rows));
    assert.deepEqual(
      Object.fromEntries(analyses.map(item => [item.column, [item.role, item.kind ?? null]])),
      {
        "DOSYA NO": ["id", "case"],
        BORÇLU: ["person", null],
        ALACAKLI: ["org", null],
        "İCRA DAİRESİ": ["category", null],
        TELEFON: ["phone", null],
        "ÖDEME SÖZÜ": ["date", "deadline"],
        "DOSYANIN SON DURUMU": ["status", null],
        TUTAR: ["money", "amount"],
      },
    );
    assert.deepEqual(primaryColumns(analyses), { id: "DOSYA NO", person: "BORÇLU", money: "TUTAR", deadline: "ÖDEME SÖZÜ", event: null, status: "DOSYANIN SON DURUMU", responsible: null, phone: "TELEFON", city: null, plate: null, tckn: null });
  });

  it("para: başlıksız ondalık sayı tutar sayılmaz, ADET miktardır, birim fiyat toplanmaz, para işareti tutar yapar", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ ÖLÇÜM: `${i},5`, ADET: String(i + 1), "BİRİM FİYAT": `${100 + i},00`, BEDEL: `${i * 10},00`, X: `${i}.000 TL` }));
    const analyses = analyzeColumns(rows, Object.keys(rows[0]));
    assert.deepEqual(analyses.map(item => [item.column, item.role, item.kind]), [
      ["ÖLÇÜM", "number", "number"],
      ["ADET", "number", "quantity"],
      ["BİRİM FİYAT", "money", "price"],
      ["BEDEL", "money", "amount"],
      ["X", "money", "amount"],
    ]);
    assert.equal(primaryColumns(analyses).money, "BEDEL", "toplanacak tutar kolonu başlığı tutar diyendir");
  });

  it("kişi ve bir şeyin adı ayrılır; tarihlerde son tarih, olay ve doğum tarihi ayrılır", () => {
    const names = ["Ayşe Kaya", "Mehmet Öztürk", "Zeynep Çelik", "Can Demir"];
    const rows = Array.from({ length: 12 }, (_, i) => ({
      "Ürün Adı": ["Masa Lambası", "Çalışma Sandalyesi", "Kitaplık Rafı"][i % 3] + ` ${i}`,
      "Müşteri Adı": names[i % 4] + (i > 3 ? ` ${String.fromCharCode(65 + i)}` : ""),
      "Son Ödeme Tarihi": `1${i % 9}.10.2026`,
      "Kayıt Tarihi": `0${1 + (i % 9)}.09.2026`,
      "Doğum Tarihi": `0${1 + (i % 9)}.05.1990`,
      "Başvuru Son Tarihi": `2${i % 9}.11.2026`,
    }));
    const analyses = analyzeColumns(rows, Object.keys(rows[0]));
    assert.notEqual(roleOf(analyses, "Ürün Adı").role, "person");
    assert.equal(roleOf(analyses, "Müşteri Adı").role, "person");
    assert.equal(roleOf(analyses, "Son Ödeme Tarihi").kind, "deadline");
    assert.equal(roleOf(analyses, "Kayıt Tarihi").kind, "event");
    assert.equal(roleOf(analyses, "Doğum Tarihi").kind, "birth");
    assert.equal(roleOf(analyses, "Başvuru Son Tarihi").kind, "deadline", "güçlü 'son tarih' ifadesi olay sözcüğüne üstün gelir");
  });

  it("aynı türden iki tarih kolonundan ileri tarihleri taşıyan son tarih seçilir", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ "MUAYENE TARİHİ": `${String(1 + i).padStart(2, "0")}.09.2026`, "RANDEVU TARİHİ": `${String(1 + i).padStart(2, "0")}.10.2026` }));
    const analyses = analyzeColumns(rows, Object.keys(rows[0]), { now: new Date(2026, 8, 25) });
    assert.equal(roleOf(analyses, "MUAYENE TARİHİ").kind, "deadline");
    assert.equal(primaryColumns(analyses).deadline, "RANDEVU TARİHİ", "geçmiş tarihli muayene değil, ileri tarihli randevu");
  });

  it("T.C. kolonu yalnızca sağlaması tutuyorsa doğrulanmış sayılır", () => {
    const valid = ["10000000146", "12345678950", "11111111110", "22222222220", "33333333330"];
    const good = analyzeColumn(valid.map(value => ({ "T.C. KİMLİK NO": value })), "T.C. KİMLİK NO");
    assert.equal(good.role, "tckn");
    assert.equal(good.verified, true);
    const fake = analyzeColumn(["12345678901", "11122233344", "55566677788", "99988877766"].map(value => ({ "T.C.": value })), "T.C.");
    assert.notEqual(fake.role, "tckn", "başlık T.C. dese de değerler sağlamayı tutmuyor");
  });
});

describe("sektör önerisi", () => {
  it("katalog: 22 grup, 140+ sektör; kimlikler benzersiz; her grubun bir genel sektörü; her sektörün kelime dağarcığı", () => {
    assert.equal(SECTOR_GROUPS.length, 22);
    assert.ok(SECTORS.length >= 140, `${SECTORS.length} sektör`);
    assert.equal(new Set(SECTORS.map(sector => sector.id)).size, SECTORS.length);
    for (const group of SECTOR_GROUPS) assert.equal(SECTORS.filter(sector => sector.group === group.id && sector.general).length, 1, group.id);
    for (const sector of SECTORS) {
      for (const field of ["record", "records", "Record", "Records", "expert", "subtitle"]) assert.ok(sector.vocab[field], `${sector.id}.${field}`);
      assert.ok(sector.keys.length >= 1, `${sector.id} arama kelimesi`);
    }
    const catalog = sectorCatalog();
    assert.equal(catalog.groups.reduce((total, group) => total + group.sectors.length, 0), SECTORS.length);
  });

  it("örnek tablolar beklenen sektörü en az beklenen güvenle önerir; genel veride Genel ve düşük güven", () => {
    for (const entry of CORPUS) {
      const rows = corpusRows(entry);
      const result = classifySector({ analyses: analyzeColumns(rows, entry.headers), rows, label: entry.label || "" });
      assert.equal(result.suggestion, entry.expect, `${entry.name}: ${result.suggestion} (${result.level})`);
      if (entry.expect === "genel") assert.equal(result.level, "low", entry.name);
      else assert.ok(RANK[result.level] >= RANK[entry.level], `${entry.name}: güven ${result.level}`);
    }
  });

  it("gerçek icra dosyaları yüksek güvenle icra takibi; kanıtlar kolon adlarıyla", () => {
    for (const file of ["ornek-dosyalar.xlsx", "bolumlu-sayfalar.xlsx", "veri-devam.xlsx"]) {
      const { rows, tabs } = fixtureRows(file);
      const result = classifySector({ analyses: analyzeColumns(rows, columnOrder(rows)), rows, label: file, tabs });
      assert.equal(result.suggestion, "hukuk-icra", file);
      assert.equal(result.level, "high", file);
      assert.ok(result.evidence.some(item => item.kind === "header" && item.column === "BORÇLU"), file);
    }
  });

  it("belirsiz veride yanlış sektöre yüksek güven verilmez; öneri belirleyicidir", () => {
    const cases = [
      [["Müşteri", "Plaka", "Poliçe Bitiş", "Telefon"], ["genel", "sigorta-acente", "filo", "oto-galeri"]],
      [["Fatura No", "Firma", "Tutar", "KDV", "Vade Tarihi"], ["genel", "finans-cari", "finans-faktoring", "toptan"]],
      [["Tarih", "Müşteri", "Ürün", "Adet", "Tutar"], ["genel", "eticaret", "magaza", "crm"]],
      [["Öğrenci", "Veli", "Telefon", "Kayıt Tarihi", "Ücret"], ["genel", "egitim-okul", "egitim-kurs"]],
      [["Dosya No", "Hasta Adı", "Doktor", "Muayene Tarihi", "Ücret"], ["saglik-klinik"]],
      [["Plaka", "Marka", "Model", "Günlük Ücret", "Kiralama Başlangıç", "İade Tarihi"], ["oto-kiralama", "oto-galeri"]],
    ];
    for (const [headers, allowed] of cases) {
      const rows = corpusRows({ headers });
      const analyses = analyzeColumns(rows, headers);
      const first = classifySector({ analyses, rows });
      const second = classifySector({ analyses, rows });
      assert.deepEqual(second, first, "aynı veri aynı sonuç");
      assert.ok(allowed.includes(first.suggestion), `${headers.join(", ")} → ${first.suggestion}`);
    }
  });
});

describe("veri sağlığı ve göstergeler", () => {
  const rows = [
    { __sheet: "Aktif", __hofKey: "K1", "DOSYA NO": "2026/1", BORÇLU: "Ayşe Kaya", "T.C. KİMLİK NO": "10000000146", TUTAR: "1.000,00 TL", "SON ÖDEME TARİHİ": "12.10.2026", DURUM: "Açık" },
    { __sheet: "Aktif", __hofKey: "K2", "DOSYA NO": "2026/2", BORÇLU: "Can Demir", "T.C. KİMLİK NO": "10000000147", TUTAR: "2.500,50 TL", "SON ÖDEME TARİHİ": "20.10.2026", DURUM: "Açık" },
    { __sheet: "Aktif", __hofKey: "K3", "DOSYA NO": "2026/2", BORÇLU: "Elif Şahin", "T.C. KİMLİK NO": "12345678950", TUTAR: "500 TL", "SON ÖDEME TARİHİ": "01.10.2026", DURUM: "Kapalı" },
    { __sheet: "Ödeme", __hofKey: "K4", "DOSYA NO": "2026/1", BORÇLU: "Ayşe Kaya", "T.C. KİMLİK NO": "11111111110", TUTAR: "750 TL", "SON ÖDEME TARİHİ": "11.10.2026", DURUM: "Açık" },
    { __sheet: "Ödeme", __hofKey: "K5", "DOSYA NO": "", BORÇLU: "", "T.C. KİMLİK NO": "22222222220", TUTAR: "", "SON ÖDEME TARİHİ": "bekleniyor", DURUM: "Açık" },
  ];
  const analyses = analyzeColumns(rows, columnOrder(rows));
  const primary = primaryColumns(analyses);

  it("geçersiz T.C., aynı sekmede tekrar eden kimlik ve boş kimlik bulunur; farklı sekmede tekrar sorun sayılmaz", () => {
    const quality = assessQuality(rows, analyses, primary);
    const byId = Object.fromEntries(quality.issues.map(issue => [issue.id.split(":")[0], issue]));
    assert.deepEqual(byId["invalid-tckn"].items.map(item => item.key), ["K2"]);
    assert.deepEqual(byId["duplicate-id"].items.map(item => item.key).sort(), ["K2", "K3"], "2026/1 iki farklı sekmede: sorun değil");
    assert.deepEqual(byId["empty-id"].items.map(item => item.key), ["K5"]);
    assert.deepEqual(byId["invalid-date"].items.map(item => item.key), ["K5"]);
    assert.ok(quality.score > 0 && quality.score < 100);
    assert.equal(quality.issues[0].severity, "warn", "önce uyarılar");
  });

  it("tutar toplamı, yaklaşan ve tarihi geçen kayıtlar; her sekme için ayrı", () => {
    const kpis = computeKpis(rows, analyses, primary, { now: new Date(2026, 9, 10, 15, 0) });
    assert.deepEqual(kpis.all.money, { column: "TUTAR", sum: 4750.5, count: 4, currency: "TRY" });
    assert.deepEqual(kpis.all.deadline, { column: "SON ÖDEME TARİHİ", today: 0, next7: 2, next30: 3, passed: 1, dated: 4 });
    assert.deepEqual(kpis.all.status.top, [{ value: "Açık", count: 4 }, { value: "Kapalı", count: 1 }]);
    assert.equal(kpis.tabs.Aktif.total, 3);
    assert.equal(kpis.tabs["Ödeme"].money.sum, 750);
    assert.deepEqual(kpis.lists.upcoming.map(item => [item.key, item.days]), [["K4", 1], ["K1", 2], ["K2", 10]]);
    assert.deepEqual(kpis.lists.passed.map(item => item.key), ["K3"]);
    assert.deepEqual(kpis.all.month, { column: "SON ÖDEME TARİHİ", count: 4 });
    assert.deepEqual(kpis.lists.month.map(item => item.key), ["K3", "K4", "K1", "K2"], "bu ayın kayıtları gün sırasıyla");
    assert.equal(kpis.lists.topAmount[0].key, "K2");
  });

  it("karışık para biriminde toplam gösterilmez, bilgi olarak yazılır", () => {
    const mixed = [{ TUTAR: "100 TL" }, { TUTAR: "200 USD" }, { TUTAR: "300 TL" }, { TUTAR: "50 EUR" }];
    const items = analyzeColumns(mixed, ["TUTAR"]);
    assert.equal(items[0].currency, "mixed");
    const main = primaryColumns(items);
    assert.equal(main.money, null);
    assert.equal(computeKpis(mixed, items, main).all.money, null);
    assert.ok(assessQuality(mixed, items, main).issues.some(issue => issue.id.startsWith("mixed-currency")));
  });

  it("tam analiz: 200 bin satır birkaç saniyenin altında", () => {
    const big = Array.from({ length: 200_000 }, (_, i) => ({ __sheet: i % 2 ? "A" : "B", __hofKey: `2025/${i}`, "DOSYA NO": `2025/${i}`, BORÇLU: `Kişi ${i % 977} Soyad`, TUTAR: `${i % 5000},00 TL`, "ÖDEME SÖZÜ": `${1 + (i % 28)}.10.2026`, TELEFON: `0532 ${String(100 + (i % 900))} ${String(10 + (i % 90))} ${String(10 + (i % 89))}` }));
    const started = performance.now();
    const result = analyzeDataset({ rows: big, label: "buyuk.xlsx", tabs: ["A", "B"] });
    const elapsed = performance.now() - started;
    assert.equal(result.rowCount, 200_000);
    assert.equal(result.kpis.all.total, 200_000);
    assert.ok(elapsed < 6000, `${Math.round(elapsed)} ms`);
  });

  it("çok uzun hücreler analizi yavaşlatmaz (düzenli ifadeler doğrusal, biçim denetimi uzunlukla sınırlı)", () => {
    const evil = `2025/1${" ".repeat(19_990)}!`;
    const dotted = `www.${"a.".repeat(10_000)} x`;
    let started = performance.now();
    assert.equal(CASE_NO.test(evil), false);
    assert.equal(isUrl(dotted), false);
    assert.ok(performance.now() - started < 50, `düzenli ifadeler ${Math.round(performance.now() - started)} ms`);
    assert.equal(isUrl("https://destekofis.net/indir"), true);
    assert.equal(isUrl("www.ornek.com.tr"), true);
    assert.equal(isUrl("http://."), false);
    assert.equal(isUrl("www.ornek"), false);
    const rows = Array.from({ length: 3 }, (_, i) => Object.fromEntries(Array.from({ length: 45 }, (_, c) => [`ALAN ${c}`, c % 2 ? dotted : evil]).concat([["__hofKey", `K${i}`]])));
    started = performance.now();
    const result = analyzeDataset({ rows });
    assert.equal(result.rowCount, 3);
    assert.ok(performance.now() - started < 1000, `analiz ${Math.round(performance.now() - started)} ms`);
  });

  it("kart listesi: kartla aynı kapsam (seçili sekme) ve kural; toplam listenin tamamı, en fazla sınır kadar kayıt döner", () => {
    const now = new Date(2026, 8, 25, 10);
    const day = offset => {
      const date = new Date(2026, 8, 25 + offset);
      return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
    };
    const big = Array.from({ length: 260 }, (_, i) => ({ __sheet: "Büyük", __hofKey: `2026/${i}`, "DOSYA NO": `2026/${i}`, BORÇLU: `Borçlu ${i} Kişi`, TUTAR: `${10_000 + i},00 TL`, "SON ÖDEME TARİHİ": day(i % 5) }));
    const small = Array.from({ length: 10 }, (_, i) => ({ __sheet: "Küçük", __hofKey: `2026/9${i}`, "DOSYA NO": `2026/9${i}`, BORÇLU: `Küçük ${i} Kişi`, TUTAR: `${100 + i},00 TL`, "SON ÖDEME TARİHİ": i < 4 ? day(-3 - i) : day(10 + i) }));
    const all = [...big, ...small];
    const analysis = analyzeDataset({ rows: all, tabs: ["Büyük", "Küçük"], now });
    const { primary } = analysis;
    const tabKpi = analysis.kpis.tabs["Küçük"];
    const upcoming = listRecords(all, primary, { list: "upcoming", tab: "Küçük", now, currency: analysis.kpis.currency });
    assert.equal(upcoming.total, tabKpi.deadline.next30);
    assert.ok(upcoming.items.every(item => item.tab === "Küçük"));
    const passed = listRecords(all, primary, { list: "passed", tab: "Küçük", now });
    assert.equal(passed.total, tabKpi.deadline.passed);
    assert.deepEqual(passed.items.map(item => item.days), [-3, -4, -5, -6], "en yakın geçmiş önce");
    const top = listRecords(all, primary, { list: "topAmount", tab: "Küçük", now, limit: 30 });
    assert.equal(top.total, 10);
    assert.equal(top.items[0].amount, 109);
    const everything = listRecords(all, primary, { list: "upcoming", tab: "", now, limit: 500 });
    assert.equal(everything.total, analysis.kpis.all.deadline.next30);
    assert.equal(everything.total, 266, "200 sınırına takılmadan sayılır");
    const limited = listRecords(all, primary, { list: "upcoming", tab: "Yok böyle sekme", now, limit: 50 });
    assert.equal(limited.tab, "", "bilinmeyen sekmede tüm veri (kartlar gibi)");
    assert.equal(limited.total, 266);
    assert.equal(limited.items.length, 50);
    const month = listRecords(all, primary, { list: "month", now, limit: 500 });
    assert.equal(month.total, analysis.kpis.all.month.count);
  });
});

describe("kayıt kimliği", () => {
  it("dosya numaralı veri eski kurala göre; kimlik kolonlu veri o kolondan; ikisi de yoksa içerik izi", () => {
    assert.deepEqual(detectIdentity(fixtureRows("ornek-dosyalar.xlsx").rows), { mode: "legacy" });
    const clinic = Array.from({ length: 20 }, (_, i) => ({ "HASTA NO": `H-${1000 + i}`, "AD SOYAD": `Hasta ${i}`, TELEFON: `0532 000 00 ${String(i).padStart(2, "0")}` }));
    assert.deepEqual(detectIdentity(clinic), { mode: "column", column: "HASTA NO" });
    const plain = Array.from({ length: 20 }, (_, i) => ({ AD: `Kişi ${i % 7}`, ŞEHİR: "İstanbul" }));
    assert.deepEqual(detectIdentity(plain), { mode: "legacy" });
    const periods = Array.from({ length: 20 }, (_, i) => ({ DÖNEM: `2025/${1 + (i % 2)}`, "CARİ KOD": `C${100 + i}`, TUTAR: "10" }));
    assert.deepEqual(detectIdentity(periods), { mode: "column", column: "CARİ KOD" }, "tekrar eden dönem değeri kimlik sayılmaz");
  });

  it("kimlik kolonlu veride hücre değişse de notlar ve düzeltmeler kaybolmaz; yeni kayıt aynı kimliği alamaz", async () => {
    const server = await startTestServer();
    try {
      const admin = await loginAdmin(server);
      const header = ["HASTA NO", "AD SOYAD", "TELEFON", "RANDEVU TARİHİ"];
      const first = [header, ["H-1001", "Ayşe Kaya", "0532 111 11 11", "10.10.2026"], ["H-1002", "Can Demir", "0532 222 22 22", "11.10.2026"], ["H-1003", "Elif Şahin", "0532 333 33 33", "12.10.2026"]];
      const { staged } = await importExcel(admin, excel("hastalar.xlsx", { Liste: first }));
      assert.deepEqual(staged.identity, { mode: "column", column: "HASTA NO" });
      assert.deepEqual((await view(admin)).rows.map(row => row.__hofKey), ["H-1001", "H-1002", "H-1003"]);
      await admin.post(`/api/workspace/cases/${encodeURIComponent("H-1002")}/notes`, { note: "Kontrol randevusu verildi" });
      await admin.post("/api/workspace/overrides", { caseKey: "H-1002", field: "RANDEVU TARİHİ", value: "15.10.2026" });
      // Kaynakta telefon değişti: satır aynı kimlikle güncellenir.
      const second = first.map(line => (line[0] === "H-1002" ? ["H-1002", "Can Demir", "0555 999 99 99", "11.10.2026"] : line));
      const { staged: again } = await importExcel(admin, excel("hastalar.xlsx", { Liste: second }), "merge");
      assert.deepEqual(again.preview.merge, { added: 0, updated: 1, unchanged: 2, kept: 0 });
      const row = (await view(admin)).rows.find(item => item.__hofKey === "H-1002");
      assert.equal(row.TELEFON, "0555 999 99 99");
      assert.equal(row["RANDEVU TARİHİ"], "15.10.2026", "ofisin düzeltmesi yerinde");
      const activity = (await admin.get(`/api/workspace/cases/${encodeURIComponent("H-1002")}/activity`)).data.data.items;
      assert.ok(activity.some(item => item.text === "Kontrol randevusu verildi"), "not bağlı kaldı");
      const duplicate = await admin.post("/api/workspace/records", { values: { "HASTA NO": "H-1003", "AD SOYAD": "Başka" } });
      assert.equal(duplicate.status, 409);
      const created = await admin.post("/api/workspace/records", { values: { "HASTA NO": "H-2000", "AD SOYAD": "Yeni Hasta" } });
      assert.equal(created.data.data.caseKey, "H-2000", "yeni kayıt kimliğini kimlik kolonundan alır");
    } finally {
      await server.close();
    }
  });
});

describe("ofis profili", () => {
  let server;
  let admin;
  let personel;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    personel = await createUser(server, admin, { username: "personel1", name: "Personel Bir" });
  });
  after(() => server.close());

  it("yeni kurulum Genel profille açılır; giriş ekranı alt başlığı 'Ofis yönetimi'", async () => {
    const info = (await server.client().get("/api/public/info")).data.data;
    assert.equal(info.tagline, "Ofis yönetimi");
    const me = (await personel.get("/api/auth/me")).data.data;
    assert.equal(me.profile.sector.id, "genel");
    assert.deepEqual(me.profile.vocab, { record: "kayıt", records: "kayıtlar", Record: "Kayıt", Records: "Kayıtlar", expert: "Uzman", subtitle: "Ofis yönetimi" });
    assert.equal(me.profile.roleLabels.avukat, "Uzman");
    assert.deepEqual(me.profile.modules, { tahsilat: true, haciz: false });
    assert.equal(me.profile.introPending, false);
  });

  it("analiz ucu: göstergeler herkese; sektör önerisi ve kanıtı yalnızca yöneticiye", async () => {
    const header = ["DOSYA NO", "BORÇLU", "ALACAKLI", "İCRA DAİRESİ", "TUTAR", "ÖDEME SÖZÜ", "DURUM"];
    const lines = Array.from({ length: 12 }, (_, i) => [`2026/${100 + i}`, `Borçlu ${i} Kişi`, "Örnek Banka A.Ş.", `İstanbul ${1 + (i % 4)}. İcra Dairesi`, `${1000 * (i + 1)},00 TL`, i % 3 ? "" : "20.10.2026", i % 4 ? "Takipte" : "Haciz"]);
    await importExcel(admin, excel("icra.xlsx", { Aktif: [header, ...lines] }));
    const forAdmin = (await admin.get("/api/workspace/insight")).data.data;
    assert.equal(forAdmin.analysis.sector.suggestion, "hukuk-icra");
    assert.equal(forAdmin.analysis.sector.level, "high");
    assert.equal(forAdmin.analysis.sector.suggestionSector.vocab.expert, "Avukat");
    assert.equal(forAdmin.analysis.kpis.all.money.sum, 78000);
    assert.deepEqual(forAdmin.analysis.search, ["DOSYA NO", "BORÇLU"]);
    const forStaff = (await personel.get("/api/workspace/insight")).data.data;
    assert.equal(forStaff.analysis.sector, undefined, "personel sektör önerisini görmez");
    assert.equal(forStaff.analysis.kpis.all.total, 12);
    assert.equal(forStaff.profile.sector.id, "genel", "öneri kendiliğinden uygulanmaz");
  });

  it("analiz önbelleği: düzeltmeden sonra göstergeler yeniden hesaplanır", async () => {
    await admin.post("/api/workspace/overrides", { caseKey: "2026/100", field: "TUTAR", value: "1.000.000,00 TL" });
    const after = (await personel.get("/api/workspace/insight")).data.data.analysis;
    assert.equal(after.kpis.all.money.sum, 78000 - 1000 + 1_000_000);
  });

  it("analiz önbelleği: bir kayıt silinip başka biri geri alınınca (sayılar aynı kalsa da) göstergeler yenilenir", async () => {
    await admin.post("/api/workspace/deleted", { caseKey: "2026/101" });
    const before = (await personel.get("/api/workspace/insight")).data.data.analysis;
    await admin.post("/api/workspace/deleted", { caseKey: "2026/102" });
    await admin.post("/api/workspace/deleted/restore", { caseKey: "2026/101" });
    const after = (await personel.get("/api/workspace/insight")).data.data.analysis;
    assert.equal(after.kpis.all.total, before.kpis.all.total);
    assert.equal(after.kpis.all.money.sum, before.kpis.all.money.sum - 3000 + 2000, "2026/102 (3.000) çıktı, 2026/101 (2.000) geri geldi");
    const top = (await personel.get("/api/workspace/insight/records?list=topAmount")).data.data;
    assert.ok(!top.items.some(item => item.key === "2026/102"), "silinen kayıt listede yok");
    assert.ok(top.items.some(item => item.key === "2026/101"));
    await admin.post("/api/workspace/deleted/restore", { caseKey: "2026/102" });
  });

  it("kart listesi ucu: herkese açık, bilinmeyen liste reddedilir, sekme kapsamı uygulanır", async () => {
    const upcoming = await personel.get("/api/workspace/insight/records?list=upcoming&tab=Aktif");
    assert.equal(upcoming.status, 200);
    assert.equal(upcoming.data.data.tab, "Aktif");
    assert.equal(upcoming.data.data.column, "ÖDEME SÖZÜ");
    assert.equal((await personel.get("/api/workspace/insight/records?list=yok")).status, 400);
    assert.equal((await server.client().get("/api/workspace/insight/records?list=upcoming")).status, 401);
  });

  it("analiz önbelleği: veri okunurken değişirse eski sonuç yeni verinin anahtarıyla saklanmaz", async () => {
    let rowsCount = 1;
    let views = 0;
    const settings = new Map();
    const store = {
      setting: (key, fallback = null) => (settings.has(key) ? settings.get(key) : fallback),
      setSetting: (key, value) => settings.set(key, value),
      tx: fn => fn(),
      get: sql => (sql.includes("rowsCount") ? { rowsCount, overridesState: "0/", recordsState: "0/", deletedCount: 0 } : { count: 0 }),
    };
    const dataset = {
      hasData: () => true,
      view: async () => {
        views += 1;
        if (views === 1) rowsCount += 1; // ilk okuma sırasında veri değişti (ör. eşitleme ya da aynı anda düzeltme)
        return { rows: [{ "DOSYA NO": `2026/${views}`, BORÇLU: "Ali Veli" }], tabs: [] };
      },
    };
    const service = createProfileService({ store, dataset, audit() {}, events: null });
    assert.equal((await service.analysis()).rowCount, 1);
    await service.analysis(); // durulmuş veriyle yeniden hesaplanır ve önbelleğe alınır
    await service.analysis(); // önbellekten
    assert.equal(views, 2);
    rowsCount += 1;
    await service.analysis();
    assert.equal(views, 3, "veri değişince yeniden hesaplanır");
  });

  it("sektör seçimi yalnızca yöneticide; bilinmeyen sektör reddedilir; rol adı, dağarcık ve alt başlık değişir", async () => {
    assert.equal((await personel.post("/api/workspace/insight/sector", { sectorId: "hukuk-icra" })).status, 403);
    assert.equal((await admin.post("/api/workspace/insight/sector", { sectorId: "yok-boyle" })).status, 400);
    const applied = (await admin.post("/api/workspace/insight/sector", { sectorId: "hukuk-icra", source: "confirmed" })).data.data;
    assert.equal(applied.sector.id, "hukuk-icra");
    assert.equal(applied.sector.source, "confirmed");
    assert.equal(applied.sector.byName, "Ofis yöneticisi");
    assert.equal(applied.roleLabels.avukat, "Avukat");
    assert.equal(applied.vocab.Record, "Dosya");
    assert.equal(applied.modules.haciz, true);
    assert.equal((await server.client().get("/api/public/info")).data.data.tagline, "Hukuk ofisi yönetimi");
    const clinic = (await admin.post("/api/workspace/insight/sector", { sectorId: "saglik-klinik", source: "manual" })).data.data;
    assert.equal(clinic.roleLabels.avukat, "Hekim");
    assert.equal(clinic.vocab.records, "hastalar");
    assert.equal(clinic.modules.haciz, false);
    const audit = (await admin.get("/api/admin/audit?limit=5")).data.data;
    const events = Array.isArray(audit) ? audit : audit.events || audit.items || [];
    assert.ok(events.some(item => item.type === "profile.sector"), "değişiklik geçmişine yazılır");
  });

  it("haciz modülü: sektör istemese de ofisin haciz kaydı varsa açık kalır", async () => {
    await admin.post(`/api/workspace/cases/${encodeURIComponent("2026/101")}/liens`, { title: "Araç haczi", placedAt: "2026-01-10" });
    assert.equal((await personel.get("/api/workspace/profile")).data.data.modules.haciz, true);
  });

  it("başlık anahtarı: nesnenin kalıtılan adları (constructor, toString, __proto__) yuva sayılmaz", async () => {
    for (const key of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      assert.equal((await admin.put("/api/workspace/labels", { key, value: "x".repeat(5000) })).status, 400, key);
    }
    assert.deepEqual((await admin.get("/api/workspace/profile")).data.data.labels, {});
  });

  it("başlıklar: yalnızca yönetici; izinli anahtarlar; uzunluk sınırı; boş değer varsayılana döner; tümünü sıfırla", async () => {
    assert.equal((await personel.put("/api/workspace/labels", { key: "page.title", value: "X" })).status, 403);
    assert.equal((await admin.put("/api/workspace/labels", { key: "script.alert", value: "X" })).status, 400);
    let profile = (await admin.put("/api/workspace/labels", { key: "summary.title", value: "  Hasta\n özeti  " })).data.data;
    assert.equal(profile.labels["summary.title"], "Hasta özeti", "boşluklar ve satır sonları sadeleşir");
    profile = (await admin.put("/api/workspace/labels", { key: "brand.subtitle", value: "Ç".repeat(200) })).data.data;
    assert.equal(profile.labels["brand.subtitle"].length, 60);
    assert.equal((await server.client().get("/api/public/info")).data.data.tagline, "Ç".repeat(60), "giriş ekranı elle verilen alt başlığı gösterir");
    profile = (await admin.put("/api/workspace/labels", { key: "brand.subtitle", value: "" })).data.data;
    assert.equal(profile.labels["brand.subtitle"], undefined);
    assert.equal(profile.tagline, "Klinik yönetimi");
    profile = (await admin.del("/api/workspace/labels")).data.data;
    assert.deepEqual(profile.labels, {});
    assert.deepEqual(Object.keys(profile.slots).sort(), ["brand.subtitle", "categories.title", "nav.source", "nav.workspace", "page.title", "side.title", "summary.subtitle", "summary.title", "table.subtitle", "table.title"]);
  });
});

describe("1.6.0 öncesinden gelen kurulum", () => {
  it("verisi olan eski kurulum hukuk profiliyle açılır ve yöneticiye bir kez analiz gösterilir", async () => {
    const server = await startTestServer({
      adminPassword: "Ofis2026!",
      prepare: ({ dataDir }) => {
        mkdirSync(dataDir, { recursive: true });
        copyFileSync(path.join(here, "fixtures", "v1.0.0.sqlite"), path.join(dataDir, "hukuk-ofisi.sqlite"));
      },
    });
    try {
      const lawyer = server.client();
      await lawyer.login("ayse", "Avukat-2026!");
      const profile = (await lawyer.get("/api/workspace/profile")).data.data;
      assert.equal(profile.sector.id, "hukuk-buro");
      assert.equal(profile.sector.source, "legacy");
      assert.equal(profile.tagline, "Hukuk ofisi yönetimi");
      assert.equal(profile.roleLabels.avukat, "Avukat");
      assert.equal(profile.introPending, true);
      const admin = server.client();
      await admin.login("admin", "Ofis2026!");
      // Zorunlu parola değişimi olan yönetici önce parolasını değiştirir.
      await admin.post("/api/auth/change-password", { currentPassword: "Ofis2026!", newPassword: "Yeni-Ofis-2026!" });
      await admin.login("admin", "Yeni-Ofis-2026!");
      assert.equal((await admin.post("/api/workspace/insight/intro")).data.data.introPending, false);
      assert.equal((await lawyer.post("/api/workspace/insight/intro")).status, 403);
    } finally {
      await server.close();
    }
  });
});
