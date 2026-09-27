import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { inflateSync } from "node:zlib";
import { cashPdf, cashPdfName, rangeLabel } from "../server/lib/cash-report.mjs";
import { computeDeadlines, computeDues, readDue } from "../server/lib/insight/dues.mjs";
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
