// Şemaya esnek uyum — kolon eşleme (v2.0.2).
// Airtable/Notion'da alanın adı değişince kayıtlar kaybolmaz; alanın kimliği kalır. Excel'de böyle bir kimlik yoktur:
// kullanıcı "Müvekkil" başlığını "Müvekkil Adı" yapıp dosyayı yeniden yüklediğinde program iki ayrı kolon görürdü.
// Bu modül eski ve yeni kolon adlarını, adların benzerliği ve değerlerin örtüşmesiyle eşler; eşlenen (yeniden
// adlandırılmış) kolonlar için düzeltmeler, kolon adları, açılır listeler ve saklı satırlar yeni ada taşınır.
//
// Puanlama (0–1): aynı katlanmış ad 1 · biri ötekini kapsıyor 0.85 · kelime örtüşmesi (Jaccard) · değer örtüşmesi
// (yeni kolonun ayrık değerlerinin eskisinde bulunma oranı, metin kolonlarında) · aynı konum küçük bir ek.
// Eşik 0.6; her kolon en çok bir kolonla eşlenir (açgözlü, en yüksek puandan başlayarak).
import { fold } from "./sections.mjs";

const STOP = new Set(["no", "adi", "ad", "ve", "the", "of"]);
const tokens = name => new Set(fold(name).split(" ").filter(word => word && !STOP.has(word)));
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const word of a) if (b.has(word)) common += 1;
  return common / (a.size + b.size - common);
};

function nameScore(from, to) {
  const a = fold(from);
  const b = fold(to);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 3 && (longer.startsWith(`${shorter} `) || longer.endsWith(` ${shorter}`) || longer.includes(` ${shorter} `))) return 0.85;
  const j = jaccard(tokens(from), tokens(to));
  // Tek harflik farklar (yazım düzeltmesi): "Müvekil" → "Müvekkil".
  if (!j && shorter.length >= 5 && Math.abs(a.length - b.length) <= 1 && editDistance(a, b) <= 1) return 0.8;
  return j;
}

function editDistance(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = temp;
    }
  }
  return prev[b.length];
}

const distinct = values => {
  const set = new Set();
  for (const value of values || []) {
    const text = String(value ?? "").trim();
    if (text) set.add(text.toLocaleLowerCase("tr-TR"));
    if (set.size >= 500) break;
  }
  return set;
};

function valueScore(prevValues, nextValues) {
  const a = distinct(prevValues);
  const b = distinct(nextValues);
  if (a.size < 3 || b.size < 3) return 0;
  let found = 0;
  for (const value of b) if (a.has(value)) found += 1;
  return found / b.size;
}

/**
 * @param {string[]} previous  Mevcut verideki kolon adları (sırayla)
 * @param {string[]} next      Gelen dosyadaki kolon adları (sırayla)
 * @param {{ prevValues?: Map<string, string[]>, nextValues?: Map<string, string[]>, threshold?: number }} [options]
 * @returns {{ renamed: Array<{from:string, to:string, score:number, why:string}>, added: string[], removed: string[], same: string[] }}
 */
export function matchColumns(previous, next, { prevValues = null, nextValues = null, threshold = 0.6 } = {}) {
  const prev = [...new Set((previous || []).filter(name => name && !String(name).startsWith("__")))];
  const incoming = [...new Set((next || []).filter(name => name && !String(name).startsWith("__")))];
  const same = incoming.filter(name => prev.includes(name));
  const leftPrev = prev.filter(name => !same.includes(name));
  const leftNext = incoming.filter(name => !same.includes(name));
  const candidates = [];
  for (const from of leftPrev) {
    for (const to of leftNext) {
      const byName = nameScore(from, to);
      const byValue = prevValues && nextValues ? valueScore(prevValues.get(from), nextValues.get(to)) : 0;
      const position = prev.indexOf(from) === incoming.indexOf(to) ? 0.05 : 0;
      const score = Math.min(1, Math.max(byName, byValue * 0.9) + (byName && byValue ? 0.1 : 0) + position);
      if (score >= threshold) candidates.push({ from, to, score: Math.round(score * 100) / 100, why: byName >= byValue ? (byName === 1 ? "aynı ad" : "benzer ad") : "aynı değerler" });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.from.localeCompare(b.from, "tr"));
  const usedFrom = new Set();
  const usedTo = new Set();
  const renamed = [];
  for (const item of candidates) {
    if (usedFrom.has(item.from) || usedTo.has(item.to)) continue;
    usedFrom.add(item.from);
    usedTo.add(item.to);
    renamed.push(item);
  }
  return {
    renamed,
    added: leftNext.filter(name => !usedTo.has(name)),
    removed: leftPrev.filter(name => !usedFrom.has(name)),
    same,
  };
}

/** Kayıt nesnesinin anahtarlarını eşlemeye göre yeniden adlandırır (yerinde değil; yeni nesne). */
export function renameKeys(record, renamed) {
  if (!renamed?.length) return record;
  const map = new Map(renamed.map(item => [item.from, item.to]));
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    const target = map.get(key);
    if (target && !(target in record)) out[target] = value;
    else out[key] = value;
  }
  return out;
}
