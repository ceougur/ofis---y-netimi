import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { inflateSync } from "node:zlib";
import { cashPdf, cashPdfName, rangeLabel } from "../server/lib/cash-report.mjs";
import { computeDeadlines, computeDues, monthColumns, readDue } from "../server/lib/insight/dues.mjs";
import { installmentLedger, monthsInText } from "../server/lib/insight/installments.mjs";
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

describe("seyrek belge kolonları (v2.0.6)", () => {
  it("araç listesinde tek kayda yazılan sigorta, emisyon, takograf tarihi de uyarı verir", () => {
    const header = ["SIRA", "PLAKA", "MARKA", "TRAFİK SİGORTASI", "KASKO BİTİŞ TARİHİ", "KOLTUK SİGORTASI", "EGZOZ EMİSYON", "TAKOGRAF", "SRC", "YAĞ BAKIM KM"];
    const rows = Array.from({ length: 12 }, (_, index) => ({ __hofKey: `a${index}`, __sheet: "ARAÇ DETAYI", ...Object.fromEntries(header.map((column, n) => [column, n === 0 ? String(index + 1) : n === 1 ? `42 C ${100 + index}` : ""])) }));
    ["TRAFİK SİGORTASI", "KASKO BİTİŞ TARİHİ", "KOLTUK SİGORTASI", "EGZOZ EMİSYON", "TAKOGRAF", "SRC"].forEach((column, index) => (rows[index][column] = "30.09.2026"));
    rows[6]["YAĞ BAKIM KM"] = "15000";
    const deadlines = computeDeadlines({ rows, tabs: ["ARAÇ DETAYI"], now: NOW });
    assert.deepEqual(deadlines.map(item => item.column).sort(), ["EGZOZ EMİSYON", "KASKO BİTİŞ TARİHİ", "KOLTUK SİGORTASI", "SRC", "TAKOGRAF", "TRAFİK SİGORTASI"]);
    assert.equal(deadlines.find(item => item.column === "KOLTUK SİGORTASI").person, "42 C 102");
  });
  it("belge başlığında tarih olmayan değer (şirket adı) tarih sayılmaz; geçmiş tek tarih uyarı vermez", () => {
    const rows = [
      { __hofKey: "1", __sheet: "A", PLAKA: "42 C 1", "KOLTUK SİGORTASI": "Anadolu Sigorta" },
      { __hofKey: "2", __sheet: "A", PLAKA: "42 C 2", "KOLTUK SİGORTASI": "" },
      { __hofKey: "3", __sheet: "B", PLAKA: "42 C 3", "EGZOZ EMİSYON": "01.06.2026" },
    ];
    assert.deepEqual(computeDeadlines({ rows, tabs: ["A", "B"], now: NOW }), []);
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

describe("ay kolonu yazımları ve tek vadeli tutar (v2.0.2)", () => {
  it("Eyl.26, Ekim'26, 2026-11, 12/2026 ay kolonu sayılır; 'Marka' ve 'Ara toplam' sayılmaz", () => {
    const months = monthColumns(["Öğrenci", "Eyl.26", "Ekim'26", "2026-11", "12/2026", "Marka", "Ara toplam"], NOW);
    assert.deepEqual(months.map(item => `${item.column}=${new Date(item.time).toISOString().slice(0, 7)}`), ["Eyl.26=2026-09", "Ekim'26=2026-10", "2026-11=2026-11", "12/2026=2026-12"]);
  });
  it("tek vade kolonlu tabloda beklenen tutar borç/tutar kolonundan gelir", () => {
    const rows = [
      { __hofKey: "2026/1", __sheet: "Aktif", "Dosya No": "2026/1", Borçlu: "Ali Veli", Alacak: "10.000,00", "Son ödeme": "17.09.2026" },
      { __hofKey: "2026/2", __sheet: "Aktif", "Dosya No": "2026/2", Borçlu: "Ayşe Kaya", Alacak: "5.000,00", "Son ödeme": "29.09.2026" },
      { __hofKey: "TOPLAM", __sheet: "Aktif", "Dosya No": "TOPLAM", Borçlu: "", Alacak: "15.000,00", "Son ödeme": "" },
    ];
    const { items } = computeDues({ rows, tabs: ["Aktif"], now: NOW });
    assert.deepEqual(items.map(item => [item.person, item.amount, item.state]), [["Ali Veli", 10000, "overdue"], ["Ayşe Kaya", 5000, "upcoming"]]);
  });
});

describe("eşleme ekranı ve takvim (v2.0.2)", () => {
  it("'Son tarih / Vade' seçilen kolon başlığı ne olursa olsun takvime girer; 'Yok Say' seçilen kolon girmez", async () => {
    const { computeDues } = await import("../server/lib/insight/dues.mjs");
    const now = new Date("2026-09-27T09:00:00");
    const rows = [
      { __hofKey: "1", __sheet: "S", Müvekkil: "Ali Veli", "Tarih 2": "29.09.2026", Tutar: "1.500", "Ödeme sözü": "30.09.2026" },
      { __hofKey: "2", __sheet: "S", Müvekkil: "Ayşe Kaya", "Tarih 2": "25.09.2026", Tutar: "2.000", "Ödeme sözü": "01.10.2026" },
    ];
    const auto = computeDues({ rows, tabs: ["S"], now });
    assert.ok(auto.items.every(item => item.label !== "Tarih 2"), "belirsiz başlık otomatik takvime girmez");
    const forced = computeDues({ rows, tabs: ["S"], now, forced: { "Tarih 2": "deadline", "Ödeme sözü": "ignore" } });
    assert.ok(forced.items.some(item => item.label === "Tarih 2"), JSON.stringify(forced.items.map(item => item.label)));
    assert.ok(forced.items.every(item => item.label !== "Ödeme sözü"), "yoksayılan kolon takvime girmez");
  });
});

describe("ay matrisi → taksit defteri (v2.0.2)", () => {
  const CAL = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const now = new Date(2026, 8, 27); // 27 Eylül 2026
  const member = (key, name, months, extra = {}) => ({ __hofKey: key, __sheet: "Aidat", Üye: name, "Aylık aidat": "500 TL", ...Object.fromEntries(CAL.map(m => [m, months[m] ?? ""])), ...extra });

  it("girişten önceki ve çıkıştan sonraki boş aylar taksit değildir; aradaki boş ay ödenmemiştir; durgun kayıt uyarı üretmez", () => {
    const rows = [
      member("a", "Ali", { Mart: "500", Nisan: "500", Mayıs: "500", Haziran: "500", Temmuz: "", Ağustos: "500" }), // aktif: Temmuz atlandı, Eylül bu ay
      member("b", "Ayşe", { Ocak: "500", Şubat: "500", Mart: "500" }), // Mart'tan beri boş: ayrıldı (durgun)
      member("c", "Can", { Haziran: "500", Temmuz: "500", Ağustos: "500", Eylül: "500" }), // her şey ödenmiş
      member("d", "Deniz", { Ocak: "500", Şubat: "500" }, { "Ayrılış tarihi": "15.02.2026" }), // bitiş kolonu
      member("e", "Efe", {}), // hiç ay yok, ücret var → yalnız bu ay
      member("f", "Filiz", { Ağustos: "500", Eylül: "250" }), // Eylül kısmi
    ];
    const { items, dormant } = computeDues({ rows, tabs: ["Aidat"], now });
    const by = name => items.filter(item => item.person === name).map(item => `${item.dueText}${item.partial ? "*" : ""}`).sort();
    assert.deepEqual(by("Ali"), ["Eylül 2026", "Temmuz 2026"].sort(), "Mart öncesi boş aylar yok; Temmuz boş → borç; Eylül bu ay");
    assert.deepEqual(by("Ayşe"), [], "Mart'tan sonra 5 tam boş ay: ayrılmış sayılır, uyarı yok");
    assert.deepEqual(dormant.map(item => `${item.person} ${item.lastPaidText} ${item.emptyMonths}`), ["Ayşe Mart 2026 5"]);
    assert.deepEqual(by("Can"), []);
    assert.deepEqual(by("Deniz"), [], "ayrılış tarihi Şubat: Mart ve sonrası taksit değil");
    assert.deepEqual(by("Efe"), ["Eylül 2026"]);
    assert.deepEqual(by("Filiz"), ["Eylül 2026*"]);
    assert.equal(items.find(item => item.person === "Filiz").amount, 250);
    assert.equal(items.find(item => item.person === "Ali" && item.dueText === "Temmuz 2026").state, "overdue");
  });

  it("defter: aralık dışı için satır açılmaz; 2 tam boş ay hâlâ aktiftir, 3 tam boş ay durgundur", () => {
    const months = CAL.map((column, index) => ({ column, time: Date.UTC(2026, index, 1), label: `${column} ödemesi`, amountColumn: "Aylık aidat" }));
    const active = installmentLedger({ row: member("x", "X", { Nisan: "500", Mayıs: "500", Haziran: "500", Temmuz: "" }), months, now });
    assert.deepEqual(active.rows.map(line => `${line.column}:${line.state}`), ["Nisan:paid", "Mayıs:paid", "Haziran:paid", "Temmuz:due", "Ağustos:due", "Eylül:due"], "Temmuz ve Ağustos tam boş, Eylül bu ay: hâlâ aktif");
    assert.equal(active.open, true);
    const gone = installmentLedger({ row: member("y", "Y", { Nisan: "500", Mayıs: "500" }), months, now });
    assert.deepEqual(gone.rows.map(line => line.column), ["Nisan", "Mayıs"], "Haziran–Eylül için satır açılmaz");
    assert.equal(gone.open, false);
    assert.equal(gone.dormant.emptyMonths, 3);
    const none = installmentLedger({ row: { __hofKey: "z", Üye: "Z", "Aylık aidat": "" }, months, now });
    assert.deepEqual(none.rows, [], "ücret de ay da yoksa taksit yok");
    const exempt = installmentLedger({ row: member("w", "W", { Temmuz: "muaf", Ağustos: "500" }), months, now });
    assert.deepEqual(exempt.rows.map(line => `${line.column}:${line.state}`), ["Ağustos:paid", "Eylül:due"], "'muaf' ay başlangıcı belirler ama satır açmaz");
  });
});

describe("ay hücresinde ödenecek taksit (plan kipi, v2.0.2)", () => {
  const M = ["EYLÜL", "EKİM", "KASIM", "ARALIK", "OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS"].map(n => `${n} TAKSİTİ`);
  const tab = "ARAÇ - ÖĞRENCİ BİLGİSİ";
  const student = (key, name, months, extra = {}) => ({ __hofKey: key, __sheet: tab, SIRA: "42 C 0197", "ÖĞRENCİ ADI": name, TELEFON: "", "TOPLAM TUTAR": "20000", ...Object.fromEntries(M.map(m => [m, ""])), ...months, ...extra });
  const september = new Date(2026, 8, 28);
  const run = (rows, now = september, payments = []) => computeDues({ rows, tabs: [tab], payments, now }).items.map(item => `${item.person} ${item.dueText} ${item.amount} ${item.state}`);

  it("Eylül 10.000 + Ekim 10.000 = Toplam 20.000: Eylül bu ay beklenir (ekrandaki örnek)", () => {
    assert.deepEqual(run([student("a", "ali", { "EYLÜL TAKSİTİ": "10000", "EKİM TAKSİTİ": "10000" })]), ["ali Eylül 2026 10000 month"]);
  });

  it("programda tahsilat girilince, 'Ödenen' ya da Toplam − Kalan ile Eylül kapanır", () => {
    const row = student("a", "ali", { "EYLÜL TAKSİTİ": "10000", "EKİM TAKSİTİ": "10000" });
    assert.deepEqual(run([row], september, [{ caseKey: "a", amount: 10000, date: "2026-09-20" }]), []);
    assert.deepEqual(run([{ ...row, "ÖDENEN": "10000" }]), []);
    assert.deepEqual(run([{ ...row, KALAN: "15000" }]), ["ali Eylül 2026 5000 month"], "5.000 ödenmiş: Eylül'den 5.000 kalır");
    assert.deepEqual(run([student("b", "can", { "EYLÜL TAKSİTİ": "10000 ödendi", "EKİM TAKSİTİ": "10000" })]), []);
  });

  it("aylar geçince ödenmeyen taksitler gecikir; planda boş ay ve plan bitişi borç sayılmaz", () => {
    const rows = [
      student("a", "ali", { "EYLÜL TAKSİTİ": "10000", "EKİM TAKSİTİ": "10000" }),
      student("b", "veli", { "EKİM TAKSİTİ": "5000", "ARALIK TAKSİTİ": "5000" }, { "TOPLAM TUTAR": "10000" }),
    ];
    const november = new Date(2026, 10, 15);
    assert.deepEqual(run(rows, november).sort(), ["ali Ekim 2026 10000 overdue", "ali Eylül 2026 10000 overdue", "veli Ekim 2026 5000 overdue"].sort(), "Kasım boş: veli için bu ay taksit yok; ali'nin planı Ekim'de bitti, Kasım borç değil");
    assert.deepEqual(run(rows, new Date(2026, 11, 10)).filter(text => text.startsWith("veli")).sort(), ["veli Aralık 2026 5000 month", "veli Ekim 2026 5000 overdue"]);
  });

  it("başlıkta yazım hatası ('NİSAN TAKSTİ', 'Mayıs taksit') ay kolonu sayılır; tahsilat Eylül'ü kapatır", () => {
    const columns = ["NİSAN TAKSTİ", "MAYIS TAKSİT", "HAZİRAN TAKSİTİ"];
    assert.deepEqual(monthColumns(columns, september).map(entry => entry.column), columns);
    const row = student("a", "ali", { "EYLÜL TAKSİTİ": "10000", "EKİM TAKSİTİ": "10000" });
    assert.deepEqual(run([row], september, [{ caseKey: "a", amount: 10000, date: "2026-09-28" }]), []);
    assert.deepEqual(run([row], new Date(2026, 9, 2), [{ caseKey: "a", amount: 10000, date: "2026-09-28" }]), ["ali Ekim 2026 10000 month"]);
  });

  it("uyarıdaki 'Gerçekleştirildi' Eylül'ü kapatır, tutar hücrede kalır; Ekim'de Ekim beklenir", () => {
    const october = new Date(2026, 9, 10);
    assert.deepEqual(run([student("a", "ali", { "EYLÜL TAKSİTİ": "Gerçekleştirildi · 10000", "EKİM TAKSİTİ": "10000" })], october), ["ali Ekim 2026 10000 month"]);
    assert.deepEqual(run([student("a", "ali", { "EYLÜL TAKSİTİ": "10.000 TL ödendi", "EKİM TAKSİTİ": "10.000 TL" })], october), ["ali Ekim 2026 10000 month"]);
  });

  it("kart detayındaki tahsilat notunda ay yazıyorsa tahsilat o aya sayılır (kullanıcı önerisi, v2.0.3)", () => {
    const row = student("a", "ali", { "EYLÜL TAKSİTİ": "10000", "EKİM TAKSİTİ": "10000" });
    const october = new Date(2026, 9, 2);
    // Pilden girilen tahsilatın notu: "Eylül ödemesi · Eylül 2026".
    assert.deepEqual(run([row], september, [{ caseKey: "a", amount: 10000, date: "2026-09-28", note: "Eylül ödemesi · Eylül 2026" }]), []);
    // Elle yazılmış not: "eylül taksiti".
    assert.deepEqual(run([row], october, [{ caseKey: "a", amount: 10000, date: "2026-09-28", note: "eylül taksiti" }]), ["ali Ekim 2026 10000 month"]);
    // 28 Eylül'de "ekim taksiti" diye girilen tahsilat Eylül'ü kapatmaz; Ekim gelince Ekim'e sayılır.
    const early = [{ caseKey: "a", amount: 10000, date: "2026-09-28", note: "ekim taksiti" }];
    assert.deepEqual(run([row], september, early), ["ali Eylül 2026 10000 month"]);
    assert.deepEqual(run([row], october, early), ["ali Eylül 2026 10000 overdue"]);
    // Notsuz tahsilat eskiden olduğu gibi en eski açık taksite sayılır.
    assert.deepEqual(run([row], october, [{ caseKey: "a", amount: 10000, date: "2026-09-28", note: "" }]), ["ali Ekim 2026 10000 month"]);
    // İki ay tek tahsilatta.
    assert.deepEqual(run([row], october, [{ caseKey: "a", amount: 20000, date: "2026-10-01", note: "Eylül-Ekim 2026 taksitleri" }]), []);
  });

  it("bütün planlı aylar geçince de hücredeki tutar ödendi sayılmaz (tabloda aylık ücret kolonu yok)", () => {
    const rows = [student("a", "ali", { "EYLÜL TAKSİTİ": "10000", "EKİM TAKSİTİ": "10000" }), student("b", "can", { "EYLÜL TAKSİTİ": "5000" }, { "TOPLAM TUTAR": "5000" })];
    const november = new Date(2026, 10, 15);
    assert.deepEqual(run(rows, november).sort(), ["ali Ekim 2026 10000 overdue", "ali Eylül 2026 10000 overdue", "can Eylül 2026 5000 overdue"].sort());
    const paid = [{ caseKey: "a", amount: 10000, date: "2026-09-25", note: "Eylül taksiti" }, { caseKey: "b", amount: 5000, date: "2026-09-25", note: "" }];
    assert.deepEqual(run(rows, november, paid), ["ali Ekim 2026 10000 overdue"]);
  });

  it("tahsilat notundaki aylar okunur", () => {
    assert.deepEqual(monthsInText("eylül taksiti"), [{ month: 9, year: null }]);
    assert.deepEqual(monthsInText("Eylül ödemesi · Eylül 2026"), [{ month: 9, year: 2026 }]);
    assert.deepEqual(monthsInText("Kasım-Aralık 2026"), [{ month: 11, year: 2026 }, { month: 12, year: 2026 }]);
    assert.deepEqual(monthsInText("2. taksit · 15.10.2026"), []);
    assert.deepEqual(monthsInText(""), []);
  });

  it("aylık ücret kolonu varken gelecek aya yazılan tutar peşin ödemedir (plan sayılmaz)", () => {
    const rows = [
      { __hofKey: "1", __sheet: "Servis", Öğrenci: "Ada Yılmaz", "Aylık ücret": "3.500", "Eyl.26": "3.500", "Ekim'26": "" },
      { __hofKey: "2", __sheet: "Servis", Öğrenci: "Efe Demir", "Aylık ücret": "3.500", "Eyl.26": "", "Ekim'26": "" },
      { __hofKey: "3", __sheet: "Servis", Öğrenci: "Zeynep Ak", "Aylık ücret": "3.800", "Eyl.26": "3.800", "Ekim'26": "3.800" },
    ];
    assert.deepEqual(computeDues({ rows, tabs: ["Servis"], now: september }).items.map(item => `${item.person} ${item.dueText}`), ["Efe Demir Eylül 2026"]);
  });

  it("ödeme kipi korunur: aylık ücret kolonu varken ay hücresindeki tutar ödemedir", () => {
    const rows = [{ __hofKey: "x", __sheet: "Servis", "ÖĞRENCİ ADI": "Ece", "AYLIK ÜCRET": "3.000 ₺", "EYLÜL TAKSİTİ": "3.000 ₺", "EKİM TAKSİTİ": "", "KASIM TAKSİTİ": "" }];
    const items = computeDues({ rows, tabs: ["Servis"], now: new Date(2026, 10, 15) }).items.map(item => item.dueText).sort();
    assert.deepEqual(items, ["Ekim 2026", "Kasım 2026"]);
  });
});

describe("ay hücresinde taksit: kart detayındaki tahsilat (tam yığın, v2.0.3)", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("yüklenen tabloda bu ayın taksiti uyarı verir; notu o ayı söyleyen tahsilat girilince kalkar, başka ayı söyleyen kapatmaz", async () => {
    const NAMES = ["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];
    const now = new Date();
    const current = NAMES[now.getMonth()];
    const next = NAMES[(now.getMonth() + 1) % 12];
    const sheet = {
      name: "ARAÇ - ÖĞRENCİ BİLGİSİ",
      columns: ["SIRA", "ÖĞRENCİ ADI", "TELEFON", "TOPLAM TUTAR", `${current} TAKSİTİ`, `${next} TAKSİTİ`],
      rows: [["42 C 0197", "ali", "", "20000", "10000", "10000"], ["42 C 0198", "veli", "", "20000", "10000", "10000"]],
    };
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "ŞAHİN TURİZM (1).xlsx", sheets: [{ name: sheet.name, matrix: matrix(sheet) }] });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" })).status, 200);

    const first = (await admin.get("/api/workspace/dues")).data.data;
    const items = first.items.filter(item => item.tab === sheet.name);
    // Ayın 1'inde vade (ayın 1'i) bugüne denk gelir: durum "today", diğer günlerde "month". İkisi de bu ayın uyarısıdır.
    const monthState = now.getDate() === 1 ? "today" : "month";
    assert.deepEqual(items.map(item => `${item.person} ${item.amount} ${item.state}`).sort(), [`ali 10000 ${monthState}`, `veli 10000 ${monthState}`], JSON.stringify(first.items));
    const ali = items.find(item => item.person === "ali");
    const veli = items.find(item => item.person === "veli");

    // ali: kart detayında "<bu ay> taksiti" notuyla tahsilat → uyarı kalkar.
    const note = `${current.toLocaleLowerCase("tr")} taksiti`;
    assert.equal((await admin.post(`/api/workspace/cases/${encodeURIComponent(ali.caseKey)}/payments`, { amount: "10000", date: first.today, note })).status, 200);
    // veli: "<gelecek ay> taksiti" notuyla tahsilat → bu ayın taksiti açık kalır.
    assert.equal((await admin.post(`/api/workspace/cases/${encodeURIComponent(veli.caseKey)}/payments`, { amount: "10000", date: first.today, note: `${next.toLocaleLowerCase("tr")} taksiti` })).status, 200);

    const after = (await admin.get("/api/workspace/dues")).data.data.items.filter(item => item.tab === sheet.name);
    assert.deepEqual(after.map(item => `${item.person} ${item.amount} ${item.state}`), [`veli 10000 ${monthState}`]);
  });
});
