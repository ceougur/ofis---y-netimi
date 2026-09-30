// Veri sağlığı raporu: yalnızca doğrulanabilen olguları söyler. "Kötü veri" yorumu yapmaz; hangi kayıtta neyin eksik
// ya da geçersiz olduğunu, tıklanıp açılabilecek kayıt listesiyle gösterir.
//
// Puan tanımı (raporda da yazar): kontrol edilen hücrelerin sorunsuz olanlarının oranı. Kontroller: kimlik ve taraf
// kolonlarının doluluğu, kimliğin aynı sekmede tekrar etmemesi, doğrulanabilen/biçimli kolonlarda değerin geçerliliği.
// v1.7.0: her sekme kendi kolonlarıyla ayrı değerlendirilir; hücreler tek tek okunur (cells.mjs). Not olarak yazılmış
// hücreler ("ertelendi", "yok") tarih/tutar/telefon hatası sayılmaz; iki telefonlu ya da telefonun yanında not olan
// hücre geçerlidir; "10000000146 (eşi)" gibi yazılmış T.C. numarasının sağlaması yapılır.
import { embeddedDates, isEmptyCell, phonesIn, readCell } from "./cells.mjs";
import { cell } from "./columns.mjs";
import { isIban, isTckn, isVkn } from "./validators.mjs";

const LIST_LIMIT = 50;
// "Yok say" (v2.0.11) için bulgudaki kayıtların tamamı sunucuda tutulur (istemciye gitmez); çok büyük tablolarda sınır.
const KEY_LIMIT = 200_000;
// Kimlik kolonu kayıtların yarısından fazlasında boşsa (ör. personel rehberinde "Öğrenci No") tablonun kimliği değildir:
// boşluk uyarı değil bilgi olarak yazılır ve puanı düşürmez (v2.0.11).
const SPARSE_ID = 0.5;

export function recordTitle(row, primary) {
  // Ad ve soyad ayrı kolonlardaysa (v2.0.11) ikisi birleşir: "Ahmet" + "Yılmaz" → "Ahmet Yılmaz".
  const parts = primary.personParts ? primary.personParts.map(column => String(cell(row, column) ?? "").trim()).filter(Boolean).join(" ") : "";
  const person = parts || (primary.person ? String(cell(row, primary.person) ?? "").trim() : "");
  const id = primary.id ? String(cell(row, primary.id) ?? "").trim() : "";
  return person || id || String(row.__hofKey || "");
}

// failed: bulgunun puandan düştüğü hücre denetimi sayısı (Yok say'da puana geri eklenir); keys: bulgudaki tüm kayıtlar;
// template: sayısı yeniden yazılabilen başlık ("\u0001" sayının yeri).
function collector(id, severity, title, detail, column) {
  const items = [];
  const keys = [];
  let count = 0;
  let failed = 0;
  return {
    add(row, primary, fails = 1) {
      count += 1;
      failed += fails;
      const key = String(row.__hofKey || "");
      if (keys.length < KEY_LIMIT) keys.push(key);
      if (items.length < LIST_LIMIT) items.push({ key, title: recordTitle(row, primary), tab: String(row.__sheet || "") });
    },
    count: () => count,
    done: () => (count ? { id, severity, title: title(count), template: title("\u0001"), detail, column, count, failed, keys, items, more: Math.max(0, count - items.length) } : null),
  };
}

// Hücre denetimleri: "ok" geçerli, "bad" geçersiz, "skip" denetim dışı (not ya da açıklama).
const checksum = (pattern, test) => text => {
  if (test(text)) return "ok";
  if (!/\d/.test(text)) return "skip";
  const found = String(text).match(pattern);
  return found && found.length === 1 ? (test(found[0].replace(/\s+/g, "")) ? "ok" : "bad") : "bad";
};
const CHECKS = {
  tckn: checksum(/(?<!\d)\d{11}(?!\d)/g, isTckn),
  vkn: checksum(/(?<!\d)\d{10}(?!\d)/g, isVkn),
  iban: checksum(/TR\s?\d{2}(?:\s?[\dA-Z]{4}){5}\s?\d{2}/gi, isIban),
  phone: text => {
    const { valid, invalid } = phonesIn(text);
    if (valid && !invalid) return "ok";
    if (!valid && !invalid && !/\d/.test(text)) return "skip";
    return "bad";
  },
  date: text => {
    const reading = readCell(text);
    if (reading.kind === "date") return "ok";
    if (reading.kind === "label" || reading.kind === "text") return "skip";
    if (reading.kind === "mixed" && embeddedDates(text).length) return "skip"; // tarih + not: hata değil
    return "bad";
  },
  money: text => {
    const reading = readCell(text);
    if (reading.kind === "amount" && !reading.identifier) return "ok";
    if (reading.kind === "label" || reading.kind === "text") return "skip";
    return "bad";
  },
};
const TITLES = {
  tckn: n => `geçersiz T.C. kimlik no: ${n} kayıt`,
  iban: n => `geçersiz IBAN: ${n} kayıt`,
  vkn: n => `geçersiz vergi no: ${n} kayıt`,
  phone: n => `geçersiz telefon numarası: ${n} kayıt`,
  date: n => `tarih olarak okunamayan değer: ${n} kayıt`,
  money: n => `tutar olarak okunamayan değer: ${n} kayıt`,
};
const DETAILS = {
  verified: "Sağlama (kontrol hanesi) tutmuyor; yanlış yazılmış olabilir.",
  phone: "Numara eksik ya da fazla haneli. Birden çok numara veya numaranın yanında not olan hücreler geçerli sayılır.",
  date: "Takvimde olmayan (ör. 31.02.2026) ya da tarih biçiminde olmayan değerler. Tarih yerine not yazılmış hücreler (ör. “ertelendi”) sorun sayılmaz.",
  money: "Tutarın yanında başka bilgi olan ya da tutar biçiminde olmayan değerler (ör. “1.500 TL + faiz”). Tutar yerine not yazılmış hücreler sorun sayılmaz.",
};
// En az üç farklı kimlik tekrar ediyor ve tekrar eden satırlar kimlikli satırların %30'u ya da fazlasıysa tablo bir
// kaydı birden çok satırda tutuyordur (ör. taraflar satır satır): bu bir yapı, hata değil.
const STRUCTURAL_REPEAT = 0.3;
const STRUCTURAL_MIN_IDS = 3;

// Biçimi denetlenebilen kolonlar (telefon, tarih, T.C., IBAN…): yeterince dolu ve çoğunlukla geçerli.
export const typedColumnsOf = analyses => analyses.filter(item => CHECKS[item.role] && item.stats.nonEmpty >= 3 && (item.validRate ?? 1) >= 0.8);

/**
 * Bozuk satır nedeni (v2.0.2, içeri almada işaretleme için): "shifted" — en az iki biçimli kolonda uyumsuz değer var ve
 * bir kolon kaydırınca en az ikisi yerine oturuyor; "invalid" — en az iki biçimli hücre dolu ve ≥ %60'ı geçersiz;
 * null — sağlam.
 */
export function brokenRowReason(row, analyses, typedColumns = typedColumnsOf(analyses)) {
  if (typedColumns.length < 2) return null;
  const typedIndex = new Set(typedColumns.map(item => item.column));
  let filled = 0;
  const bad = [];
  for (const item of typedColumns) {
    const value = String(row[item.column] ?? "").trim();
    if (!value) continue;
    filled += 1;
    if (CHECKS[item.role](value) === "bad") bad.push({ item, value });
  }
  if (bad.length < 2) return null;
  let fits = 0;
  for (const { item, value } of bad) {
    const at = analyses.indexOf(item);
    for (const neighbor of [analyses[at - 1], analyses[at + 1]]) {
      if (neighbor && typedIndex.has(neighbor.column) && CHECKS[neighbor.role](value) === "ok") {
        fits += 1;
        break;
      }
    }
  }
  if (fits >= 2) return "shifted";
  return bad.length / filled >= 0.6 ? "invalid" : null;
}

/** Tek hücre denetimi: "ok" | "bad" | "skip" | null (rolün denetimi yok). Ön izleme ekranındaki sarı hücreler için. */
export const cellCheck = (role, value) => (CHECKS[role] ? CHECKS[role](String(value ?? "").trim()) : null);

export function assessQuality(rows, analyses, primary) {
  const checks = { total: 0, passed: 0 };
  const count = ok => {
    checks.total += 1;
    if (ok) checks.passed += 1;
  };
  const collectors = [];
  const make = (...args) => {
    const item = collector(...args);
    collectors.push(item);
    return item;
  };

  const idColumn = primary.id;
  const personColumn = primary.person;
  const idEmpty = idColumn ? rows.filter(row => Object.hasOwn(row, idColumn) && isEmptyCell(row[idColumn])).length : 0;
  const sparseId = Boolean(idColumn) && rows.length >= 10 && idEmpty / rows.length > SPARSE_ID;
  const emptyId = idColumn
    ? sparseId
      ? make("empty-id", "info", n => `"${idColumn}" ${n} kayıtta boş`, "Bu kolon kayıtların çoğunda boş olduğu için tablonun kimlik kolonu sayılmadı ve puanı düşürmez. Kayıtlar ad ve diğer bilgilerle bulunur.", idColumn)
      : make("empty-id", "warn", n => `"${idColumn}" boş olan ${n} kayıt`, "Kimliği boş kayıtlar aramada ve eşleştirmede zor bulunur.", idColumn)
    : null;
  const emptyPerson = personColumn ? make("empty-person", "info", n => `"${personColumn}" boş olan ${n} kayıt`, "Kişi/kurum adı olmayan kayıtlar.", personColumn) : null;

  // Doğrulanabilen/biçimli kolonlar: dolu değerlerin geçerliliği.
  const formatted = analyses
    .filter(item => CHECKS[item.role] && item.stats.nonEmpty > 0)
    .map(item => ({
      item,
      test: CHECKS[item.role],
      bad: make(`invalid-${item.role}:${item.column}`, item.verified ? "warn" : "info", n => `"${item.column}" kolonunda ${TITLES[item.role](n)}`, item.verified ? DETAILS.verified : DETAILS[item.role] || "Kolonun geri kalanıyla aynı biçimde değil.", item.column),
    }));
  // Başlığı T.C./IBAN/VKN diyen ama değerleri sağlamayı tutmayan kolon: kolon düzeyinde tek bir bilgi.
  const unverified = [];
  for (const item of analyses) {
    if (item.warning === "scientific") {
      unverified.push({ id: `scientific:${item.column}`, severity: "warn", title: `"${item.column}" kolonundaki numaralar Excel'de sayıya dönüşmüş (5.32E+09)`, detail: "Excel bu hücreleri sayı sayıp bilimsel gösterime çevirmiş; rakamların bir kısmı dosyada yok. Excel'de kolonu Metin biçimine çevirip numaraları yeniden yazın ya da başına kesme işareti (') koyun, sonra dosyayı yeniden yükleyin.", column: item.column, count: 0, items: [], more: 0 });
      continue;
    }
    for (const [role, name] of [["tckn", "T.C. kimlik no"], ["iban", "IBAN"], ["vkn", "vergi no"]]) {
      if (item.header.includes(role) && item.role !== role && item.stats.nonEmpty >= 3) {
        unverified.push({ id: `unverified-${role}:${item.column}`, severity: "info", title: `"${item.column}" kolonundaki değerler geçerli ${name} değil`, detail: "Başlık bu türü söylüyor ama değerlerin çoğu sağlamayı tutmuyor (deneme verisi ya da farklı bir numara olabilir). Göstergelerde kullanılmadı.", column: item.column, count: item.stats.nonEmpty, items: [], more: 0 });
      }
    }
  }

  // Kaymış satır (v2.0.2): bir hücre eksik ya da fazla girilince değerler yan kolona kayar — telefon tarih kolonunda,
  // tarih tutar kolonunda görünür. En az iki biçimli kolonda uyumsuz değer varsa ve bir kolon kaydırınca en az ikisi
  // yerine oturuyorsa satır "kaymış" sayılır; nokta atışı öneriyle listelenir.
  const typedColumns = typedColumnsOf(analyses);
  const shifted = typedColumns.length >= 2 ? make("shifted-rows", "warn", n => `${n} kayıtta hücreler yan kolona kaymış görünüyor`, "Bir hücre eksik ya da fazla girilince değerler yan kolona kayar (telefon tarih kolonunda, tarih tutar kolonunda). Excel'de o satırı düzeltip yeniden yükleyin ya da detay kartında değerleri doğru alana taşıyın.", typedColumns[0].column) : null;
  const shiftedRow = row => brokenRowReason(row, analyses, typedColumns) === "shifted";

  const ids = new Map(); // sekme + kimlik → satırlar (farklı sekmelerde aynı kimlik sorun değildir)
  let idFilled = 0;
  for (const row of rows) {
    if (shifted && shiftedRow(row)) shifted.add(row, primary, 0);
    if (idColumn && Object.hasOwn(row, idColumn)) {
      const value = String(row[idColumn] ?? "").trim();
      if (isEmptyCell(value)) {
        if (sparseId) emptyId.add(row, primary, 0);
        else {
          count(false);
          emptyId.add(row, primary);
        }
      } else {
        idFilled += 1;
        const key = `${row.__sheet || ""}\u0000${value}`;
        if (!ids.has(key)) ids.set(key, []);
        ids.get(key).push(row);
      }
    }
    if (personColumn && Object.hasOwn(row, personColumn)) {
      const blank = isEmptyCell(row[personColumn]);
      count(!blank);
      if (blank) emptyPerson.add(row, primary);
    }
    for (const check of formatted) {
      const value = cell(row, check.item.column);
      if (isEmptyCell(value)) continue;
      const verdict = check.test(String(value).trim());
      if (verdict === "skip") continue;
      count(verdict === "ok");
      if (verdict === "bad") check.bad.add(row, primary);
    }
  }

  const issues = [];
  if (idColumn && idFilled) {
    const repeated = [...ids.values()].filter(list => list.length > 1);
    const repeatedRows = repeated.reduce((sum, list) => sum + list.length, 0);
    if (repeated.length >= STRUCTURAL_MIN_IDS && repeatedRows >= idFilled * STRUCTURAL_REPEAT) {
      // Yapı: kimlik denetimleri puanı etkilemez, bilgi olarak yazılır.
      for (let index = 0; index < idFilled; index += 1) count(true);
      issues.push({ id: "repeated-id", severity: "info", title: `"${idColumn}" birçok satırda tekrar ediyor (${repeatedRows} satır)`, detail: "Tablo bir kaydı birden çok satırda tutuyor olabilir (ör. taraflar ya da işlemler alt alta). Bu bir yapı olarak değerlendirildi, hata sayılmadı.", column: idColumn, count: repeatedRows, items: [], more: 0 });
    } else {
      const duplicate = collector("duplicate-id", "warn", n => `Aynı sekmede tekrar eden "${idColumn}": ${n} kayıt`, "Aynı kimlik aynı sekmede birden çok satırda geçiyor. Farklı sekmelerde geçmesi sorun sayılmaz.", idColumn);
      for (const list of ids.values()) {
        count(true);
        for (let index = 1; index < list.length; index += 1) count(false);
        if (list.length > 1) list.forEach((row, index) => duplicate.add(row, primary, index ? 1 : 0));
      }
      const done = duplicate.done();
      if (done) issues.push(done);
    }
  }
  issues.push(...collectors.map(item => item.done()).filter(Boolean), ...unverified);
  // Karışık para birimi: toplam gösterilmez, bilgi olarak yazılır.
  for (const item of analyses) {
    if (item.role === "money" && item.currency === "mixed") {
      issues.push({ id: `mixed-currency:${item.column}`, severity: "info", title: `"${item.column}" kolonunda birden çok para birimi var`, detail: "Farklı para birimleri toplanamayacağı için bu kolonun toplamı gösterilmez.", column: item.column, count: 0, items: [], more: 0 });
    }
  }
  return finishQuality(checks, rows.length, issues);
}

const ORDER = { warn: 0, info: 1 };
function finishQuality(checks, rowCount, issues) {
  issues.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || b.count - a.count);
  const score = checks.total ? Math.round((checks.passed / checks.total) * 100) : 100;
  return { score, level: score >= 95 ? "iyi" : score >= 80 ? "orta" : "zayif", checked: checks.total, passed: checks.passed, rows: rowCount, issues };
}

// Sekmelerin raporlarını tek rapora birleştirir: bulgular sekme adıyla, puan tüm kontrollerin toplamından.
export function mergeQuality(parts) {
  if (parts.length === 1) return parts[0].quality;
  const checks = { total: 0, passed: 0 };
  let rowCount = 0;
  const issues = [];
  for (const { tab, quality } of parts) {
    checks.total += quality.checked;
    checks.passed += quality.passed;
    rowCount += quality.rows;
    for (const issue of quality.issues) issues.push({ ...issue, tab, title: tab ? `${tab} · ${issue.title}` : issue.title, template: issue.template && tab ? `${tab} · ${issue.template}` : issue.template });
  }
  return finishQuality(checks, rowCount, issues);
}
