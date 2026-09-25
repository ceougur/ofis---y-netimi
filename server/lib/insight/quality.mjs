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

export function recordTitle(row, primary) {
  const person = primary.person ? String(cell(row, primary.person) ?? "").trim() : "";
  const id = primary.id ? String(cell(row, primary.id) ?? "").trim() : "";
  return person || id || String(row.__hofKey || "");
}

function collector(id, severity, title, detail, column) {
  const items = [];
  let count = 0;
  return {
    add(row, primary) {
      count += 1;
      if (items.length < LIST_LIMIT) items.push({ key: String(row.__hofKey || ""), title: recordTitle(row, primary), tab: String(row.__sheet || "") });
    },
    count: () => count,
    done: () => (count ? { id, severity, title: title(count), detail, column, count, items, more: Math.max(0, count - items.length) } : null),
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
  const emptyId = idColumn ? make("empty-id", "warn", n => `"${idColumn}" boş olan ${n} kayıt`, "Kimliği boş kayıtlar aramada ve eşleştirmede zor bulunur.", idColumn) : null;
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
    for (const [role, name] of [["tckn", "T.C. kimlik no"], ["iban", "IBAN"], ["vkn", "vergi no"]]) {
      if (item.header.includes(role) && item.role !== role && item.stats.nonEmpty >= 3) {
        unverified.push({ id: `unverified-${role}:${item.column}`, severity: "info", title: `"${item.column}" kolonundaki değerler geçerli ${name} değil`, detail: "Başlık bu türü söylüyor ama değerlerin çoğu sağlamayı tutmuyor (deneme verisi ya da farklı bir numara olabilir). Göstergelerde kullanılmadı.", column: item.column, count: item.stats.nonEmpty, items: [], more: 0 });
      }
    }
  }

  const ids = new Map(); // sekme + kimlik → satırlar (farklı sekmelerde aynı kimlik sorun değildir)
  let idFilled = 0;
  for (const row of rows) {
    if (idColumn && Object.hasOwn(row, idColumn)) {
      const value = String(row[idColumn] ?? "").trim();
      if (isEmptyCell(value)) {
        count(false);
        emptyId.add(row, primary);
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
        if (list.length > 1) for (const row of list) duplicate.add(row, primary);
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
    for (const issue of quality.issues) issues.push({ ...issue, tab, title: tab ? `${tab} · ${issue.title}` : issue.title });
  }
  return finishQuality(checks, rowCount, issues);
}
