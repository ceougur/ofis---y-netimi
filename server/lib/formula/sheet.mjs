// Serbest sayfa formülleri (v2.0.1): kullanıcının programda kurduğu Excel benzeri sayfanın hücreleri.
// - Adresler sayfanın kendi ızgarasıdır: kolon harfi (A, B, C…) + veri satırı numarası (1, 2, 3…). Başlık satırı
//   (kolon adları) numaralı değildir; "B1" ilk veri satırının B kolonudur.
// - Türkçe Excel yazımı da kabul edilir: TOPLA, EĞER, BAĞ_DEĞ_SAY…; bağımsız değişken ayracı ";" ve ondalık ","
//   (=EĞER(B1>1,5;"Yüksek";"Düşük")). Formül kullanıcının yazdığı gibi saklanır; hesaplamadan önce motorun anladığı
//   İngilizce yazıma çevrilir (translateFormula).
// - Kolon/satır eklenip silinince formüllerdeki başvurular Excel'deki gibi kayar; silinen hücreye başvuru #REF! olur
//   (rewriteReferences). Aşağı doldurmada göreli başvurular satır kadar kayar (shiftReferences).
import { FormulaError, colToIndex, indexToCol, parse } from "./parse.mjs";
import { UnsupportedFormula, evaluate } from "./evaluate.mjs";
import { Cell, CellError, ERR, formatValue, isError } from "./values.mjs";

export const MAX_SHEET_RANGE = 20_000;
const CIRCULAR = new CellError("#DÖNGÜ!");
// Uzun başvuru zincirleri (ör. her satırın bir alttakine başvurduğu 2000 satır) yığını taşırmasın diye özyineleme bu
// derinlikte kesilir; zincirin ucu önce hesaplanır, sonra kalanı (bkz. force). Biçim devralma ayrıca sınırlıdır.
const MAX_DEPTH = 120;
const MAX_SHAPE_DEPTH = 40;
class Deep {
  constructor(r, c) {
    this.r = r;
    this.c = c;
  }
}

// Türkçe Excel işlev adları (noktasız, alt çizgisiz, aksansız büyük harf) → İngilizce.
const TR_FUNCTIONS = {
  TOPLA: "SUM", CARPIM: "PRODUCT", ORTALAMA: "AVERAGE", MIN: "MIN", MAK: "MAX", MAKS: "MAX", ORTANCA: "MEDIAN",
  BAGDEGSAY: "COUNT", SAY: "COUNT", BAGDEGDOLUSAY: "COUNTA", DOLUSAY: "COUNTA", BOSLUKSAY: "COUNTBLANK",
  EGERSAY: "COUNTIF", COKEGERSAY: "COUNTIFS", ETOPLA: "SUMIF", COKETOPLA: "SUMIFS", EGERORTALAMA: "AVERAGEIF",
  COKEGERORTALAMA: "AVERAGEIFS", COKEGERMAK: "MAXIFS", COKEGERMIN: "MINIFS", TOPLACARPIM: "SUMPRODUCT",
  YUVARLA: "ROUND", YUKARIYUVARLA: "ROUNDUP", ASAGIYUVARLA: "ROUNDDOWN", NSAT: "TRUNC", TAMSAYI: "INT", MUTLAK: "ABS",
  ISARET: "SIGN", MOD: "MOD", KUVVET: "POWER", KAREKOK: "SQRT", TAVANAYUVARLA: "CEILING", TABANAYUVARLA: "FLOOR", PI: "PI",
  DEVRESELODEME: "PMT", DEGIL: "NOT", EBOSSA: "ISBLANK", ESAYIYSA: "ISNUMBER", EMETINSE: "ISTEXT", CIFTMI: "ISEVEN",
  TEKMI: "ISODD", S: "N", YOKSAY: "NA", EGER: "IF", COKEGER: "IFS", EGERHATA: "IFERROR", EGERYOKSA: "IFNA", VE: "AND",
  YADA: "OR", ILKESLESEN: "SWITCH", ELEMAN: "CHOOSE", EHATALIYSA: "ISERROR", EHATAYSA: "ISERR", EYOKSA: "ISNA",
  BIRLESTIR: "CONCATENATE", ARALIKBIRLESTIR: "CONCAT", METINBIRLESTIR: "TEXTJOIN", SOLDAN: "LEFT", SAGDAN: "RIGHT",
  PARCAAL: "MID", UZUNLUK: "LEN", BUYUKHARF: "UPPER", KUCUKHARF: "LOWER", YAZIMDUZENI: "PROPER", KIRP: "TRIM",
  YERINEKOY: "SUBSTITUTE", DEGISTIR: "REPLACE", BUL: "FIND", MBUL: "SEARCH", YINELE: "REPT", OZDES: "EXACT",
  SAYIYACEVIR: "VALUE", M: "T", METNECEVIR: "TEXT", BUGUN: "TODAY", SIMDI: "NOW", TARIH: "DATE", TARIHSAYISI: "DATEVALUE",
  YIL: "YEAR", AY: "MONTH", GUN: "DAY", SAAT: "HOUR", DAKIKA: "MINUTE", HAFTANINGUNU: "WEEKDAY", SERITARIH: "EDATE",
  SERIAY: "EOMONTH", GUNSAY: "DAYS", ETARIHLI: "DATEDIF", TAMISGUNU: "NETWORKDAYS", DUSEYARA: "VLOOKUP",
  YATAYARA: "HLOOKUP", KACINCI: "MATCH", INDIS: "INDEX", CAPRAZARA: "XLOOKUP", ARA: "LOOKUP", SATIRSAY: "ROWS",
  SUTUNSAY: "COLUMNS",
};
const TR_CONSTANTS = { DOGRU: "TRUE", YANLIS: "FALSE" };
const TR_ERRORS = { "#DIV/0!": "#SAYI/0!", "#VALUE!": "#DEĞER!", "#REF!": "#BAŞV!", "#NAME?": "#AD?", "#NUM!": "#SAYI!", "#N/A": "#YOK", "#NULL!": "#BOŞ!", "#DÖNGÜ!": "#DÖNGÜ!" };
const TR_ERROR_INPUT = Object.fromEntries(Object.entries(TR_ERRORS).map(([english, turkish]) => [turkish, english]));

export const foldName = name =>
  String(name)
    .toLocaleUpperCase("tr-TR")
    .replace(/[İI]/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/Â/g, "A")
    .replace(/Î/g, "I")
    .replace(/Û/g, "U")
    .replace(/[._]/g, "");
export const turkishError = code => TR_ERRORS[code] || code;

// Metin dışındaki parçaları dolaşır: fn(parça, metin mi) → yeni parça.
function mapOutsideStrings(text, fn) {
  let out = "";
  let index = 0;
  let chunk = "";
  while (index < text.length) {
    const char = text[index];
    if (char === '"') {
      out += fn(chunk);
      chunk = "";
      let end = index + 1;
      while (end < text.length) {
        if (text[end] === '"' && text[end + 1] === '"') end += 2;
        else if (text[end] === '"') break;
        else end += 1;
      }
      out += text.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    chunk += char;
    index += 1;
  }
  return out + fn(chunk);
}

// Kullanıcının yazdığı formül → motorun anladığı İngilizce yazım. Çözülemezse FormulaError.
export function translateFormula(raw) {
  let text = String(raw ?? "").trim().replace(/^=/, "");
  if (!text) throw new FormulaError("Formül boş");
  const hasSemicolon = mapOutsideStrings(text, part => (part.includes(";") ? "\u0001" : "")).includes("\u0001");
  text = mapOutsideStrings(text, part =>
    part
      // Türkçe hata kodları (#BAŞV! gibi) İngilizce koda
      .replace(/#(SAYI\/0!|DEĞER!|BAŞV!|AD\?|SAYI!|YOK|BOŞ!)/gu, match => TR_ERROR_INPUT[match] || match)
      // İşlev adları ve Türkçe DOĞRU/YANLIŞ
      .replace(/(?<![\p{L}\p{N}_.$])([\p{L}_][\p{L}\p{N}_.]*)(\s*\()?/gu, (match, word, call) => {
        const folded = foldName(word);
        if (call) return `${TR_FUNCTIONS[folded] || word.toUpperCase()}${call}`;
        return TR_CONSTANTS[folded] || word;
      }),
  );
  if (hasSemicolon) text = mapOutsideStrings(text, part => part.replace(/,/g, ".").replace(/;/g, ","));
  try {
    parse(text);
    return text;
  } catch (error) {
    // "=B1*1,5" gibi ondalık virgül (ayraç olarak ";" kullanılmadan)
    if (!hasSemicolon && /\d,\d/.test(text)) {
      const retry = mapOutsideStrings(text, part => part.replace(/(\d),(\d)/g, "$1.$2"));
      parse(retry);
      return retry;
    }
    throw error;
  }
}

// ---------- Başvurular ----------
// Metin dışındaki A1 başvurularını (B2, $B$2, B2:D9, B:B) bulur; fn(başvuru) → yeni başvuru ya da null (#REF!).
const REF = /(?<![\p{L}\p{N}_.$!#])(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?::(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7}))?(?![\p{L}\p{N}_(!])|(?<![\p{L}\p{N}_.$!#])(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![\p{L}\p{N}_(!])/gu;
export function mapReferences(raw, fn) {
  const text = String(raw ?? "");
  if (!text.startsWith("=")) return text;
  return mapOutsideStrings(text, part =>
    part.replace(REF, (match, ca1, c1, ra1, r1, ca2, c2, ra2, r2, wca1, wc1, wca2, wc2) => {
      let ref;
      if (c1 !== undefined) {
        ref = { c1: colToIndex(c1), r1: Number(r1) - 1, ca1: !!ca1, ra1: !!ra1 };
        if (c2 !== undefined) Object.assign(ref, { c2: colToIndex(c2), r2: Number(r2) - 1, ca2: !!ca2, ra2: !!ra2 });
        else Object.assign(ref, { c2: ref.c1, r2: ref.r1, ca2: ref.ca1, ra2: ref.ra1, single: true });
      } else {
        ref = { c1: colToIndex(wc1), c2: colToIndex(wc2), r1: null, r2: null, ca1: !!wca1, ca2: !!wca2, column: true };
      }
      // İşlev adına benzeyen (ör. "LOG10") ya da sayfanın dışındaki başvurular olduğu gibi kalır.
      if (ref.c1 >= 16_384 || ref.c2 >= 16_384) return match;
      const next = fn(ref);
      if (next === undefined) return match;
      if (next === null) return "#REF!";
      return referenceText(next);
    }),
  );
}
function referenceText(ref) {
  const cell = (c, r, ca, ra) => `${ca ? "$" : ""}${indexToCol(c)}${ra ? "$" : ""}${r + 1}`;
  if (ref.column) return `${ref.ca1 ? "$" : ""}${indexToCol(ref.c1)}:${ref.ca2 ? "$" : ""}${indexToCol(ref.c2)}`;
  if (ref.single) return cell(ref.c1, ref.r1, ref.ca1, ref.ra1);
  return `${cell(ref.c1, ref.r1, ref.ca1, ref.ra1)}:${cell(ref.c2, ref.r2, ref.ca2, ref.ra2)}`;
}

// Yapı değişikliği: axis "col" | "row", op "insert" | "delete", index (0 tabanlı), count.
export function rewriteReferences(raw, { axis, op, index, count = 1 }) {
  const moveOne = value => (op === "insert" ? (value >= index ? value + count : value) : value >= index + count ? value - count : value);
  return mapReferences(raw, ref => {
    if (ref.column && axis === "row") return undefined;
    const [lo, hi] = axis === "col" ? [ref.c1, ref.c2] : [ref.r1, ref.r2];
    if (op === "delete") {
      const last = index + count - 1;
      if (lo >= index && hi <= last) return null; // başvurduğu hücrelerin hepsi silindi
      let a = lo;
      let b = hi;
      if (a >= index && a <= last) a = index; // başı silinen aralık kalan ilk hücreden başlar
      else a = moveOne(a);
      if (b >= index && b <= last) b = index - 1; // sonu silinen aralık kalan son hücrede biter
      else b = moveOne(b);
      if (b < a) return null;
      return axis === "col" ? { ...ref, c1: a, c2: b } : { ...ref, r1: a, r2: b };
    }
    // Ekleme: aralığın içine eklenen kolon/satır aralığı genişletir (Excel gibi).
    const a = lo >= index ? lo + count : lo;
    const b = hi >= index ? hi + count : hi;
    return axis === "col" ? { ...ref, c1: a, c2: b } : { ...ref, r1: a, r2: b };
  });
}

// Aşağı/yana doldurma: göreli ($ işaretsiz) başvurular dr satır, dc kolon kayar; sayfanın dışına çıkan #REF! olur.
export function shiftReferences(raw, dr, dc) {
  if (!dr && !dc) return String(raw ?? "");
  return mapReferences(raw, ref => {
    const shift = (value, absolute, delta) => (absolute || value === null ? value : value + delta);
    const next = { ...ref, c1: shift(ref.c1, ref.ca1, dc), c2: shift(ref.c2, ref.ca2, dc), r1: shift(ref.r1, ref.ra1, dr), r2: shift(ref.r2, ref.ra2, dr) };
    if (next.c1 < 0 || next.c2 < 0 || (next.r1 !== null && (next.r1 < 0 || next.r2 < 0))) return null;
    return next;
  });
}

// Formülde geçen hücreler (biçim örneği seçmek için): [[satır, kolon], …]
function referencedCells(raw) {
  const cells = [];
  mapReferences(raw, ref => {
    if (!ref.column) cells.push([ref.r1, ref.c1]);
    return undefined;
  });
  return cells;
}

// ---------- Hesaplama ----------
const MONEY_MARK = /[₺$€£]|\b(tl|try|usd|eur)\b/i;
// Excel'in "Genel" biçimi gibi: binlik ayracı yok (=YIL(BUGÜN()) → 2026), en çok 2 ondalık. Girdiler binlik ayraçlı
// yazılmışsa sonuç da öyle görünür (biçim, kolonun ya da başvurulan hücrenin örneğinden gelir).
const defaultNumber = value => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2, useGrouping: false }).format(value);
// Tarih döndüren işlevler: sonuç Excel seri sayısıdır ama tarih olarak gösterilir (=BUGÜN()+30 → 27.10.2026).
const DATE_FUNCTIONS = new Set(["TODAY", "DATE", "EDATE", "EOMONTH", "DATEVALUE", "WORKDAY"]);
const DATE_SAMPLE = { date: "01.01.2000", datetime: "01.01.2000 00:00" };
const DATE_TEXT = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/;
// Sonucu girdisinin biçimini taşıyan işlevler (=TOPLA(D1:D9) → "165,00 ₺"). Diğerleri (GÜNSAY, YIL, BAĞ_DEĞ_SAY,
// UZUNLUK…) düz sayı döndürür; tarih biçimi devralmaz.
const PASSTHROUGH = new Set(["SUM", "MIN", "MAX", "AVERAGE", "MEDIAN", "ROUND", "ROUNDUP", "ROUNDDOWN", "ABS", "INT", "TRUNC", "CEILING", "FLOOR", "IF", "IFS", "IFERROR", "IFNA", "SWITCH", "CHOOSE", "SUMIF", "SUMIFS", "AVERAGEIF", "AVERAGEIFS", "MAXIFS", "MINIFS", "INDEX", "VLOOKUP", "HLOOKUP", "XLOOKUP", "LOOKUP", "SUMPRODUCT", "PRODUCT", "MOD"]);
// "date" | "datetime" (tarih döndürür), "plain" (düz sayı), "noDates" (biçim devralır ama tarih biçimini değil: iki
// tarihin farkı gün sayısıdır) ya da "inherit".
function shapeOf(node) {
  const kind = dateKind(node);
  if (kind) return kind;
  if (!node || typeof node !== "object") return "inherit";
  if (node.t === "fn") return PASSTHROUGH.has(String(node.n || "").toUpperCase()) ? "inherit" : "plain";
  if (node.t === "bin") return node.o === "-" ? "noDates" : "inherit";
  return "inherit";
}
function dateKind(node) {
  if (!node || typeof node !== "object") return null;
  if (node.t === "fn") {
    const name = String(node.n || "").toUpperCase();
    if (name === "NOW") return "datetime";
    if (DATE_FUNCTIONS.has(name)) return "date";
    const branches = name === "IF" ? node.a.slice(1, 3) : ["IFERROR", "IFNA", "MIN", "MAX", "IFS", "SWITCH", "CHOOSE"].includes(name) ? node.a : [];
    for (const branch of branches) {
      const kind = dateKind(branch);
      if (kind) return kind;
    }
    return null;
  }
  if (node.t === "bin" && (node.o === "+" || node.o === "-")) {
    const left = dateKind(node.l);
    const right = dateKind(node.r);
    if (left && right) return node.o === "-" ? null : left; // iki tarihin farkı gün sayısıdır
    return left || (node.o === "+" ? right : null);
  }
  return null;
}

/**
 * @param {{ columns: Array<{id:string}>, rows: Array<{id:string}>, raw: (rowIndex:number, colIndex:number) => string }} sheet
 * @returns {Array<Array<{ raw: string, display: string, formula: boolean, error: string|null }>>} satır × kolon
 */
export function computeSheet({ columns, rows, raw }, { now = new Date() } = {}) {
  const R = rows.length;
  const C = columns.length;
  const translated = new Map();
  const kinds = new Map(); // formül metni → shapeOf
  const memo = new Map();
  const visiting = new Set();
  let depth = 0;
  const rawAt = (r, c) => (r >= 0 && c >= 0 && r < R && c < C ? String(raw(r, c) ?? "") : "");
  const isFormula = text => text.startsWith("=") && text.length > 1;

  // Kolonun biçim örneği: formül olmayan ilk dolu hücre.
  const samples = new Map();
  const sampleOf = c => {
    if (samples.has(c)) return samples.get(c);
    let sample = "";
    for (let r = 0; r < R; r += 1) {
      const text = rawAt(r, c).trim();
      if (text && !isFormula(text) && Number.isFinite(new Cell(text).value) && typeof new Cell(text).value === "number") {
        sample = text;
        break;
      }
    }
    samples.set(c, sample);
    return sample;
  };

  function bind(node) {
    switch (node.t) {
      case "ref":
        if (node.s !== null && node.s !== undefined) throw new UnsupportedFormula("Başka sayfaya başvuru desteklenmiyor");
        return node.r < R && node.c < C ? { t: "x", r: node.r, c: node.c } : { t: "l", v: "" };
      case "rng": {
        if (node.s !== null && node.s !== undefined) throw new UnsupportedFormula("Başka sayfaya başvuru desteklenmiyor");
        const r1 = node.r1 === null ? 0 : node.r1;
        const r2 = node.r2 === null ? R - 1 : Math.min(node.r2, R - 1);
        const c1 = node.c1 === null ? 0 : node.c1;
        const c2 = node.c2 === null ? C - 1 : Math.min(node.c2, C - 1);
        if (Math.max(0, r2 - r1 + 1) * Math.max(0, c2 - c1 + 1) > MAX_SHEET_RANGE) throw new UnsupportedFormula("Aralık çok büyük");
        const out = [];
        for (let r = r1; r <= r2; r += 1) {
          const line = [];
          for (let c = c1; c <= c2; c += 1) line.push({ t: "x", r, c });
          out.push(line);
        }
        return { t: "a", rows: out.length && out[0].length ? out : [[{ t: "l", v: "" }]] };
      }
      case "fn":
        return { ...node, a: node.a.map(bind) };
      case "bin":
        return { ...node, l: bind(node.l), r: bind(node.r) };
      case "neg":
      case "pct":
        return { ...node, e: bind(node.e) };
      case "arr":
        return { ...node, rows: node.rows.map(line => line.map(bind)) };
      default:
        return node;
    }
  }

  function value(r, c) {
    const key = r * C + c;
    if (memo.has(key)) return memo.get(key);
    const text = rawAt(r, c);
    if (!isFormula(text)) {
      const result = text.trim() ? new Cell(text) : null;
      memo.set(key, result);
      return result;
    }
    if (visiting.has(key)) throw CIRCULAR;
    if (depth >= MAX_DEPTH) throw new Deep(r, c);
    visiting.add(key);
    depth += 1;
    let result;
    try {
      let english = translated.get(text);
      if (english === undefined) {
        try {
          english = translateFormula(text);
        } catch {
          english = null;
        }
        translated.set(text, english);
      }
      if (english === null) result = ERR.name;
      else {
        const parsed = parse(english);
        if (!kinds.has(text)) kinds.set(text, shapeOf(parsed));
        const tree = bind(parsed);
        result = evaluate(tree, {
          now,
          onVolatile() {},
          cell(node) {
            if (node.t === "l") return new Cell(node.v);
            return value(node.r, node.c);
          },
        });
      }
    } catch (error) {
      if (error instanceof Deep) throw error; // hücre yarım kaldı; force zincirin ucunu hesaplayıp yeniden dener
      if (error === CIRCULAR) result = CIRCULAR;
      else if (error instanceof UnsupportedFormula || error instanceof FormulaError) result = ERR.name;
      else if (error instanceof RangeError) result = ERR.num;
      else throw error;
    } finally {
      visiting.delete(key);
      depth -= 1;
    }
    memo.set(key, result);
    return result;
  }
  // Hücreyi, derinlik sınırına takılan başvurularını önce hesaplayarak (yığın yerine açık listeyle) hesaplar. Listede
  // zaten bekleyen bir hücre yeniden istenirse zincir kendine dönüyordur: o hücre #DÖNGÜ! olur.
  function force(r, c) {
    const pending = [[r, c]];
    const waiting = new Set([r * C + c]);
    while (pending.length) {
      const [pr, pc] = pending[pending.length - 1];
      try {
        value(pr, pc);
        pending.pop();
        waiting.delete(pr * C + pc);
      } catch (error) {
        if (!(error instanceof Deep)) throw error;
        const key = error.r * C + error.c;
        if (waiting.has(key)) memo.set(key, CIRCULAR);
        else {
          pending.push([error.r, error.c]);
          waiting.add(key);
        }
      }
    }
    return memo.get(r * C + c);
  }

  // Görünen metin: formül sonucu kolonun biçim örneğiyle; kolonda örnek yoksa formülün başvurduğu hücrenin görünen
  // biçimiyle (tercihen para birimli), o da formülse onun biçimiyle (ör. TOPLA(D1:D2) → "165,00 ₺").
  const shown = new Map();
  const shaping = new Set();
  function display(r, c, level = 0) {
    const key = r * C + c;
    if (shown.has(key)) return shown.get(key);
    const text = rawAt(r, c);
    if (!isFormula(text)) {
      const entry = { raw: text, display: text, formula: false, error: null };
      shown.set(key, entry);
      return entry;
    }
    shaping.add(key);
    let result = force(r, c);
    if (result instanceof Cell) result = result.value === null || result.value === undefined ? result.text : isError(result.value) ? result.value : result.text;
    let out;
    let error = null;
    if (result === null || result === undefined || result === "") out = "";
    else if (isError(result)) {
      error = turkishError(result.code);
      out = error;
    } else if (typeof result === "boolean") out = result ? "DOĞRU" : "YANLIŞ";
    else if (typeof result === "number") {
      if (!Number.isFinite(result)) {
        error = turkishError(ERR.num.code);
        out = error;
      } else {
        let sample = sampleOf(c);
        const shape = kinds.get(text) || "inherit";
        if (shape === "date" || shape === "datetime") {
          // Tarih döndüren formül: kolonun örneği tarih değilse tarih olarak gösterilir.
          if (!DATE_TEXT.test(sample)) sample = DATE_SAMPLE[shape];
        } else if (DATE_TEXT.test(sample) && shape !== "inherit") sample = "";
        if (!sample && shape !== "plain" && level < MAX_SHAPE_DEPTH) {
          let refs = referencedCells(text)
            .filter(([rr, cc]) => rr >= 0 && cc >= 0 && rr < R && cc < C && !shaping.has(rr * C + cc))
            .map(([rr, cc]) => display(rr, cc, level + 1).display)
            .filter(item => item && typeof new Cell(item).value === "number");
          // Çıkarmada: iki tarihin farkı gün sayısıdır; tarihten gün çıkarmak (=A2-10) yine tarihtir.
          if (shape === "noDates" && refs.filter(item => DATE_TEXT.test(item)).length !== 1) refs = refs.filter(item => !DATE_TEXT.test(item));
          sample = refs.find(item => MONEY_MARK.test(item)) || refs[0] || "";
        }
        out = sample ? formatValue(result, sample) : defaultNumber(result);
      }
    } else out = String(result);
    shaping.delete(key);
    const entry = { raw: text, display: out, formula: true, error };
    shown.set(key, entry);
    return entry;
  }

  const grid = [];
  for (let r = 0; r < R; r += 1) {
    const line = [];
    for (let c = 0; c < C; c += 1) line.push(display(r, c));
    grid.push(line);
  }
  return grid;
}
