// Toplu alım boru hattı (v2.0.6): Excel / Google Sheets / açık tablo → cari ve stok kartları.
//
//   1) Ingestion   : tarayıcı (hof-excel-worker.js) ya da sunucu (sheets.readSheetMatrices) hücre matrisini okur; bellekte
//                    tek geçiş, satır sınırı (MAX_IMPORT) ve gövde sınırı ile.
//   2) Sanitization: sanitizeCell — görünmez karakterler (sıfır genişlik, NBSP, denetim), Excel hata değerleri (#N/A, #REF!),
//                    fazla boşluk; tarih ve tutar hücreleri parseDay / parseAmount / parseQty ile tipe çevrilir.
//   3) Semantic map: başlık eşlemesi (mapAccountHeaders / mapStockHeaders) + başlık tanınmadıysa DEĞERE bakarak eşleme
//                    (inferRolesByValues: telefon, e-posta, tarih, tutar/miktar deseni).
//   4) Validation  : validateRows — satır bazlı kapı. "error" satırlar ana veriye girmez (ad boş, ürün adı boş);
//                    "warning" satırlar girer ama raporlanır (okunamayan tarih → bugün, okunamayan tutar → yok, dosya
//                    içinde çift). Kullanıcı eşlemeyi değiştirdikçe kapı yeniden hesaplanır (POST …/import/preview { roles }).
//   Yükleme tek işlem bloğunda (store.tx: BEGIN IMMEDIATE … COMMIT); yarıda kesilirse hiçbir satır kalmaz (rollback).
import { parseAmount } from "./money.mjs";
import { parseDay } from "./plans.mjs";
import { parseQty } from "./accounts.mjs";

const INVISIBLE = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u200B-\\u200F\\u2028\\u2029\\u202A-\\u202E\\u2060\\uFEFF]", "g");
const EXCEL_ERROR = /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|YOK|BAŞV!|DEĞER!|SAYI\/0!|AD\?|SAYI!|BOŞ!)$/i;
export function sanitizeCell(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : parseDay(value);
  let text = String(value).replace(INVISIBLE, "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  if (EXCEL_ERROR.test(text)) text = "";
  return text;
}
export const sanitizeRow = row => (Array.isArray(row) ? row.map(sanitizeCell) : []);

// Başlık satırı: ilk 30 satır içinde tanınan başlık rolü (ad, telefon, birim…) en çok olan satır; eşitlikte dolu hücresi
// çok olan, sonra en üstteki. Üstteki "Servis Listesi | 01.09.2026" gibi başlık/tarih satırları hiçbir rol taşımadığı
// için elenir; tek kolonlu liste ("Ad Soyad") de başlık sayılır. mapper verilmezse dolu hücre sayısına bakılır.
export function findHeaderRow(matrix, { cellOf = sanitizeCell, mapper = null } = {}) {
  if (!Array.isArray(matrix)) return -1;
  const window = matrix.slice(0, 30).map(row => (Array.isArray(row) ? row.map(cellOf) : []));
  let best = -1;
  let bestScore = null;
  window.forEach((cells, index) => {
    const filled = cells.filter(Boolean).length;
    if (!filled) return;
    const roles = mapper ? mapper(cells) : {};
    const known = Object.values(roles).filter(role => role && role !== "extra").length;
    const score = [known, filled];
    if (!bestScore || score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1])) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

// ---------- Değere göre eşleme ----------
const PHONE = /^(\+?90|0)?\s?\(?5\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$|^(\+?90|0)?\s?\(?[2-4]\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const share = (values, test) => {
  const filled = values.filter(Boolean);
  if (filled.length < 3) return 0;
  return filled.filter(test).length / filled.length;
};
// roles: başlıktan gelen eşleme (index → rol). Tanınmayan ("extra"/boş) kolonlar için örnek satırlardaki değerlere bakılır;
// aynı rol ikinci kez verilmez. kind: "account" | "stock".
export function inferRolesByValues(headers, rows, roles, kind) {
  const out = { ...roles };
  const taken = new Set(Object.values(out).filter(role => role && role !== "extra"));
  const sample = rows.slice(0, 200);
  headers.forEach((_, index) => {
    if (out[index] && out[index] !== "extra") return;
    const values = sample.map(row => sanitizeCell(row?.[index]));
    const give = role => {
      if (taken.has(role)) return false;
      out[index] = role;
      taken.add(role);
      return true;
    };
    if (kind === "account") {
      if (share(values, value => PHONE.test(value.replace(/\s/g, "")) || /^0\d{3}\s?\d{3}\s?\d{2}\s?\d{2}$/.test(value)) >= 0.7 && give("phone")) return;
      if (share(values, value => EMAIL.test(value)) >= 0.7 && give("email")) return;
      if (share(values, value => Boolean(parseDay(value))) >= 0.8 && give("registered")) return;
    } else if (kind === "stock") {
      if (share(values, value => /^(adet|kg|gr|lt|ml|paket|kutu|koli|metre|m|top|çift|takım|cuval|çuval|torba|şişe|sise|rulo|kg\.|lt\.)$/i.test(value)) >= 0.7 && give("unit")) return;
      if (share(values, value => Number.isFinite(parseQty(value))) >= 0.9 && !taken.has("qty") && /(stok|mevcut|miktar|adet|bakiye|envanter)/i.test(headers[index] || "") && give("qty")) return;
    }
    if (out[index] === undefined || out[index] === "") out[index] = headers[index] ? "extra" : "";
  });
  return out;
}

// ---------- Doğrulama kapısı ----------
const column = (roles, role) => {
  const found = Object.entries(roles).find(([, value]) => value === role);
  return found ? Number(found[0]) : -1;
};
const MAX_ISSUES = 500;
export function validateRows(headers, rows, roles, kind, { headerAt = 0 } = {}) {
  const col = role => column(roles, role);
  const issues = [];
  const counts = { error: 0, warning: 0 };
  const seen = new Map();
  let ready = 0;
  let empty = 0;
  const push = (level, index, role, problem, value) => {
    counts[level] += 1;
    if (issues.length < MAX_ISSUES) issues.push({ row: headerAt + index + 2, level, column: headers[col(role)] || role, problem, value: String(value ?? "").slice(0, 60) });
  };
  const cell = (row, role) => (col(role) >= 0 ? sanitizeCell(row[col(role)]) : "");
  rows.forEach((row, index) => {
    if (!Array.isArray(row) || !row.some(value => sanitizeCell(value))) {
      empty += 1;
      return;
    }
    let bad = false;
    if (kind === "account") {
      const name = cell(row, "name");
      if (!name) {
        push("error", index, "name", "Ad / unvan boş; satır alınmaz", "");
        bad = true;
      }
      const phone = cell(row, "phone");
      if (phone && phone.replace(/\D/g, "").length < 7) push("warning", index, "phone", "Telefon 7 haneden kısa; olduğu gibi saklanır", phone);
      const registered = cell(row, "registered");
      if (registered && !parseDay(registered)) push("warning", index, "registered", "Kayıt tarihi okunamadı; bugün yazılır", registered);
      const balance = cell(row, "balance");
      if (balance && !Number.isFinite(parseAmount(balance))) push("warning", index, "balance", "Açılış bakiyesi okunamadı; bakiye yazılmaz", balance);
      const email = cell(row, "email");
      if (email && !EMAIL.test(email)) push("warning", index, "email", "E-posta biçimi tanınmadı; olduğu gibi saklanır", email);
      if (name) {
        // Sunucu kuralıyla aynı: ad + telefon (≥7 hane) aynıysa aynı kişi, ikinci satır açılmaz; telefonsuz aynı ad ayrı cari olur.
        const phoneDigits = phone.replace(/\D/g, "");
        const key = `${name.toLocaleLowerCase("tr-TR")}|${phoneDigits.length >= 7 ? phoneDigits : ""}`;
        if (seen.has(key)) {
          if (phoneDigits.length >= 7) push("warning", index, "name", `Dosyada tekrar (ilk: ${seen.get(key)}. satır); aynı kişi ikinci kez açılmaz`, name);
          else push("warning", index, "name", `Aynı ad (ilk: ${seen.get(key)}. satır); telefon olmadığı için ayrı cari açılır`, name);
        } else seen.set(key, headerAt + index + 2);
      }
    } else {
      const name = cell(row, "name");
      if (!name) {
        push("error", index, "name", "Ürün adı boş; satır alınmaz", "");
        bad = true;
      }
      const qty = cell(row, "qty");
      if (qty && !Number.isFinite(parseQty(qty))) push("warning", index, "qty", "Miktar okunamadı; açılış stoku yazılmaz", qty);
      const price = cell(row, "price");
      if (price && !Number.isFinite(parseAmount(price))) push("warning", index, "price", "Birim fiyat okunamadı; 0 alınır", price);
      const min = cell(row, "min");
      if (min && !Number.isFinite(parseQty(min))) push("warning", index, "min", "Kritik seviye okunamadı; uyarı kurulmaz", min);
      if (name) {
        const key = `${cell(row, "code") || name.toLocaleLowerCase("tr-TR")}|${cell(row, "unit").toLocaleLowerCase("tr-TR")}`;
        if (seen.has(key)) push("warning", index, "name", `Dosyada tekrar (ilk: ${seen.get(key)}. satır); ikinci satır atlanır`, name);
        else seen.set(key, headerAt + index + 2);
      }
    }
    if (!bad) ready += 1;
  });
  return { ready, empty, errors: counts.error, warnings: counts.warning, issues, issueTotal: counts.error + counts.warning, truncated: counts.error + counts.warning > issues.length };
}
