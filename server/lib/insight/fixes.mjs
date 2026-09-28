// Veri Sağlık Kontrolü — toplu düzeltme önerileri (v2.0.2).
// Airtable/Notion'daki "alan türü" mantığıyla: analiz bir kolonun türünü söyler; bu modül o türe uymayan ama tek bir
// doğru karşılığı olan hücreleri bulur ve kullanıcıya tek tıkla uygulanacak toplu bir düzeltme önerir. Belirsiz
// hücreler (karışık sayı yazımı, okunamayan tarih) önerilmez; onlar veri sağlığı raporunda nokta atışı listelenir.
//
// Öneri türleri:
//   phone   — telefon yazımı: "5321112233", "+90 532 111 11 11", "0532-111-11-11" → "0532 111 11 11"
//   date    — tarih yazımı: "5.3.2024", "2024-03-05", "5 Mart 2024" → "05.03.2024" (saat varsa korunur)
//   amount  — ABD yazımlı tutar: "1,500.00" → "1.500,00" (yalnızca iki ayraçlı, belirsiz olmayan yazımlar)
//   status  — aynı değerin farklı yazımları: "aktif", "AKTİF", " Aktif " → en sık görülen "Aktif"
//   space   — baştaki/sondaki/çift boşluk
import { foldText, isSerialDate, isTrPhone, parseDate, serialToDate } from "./validators.mjs";

export const FIX_LIMITS = { changes: 20_000, samples: 5 };

const pad = value => String(value).padStart(2, "0");

/** "5321112233" | "+905321112233" | "0532-111-11-11" → "0532 111 11 11"; değilse null. */
export function canonicalPhone(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  let digits = text.replace(/[^\d]/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("5")) digits = `0${digits}`;
  if (digits.length !== 11 || !digits.startsWith("05")) return null;
  const out = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
  return isTrPhone(out) ? out : null;
}

/** Excel seri sayısını (45000) gg.aa.yyyy tarihe çevirir; seri değilse null. */
export function serialToText(value) {
  const date = serialToDate(value);
  return date ? `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}` : null;
}

/** Tarihi gg.aa.yyyy (varsa ss:dd) yazımına getirir; okunamıyorsa null. */
export function canonicalDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = parseDate(text);
  if (!date) return null;
  const time = /(\d{1,2}):(\d{2})/.exec(text);
  const day = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  return time ? `${day} ${pad(time[1])}:${time[2]}` : day;
}

/** "1,500.00" / "$1,500.00" → "1.500,00" (para simgesi korunur). Tek ayraçlı belirsiz yazım null. */
export function canonicalAmount(value) {
  const text = String(value ?? "").trim();
  const match = /^([^\d-]*)(-?\d{1,3}(?:,\d{3})+\.\d{2})([^\d]*)$/.exec(text);
  if (!match) return null;
  const number = match[2].replace(/,/g, "#").replace(".", ",").replace(/#/g, ".");
  return `${match[1]}${number}${match[3]}`.trim();
}

const squeeze = text => String(text ?? "").replace(/\s+/g, " ").trim();

/**
 * @param {{ rows: Array<Record<string,string>>, analyses: Array<{column:string, role:string, stats:{nonEmpty:number}}> }} input
 * @returns {Array<{id:string, kind:string, column:string, title:string, detail:string, count:number, samples:Array<{key:string,from:string,to:string}>, changes:Array<{key:string, field:string, value:string, previous:string}>}>}
 */
export function proposeFixes({ rows, analyses }) {
  const out = [];
  const propose = (kind, column, title, detail, mapper) => {
    const changes = [];
    for (const row of rows) {
      const key = row.__hofKey;
      if (!key) continue;
      const previous = String(row[column] ?? "");
      if (!previous.trim()) continue;
      const value = mapper(previous, row);
      if (value === null || value === undefined || value === previous) continue;
      changes.push({ key, field: column, value, previous });
      if (changes.length >= FIX_LIMITS.changes) break;
    }
    if (!changes.length) return;
    out.push({
      id: `${kind}:${column}`,
      kind,
      column,
      title: title(changes.length),
      detail,
      count: changes.length,
      samples: changes.slice(0, FIX_LIMITS.samples).map(item => ({ key: item.key, from: item.previous, to: item.value })),
      changes,
    });
  };

  for (const item of analyses) {
    if (!item || item.role === "empty" || !item.stats?.nonEmpty) continue;
    const column = item.column;
    if (item.role === "phone" && !item.warning) {
      propose("phone", column, n => `"${column}": ${n} telefon tek yazıma getirilsin`, "Telefonlar “0532 111 11 11” yazımına çevrilir; WhatsApp ve arama bağlantıları hepsinde çalışır.", canonicalPhone);
    } else if (item.role === "date" && item.warning === "serial") {
      propose("serial", column, n => `"${column}": ${n} Excel seri sayısı gerçek tarihe çevrilsin`, "Excel bu hücreleri tarih yerine sayı (45000 gibi) olarak saklamış. Sayılar gg.aa.yyyy tarihe çevrilir; son tarih uyarıları ancak bundan sonra çalışır.", text => (isSerialDate(text) ? serialToText(text) : null));
    } else if (item.role === "date") {
      propose("date", column, n => `"${column}": ${n} tarih gg.aa.yyyy yazımına getirilsin`, "Farklı yazılmış tarihler (5.3.2024, 2024-03-05, 5 Mart 2024) tek biçime çevrilir; sıralama ve son tarih uyarıları hepsinde çalışır.", canonicalDate);
    } else if (item.role === "money") {
      propose("amount", column, n => `"${column}": ${n} tutar Türkçe yazıma getirilsin`, "ABD yazımlı tutarlar (1,500.00) Türkçe yazıma (1.500,00) çevrilir; toplamlar doğru hesaplanır.", canonicalAmount);
    } else if (item.role === "status" || item.role === "category" || item.role === "city") {
      // Aynı değerin farklı yazımları: katlanmış (küçük harf, eksiz) anahtar → en sık görülen yazım.
      const counts = new Map();
      for (const row of rows) {
        const text = squeeze(row[column]);
        if (!text) continue;
        const key = foldText(text);
        if (!counts.has(key)) counts.set(key, new Map());
        counts.get(key).set(text, (counts.get(key).get(text) || 0) + 1);
      }
      const preferred = new Map();
      for (const [key, forms] of counts) {
        if (forms.size < 2) continue;
        preferred.set(key, [...forms].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))[0][0]);
      }
      if (preferred.size) propose("status", column, n => `"${column}": ${n} hücrede aynı değerin farklı yazımı birleştirilsin`, "“aktif”, “AKTİF”, “ Aktif ” gibi yazımlar en sık kullanılan biçime çevrilir; süzme ve sayım doğru çalışır.", text => preferred.get(foldText(squeeze(text))) ?? null);
    }
    if (["text", "person", "org", "note", "id", "address"].includes(item.role)) {
      propose("space", column, n => `"${column}": ${n} hücrede fazla boşluk temizlensin`, "Baştaki, sondaki ve çift boşluklar kaldırılır; arama ve eşleştirme doğru çalışır.", text => {
        const clean = text.replace(/[ \t]+/g, " ").replace(/^ +| +$/gm, "");
        return clean !== text ? clean : null;
      });
    }
  }
  return out;
}

/** İstemciye giden özet: değişiklik listesi sunucuda kalır. */
export const summarizeFix = fix => ({ id: fix.id, kind: fix.kind, column: fix.column, title: fix.title, detail: fix.detail, count: fix.count, samples: fix.samples });
