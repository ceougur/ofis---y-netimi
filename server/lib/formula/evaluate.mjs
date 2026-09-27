// Formül hesaplayıcı (v2.0.1). Bağlanmış ağacı (bind.mjs) hesaplar; hücre değerlerini ortam (env) verir.
// Desteklenen işlevler Excel'in İngilizce adlarıyladır (dosyada formüller böyle saklanır). Desteklenmeyen bir işlevde
// UnsupportedFormula atılır: o formül hesaplanmaz, hücrede Excel/Sheets'ten gelen son değer kalır.
import { Cell, CellError, ERR, isError, numberToText, partsFromSerial, serialFromParts, todaySerial, nowSerial } from "./values.mjs";

export class UnsupportedFormula extends Error {
  constructor(message) {
    super(message);
    this.name = "UnsupportedFormula";
  }
}

// ---------- Değer dönüşümleri ----------
const unwrap = value => (value instanceof Cell ? value.value : value);

function toNumber(value) {
  const raw = unwrap(value);
  if (raw === null || raw === undefined) return 0;
  if (isError(raw)) return raw;
  if (typeof raw === "number") return raw;
  if (typeof raw === "boolean") return raw ? 1 : 0;
  if (Array.isArray(raw)) return toNumber(raw[0]?.[0]);
  const text = String(raw).trim();
  if (!text) return 0;
  const parsed = new Cell(text).value;
  return typeof parsed === "number" ? parsed : ERR.value;
}
function toText(value) {
  if (value instanceof Cell) {
    if (isError(value.value)) return value.value;
    return value.text;
  }
  if (value === null || value === undefined) return "";
  if (isError(value)) return value;
  if (typeof value === "boolean") return value ? "DOĞRU" : "YANLIŞ";
  if (typeof value === "number") return numberToText(value);
  if (Array.isArray(value)) return toText(value[0]?.[0]);
  return String(value);
}
function toBool(value) {
  const raw = unwrap(value);
  if (raw === null || raw === undefined) return false;
  if (isError(raw)) return raw;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  const upper = String(raw).toLocaleUpperCase("tr-TR");
  if (upper === "TRUE" || upper === "DOĞRU") return true;
  if (upper === "FALSE" || upper === "YANLIŞ") return false;
  return ERR.value;
}
const isBlank = value => {
  const raw = unwrap(value);
  return raw === null || raw === undefined || raw === "";
};

// Aralık/dizi → düz liste (hücreler). Tek değer → [değer].
function flatten(value) {
  if (Array.isArray(value)) {
    const out = [];
    for (const row of value) for (const item of row) out.push(item);
    return out;
  }
  return [value];
}
const grid = value => (Array.isArray(value) ? value : [[value]]);

// SUM gibi toplayıcılar: aralıktaki metin ve boşlar atlanır; doğrudan yazılan metin sayıya çevrilir.
function numbersOf(args) {
  const out = [];
  for (const arg of args) {
    if (Array.isArray(arg.value)) {
      for (const item of flatten(arg.value)) {
        const raw = unwrap(item);
        if (isError(raw)) throw raw;
        if (typeof raw === "number") out.push(raw);
      }
    } else {
      const raw = unwrap(arg.value);
      if (raw === null || raw === undefined) continue;
      if (arg.value instanceof Cell && typeof raw !== "number") {
        if (isError(raw)) throw raw;
        continue;
      }
      const number = toNumber(arg.value);
      if (isError(number)) throw number;
      out.push(number);
    }
  }
  return out;
}

const fold = value => String(value ?? "").toLocaleLowerCase("tr-TR");

// COUNTIF/SUMIF ölçütü: ">100", "<>Kapandı", "=a*", "Ankara", 5.
function criterion(raw) {
  const value = unwrap(raw);
  if (typeof value === "number" || typeof value === "boolean") return item => {
    const candidate = unwrap(item);
    return typeof value === "number" ? typeof candidate === "number" && candidate === value : candidate === value;
  };
  const text = String(value ?? "");
  const match = /^(<=|>=|<>|=|<|>)?(.*)$/s.exec(text);
  const operator = match[1] || "=";
  const operand = match[2];
  const numeric = new Cell(operand).value;
  if (typeof numeric === "number" && operand.trim() !== "") {
    return item => {
      const candidate = unwrap(item);
      if (typeof candidate !== "number") return operator === "<>";
      return compareNumbers(candidate, numeric, operator);
    };
  }
  const pattern = new RegExp(`^${operand.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/~\*/g, "\u0001").replace(/~\?/g, "\u0002").replace(/\*/g, ".*").replace(/\?/g, ".").replace(/\u0001/g, "\\*").replace(/\u0002/g, "\\?")}$`, "is");
  return item => {
    const candidate = item instanceof Cell ? item.text : toText(item);
    if (isError(candidate)) return false;
    if (operator === "=") return operand === "" ? isBlank(item) : pattern.test(fold(candidate)) || pattern.test(candidate);
    if (operator === "<>") return operand === "" ? !isBlank(item) : !(pattern.test(fold(candidate)) || pattern.test(candidate));
    const a = fold(candidate);
    const b = fold(operand);
    return operator === "<" ? a < b : operator === ">" ? a > b : operator === "<=" ? a <= b : a >= b;
  };
}
function compareNumbers(a, b, operator) {
  switch (operator) {
    case "=":
      return a === b;
    case "<>":
      return a !== b;
    case "<":
      return a < b;
    case ">":
      return a > b;
    case "<=":
      return a <= b;
    default:
      return a >= b;
  }
}

// Excel karşılaştırması: sayı < metin < mantıksal; metinler büyük/küçük harf duyarsız.
function compare(left, right, operator) {
  let a = unwrap(left);
  let b = unwrap(right);
  if (isError(a)) return a;
  if (isError(b)) return b;
  if (a === null || a === undefined) a = typeof b === "string" ? "" : typeof b === "boolean" ? false : 0;
  if (b === null || b === undefined) b = typeof a === "string" ? "" : typeof a === "boolean" ? false : 0;
  const rank = value => (typeof value === "number" ? 0 : typeof value === "string" ? 1 : 2);
  if (rank(a) !== rank(b)) {
    const difference = rank(a) - rank(b);
    return compareNumbers(difference, 0, operator);
  }
  if (typeof a === "string") {
    a = fold(a);
    b = fold(b);
    const order = a < b ? -1 : a > b ? 1 : 0;
    return compareNumbers(order, 0, operator);
  }
  return compareNumbers(Number(a), Number(b), operator);
}

const round = (value, digits, mode = "round") => {
  const factor = 10 ** digits;
  const scaled = Math.abs(value) * factor;
  const fixed = Number(scaled.toPrecision(15));
  const rounded = mode === "up" ? Math.ceil(fixed) : mode === "down" ? Math.floor(fixed) : Math.round(fixed);
  return (Math.sign(value) * rounded) / factor;
};

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function addMonths(serial, months) {
  const p = partsFromSerial(serial);
  const total = p.y * 12 + (p.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return serialFromParts(y, m, Math.min(p.d, daysInMonth(y, m)));
}

// ---------- Hesaplama ----------
// env: { cell(node) → Cell|değer (bağlı hücre), range(node) → 2B dizi, now: Date, onVolatile() }
export function evaluate(node, env) {
  const value = run(node, env);
  return value instanceof Cell ? value : Array.isArray(value) ? value[0]?.[0] ?? null : value;
}

function run(node, env) {
  switch (node.t) {
    case "num":
    case "str":
    case "bool":
      return node.v;
    case "err":
      return Object.values(ERR).find(item => item.code === node.v) || new CellError(node.v);
    case "miss":
      return null;
    case "f":
    case "x":
    case "l":
      return env.cell(node);
    case "a":
      return node.rows.map(row => row.map(item => env.cell(item)));
    case "arr":
      return node.rows.map(row => row.map(item => run(item, env)));
    case "neg": {
      const value = toNumber(run(node.e, env));
      return isError(value) ? value : -value;
    }
    case "pct": {
      const value = toNumber(run(node.e, env));
      return isError(value) ? value : value / 100;
    }
    case "bin":
      return binary(node, env);
    case "fn":
      return call(node, env);
    default:
      throw new UnsupportedFormula("Bilinmeyen formül parçası");
  }
}

function binary(node, env) {
  const left = run(node.l, env);
  const right = run(node.r, env);
  const scalar = value => (Array.isArray(value) ? value[0]?.[0] ?? null : value);
  const a = scalar(left);
  const b = scalar(right);
  if (node.o === "&") {
    const x = toText(a);
    const y = toText(b);
    return isError(x) ? x : isError(y) ? y : `${x}${y}`;
  }
  if (["=", "<>", "<", ">", "<=", ">="].includes(node.o)) return compare(a, b, node.o);
  const x = toNumber(a);
  const y = toNumber(b);
  if (isError(x)) return x;
  if (isError(y)) return y;
  switch (node.o) {
    case "+":
      return x + y;
    case "-":
      return x - y;
    case "*":
      return x * y;
    case "/":
      return y === 0 ? ERR.div0 : x / y;
    case "^": {
      const result = x ** y;
      return Number.isFinite(result) ? result : ERR.num;
    }
    default:
      throw new UnsupportedFormula(`Desteklenmeyen işleç: ${node.o}`);
  }
}

// İşlevler: args → [{ node, value (hesaplanmış) }]. Tembel işlevler (IF, IFERROR…) kendi dallarını hesaplar.
const LAZY = new Set(["IF", "IFS", "IFERROR", "IFNA", "AND", "OR", "SWITCH", "CHOOSE", "ISERROR", "ISERR", "ISNA"]);

function call(node, env) {
  const name = node.n;
  if (LAZY.has(name)) return lazy(name, node.a, env);
  const impl = FUNCTIONS[name];
  if (!impl) throw new UnsupportedFormula(`Desteklenmeyen işlev: ${name}`);
  const args = node.a.map(arg => ({ node: arg, value: run(arg, env) }));
  try {
    const result = impl(args, env);
    return result === undefined ? null : result;
  } catch (error) {
    if (isError(error)) return error;
    throw error;
  }
}

function lazy(name, nodes, env) {
  const value = index => (nodes[index] ? run(nodes[index], env) : null);
  const scalar = item => (Array.isArray(item) ? item[0]?.[0] ?? null : item);
  switch (name) {
    case "IF": {
      const test = toBool(scalar(value(0)));
      if (isError(test)) return test;
      if (test) return nodes.length > 1 ? value(1) ?? 0 : true;
      return nodes.length > 2 ? value(2) ?? 0 : false;
    }
    case "IFS":
      for (let index = 0; index + 1 < nodes.length; index += 2) {
        const test = toBool(scalar(value(index)));
        if (isError(test)) return test;
        if (test) return value(index + 1);
      }
      return ERR.na;
    case "IFERROR": {
      const result = scalar(value(0));
      return isError(unwrap(result)) ? value(1) : result;
    }
    case "IFNA": {
      const result = scalar(value(0));
      return unwrap(result) === ERR.na ? value(1) : result;
    }
    case "ISERROR":
    case "ISERR":
      return isError(unwrap(scalar(value(0))));
    case "ISNA":
      return unwrap(scalar(value(0))) === ERR.na;
    case "AND":
    case "OR": {
      let result = name === "AND";
      let seen = false;
      for (let index = 0; index < nodes.length; index += 1) {
        for (const item of flatten(value(index))) {
          if (isBlank(item) || (item instanceof Cell && typeof item.value === "string")) continue;
          const bool = toBool(item);
          if (isError(bool)) return bool;
          seen = true;
          result = name === "AND" ? result && bool : result || bool;
        }
      }
      return seen ? result : ERR.value;
    }
    case "SWITCH": {
      const target = scalar(value(0));
      let index = 1;
      for (; index + 1 < nodes.length; index += 2) if (compare(target, scalar(value(index)), "=") === true) return value(index + 1);
      return index < nodes.length ? value(index) : ERR.na;
    }
    case "CHOOSE": {
      const pick = Math.trunc(toNumber(scalar(value(0))));
      if (isError(pick)) return pick;
      if (pick < 1 || pick >= nodes.length) return ERR.value;
      return value(pick);
    }
    default:
      throw new UnsupportedFormula(name);
  }
}

// ---------- İşlev tablosu ----------
const num = arg => {
  const value = toNumber(Array.isArray(arg?.value) ? arg.value[0]?.[0] : arg?.value);
  if (isError(value)) throw value;
  return value;
};
const optNum = (arg, fallback) => (!arg || arg.node.t === "miss" ? fallback : num(arg));
const txt = arg => {
  const value = toText(Array.isArray(arg?.value) ? arg.value[0]?.[0] : arg?.value);
  if (isError(value)) throw value;
  return value;
};
const bool = arg => {
  const value = toBool(Array.isArray(arg?.value) ? arg.value[0]?.[0] : arg?.value);
  if (isError(value)) throw value;
  return value;
};
const cells = arg => flatten(arg.value);

function conditional(args, pairsFrom) {
  // Ölçüt çiftleri: (aralık, ölçüt), (aralık, ölçüt)…; aynı boyutta olmalı.
  const pairs = [];
  for (let index = pairsFrom; index + 1 < args.length; index += 2) pairs.push({ range: cells(args[index]), test: criterion(Array.isArray(args[index + 1].value) ? args[index + 1].value[0]?.[0] : args[index + 1].value) });
  const size = pairs[0]?.range.length ?? 0;
  if (pairs.some(pair => pair.range.length !== size)) throw ERR.value;
  const matches = [];
  for (let index = 0; index < size; index += 1) if (pairs.every(pair => pair.test(pair.range[index]))) matches.push(index);
  return matches;
}
const numericAt = (list, index) => {
  const raw = unwrap(list[index]);
  return typeof raw === "number" ? raw : null;
};

function lookupIndex(needle, list, exact = true) {
  const target = unwrap(needle);
  if (exact) {
    for (let index = 0; index < list.length; index += 1) if (compare(list[index], target, "=") === true) return index;
    if (typeof target === "string" && /[*?]/.test(target)) {
      const test = criterion(target);
      for (let index = 0; index < list.length; index += 1) if (test(list[index])) return index;
    }
    return -1;
  }
  // Yaklaşık eşleşme (sıralı liste): hedeften küçük ya da eşit en büyük değer.
  let found = -1;
  for (let index = 0; index < list.length; index += 1) {
    if (isBlank(list[index])) continue;
    if (compare(list[index], target, "<=") === true) found = index;
    else break;
  }
  return found;
}

const FUNCTIONS = {
  // Toplama ve sayma
  SUM: args => numbersOf(args).reduce((total, value) => total + value, 0),
  PRODUCT: args => numbersOf(args).reduce((total, value) => total * value, 1),
  AVERAGE: args => {
    const list = numbersOf(args);
    return list.length ? list.reduce((a, b) => a + b, 0) / list.length : ERR.div0;
  },
  MIN: args => {
    const list = numbersOf(args);
    return list.length ? Math.min(...list) : 0;
  },
  MAX: args => {
    const list = numbersOf(args);
    return list.length ? Math.max(...list) : 0;
  },
  MEDIAN: args => {
    const list = numbersOf(args).sort((a, b) => a - b);
    if (!list.length) return ERR.num;
    const middle = Math.floor(list.length / 2);
    return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
  },
  COUNT: args => args.reduce((total, arg) => total + flatten(arg.value).filter(item => typeof unwrap(item) === "number").length, 0),
  COUNTA: args => args.reduce((total, arg) => total + flatten(arg.value).filter(item => !isBlank(item)).length, 0),
  COUNTBLANK: args => args.reduce((total, arg) => total + flatten(arg.value).filter(isBlank).length, 0),
  COUNTIF: args => conditional(args, 0).length,
  COUNTIFS: args => conditional(args, 0).length,
  SUMIF: args => {
    const range = cells(args[0]);
    const target = args[2] ? cells(args[2]) : range;
    const test = criterion(Array.isArray(args[1].value) ? args[1].value[0]?.[0] : args[1].value);
    let total = 0;
    range.forEach((item, index) => {
      if (test(item)) total += numericAt(target, index) ?? 0;
    });
    return total;
  },
  SUMIFS: args => {
    const target = cells(args[0]);
    return conditional(args, 1).reduce((total, index) => total + (numericAt(target, index) ?? 0), 0);
  },
  AVERAGEIF: args => {
    const range = cells(args[0]);
    const target = args[2] ? cells(args[2]) : range;
    const test = criterion(Array.isArray(args[1].value) ? args[1].value[0]?.[0] : args[1].value);
    const list = range.map((item, index) => (test(item) ? numericAt(target, index) : null)).filter(value => value !== null);
    return list.length ? list.reduce((a, b) => a + b, 0) / list.length : ERR.div0;
  },
  AVERAGEIFS: args => {
    const target = cells(args[0]);
    const list = conditional(args, 1).map(index => numericAt(target, index)).filter(value => value !== null);
    return list.length ? list.reduce((a, b) => a + b, 0) / list.length : ERR.div0;
  },
  MAXIFS: args => {
    const target = cells(args[0]);
    const list = conditional(args, 1).map(index => numericAt(target, index)).filter(value => value !== null);
    return list.length ? Math.max(...list) : 0;
  },
  MINIFS: args => {
    const target = cells(args[0]);
    const list = conditional(args, 1).map(index => numericAt(target, index)).filter(value => value !== null);
    return list.length ? Math.min(...list) : 0;
  },
  SUMPRODUCT: args => {
    const lists = args.map(arg => cells(arg));
    const size = lists[0]?.length ?? 0;
    if (lists.some(list => list.length !== size)) return ERR.value;
    let total = 0;
    for (let index = 0; index < size; index += 1) total += lists.reduce((product, list) => product * (numericAt(list, index) ?? 0), 1);
    return total;
  },
  // Yuvarlama ve aritmetik
  ROUND: args => round(num(args[0]), optNum(args[1], 0)),
  ROUNDUP: args => round(num(args[0]), optNum(args[1], 0), "up"),
  ROUNDDOWN: args => round(num(args[0]), optNum(args[1], 0), "down"),
  TRUNC: args => round(num(args[0]), optNum(args[1], 0), "down"),
  INT: args => Math.floor(num(args[0])),
  ABS: args => Math.abs(num(args[0])),
  SIGN: args => Math.sign(num(args[0])),
  MOD: args => {
    const divisor = num(args[1]);
    if (divisor === 0) return ERR.div0;
    const value = num(args[0]);
    return value - divisor * Math.floor(value / divisor);
  },
  POWER: args => num(args[0]) ** num(args[1]),
  SQRT: args => {
    const value = num(args[0]);
    return value < 0 ? ERR.num : Math.sqrt(value);
  },
  CEILING: args => {
    const step = optNum(args[1], 1);
    return step === 0 ? 0 : Math.ceil(num(args[0]) / step) * step;
  },
  "CEILING.MATH": args => {
    const step = Math.abs(optNum(args[1], 1)) || 1;
    return Math.ceil(num(args[0]) / step) * step;
  },
  FLOOR: args => {
    const step = optNum(args[1], 1);
    return step === 0 ? ERR.div0 : Math.floor(num(args[0]) / step) * step;
  },
  "FLOOR.MATH": args => {
    const step = Math.abs(optNum(args[1], 1)) || 1;
    return Math.floor(num(args[0]) / step) * step;
  },
  PI: () => Math.PI,
  // Finans: taksit hesabı
  PMT: args => {
    const rate = num(args[0]);
    const periods = num(args[1]);
    const present = num(args[2]);
    const future = optNum(args[3], 0);
    const type = optNum(args[4], 0) ? 1 : 0;
    if (periods === 0) return ERR.num;
    if (rate === 0) return -(present + future) / periods;
    const factor = (1 + rate) ** periods;
    return -(rate * (present * factor + future)) / ((1 + rate * type) * (factor - 1));
  },
  // Mantıksal ve bilgi
  NOT: args => !bool(args[0]),
  TRUE: () => true,
  FALSE: () => false,
  ISBLANK: args => isBlank(Array.isArray(args[0].value) ? args[0].value[0]?.[0] : args[0].value),
  ISNUMBER: args => typeof unwrap(Array.isArray(args[0].value) ? args[0].value[0]?.[0] : args[0].value) === "number",
  ISTEXT: args => typeof unwrap(Array.isArray(args[0].value) ? args[0].value[0]?.[0] : args[0].value) === "string",
  ISEVEN: args => Math.trunc(num(args[0])) % 2 === 0,
  ISODD: args => Math.abs(Math.trunc(num(args[0])) % 2) === 1,
  N: args => {
    const raw = unwrap(args[0].value);
    return typeof raw === "number" ? raw : typeof raw === "boolean" ? Number(raw) : 0;
  },
  NA: () => ERR.na,
  // Metin
  CONCATENATE: args => args.map(txt).join(""),
  CONCAT: args => args.flatMap(arg => cells(arg).map(item => {
    const value = toText(item);
    if (isError(value)) throw value;
    return value;
  })).join(""),
  TEXTJOIN: args => {
    const separator = txt(args[0]);
    const skipEmpty = bool(args[1]);
    const parts = args.slice(2).flatMap(arg => cells(arg).map(item => {
      const value = toText(item);
      if (isError(value)) throw value;
      return value;
    }));
    return (skipEmpty ? parts.filter(Boolean) : parts).join(separator);
  },
  LEFT: args => txt(args[0]).slice(0, Math.max(0, optNum(args[1], 1))),
  RIGHT: args => {
    const count = Math.max(0, optNum(args[1], 1));
    const text = txt(args[0]);
    return count ? text.slice(-count) : "";
  },
  MID: args => txt(args[0]).substr(Math.max(0, num(args[1]) - 1), Math.max(0, num(args[2]))),
  LEN: args => txt(args[0]).length,
  UPPER: args => txt(args[0]).toLocaleUpperCase("tr-TR"),
  LOWER: args => txt(args[0]).toLocaleLowerCase("tr-TR"),
  PROPER: args => txt(args[0]).toLocaleLowerCase("tr-TR").replace(/(^|[^\p{L}])(\p{L})/gu, (_, before, letter) => before + letter.toLocaleUpperCase("tr-TR")),
  TRIM: args => txt(args[0]).trim().replace(/ {2,}/g, " "),
  SUBSTITUTE: args => {
    const text = txt(args[0]);
    const find = txt(args[1]);
    const replacement = txt(args[2]);
    if (!find) return text;
    if (!args[3] || args[3].node.t === "miss") return text.split(find).join(replacement);
    const which = num(args[3]);
    let seen = 0;
    return text.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), match => (++seen === which ? replacement : match));
  },
  REPLACE: args => {
    const text = txt(args[0]);
    const start = Math.max(1, num(args[1])) - 1;
    return text.slice(0, start) + txt(args[3]) + text.slice(start + Math.max(0, num(args[2])));
  },
  FIND: args => {
    const index = txt(args[1]).indexOf(txt(args[0]), Math.max(1, optNum(args[2], 1)) - 1);
    return index < 0 ? ERR.value : index + 1;
  },
  SEARCH: args => {
    const index = fold(txt(args[1])).indexOf(fold(txt(args[0])), Math.max(1, optNum(args[2], 1)) - 1);
    return index < 0 ? ERR.value : index + 1;
  },
  REPT: args => txt(args[0]).repeat(Math.max(0, Math.min(10_000, num(args[1])))),
  EXACT: args => txt(args[0]) === txt(args[1]),
  VALUE: args => {
    const value = new Cell(txt(args[0])).value;
    return typeof value === "number" ? value : ERR.value;
  },
  T: args => {
    const raw = unwrap(args[0].value);
    return typeof raw === "string" ? raw : "";
  },
  TEXT: args => textFormat(num(args[0]), txt(args[1])),
  // Tarih
  TODAY: (args, env) => {
    env.onVolatile?.();
    return todaySerial(env.now);
  },
  NOW: (args, env) => {
    env.onVolatile?.();
    return nowSerial(env.now);
  },
  DATE: args => {
    const y = num(args[0]);
    const m = num(args[1]);
    const d = num(args[2]);
    const total = Math.trunc(y) * 12 + (Math.trunc(m) - 1);
    return serialFromParts(Math.floor(total / 12), (total % 12 + 12) % 12 + 1, 1) + Math.trunc(d) - 1;
  },
  DATEVALUE: args => {
    const value = new Cell(txt(args[0])).value;
    return typeof value === "number" ? Math.floor(value) : ERR.value;
  },
  YEAR: args => partsFromSerial(num(args[0])).y,
  MONTH: args => partsFromSerial(num(args[0])).m,
  DAY: args => partsFromSerial(num(args[0])).d,
  HOUR: args => partsFromSerial(num(args[0])).hh,
  MINUTE: args => partsFromSerial(num(args[0])).mm,
  WEEKDAY: args => {
    const dow = partsFromSerial(num(args[0])).dow; // 0 = Pazar
    const type = optNum(args[1], 1);
    if (type === 2) return dow === 0 ? 7 : dow;
    if (type === 3) return dow === 0 ? 6 : dow - 1;
    return dow + 1;
  },
  EDATE: args => addMonths(Math.floor(num(args[0])), Math.trunc(num(args[1]))),
  EOMONTH: args => {
    const shifted = partsFromSerial(addMonths(Math.floor(num(args[0])), Math.trunc(num(args[1]))));
    return serialFromParts(shifted.y, shifted.m, daysInMonth(shifted.y, shifted.m));
  },
  DAYS: args => Math.floor(num(args[0])) - Math.floor(num(args[1])),
  DATEDIF: args => {
    const start = Math.floor(num(args[0]));
    const end = Math.floor(num(args[1]));
    if (end < start) return ERR.num;
    const unit = txt(args[2]).toUpperCase();
    const a = partsFromSerial(start);
    const b = partsFromSerial(end);
    let months = (b.y - a.y) * 12 + (b.m - a.m);
    if (b.d < a.d) months -= 1;
    if (unit === "D") return end - start;
    if (unit === "M") return months;
    if (unit === "Y") return Math.floor(months / 12);
    if (unit === "YM") return months % 12;
    if (unit === "MD") return b.d >= a.d ? b.d - a.d : end - addMonths(start, months);
    if (unit === "YD") {
      const anniversary = serialFromParts(b.y, a.m, Math.min(a.d, daysInMonth(b.y, a.m)));
      return anniversary <= end ? end - anniversary : end - serialFromParts(b.y - 1, a.m, Math.min(a.d, daysInMonth(b.y - 1, a.m)));
    }
    return ERR.num;
  },
  NETWORKDAYS: args => {
    let start = Math.floor(num(args[0]));
    let end = Math.floor(num(args[1]));
    const sign = end < start ? -1 : 1;
    if (sign < 0) [start, end] = [end, start];
    const holidays = new Set(args[2] ? cells(args[2]).map(item => unwrap(item)).filter(value => typeof value === "number").map(Math.floor) : []);
    let count = 0;
    for (let day = start; day <= end && day - start < 40_000; day += 1) {
      const dow = partsFromSerial(day).dow;
      if (dow !== 0 && dow !== 6 && !holidays.has(day)) count += 1;
    }
    return sign * count;
  },
  // Arama
  VLOOKUP: args => {
    const table = grid(args[1].value);
    const column = Math.trunc(num(args[2]));
    if (column < 1 || column > (table[0]?.length ?? 0)) return ERR.ref;
    // 4. bağımsız değişken YANLIŞ ise tam eşleşme; verilmezse ya da DOĞRU ise yaklaşık (sıralı liste).
    const exact = args[3] && args[3].node.t !== "miss" ? !bool(args[3]) : false;
    const index = lookupIndex(Array.isArray(args[0].value) ? args[0].value[0]?.[0] : args[0].value, table.map(row => row[0]), exact);
    return index < 0 ? ERR.na : table[index][column - 1];
  },
  HLOOKUP: args => {
    const table = grid(args[1].value);
    const row = Math.trunc(num(args[2]));
    if (row < 1 || row > table.length) return ERR.ref;
    const index = lookupIndex(Array.isArray(args[0].value) ? args[0].value[0]?.[0] : args[0].value, table[0], args[3] && args[3].node.t !== "miss" ? !bool(args[3]) : false);
    return index < 0 ? ERR.na : table[row - 1][index];
  },
  MATCH: args => {
    const list = cells(args[1]);
    const type = optNum(args[2], 1);
    const needle = Array.isArray(args[0].value) ? args[0].value[0]?.[0] : args[0].value;
    const index = type === 0 ? lookupIndex(needle, list, true) : lookupIndex(needle, list, false);
    return index < 0 ? ERR.na : index + 1;
  },
  INDEX: args => {
    const table = grid(args[0].value);
    let row = Math.trunc(optNum(args[1], 0));
    let column = Math.trunc(optNum(args[2], 0));
    if (table.length === 1 && !args[2]) {
      column = row;
      row = 1;
    }
    if (row < 0 || column < 0 || row > table.length || column > (table[0]?.length ?? 0)) return ERR.ref;
    return table[Math.max(1, row) - 1][Math.max(1, column) - 1];
  },
  XLOOKUP: args => {
    const needle = Array.isArray(args[0].value) ? args[0].value[0]?.[0] : args[0].value;
    const index = lookupIndex(needle, cells(args[1]), true);
    if (index < 0) return args[3] && args[3].node.t !== "miss" ? args[3].value : ERR.na;
    return cells(args[2])[index];
  },
  LOOKUP: args => {
    const index = lookupIndex(Array.isArray(args[0].value) ? args[0].value[0]?.[0] : args[0].value, cells(args[1]), false);
    if (index < 0) return ERR.na;
    return (args[2] ? cells(args[2]) : cells(args[1]))[index];
  },
  ROWS: args => grid(args[0].value).length,
  COLUMNS: args => grid(args[0].value)[0]?.length ?? 0,
};

// TEXT işlevi: yaygın biçimler ("0", "0,00", "#.##0,00", "dd.mm.yyyy", "0%"). İngilizce biçim kodları da kabul edilir.
function textFormat(value, format) {
  const code = String(format);
  if (/[dmy]/i.test(code) && !/[#0]/.test(code)) {
    const p = partsFromSerial(value);
    const pad = item => String(item).padStart(2, "0");
    return code
      .replace(/yyyy/gi, String(p.y))
      .replace(/yy/gi, String(p.y).slice(-2))
      .replace(/dd/gi, pad(p.d))
      .replace(/mm/gi, pad(p.m))
      .replace(/(?<![a-z])d(?![a-z])/gi, String(p.d))
      .replace(/(?<![a-z])m(?![a-z])/gi, String(p.m));
  }
  const percent = code.includes("%");
  const english = /\.\d*0$|\.0+%?$/.test(code.replace(/[^#0.,%]/g, "")) && !/,0/.test(code);
  const decimalSeparator = english ? "." : ",";
  const decimals = code.includes(decimalSeparator) ? (code.split(decimalSeparator).pop().match(/0/g) || []).length : 0;
  const grouping = english ? code.includes(",") : code.includes(".");
  const body = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping }).format(percent ? value * 100 : value);
  return `${body}${percent ? "%" : ""}`;
}
