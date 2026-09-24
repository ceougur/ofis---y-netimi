// Veri sağlığı raporu: yalnızca doğrulanabilen olguları söyler. "Kötü veri" yorumu yapmaz; hangi kayıtta neyin eksik
// ya da geçersiz olduğunu, tıklanıp açılabilecek kayıt listesiyle gösterir.
//
// Puan tanımı (raporda da yazar): kontrol edilen hücrelerin sorunsuz olanlarının oranı. Kontroller: kimlik ve taraf
// kolonlarının doluluğu, kimliğin aynı sekmede tekrar etmemesi, doğrulanabilen/biçimli kolonlarda değerin geçerliliği.
import { isBlank } from "./columns.mjs";
import { isIban, isTckn, isTrPhone, isVkn, parseAmount, parseDate } from "./validators.mjs";

const LIST_LIMIT = 50;

export function recordTitle(row, primary) {
  const person = primary.person ? String(row[primary.person] ?? "").trim() : "";
  const id = primary.id ? String(row[primary.id] ?? "").trim() : "";
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
    done: () => (count ? { id, severity, title: title(count), detail, column, count, items, more: Math.max(0, count - items.length) } : null),
  };
}

const VALIDATORS = { tckn: isTckn, iban: isIban, vkn: isVkn, phone: isTrPhone, date: value => Boolean(parseDate(value)), money: value => parseAmount(value) !== null };
const ROLE_NAMES = { tckn: "T.C. kimlik no", iban: "IBAN", vkn: "vergi no", phone: "telefon", date: "tarih", money: "tutar" };

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
  const duplicateId = idColumn ? make("duplicate-id", "warn", n => `Aynı sekmede tekrar eden "${idColumn}": ${n} kayıt`, "Aynı kimlik aynı sekmede birden çok satırda geçiyor. Farklı sekmelerde geçmesi sorun sayılmaz.", idColumn) : null;
  const emptyPerson = personColumn ? make("empty-person", "info", n => `"${personColumn}" boş olan ${n} kayıt`, "Kişi/kurum adı olmayan kayıtlar.", personColumn) : null;

  // Doğrulanabilen/biçimli kolonlar: dolu değerlerin geçerliliği.
  const formatted = analyses
    .filter(item => VALIDATORS[item.role] && item.stats.nonEmpty > 0)
    .map(item => ({
      item,
      test: VALIDATORS[item.role],
      bad: make(`invalid-${item.role}:${item.column}`, item.verified ? "warn" : "info", n => `"${item.column}" kolonunda geçersiz ${ROLE_NAMES[item.role]}: ${n} kayıt`, item.verified ? "Sağlama (kontrol hanesi) tutmuyor; yanlış yazılmış olabilir." : "Kolonun geri kalanıyla aynı biçimde değil.", item.column),
    }));
  // Başlığı T.C./IBAN/VKN diyen ama değerleri sağlamayı tutmayan kolon: kolon düzeyinde tek bir bilgi.
  const unverified = [];
  for (const item of analyses) {
    for (const role of ["tckn", "iban", "vkn"]) {
      if (item.header.includes(role) && item.role !== role && item.stats.nonEmpty >= 3) {
        unverified.push({ id: `unverified-${role}:${item.column}`, severity: "info", title: `"${item.column}" kolonundaki değerler geçerli ${ROLE_NAMES[role]} değil`, detail: "Başlık bu türü söylüyor ama değerlerin çoğu sağlamayı tutmuyor (deneme verisi ya da farklı bir numara olabilir). Göstergelerde kullanılmadı.", column: item.column, count: item.stats.nonEmpty, items: [], more: 0 });
      }
    }
  }

  const seen = new Map();
  for (const row of rows) {
    if (idColumn && idColumn in row) {
      const value = String(row[idColumn] ?? "").trim();
      const blank = isBlank(value);
      count(!blank);
      if (blank) emptyId.add(row, primary);
      else {
        const key = `${row.__sheet || ""}\u0000${value}`;
        const first = seen.get(key);
        if (first === undefined) {
          seen.set(key, row);
          count(true);
        } else {
          if (first) {
            duplicateId.add(first, primary);
            seen.set(key, null);
          }
          duplicateId.add(row, primary);
          count(false);
        }
      }
    }
    if (personColumn && personColumn in row) {
      const blank = isBlank(row[personColumn]);
      count(!blank);
      if (blank) emptyPerson.add(row, primary);
    }
    for (const check of formatted) {
      const value = row[check.item.column];
      if (isBlank(value)) continue;
      const ok = check.test(String(value).trim());
      count(ok);
      if (!ok) check.bad.add(row, primary);
    }
  }

  const issues = [...collectors.map(item => item.done()).filter(Boolean), ...unverified];
  // Karışık para birimi: toplam gösterilmez, bilgi olarak yazılır.
  for (const item of analyses) {
    if (item.role === "money" && item.currency === "mixed") {
      issues.push({ id: `mixed-currency:${item.column}`, severity: "info", title: `"${item.column}" kolonunda birden çok para birimi var`, detail: "Farklı para birimleri toplanamayacağı için bu kolonun toplamı gösterilmez.", column: item.column, count: 0, items: [], more: 0 });
    }
  }
  const order = { warn: 0, info: 1 };
  issues.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
  const score = checks.total ? Math.round((checks.passed / checks.total) * 100) : 100;
  return {
    score,
    level: score >= 95 ? "iyi" : score >= 80 ? "orta" : "zayif",
    checked: checks.total,
    passed: checks.passed,
    rows: rows.length,
    issues,
  };
}
