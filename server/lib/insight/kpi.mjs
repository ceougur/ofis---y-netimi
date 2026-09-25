// Kapsamlar ve doğrulanmış göstergeler (v1.7.0).
//
// Her sekme (alt tablo) ayrı bir kapsamdır ve kendi kolonlarıyla, kendi satırları üzerinden değerlendirilir: kolon
// türleri, ana kolonlar, doğrulanmış kartlar (cards.mjs) ve veri sağlığı. Sekmesi olmayan veri tek kapsamdır ("").
// "Tümü" diye bir birleşik kapsam yoktur: farklı kolonlu sekmeleri tek tabloya zorlamak boş kolonlar ve yanlış
// göstergeler üretir. Tarih karşılaştırmaları sunucunun yerel takvim gününe göredir (ofis saati).
import { columnOrder } from "../sources.mjs";
import { buildCards, cardItems, dayStart } from "./cards.mjs";
import { analyzeColumns, primaryColumns } from "./columns.mjs";
import { assessQuality, mergeQuality, recordTitle } from "./quality.mjs";

// Kapsam anahtarları: verilen sekme sırası, sonra satırlarda geçen diğer sekmeler, en sonda sekmesiz satırlar ("").
export function scopeKeys(rows, tabs = []) {
  const present = new Set();
  let untabbed = false;
  for (const row of rows) {
    const tab = String(row.__sheet || "");
    if (tab) present.add(tab);
    else untabbed = true;
  }
  const keys = tabs.filter(tab => present.has(tab));
  for (const tab of present) if (!keys.includes(tab)) keys.push(tab);
  if (untabbed || !keys.length) keys.push("");
  return keys;
}

export function splitScopes(rows, keys) {
  const groups = new Map(keys.map(key => [key, []]));
  for (const row of rows) {
    const tab = String(row.__sheet || "");
    (groups.get(tab) || groups.get("")).push(row);
  }
  return groups;
}

// Bir kapsamın çözümlemesi: istemciye giden özet ve listeler için gereken ana kolonlar.
export function analyzeScope(rows, { now = new Date() } = {}) {
  const columns = columnOrder(rows);
  const analyses = analyzeColumns(rows, columns, { now });
  const primary = primaryColumns(analyses);
  const { cards, rejected, month } = buildCards(rows, analyses, { now });
  const quality = assessQuality(rows, analyses, primary);
  return { total: rows.length, columnCount: columns.length, primary, cards, rejected, month, quality };
}

export function computeKpis(rows, { tabs = [], now = new Date() } = {}) {
  const keys = scopeKeys(rows, tabs);
  const groups = splitScopes(rows, keys);
  const scopes = {};
  let monthCount = 0;
  const monthParts = [];
  for (const key of keys) {
    const scope = analyzeScope(groups.get(key), { now });
    scopes[key] = { tab: key, ...scope };
    if (scope.month) {
      monthCount += scope.month.count;
      monthParts.push({ tab: key, column: scope.month.column, count: scope.month.count });
    }
  }
  return {
    today: new Date(dayStart(now)).toISOString().slice(0, 10),
    order: keys,
    total: rows.length,
    scopes,
    // Kenar çubuğundaki "Bu ay": her sekmenin doğrulanmış tarih kolonundan; hiçbirinde yoksa null.
    month: monthParts.length ? { count: monthCount, parts: monthParts } : null,
    quality: mergeQuality(keys.map(key => ({ tab: key, quality: scopes[key].quality }))),
  };
}

// Kart penceresindeki kayıt listesi: kartla aynı kapsam, aynı kolon ve aynı okuma. "toplam" listenin tamamıdır, en
// fazla `limit` kayıt döner. Kenar çubuğunun "Bu ay" listesi (list=month, sekmesiz) tüm sekmeleri birleştirir.
export const RECORD_LISTS = Object.freeze(["upcoming", "passed", "topAmount", "month", "eventMonth", "value"]);
const LIST_CARD = { upcoming: "deadline", passed: "deadline", topAmount: "money", eventMonth: "event" };
export function listRecords(rows, kpis, { list, tab = "", card: cardId = "", value = "", now = new Date(), limit = 500 } = {}) {
  const keys = kpis?.order || [];
  const groups = splitScopes(rows, keys.length ? keys : [""]);
  const known = keys.includes(tab);
  const targets = list === "month" && !known ? keys : [known ? tab : keys[0] ?? ""];
  const items = [];
  let column = null;
  for (const key of targets) {
    const scope = kpis?.scopes?.[key];
    if (!scope) continue;
    const id = list === "value" ? cardId : list === "month" ? scope.month?.card : LIST_CARD[list];
    const card = scope.cards.find(item => item.id === id) || null;
    if (!card) continue;
    column ??= card.column;
    items.push(...cardItems(groups.get(key) || [], card, { list, value, now, title: row => recordTitle(row, scope.primary) }));
  }
  if (targets.length > 1) items.sort((a, b) => (a.day ?? 0) - (b.day ?? 0) || a.title.localeCompare(b.title, "tr"));
  return { list, tab: known ? tab : targets.length === 1 ? targets[0] : "", column, total: items.length, limit, items: items.slice(0, limit) };
}
