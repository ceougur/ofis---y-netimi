// Excel/Sheets formülleri (v2.0.1): ayrıştırma, hesaplama, kayıtlara bağlama ve programda yeniden hesaplama.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { sheetFormulas, sheetMatrix } from "../client/assets/hof-excel-format.js";
import { evaluate } from "../server/lib/formula/evaluate.mjs";
import { parse, shiftFormula } from "../server/lib/formula/parse.mjs";
import { Cell, formatValue, parseCellText } from "../server/lib/formula/values.mjs";
import { createZip } from "../server/lib/zip.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const XLSX = await import("../client/assets/xlsx-DGuHH-KN.js");

// Bağlanmamış (hücre adresli) formülü tek satırlık bir tabloyla hesaplar: cells = {A1: "20.000,00 ₺", …}.
function calc(formula, cells = {}, now = new Date(2026, 8, 27)) {
  const address = (r, c) => `${String.fromCharCode(65 + c)}${r + 1}`;
  const bindTree = node => {
    if (node.t === "ref") return { t: "l", v: cells[address(node.r, node.c)] ?? "" };
    if (node.t === "rng") return { t: "a", rows: Array.from({ length: node.r2 - node.r1 + 1 }, (_, r) => Array.from({ length: node.c2 - node.c1 + 1 }, (_, c) => ({ t: "l", v: cells[address(node.r1 + r, node.c1 + c)] ?? "" }))) };
    if (node.t === "fn") return { ...node, a: node.a.map(bindTree) };
    if (node.t === "bin") return { ...node, l: bindTree(node.l), r: bindTree(node.r) };
    if (node.t === "neg" || node.t === "pct") return { ...node, e: bindTree(node.e) };
    return node;
  };
  const value = evaluate(bindTree(parse(formula)), { now, cell: node => new Cell(node.v) });
  return value instanceof Cell ? value.value : value;
}

describe("formül motoru", () => {
  it("dört işlem, öncelik, yüzde ve metin birleştirme Excel gibi", () => {
    assert.equal(calc("1+2*3"), 7);
    assert.equal(calc("(1+2)*3"), 9);
    assert.equal(calc("-2^2"), 4);
    assert.equal(calc("2^3^2"), 64);
    assert.equal(calc("200*10%"), 20);
    assert.equal(calc('"Toplam: "&A1', { A1: "1.500" }), "Toplam: 1.500");
    assert.equal(String(calc("1/0")), "#DIV/0!");
  });

  it("Türkçe görünen hücre değerleri sayıya/tarihe çevrilir", () => {
    assert.equal(parseCellText("20.000,00 ₺"), 20000);
    assert.equal(parseCellText("%18"), 0.18);
    assert.equal(parseCellText("0532 111 22 33"), "0532 111 22 33", "telefon metin kalır");
    assert.equal(calc("B1-SUM(C1:E1)", { B1: "20.000,00 ₺", C1: "5.000", D1: "5.000,00 ₺", E1: "" }), 10000);
    assert.equal(calc("DATEDIF(A1,B1,\"D\")", { A1: "01.09.2026", B1: "27.09.2026" }), 26);
    assert.equal(calc("TODAY()-A1", { A1: "20.09.2026" }), 7);
    assert.equal(calc("EDATE(A1,1)", { A1: "31.01.2026" }), calc("DATE(2026,2,28)"));
  });

  it("mantıksal, arama, koşullu toplam ve metin işlevleri", () => {
    assert.equal(calc('IF(A1>0,"Borçlu","Kapandı")', { A1: "1.250,00 ₺" }), "Borçlu");
    assert.equal(calc('IFERROR(1/0,"yok")'), "yok");
    assert.equal(calc('COUNTIF(A1:A4,">100")', { A1: "50", A2: "150", A3: "250", A4: "x" }), 2);
    assert.equal(calc('SUMIF(A1:A3,"Ankara",B1:B3)', { A1: "Ankara", A2: "İzmir", A3: "ankara", B1: "10", B2: "20", B3: "5" }), 15);
    assert.equal(calc("VLOOKUP(\"b\",A1:B3,2,FALSE)", { A1: "a", B1: "1", A2: "b", B2: "2", A3: "c", B3: "3" }), 2);
    assert.equal(calc("INDEX(B1:B3,MATCH(\"c\",A1:A3,0))", { A1: "a", B1: "1", A2: "b", B2: "2", A3: "c", B3: "3" }), 3);
    assert.equal(calc('UPPER(LEFT(A1,3))&"-"&LEN(A1)', { A1: "istanbul" }), "İST-8");
    assert.equal(calc("ROUND(PMT(0.02,12,-10000),2)"), 945.6);
  });

  it("paylaşılan formülün göreli başvuruları kaydırılır, mutlaklar sabit kalır", () => {
    assert.equal(shiftFormula("B2-SUM(C2:G2)*$H$1+Ayarlar!B$1", 3, 0), "B5-SUM(C5:G5)*$H$1+Ayarlar!B$1");
    assert.equal(shiftFormula("A1+B1", 0, 2), "C1+D1");
  });

  it("sonuç kolonun görünüşüyle yazılır", () => {
    assert.equal(formatValue(7000, "20.000,00 ₺"), "7.000,00 ₺");
    assert.equal(formatValue(7000, "20000"), "7000");
    assert.equal(formatValue(46078, "05.03.2026"), "25.02.2026");
    assert.equal(formatValue(0.125, "%15,0"), "%12,5");
    assert.equal(formatValue(true, ""), "DOĞRU");
  });
});

// Formüllü, alt tablosuz, toplam satırlı ve parametre sayfalı bir Excel dosyası (SheetJS ile, önbellek değerleriyle).
function workbookWithFormulas() {
  const money = '#,##0.00 "₺"';
  const sheet = {
    "!ref": "A1:G4",
    A1: { t: "s", v: "Müşteri" }, B1: { t: "s", v: "Tutar" }, C1: { t: "s", v: "Taksit 1" }, D1: { t: "s", v: "Taksit 2" }, E1: { t: "s", v: "Taksit 3" }, F1: { t: "s", v: "Kalan" }, G1: { t: "s", v: "Durum" },
    A2: { t: "s", v: "Ali Veli" }, B2: { t: "n", v: 20000, z: money }, C2: { t: "n", v: 5000, z: money }, D2: { t: "n", v: 5000, z: money }, F2: { t: "n", v: 10000, z: money, f: "B2-SUM(C2:E2)" }, G2: { t: "s", v: "Borçlu", f: 'IF(F2>0,"Borçlu","Kapandı")' },
    A3: { t: "s", v: "Ayşe Kara" }, B3: { t: "n", v: 12000, z: money }, C3: { t: "n", v: 4000, z: money }, F3: { t: "n", v: 8000, z: money, f: "B3-SUM(C3:E3)" }, G3: { t: "s", v: "Borçlu", f: 'IF(F3>0,"Borçlu","Kapandı")' },
    A4: { t: "s", v: "TOPLAM" }, B4: { t: "n", v: 32000, z: money, f: "SUM(B2:B3)" }, F4: { t: "n", v: 18000, z: money, f: "SUM(F2:F3)*(1+Ayarlar!B1)" },
  };
  const settings = { "!ref": "A1:B1", A1: { t: "s", v: "Gecikme oranı" }, B1: { t: "n", v: 0, z: "0%" } };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Taksitler");
  XLSX.utils.book_append_sheet(workbook, settings, "Ayarlar");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  // Tarayıcıdaki işçinin yaptığı gibi oku.
  const read = XLSX.read(buffer, { type: "array", cellDates: false, cellNF: true });
  return read.SheetNames.map(name => {
    const ws = read.Sheets[name];
    const formulas = sheetFormulas(XLSX, ws);
    const start = XLSX.utils.decode_range(ws["!ref"]).s;
    return formulas.length ? { name, matrix: sheetMatrix(XLSX, ws, false, { keepEmpty: true }), start: { r: start.r, c: start.c }, formulas } : { name, matrix: sheetMatrix(XLSX, ws) };
  });
}

describe("formüllü Excel programda çalışmaya devam eder", () => {
  let server;
  let admin;
  const rows = async () => {
    const response = await admin.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: { sheetUrl: "dataset://ofis" } }))}`);
    const data = response.data.result?.data?.json ?? response.data.result?.data ?? response.data;
    return data.rows;
  };
  const byName = (list, name) => list.find(row => row["Müşteri"] === name);
  const edit = (row, field, value) => admin.post("/api/workspace/overrides", { sourceName: "dataset://ofis", caseKey: row.__hofKey, field, value });

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    const sheets = workbookWithFormulas();
    assert.ok(sheets[0].formulas.length >= 5, "SheetJS formülleri okumalı");
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "taksitler.xlsx", sheets });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    const committed = await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" });
    assert.equal(committed.status, 200, JSON.stringify(committed.data));
  });
  after(() => server.close());

  it("içeri alınan değerler aynen görünür; formül bilgisi arayüze iner, iç alanlar inmez", async () => {
    const list = await rows();
    const ali = byName(list, "Ali Veli");
    assert.equal(ali.Kalan, "10.000,00 ₺");
    assert.equal(ali.__hofF, undefined);
    assert.equal(ali.__hofAt, undefined);
    const info = JSON.parse(ali.__hofFx);
    assert.equal(info.Kalan.d, "=[Tutar]-SUM([Taksit 1]:[Taksit 3])");
    assert.equal(info.Kalan.s, "source");
  });

  it("detay kartında boş taksit doldurulunca Kalan, Durum ve toplam satırı yeniden hesaplanır", async () => {
    let list = await rows();
    assert.equal((await edit(byName(list, "Ali Veli"), "Taksit 3", "3.000")).status, 200);
    list = await rows();
    const ali = byName(list, "Ali Veli");
    assert.equal(ali.Kalan, "7.000,00 ₺", "20.000 − (5.000 + 5.000 + 3.000)");
    assert.equal(ali.Durum, "Borçlu");
    assert.equal(JSON.parse(ali.__hofFx).Kalan.s, "calc");
    assert.equal(byName(list, "TOPLAM").Kalan, "15.000,00 ₺", "toplam satırı değişen kalanı toplar (Ayarlar sayfasındaki oran dahil)");
    assert.equal(byName(list, "Ayşe Kara").Kalan, "8.000,00 ₺", "değişmeyen satır olduğu gibi");

    assert.equal((await edit(byName(list, "Ali Veli"), "Taksit 3", "10.000,00")).status, 200);
    list = await rows();
    assert.equal(byName(list, "Ali Veli").Kalan, "0,00 ₺");
    assert.equal(byName(list, "Ali Veli").Durum, "Kapandı");
  });

  it("formül hücresini elle değiştiren kullanıcının değeri geçerlidir", async () => {
    let list = await rows();
    await edit(byName(list, "Ayşe Kara"), "Kalan", "1.234,00 ₺");
    list = await rows();
    const ayse = byName(list, "Ayşe Kara");
    assert.equal(ayse.Kalan, "1.234,00 ₺");
    assert.equal(JSON.parse(ayse.__hofFx).Kalan.s, "manual");
  });

  it("programda eklenen yeni kayıtta sekmenin kolon formülü uygulanır", async () => {
    const created = await admin.post("/api/workspace/records", { sourceName: "dataset://ofis", values: { __sheet: "Taksitler", "Müşteri": "Can Demir", Tutar: "9.000,00 ₺", "Taksit 1": "1.500" } });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const can = byName(await rows(), "Can Demir");
    assert.equal(can.Kalan, "7.500,00 ₺");
    assert.equal(can.Durum, "Borçlu");
  });
});

// Google Sheets: değerler export CSV'sinden (göründüğü gibi), formüller xlsx dışa aktarımından; paylaşılan formül.
describe("Google Sheets formülleri", () => {
  let server;
  let admin;
  const csv = [
    "Müşteri,Tutar,Taksit 1,Taksit 2,Taksit 3,Kalan",
    'Ali Veli,"20.000,00 ₺","5.000,00 ₺","5.000,00 ₺",,"10.000,00 ₺"',
    'Ayşe Kara,"12.000,00 ₺","4.000,00 ₺",,,"8.000,00 ₺"',
    "",
  ].join("\n");
  const xml = body => Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${body}`);
  const xlsx = createZip([
    { name: "xl/workbook.xml", data: xml('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Taksitler" sheetId="1" r:id="rId1"/></sheets></workbook>') },
    { name: "xl/_rels/workbook.xml.rels", data: xml('<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>') },
    {
      name: "xl/worksheets/sheet1.xml",
      data: xml('<worksheet><sheetData><row r="2"><c r="F2"><f t="shared" ref="F2:F3" si="0">B2-SUM(C2:E2)</f><v>10000</v></c></row><row r="3"><c r="F3"><f t="shared" si="0"/><v>8000</v></c></row></sheetData></worksheet>'),
    },
  ]);
  const fetchImpl = async url => {
    const target = String(url);
    if (target.includes("/edit")) return new Response('<script>"gid":"0","name":"Taksitler"</script>', { status: 200 });
    if (target.includes("format=xlsx")) return new Response(xlsx, { status: 200, headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
    return new Response(csv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8" } });
  };

  before(async () => {
    server = await startTestServer({ fetchImpl });
    admin = await loginAdmin(server);
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "sheets", url: "https://docs.google.com/spreadsheets/d/TAKSIT/edit" });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace", link: false })).status, 200);
  });
  after(() => server.close());

  it("paylaşılan formül her satıra açılır ve düzeltme sonrası yeniden hesaplanır", async () => {
    const get = async () => {
      const response = await admin.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: { sheetUrl: "dataset://ofis" } }))}`);
      return (response.data.result?.data?.json ?? response.data.result?.data).rows;
    };
    let rows = await get();
    const ayse = rows.find(row => row["Müşteri"] === "Ayşe Kara");
    assert.equal(JSON.parse(ayse.__hofFx).Kalan.d, "=[Tutar]-SUM([Taksit 1]:[Taksit 3])", "ikinci satırın formülü paylaşılan formülden kaydırılarak açılmalı");
    await admin.post("/api/workspace/overrides", { sourceName: "dataset://ofis", caseKey: ayse.__hofKey, field: "Taksit 2", value: "3.000" });
    rows = await get();
    assert.equal(rows.find(row => row["Müşteri"] === "Ayşe Kara").Kalan, "5.000,00 ₺");
    assert.equal(rows.find(row => row["Müşteri"] === "Ali Veli").Kalan, "10.000,00 ₺");
  });
});
