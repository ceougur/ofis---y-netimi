import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { applyIndexedCombos, comboRulesFromParts, controlsXml, fillMerges, inlineOptions, listRulesFromXml, mergeChoices, mergesFromXml, parseArea, parseRangeRef, readXlsxLists, resolveChoices, validationXml } from "../server/lib/choices.mjs";
import { matrixToRecords } from "../server/lib/sections.mjs";
import { readZip } from "../server/lib/zip.mjs";
import { KAYITLAR, KUTULU, KUTU_LISTELERI, LISTELER, acilirListelerXlsx, birlesikKutuXlsx } from "./fixtures/acilir-listeler.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

// Örnek dosyanın ana sayfası (sheet2.xml) — Excel'in yazdığı biçim.
const mainSheetXml = () => readZip(acilirListelerXlsx()).find(entry => entry.name === "xl/worksheets/sheet2.xml").data.toString("utf8");
const sheet = (name, matrix, rules = [], start = { r: 0, c: 0 }) => ({ name, matrix, start, rules, blocks: matrixToRecords(matrix, name, { layout: true }).blocks });

describe("açılır listeler: ayrıştırma (v2.0.2)", () => {
  it("klasik ve Excel 2010+ (x14) liste kuralları okunur; hata iletisi/uyarı türü katılığı belirler", () => {
    const rules = listRulesFromXml(validationXml(mainSheetXml()));
    assert.deepEqual(rules.map(rule => [rule.sqref, rule.formula, rule.strict]), [
      ["B1", '"Tümü,Açık,Kapalı"', true],
      ["C3:C200", '"Aktif,Beklemede,Kapandı"', true],
      ["E3:E200", "Personel", false],
      ["D3:D200", "Listeler!$A$2:$A$4", true],
    ]);
    // Liste dışındaki doğrulama türleri (tam sayı, tarih…) alınmaz; hata iletisi kapalıysa liste serbesttir.
    const other = listRulesFromXml('<dataValidations><dataValidation type="whole" sqref="A1"><formula1>1</formula1></dataValidation><dataValidation type="list" sqref="B2:B9"><formula1>"x,y"</formula1></dataValidation></dataValidations>');
    assert.deepEqual(other.map(rule => [rule.sqref, rule.strict]), [["B2:B9", false]]);
  });

  it("başvurular: sayfa adı tırnaklı/tırnaksız, tüm kolon; tek başına ad başvuru sayılmaz", () => {
    assert.deepEqual(parseRangeRef("Listeler!$A$2:$A$9", "X"), { sheet: "Listeler", area: { r1: 1, r2: 8, c1: 0, c2: 0 } });
    assert.deepEqual(parseRangeRef("'Ödeme ''türleri'''!B:B", "X").sheet, "Ödeme 'türleri'");
    assert.equal(parseRangeRef("'Ödeme türleri'!B:B", "X").area.r2, 1_048_575);
    assert.deepEqual(parseRangeRef("=$H$2:$H$20", "Kayıtlar"), { sheet: "Kayıtlar", area: { r1: 1, r2: 19, c1: 7, c2: 7 } });
    assert.equal(parseArea("TUR"), null, "tanımlı ad olabilir, kolon değil");
    assert.deepEqual(parseArea("C5"), { r1: 4, r2: 4, c1: 2, c2: 2 });
    assert.deepEqual(inlineOptions('"Evet,Hayır,""Belki"""'), ["Evet", "Hayır", '"Belki"']);
    assert.equal(inlineOptions("Personel"), null);
  });

  it("kolonlara bağlanır: satır içi, başka sayfa, tanımlı ad; başlık üstündeki seçim hücresi kolonu etkilemez", () => {
    const { sheets, names } = readXlsxLists(acilirListelerXlsx());
    const choices = resolveChoices([sheet("Kayıtlar", KAYITLAR, sheets.get("Kayıtlar")), sheet("Listeler", LISTELER)], names);
    assert.deepEqual(choices, {
      Kayıtlar: {
        Durum: { options: ["Aktif", "Beklemede", "Kapandı"], strict: true },
        "Ödeme türü": { options: ["Nakit", "Kredi kartı", "Havale"], strict: true },
        Sorumlu: { options: ["Selin", "Mert"], strict: false },
      },
    });
    assert.ok(!choices.Kayıtlar["Müvekkil"], "B1'deki kural kolona yayılmaz");
  });

  it("kayıtların yarısından azını kapsayan kural kolonu liste yapmaz; aynı listeli parçalı kurallar toplanır", () => {
    const matrix = [["Ad", "Tür"], ["a", "x"], ["b", "y"], ["c", "x"], ["d", "y"], ["e", "x"]];
    const one = resolveChoices([sheet("S", matrix, [{ sqref: "B2", formula: '"x,y"', strict: true }])]);
    assert.deepEqual(one, {});
    const split = resolveChoices([sheet("S", matrix, [{ sqref: "B2:B3", formula: '"x,y"', strict: true }, { sqref: "B4:B6", formula: '"x,y"', strict: true }])]);
    assert.deepEqual(split.S["Tür"].options, ["x", "y"]);
  });

  it("alt tablolu sayfada her tablo kendi kolonlarıyla; sayfa ofsetli (A1'den başlamayan) matris", () => {
    const matrix = [["Aktif"], ["No", "Durum"], ["1", "Açık"], ["2", "Kapalı"], [], ["Arşiv"], ["No", "Sonuç"], ["3", "Kazanıldı"], ["4", "Kaybedildi"]];
    // Sayfa C3'ten başlıyor: kurallar sayfa adresiyle (D5:D6 → Durum, D10:D11 → Sonuç).
    const choices = resolveChoices([sheet("Dosyalar", matrix, [{ sqref: "D5:D6", formula: '"Açık,Kapalı"', strict: true }, { sqref: "D10:D11", formula: '"Kazanıldı,Kaybedildi"', strict: true }], { r: 2, c: 2 })]);
    assert.deepEqual(Object.keys(choices).sort(), ["Dosyalar › Aktif", "Dosyalar › Arşiv"]);
    assert.deepEqual(choices["Dosyalar › Aktif"].Durum.options, ["Açık", "Kapalı"]);
    assert.deepEqual(choices["Dosyalar › Arşiv"]["Sonuç"].options, ["Kazanıldı", "Kaybedildi"]);
  });

  it("hesaplanan (DOLAYLI) ya da bulunamayan listeler atlanır; seçenekler tekilleşir, boşlar atılır", () => {
    const matrix = [["Ad", "Şehir", "İlçe"], ["a", "İzmir", "Konak"], ["b", "İzmir", "Bornova"]];
    const choices = resolveChoices([sheet("S", matrix, [{ sqref: "C2:C9", formula: "INDIRECT(B2)", strict: true }, { sqref: "B2:B9", formula: "Yok!A1:A5", strict: true }, { sqref: "A2:A9", formula: '" a , b ,a,,"', strict: false }])]);
    assert.deepEqual(choices, { S: { Ad: { options: ["a", "b"], strict: false } } });
  });

  it("birleşik giriş kutuları: Form denetimi (sıra numarası → metin), eski VML biçimi ve ActiveX", () => {
    const files = new Map(readZip(birlesikKutuXlsx()).map(entry => [entry.name, entry.data.toString("utf8")]));
    const parts = {};
    for (const [name, content] of files) if (/ctrlProps|vmlDrawing/.test(name)) parts[name.replace(/^xl\//, "../")] = content;
    const rules = comboRulesFromParts({ xml: controlsXml(files.get("xl/worksheets/sheet1.xml")), rels: files.get("xl/worksheets/_rels/sheet1.xml.rels"), parts });
    assert.deepEqual(
      rules.map(rule => [rule.sqref, rule.formula, rule.index, rule.strict]).sort(),
      [
        ["C2", "Listeler!$A$2:$A$4", true, true],
        ["C3", "Listeler!$A$2:$A$4", true, true],
        ["C4", "Listeler!$A$2:$A$4", true, true],
        ["C5", "Listeler!$A$2:$A$4", true, true],
        ["D2", "Listeler!$B$2:$B$3", false, false],
        ["D3", "Listeler!$B$2:$B$3", false, false],
        ["D4", "Listeler!$B$2:$B$3", false, false],
        ["D5", "Listeler!$B$2:$B$3", false, false],
      ],
    );
    const matrix = KUTULU.map(line => [...line]);
    const sheets = [{ name: "Görevler", matrix, rules }, { name: "Listeler", matrix: KUTU_LISTELERI, rules: [] }];
    assert.equal(applyIndexedCombos(sheets), 4);
    assert.deepEqual(matrix.map(line => line[2]), ["Öncelik", "Orta", "Yüksek", "Düşük", ""], "0 = seçim yok");
    const choices = resolveChoices(sheets.map(item => ({ ...item, blocks: matrixToRecords(item.matrix, item.name, { layout: true }).blocks })));
    assert.deepEqual(choices["Görevler"], { Öncelik: { options: ["Düşük", "Orta", "Yüksek"], strict: true }, Temsilci: { options: ["Ayşe", "Burak"], strict: false } });
    // Sunucunun okuduğu xlsx (Google yolu ile ortak okuyucu) da aynı kuralları bulur.
    assert.equal(readXlsxLists(birlesikKutuXlsx()).sheets.get("Görevler").length, 8);
  });

  it("birleştirme: kaynaktaki sekmeler yenilenir, diğer sekmelerin listeleri kalır", () => {
    const current = { A: { X: { options: ["1"], strict: true } }, "B › Alt": { Y: { options: ["2"], strict: true } }, C: { Z: { options: ["3"], strict: false } } };
    assert.deepEqual(mergeChoices(current, { A: { X: { options: ["9"], strict: true } } }, ["A", "B"]), { C: { Z: { options: ["3"], strict: false } }, A: { X: { options: ["9"], strict: true } } });
  });
});

describe("açılır listeler: içeri alma ve görünüm (v2.0.2)", () => {
  let server;
  let admin;
  const view = async () => (await admin.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json;
  const xlsx = acilirListelerXlsx();
  const fetchImpl = async url => {
    const target = String(url);
    if (target.includes("/edit")) return new Response('<title>Listeli - Google E-Tablolar</title><script>"gid":"0","name":"Kayıtlar" "gid":"7","name":"Listeler"</script>', { status: 200 });
    if (target.includes("format=xlsx")) return new Response(xlsx, { status: 200, headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
    const matrix = /gid=7/.test(target) ? LISTELER : KAYITLAR;
    return new Response(matrix.map(line => line.map(cell => `"${cell}"`).join(",")).join("\n"), { status: 200, headers: { "content-type": "text/csv; charset=utf-8" } });
  };

  before(async () => {
    server = await startTestServer({ fetchImpl });
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("Excel: tarayıcının gönderdiği doğrulama parçası ve tanımlı adlarla listeler kaydedilir ve görünümde gelir", async () => {
    const main = mainSheetXml();
    const sheets = [
      { name: "Kayıtlar", matrix: KAYITLAR, start: { r: 0, c: 0 }, validations: validationXml(main) },
      { name: "Listeler", matrix: LISTELER, start: { r: 0, c: 0 }, hidden: true },
    ];
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "listeli.xlsx", sheets, definedNames: [{ name: "Personel", ref: "Listeler!$B$2:$B$3", sheet: null }] });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace" })).status, 200);
    const data = await view();
    assert.deepEqual(data.choices["Kayıtlar"].Durum, { options: ["Aktif", "Beklemede", "Kapandı"], strict: true });
    assert.deepEqual(data.choices["Kayıtlar"].Sorumlu.options, ["Selin", "Mert"]);
    // Excel'de gizli liste sayfası programda da gizlenir; Silinenler'de gerekçesiyle görünür ve geri getirilebilir.
    assert.deepEqual(data.tabs.map(tab => tab.title), ["Kayıtlar"]);
    const item = (await admin.get("/api/admin/trash")).data.data.find(entry => entry.kind === "tab");
    assert.equal(item.title, "Listeler");
    assert.match(item.detail, /gizli liste sayfası/);
    assert.equal((await admin.post("/api/admin/trash/restore", { id: item.id })).status, 200);
    assert.deepEqual((await view()).tabs.map(tab => tab.title), ["Kayıtlar", "Listeler"]);
  });

  it("Excel birleşik giriş kutuları: kayıtlar kutuda görünen metinle gelir, kolon açılır liste olur", async () => {
    const files = new Map(readZip(birlesikKutuXlsx()).map(entry => [entry.name, entry.data.toString("utf8")]));
    const parts = {};
    for (const [name, content] of files) if (/ctrlProps|vmlDrawing/.test(name)) parts[name.replace(/^xl\//, "../")] = content;
    const sheets = [
      { name: "Görevler", matrix: KUTULU, start: { r: 0, c: 0 }, controls: { xml: controlsXml(files.get("xl/worksheets/sheet1.xml")), rels: files.get("xl/worksheets/_rels/sheet1.xml.rels"), parts } },
      { name: "Listeler", matrix: KUTU_LISTELERI, start: { r: 0, c: 0 }, hidden: true },
    ];
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "kutulu.xlsx", sheets });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "session", name: "Kutulu" })).status, 200);
    const data = await view();
    assert.deepEqual(data.rows.filter(row => row.__sheet === "Görevler").map(row => row["Öncelik"]), ["Orta", "Yüksek", "Düşük", ""]);
    assert.deepEqual(data.choices["Görevler"]["Öncelik"].options, ["Düşük", "Orta", "Yüksek"]);
    assert.equal(data.choices["Görevler"].Temsilci.strict, false);
    assert.deepEqual(data.tabs.map(tab => tab.title), ["Görevler"]);
    // Sonraki testler ilk oturumda sürer.
    const first = (await admin.get("/api/workspace/sessions")).data.data.sessions.find(item => item.name !== "Kutulu");
    assert.equal((await admin.post("/api/workspace/sessions/select", { key: first.key })).status, 200);
  });

  it("sekme yeniden adlandırılınca listeler yeni adla; silinen sekmenin listesi gönderilmez", async () => {
    assert.equal((await admin.post("/api/workspace/tabs/rename", { tab: "Kayıtlar", name: "Dosyalar" })).status, 200);
    let data = await view();
    assert.ok(data.choices.Dosyalar?.Durum && !data.choices["Kayıtlar"]);
    assert.equal((await admin.post("/api/workspace/tabs/hide", { tab: "Dosyalar" })).status, 200);
    data = await view();
    assert.ok(!data.choices.Dosyalar);
    assert.equal((await admin.post("/api/workspace/tabs/unhide", { original: "Kayıtlar" })).status, 200);
    assert.equal((await admin.post("/api/workspace/tabs/rename", { tab: "Dosyalar", name: "" })).status, 200);
  });

  it("Google Sheets: xlsx çıktısındaki listeler okunur; veri kaldırılınca listeler de gider", async () => {
    const staged = await admin.post("/api/workspace/dataset/stage", { kind: "sheets", url: "https://docs.google.com/spreadsheets/d/LISTELI/edit" });
    assert.equal(staged.status, 200, JSON.stringify(staged.data));
    assert.equal((await admin.post("/api/workspace/dataset/commit", { stageId: staged.data.data.stageId, mode: "replace", link: false })).status, 200);
    const data = await view();
    assert.deepEqual(data.choices["Kayıtlar"]["Ödeme türü"].options, ["Nakit", "Kredi kartı", "Havale"]);
    assert.deepEqual(data.tabs.map(tab => tab.title), ["Kayıtlar"], "Sheets'te gizli liste sekmesi");
    assert.equal((await admin.del("/api/workspace/dataset")).status, 200);
    const after = await view();
    assert.ok(!after.choices || !Object.keys(after.choices).length);
  });
});

describe("birleştirilmiş hücreler (v2.0.2)", () => {
  it("xlsx'teki mergeCell alanları okunur ve dikey birleştirme CSV matrisine yazılır", () => {
    const merges = mergesFromXml('<sheetData/><mergeCells count="2"><mergeCell ref="A3:A5"/><mergeCell ref="B1:C1"/></mergeCells>');
    assert.deepEqual(merges, [
      { s: { r: 2, c: 0 }, e: { r: 4, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
    ]);
    const matrix = [["", "Kişi", ""], ["Müvekkil", "Dosya", "Tutar"], ["Ali Veli", "2026/1", "1500"], ["", "2026/2", "2000"], ["", "2026/3", "750"], ["Ayşe", "2026/4", "900"]];
    fillMerges(matrix, merges);
    assert.deepEqual(matrix.map(row => row[0]), ["", "Müvekkil", "Ali Veli", "Ali Veli", "Ali Veli", "Ayşe"]);
    assert.deepEqual(matrix[0], ["", "Kişi", ""], "yatay birleştirme dokunulmaz");
    // Dosyada birleştirme yoksa liste okuyucu boş bir harita döndürür.
    assert.equal(readXlsxLists(acilirListelerXlsx()).merges.size, 0);
  });
});
