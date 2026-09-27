// Serbest sayfalar (v2.0.1): "+" ile açılan, Excel gibi doldurulan sekmeler.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readZip } from "../server/lib/zip.mjs";
import { computeSheet, rewriteReferences, shiftReferences, translateFormula } from "../server/lib/formula/sheet.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

describe("serbest sayfa formül motoru", () => {
  const grid = (lines, options) => computeSheet({ columns: lines[0].map((_, c) => ({ id: `c${c}` })), rows: lines.map((_, r) => ({ id: `r${r}` })), raw: (r, c) => lines[r][c] ?? "" }, options);

  it("Türkçe işlev adları, ';' ayracı ve ondalık virgül çevrilir; metin içindekiler korunur", () => {
    assert.equal(translateFormula('=EĞER(B1>1,5;"a;b, c";YANLIŞ)'), 'IF(B1>1.5,"a;b, c",FALSE)');
    assert.equal(translateFormula("=topla(A1:A3)"), "SUM(A1:A3)");
    assert.equal(translateFormula("=BAĞ_DEĞ_SAY(A:A)"), "COUNT(A:A)");
    assert.equal(translateFormula("=B1*1,5"), "B1*1.5");
    assert.equal(translateFormula("=SUM(A1,B1)"), "SUM(A1,B1)");
    assert.throws(() => translateFormula("=("));
  });

  it("kolon/satır ekleme-silmede başvurular kayar; $ ile sabitlenen de yapıya uyar; silinen #REF! olur", () => {
    assert.equal(rewriteReferences("=B1*C1+$D$2", { axis: "col", op: "insert", index: 1, count: 1 }), "=C1*D1+$E$2");
    assert.equal(rewriteReferences("=TOPLA(A1:A9)", { axis: "row", op: "delete", index: 2, count: 3 }), "=TOPLA(A1:A6)");
    assert.equal(rewriteReferences("=A3+A9", { axis: "row", op: "delete", index: 2, count: 1 }), "=#REF!+A8");
    assert.equal(rewriteReferences("=TOPLA(B:D)", { axis: "col", op: "delete", index: 1, count: 1 }), "=TOPLA(B:C)");
    assert.equal(rewriteReferences('="A1 "&A1', { axis: "row", op: "insert", index: 0, count: 2 }), '="A1 "&A3', "metindeki A1'e dokunulmaz");
    assert.equal(shiftReferences("=B1*$C$1+C$1", 3, 0), "=B4*$C$1+C$1");
    assert.equal(shiftReferences("=A1", -1, 0), "=#REF!");
  });

  it("hesaplama: biçim devralma, hata kodları, döngü; 2000 satırlık zincirler yığını taşırmaz", () => {
    const out = grid([
      ["10,00 ₺", "3", "=A1*B1", "=TOPLA(C1:C2)"],
      ["=A1+5", "x", "=A2/0", "=YUVARLA(ORTALAMA(A1:A2);1)"],
      ["=D3", "=C1>20", "=BUGÜN()+30", '=EĞER(B2="x";"evet";"hayır")'],
    ], { now: new Date("2026-01-15T09:00:00Z") });
    assert.equal(out[0][2].display, "30,00 ₺");
    assert.equal(out[1][0].display, "15,00 ₺");
    assert.equal(out[1][2].display, "#SAYI/0!");
    assert.equal(out[0][3].display, "#SAYI/0!", "hata toplamdan geçer");
    assert.equal(out[1][3].display, "12,50 ₺");
    assert.equal(out[2][0].display, "evet", "sağdaki formüle başvuru");
    assert.equal(out[2][1].display, "DOĞRU");
    assert.equal(out[2][3].display, "evet");
    const dates = grid([["15.10.2026", "=A1-10", "=A1-A2", "=YIL(BUGÜN())", "=BUGÜN()+30"], ["01.10.2026", "=GÜNSAY(A1;A2)", "=1500*2", "=TARİH(2026;1;31)", "=A2+B2"]], { now: new Date("2026-01-15T09:00:00Z") });
    assert.deepEqual(dates[0].map(cell => cell.display), ["15.10.2026", "05.10.2026", "14", "2026", "14.02.2026"]);
    assert.deepEqual(dates[1].map(cell => cell.display), ["01.10.2026", "14", "3000", "31.01.2026", "15.10.2026"]);
    const long = Array.from({ length: 2000 }, (_, r) => [r === 1999 ? "5" : `=A${r + 2}+1`, r === 0 ? "=C1" : "", r === 0 ? "=B1" : ""]);
    const deep = grid(long);
    assert.equal(deep[0][0].display, "2004");
    assert.equal(deep[0][1].display, "#DÖNGÜ!");
  });
});

describe("serbest sayfalar", () => {
  let server;
  let admin;
  let staff;
  let sheet;
  const rowsOf = async (client = admin) => (await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json;
  const display = (detail, r, c) => detail.rows[r].cells[c].display;
  const put = (cells, client = admin) => client.put(`/api/workspace/free/${sheet.id}/cells`, { cells });
  const cellAt = (detail, r, c) => ({ row: detail.rows[r].id, col: detail.columns[c].id });

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    staff = await createUser(server, admin, { username: "selin", name: "Selin Kaya", role: "personel" });
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "veri.xlsx", sheets: [{ name: "Müşteriler", matrix: [["No", "Ad"], ["1", "Ali"], ["2", "Ayşe"]] }] });
    await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" });
  });
  after(() => server.close());

  it("sayfa adla açılır; boşken de sekme olarak görünür; ad veri sekmesiyle ya da başka sayfayla çakışamaz", async () => {
    const created = await staff.post("/api/workspace/free", { name: "  Masraflar ", columns: 4, rows: 3 });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    sheet = created.data.data;
    assert.equal(sheet.name, "Masraflar");
    assert.deepEqual(sheet.columns.map(column => column.letter), ["A", "B", "C", "D"]);
    assert.deepEqual(sheet.columns.map(column => column.header), ["Sütun A", "Sütun B", "Sütun C", "Sütun D"]);
    assert.equal(sheet.rows.length, 3);
    const view = await rowsOf();
    assert.deepEqual(view.tabs.map(tab => tab.title), ["Müşteriler", "Masraflar"]);
    assert.ok(!view.rows.some(row => row.__sheet === "Masraflar"), "boş satır kayıt sayılmaz");
    assert.equal((await admin.post("/api/workspace/free", { name: "müşteriler" })).status, 409);
    assert.equal((await admin.post("/api/workspace/free", { name: "Masraflar" })).status, 409);
    assert.equal((await admin.post("/api/workspace/free", { name: "A › B" })).status, 400);
  });

  it("başlıklar ve hücreler yazılır; Türkçe formüller hesaplanır; görünüm satırı kolon adlarıyla gelir", async () => {
    for (const [index, name] of ["Kalem", "Adet", "Birim fiyat", "Tutar"].entries()) assert.equal((await staff.put(`/api/workspace/free/${sheet.id}/columns/${sheet.columns[index].id}`, { name })).status, 200);
    let detail = (await put([
      { ...cellAt(sheet, 0, 0), raw: "Kırtasiye" }, { ...cellAt(sheet, 0, 1), raw: "3" }, { ...cellAt(sheet, 0, 2), raw: "12,50 ₺" }, { ...cellAt(sheet, 0, 3), raw: "=B1*C1" },
      { ...cellAt(sheet, 1, 0), raw: "Kargo" }, { ...cellAt(sheet, 1, 1), raw: "2" }, { ...cellAt(sheet, 1, 2), raw: "40,00 ₺" }, { ...cellAt(sheet, 1, 3), raw: "=b2*c2" },
      { ...cellAt(sheet, 2, 0), raw: "Durum" }, { ...cellAt(sheet, 2, 3), raw: "=EĞER(TOPLA(D1:D2)>100;\"Yüksek\";\"Düşük\")" },
    ], staff)).data.data;
    assert.equal(display(detail, 0, 3), "37,50 ₺");
    assert.equal(display(detail, 1, 3), "80,00 ₺");
    assert.equal(display(detail, 2, 3), "Yüksek");
    const rows = (await rowsOf()).rows.filter(row => row.__sheet === "Masraflar");
    assert.equal(rows.length, 3);
    assert.equal(rows[0].Kalem, "Kırtasiye");
    assert.equal(rows[0].Tutar, "37,50 ₺");
    assert.match(rows[0].__hofKey, /^serbest:/);
    assert.deepEqual(JSON.parse(rows[0].__hofFx), { Tutar: { d: "=B1*C1", s: "calc" } });
    // Hatalı formül ve döngü
    detail = (await put([{ ...cellAt(sheet, 2, 1), raw: "=YOKBÖYLEİŞLEV(1)" }, { ...cellAt(sheet, 2, 2), raw: "=C3" }])).data.data;
    assert.equal(display(detail, 2, 1), "#AD?");
    assert.equal(display(detail, 2, 2), "#DÖNGÜ!");
    await put([{ ...cellAt(sheet, 2, 1), raw: "" }, { ...cellAt(sheet, 2, 2), raw: "" }]);
  });

  it("detay kartından yapılan düzeltme hücreye yazılır; formül yeniden hesaplanır; not satıra bağlı kalır", async () => {
    const [first] = (await rowsOf()).rows.filter(row => row.__sheet === "Masraflar");
    assert.equal((await staff.post("/api/workspace/overrides", { caseKey: first.__hofKey, field: "Adet", value: "5" })).status, 200);
    assert.equal((await rowsOf()).rows.find(row => row.__hofKey === first.__hofKey).Tutar, "62,50 ₺");
    assert.equal((await staff.post(`/api/workspace/cases/${encodeURIComponent(first.__hofKey)}/notes`, { note: "Fatura geldi" })).status, 200);
    const detail = (await admin.get(`/api/workspace/free/${sheet.id}`)).data.data;
    assert.equal(detail.rows[0].cells[1].raw, "5");
    assert.equal((await staff.post("/api/workspace/deleted", { caseKey: first.__hofKey })).status, 403);
    assert.equal((await admin.post("/api/workspace/deleted", { caseKey: first.__hofKey })).status, 400, "serbest satır kayıt silme ucuyla silinmez");
  });

  it("'Yeni kayıt' formu sayfanın ilk boş satırına yazar; kolonları sayfanın başlıklarıdır", async () => {
    const columns = (await staff.get(`/api/workspace/sources/columns?tab=${encodeURIComponent("Masraflar")}`)).data.data;
    assert.deepEqual(columns.columns, ["Kalem", "Adet", "Birim fiyat", "Tutar"]);
    const added = await staff.post("/api/workspace/records", { sheet: "Masraflar", values: { Kalem: "Yemek", Adet: "4", "Birim fiyat": "25,00 ₺" } });
    assert.equal(added.status, 200, JSON.stringify(added.data));
    const detail = (await admin.get(`/api/workspace/free/${sheet.id}`)).data.data;
    assert.equal(detail.rows.length, 4, "boş satır kalmadığı için sona satır eklendi");
    assert.equal(detail.rows[3].cells[0].raw, "Yemek");
    assert.equal(detail.rows[3].cells[3].raw, "=B4*C4", "kolon formülü yeni satıra uygulanır");
    assert.equal(detail.rows[3].cells[3].display, "100,00 ₺");
  });

  it("araya kolon eklenince ve kolon silinince formül başvuruları kayar; silinen hücreye başvuru #BAŞV! olur; geri alınır", async () => {
    let detail = (await admin.post(`/api/workspace/free/${sheet.id}/columns`, { index: 1, names: ["Tarih"] })).data.data;
    assert.deepEqual(detail.columns.map(column => column.header), ["Kalem", "Tarih", "Adet", "Birim fiyat", "Tutar"]);
    assert.equal(detail.rows[0].cells[4].raw, "=C1*D1");
    assert.equal(detail.rows[0].cells[4].display, "62,50 ₺");
    assert.equal((await staff.delete?.(`/api/workspace/free/${sheet.id}/columns/${detail.columns[1].id}`)) ?? true, true);
    assert.equal((await staff.raw("DELETE", `/api/workspace/free/${sheet.id}/columns/${detail.columns[1].id}`)).status, 403, "personel kolon silemez");
    detail = (await admin.raw("DELETE", `/api/workspace/free/${sheet.id}/columns/${detail.columns[2].id}`)).data.data; // Adet silindi
    assert.equal(detail.rows[0].cells[3].raw, "=#REF!*C1");
    assert.equal(detail.rows[0].cells[3].display, "#BAŞV!");
    detail = (await admin.post(`/api/workspace/free/${sheet.id}/undo`)).data.data;
    assert.deepEqual(detail.columns.map(column => column.header), ["Kalem", "Tarih", "Adet", "Birim fiyat", "Tutar"]);
    assert.equal(detail.rows[0].cells[4].display, "62,50 ₺");
    detail = (await admin.post(`/api/workspace/free/${sheet.id}/undo`)).data.data;
    assert.deepEqual(detail.columns.map(column => column.header), ["Kalem", "Adet", "Birim fiyat", "Tutar"]);
    sheet = detail;
  });

  it("satır silinince alttaki formüller kayar; alt toplam ve yan toplam eklenir; aşağı doldurma", async () => {
    let detail = (await admin.raw("DELETE", `/api/workspace/free/${sheet.id}/rows/${sheet.rows[2].id}`)).data.data; // "Durum" satırı
    assert.equal(detail.rows.length, 3);
    assert.equal(detail.rows[2].cells[3].raw, "=B3*C3");
    detail = (await admin.post(`/api/workspace/free/${sheet.id}/totals`, { kind: "row" })).data.data;
    const total = detail.rows.at(-1).cells;
    assert.equal(total[0].raw, "Toplam");
    assert.equal(total[1].raw, "=TOPLA(B1:B3)");
    assert.equal(total[1].display, "11");
    assert.equal(total[3].display, "242,50 ₺");
    detail = (await admin.post(`/api/workspace/free/${sheet.id}/totals`, { kind: "column" })).data.data;
    assert.equal(detail.columns.at(-1).header, "Toplam");
    assert.equal(detail.rows[0].cells.at(-1).raw, "=TOPLA(C1:D1)", "yan toplam para kolonlarını toplar (adet ile ₺ karışmaz)");
    assert.deepEqual(detail.summed, ["Birim fiyat", "Tutar"]);
    // Aşağı doldurma: yeni kolona formül yazılıp diğer satırlara uygulanır.
    detail = (await admin.post(`/api/workspace/free/${sheet.id}/columns`, { names: ["KDV"] })).data.data;
    const kdv = detail.columns.at(-1).id;
    detail = (await put([{ row: detail.rows[0].id, col: kdv, raw: "=D1*0,2" }])).data.data;
    detail = (await admin.post(`/api/workspace/free/${sheet.id}/fill`, { row: detail.rows[0].id, col: kdv })).data.data;
    assert.deepEqual(detail.rows.map(row => row.cells.at(-1).raw), ["=D1*0,2", "=D2*0,2", "=D3*0,2", ""], "toplam satırına dokunulmaz");
    assert.equal(detail.filled, 2);
    assert.equal(detail.rows[1].cells.at(-1).display, "16,00 ₺");
    // Sağa doldurma: toplam satırındaki B toplamı C'ye kayar; yan toplam kolonu (satırı aralıkla toplayan) atlanır.
    const totalRow = detail.rows.at(-1);
    await put([{ row: totalRow.id, col: detail.columns[2].id, raw: "" }]);
    detail = (await admin.post(`/api/workspace/free/${sheet.id}/fill`, { row: totalRow.id, col: detail.columns[1].id, axis: "right" })).data.data;
    assert.deepEqual(detail.rows.at(-1).cells.map(cell => cell.raw), ["Toplam", "=TOPLA(B1:B3)", "=TOPLA(C1:C3)", "=TOPLA(D1:D3)", "=TOPLA(C4:D4)", "=TOPLA(F1:F3)"], "genel toplam hücresi korunur");
    sheet = detail;
  });

  it("toplamlar tarih kolonunu toplamaz; yan toplam seçilen kolon aralığını toplar", async () => {
    const created = (await admin.post("/api/workspace/free", { name: "Aylık", names: ["Ay", "Vade", "Ocak", "Şubat", "Adet"], rows: 3 })).data.data;
    const cells = [["Kira", "15.10.2026", "1.000 ₺", "1.100 ₺", "2"], ["Aidat", "20.10.2026", "200 ₺", "250 ₺", "3"]].flatMap((line, r) => line.map((raw, c) => ({ r, c, raw })));
    await admin.put(`/api/workspace/free/${created.id}/cells`, { cells });
    let detail = (await admin.post(`/api/workspace/free/${created.id}/totals`, { kind: "row" })).data.data;
    assert.deepEqual(detail.rows[2].cells.map(cell => cell.raw), ["Toplam", "", "=TOPLA(C1:C2)", "=TOPLA(D1:D2)", "=TOPLA(E1:E2)"]);
    assert.equal(detail.rows[2].cells[2].display, "1.200 ₺");
    detail = (await admin.post(`/api/workspace/free/${created.id}/undo`, { snapshot: detail.snapshot })).data.data;
    detail = (await admin.post(`/api/workspace/free/${created.id}/totals`, { kind: "column", from: 2, to: 4 })).data.data;
    assert.equal(detail.rows[0].cells.at(-1).raw, "=TOPLA(C1:E1)", "seçilen aralık (para + adet) olduğu gibi toplanır");
    detail = (await admin.post(`/api/workspace/free/${created.id}/undo`, { snapshot: detail.snapshot })).data.data;
    detail = (await admin.post(`/api/workspace/free/${created.id}/totals`, { kind: "column" })).data.data;
    assert.equal(detail.rows[1].cells.at(-1).raw, "=TOPLA(C2:D2)");
    assert.equal(detail.rows[1].cells.at(-1).display, "450 ₺");
    await admin.raw("DELETE", `/api/workspace/free/${created.id}`);
  });

  it("yalnızca formül taşıyan satır kayıt sayılmaz; detay kartı alanın ham formülünü görür; kolon adı iç alanlarla çakışmaz", async () => {
    const created = (await admin.post("/api/workspace/free", { name: "Deneme", names: ["Ad", "__sheet", "Puan"], rows: 3 })).data.data;
    assert.deepEqual(created.columns.map(column => column.header), ["Ad", "sheet", "Puan", "Sütun D"]);
    let detail = (await admin.put(`/api/workspace/free/${created.id}/cells`, { cells: [{ r: 0, c: 0, raw: "Ali" }, { r: 0, c: 2, raw: "7" }, { r: 1, c: 2, raw: "=C1*2" }], grow: false })).data.data;
    assert.deepEqual(detail.rows.map(row => row.record), [true, false, false]);
    const rows = (await rowsOf()).rows.filter(row => row.__sheet === "Deneme");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sheet, "", "kolon adı kaydın __sheet alanını ezmez");
    const raws = (await admin.get(`/api/workspace/overrides?sourceName=x&caseKey=${encodeURIComponent(detail.rows[1].key)}`)).data.data;
    assert.deepEqual(raws.map(item => [item.field, item.value]), [["Puan", "=C1*2"]]);
    // Boş satırı ekleme yetkisi olan siler; dolu satırı silemez.
    assert.equal((await staff.raw("DELETE", `/api/workspace/free/${created.id}/rows/${detail.rows[2].id}`)).status, 200);
    assert.equal((await staff.raw("DELETE", `/api/workspace/free/${created.id}/rows/${detail.rows[0].id}`)).status, 403);
    assert.equal((await staff.raw("DELETE", `/api/workspace/free/${created.id}/columns/${detail.columns[3].id}`)).status, 200, "boş kolon");
    // Geri alma: işlemden sonra başka kullanıcı hücre değiştirdiyse ya da başka yapı değişikliği varsa yapılmaz.
    const added = (await admin.post(`/api/workspace/free/${created.id}/rows`, { index: 0 })).data.data;
    assert.ok(added.snapshot);
    await staff.put(`/api/workspace/free/${created.id}/cells`, { cells: [{ r: 1, c: 1, raw: "x" }] });
    assert.equal((await admin.post(`/api/workspace/free/${created.id}/undo`, { snapshot: added.snapshot })).status, 409);
    await staff.put(`/api/workspace/free/${created.id}/cells`, { cells: [{ r: 1, c: 1, raw: "" }] });
    const removed = (await admin.raw("DELETE", `/api/workspace/free/${created.id}/rows/${added.rows[0].id}`)).data.data;
    assert.equal((await admin.post(`/api/workspace/free/${created.id}/undo`, { snapshot: added.snapshot })).status, 409, "sonraki silme varken önceki geri alınmaz");
    detail = (await admin.post(`/api/workspace/free/${created.id}/undo`, { snapshot: removed.snapshot })).data.data;
    assert.equal(detail.rows.length, 3);
    // Formül kopyalanıp yapıştırılınca başvurular kayar.
    detail = (await admin.put(`/api/workspace/free/${created.id}/cells`, { cells: [{ r: 2, c: 2, raw: "=C1*2", shift: [1, 0] }] })).data.data;
    assert.equal(detail.rows[2].cells[2].raw, "=C2*2");
    await admin.raw("DELETE", `/api/workspace/free/${created.id}`);
  });

  it("Excel'den yapıştırılan tablo gerekirse satır ve kolon ekleyerek yazılır", async () => {
    const grid = [["A", "1"], ["B", "2"], ["C", "3"], ["D", "4"], ["E", "5"], ["F", "6"]];
    const start = sheet.rows.length;
    const response = await admin.put(`/api/workspace/free/${sheet.id}/cells`, { grow: true, cells: grid.flatMap((line, r) => line.map((raw, c) => ({ r: start + r, c: 5 + c, raw }))) });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    const detail = response.data.data;
    assert.equal(detail.rows.length, start + 6);
    assert.equal(detail.columns.length, 7);
    assert.equal(detail.rows.at(-1).cells[6].raw, "6");
    assert.equal((await staff.put(`/api/workspace/free/${sheet.id}/cells`, { grow: true, cells: [{ r: 99, c: 0, raw: "x" }] })).status, 200, "personel ekleme yetkisiyle yapıştırabilir");
  });

  it("kolon sayısı 500'e kadar; toplam hücre sınırı açık bir iletiyle söylenir (v2.0.2)", async () => {
    const wide = await admin.post("/api/workspace/free", { name: "Geniş sayfa", columns: 200, rows: 50 });
    assert.equal(wide.status, 200, JSON.stringify(wide.data));
    assert.equal(wide.data.data.columns.length, 200);
    const more = await admin.post(`/api/workspace/free/${wide.data.data.id}/columns`, { index: 200, count: 100 });
    assert.equal(more.status, 200, JSON.stringify(more.data));
    assert.equal(more.data.data.columns.length, 300);
    const tooMany = await admin.post("/api/workspace/free", { name: "Çok geniş", columns: 500, rows: 600 });
    assert.equal(tooMany.status, 400);
    assert.match(tooMany.data.error, /en fazla 250\.000 hücre/);
    assert.equal((await admin.post("/api/workspace/free", { name: "En geniş", columns: 500, rows: 10 })).status, 200);
    const over = await admin.post(`/api/workspace/free/${(await admin.get("/api/workspace/free")).data.data.sheets.find(item => item.name === "En geniş").id}/columns`, { count: 1 });
    assert.equal(over.status, 400);
    assert.match(over.data.error, /en fazla 500 kolon/);
    for (const name of ["Geniş sayfa", "En geniş"]) {
      const sheet = (await admin.get("/api/workspace/free")).data.data.sheets.find(item => item.name === name);
      assert.equal((await admin.del(`/api/workspace/free/${sheet.id}`)).status, 200);
    }
  });

  it("sayfa yeniden adlandırılır, silinir ve geri alınır; Excel'e aktarmada sayfa olarak yer alır", async () => {
    assert.equal((await admin.raw("PATCH", `/api/workspace/free/${sheet.id}`, { body: JSON.stringify({ name: "Giderler" }), headers: { "content-type": "application/json" } })).status, 200);
    const exported = await admin.raw("GET", "/api/workspace/export.xlsx?all=1");
    const files = new Map(readZip(exported.buffer).map(entry => [entry.name, entry.data.toString("utf8")]));
    assert.match(files.get("xl/workbook.xml"), /<sheet name="Giderler"/);
    assert.equal((await staff.raw("DELETE", `/api/workspace/free/${sheet.id}`)).status, 403);
    assert.equal((await admin.raw("DELETE", `/api/workspace/free/${sheet.id}`)).status, 200);
    assert.ok(!(await rowsOf()).tabs.some(tab => tab.title === "Giderler"));
    assert.equal((await admin.post(`/api/workspace/free/${sheet.id}/restore`)).status, 200);
    assert.ok((await rowsOf()).tabs.some(tab => tab.title === "Giderler"));
  });

  it("serbest sayfalar veri oturumuna özeldir; oturum silinince sayfaları da silinir", async () => {
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "baska.xlsx", sheets: [{ name: "Araçlar", matrix: [["Plaka"], ["42 A 1"]] }] });
    const opened = (await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "session", name: "Araçlar" })).data.data;
    assert.ok(!(await rowsOf()).tabs.some(tab => tab.title === "Giderler"), "yeni oturumda görünmez");
    assert.ok((await rowsOf(staff)).tabs.some(tab => tab.title === "Giderler"), "ilk oturumda durur");
    const other = (await admin.post("/api/workspace/free", { name: "Araç masrafları" })).data.data;
    assert.equal((await admin.post("/api/workspace/sessions/delete", { key: opened.session.key })).status, 200);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS count FROM free_sheets WHERE id = ?", other.id).count, 0);
  });
});
