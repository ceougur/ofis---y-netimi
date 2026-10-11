// Kaynak satırları için ortak kurallar: kolon sırası, dosya kimliği (notların ve düzeltmelerin bağlandığı anahtar)
// ve kolon adı değişse de düzeltmenin doğru kolona uygulanması. Verinin kendisi dataset.mjs'de tutulur.
import { createHash } from "node:crypto";
import { fold } from "./sections.mjs";

export const EXCEL_PREFIX = "excel://";
export const CASE_KEY_PATTERN = /\b(?:19|20)\d{2}\/\d+\b/;
const CASE_FIELD_NAMES = ["dosya no", "dosya numarası", "dosya numarasi", "dosya", "esas", "esas no"];

const normalize = value => String(value ?? "").trim().toLocaleLowerCase("tr-TR").replace(/[İI]/g, "i").replace(/ı/g, "i");

export function columnOrder(rows) {
  const seen = new Set();
  const order = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key.startsWith("__") || !key.trim() || seen.has(key)) continue;
      seen.add(key);
      order.push(key);
    }
  }
  return order;
}

// v1.0.0 istemcisi dosya kimliğini satır metnindeki ilk "yyyy/sayı" kalıbından çıkarıyordu;
// aynı kural korunur ki eski düzeltmeler ve silmeler aynı satırlara bağlı kalsın.
export function canonicalCaseKey(row, columns) {
  for (const column of columns) {
    const value = row[column];
    if (!value) continue;
    const match = String(value).match(CASE_KEY_PATTERN);
    if (match) return match[0];
  }
  for (const column of columns) {
    if (CASE_FIELD_NAMES.includes(normalize(column))) {
      const value = String(row[column] ?? "").trim();
      if (value) return value;
    }
  }
  const fingerprint = JSON.stringify([row.__sheet || "", ...columns.map(column => String(row[column] ?? "").trim())]);
  return `satir:${createHash("sha1").update(fingerprint).digest("hex").slice(0, 16)}`;
}

// Kolon adı değiştiyse (ör. eski okuyucu üst başlıkla kolon başlığını birleştirip "GAYRİMENKUL … SIRA" diyordu,
// yeni okuyucu yalnızca "SIRA" diyor) ofisin o kolondaki düzeltmesi kaybolmasın: eski ad yeni adla bitiyorsa taşınır.
export function applyPatch(row, patch) {
  const result = { ...row };
  let keys = null;
  for (const [field, value] of Object.entries(patch)) {
    if (field in row || field.startsWith("__")) {
      result[field] = value;
      continue;
    }
    keys ??= Object.keys(row).filter(key => !key.startsWith("__")).map(key => [key, fold(key)]);
    const folded = fold(field);
    const matches = keys.filter(([, name]) => name && (folded === name || folded.endsWith(` ${name}`)));
    result[matches.length === 1 ? matches[0][0] : field] = value;
  }
  return result;
}
