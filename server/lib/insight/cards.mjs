// Doğrulanmış özet kartları (v1.7.0).
//
// Bir kart ancak kapsamındaki (sekmedeki) HER hücre tek tek okunup kartın söylediği şey kesinleşirse gösterilir:
//   - Tutar toplamı: dolu hücrelerin en az %98'i tek bir tutar; tek para birimi; kimlik/telefon gibi değerler, "TOPLAM"
//     satırları ve "1.500 TL + faiz" gibi kesin okunamayan hücreler toplanmaz, sayıları kartın açıklamasında yazar.
//   - Son tarih / bu ay: dolu hücrelerin en az %98'i ya tek bir tarih ya da tarih içermeyen bir not; "12.03.2025 ertelendi"
//     veya iki tarihli hücreler kesin değildir.
//   - Dağılım (durum, tür, sorumlu): kolon birkaç sabit seçenekten oluşmalı (vocabulary.mjs süzgeçleri).
// Süzgeçten geçemeyen aday kart gösterilmez; nedeni (örnek hücrelerle) rapora yazılır. Her kartın "Nasıl hesaplandı?"
// açıklaması sunucuda, kartla aynı sayılardan üretilir.
import { exampleList, headerCurrency, isEmptyCell, isTotalRow, readCell } from "./cells.mjs";
import { cell } from "./columns.mjs";
import { percentOf, trNumber } from "./text.mjs";
import { assessVocabulary, CERTAINTY, labelKey } from "./vocabulary.mjs";

const DAY = 86_400_000;
export const dayStart = now => Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
const n = trNumber;
const q = value => `“${value}”`;
const CURRENCY_NAMES = { TRY: "TL", USD: "ABD doları", EUR: "euro", GBP: "sterlin" };
const examples = values => exampleList(values).map(q).join(", ");
const uncertain = (unclear, filled) => unclear > filled * (1 - CERTAINTY);

// Kapsamın kolon çözümlemesinden aday kolonlar (en güçlüsü önce).
function candidatePool(analyses) {
  const pick = (filter, score) => analyses.filter(filter).sort((a, b) => score(b) - score(a));
  const filled = item => item.stats.nonEmpty;
  return {
    money: pick(item => item.role === "money" && item.kind === "amount", item => (item.header.includes("money") ? 1e9 : 0) + filled(item)),
    deadline: pick(item => item.role === "date" && item.kind === "deadline", item => (item.strong ? 1e9 : 0) + (item.futureRate || 0) * 1e6 + filled(item)),
    event: pick(item => item.role === "date" && item.kind === "event", filled),
    status: pick(item => item.role === "status", item => (item.header.includes("status") ? 1e9 : 0) + filled(item)),
    responsible: pick(item => item.role === "responsible", filled),
    category: pick(item => item.role === "category", item => (item.header.includes("category") ? 1e9 : 0) + filled(item)).slice(0, 4),
  };
}

// ---------- Tutar ----------
export function verifyMoney(rows, column) {
  let sum = 0;
  let count = 0;
  let empty = 0;
  let totals = 0;
  const text = [];
  const unclear = [];
  const currencies = new Map();
  for (const row of rows) {
    const reading = readCell(cell(row, column));
    if (reading.kind === "empty") empty += 1;
    else if (reading.kind === "amount" && !reading.identifier) {
      if (isTotalRow(row, column)) totals += 1;
      else {
        sum += reading.amount;
        count += 1;
        if (reading.currency) currencies.set(reading.currency, (currencies.get(reading.currency) || 0) + 1);
      }
    } else if (reading.kind === "label" || reading.kind === "text") text.push(reading.text);
    else unclear.push(reading.text);
  }
  const filled = count + totals + text.length + unclear.length;
  if (count < 3) return { ok: false, reason: `yalnızca ${n(count)} hücrede tutar var; toplam için az` };
  if (currencies.size > 1) {
    const names = [...currencies.keys()].map(code => CURRENCY_NAMES[code] || code).join(", ");
    return { ok: false, reason: `birden çok para birimi var (${names}); farklı para birimleri toplanamaz` };
  }
  if (uncertain(unclear.length, filled)) {
    return { ok: false, reason: `${n(unclear.length)} hücrede tutar başka bilgiyle karışık ya da tutar değil (ör. ${examples(unclear)}); toplam kesin hesaplanamaz`, examples: exampleList(unclear) };
  }
  const explicit = currencies.size ? [...currencies.keys()][0] : null;
  const fromHeader = explicit ? null : headerCurrency(column);
  const currency = explicit || fromHeader || null;
  const explain = [`${q(column)} kolonundaki ${n(count)} tutar toplandı.`];
  explain.push(explicit ? `Para birimi hücrelerde yazılı: ${CURRENCY_NAMES[explicit] || explicit}.` : fromHeader ? `Para birimi kolon başlığından: ${CURRENCY_NAMES[fromHeader] || fromHeader}.` : "Para birimi hücrelerde yazılı değil; toplam birimsiz gösterilir.");
  if (text.length) explain.push(`${n(text.length)} hücrede tutar yerine yazı var (ör. ${examples(text)}); toplama katılmadı.`);
  if (unclear.length) explain.push(`Kesin okunamayan ${n(unclear.length)} hücre (ör. ${examples(unclear)}) toplama katılmadı.`);
  if (totals) explain.push(`${n(totals)} “Toplam” satırı kayıt olmadığı için toplama katılmadı.`);
  if (empty) explain.push(`${n(empty)} kayıtta tutar boş.`);
  explain.push(`Denetim: dolu hücrelerin ${percentOf(filled - unclear.length, filled)} kesin okundu${currencies.size ? "; tek para birimi" : ""}.`);
  return { ok: true, card: { id: "money", column, sum: Math.round(sum * 100) / 100, count, currency, text: text.length, unclear: unclear.length, totals, empty, explain } };
}

// ---------- Tarih (son tarih ve olay tarihi) ----------
export function verifyDates(rows, item, now, mode) {
  const column = item.column;
  const today = dayStart(now);
  const month = now.getMonth();
  const year = now.getFullYear();
  const counts = { today: 0, next7: 0, next30: 0, passed: 0, thisMonth: 0 };
  let dated = 0;
  let empty = 0;
  const notes = [];
  const unclear = [];
  for (const row of rows) {
    const reading = readCell(cell(row, column));
    if (reading.kind === "empty") empty += 1;
    else if (reading.kind === "date") {
      dated += 1;
      const days = Math.round((reading.date.getTime() - today) / DAY);
      if (days === 0) counts.today += 1;
      if (days >= 0 && days <= 7) counts.next7 += 1;
      if (days >= 0 && days <= 30) counts.next30 += 1;
      if (days < 0) counts.passed += 1;
      if (reading.date.getUTCFullYear() === year && reading.date.getUTCMonth() === month) counts.thisMonth += 1;
    } else if (reading.kind === "label" || reading.kind === "text") notes.push(reading.text);
    else unclear.push(reading.text);
  }
  const filled = dated + notes.length + unclear.length;
  if (dated < 3) return { ok: false, reason: `yalnızca ${n(dated)} hücrede tarih var; özet için az` };
  if (uncertain(unclear.length, filled)) {
    return { ok: false, reason: `${n(unclear.length)} hücrede tarih başka bilgiyle karışık ya da birden çok tarih var (ör. ${examples(unclear)}); hangi tarihin esas alınacağı kesin değil`, examples: exampleList(unclear) };
  }
  const todayText = new Date(today).toISOString().slice(0, 10).split("-").reverse().join(".");
  const explain =
    mode === "deadline"
      ? [
          `${q(column)} kolonu son tarih olarak kullanıldı (başlığı ${item.strong ? "vade, termin, söz gibi bir son tarih bildiriyor" : "planlanan bir tarih bildiriyor"}); ${n(dated)} kayıtta tarih okundu.`,
          `Günler bugüne (${todayText}) göre sayıldı: bugün ${n(counts.today)}, 7 gün içinde ${n(counts.next7)}, 30 gün içinde ${n(counts.next30)}, tarihi geçen ${n(counts.passed)}.`,
        ]
      : [`${q(column)} kolonu olay tarihi olarak kullanıldı; ${n(dated)} kayıtta tarih okundu, bu ay ${n(counts.thisMonth)}.`];
  if (notes.length) explain.push(`${n(notes.length)} hücrede tarih yerine not var (ör. ${examples(notes)}); sayılmadı.`);
  if (unclear.length) explain.push(`Kesin okunamayan ${n(unclear.length)} hücre (ör. ${examples(unclear)}) sayılmadı.`);
  if (empty) explain.push(`${n(empty)} kayıtta tarih boş.`);
  explain.push(`Denetim: dolu hücrelerin ${percentOf(filled - unclear.length, filled)} kesin okundu (takvimde olmayan tarihler geçersiz sayılır).`);
  const base = { column, dated, notes: notes.length, unclear: unclear.length, empty, explain };
  return mode === "deadline"
    ? { ok: true, card: { id: "deadline", ...base, today: counts.today, next7: counts.next7, next30: counts.next30, passed: counts.passed, thisMonth: counts.thisMonth } }
    : { ok: true, card: { id: "event", ...base, thisMonth: counts.thisMonth } };
}

// ---------- Dağılım (durum, tür, sorumlu) ----------
const VOCABULARY_OPTIONS = {
  status: { maxLabels: 12 },
  category: { maxLabels: 12 },
  responsible: { maxLabels: 40, singletons: true, person: true },
};
export function verifyVocabulary(rows, column, mode) {
  const values = [];
  let empty = 0;
  for (const row of rows) {
    const raw = cell(row, column);
    if (isEmptyCell(raw)) empty += 1;
    else values.push(String(raw).trim());
  }
  const verdict = assessVocabulary(values, VOCABULARY_OPTIONS[mode]);
  if (!verdict.ok) return { ok: false, reason: verdict.reason, examples: verdict.examples || [] };
  const labels = verdict.labels.map(({ value, key, count }) => ({ value, key, count }));
  const explain = [
    mode === "responsible"
      ? `${q(column)} kolonunda ${n(labels.length)} kişi var; her kişinin kayıt sayısı sayıldı.`
      : `${q(column)} kolonu ${n(labels.length)} sabit seçenekten oluşuyor: ${labels.slice(0, 8).map(label => label.value).join(", ")}${labels.length > 8 ? "…" : ""}.`,
    `Denetimler: ${mode === "responsible" ? "adlar birbirini içermiyor ve aralarında yazım farkı yok" : "seçenekler birbirini içermiyor, aynı kökten türememiş, aralarında yazım farkı yok"}; dolu hücrelerin ${percentOf(verdict.filled - verdict.other, verdict.filled)} bu ${mode === "responsible" ? "adlardan" : "seçeneklerden"} biri. Büyük/küçük harf ve Türkçe karakter farkı aynı değer sayıldı.`,
  ];
  if (verdict.other) explain.push(`${n(verdict.other)} hücre ${mode === "responsible" ? "bir kişi adı değil" : "seçeneklerin dışında"} (ör. ${examples(verdict.otherExamples)}); dağılıma katılmadı.`);
  if (empty) explain.push(`${n(empty)} kayıtta boş.`);
  return { ok: true, card: { id: mode, column, labels, people: mode === "responsible" ? labels.length : undefined, other: verdict.other, empty, filled: verdict.filled, explain } };
}

// ---------- Kapsamın kartları ----------
// Öncelik: tutar, son tarih, durum, sorumlu, tür, olay tarihi. Arayüz ilk ikisini gösterir; rapor hepsini.
const PRIORITY = ["money", "deadline", "status", "responsible", "category", "event"];
export function buildCards(rows, analyses, { now = new Date() } = {}) {
  const pool = candidatePool(analyses);
  const found = new Map();
  const rejected = [];
  const used = new Set();
  const attempt = (id, list, verify) => {
    for (const item of list) {
      if (used.has(item.column)) continue;
      const result = verify(item);
      if (result.ok) {
        found.set(id, result.card);
        used.add(item.column);
        return;
      }
      rejected.push({ id, column: item.column, reason: result.reason, examples: result.examples || [] });
    }
  };
  attempt("money", pool.money, item => verifyMoney(rows, item.column));
  attempt("deadline", pool.deadline, item => verifyDates(rows, item, now, "deadline"));
  attempt("event", pool.event, item => verifyDates(rows, item, now, "event"));
  attempt("status", pool.status, item => verifyVocabulary(rows, item.column, "status"));
  attempt("responsible", pool.responsible, item => verifyVocabulary(rows, item.column, "responsible"));
  attempt("category", pool.category, item => verifyVocabulary(rows, item.column, "category"));
  const cards = PRIORITY.filter(id => found.has(id)).map(id => found.get(id));
  // Kenar çubuğundaki "Bu ay": doğrulanmış son tarih, yoksa doğrulanmış olay tarihi.
  const monthCard = found.get("deadline") || found.get("event") || null;
  const month = monthCard ? { column: monthCard.column, count: monthCard.thisMonth, card: monthCard.id } : null;
  return { cards, rejected, month };
}

// ---------- Kart listeleri ----------
// Kartın sayısıyla aynı okuma ve aynı kural: listedeki toplam, karttaki sayıdır.
export function cardItems(rows, card, { list, value = "", now = new Date(), title }) {
  const items = [];
  if (!card) return items;
  const column = card.column;
  const today = dayStart(now);
  const tabOf = row => String(row.__sheet || "");
  const keyOf = row => String(row.__hofKey || "");
  if (list === "upcoming" || list === "passed" || list === "month" || list === "eventMonth") {
    for (const row of rows) {
      const reading = readCell(cell(row, column));
      if (reading.kind !== "date") continue;
      const days = Math.round((reading.date.getTime() - today) / DAY);
      const date = reading.text;
      if (list === "upcoming" && days >= 0 && days <= 30) items.push({ key: keyOf(row), title: title(row), date, days, tab: tabOf(row) });
      else if (list === "passed" && days < 0) items.push({ key: keyOf(row), title: title(row), date, days, tab: tabOf(row) });
      else if ((list === "month" || list === "eventMonth") && reading.date.getUTCFullYear() === now.getFullYear() && reading.date.getUTCMonth() === now.getMonth()) {
        items.push({ key: keyOf(row), title: title(row), date, day: reading.date.getUTCDate(), tab: tabOf(row) });
      }
    }
    const byTitle = (a, b) => a.title.localeCompare(b.title, "tr");
    if (list === "upcoming") items.sort((a, b) => a.days - b.days || byTitle(a, b));
    else if (list === "passed") items.sort((a, b) => b.days - a.days || byTitle(a, b));
    else items.sort((a, b) => a.day - b.day || byTitle(a, b));
  } else if (list === "topAmount") {
    for (const row of rows) {
      const reading = readCell(cell(row, column));
      if (reading.kind !== "amount" || reading.identifier || reading.amount <= 0 || isTotalRow(row, column)) continue;
      items.push({ key: keyOf(row), title: title(row), amount: reading.amount, tab: tabOf(row) });
    }
    items.sort((a, b) => b.amount - a.amount || a.title.localeCompare(b.title, "tr"));
  } else if (list === "value") {
    const wanted = labelKey(value);
    for (const row of rows) {
      const raw = cell(row, column);
      if (isEmptyCell(raw) || labelKey(String(raw).trim()) !== wanted) continue;
      items.push({ key: keyOf(row), title: title(row), value: String(raw).trim(), tab: tabOf(row) });
    }
    items.sort((a, b) => a.title.localeCompare(b.title, "tr"));
  }
  return items;
}
