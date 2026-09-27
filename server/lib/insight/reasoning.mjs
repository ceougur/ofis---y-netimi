// Mantık denetimi (v2.0.1): verinin kendi kurallarını öğrenir, kurala uymayan kayıtları bulur.
// Saf fonksiyondur (girdi aynıysa çıktı aynı); internete çıkmaz, veritabanına yazmaz. Kurallar ezberlenmiş kolon
// adlarına değil, verinin kendisine dayanır; bir kural ancak kayıtların büyük çoğunluğunda tutuyorsa "öğrenilmiş"
// sayılır ve yalnızca ona uymayan az sayıdaki kayıt işaretlenir. Böylece farklı sektörlerde ve farklı düzenlerde
// yanlış alarm vermez.
//
// Öğrenilen/denetlenen durumlar (her sekme kendi kolonlarıyla):
//   relation — hesap ilişkisi: T = A − (B …) ya da T = B1 + B2 + …  (ör. Kalan = Tutar − Taksit 1 − Taksit 2)
//              Uymayan kayıtta doğru değer önerilir.
//   negative — hep artı olan bir kolonda eksi değer (ör. Kalan −500: fazla tahsilat ya da yanlış taksit)
//   status   — durum ile bakiye çelişkisi ("Ödendi" ama kalan borç var; "Borçlu" ama kalan 0)
//   order    — tarih sırası (bitiş, başlangıçtan önce), kayıtların neredeyse hepsinde öbürü önceyse
//   year     — yazım hatası gibi duran yıl (2062, 1926), kolonun geri kalanı başka yıllardayken
//   future   — hep geçmiş tarih taşıyan kolonda ileri tarih (ör. ödeme tarihi gelecekte)
//   outlier  — kolonun geri kalanının çok üstünde tutar (fazladan sıfır)
import { formatValue, parseNumberText } from "../formula/values.mjs";
import { isEmptyCell, isTotalLabel } from "./cells.mjs";
import { foldText, parseDate } from "./validators.mjs";

export const REASONING_VERSION = 1;
const MAX_FINDINGS = 3000;
const DISCOVERY_ROWS = 4000; // ilişkiler bu kadar satırdan öğrenilir, sonra tüm satırlarda denetlenir
const MAX_NUMERIC = 18;
const RULE_TITLES = {
  relation: "Hesap tutmuyor",
  negative: "Beklenmeyen eksi değer",
  status: "Durum ile bakiye çelişiyor",
  order: "Tarih sırası ters",
  year: "Yıl yanlış yazılmış olabilir",
  future: "İleri tarih",
  outlier: "Olağan dışı değer",
  compare: "Değerler ters görünüyor",
  required: "Eksik bilgi",
  payment: "Tahsilat ile tablo uyuşmuyor",
};
export const ruleTitle = rule => RULE_TITLES[rule] || "Olası tutarsızlık";

const CLOSED = /^(odendi|odenmis|odeme tamam(landi)?|tamamen odendi|tahsil edildi|tahsilat tamam(landi)?|kapandi|kapali|kapatildi|kapanmis|tamamlandi|tamam|bitti|sonuclandi|borc kapandi|paid|closed|done|settled)$/;
const OPEN = /^(borclu|odenmedi|odenmemis|acik|acik borc|bekliyor|beklemede|gecikmis|gecikmede|gecikti|vadesi gecmis|tahsil edilmedi|takipte|unpaid|open|overdue|pending)$/;
const BALANCE_NAME = /\b(kalan|bakiye|borc|acik|remaining|balance|outstanding)\b/;

// "Toplam" satırı (kayıt değil): önce ucuz bir ön eleme, sonra kesin denetim (büyük tablolarda hız için).
const TOTAL_HINT = /^\s*(genel\s+|ara\s+|grand\s+|sub\s*)?(toplam|total|yek[uû]n)/i;
function totalRow(row) {
  for (const key in row) {
    if (key.startsWith("__")) continue;
    const value = row[key];
    if (typeof value === "string" && value.length <= 40 && TOTAL_HINT.test(value) && isTotalLabel(value)) return true;
  }
  return false;
}

// Hızlı sayı okuma: telefon, kimlik ve yüzde sayı sayılmaz.
function numberOf(raw) {
  if (raw === null || raw === undefined) return Number.NaN;
  const text = String(raw).trim();
  if (!text || text.length > 32 || text.includes("%") || !/^[-+(₺$€£\dTtUuEe]/.test(text)) return Number.NaN;
  const bare = text.replace(/^[-+(]/, "");
  if (/^0\d/.test(bare) && !/[.,]/.test(bare)) return Number.NaN;
  if (!/[.,₺$€£]/.test(text) && !/\b(tl|try|usd|eur)\b/i.test(text) && text.replace(/\D/g, "").length >= 10) return Number.NaN;
  return parseNumberText(text);
}
const empty = value => isEmptyCell(value);
const tolerance = scale => Math.max(0.011, Math.abs(scale) * 0.0005);
const formulaOf = row => {
  if (!row.__hofFx) return null;
  try {
    return JSON.parse(row.__hofFx);
  } catch {
    return null;
  }
};
const DAY = 86_400_000;
const pad = value => String(value).padStart(2, "0");
const dateText = date => `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;
// Yüzdenin okunuşuna göre ekler: %98'i / %98'inde, %90'ı / %90'ında, %96'sı / %96'sında, %100'ü / %100'ünde.
const POSSESSIVE_UNITS = ["ı", "i", "si", "ü", "ü", "i", "sı", "si", "i", "u"];
const POSSESSIVE_TENS = [null, "u", "si", "u", "ı", "si", "ı", "i", "i", "ı"];
function possessive(value) {
  const digits = String(value);
  const at = offset => Number(digits.at(offset) || 0);
  return /^0+$/.test(digits) ? "ı" : at(-1) ? POSSESSIVE_UNITS[at(-1)] : at(-2) ? POSSESSIVE_TENS[at(-2)] : at(-3) ? "ü" : "i";
}
const percentOf = ratio => {
  const value = Math.round(ratio * 100);
  return `%${value}'${possessive(value)}`;
};
const percentIn = ratio => {
  const value = Math.round(ratio * 100);
  const suffix = possessive(value);
  return `%${value}'${suffix}${/[ıu]$/.test(suffix) ? "nda" : "nde"}`;
};
const quote = name => `“${name}”`;

// "Taksit 1", "TAKSİT-2", "1. Taksit", "Ödeme_3" → { stem: "taksit", index }
function stemOf(column) {
  const text = foldText(column).replace(/[_.-]+/g, " ").replace(/\s+/g, " ").trim();
  let match = /^(.*?)\s*(\d{1,2})$/.exec(text);
  if (match && match[1]) return { stem: match[1].trim(), index: Number(match[2]) };
  match = /^(\d{1,2})\s+(.*)$/.exec(text);
  if (match && match[2] && !/\d/.test(match[2])) return { stem: match[2].trim(), index: Number(match[1]) };
  return null;
}

/**
 * @param {Array<Record<string,string>>} rows tek sekmenin satırları
 * @param {string[]} columns o sekmenin kolonları
 */
export function reasonTab(rows, columns, { now = new Date(), titleOf = row => String(row.__hofKey || ""), tab = "" } = {}) {
  const findings = [];
  const relations = [];
  const data = rows.filter(row => !totalRow(row));
  if (data.length < 3) return { findings, relations };
  const add = (row, rule, severity, message, why, fields, extra = {}) => {
    if (findings.length >= MAX_FINDINGS) return;
    const key = String(row.__hofKey || "");
    const values = fields.map(field => String(row[field] ?? "")).join("|");
    findings.push({ key, tab: String(row.__sheet || tab), title: titleOf(row), rule, severity, message, why, fields, signature: `${rule}|${key}|${fields.join(",")}|${values}`.slice(0, 400), ...extra });
  };

  // ---------- Kolonları oku (her hücre bir kez) ----------
  const numeric = [];
  const dates = [];
  const texts = [];
  for (const column of columns) {
    let filled = 0;
    let numbers = 0;
    let dated = 0;
    const sample = data.length > 600 ? data.slice(0, 600) : data;
    for (const row of sample) {
      const value = row[column];
      if (empty(value)) continue;
      filled += 1;
      if (Number.isFinite(numberOf(value))) numbers += 1;
      else if (parseDate(String(value).trim())) dated += 1;
    }
    if (!filled) continue;
    if (numbers / filled >= 0.85) numeric.push(column);
    else if (dated / filled >= 0.85 && filled >= 5) dates.push(column);
    else texts.push(column);
  }
  const numericCols = numeric.slice(0, MAX_NUMERIC);
  const values = new Map(); // kolon → Float64Array (boş: NaN, sayı değil: -Infinity işaretiyle ayrılmaz; ayrı dizi)
  const invalid = new Map(); // kolon → Uint8Array (dolu ama sayı değil)
  for (const column of numericCols) {
    const array = new Float64Array(data.length);
    const bad = new Uint8Array(data.length);
    const memo = new Map(); // aynı yazım bir kez okunur (tutarlar çoğu tabloda tekrar eder)
    data.forEach((row, index) => {
      const value = row[column];
      if (value === undefined || value === null || value === "") {
        array[index] = Number.NaN;
        return;
      }
      let number = memo.get(value);
      if (number === undefined) {
        number = empty(value) ? Number.NaN : numberOf(value);
        if (memo.size < 20_000) memo.set(value, Number.isFinite(number) || empty(value) ? number : -Infinity);
      }
      if (number === -Infinity) {
        array[index] = Number.NaN;
        bad[index] = 1;
      } else {
        array[index] = number;
        if (!Number.isFinite(number) && !empty(value)) bad[index] = 1;
      }
    });
    values.set(column, array);
    invalid.set(column, bad);
  }
  const sampleOf = column => data.find(row => Number.isFinite(numberOf(row[column])))?.[column] ?? "";
  const money = (column, value) => formatValue(value, sampleOf(column));
  const fx = data.map(formulaOf);
  const byFormula = (index, column) => {
    const entry = fx[index]?.[column];
    return Boolean(entry) && entry.s !== "manual";
  };

  // ---------- Hesap ilişkileri ----------
  const groups = new Map();
  for (const column of numericCols) {
    const stem = stemOf(column);
    if (!stem) continue;
    if (!groups.has(stem.stem)) groups.set(stem.stem, []);
    groups.get(stem.stem).push({ column, index: stem.index });
  }
  const partSets = [];
  for (const list of groups.values()) if (list.length >= 2) partSets.push(list.sort((a, b) => a.index - b.index).map(item => item.column));
  const discovery = Math.min(data.length, DISCOVERY_ROWS);
  const sumParts = (parts, index) => {
    let sum = 0;
    for (const part of parts) {
      if (invalid.get(part)[index]) return Number.NaN;
      const value = values.get(part)[index];
      if (Number.isFinite(value)) sum += value;
    }
    return sum;
  };
  const evaluate = (target, base, parts, limit) => {
    const T = values.get(target);
    const A = base ? values.get(base) : null;
    let n = 0;
    let holds = 0;
    let moving = 0;
    for (let index = 0; index < limit; index += 1) {
      const t = T[index];
      if (!Number.isFinite(t)) continue;
      const a = A ? A[index] : 0;
      if (A && !Number.isFinite(a)) continue;
      const parts$ = sumParts(parts, index);
      if (!Number.isFinite(parts$)) continue;
      n += 1;
      if (Math.abs(parts$) > 0.0001) moving += 1;
      const predicted = A ? a - parts$ : parts$;
      if (Math.abs(t - predicted) <= tolerance(A ? a : t)) holds += 1;
    }
    return { n, holds, moving, support: n ? holds / n : 0 };
  };
  const candidates = [];
  for (const target of numericCols) {
    const T = values.get(target);
    let filled = 0;
    for (let index = 0; index < discovery; index += 1) if (Number.isFinite(T[index])) filled += 1;
    if (filled < 5) continue;
    for (const base of numericCols) {
      if (base === target) continue;
      const partOptions = [...numericCols.filter(column => column !== target && column !== base).map(column => [column]), ...partSets.filter(set => !set.includes(target) && !set.includes(base))];
      for (const parts of partOptions) {
        const score = evaluate(target, base, parts, discovery);
        if (score.n >= 5 && score.holds >= 5 && score.support >= 0.8 && score.moving >= Math.max(2, score.n * 0.3)) candidates.push({ target, base, parts, ...score, kind: "difference" });
      }
    }
    for (const parts of partSets) {
      if (parts.includes(target)) continue;
      const score = evaluate(target, null, parts, discovery);
      if (score.n >= 5 && score.holds >= 5 && score.support >= 0.8 && score.moving >= Math.max(2, score.n * 0.5)) candidates.push({ target, base: null, parts, ...score, kind: "sum" });
    }
  }
  // Her kolon için en iyi açıklayan ilişki (en yüksek destek; eşitlikte daha çok parçalı olan).
  const bestByTarget = new Map();
  for (const candidate of candidates) {
    const current = bestByTarget.get(candidate.target);
    if (!current || candidate.support > current.support + 1e-9 || (Math.abs(candidate.support - current.support) < 1e-9 && candidate.parts.length > current.parts.length)) bestByTarget.set(candidate.target, candidate);
  }
  const reported = new Set(); // satır başına tek ilişki bulgusu
  for (const relation of [...bestByTarget.values()].sort((a, b) => b.support - a.support)) {
    const text = relation.kind === "sum" ? `${relation.target} = ${relation.parts.join(" + ")}` : `${relation.target} = ${relation.base} − ${relation.parts.length > 1 ? `(${relation.parts.join(" + ")})` : relation.parts[0]}`;
    const full = evaluate(relation.target, relation.base, relation.parts, data.length);
    if (full.support < 0.8) continue;
    relations.push({ tab, kind: relation.kind, target: relation.target, base: relation.base, parts: relation.parts, support: Math.round(full.support * 1000) / 1000, rows: full.n, text });
    const T = values.get(relation.target);
    const A = relation.base ? values.get(relation.base) : null;
    for (let index = 0; index < data.length; index += 1) {
      const t = T[index];
      if (!Number.isFinite(t) || reported.has(index)) continue;
      const a = A ? A[index] : 0;
      if (A && !Number.isFinite(a)) continue;
      const parts = sumParts(relation.parts, index);
      if (!Number.isFinite(parts)) continue;
      const predicted = A ? a - parts : parts;
      if (Math.abs(t - predicted) <= tolerance(A ? a : t)) continue;
      reported.add(index);
      const row = data[index];
      const formula = byFormula(index, relation.target);
      add(
        row,
        "relation",
        "warn",
        `${relation.target} ${money(relation.target, t)} görünüyor; ${relation.kind === "sum" ? relation.parts.join(" + ") : `${relation.base} − ${relation.parts.length > 1 ? `(${relation.parts.join(" + ")})` : relation.parts[0]}`} = ${money(relation.target, predicted)} olmalı.`,
        `Bu sekmedeki kayıtların ${percentIn(full.support)} ${text} kuralı tutuyor (${full.holds}/${full.n} kayıt); bu kayıt kurala uymuyor. Değerlerden biri yanlış yazılmış ya da güncellenmemiş olabilir.`,
        [relation.target, ...(relation.base ? [relation.base] : []), ...relation.parts],
        formula ? {} : { suggest: { field: relation.target, value: money(relation.target, predicted) } },
      );
    }
  }
  const balanceColumn =
    relations.find(relation => relation.kind === "difference")?.target || numericCols.find(column => BALANCE_NAME.test(foldText(column))) || null;

  // ---------- Eksi değerler ----------
  for (const column of numericCols) {
    const V = values.get(column);
    let filled = 0;
    let negative = 0;
    for (const value of V) {
      if (!Number.isFinite(value)) continue;
      filled += 1;
      if (value < -0.0001) negative += 1;
    }
    if (filled < 8 || !negative || negative / filled > 0.05) continue;
    V.forEach((value, index) => {
      if (!(value < -0.0001)) return;
      const isBalance = column === balanceColumn;
      add(
        data[index],
        "negative",
        isBalance ? "warn" : "info",
        isBalance ? `${column} eksiye düşmüş (${money(column, value)}).` : `${column} eksi (${money(column, value)}).`,
        isBalance
          ? `Bu kolondaki diğer ${filled - negative} kayıtta değer sıfır ya da artı. Fazla tahsilat, yanlış girilmiş bir ödeme ya da işaret hatası olabilir.`
          : `Bu kolondaki diğer ${filled - negative} kayıtta değer eksi değil; yazım hatası olabilir.`,
        [column],
      );
    });
  }

  // ---------- Durum kolonları ----------
  // Az sayıda (≤12) farklı, rakamsız kısa değer taşıyan ve kayıtların çoğunda dolu kolonlar (Durum, Aşama, Tür…).
  const statusColumns = texts.filter(column => {
    const seen = new Set();
    let filled = 0;
    for (const row of data) {
      const raw = row[column];
      if (empty(raw)) continue;
      const text = String(raw).trim();
      if (text.length > 40 || /\d/.test(text)) return false;
      filled += 1;
      seen.add(foldText(text));
      if (seen.size > 12) return false;
    }
    return filled >= 5 && filled / data.length >= 0.6 && seen.size >= 2;
  });

  // ---------- Durum ile bakiye ----------
  if (balanceColumn) {
    const B = values.get(balanceColumn);
    for (const column of statusColumns) {
      const preview = new Set(data.slice(0, 600).map(row => String(row[column] ?? "").trim()).filter(Boolean));
      if (![...preview].some(value => CLOSED.test(foldText(value)) || OPEN.test(foldText(value)))) continue;
      const statuses = new Map();
      let filled = 0;
      for (let index = 0; index < data.length; index += 1) {
        const raw = data[index][column];
        if (empty(raw)) continue;
        const folded = foldText(String(raw)).replace(/\s+/g, " ").trim();
        if (folded.length > 40 || /\d/.test(folded)) continue;
        filled += 1;
        if (!statuses.has(folded)) statuses.set(folded, { raw: String(raw).trim(), rows: [] });
        statuses.get(folded).rows.push(index);
      }
      if (filled < 5 || statuses.size > 12) continue;
      const lexical = [...statuses.keys()].some(value => CLOSED.test(value) || OPEN.test(value));
      if (!lexical) continue;
      for (const [folded, status] of statuses) {
        let present = 0;
        let zero = 0;
        for (const index of status.rows) {
          if (!Number.isFinite(B[index])) continue;
          present += 1;
          if (Math.abs(B[index]) <= 0.011) zero += 1;
        }
        const learnedClosed = present >= 6 && zero / present >= 0.9;
        const learnedOpen = present >= 6 && zero / present <= 0.1;
        const closed = CLOSED.test(folded) || (learnedClosed && !OPEN.test(folded));
        const open = OPEN.test(folded) || (learnedOpen && !CLOSED.test(folded));
        if (!closed && !open) continue;
        for (const index of status.rows) {
          const balance = B[index];
          if (!Number.isFinite(balance)) continue;
          if (closed && balance > 0.011) {
            add(data[index], "status", "warn", `${column} “${status.raw}” ama ${balanceColumn} ${money(balanceColumn, balance)} görünüyor.`, `“${status.raw}” durumundaki kayıtta ${balanceColumn} 0 olmalı. Ya ödeme tam değil ya da ${balanceColumn} güncellenmemiş.`, [column, balanceColumn]);
          } else if (open && !closed && Math.abs(balance) <= 0.011) {
            add(data[index], "status", "info", `${column} “${status.raw}” ama ${balanceColumn} 0 görünüyor.`, `${balanceColumn} 0 ise kayıt kapanmış olabilir; durumu güncellemek isteyebilirsiniz.`, [column, balanceColumn]);
          }
        }
      }
    }
  }

  // ---------- Tarihler ----------
  const dateValues = new Map();
  for (const column of dates) {
    const memo = new Map();
    dateValues.set(
      column,
      data.map(row => {
        const value = row[column];
        if (value === undefined || value === null || value === "") return null;
        if (memo.has(value)) return memo.get(value);
        const date = empty(value) ? null : parseDate(String(value).trim());
        if (memo.size < 20_000) memo.set(value, date);
        return date;
      }),
    );
  }
  // Yıl yazım hatası (2062, 1926): önce bulunur; aynı kayıttaki tarih sırası uyarısı bunun sonucudur, tekrarlanmaz.
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const typos = new Set(); // "satır|kolon"
  for (const column of dates) {
    const list = dateValues.get(column);
    const years = list.filter(Boolean).map(date => date.getUTCFullYear()).sort((a, b) => a - b);
    if (years.length < 10) continue;
    const median = years[Math.floor(years.length / 2)];
    const spread = years[Math.floor(years.length * 0.75)] - years[Math.floor(years.length * 0.25)];
    const far = year => Math.abs(year - median) >= Math.max(20, spread * 4);
    if (spread > 12 || years.filter(far).length > years.length * 0.05) continue;
    list.forEach((date, index) => {
      if (!date || !far(date.getUTCFullYear())) return;
      typos.add(`${index}|${column}`);
      add(data[index], "year", "warn", `${column} ${dateText(date)} görünüyor.`, `Bu kolondaki tarihler çoğunlukla ${years[Math.floor(years.length * 0.05)]}–${years[Math.floor(years.length * 0.95)]} arasında; yıl yanlış yazılmış olabilir.`, [column]);
    });
  }
  // Sıra: kayıtların neredeyse hepsinde A, B'den önceyse tersi işaretlenir.
  for (const first of dates) {
    for (const second of dates) {
      if (first === second) continue;
      const A = dateValues.get(first);
      const B = dateValues.get(second);
      let before = 0;
      let after = 0;
      let same = 0;
      for (let index = 0; index < data.length; index += 1) {
        if (!A[index] || !B[index]) continue;
        const diff = A[index] - B[index];
        if (diff < 0) before += 1;
        else if (diff > 0) after += 1;
        else same += 1;
      }
      const decided = before + after;
      if (decided < 8 || !after || same > decided || before / decided < 0.9) continue;
      for (let index = 0; index < data.length; index += 1) {
        if (!A[index] || !B[index] || A[index] <= B[index]) continue;
        if (typos.has(`${index}|${first}`) || typos.has(`${index}|${second}`)) continue;
        add(
          data[index],
          "order",
          "warn",
          `Tarih sırası ters: ${first} ${dateText(A[index])}, ${second} ise ${dateText(B[index])}.`,
          `Bu sekmedeki kayıtların ${percentIn(before / decided)} ${first} daha önce (${before}/${decided} kayıt). Tarihlerden biri yanlış yazılmış olabilir.`,
          [first, second],
        );
      }
    }
  }
  // Hep geçmiş tarih taşıyan kolonda ileri tarih.
  for (const column of dates) {
    const list = dateValues.get(column);
    const filled = list.filter(Boolean).length;
    if (filled < 10) continue;
    const pastShare = list.filter(date => date && date.getTime() <= today).length / filled;
    if (pastShare < 0.97) continue;
    list.forEach((date, index) => {
      if (!date || date.getTime() <= today + 30 * DAY || typos.has(`${index}|${column}`)) return;
      add(data[index], "future", "info", `${column} ileri bir tarih: ${dateText(date)}.`, `Bu kolondaki tarihlerin ${percentOf(pastShare)} geçmişte; ileri tarih yazım hatası olabilir.`, [column]);
    });
  }

  // ---------- Sayısal sıra (ör. satış fiyatı hep alıştan yüksek) ----------
  // Yalnızca aynı türden (ikisi de para) ve benzer ölçekteki kolonlar karşılaştırılır; kilometre ile model yılı gibi
  // ölçeği farklı kolonlar karşılaştırılmaz. Hesap ilişkisiyle zaten denetlenen çiftler atlanır.
  const MONEY_NAME = /\b(fiyat|fiyati|tutar|tutari|bedel|bedeli|ucret|ucreti|borc|kalan|bakiye|taksit|odeme|odenen|maliyet|alis|satis|prim|maas|alacak|kira|kapora|avans|toplam|net|brut)\b/;
  const moneyLike = column => {
    if (MONEY_NAME.test(foldText(column))) return true;
    let marked = 0;
    let filled = 0;
    for (const row of data.length > 400 ? data.slice(0, 400) : data) {
      const value = row[column];
      if (empty(value)) continue;
      filled += 1;
      if (/[₺$€£]|\b(tl|try|usd|eur)\b/i.test(String(value))) marked += 1;
    }
    return filled > 0 && marked / filled >= 0.5;
  };
  const medianOf = column => {
    const list = [...values.get(column)].filter(Number.isFinite).sort((a, b) => a - b);
    return list.length ? list[Math.floor(list.length / 2)] : Number.NaN;
  };
  const moneyCols = numericCols.filter(moneyLike);
  const related = new Set(relations.flatMap(relation => [relation.target, relation.base, ...relation.parts].filter(Boolean)));
  for (const low of moneyCols) {
    for (const high of moneyCols) {
      if (low === high || (related.has(low) && related.has(high))) continue;
      const ratio = medianOf(high) / medianOf(low);
      if (!(ratio > 0) || ratio > 20 || ratio < 1) continue;
      const L = values.get(low);
      const H = values.get(high);
      let below = 0;
      let above = 0;
      for (let index = 0; index < data.length; index += 1) {
        if (!Number.isFinite(L[index]) || !Number.isFinite(H[index])) continue;
        if (L[index] < H[index] - 0.011) below += 1;
        else if (L[index] > H[index] + 0.011) above += 1;
      }
      const decided = below + above;
      if (decided < 8 || !above || below / decided < 0.95) continue;
      for (let index = 0; index < data.length; index += 1) {
        if (!(L[index] > H[index] + 0.011)) continue;
        add(
          data[index],
          "compare",
          "info",
          `${high} ${money(high, H[index])}, ${low} ${money(low, L[index])}: bu kayıtta ${high} daha düşük.`,
          `Bu sekmedeki kayıtların ${percentIn(below / decided)} ${high} daha yüksek (${below}/${decided} kayıt). Değerlerden biri yanlış yazılmış olabilir; bilerek böyleyse yoksayabilirsiniz.`,
          [high, low],
        );
      }
    }
  }

  // ---------- Duruma göre boş kalmaması gereken alan ----------
  // Ör. "Kargoda" durumundaki siparişlerin hepsinde takip no varsa, takip no'su boş "Kargoda" kaydı işaretlenir. Alan o
  // duruma özgü olmalı (diğer durumlarda çoğunlukla boş); her yerde dolu olan alanın eksiği veri sağlığının konusudur.
  for (const column of statusColumns) {
    const groups = new Map();
    data.forEach((row, index) => {
      const raw = row[column];
      if (empty(raw)) return;
      const key = foldText(String(raw)).replace(/\s+/g, " ").trim();
      if (!groups.has(key)) groups.set(key, { raw: String(raw).trim(), rows: [] });
      groups.get(key).rows.push(index);
    });
    for (const other of columns) {
      if (other === column || statusColumns.includes(other)) continue;
      const filledAt = index => !empty(data[index][other]);
      let totalFilled = 0;
      for (let index = 0; index < data.length; index += 1) if (filledAt(index)) totalFilled += 1;
      for (const [, group] of groups) {
        if (group.rows.length < 5) continue;
        const inside = group.rows.filter(filledAt).length;
        const outsideCount = data.length - group.rows.length;
        const outside = totalFilled - inside;
        if (inside / group.rows.length < 0.9 || inside === group.rows.length || outsideCount < 3 || outside / outsideCount > 0.6) continue;
        for (const index of group.rows) {
          if (filledAt(index)) continue;
          add(data[index], "required", "info", `${column} “${group.raw}” ama ${other} boş.`, `“${group.raw}” durumundaki kayıtların ${percentIn(inside / group.rows.length)} ${other} dolu (${inside}/${group.rows.length} kayıt); diğer durumlarda çoğunlukla boş. Bu kayıtta eksik kalmış olabilir.`, [column, other]);
        }
      }
    }
  }

  // ---------- Olağan dışı değerler (fazladan ya da eksik sıfır) ----------
  // Değer kolonun geri kalanından çok uzakta ve yalnız olmalı (hemen altında/üstünde yakın bir değer yok). 10, 100 ya da
  // 1000'e bölününce (çarpılınca) olağan aralığa oturuyorsa "fazladan/eksik sıfır" uyarısı; oturmuyorsa yalnızca dikkat.
  const outlierRows = new Map(); // kolon → uç değerli satırlar
  const derivedFrom = new Map(relations.filter(relation => relation.base).map(relation => [relation.target, relation.base]));
  const ordered = [...numericCols].sort((a, b) => (derivedFrom.has(a) ? 1 : 0) - (derivedFrom.has(b) ? 1 : 0));
  for (const column of ordered) {
    const V = values.get(column);
    const positives = [...V].filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
    if (positives.length < 12) continue;
    const median = positives[Math.floor(positives.length / 2)];
    const p10 = positives[Math.floor(positives.length * 0.1)];
    const p90 = positives[Math.floor(positives.length * 0.9) - 1];
    if (!(median > 0)) continue;
    const inRange = value => value >= p10 && value <= p90;
    const flagged = new Set();
    outlierRows.set(column, flagged);
    V.forEach((value, index) => {
      if (!(value > 0)) return;
      const high = value >= 8 * median && value >= 5 * p90;
      // Eksik sıfır yalnızca değerleri belli bir aralıkta toplanan kolonda aranır (sıfıra yayılan kolonda küçük değer olağandır).
      const low = positives.length >= 20 && p10 >= median / 3 && value <= median / 8 && value <= p10 / 5;
      if (!high && !low) return;
      // Yalnızlık: en yakın komşusu (sıralı listede) en az 5 kat uzakta.
      const at = positives.indexOf(value);
      const neighbour = high ? positives[at - 1] : positives[at + 1];
      if (neighbour !== undefined && (high ? value / neighbour : neighbour / value) < 5) return;
      flagged.add(index);
      if (outlierRows.get(derivedFrom.get(column))?.has(index)) return; // tabanı zaten işaretlendi
      const zeroFix = [10, 100, 1000].find(factor => inRange(high ? value / factor : value * factor));
      const range = `Bu kolondaki değerlerin çoğu ${money(column, p10)} ile ${money(column, p90)} arasında.`;
      add(
        data[index],
        "outlier",
        zeroFix ? "warn" : "info",
        `${column} ${money(column, value)} — bu kolondaki diğer değerlerin çok ${high ? "üstünde" : "altında"}.`,
        zeroFix
          ? `${range} ${high ? "Fazladan" : "Eksik"} ${zeroFix === 10 ? "bir" : zeroFix === 100 ? "iki" : "üç"} sıfır yazılmış olabilir (doğrusu ${money(column, high ? value / zeroFix : value * zeroFix)} olabilir).`
          : `${range} Değer doğruysa yoksayabilirsiniz.`,
        [column],
        zeroFix ? { suggest: { field: column, value: money(column, high ? value / zeroFix : value * zeroFix) } } : {},
      );
    });
  }
  return { findings, relations };
}

/**
 * Tüm veri: her sekme kendi kolonlarıyla.
 * @returns {{ version: number, relations: object[], findings: object[], rules: Array<{rule,title,count,warn}>, count: number }}
 */
export function reasonAbout(rows, { tabs = [], now = new Date(), titleOf } = {}) {
  const byTab = new Map();
  for (const title of tabs) byTab.set(title, []);
  for (const row of rows) {
    const key = String(row.__sheet || "");
    if (!byTab.has(key)) byTab.set(key, []);
    byTab.get(key).push(row);
  }
  const findings = [];
  const relations = [];
  for (const [tab, list] of byTab) {
    if (!list.length) continue;
    const columns = [];
    const seen = new Set();
    for (const row of list) {
      for (const key of Object.keys(row)) {
        if (key.startsWith("__") || !key.trim() || seen.has(key)) continue;
        seen.add(key);
        columns.push(key);
      }
    }
    const result = reasonTab(list, columns, { now, titleOf, tab });
    findings.push(...result.findings);
    relations.push(...result.relations);
    if (findings.length >= MAX_FINDINGS) break;
  }
  const counts = new Map();
  for (const finding of findings) {
    const entry = counts.get(finding.rule) || { rule: finding.rule, title: ruleTitle(finding.rule), count: 0, warn: 0 };
    entry.count += 1;
    if (finding.severity === "warn") entry.warn += 1;
    counts.set(finding.rule, entry);
  }
  const order = ["relation", "status", "negative", "order", "year", "outlier", "compare", "required", "future"];
  findings.sort((a, b) => (a.severity === b.severity ? order.indexOf(a.rule) - order.indexOf(b.rule) : a.severity === "warn" ? -1 : 1));
  return { version: REASONING_VERSION, relations, findings: findings.slice(0, MAX_FINDINGS), rules: [...counts.values()].sort((a, b) => order.indexOf(a.rule) - order.indexOf(b.rule)), count: findings.length };
}
