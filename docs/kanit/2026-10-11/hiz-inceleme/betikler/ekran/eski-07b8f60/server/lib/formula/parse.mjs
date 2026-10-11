// Excel/Google Sheets formül ayrıştırıcı (v2.0.1).
// Formüller dosyada (xlsx) her zaman İngilizce işlev adları ve virgül ayraçla saklanır: "B2-SUM(C2:G2)".
// Bu modül formülü parçalara (belirteç) ve ağaca (AST) çevirir; paylaşılan formüllerin (Excel'in "aynı formülü
// aşağı doğru kopyala" kaydı) göreli başvurularını kaydırır. Dış bağımlılık kullanmaz.
//
// AST düğümleri:
//   {t:"num",v} {t:"str",v} {t:"bool",v} {t:"err",v} {t:"miss"} (boş bağımsız değişken)
//   {t:"ref", s, r, c}                  tek hücre (s: sayfa adı ya da null; r, c: 0 tabanlı)
//   {t:"rng", s, r1, c1, r2, c2}        aralık (r1/r2 null: tüm kolon; c1/c2 null: tüm satır)
//   {t:"fn", n, a:[...]}                işlev (ad büyük harf, _xlfn. öneki atılmış)
//   {t:"bin", o, l, r} {t:"neg", e} {t:"pct", e} {t:"arr", rows:[[...]]}

export class FormulaError extends Error {
  constructor(message) {
    super(message);
    this.name = "FormulaError";
  }
}

const ERRORS = ["#NULL!", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#N/A", "#GETTING_DATA", "#SPILL!", "#CALC!"];
const MAX_COL = 16_384;
const MAX_ROW = 1_048_576;

export function colToIndex(letters) {
  let value = 0;
  for (const char of letters.toUpperCase()) value = value * 26 + (char.charCodeAt(0) - 64);
  return value - 1;
}
export function indexToCol(index) {
  let value = index + 1;
  let out = "";
  while (value > 0) {
    const rest = (value - 1) % 26;
    out = String.fromCharCode(65 + rest) + out;
    value = Math.floor((value - 1) / 26);
  }
  return out;
}

const CELL = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})/;
const COLS = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![\w(])/;
const ROWS = /^(\$?)(\d{1,7}):(\$?)(\d{1,7})(?![\w.(])/;
const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const IDENT = /^[A-Za-z_\\][A-Za-z0-9_.]*/;
const SHEET_PLAIN = /^([A-Za-z_À-￿][\w.À-￿]*)!/;

// Hücre/aralık başvurusunu (sayfa önekiyle) okumaya çalışır; başarısızsa null.
function readReference(text, index) {
  let rest = text.slice(index);
  let sheet = null;
  let consumed = 0;
  if (rest[0] === "'") {
    let end = 1;
    let name = "";
    while (end < rest.length) {
      if (rest[end] === "'" && rest[end + 1] === "'") {
        name += "'";
        end += 2;
      } else if (rest[end] === "'") break;
      else name += rest[end++];
    }
    if (rest[end] !== "'" || rest[end + 1] !== "!") return null;
    sheet = name;
    consumed = end + 2;
  } else {
    const plain = SHEET_PLAIN.exec(rest);
    if (plain) {
      sheet = plain[1];
      consumed = plain[0].length;
    }
  }
  rest = rest.slice(consumed);
  const make = (node, length) => ({ node: { ...node, s: sheet }, length: consumed + length });
  let match = COLS.exec(rest);
  if (match) {
    const c1 = colToIndex(match[2]);
    const c2 = colToIndex(match[4]);
    return make({ t: "rng", r1: null, c1: Math.min(c1, c2), r2: null, c2: Math.max(c1, c2), a: [false, !!match[1], false, !!match[3]] }, match[0].length);
  }
  match = ROWS.exec(rest);
  if (match) {
    const r1 = Number(match[2]) - 1;
    const r2 = Number(match[4]) - 1;
    return make({ t: "rng", r1: Math.min(r1, r2), c1: null, r2: Math.max(r1, r2), c2: null, a: [!!match[1], false, !!match[3], false] }, match[0].length);
  }
  match = CELL.exec(rest);
  if (!match) return null;
  const after = rest[match[0].length];
  if (after === "(" || (after && /[A-Za-z0-9_.]/.test(after) && after !== ":")) return null; // LOG10( gibi işlev adı
  const first = { r: Number(match[4]) - 1, c: colToIndex(match[2]), ra: !!match[3], ca: !!match[1] };
  if (first.c >= MAX_COL || first.r < 0 || first.r >= MAX_ROW) return null;
  let length = match[0].length;
  if (rest[length] === ":") {
    const second = CELL.exec(rest.slice(length + 1));
    if (second && !/[A-Za-z0-9_.(]/.test(rest[length + 1 + second[0].length] || "")) {
      const other = { r: Number(second[4]) - 1, c: colToIndex(second[2]), ra: !!second[3], ca: !!second[1] };
      length += 1 + second[0].length;
      return make(
        { t: "rng", r1: Math.min(first.r, other.r), c1: Math.min(first.c, other.c), r2: Math.max(first.r, other.r), c2: Math.max(first.c, other.c), a: [first.ra, first.ca, other.ra, other.ca] },
        length,
      );
    }
  }
  return make({ t: "ref", r: first.r, c: first.c, a: [first.ra, first.ca] }, length);
}

// Belirteçler: {k, v, i (başlangıç), n (uzunluk)}. k: num, str, bool, err, ref, fn, name, op, lp, rp, comma, semi, lb, rb
export function tokenize(formula) {
  const text = String(formula ?? "").replace(/^=/, "");
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === " " || char === "\n" || char === "\r" || char === "\t") {
      index += 1;
      continue;
    }
    const start = index;
    if (char === '"') {
      let value = "";
      index += 1;
      while (index < text.length) {
        if (text[index] === '"' && text[index + 1] === '"') {
          value += '"';
          index += 2;
        } else if (text[index] === '"') break;
        else value += text[index++];
      }
      if (text[index] !== '"') throw new FormulaError("Kapanmamış metin");
      index += 1;
      tokens.push({ k: "str", v: value, i: start, n: index - start });
      continue;
    }
    if (char === "#") {
      const error = ERRORS.find(item => text.startsWith(item, index) || text.toUpperCase().startsWith(item, index));
      if (!error) throw new FormulaError("Bilinmeyen hata değeri");
      index += error.length;
      tokens.push({ k: "err", v: error, i: start, n: error.length });
      continue;
    }
    const reference = char === "'" || /[A-Za-z$_À-￿]/.test(char) || (/\d/.test(char) && /^\$?\d+:\$?\d+/.test(text.slice(index)) && tokens.at(-1)?.k !== "ref") ? readReference(text, index) : null;
    if (reference) {
      tokens.push({ k: "ref", v: reference.node, i: start, n: reference.length });
      index += reference.length;
      continue;
    }
    const number = NUMBER.exec(text.slice(index));
    if (number && /[\d.]/.test(char)) {
      tokens.push({ k: "num", v: Number(number[0]), i: start, n: number[0].length });
      index += number[0].length;
      continue;
    }
    const ident = IDENT.exec(text.slice(index));
    if (ident) {
      const word = ident[0];
      index += word.length;
      let lookahead = index;
      while (text[lookahead] === " ") lookahead += 1;
      if (text[lookahead] === "(") {
        const name = word.toUpperCase().replace(/^(_XLFN\.|_XLWS\.)+/, "").replace(/^_XLFN\./, "");
        tokens.push({ k: "fn", v: name, i: start, n: word.length });
      } else if (/^(TRUE|FALSE)$/i.test(word)) tokens.push({ k: "bool", v: word.toUpperCase() === "TRUE", i: start, n: word.length });
      else tokens.push({ k: "name", v: word, i: start, n: word.length });
      continue;
    }
    const two = text.slice(index, index + 2);
    if (two === "<=" || two === ">=" || two === "<>") {
      tokens.push({ k: "op", v: two, i: start, n: 2 });
      index += 2;
      continue;
    }
    const kinds = { "(": "lp", ")": "rp", ",": "comma", ";": "semi", "{": "lb", "}": "rb" };
    if (kinds[char]) tokens.push({ k: kinds[char], v: char, i: start, n: 1 });
    else if ("+-*/^&=<>%@".includes(char)) tokens.push({ k: "op", v: char, i: start, n: 1 });
    else throw new FormulaError(`Beklenmeyen karakter: ${char}`);
    index += 1;
  }
  return tokens;
}

const BINARY = { "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4, "^": 5 };

export function parse(formula) {
  const tokens = tokenize(formula);
  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];
  const expect = kind => {
    const token = next();
    if (!token || token.k !== kind) throw new FormulaError("Formül yazımı çözülemedi");
    return token;
  };

  function primary() {
    const token = next();
    if (!token) throw new FormulaError("Formül eksik");
    switch (token.k) {
      case "num":
        return { t: "num", v: token.v };
      case "str":
        return { t: "str", v: token.v };
      case "bool":
        return { t: "bool", v: token.v };
      case "err":
        return { t: "err", v: token.v };
      case "ref":
        return token.v;
      case "name":
        throw new FormulaError(`Tanımlı ad desteklenmiyor: ${token.v}`);
      case "fn": {
        expect("lp");
        const args = [];
        if (peek()?.k === "rp") {
          next();
          return { t: "fn", n: token.v, a: args };
        }
        for (;;) {
          if (peek()?.k === "comma" || peek()?.k === "rp") args.push({ t: "miss" });
          else args.push(expression(0));
          const separator = next();
          if (!separator) throw new FormulaError("Kapanmamış parantez");
          if (separator.k === "rp") break;
          if (separator.k !== "comma") throw new FormulaError("İşlev bağımsız değişkenleri çözülemedi");
        }
        return { t: "fn", n: token.v, a: args };
      }
      case "lp": {
        const inner = expression(0);
        expect("rp");
        return inner;
      }
      case "lb": {
        const rows = [[]];
        for (;;) {
          const negative = peek()?.k === "op" && peek().v === "-" ? (next(), true) : false;
          const item = next();
          if (!item || !["num", "str", "bool", "err"].includes(item.k)) throw new FormulaError("Dizi sabiti çözülemedi");
          rows.at(-1).push({ t: item.k, v: negative && item.k === "num" ? -item.v : item.v });
          const separator = next();
          if (!separator) throw new FormulaError("Kapanmamış dizi");
          if (separator.k === "rb") break;
          if (separator.k === "semi") rows.push([]);
          else if (separator.k !== "comma") throw new FormulaError("Dizi sabiti çözülemedi");
        }
        return { t: "arr", rows };
      }
      case "op":
        if (token.v === "-") return { t: "neg", e: expression(6) };
        if (token.v === "+") return expression(6);
        if (token.v === "@") return primary(); // örtük kesişim işareti: tek hücreli kullanımda etkisiz
        break;
      default:
        break;
    }
    throw new FormulaError("Formül yazımı çözülemedi");
  }

  function expression(minimum) {
    let left = primary();
    for (;;) {
      const token = peek();
      if (!token || token.k !== "op") break;
      if (token.v === "%") {
        next();
        left = { t: "pct", e: left };
        continue;
      }
      const precedence = BINARY[token.v];
      if (!precedence || precedence < minimum) break;
      next();
      // Tüm işleçler soldan sağa işler (Excel'de 2^3^2 = 64).
      left = { t: "bin", o: token.v, l: left, r: expression(precedence + 1) };
    }
    return left;
  }

  const tree = expression(0);
  if (position !== tokens.length) throw new FormulaError("Formülün sonu çözülemedi");
  return tree;
}

// Paylaşılan formül: ana hücredeki formül, göreli başvuruları (dr, dc) kadar kaydırılarak diğer hücreye uygulanır.
export function shiftFormula(formula, dr, dc) {
  if (!dr && !dc) return String(formula);
  const text = String(formula);
  const tokens = tokenize(text);
  let out = "";
  let cursor = 0;
  for (const token of tokens) {
    if (token.k !== "ref") continue;
    out += text.slice(cursor, token.i);
    out += referenceText(token.v, dr, dc, text.slice(token.i, token.i + token.n));
    cursor = token.i + token.n;
  }
  return out + text.slice(cursor);
}

function sheetPrefix(name) {
  if (name === null || name === undefined) return "";
  return /^[A-Za-z_][\w.]*$/.test(name) ? `${name}!` : `'${name.replace(/'/g, "''")}'!`;
}

function referenceText(node, dr, dc, original) {
  const prefix = original.includes("!") ? original.slice(0, original.lastIndexOf("!") + 1) : "";
  const shift = (value, absolute, delta) => (absolute ? value : value + delta);
  const cell = (r, c, ra, ca) => {
    const row = shift(r, ra, dr);
    const col = shift(c, ca, dc);
    if (row < 0 || col < 0) throw new FormulaError("Kaydırılan başvuru sayfanın dışına çıkıyor");
    return `${ca ? "$" : ""}${indexToCol(col)}${ra ? "$" : ""}${row + 1}`;
  };
  if (node.t === "ref") return prefix + cell(node.r, node.c, node.a[0], node.a[1]);
  const [ra1, ca1, ra2, ca2] = node.a;
  if (node.r1 === null) return `${prefix}${ca1 ? "$" : ""}${indexToCol(shift(node.c1, ca1, dc))}:${ca2 ? "$" : ""}${indexToCol(shift(node.c2, ca2, dc))}`;
  if (node.c1 === null) return `${prefix}${ra1 ? "$" : ""}${shift(node.r1, ra1, dr) + 1}:${ra2 ? "$" : ""}${shift(node.r2, ra2, dr) + 1}`;
  return `${prefix}${cell(node.r1, node.c1, ra1, ca1)}:${cell(node.r2, node.c2, ra2, ca2)}`;
}

// Kullanıcıya gösterilecek hâl: bu satırın hücreleri kolon adıyla yazılır ("=[Tutar]-SUM([Taksit 1]:[Taksit 5])").
export function displayFormula(formula, nameOf) {
  const text = String(formula).replace(/^=/, "");
  let tokens;
  try {
    tokens = tokenize(text);
  } catch {
    return `=${text}`;
  }
  let out = "";
  let cursor = 0;
  for (const token of tokens) {
    if (token.k === "fn") {
      out += text.slice(cursor, token.i) + token.v;
      cursor = token.i + token.n;
      continue;
    }
    if (token.k !== "ref") continue;
    const node = token.v;
    let replacement = null;
    if (node.t === "ref") {
      const name = nameOf(node.s, node.r, node.c);
      if (name) replacement = `[${name}]`;
    } else if (node.r1 !== null && node.r1 === node.r2 && node.c1 !== null) {
      const first = nameOf(node.s, node.r1, node.c1);
      const last = nameOf(node.s, node.r2, node.c2);
      if (first && last) replacement = `[${first}]:[${last}]`;
    }
    if (replacement === null) continue;
    out += text.slice(cursor, token.i) + replacement;
    cursor = token.i + token.n;
  }
  return `=${out}${text.slice(cursor)}`;
}

export { sheetPrefix };
