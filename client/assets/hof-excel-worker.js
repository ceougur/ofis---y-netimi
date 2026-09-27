/* DestekOfis — Excel/CSV ayrıştırma işçisi.
 * Ayrıştırma ana sayfadan yalıtılmış bir Worker'da yapılır: büyük dosyalar arayüzü dondurmaz ve
 * SheetJS 0.18.5'teki bilinen "prototype pollution" / ReDoS açıkları ana sayfayı etkileyemez.
 * Her sayfa ham hücre matrisi olarak gönderilir; kolon başlıklarını ve sayfadaki alt tabloları (bölümleri)
 * sunucu ayırır — Google Sheets ile aynı kurallar. Hücreler Excel'de göründüğü gibi, Türkçe düzende metne
 * çevrilir (hof-excel-format.js). CSV değerleri olduğu gibi alınır: "0532…" telefonlarının baştaki sıfırı ve
 * "2025/1" gibi dosya numaraları bozulmaz. v2.0.1: formüller de hücre adresleriyle gönderilir. v2.0.2: açılır listeler. */
import * as XLSX from "/assets/xlsx-DGuHH-KN.js";
import { decodeCsv, sheetFormulas, sheetMatrix } from "/assets/hof-excel-format.js";

// v2.0.2: açılır listeler (Veri doğrulama → Liste) ve birleşik giriş kutuları (Form denetimi / ActiveX). SheetJS
// bunları okumaz; .xlsx içindeki sayfa XML'lerinden yalnızca <dataValidations> ve <controls> parçaları, kutuların
// özellik dosyaları ve tanımlı adlar alınır; kuralları sunucu çözer (server/lib/choices.mjs).
const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescapeXml = text => String(text).replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, name) => (name[0] === "#" ? String.fromCodePoint(name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1))) : XML_ENTITIES[name.toLowerCase()]));
const xmlAttrs = text => {
  const out = {};
  for (const match of String(text).matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)) out[match[1]] = unescapeXml(match[2]);
  return out;
};
function workbookLists(workbook) {
  const files = workbook.files;
  if (!files) return null;
  const decoder = new TextDecoder();
  const text = name => {
    const entry = files[name] || files[`/${name}`];
    if (!entry || !entry.content) return "";
    return typeof entry.content === "string" ? entry.content : decoder.decode(entry.content);
  };
  const rels = new Map();
  for (const match of text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const item = xmlAttrs(match[1]);
    if (item.Id && item.Target) rels.set(item.Id, item.Target.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }
  const bySheet = new Map();
  const controls = new Map(); // birleşik giriş kutuları (Form denetimi / ActiveX): sayfa → { xml, rels, parts }
  for (const match of text("xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const item = xmlAttrs(match[1]);
    const target = rels.get(item["r:id"]);
    if (!item.name || !target) continue;
    const path = `xl/${target}`;
    const xml = text(path);
    if (xml.includes("dataValidation")) {
      const parts = [...xml.matchAll(/<((?:\w+:)?dataValidations)\b[\s\S]*?<\/\1>/g)].map(found => found[0]).join("\n");
      if (/type\s*=\s*"list"/.test(parts)) bySheet.set(item.name, parts.slice(0, 4 * 1024 * 1024));
    }
    if (/<control\b|<legacyDrawing\b/.test(xml)) {
      const dir = path.replace(/[^/]+$/, "");
      const sheetRels = text(`${dir}_rels/${path.split("/").pop()}.rels`);
      const parts = {};
      for (const rel of sheetRels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
        const found = xmlAttrs(rel[1]);
        if (!found.Target || !/ctrlProp|vmlDrawing/i.test(found.Target)) continue;
        const resolved = [];
        for (const piece of `${dir}${found.Target}`.split("/")) {
          if (piece === "..") resolved.pop();
          else if (piece && piece !== ".") resolved.push(piece);
        }
        const content = text(found.Target.startsWith("/") ? found.Target.slice(1) : resolved.join("/"));
        if (content && (/formControlPr/.test(content) || /ObjectType="(?:Drop|List)"/.test(content))) parts[found.Target] = content.slice(0, 4 * 1024 * 1024);
      }
      const fragment = [...xml.matchAll(/<controls\b[\s\S]*?<\/controls>|<legacyDrawing\b[^>]*\/?>/g)].map(found => found[0]).join("\n");
      if (Object.keys(parts).length || /listFillRange/.test(fragment)) controls.set(item.name, { xml: fragment.slice(0, 4 * 1024 * 1024), rels: sheetRels, parts });
    }
  }
  if (!bySheet.size && !controls.size) return null;
  const names = (workbook.Workbook?.Names || [])
    .filter(item => item && item.Name && item.Ref && !/^_xlnm\./i.test(item.Name))
    .map(item => ({ name: String(item.Name), ref: String(item.Ref), sheet: Number.isInteger(item.Sheet) ? workbook.SheetNames[item.Sheet] ?? null : null }));
  return { bySheet, controls, names };
}

self.onmessage = event => {
  try {
    const csv = /\.csv$/i.test(event.data.name || "");
    const workbook = csv ? XLSX.read(decodeCsv(event.data.buffer), { type: "string", raw: true }) : XLSX.read(event.data.buffer, { type: "array", cellDates: false, cellNF: true, bookFiles: true });
    const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
    let lists = null;
    try {
      lists = csv ? null : workbookLists(workbook);
    } catch {
      lists = null; // listeler okunamazsa değerler yine gelir
    }
    const sheets = [];
    let rowCount = 0;
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      // Formüllü sayfada boş satırlar da gönderilir (matristeki sıra = sayfadaki satır); sunucu formülleri kayıtlara
      // bağlar ve programda değişen değerlerle yeniden hesaplar (v2.0.1). Açılır listeli dosyada tüm sayfalar böyle
      // gönderilir: liste kuralları ve başka sayfadaki liste aralıkları satır/kolon adresiyle çözülür (v2.0.2).
      const formulas = csv ? [] : sheetFormulas(XLSX, sheet);
      const exact = formulas.length > 0 || Boolean(lists);
      const matrix = sheetMatrix(XLSX, sheet, date1904, { keepEmpty: exact });
      rowCount += Math.max(0, matrix.filter(line => line.length).length - 1);
      const start = sheet && sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]).s : { r: 0, c: 0 };
      const item = { name: sheetName, matrix };
      if (exact) item.start = { r: start.r, c: start.c };
      if (formulas.length) item.formulas = formulas;
      if (lists?.bySheet.has(sheetName)) item.validations = lists.bySheet.get(sheetName);
      if (lists?.controls.has(sheetName)) item.controls = lists.controls.get(sheetName);
      // Excel'de gizli sayfa: yalnızca açılır listelere kaynaksa programda da gizlenir (sunucu karar verir).
      if (lists && workbook.Workbook?.Sheets?.[workbook.SheetNames.indexOf(sheetName)]?.Hidden) item.hidden = true;
      sheets.push(item);
    }
    self.postMessage({ ok: true, sheets, tabs: workbook.SheetNames, rowCount, ...(lists?.names.length ? { definedNames: lists.names } : {}) });
  } catch (error) {
    self.postMessage({ ok: false, error: (error && error.message) || String(error) });
  }
};
