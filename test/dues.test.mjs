import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { inflateSync } from "node:zlib";
import { cashPdf, cashPdfName, rangeLabel } from "../server/lib/cash-report.mjs";
import { computeDeadlines, computeDues, monthColumns, readDue } from "../server/lib/insight/dues.mjs";
import { PdfDocument, loadFont, subsetFont } from "../server/lib/pdf-write.mjs";
import { okulServisiWorkbook } from "./fixtures/okul-servisi-ornek.mjs";
import { tahsilatWorkbook } from "./fixtures/tahsilat-ornek.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

// Sabit gün: 27 Eylül 2026 (testler takvimle bozulmasın).
const NOW = new Date(2026, 8, 27, 10);
const flat = book => book.flatMap(sheet => sheet.rows.map((row, index) => ({ __hofKey: `${sheet.name}:${index + 1}`, __sheet: sheet.name, ...row })));
const tabsOf = book => book.map(sheet => sheet.name);
const find = (items, person, label) => items.find(item => item.person === person && item.label === label);
const matrix = sheet => [sheet.columns, ...sheet.rows.map(row => (Array.isArray(row) ? row : sheet.columns.map(column => row[column] ?? "")))];

describe("tahsilat takvimi motoru (v2.0.1)", () => {
  it("tarih, ay ve ödendi yazımlarını okur", () => {
    assert.equal(readDue("15.09.2026 - 5.000 TL", NOW).kind, "date");
    const month = readDue("Ekim 2026", NOW);
    assert.equal(month.kind, "month");
    assert.equal(new Date(month.time).getUTCDate(), 1, "ay olarak yazılan kalem ayın ilk günü beklenir");
    assert.ok(readDue("Ödendi", NOW) === null || readDue("Ödendi", NOW).settled);
    assert.equal(readDue("", NOW), null);
  });

  it("icra + ödeme sözü + taksit + kira tablosunda ödenmemiş kalemleri bulur", () => {
    const book = tahsilatWorkbook(NOW);
    const { items, sources } = computeDues({ rows: flat(book), tabs: tabsOf(book), payments: [], now: NOW });
    assert.deepEqual(sources.map(source => source.tab).sort(), ["Kiracılar", "Taksitler", "Ödeme Sözleri"].sort());
    // Söz: geçmiş söz gecikmiş, bugünkü "bugün", 3 gün sonraki yaklaşan; "Ödendi" durumlu sözler hiç gelmez.
    assert.equal(find(items, "Ali Veli", "Ödeme sözü").state, "overdue");
    assert.equal(find(items, "Ali Veli", "Ödeme sözü").amount, 5000);
    assert.equal(find(items, "Ayşe Kaya", "Ödeme sözü").state, "today");
    assert.equal(find(items, "Zeynep Şahin", "Ödeme sözü").days, 3);
    assert.ok(!items.some(item => ["Can Yıldız", "Mehmet Demir"].includes(item.person)), "ödendi durumlu sözler gelmez");
    // Taksit: durum "Ödendi" olan müşteri gelmez; ay olarak yazılan bu ayın taksiti "bu ay".
    assert.ok(!items.some(item => item.person === "Emre Çelik"));
    const month = find(items, "Burak Koç", "2. taksit");
    assert.equal(month.state, "month");
    assert.equal(month.dueText, "Eylül 2026");
    assert.equal(month.amount, 2000);
    // Kira: ayın belli günü ödenen kira, geçen ay ve bu ay için beklenir.
    assert.equal(items.filter(item => item.person === "Deniz Öztürk" && item.label === "Kira").length, 2);
    // Pencere dışı (30+ gün sonraki taksit) gelmez.
    assert.ok(!items.some(item => item.days > 30));
  });

  it("programda girilen tahsilat kalemleri vade sırasıyla kapatır; artan tutar sonrakine sayılır", () => {
    const book = tahsilatWorkbook(NOW);
    const rows = flat(book);
    const elif = rows.find(row => row.Müşteri === "Elif Aydın").__hofKey;
    const before = computeDues({ rows, tabs: tabsOf(book), payments: [], now: NOW }).items.filter(item => item.caseKey === elif);
    assert.equal(before.length, 2, "1. ve 2. taksit beklenir");
    const partial = computeDues({ rows, tabs: tabsOf(book), payments: [{ caseKey: elif, amount: 4000, date: "2026-09-26" }], now: NOW }).items.filter(item => item.caseKey === elif);
    assert.equal(partial.length, 1, "4.000: 1. taksit kapanır, 2. taksitin 1.000'i ödenir");
    assert.equal(partial[0].label, "2. taksit");
    assert.equal(partial[0].amount, 2000);
    assert.equal(partial[0].partial, true);
    const settledId = partial[0].id;
    const settled = computeDues({ rows, tabs: tabsOf(book), payments: [{ caseKey: elif, amount: 4000, date: "2026-09-26" }], settled: { [settledId]: { reason: "paid" } }, now: NOW });
    assert.ok(!settled.items.some(item => item.id === settledId), "ödendi sayılan kalem kapanır");
  });

  it("sözleşme bitişi ve sigorta yenilemesi 1 hafta önceden son gün olarak gelir", () => {
    const book = tahsilatWorkbook(NOW);
    const rows = flat(book);
    const { sources } = computeDues({ rows, tabs: tabsOf(book), payments: [], now: NOW });
    const deadlines = computeDeadlines({ rows, tabs: tabsOf(book), now: NOW, exclude: sources });
    const labels = deadlines.map(item => `${item.person}|${item.label}|${item.days}`);
    assert.ok(labels.includes("Hakan Kurt|Sigorta yenileme|2"), labels.join(", "));
    assert.ok(labels.includes("Deniz Öztürk|Sözleşme bitiş|5"), labels.join(", "));
    assert.ok(deadlines.every(item => item.days <= 7), "7 günden uzak son günler gelmez");
  });

  it("okul servisi: aylık ücret sütunlarında ödenmeyen ve kısmi ödenen aylar, araç ve şoför belgeleri", () => {
    const book = okulServisiWorkbook(NOW);
    const rows = flat(book);
    const { items, sources } = computeDues({ rows, tabs: tabsOf(book), payments: [], now: NOW });
    assert.deepEqual(sources.map(source => source.tab), ["Öğrenciler"]);
    assert.ok(items.every(item => item.dueText !== "Ekim 2026"), "gelecek ayın ücreti henüz beklenmez");
    const partial = find(items, "Can Öztürk", "Eylül ödemesi");
    assert.equal(partial.amount, 1900);
    assert.equal(partial.partial, true);
    assert.equal(find(items, "Mert Çelik", "Ağustos ödemesi").state, "overdue");
    assert.equal(find(items, "Mert Çelik", "Eylül ödemesi").state, "month");

    const deadlines = computeDeadlines({ rows, tabs: tabsOf(book), now: NOW, exclude: sources });
    const vehicle = deadlines.find(item => item.label === "Muayene Bitiş");
    assert.equal(vehicle.person, "34 SRV 101", "araç belgelerinde başlık plakadır");
    assert.equal(vehicle.caseNo, "Ahmet Güneş");
    const expired = deadlines.find(item => item.label === "Ehliyet Geçerlilik");
    assert.ok(expired && expired.days < 0, "süresi geçen belge de gelir");
    for (const label of ["Sigorta Bitiş", "Kasko Bitiş", "SRC Geçerlilik", "Psikoteknik Bitiş", "Güzergâh İzni Vize"]) assert.ok(deadlines.some(item => item.label === label), label);
  });
});

describe("tahsilat takvimi: şablon satırları ve hizmet dönemi (v2.0.2)", () => {
  const MONTHS = ["EYLÜL", "EKİM", "KASIM", "ARALIK", "OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS"].map(name => `${name} TAKSİTİ`);
  const yearOf = (columns, now) => Object.fromEntries(monthColumns(columns, now).map(entry => [entry.column, new Date(entry.time).getUTCFullYear()]));

  it("ay kolonlarının yılı kolon sırasından: Eylül–Ağustos okul yılında Temmuz ve Ağustos gelecek yılın", () => {
    const years = yearOf(MONTHS, new Date(2026, 8, 27));
    assert.equal(years["EYLÜL TAKSİTİ"], 2026);
    assert.equal(years["ARALIK TAKSİTİ"], 2026);
    assert.equal(years["OCAK TAKSİTİ"], 2027);
    assert.equal(years["TEMMUZ TAKSİTİ"], 2027);
    assert.equal(years["AĞUSTOS TAKSİTİ"], 2027);
    // Ocak–Aralık takviminde Temmuz geçti.
    const calendar = yearOf(["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"], new Date(2026, 8, 27));
    assert.equal(calendar.Temmuz, 2026);
    assert.equal(calendar.Aralık, 2026);
    // Yaz tatilinde (Ağustos) Eylül–Haziran şablonu biten okul yılını gösterir.
    const summer = yearOf(MONTHS.slice(0, 10), new Date(2026, 7, 10));
    assert.equal(summer["EYLÜL TAKSİTİ"], 2025);
    assert.equal(summer["HAZİRAN TAKSİTİ"], 2026);
    // Yılı yazılı kolon diziyi yerleştirir.
    const anchored = yearOf(["Kasım 2025", "Aralık", "Ocak"], new Date(2026, 8, 27));
    assert.deepEqual(Object.values(anchored), [2025, 2025, 2026]);
  });

  it("boş şablon satırı, başlamadan önceki aylar, ayrılan öğrenci ve '–' işaretli ay borç sayılmaz", () => {
    const now = new Date(2026, 10, 15); // 15 Kasım 2026
    const columns = ["SIRA", "ÖĞRENCİ ADI", "TELEFON", "AYLIK ÜCRET", "TOPLAM TUTAR", ...MONTHS, "KAYIT TARİHİ", "DURUM"];
    const row = (index, values) => ({ __hofKey: `plaka:${index}`, __sheet: "42 C 0594", SIRA: String(index), "ÖĞRENCİ ADI": "", TELEFON: "", "AYLIK ÜCRET": "", "TOPLAM TUTAR": "0,00 ₺", "KAYIT TARİHİ": "", DURUM: "", ...Object.fromEntries(MONTHS.map(month => [month, ""])), ...values });
    const rows = [
      row(1, { "ÖĞRENCİ ADI": "Ali Can", "AYLIK ÜCRET": "3.000 ₺", "EYLÜL TAKSİTİ": "3.000 ₺" }),
      row(2, { "ÖĞRENCİ ADI": "Ayşe Nur", "AYLIK ÜCRET": "3.000 ₺", "EKİM TAKSİTİ": "Ödendi" }),
      row(3, {}),
      row(4, { "ÖĞRENCİ ADI": "Can Er", "AYLIK ÜCRET": "3.000 ₺" }),
      row(5, { "ÖĞRENCİ ADI": "Deniz Ak", "AYLIK ÜCRET": "3.000 ₺", "EYLÜL TAKSİTİ": "3.000 ₺", DURUM: "Ayrıldı" }),
      row(6, { "ÖĞRENCİ ADI": "Efe Su", "AYLIK ÜCRET": "3.000 ₺", "EYLÜL TAKSİTİ": "–", "EKİM TAKSİTİ": "3.000 ₺", "KASIM TAKSİTİ": "muaf" }),
      row(7, { "ÖĞRENCİ ADI": "Fatma Gül", "AYLIK ÜCRET": "3.000 ₺", "KAYIT TARİHİ": "01.09.2026" }),
      row(8, { "TOPLAM TUTAR": "0,00 ₺" }),
    ];
    const { items } = computeDues({ rows, tabs: ["42 C 0594"], payments: [], now });
    const byPerson = person => items.filter(item => item.person === person).map(item => item.dueText).sort();
    assert.ok(items.every(item => item.person), `isimsiz (şablon) satırdan kalem gelmez: ${items.filter(item => !item.person).map(item => item.caseKey)}`);
    assert.deepEqual(byPerson("Ali Can"), ["Ekim 2026", "Kasım 2026"], "Eylül ödendi; Ekim gecikti, Kasım bu ay");
    assert.deepEqual(byPerson("Ayşe Nur"), ["Kasım 2026"], "Ekim'de başladı: Eylül borç değil");
    assert.deepEqual(byPerson("Can Er"), ["Kasım 2026"], "hiçbir ayı dolu olmayan yeni öğrenci: yalnız bu ay");
    assert.deepEqual(byPerson("Deniz Ak"), [], "ayrılan öğrenci takip edilmez");
    assert.deepEqual(byPerson("Efe Su"), [], "'–' ve 'muaf' o ay ücret yok demek");
    assert.deepEqual(byPerson("Fatma Gül"), ["Ekim 2026", "Eylül 2026", "Kasım 2026"], "kayıt tarihi Eylül: Eylül'den beri beklenir");
    assert.ok(!items.some(item => /Temmuz|Ağustos/.test(item.dueText)), "okul yılının Temmuz–Ağustos'u henüz gelmedi");
    assert.equal(items.find(item => item.person === "Ali Can" && item.dueText === "Kasım 2026").amount, 3000);
  });
});

describe("tahsilat takvimi: gerçek plan ile yapılmış işlem ayrımı (v2.0.2)", () => {
  const now = new Date(2026, 8, 27, 10);
  it("yapılmış ödemelerin listesi ('Ödeme Tarihi', son günlerde de olsa) ödeme planı sayılmaz", () => {
    const rows = ["20.09.2026", "24.09.2026", "26.09.2026", "02.09.2026", "15.08.2026"].map((date, i) => ({ __hofKey: `p${i}`, __sheet: "Ödemeler", Müşteri: `Müşteri ${i}`, "Ödeme Tarihi": date, Tutar: "1.000 TL" }));
    const { items, sources } = computeDues({ rows, tabs: ["Ödemeler"], now });
    assert.deepEqual(items, []);
    assert.deepEqual(sources, []);
  });

  it("aynı başlık ileri tarihliyse (plan) takvime girer", () => {
    const rows = ["20.09.2026", "20.10.2026", "20.11.2026", "20.12.2026"].map((date, i) => ({ __hofKey: `t${i}`, __sheet: "Plan", Müşteri: `Müşteri ${i}`, "Ödeme Tarihi": date, Tutar: "1.000 TL" }));
    const { items } = computeDues({ rows, tabs: ["Plan"], now });
    assert.equal(items.length, 1, "geçmişte kalan tek ödeme gecikmiş, ileridekiler pencerede değil");
    assert.equal(items[0].state, "overdue");
  });

  it("ay kolonlu satış ya da devam tablosu (ödeme kanıtı yok) aidat planı sayılmaz", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ __hofKey: `s${i}`, __sheet: "Satış", Temsilci: `Kişi ${i}`, Temmuz: String(10 + i), Ağustos: i % 2 ? "" : "12", Eylül: "" }));
    assert.deepEqual(computeDues({ rows, tabs: ["Satış"], now }).items, []);
  });

  it("satır bağlamı: kalan borcu 0 olan kayıttan tahsilat beklenmez", () => {
    const rows = [
      { __hofKey: "a", __sheet: "Takip", Borçlu: "Ali", "Ödeme Sözü": "20.09.2026 - 5.000 TL", Kalan: "0,00 TL" },
      { __hofKey: "b", __sheet: "Takip", Borçlu: "Ayşe", "Ödeme Sözü": "21.09.2026 - 2.000 TL", Kalan: "8.000 TL" },
      { __hofKey: "c", __sheet: "Takip", Borçlu: "Can", "Ödeme Sözü": "22.09.2026 - 1.000 TL", Kalan: "" },
    ];
    assert.deepEqual(computeDues({ rows, tabs: ["Takip"], now }).items.map(item => item.person).sort(), ["Ayşe", "Can"]);
  });

  it("ay kolonlarında ödeme işareti varsa ya da ücret kolonu varsa aidat planıdır", () => {
    const marks = Array.from({ length: 4 }, (_, i) => ({ __hofKey: `m${i}`, __sheet: "Aidat", Üye: `Üye ${i}`, Temmuz: "Ödendi", Ağustos: "✓", Eylül: i === 0 ? "" : "ödendi" }));
    assert.deepEqual(computeDues({ rows: marks, tabs: ["Aidat"], now }).items.map(item => `${item.person} ${item.dueText}`), ["Üye 0 Eylül 2026"]);
  });
});

describe("PDF yazıcı ve kasa dökümü (v2.0.1)", () => {
  const fontFile = path.join(import.meta.dirname, "..", "server", "assets", "fonts", "LiberationSans-Regular.ttf");

  it("yazı tipi alt kümesi geçerli bir TrueType dosyasıdır ve kullanılan glifleri korur", () => {
    const font = loadFont(fontFile);
    const used = [..."Şişli Ağustos İĞÜÇÖ"].map(char => font.cmap.get(char.codePointAt(0)));
    assert.ok(used.every(Boolean), "Türkçe harfler yazı tipinde var");
    const subset = subsetFont(font, used);
    const dir = mkdtempSync(path.join(tmpdir(), "pdf-font-"));
    writeFileSync(path.join(dir, "alt.ttf"), subset);
    const again = loadFont(path.join(dir, "alt.ttf"));
    assert.equal(again.numGlyphs, font.numGlyphs, "glif numaraları değişmez");
    const s = font.cmap.get("Ş".codePointAt(0));
    assert.ok(again.glyphRange(s)[1] > again.glyphRange(s)[0], "kullanılan glif çizimi durur");
    const z = font.cmap.get("Z".codePointAt(0));
    assert.equal(again.glyphRange(z)[1], again.glyphRange(z)[0], "kullanılmayan glif boşaltılır");
    assert.ok(subset.length < 60_000, `alt küme küçük olmalı (${subset.length})`);
  });

  it("metni ölçer, satırlara böler ve Türkçe metni ToUnicode ile gömer", () => {
    const font = loadFont(fontFile);
    const doc = new PdfDocument({ fonts: { regular: font, bold: font }, title: "Deneme" });
    const lines = doc.wrap("Çok uzun bir açıklama satırı ki alt satıra kaydırılsın", 120, "regular", 10);
    assert.ok(lines.length >= 2 && lines.every(line => doc.measure(line, "regular", 10) <= 120));
    assert.ok(doc.fit("Çok uzun bir açıklama satırı", 60, "regular", 10).endsWith("…"));
    doc.addPage().text(40, 40, "Ağustos ödemesi 😀", { size: 12 });
    const pdf = doc.toBuffer({ now: NOW });
    const text = pdf.toString("latin1");
    assert.ok(text.startsWith("%PDF-1.7"));
    assert.ok(text.trimEnd().endsWith("%%EOF"));
    assert.match(text, /\/Subtype \/Type0 \/BaseFont \/[A-Z]{6}\+LiberationSans/);
    // xref tablosundaki her konum gerçekten bir nesnenin başına işaret eder.
    const start = Number(/startxref\n(\d+)/.exec(text)[1]);
    const offsets = [...text.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map(match => Number(match[1]));
    offsets.forEach((offset, index) => assert.ok(text.startsWith(`${index + 1} 0 obj`, offset), `nesne ${index + 1}`));
    // ToUnicode: "ğ" (U+011F) ve "ö" (U+00F6) eşlenir; yazı tipinde olmayan emoji atlanır.
    const streams = [...text.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(match => {
      try {
        return inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
      } catch {
        return "";
      }
    });
    const cmap = streams.find(body => body.includes("beginbfchar"));
    assert.match(cmap, /<011F>/);
    assert.match(cmap, /<00F6>/);
    assert.ok(!/D83D/i.test(cmap));
  });

  it("kasa dökümü: devreden kasa, hareketler, toplam ve sayfa numarası", () => {
    const entries = Array.from({ length: 60 }, (_, index) => ({ kind: index % 3 ? "in" : "out", source: "manual", amount: 100 + index, date: "2026-09-10", description: `Hareket ${index}`, actorName: "Selin", balance: 1000 + index }));
    const pdf = cashPdf({ entries, opening: 500, period: { in: 10, out: 5, net: 5 } }, { from: "2026-09-01", to: "2026-09-25", officeName: "Güneş Servis", userName: "Uğur", now: NOW });
    const text = pdf.toString("latin1");
    const pages = Number(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/.exec(text)[1]);
    assert.ok(pages >= 2, "60 hareket birden çok sayfaya taşar");
    assert.equal(rangeLabel("2026-09-01", "2026-09-25"), "01.09.2026 – 25.09.2026");
    assert.equal(cashPdfName("2026-09-01", "2026-09-25"), "Kasa-dokumu 01.09.2026-25.09.2026.pdf");
    assert.match(cashPdfName("2026-09-01", "2026-09-25"), /^[\x20-\x7e]+$/, "indirme adı ASCII");
  });
});

describe("tahsilat takvimi ve kasa PDF uç noktaları (v2.0.1)", () => {
  let server;
  let admin;
  let personel;
  let muhasebe;
  let dues;

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    personel = await createUser(server, admin, { username: "selin", name: "Selin Kaya", role: "personel" });
    muhasebe = await createUser(server, admin, { username: "muh", name: "Muhasebe", role: "muhasebe" });
    const book = tahsilatWorkbook(new Date());
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "tahsilat.xlsx", sheets: book.map(sheet => ({ name: sheet.name, matrix: matrix(sheet) })) });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" });
  });
  after(() => server.close());

  it("takvim ödenmemiş kalemleri ve son günleri döndürür", async () => {
    const response = await personel.get("/api/workspace/dues");
    assert.equal(response.status, 200, JSON.stringify(response.data));
    dues = response.data.data;
    assert.match(dues.today, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(dues.items.some(item => item.person === "Ali Veli" && item.promise && item.state === "overdue"));
    assert.ok(dues.deadlines.some(item => item.label === "Sigorta yenileme"));
  });

  it("tahsilat girilince kalem kapanır", async () => {
    const item = dues.items.find(entry => entry.person === "Ali Veli" && entry.promise);
    const paid = await personel.post(`/api/workspace/cases/${encodeURIComponent(item.caseKey)}/payments`, { amount: "5.000", date: dues.today, note: "Söz ödendi" });
    assert.equal(paid.status, 200, JSON.stringify(paid.data));
    const after = (await personel.get("/api/workspace/dues")).data.data;
    assert.ok(!after.items.some(entry => entry.id === item.id), "ödenen söz takvimden düşer");
  });

  it("ödendi say / iptal / geri al; denetim kaydı yazılır", async () => {
    const item = dues.items.find(entry => entry.person === "Ayşe Kaya" && entry.promise);
    assert.equal((await personel.post("/api/workspace/dues/settle", { id: item.id, reason: "cancelled" })).status, 200);
    assert.ok(!(await personel.get("/api/workspace/dues")).data.data.items.some(entry => entry.id === item.id));
    assert.equal((await personel.post("/api/workspace/dues/settle", { id: item.id, undo: true })).status, 200);
    assert.ok((await personel.get("/api/workspace/dues")).data.data.items.some(entry => entry.id === item.id), "geri alınınca kalem döner");
    assert.equal((await personel.post("/api/workspace/dues/settle", { id: "uydurma" })).status, 400);
    const audit = await admin.get("/api/admin/audit?limit=50");
    const types = audit.data.data.map(event => event.type);
    assert.ok(types.includes("dues.cancelled") && types.includes("dues.reopened"), types.join(","));
  });

  it("kasa PDF: yetki, tarih denetimi ve dosya", async () => {
    assert.equal((await personel.raw("GET", "/api/workspace/cash.pdf?from=2026-09-01&to=2026-09-25")).status, 403);
    assert.equal((await muhasebe.raw("GET", "/api/workspace/cash.pdf?from=2026-09-25&to=2026-09-01")).status, 400, "başlangıç bitişten sonra olamaz");
    assert.equal((await muhasebe.raw("GET", "/api/workspace/cash.pdf?from=2026-13-01")).status, 400);
    const response = await muhasebe.raw("GET", `/api/workspace/cash.pdf?from=${dues.today.slice(0, 8)}01&to=${dues.today}&download=1`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.match(response.headers.get("content-disposition"), /^attachment; filename="Kasa-dokumu /);
    const body = response.buffer;
    assert.equal(body.subarray(0, 8).toString("latin1"), "%PDF-1.7");
  });
});

describe("bildirimde “Gerçekleştirildi” (v2.0.2)", () => {
  it("hücreye yazılan “Gerçekleştirildi” kalemi kapatır; tarih hücrede kalır; aylık kısmi ödeme de kapanır", () => {
    const rows = [
      { __hofKey: "1", __sheet: "Araçlar", Plaka: "34 ABC 12", Şoför: "Ali Veli", "Sigorta bitiş": "30.09.2026", "Muayene bitiş": "02.10.2026" },
      { __hofKey: "2", __sheet: "Araçlar", Plaka: "34 DEF 34", Şoför: "Can Er", "Sigorta bitiş": "Gerçekleştirildi · 29.09.2026", "Muayene bitiş": "01.10.2026" },
      { __hofKey: "3", __sheet: "Araçlar", Plaka: "06 GHI 56", Şoför: "Ece Ak", "Sigorta bitiş": "15.12.2026", "Muayene bitiş": "15.12.2026" },
    ];
    const deadlines = computeDeadlines({ rows, tabs: ["Araçlar"], now: NOW });
    const labels = deadlines.map(item => `${item.person}|${item.column}`);
    assert.ok(labels.includes("34 ABC 12|Sigorta bitiş"));
    assert.ok(!labels.includes("34 DEF 34|Sigorta bitiş"), "Gerçekleştirildi yazılan tarih uyarı vermez");
    assert.ok(labels.includes("34 DEF 34|Muayene bitiş"), "aynı satırın başka işi etkilenmez");
    assert.equal(deadlines.find(item => item.person === "34 ABC 12").column, "Sigorta bitiş", "hücreye yazmak için kolon adı gelir");

    const student = (key, name, september) => ({ __hofKey: key, __sheet: "Öğrenciler", "Öğrenci": name, "Aylık ücret": "1.000 TL", Ağustos: "1.000 TL", Eylül: september, Ekim: "" });
    const students = [student("s1", "Deniz", ""), student("s2", "Ege", "Gerçekleştirildi"), student("s3", "Ada", "Gerçekleştirildi · 500 TL"), student("s4", "Can", "500 TL"), student("s5", "Efe", "1.000 TL")];
    const { items } = computeDues({ rows: students, tabs: ["Öğrenciler"], now: NOW });
    assert.deepEqual(items.filter(item => item.label === "Eylül ödemesi").map(item => item.person).sort(), ["Can", "Deniz"]);
    assert.equal(items.find(item => item.person === "Can").amount, 500, "yalnızca kısmi ödeme yazılan kalem kalanı bekler");
    assert.equal(items.find(item => item.person === "Deniz").column, "Eylül");
    assert.equal(items.find(item => item.person === "Deniz").recurring, false);
  });

  it("her ay tekrarlayan ödeme günü kalemi ‘recurring’ olarak işaretlenir (ayar hücresine yazılmaz)", () => {
    const rows = [{ __hofKey: "k1", __sheet: "Kiracılar", "Kiracı": "Selin", "Kira günü": "5", "Kira tutarı": "10.000" }];
    const { items } = computeDues({ rows, tabs: ["Kiracılar"], now: NOW });
    assert.ok(items.length && items.every(item => item.recurring), JSON.stringify(items));
  });
});
