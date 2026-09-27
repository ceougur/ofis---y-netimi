// Excel/Sheets açılır listeleri (veri doğrulama → "liste", v2.0.2).
// Excel'de "Veri doğrulama → Liste", Google Sheets'te "Açılır liste" ile kurulan hücreler programda da açılır liste
// olur: detay kartında değerin yanında ▾, düzenleme ve yeni kayıt formlarında aynı seçenekler.
//
// Kaynak: .xlsx içindeki <dataValidation type="list"> kuralları (Excel 2010+ başka sayfaya başvuran kuralları
// <x14:dataValidation> olarak yazar; ikisi de okunur). Seçenekler:
//   - satır içi liste:  "Nakit,Kredi kartı,Havale"
//   - aralık:           $H$2:$H$20 · Listeler!$A$2:$A$30 · 'Ödeme türleri'!A:A
//   - tanımlı ad:       OdemeTurleri (Formüller → Ad Yöneticisi) → aralık
// Aralıklar, hücrelerin programda göründüğü metinden (sayfa matrisi) okunur; böylece seçenekler kayıtlardaki
// değerlerle aynı biçimdedir. DOLAYLI/KAYDIR gibi hesaplanan listeler okunmaz (değerler değişmez, liste çıkmaz).
//
// Birleşik giriş kutuları (combo box) da okunur: Excel'in "Form denetimi" açılan kutusu (ctrlProps: fmlaRange liste,
// fmlaLink bağlı hücre; bağlı hücreye seçilenin SIRA NUMARASI yazılır, program bunu metne çevirir) ve ActiveX
// birleşik giriş kutusu (ListFillRange/LinkedCell; bağlı hücreye metin yazılır). Listesi kodla (VBA AddItem)
// doldurulan kutular okunamaz. Google Sheets'te birleşik giriş kutusu yoktur; açılır listesi yukarıdaki gibidir.
//
// Kurallar hücre aralığına bağlıdır; program kolon düzeyinde çalışır: bir kural, sekmedeki (alt tablodaki) kayıtların
// en az yarısını kapsıyorsa o kolonun listesi olur. Başlık üstündeki tek bir "seçim" hücresi kolonu etkilemez.
import { readZip } from "./zip.mjs";
import { colToIndex } from "./formula/parse.mjs";

export const CHOICE_LIMITS = { options: 500, optionLength: 200, rules: 5_000, xmlBytes: 4 * 1024 * 1024 };

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescapeXml = text =>
  String(text).replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, name) => {
    if (name[0] === "#") return String.fromCodePoint(name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
    return ENTITIES[name.toLowerCase()];
  });
const attrs = text => {
  const out = {};
  for (const match of String(text).matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)) out[match[1]] = unescapeXml(match[2]);
  return out;
};

/**
 * Sayfa XML'inden (ya da yalnızca <dataValidations> parçalarından) liste kurallarını çıkarır.
 * @returns {Array<{ sqref: string, formula: string, strict: boolean }>}
 */
export function listRulesFromXml(xml) {
  const text = String(xml || "").slice(0, CHOICE_LIMITS.xmlBytes);
  const rules = [];
  for (const match of text.matchAll(/<((?:\w+:)?dataValidation)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g)) {
    const head = attrs(match[2]);
    if (head.type !== "list") continue;
    const body = match[3] || "";
    const formula = /<(?:\w+:)?formula1\b[^>]*>([\s\S]*?)<\/(?:\w+:)?formula1>/.exec(body)?.[1] || "";
    // x14 biçiminde formül <xm:f>, aralık <xm:sqref> içindedir.
    const inner = /<(?:\w+:)?f\b[^>]*>([\s\S]*?)<\/(?:\w+:)?f>/.exec(formula)?.[1];
    const sqref = head.sqref || /<(?:\w+:)?sqref\b[^>]*>([\s\S]*?)<\/(?:\w+:)?sqref>/.exec(body)?.[1] || "";
    const source = unescapeXml(inner ?? formula).trim();
    if (!source || !sqref.trim()) continue;
    // Excel, hata iletisi kapalıysa (showErrorMessage yok/0) ya da uyarı/bilgi türündeyse listede olmayan değeri kabul eder.
    const strict = head.showErrorMessage === "1" || head.showErrorMessage === "true" ? !["warning", "information"].includes(head.errorStyle) : false;
    rules.push({ sqref: unescapeXml(sqref).trim(), formula: source, strict });
    if (rules.length >= CHOICE_LIMITS.rules) break;
  }
  return rules;
}

/**
 * Sayfadaki birleşik giriş kutuları (Form denetimi ve ActiveX) → liste kuralları.
 * @param {{ xml?: string, rels?: string, parts?: Record<string, string> }} input
 *        xml: sayfanın <controls> ve <legacyDrawing> parçaları; rels: sayfanın ilişki dosyası;
 *        parts: ilişkideki hedef ("../ctrlProps/ctrlProp1.xml", "../drawings/vmlDrawing1.vml") → içerik
 * @returns {Array<{ sqref: string, sheet: string|null, formula: string, strict: boolean, index: boolean }>}
 */
export function comboRulesFromParts({ xml = "", rels = "", parts = {} } = {}) {
  const targets = new Map();
  for (const match of String(rels).matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const item = attrs(match[1]);
    if (item.Id && item.Target) targets.set(item.Id, item.Target);
  }
  const rules = [];
  const seen = new Set();
  const add = (link, range, index, strict) => {
    const cell = parseRangeRef(link, null);
    if (!cell || !range) return;
    const key = `${link}\u0000${range}`;
    if (seen.has(key)) return;
    seen.add(key);
    const area = cell.area;
    rules.push({ sqref: `${indexToLetters(area.c1)}${area.r1 + 1}`, sheet: cell.sheet || null, formula: String(range).trim(), strict, index });
  };
  const text = String(xml).slice(0, CHOICE_LIMITS.xmlBytes);
  for (const match of text.matchAll(/<control\b([^>]*)>([\s\S]*?)<\/control>/g)) {
    const head = attrs(match[1]);
    const pr = attrs(/<controlPr\b([^>]*)>/.exec(match[2])?.[1] || "");
    const target = targets.get(head["r:id"]) || "";
    const props = /ctrlProp/i.test(target) ? String(parts[target] || "") : "";
    const form = attrs(/<formControlPr\b([^>]*?)\/?>/.exec(props)?.[1] || "");
    // Form denetimi: açılan kutu (Drop) ve liste kutusu (List); bağlı hücrede sıra numarası.
    if (form.objectType === "Drop" || form.objectType === "List") add(form.fmlaLink, form.fmlaRange, true, true);
    // ActiveX birleşik giriş kutusu: bağlı hücrede metin; kutuya yazmak da mümkündür.
    else if (pr.linkedCell && pr.listFillRange) add(pr.linkedCell, pr.listFillRange, false, false);
  }
  // Eski (VML) biçim: Excel 2007 ve öncesi yalnızca bunu yazar.
  for (const match of text.matchAll(/<legacyDrawing\b([^>]*)\/?>/g)) {
    const vml = String(parts[targets.get(attrs(match[1])["r:id"])] || "").slice(0, CHOICE_LIMITS.xmlBytes);
    for (const data of vml.matchAll(/<x:ClientData\b([^>]*)>([\s\S]*?)<\/x:ClientData>/g)) {
      const type = attrs(data[1]).ObjectType;
      if (type !== "Drop" && type !== "List") continue;
      const range = /<x:FmlaRange>([\s\S]*?)<\/x:FmlaRange>/.exec(data[2])?.[1];
      const link = /<x:FmlaLink>([\s\S]*?)<\/x:FmlaLink>/.exec(data[2])?.[1];
      if (range && link) add(unescapeXml(link).trim(), unescapeXml(range).trim(), true, true);
    }
  }
  return rules;
}
const indexToLetters = index => {
  let value = index + 1;
  let out = "";
  while (value > 0) {
    const rest = (value - 1) % 26;
    out = String.fromCharCode(65 + rest) + out;
    value = Math.floor((value - 1) / 26);
  }
  return out;
};

/** Sayfa XML'inin birleşik giriş kutusu parçaları (<controls>, <legacyDrawing>). */
export function controlsXml(sheetXml) {
  const parts = [];
  for (const match of String(sheetXml || "").matchAll(/<controls\b[\s\S]*?<\/controls>|<legacyDrawing\b[^>]*\/?>/g)) parts.push(match[0]);
  return parts.join("\n").slice(0, CHOICE_LIMITS.xmlBytes);
}

/** workbook.xml'deki tanımlı adlar: [{ name, ref, sheet }] (sheet: yerel adın sayfası ya da null). */
export function definedNamesFromXml(workbookXml, sheetNames = []) {
  const names = [];
  for (const match of String(workbookXml || "").matchAll(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g)) {
    const head = attrs(match[1]);
    if (!head.name || /^_xlnm\./i.test(head.name)) continue;
    const local = head.localSheetId !== undefined ? sheetNames[Number(head.localSheetId)] ?? null : null;
    names.push({ name: head.name, ref: unescapeXml(match[2]).trim(), sheet: local });
  }
  return names;
}

/**
 * Google Sheets'in "xlsx olarak indir" çıktısından sayfa adı → liste kuralları ve tanımlı adlar.
 * @returns {{ sheets: Map<string, Array<{sqref:string, formula:string, strict:boolean}>>, names: Array<{name:string, ref:string, sheet:string|null}>, hidden: Set<string> }}
 */
export function readXlsxLists(buffer) {
  const hidden = new Set();
  const combos = [];
  const files = new Map(readZip(buffer, { maxTotalBytes: 300 * 1024 * 1024 }).filter(entry => !entry.directory).map(entry => [entry.name, entry.data]));
  const text = name => files.get(name)?.toString("utf8") || "";
  const workbook = text("xl/workbook.xml");
  const rels = new Map();
  for (const match of text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const item = attrs(match[1]);
    if (item.Id && item.Target) rels.set(item.Id, item.Target.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }
  const sheets = new Map();
  const order = [];
  for (const match of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const item = attrs(match[1]);
    order.push(item.name || "");
    if (item.name && (item.state === "hidden" || item.state === "veryHidden")) hidden.add(item.name);
    const target = rels.get(item["r:id"]);
    if (!item.name || !target) continue;
    const xml = text(`xl/${target}`);
    const rules = /dataValidation/.test(xml) ? listRulesFromXml(validationXml(xml)) : [];
    if (/<control\b|<legacyDrawing\b/.test(xml)) {
      const dir = `xl/${target}`.replace(/[^/]+$/, "");
      const relsName = `${dir}_rels/${`xl/${target}`.split("/").pop()}.rels`;
      const relsXml = text(relsName);
      const parts = {};
      for (const match of relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
        const rel = attrs(match[1]);
        if (rel.Target && /ctrlProp|vmlDrawing/i.test(rel.Target)) parts[rel.Target] = text(resolvePath(dir, rel.Target));
      }
      for (const rule of comboRulesFromParts({ xml: controlsXml(xml), rels: relsXml, parts })) combos.push({ ...rule, sheet: rule.sheet || item.name });
    }
    if (rules.length) sheets.set(item.name, rules);
  }
  for (const { sheet, ...rule } of combos) {
    if (!sheets.has(sheet)) sheets.set(sheet, []);
    sheets.get(sheet).push(rule);
  }
  return { sheets, names: definedNamesFromXml(workbook, order), hidden };
}

// "xl/worksheets/" + "../ctrlProps/ctrlProp1.xml" → "xl/ctrlProps/ctrlProp1.xml"
function resolvePath(dir, target) {
  if (target.startsWith("/")) return target.slice(1);
  const out = dir.split("/").filter(Boolean);
  for (const part of target.split("/")) {
    if (part === "..") out.pop();
    else if (part && part !== ".") out.push(part);
  }
  return out.join("/");
}

/** Sayfa XML'inin yalnızca doğrulama bölümleri (tarayıcı işçisinin sunucuya gönderdiği parça ile aynı). */
export function validationXml(sheetXml) {
  const parts = [];
  for (const match of String(sheetXml || "").matchAll(/<((?:\w+:)?dataValidations)\b[\s\S]*?<\/\1>/g)) parts.push(match[0]);
  return parts.join("\n").slice(0, CHOICE_LIMITS.xmlBytes);
}

// ---------- Başvurular ----------
const MAX_ROW = 1_048_575;
const MAX_COL = 16_383;

const cellRef = text => {
  const match = /^\$?([A-Z]{1,3})?\$?(\d+)?$/i.exec(text);
  if (!match || (!match[1] && !match[2])) return null;
  return { c: match[1] ? colToIndex(match[1].toUpperCase()) : null, r: match[2] ? Number(match[2]) - 1 : null };
};

/** "B2:B100", "C5", "B:B", "3:3" → { r1, c1, r2, c2 } (0 tabanlı, dahil). */
export function parseArea(text) {
  const value = String(text || "").trim();
  const [from, to = from] = value.split(":");
  const a = cellRef(from);
  const b = cellRef(to);
  if (!a || !b) return null;
  // Tek başına "B" ya da "3" başvuru değildir (tanımlı ad olabilir); kolon/satır yalnızca "B:B", "3:3" biçiminde.
  if (!value.includes(":") && (a.r === null || a.c === null)) return null;
  const r1 = a.r ?? 0;
  const r2 = b.r ?? MAX_ROW;
  const c1 = a.c ?? 0;
  const c2 = b.c ?? MAX_COL;
  if ([r1, r2, c1, c2].some(value => !Number.isInteger(value) || value < 0)) return null;
  return { r1: Math.min(r1, r2), r2: Math.max(r1, r2), c1: Math.min(c1, c2), c2: Math.max(c1, c2) };
}

/** "Listeler!$A$2:$A$9", "'Ödeme türleri'!A:A", "$H$2:$H$20" → { sheet, area } */
export function parseRangeRef(text, currentSheet) {
  const value = String(text || "").trim().replace(/^=/, "");
  const match = /^(?:(?:'((?:[^']|'')+)'|([^'!:()"]+))!)?(\$?[A-Z]{0,3}\$?\d*(?::\$?[A-Z]{0,3}\$?\d*)?)$/i.exec(value);
  if (!match) return null;
  const area = parseArea(match[3]);
  if (!area) return null;
  const sheet = match[1] !== undefined ? match[1].replace(/''/g, "'") : match[2] !== undefined ? match[2] : currentSheet;
  return { sheet, area };
}

/** Satır içi liste: "Nakit,Kredi kartı" → ["Nakit", "Kredi kartı"] (tırnak içindeki "" tek tırnaktır). */
export function inlineOptions(formula) {
  const value = String(formula || "").trim().replace(/^=/, "");
  const match = /^"((?:[^"]|"")*)"$/.exec(value);
  if (!match) return null;
  return match[1].replace(/""/g, '"').split(",");
}

const cleanOptions = list => {
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const option = String(item ?? "").replace(/\s+/g, " ").trim().slice(0, CHOICE_LIMITS.optionLength);
    if (!option || seen.has(option)) continue;
    seen.add(option);
    out.push(option);
    if (out.length >= CHOICE_LIMITS.options) break;
  }
  return out;
};

/**
 * Kuralların seçeneklerini çözer ve kolonlara bağlar.
 * @param {Array<{ name: string, matrix: string[][], start?: {r:number,c:number}, rules?: Array<{sqref:string, formula:string, strict:boolean}>, blocks?: Array<{label:string, from:number, to:number, names:string[], lines:number[]}> }>} sheets
 *        matrix: sayfanın hücreleri (satır sırası = sayfadaki satır, start'tan itibaren); blocks: sections.mjs'in
 *        kayıt blokları (sekme/alt tablo etiketi, matris satır aralığı, kolon adları, kayıtların matris satırları).
 * @param {Array<{name:string, ref:string, sheet:string|null}>} names tanımlı adlar
 * @param {Set<string>} [sources] verilirse seçeneklerin okunduğu sayfaların adları buna eklenir (liste sayfaları)
 * @returns {Record<string, Record<string, { options: string[], strict: boolean }>>} sekme etiketi → kolon → liste
 */
export function resolveChoices(sheets, names = [], sources = null) {
  const optionsOf = optionResolver(sheets, names, sources);
  return bindChoices(sheets, optionsOf);
}

/**
 * Form denetimi birleşik giriş kutularının bağlı hücresindeki sıra numarasını (1, 2, 3…) listedeki metne çevirir
 * (Excel'de kutuda görünen değer). Kayıtlar oluşturulmadan önce, matris üzerinde çağrılır. Numara geçersizse hücre
 * olduğu gibi kalır; 0 "seçim yok" demektir, hücre boşalır.
 */
export function applyIndexedCombos(sheets, names = []) {
  const optionsOf = optionResolver(sheets, names);
  let changed = 0;
  for (const sheet of sheets) {
    for (const rule of sheet.rules || []) {
      if (!rule.index) continue;
      const area = parseArea(rule.sqref);
      const options = area ? optionsOf(rule.formula, sheet.name, 0, { keepOrder: true }) : null;
      if (!options?.length) continue;
      const start = sheet.start || { r: 0, c: 0 };
      const line = sheet.matrix[area.r1 - start.r];
      const column = area.c1 - start.c;
      if (!line || column < 0) continue;
      const raw = String(line[column] ?? "").trim();
      if (!/^\d+$/.test(raw)) continue;
      const number = Number(raw);
      if (number === 0) line[column] = "";
      else if (number <= options.length) line[column] = options[number - 1];
      else continue;
      changed += 1;
    }
  }
  return changed;
}

function optionResolver(sheets, names = [], sources = null) {
  const byName = new Map(sheets.map(sheet => [sheet.name, sheet]));
  const folded = new Map(sheets.map(sheet => [sheet.name.toLocaleLowerCase("tr-TR"), sheet]));
  const findSheet = name => byName.get(name) || folded.get(String(name || "").toLocaleLowerCase("tr-TR")) || null;
  const nameRef = (name, sheet) => {
    const wanted = String(name).toLocaleLowerCase("en-US");
    const candidates = names.filter(item => String(item.name).toLocaleLowerCase("en-US") === wanted);
    return (candidates.find(item => item.sheet === sheet) || candidates.find(item => !item.sheet) || candidates[0])?.ref || null;
  };

  // keepOrder: sıra numarası dönüşümü için boş hücreler de sayılır (Excel'in kutusundaki sıra).
  const optionsOf = (formula, sheetName, depth = 0, { keepOrder = false } = {}) => {
    const inline = inlineOptions(formula);
    if (inline) return keepOrder ? inline.map(item => item.trim()) : cleanOptions(inline);
    let reference = parseRangeRef(formula, sheetName);
    if (!reference && depth < 2 && /^[A-Za-zÇĞİÖŞÜçğıöşü_\\][\w.\\ÇĞİÖŞÜçğıöşü]*$/.test(String(formula).trim().replace(/^=/, ""))) {
      const ref = nameRef(String(formula).trim().replace(/^=/, ""), sheetName);
      if (ref) return optionsOf(ref, sheetName, depth + 1, { keepOrder });
    }
    if (!reference) return null;
    const target = findSheet(reference.sheet);
    if (!target) return null;
    sources?.add(target.name);
    const start = target.start || { r: 0, c: 0 };
    const values = [];
    const { r1, r2, c1, c2 } = reference.area;
    const lastRow = Math.min(r2, start.r + target.matrix.length - 1);
    for (let r = Math.max(r1, start.r); r <= lastRow; r += 1) {
      const line = target.matrix[r - start.r] || [];
      const lastCol = Math.min(c2, start.c + line.length - 1);
      for (let c = Math.max(c1, start.c); c <= lastCol; c += 1) values.push(line[c - start.c]);
      if (values.length > CHOICE_LIMITS.options * 4) break;
    }
    return keepOrder ? values.map(value => String(value ?? "").trim()) : cleanOptions(values);
  };
  return optionsOf;
}

function bindChoices(sheets, optionsOf) {
  const result = {};
  for (const sheet of sheets) {
    if (!sheet.rules?.length || !sheet.blocks?.length) continue;
    const start = sheet.start || { r: 0, c: 0 };
    // blok → kolon → seçenek imzası → { options, strict, lines:Set }
    const votes = new Map();
    for (const rule of sheet.rules) {
      const options = optionsOf(rule.formula, sheet.name);
      if (!options?.length) continue;
      const signature = options.join("\u0000");
      for (const part of String(rule.sqref).split(/\s+/).filter(Boolean)) {
        const area = parseArea(part);
        if (!area) continue;
        const r1 = area.r1 - start.r;
        const r2 = area.r2 - start.r;
        for (const block of sheet.blocks) {
          if (r2 < block.from || r1 > block.to) continue;
          const covered = block.lines.filter(line => line >= r1 && line <= r2);
          if (!covered.length) continue;
          const lastCol = Math.min(area.c2 - start.c, block.names.length - 1);
          for (let c = Math.max(0, area.c1 - start.c); c <= lastCol; c += 1) {
            const column = block.names[c];
            if (!column) continue;
            const key = `${block.label}\u0001${column}`;
            if (!votes.has(key)) votes.set(key, { block, column, lists: new Map() });
            const lists = votes.get(key).lists;
            if (!lists.has(signature)) lists.set(signature, { options, strict: rule.strict, lines: new Set() });
            const entry = lists.get(signature);
            entry.strict = entry.strict && rule.strict;
            for (const line of covered) entry.lines.add(line);
          }
        }
      }
    }
    for (const { block, column, lists } of votes.values()) {
      let best = null;
      for (const entry of lists.values()) if (!best || entry.lines.size > best.lines.size) best = entry;
      if (!best || best.lines.size < Math.max(1, Math.ceil(block.lines.length / 2))) continue;
      (result[block.label] ||= {})[column] = { options: best.options, strict: best.strict };
    }
  }
  return result;
}

/** Kayıtlı listeyi doğrular (ayarlardan okunan JSON). */
export function cleanChoices(value) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [tab, columns] of Object.entries(value).slice(0, 500)) {
    if (!columns || typeof columns !== "object" || Array.isArray(columns)) continue;
    for (const [column, entry] of Object.entries(columns).slice(0, 500)) {
      const options = cleanOptions(Array.isArray(entry?.options) ? entry.options : []);
      if (options.length) (out[String(tab)] ||= {})[String(column)] = { options, strict: Boolean(entry.strict) };
    }
  }
  return out;
}

/**
 * Excel/Sheets'te gizli olup yalnızca açılır listelere kaynaklık eden sayfalar (kendi listesi olmayan): içeri almada
 * programda da gizlenir (Yönetim → Silinenler'den geri getirilebilir).
 */
export function listOnlySheets(sheets, sources) {
  return sheets.filter(sheet => sheet.hidden && sources.has(sheet.name) && !sheet.rules?.length).map(sheet => sheet.name);
}

/** Yeni içeri almanın listeleri: kaynaktaki sekmeler yenisiyle değişir (listesi kalkan sekmeden de kalkar), diğerleri kalır. */
export function mergeChoices(current, fresh, tabs) {
  const top = label => String(label || "").split(" › ")[0];
  const replaced = new Set((tabs || []).map(top));
  const out = {};
  for (const [tab, columns] of Object.entries(cleanChoices(current))) if (!replaced.has(top(tab))) out[tab] = columns;
  return { ...out, ...cleanChoices(fresh) };
}
