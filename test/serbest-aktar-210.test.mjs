// v2.0.10: "+ Sayfa" penceresinde Excel dosyasından ve Google Sheets'ten serbest sayfaya aktarma.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { matrixToFree } from "../server/lib/free-import.mjs";
import { createZip } from "../server/lib/zip.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

describe("matrixToFree: başlık, alan ve formül adresleri", () => {
  it("başlığın üstündeki boş satır ve soldaki boş kolon atılır; formüller serbest sayfa adresine çevrilir", () => {
    // Excel: A kolonu boş, 1. satır boş, başlık 2. satırda (B2:D2), veri 3-5. satırlarda; sonda boş satır.
    const matrix = [[], ["", "Ad", "Tutar", "İki katı"], ["", "Ali", "10", "20"], ["", "Veli", "15", "30"], ["", "Toplam", "25", "50"], ["", "", "", ""]];
    const formulas = [
      [2, 3, "C3*2"],
      [3, 3, "C4*2"],
      [4, 2, "SUM(C3:C4)"],
      [4, 3, "SUM($D$3:D4)"],
    ];
    const result = matrixToFree({ matrix, start: { r: 0, c: 0 }, formulas });
    assert.deepEqual(result.names, ["Ad", "Tutar", "İki katı"]);
    assert.equal(result.rows.length, 3, "sondaki boş satır atılır");
    assert.deepEqual(result.rows[0], ["Ali", "10", "=B1*2"]);
    assert.deepEqual(result.rows[1], ["Veli", "15", "=B2*2"]);
    assert.deepEqual(result.rows[2], ["Toplam", "=SUM(B1:B2)", "=SUM($C$1:C2)"]);
    assert.equal(result.formulas, 4);
    assert.equal(result.fallback["2,1"], "25", "formülün Excel'deki değeri yedek olarak döner");
  });
  it("başlığa ya da alanın dışına başvuru #REF!, başka sayfaya başvuru değeriyle kalır; sayfa başlangıcı (start) hesaba katılır", () => {
    const matrix = [["Kalem", "Tutar", "Kontrol", "Dış"], ["Kira", "100", "x", "7"]];
    // Excel aralığı C5'ten başlıyor: matris satırı 0 = sayfa satırı 4, kolon 0 = sayfa kolonu 2.
    const formulas = [
      [5, 4, "D5&\"\""],
      [5, 5, "'Diğer sayfa'!A1"],
    ];
    const result = matrixToFree({ matrix, start: { r: 4, c: 2 }, formulas });
    assert.equal(result.rows[0][2], '=#REF!&""', "başlık satırına başvuru");
    assert.equal(result.rows[0][3], "7", "başka sayfaya başvuru: değer");
    assert.equal(result.foreign, 1);
  });
  it("başlık satırının üstündeki başlık yazısı alınmaz; tek kolonlu listede ilk satır başlıktır", () => {
    const matrix = [["", "Ofis Giderleri 2026"], [], ["", "Kalem", "Tutar"], ["", "Kira", "100"]];
    const result = matrixToFree({ matrix, formulas: [[3, 2, "C4+0"]] });
    assert.deepEqual(result.names, ["Kalem", "Tutar"]);
    assert.equal(result.skippedAbove, 1);
    assert.deepEqual(result.rows, [["Kira", "=B1+0"]]);
    assert.deepEqual(matrixToFree({ matrix: [["Liste"], ["a"], ["b"]] }).names, ["Liste"]);
  });
  it("boş sayfa reddedilir", () => {
    assert.throws(() => matrixToFree({ matrix: [[], [""]] }), /boş/);
  });
});

describe("serbest sayfaya aktarma (API)", () => {
  let server;
  let admin;
  const csv = ["Masraf,Tutar,KDV", "Kira,1000,200", "Elektrik,250,50", ""].join("\n");
  const xml = body => Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${body}`);
  const xlsx = createZip([
    { name: "xl/workbook.xml", data: xml('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Liste" sheetId="1" r:id="rId1"/><sheet name="Masraflar" sheetId="2" r:id="rId2"/></sheets></workbook>') },
    { name: "xl/_rels/workbook.xml.rels", data: xml('<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>') },
    { name: "xl/worksheets/sheet1.xml", data: xml("<worksheet><sheetData/></worksheet>") },
    { name: "xl/worksheets/sheet2.xml", data: xml('<worksheet><sheetData><row r="2"><c r="C2"><f t="shared" ref="C2:C3" si="0">B2*0.2</f><v>200</v></c></row><row r="3"><c r="C3"><f t="shared" si="0"/><v>50</v></c></row></sheetData></worksheet>') },
  ]);
  const fetchImpl = async url => {
    const target = String(url);
    if (target.includes("/edit")) return new Response('<title>Ofis giderleri - Google E-Tablolar</title><script>"gid":"0","name":"Liste" "gid":"77","name":"Masraflar"</script>', { status: 200 });
    if (target.includes("format=xlsx")) return new Response(xlsx, { status: 200, headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
    if (target.includes("gid=77")) return new Response(csv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8" } });
    return new Response("Başka,Sekme\n1,2\n", { status: 200, headers: { "content-type": "text/csv; charset=utf-8" } });
  };
  before(async () => {
    server = await startTestServer({ fetchImpl });
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("Excel: sayfa kurulur; formüller programda hesaplanır; hesaplanamayan formül Excel'deki değeriyle kalır", async () => {
    const sheet = {
      name: "Taksit Planı",
      start: { r: 0, c: 0 },
      matrix: [["Ay", "Tutar", "KDV", "Not"], ["Ocak", "1000", "180", "x"], ["Şubat", "2000", "360", "y"]],
      formulas: [
        [1, 2, "B2*0.18"],
        [2, 2, "B3*0.18"],
        [1, 3, 'WEBSERVICE("https://ornek")'],
      ],
    };
    const result = await admin.post("/api/workspace/free/import", { name: "Taksit Planı", fileName: "plan.xlsx", sheet });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    const data = result.data.data;
    assert.equal(data.name, "Taksit Planı");
    assert.deepEqual(data.columns.map(column => column.name), ["Ay", "Tutar", "KDV", "Not"]);
    assert.equal(data.rows.length, 2);
    assert.equal(data.rows[0].cells[2].raw, "=B1*0.18");
    assert.equal(data.rows[0].cells[2].display, "180");
    assert.equal(data.rows[0].cells[3].raw, "x", "desteklenmeyen işlev: değer kalır");
    assert.deepEqual(data.imported, { rows: 2, columns: 4, formulas: 2, asValues: 1, skippedAbove: 0 });
    // Sayfa tablo görünümüne girer (sekme olarak): serbest sayfalar listesinde.
    const list = (await admin.get("/api/workspace/free")).data.data.sheets;
    assert.ok(list.some(item => item.name === "Taksit Planı"));
    // Aynı ad: otomatik "(2)".
    const again = await admin.post("/api/workspace/free/import", { name: "Taksit Planı", sheet });
    assert.equal(again.data.data.name, "Taksit Planı (2)");
  });

  it("Google Sheets: bağlantıdaki sekme (gid) aktarılır; formüller xlsx'ten gelir", async () => {
    const result = await admin.post("/api/workspace/free/import-sheets", { url: "https://docs.google.com/spreadsheets/d/GIDER/edit#gid=77" });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    const data = result.data.data;
    assert.equal(data.name, "Masraflar");
    assert.deepEqual(data.columns.map(column => column.name), ["Masraf", "Tutar", "KDV"]);
    assert.equal(data.rows[1].cells[2].raw, "=B2*0.2", "paylaşılan formül ikinci satıra açılır ve adresi çevrilir");
    assert.equal(data.rows[1].cells[2].display, "50");
    assert.equal((await admin.post("/api/workspace/free/import-sheets", { url: "https://example.com/x" })).status, 400);
  });

  it("sınırlar ve yetki: boş sayfa, çok satır, ekleme yetkisi olmayan", async () => {
    assert.equal((await admin.post("/api/workspace/free/import", { name: "Boş", sheet: { matrix: [[""]] } })).status, 400);
    const big = { matrix: [["A"], ...Array.from({ length: 2001 }, (_, n) => [String(n)])] };
    const tooMany = await admin.post("/api/workspace/free/import", { name: "Büyük", sheet: big });
    assert.equal(tooMany.status, 400);
    assert.match(tooMany.data.error, /2\.000 satır/);
    const staff = await createUser(server, admin, { username: "personel1" });
    const users = (await admin.get("/api/admin/users")).data.data;
    await admin.patch(`/api/admin/users/${users.find(user => user.username === "personel1").id}`, { grants: { remove: ["records.create"] } });
    assert.equal((await staff.post("/api/workspace/free/import", { name: "X", sheet: { matrix: [["A"], ["1"]] } })).status, 403);
  });
});
