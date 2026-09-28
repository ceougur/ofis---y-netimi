// Bağımlılıksız .xlsx yazıcı (v2.0.1, "Dışa aktar → Excel").
// Tablodaki değerler ekranda göründüğü gibi Türkçe metindir; Excel'de hesap yapılabilsin diye tutar, sayı, yüzde ve
// tarihler gerçek Excel sayısına çevrilir ve görünüşleri sayı biçimiyle korunur (20.000,00 ₺, 12.03.2026). Çeviri
// ancak geri biçimlendirilen değer hücrenin metnini birebir veriyorsa yapılır; dosya no, telefon, T.C. kimlik no gibi
// değerler bozulmasın diye baştaki sıfırlı, 10 haneden uzun tam sayılar ve tanınmayan ekli metinler metin kalır.
import { createZip } from "./zip.mjs";
import { describeFormat, formatValue, parseCellText } from "./formula/values.mjs";

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
// XML 1.0'da izin verilmeyen denetim karakterleri atılır (Excel dosyayı "onarmak" istemesin).
const clean = value => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "");
const xml = value => clean(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MAX_CELL_TEXT = 32_767;
// Sayının önünde/ardında kabul edilen birimler; "1.500 TL + faiz" gibi açıklamalı hücreler metin kalır.
const UNIT = /^\s*(₺|TL|TRY|\$|USD|€|EUR|£|GBP|m²|m2|adet|kg|gr|lt|km|gün|ay|yıl|saat|dk)?\s*$/i;

export const columnName = index => {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};

// Excel sayı biçimi: binlik "," ondalık "." (Excel kullanıcının diline göre 20.000,00 gösterir); birimler tırnakta.
const quote = text => (text ? `"${text.replace(/"/g, "")}"` : "");
function numberFormatCode(format) {
  if (format.kind === "date") return format.time ? (format.seconds ? "dd.mm.yyyy hh:mm:ss" : "dd.mm.yyyy hh:mm") : "dd.mm.yyyy";
  const digits = format.decimals ? `.${"0".repeat(format.decimals)}` : "";
  if (format.kind === "percent") return `0${digits}%`;
  const body = `${format.grouping ? "#,##0" : "0"}${digits}`;
  return `${quote(format.prefix)}${body}${quote(format.suffix)}`;
}

// Tek hücre: { value, format } (sayı) ya da { text }.
// Hızlı yol (v2.0.6, 200 bin satırlık dökümler): rakam içermeyen metin sayı olamaz, ayrıştırıcıya girmez; aynı metin
// tekrarlanıyorsa ("Müşteri", "adet", "0,00") sonuç önbellekten gelir.
const typedCache = new Map();
export function typedCell(text) {
  const raw = clean(text).trim();
  if (!raw) return null;
  if (!/\d/.test(raw)) return { text: raw };
  if (raw.length <= 24) {
    const hit = typedCache.get(raw);
    if (hit) return hit;
    const computed = typedCellSlow(raw);
    if (typedCache.size > 5000) typedCache.clear();
    typedCache.set(raw, computed);
    return computed;
  }
  return typedCellSlow(raw);
}
function typedCellSlow(raw) {
  const parsed = parseCellText(raw);
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return { text: raw };
  const format = describeFormat(raw);
  if (!format) return { text: raw };
  if (format.kind === "number") {
    if (!UNIT.test(format.prefix) || !UNIT.test(format.suffix)) return { text: raw };
    const digits = raw.replace(/\D/g, "");
    // Uzun tam sayılar (T.C. kimlik, hesap no, telefon) Excel'de bilimsel gösterime ya da yuvarlamaya düşmesin.
    if (!format.decimals && !format.grouping && !format.prefix.trim() && !format.suffix.trim() && digits.length >= 10) return { text: raw };
  }
  const same = (a, b) => a.replace(/\s+/g, " ") === b.replace(/\s+/g, " ");
  if (!same(formatValue(parsed, raw), raw)) return { text: raw };
  return { value: parsed, format: numberFormatCode(format) };
}

const safeSheetName = (name, used) => {
  const base = clean(name).replace(/[[\]:*?/\\]+/g, " ").replace(/^'+|'+$/g, "").replace(/\s+/g, " ").trim().slice(0, 31) || "Sayfa";
  let candidate = base;
  for (let index = 2; used.has(candidate.toLocaleLowerCase("tr-TR")); index += 1) {
    const suffix = ` (${index})`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(candidate.toLocaleLowerCase("tr-TR"));
  return candidate;
};

/**
 * @param {Array<{ name: string, columns: string[], headers?: string[], rows: Array<Record<string, unknown>> }>} sheets
 *   columns: satırdaki alan adları; headers: başlık satırında görünecek adlar (verilmezse columns)
 * @param {{ title?: string, creator?: string, now?: Date }} options
 * @returns {Buffer} .xlsx içeriği
 */
export function buildXlsx(sheets, { title = "DestekOfis", creator = "DestekOfis", now = new Date() } = {}) {
  const list = sheets.length ? sheets : [{ name: "Sayfa1", columns: [], rows: [] }];
  const used = new Set();
  const formats = new Map(); // biçim kodu → numFmtId (164'ten başlar)
  const styleOf = new Map(); // numFmtId → cellXfs sırası
  const styles = [{ numFmtId: 0 }, { numFmtId: 0, header: true }];
  const styleFor = code => {
    if (!formats.has(code)) formats.set(code, 164 + formats.size);
    const id = formats.get(code);
    if (!styleOf.has(id)) {
      styleOf.set(id, styles.length);
      styles.push({ numFmtId: id });
    }
    return styleOf.get(id);
  };

  const sheetFiles = list.map((sheet, sheetIndex) => {
    const name = safeSheetName(sheet.name, used);
    const columns = sheet.columns;
    const headers = sheet.headers || columns;
    const widths = headers.map(header => Math.min(60, Math.max(10, String(header).length + 4)));
    const rowsXml = [];
    const cell = (ref, content, style) => {
      if (content === null) return "";
      if ("value" in content) return `<c r="${ref}" s="${styleFor(content.format)}"><v>${content.value}</v></c>`;
      const text = content.text.length > MAX_CELL_TEXT ? content.text.slice(0, MAX_CELL_TEXT) : content.text;
      const space = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : "";
      return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t${space}>${xml(text)}</t></is></c>`;
    };
    if (columns.length) rowsXml.push(`<row r="1">${headers.map((header, index) => cell(`${columnName(index)}1`, { text: String(header) }, 1)).join("")}</row>`);
    sheet.rows.forEach((row, rowIndex) => {
      const r = rowIndex + 2;
      const cells = columns
        .map((column, index) => {
          const content = typedCell(row[column]);
          if (content && widths[index] < 60) widths[index] = Math.min(60, Math.max(widths[index], Math.ceil(String(row[column]).trim().length * 1.1) + 2));
          return cell(`${columnName(index)}${r}`, content);
        })
        .join("");
      rowsXml.push(`<row r="${r}">${cells}</row>`);
    });
    const last = `${columnName(Math.max(0, columns.length - 1))}${sheet.rows.length + 1}`;
    const body = `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="A1:${last}"/>
<sheetViews><sheetView workbookViewId="0"${sheetIndex === 0 ? ' tabSelected="1"' : ""}>${columns.length ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' : ""}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${columns.length ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>` : ""}
<sheetData>${rowsXml.join("")}</sheetData>
${columns.length && sheet.rows.length ? `<autoFilter ref="A1:${last}"/>` : ""}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
</worksheet>`;
    return { name, body };
  });

  const numFmts = [...formats].map(([code, id]) => `<numFmt numFmtId="${id}" formatCode="${xml(code)}"/>`).join("");
  const stylesXml = `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${formats.size ? `<numFmts count="${formats.size}">${numFmts}</numFmts>` : ""}
<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF142B25"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F3EB"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF9CC7AE"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${styles.length}">${styles
    .map(style => (style.header ? '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' : `<xf numFmtId="${style.numFmtId}" fontId="0" fillId="0" borderId="0" xfId="0"${style.numFmtId ? ' applyNumberFormat="1"' : ""}/>`))
    .join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  const workbook = `${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView activeTab="0"/></bookViews>
<sheets>${sheetFiles.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>
${sheetFiles.some((_, index) => list[index].columns.length && list[index].rows.length) ? `<definedNames>${sheetFiles.map((sheet, index) => (list[index].columns.length && list[index].rows.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">'${xml(sheet.name.replace(/'/g, "''"))}'!$A$1:$${columnName(list[index].columns.length - 1)}$${list[index].rows.length + 1}</definedName>` : "")).join("")}</definedNames>` : ""}
</workbook>`;
  const workbookRels = `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetFiles
    .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join("")}<Relationship Id="rId${sheetFiles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const contentTypes = `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetFiles
    .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const rootRels = `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const stamp = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const core = `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(title)}</dc:title><dc:creator>${xml(creator)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified></cp:coreProperties>`;
  const app = `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>DestekOfis</Application></Properties>`;
  return createZip(
    [
      { name: "[Content_Types].xml", data: contentTypes, date: now },
      { name: "_rels/.rels", data: rootRels, date: now },
      { name: "docProps/core.xml", data: core, date: now },
      { name: "docProps/app.xml", data: app, date: now },
      { name: "xl/workbook.xml", data: workbook, date: now },
      { name: "xl/_rels/workbook.xml.rels", data: workbookRels, date: now },
      { name: "xl/styles.xml", data: stylesXml, date: now },
      ...sheetFiles.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheet.body, date: now })),
    ],
    { level: 6 },
  );
}
