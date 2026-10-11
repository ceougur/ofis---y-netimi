// Açılır listeli örnek .xlsx (v2.0.2 testleri): Excel'in yazdığı üç liste biçimi de var.
//  - "Durum" (C): satır içi liste "Aktif,Beklemede,Kapandı" (hata iletisi açık → yalnızca listeden)
//  - "Ödeme türü" (D): başka sayfadaki aralık, Excel 2010+ biçiminde (<x14:dataValidation>, Listeler!$A$2:$A$4)
//  - "Sorumlu" (E): tanımlı ad "Personel" → Listeler!$B$2:$B$3 (uyarı türü → listede olmayan değer de yazılabilir)
//  - başlığın üstündeki tek "seçim" hücresi (B1, boş) kolonları etkilemez
// "Listeler" sayfası gizlidir. Çalıştırılırsa dosyayı yazar: node test/fixtures/acilir-listeler.mjs <çıktı.xlsx>
import { writeFileSync } from "node:fs";
import { createZip } from "../../server/lib/zip.mjs";

const xml = body => Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${body}`);
const esc = text => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = index => String.fromCharCode(65 + index);
const sheetData = rows =>
  `<sheetData>${rows
    .map((cells, r) => `<row r="${r + 1}">${cells.map((value, c) => (value === "" || value == null ? "" : typeof value === "number" ? `<c r="${colName(c)}${r + 1}"><v>${value}</v></c>` : `<c r="${colName(c)}${r + 1}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`)).join("")}</row>`)
    .join("")}</sheetData>`;

export const KAYITLAR = [
  ["Dosya listesi"],
  ["Dosya No", "Müvekkil", "Durum", "Ödeme türü", "Sorumlu"],
  ["2026/1", "Ali Veli", "Aktif", "Nakit", "Selin"],
  ["2026/2", "Ayşe Kaya", "Beklemede", "Havale", "Mert"],
  ["2026/3", "Can Er", "Aktif", "Kredi kartı", ""],
  ["2026/4", "Deniz Ak", "", "", ""],
];
export const LISTELER = [
  ["Ödeme türleri", "Personel"],
  ["Nakit", "Selin"],
  ["Kredi kartı", "Mert"],
  ["Havale", ""],
];

export function acilirListelerXlsx() {
  const main = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision"><dimension ref="A1:E6"/>${sheetData(KAYITLAR)}<dataValidations count="3"><dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="B1"><formula1>"Tümü,Açık,Kapalı"</formula1></dataValidation><dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="C3:C200"><formula1>"Aktif,Beklemede,Kapandı"</formula1></dataValidation><dataValidation type="list" errorStyle="warning" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="E3:E200"><formula1>Personel</formula1></dataValidation></dataValidations><extLst><ext uri="{CCE6A557-97BC-4b89-ADB6-D9C93CAAB3DF}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:dataValidations count="1" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><x14:dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"><x14:formula1><xm:f>Listeler!$A$2:$A$4</xm:f></x14:formula1><xm:sqref>D3:D200</xm:sqref></x14:dataValidation></x14:dataValidations></ext></extLst></worksheet>`;
  const lists = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:B4"/>${sheetData(LISTELER)}</worksheet>`;
  return createZip([
    { name: "[Content_Types].xml", data: xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>') },
    { name: "_rels/.rels", data: xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    // Sayfa sırası bilerek dosya sırasından farklı: "Kayıtlar" sheet2.xml'dedir.
    { name: "xl/workbook.xml", data: xml('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Kayıtlar" sheetId="1" r:id="rId2"/><sheet name="Listeler" sheetId="2" state="hidden" r:id="rId1"/></sheets><definedNames><definedName name="Personel">Listeler!$B$2:$B$3</definedName></definedNames></workbook>') },
    { name: "xl/_rels/workbook.xml.rels", data: xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>') },
    { name: "xl/worksheets/sheet1.xml", data: xml(lists) },
    { name: "xl/worksheets/sheet2.xml", data: xml(main) },
  ]);
}

// Birleşik giriş kutulu örnek (Excel'in yazdığı biçim):
//  - "Öncelik" (C): her satırda bir Form denetimi açılan kutusu, liste Listeler!$A$2:$A$4, bağlı hücre C3…C6;
//    bağlı hücrede SIRA NUMARASI durur (2 → "Orta"). Son satırın kutusu yalnızca eski VML biçiminde.
//  - "Temsilci" (D): ActiveX birleşik giriş kutuları, ListFillRange = Listeler!$B$2:$B$3, bağlı hücrede metin.
export const KUTULU = [
  ["Görev", "Sorumlu", "Öncelik", "Temsilci"],
  ["Dilekçe", "Selin", "2", "Ayşe"],
  ["Keşif", "Mert", "3", "Burak"],
  ["Tebligat", "Selin", "1", "Ayşe"],
  ["Arşiv", "Mert", "0", ""],
];
export const KUTU_LISTELERI = [
  ["Öncelik", "Temsilci"],
  ["Düşük", "Ayşe"],
  ["Orta", "Burak"],
  ["Yüksek", ""],
];
export function birlesikKutuXlsx() {
  const form = (id, cell) => `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="x14"><control shapeId="${1024 + id}" r:id="rIdC${id}" name="Drop Down ${id}"><controlPr defaultSize="0" autoLine="0" autoPict="0"><anchor moveWithCells="1"><from><xdr:col>2</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${cell - 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></from><to><xdr:col>3</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${cell}</xdr:row><xdr:rowOff>0</xdr:rowOff></to></anchor></controlPr></control></mc:Choice></mc:AlternateContent>`;
  const activeX = (id, cell) => `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="x14"><control shapeId="${2048 + id}" r:id="rIdA${id}" name="ComboBox${id}"><controlPr defaultSize="0" autoLine="0" linkedCell="D${cell}" listFillRange="Listeler!$B$2:$B$3" r:id="rIdI${id}"><anchor moveWithCells="1"><from><xdr:col>3</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${cell - 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></from><to><xdr:col>4</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${cell}</xdr:row><xdr:rowOff>0</xdr:rowOff></to></anchor></controlPr></control></mc:Choice></mc:AlternateContent>`;
  const main = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">${sheetData(KUTULU.map(line => line.map(value => (/^\d+$/.test(value) ? Number(value) : value))))}<legacyDrawing r:id="rIdV"/><mc:AlternateContent><mc:Choice Requires="x14"><controls>${[2, 3, 4].map(row => form(row, row)).join("")}${[2, 3, 4, 5].map(row => activeX(row, row)).join("")}</controls></mc:Choice></mc:AlternateContent></worksheet>`;
  const ctrlProp = cell => `<formControlPr xmlns="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" objectType="Drop" dropStyle="combo" dx="16" fmlaLink="$C$${cell}" fmlaRange="Listeler!$A$2:$A$4" noThreeD="1" sel="1" val="0"/>`;
  const vml = `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><v:shape id="_x0000_s1029" type="#_x0000_t201"><x:ClientData ObjectType="Drop"><x:Anchor>2, 0, 4, 0, 3, 0, 5, 0</x:Anchor><x:FmlaLink>$C$5</x:FmlaLink><x:FmlaRange>Listeler!$A$2:$A$4</x:FmlaRange><x:Val>0</x:Val><x:Sel>1</x:Sel></x:ClientData></v:shape><v:shape id="_x0000_s1030"><x:ClientData ObjectType="Note"><x:Row>1</x:Row></x:ClientData></v:shape></xml>`;
  const relsFor = [
    '<Relationship Id="rIdV" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/>',
    ...[2, 3, 4].map(row => `<Relationship Id="rIdC${row}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/ctrlProp" Target="../ctrlProps/ctrlProp${row}.xml"/>`),
    ...[2, 3, 4, 5].map(row => `<Relationship Id="rIdA${row}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/control" Target="../activeX/activeX${row}.xml"/>`),
  ].join("");
  const lists = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sheetData(KUTU_LISTELERI)}</worksheet>`;
  return createZip([
    { name: "[Content_Types].xml", data: xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>') },
    { name: "_rels/.rels", data: xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    { name: "xl/workbook.xml", data: xml('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Görevler" sheetId="1" r:id="rId1"/><sheet name="Listeler" sheetId="2" state="hidden" r:id="rId2"/></sheets></workbook>') },
    { name: "xl/_rels/workbook.xml.rels", data: xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>') },
    { name: "xl/worksheets/sheet1.xml", data: xml(main) },
    { name: "xl/worksheets/_rels/sheet1.xml.rels", data: xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relsFor}</Relationships>`) },
    ...[2, 3, 4].map(row => ({ name: `xl/ctrlProps/ctrlProp${row}.xml`, data: xml(ctrlProp(row)) })),
    { name: "xl/drawings/vmlDrawing1.vml", data: Buffer.from(vml) },
    { name: "xl/worksheets/sheet2.xml", data: xml(lists) },
  ]);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const out = process.argv[2] || "acilir-listeler.xlsx";
  writeFileSync(out, process.argv[3] === "kutu" ? birlesikKutuXlsx() : acilirListelerXlsx());
  console.log(out);
}
