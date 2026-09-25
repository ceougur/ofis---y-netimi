// Doğrulanmış özet kartları (v1.7.0).
//
// Bir kart ancak kapsamındaki (sekmedeki) HER hücre tek tek okunup kartın söylediği şey kesinleşirse gösterilir:
//   - Tutar toplamı: kolon gerçekten para bildirmeli ("Kalan gün", "Toplam dosya", "USD kuru" gibi kolonlar değil); dolu
//     hücrelerin en az %98'i tek bir tutar; sayı yazımı (1.500 / 1,500) kolonda tutarlı; tek para birimi; kimlik/telefon
//     gibi değerler, yüzdeler, "Toplam" satırları (etiketli ya da diğer satırların toplamına eşit) ve "1.500 TL + faiz"
//     gibi kesin okunamayan hücreler toplanmaz, sayıları açıklamada yazar.
//   - Son tarih / bu ay: dolu hücrelerin en az %98'i ya tek bir tarih ya da tarih içermeyen bir not; "12.03.2025 ertelendi"
//     veya iki tarihli hücreler kesin değildir; gün/ay sırası belirsiz yazım (03/15/2026) kolonu reddeder.
//   - Dağılım (durum, tür, sorumlu): kolon birkaç sabit seçenekten oluşmalı (vocabulary.mjs süzgeçleri).
// Bir kayıt birden çok satırdaysa (ör. taraflar alt alta, aynı kayıt kimliğiyle) kartlar kayıt başına sayar; aynı kaydın
// satırlarında farklı değerler varsa kart kesin değildir. Süzgeçten geçemeyen aday kart gösterilmez; nedeni (örnek
// hücrelerle) rapora yazılır. Her kartın "Nasıl hesaplandı?" açıklaması kartla aynı sayılardan üretilir.
import { exampleList, headerCurrency, isEmptyCell, isTotalRow, readCell, readNumber } from "./cells.mjs";
import { cell, phraseAt } from "./columns.mjs";
import { percentOf, trNumber } from "./text.mjs";
import { foldText } from "./validators.mjs";
import { assessVocabulary, CERTAINTY, labelKey } from "./vocabulary.mjs";

const DAY = 86_400_000;
export const dayStart = now => Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
const n = trNumber;
const q = value => `“${value}”`;
const CURRENCY_NAMES = { TRY: "TL", USD: "ABD doları", EUR: "euro", GBP: "sterlin" };
const examples = values => exampleList(values).map(q).join(", ");
const uncertain = (unclear, filled) => unclear > filled * (1 - CERTAINTY);

// ---------- Kayıtlar ----------
// Kayıt kimliği (__hofKey) birçok satırda tekrar ediyorsa (en az üç kimlik ve kimlikli satırların %30'u) tablo bir kaydı
// birden çok satırda tutuyordur; kartlar kayıt başına sayar. Birkaç satırlık tekrar (ör. farklı icra dairelerinde aynı
// dosya numarası) ayrı kayıt sayılır.
export function recordUnits(rows) {
  const byKey = new Map();
  let keyed = 0;
  for (const row of rows) {
    const key = row.__hofKey ? String(row.__hofKey) : "";
    if (!key) continue;
    keyed += 1;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }
  let repeatedKeys = 0;
  let repeatedRows = 0;
  for (const list of byKey.values()) {
    if (list.length < 2) continue;
    repeatedKeys += 1;
    repeatedRows += list.length;
  }
  const grouped = repeatedKeys >= 3 && repeatedRows >= keyed * 0.3;
  if (!grouped) return { units: rows.map(row => [row]), grouped: false };
  const units = [];
  const placed = new Set();
  for (const row of rows) {
    const key = row.__hofKey ? String(row.__hofKey) : "";
    if (!key) units.push([row]);
    else if (!placed.has(key)) {
      placed.add(key);
      units.push(byKey.get(key));
    }
  }
  return { units, grouped: true };
}
const GROUPED_NOTE = "Bir kayıt birden çok satırda (aynı kayıt kimliğiyle, ör. taraflar alt alta); her kayıt bir kez sayıldı.";

// Aday kolonlar (en güçlüsü önce).
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
// Başlık para bildiriyor mu? Güçlü kelime ("tutar", "bedel", "ücret", "borç", "alacak", "masraf"…) yeterlidir. Zayıf
// kelime ("kalan", "toplam", "kira", "kredi") ya da başlıktaki/hücrelerdeki para birimi ancak başlık bir birim
// bildirmiyorsa ("gün", "ay", "adet", "sayı", "dosya", "not", "puan", "kur", "oran") yeterlidir.
const STRONG_MONEY = ["tutar", "tutari", "bedel", "bedeli", "ucret", "ucreti", "fiyat", "fiyati", "borc", "borcu", "alacak", "alacagi", "bakiye", "tahsilat", "tahsil edilen", "odeme", "odenen", "odenecek", "masraf", "masrafi", "maas", "prim", "gelir", "gider", "ciro", "harc", "avans", "kapora", "depozito", "teminat", "tazminat", "hakedis", "maliyet", "nafaka", "aidat"];
const WEAK_MONEY = ["kalan", "toplam", "kira", "kredi", "limit", "vergi", "faiz", "hasar", "tahakkuk", "brut", "net", "kdv", "doviz", "para"];
const UNIT_WORDS = new Set(["gun", "gunu", "ay", "yil", "sure", "suresi", "adet", "adedi", "sayi", "sayisi", "dosya", "not", "notu", "puan", "puani", "kur", "kuru", "oran", "orani", "yuzde", "kg", "km", "metre", "m2", "saat", "dakika", "yas", "kisi", "kapasite", "stok", "miktar", "miktari", "skor", "derece", "seviye", "sira", "hane", "kat", "oda", "gece", "seans", "desi", "koli"]);
export function moneyHeader(column) {
  const words = foldText(column).split(" ").filter(Boolean);
  const has = list => list.some(phrase => phraseAt(words, phrase));
  return { strong: has(STRONG_MONEY), weak: has(WEAK_MONEY), unit: words.some(word => UNIT_WORDS.has(word)) || String(column).includes("%"), currency: headerCurrency(column) };
}

// Tutar kolonunun hücre okuyucusu. Sayı yazımı (Türkçe/İngilizce) kolonun belirsiz olmayan hücrelerinden çıkarılır;
// iki yazım birlikte geçiyorsa "conflict".
function moneyReader(units, column) {
  let tr = 0;
  let us = 0;
  let trExample = "";
  let usExample = "";
  for (const unit of units) {
    for (const row of unit) {
      const raw = cell(row, column);
      if (isEmptyCell(raw)) continue;
      const number = readNumber(raw);
      if (number?.style === "tr") {
        tr += 1;
        trExample ||= String(raw).trim();
      } else if (number?.style === "us") {
        us += 1;
        usExample ||= String(raw).trim();
      }
    }
  }
  const style = us && !tr ? "us" : "tr";
  const read = row => {
    const raw = cell(row, column);
    if (isEmptyCell(raw)) return { type: "empty" };
    const text = String(raw).trim();
    const number = readNumber(raw);
    if (number && !number.identifier && !number.percent) {
      // "1.500" Türkçe yazımda bin beş yüz, "1,500" İngilizce yazımda; kolonun yazımına uymayan belirsiz sayı kesin değil.
      const value = number.style === "ambiguous" ? (number.separator === (style === "us" ? "," : ".") ? number[style] : null) : number[style];
      if (value !== null && value !== undefined) return { type: "amount", value, currency: number.currency, text, cents: /[.,]\d{2}\D*$/.test(text) };
      return { type: "unclear", text };
    }
    const reading = readCell(raw);
    if (reading.kind === "label" || reading.kind === "text") return { type: "text", text };
    return { type: "unclear", text };
  };
  return { read, style, conflict: tr && us ? [trExample, usExample] : null };
}

export function verifyMoney(units, column, { grouped = false } = {}) {
  const header = moneyHeader(column);
  const reader = moneyReader(units, column);
  if (reader.conflict) return { ok: false, reason: `sayılar iki farklı yazımla girilmiş (ör. ${examples(reader.conflict)}); ayraçlar karışık olduğundan toplam kesin hesaplanamaz`, examples: reader.conflict };
  let empty = 0;
  let totals = 0;
  const text = [];
  const unclear = [];
  const conflicts = [];
  const amounts = [];
  for (const unit of units) {
    const cells = unit.map(row => ({ row, ...reader.read(row) }));
    if (unit.some(row => isTotalRow(row, column))) {
      if (cells.some(item => item.type === "amount")) totals += 1;
      continue;
    }
    const found = cells.filter(item => item.type === "amount");
    const distinct = new Set(found.map(item => item.value));
    if (distinct.size > 1) conflicts.push(`${unit[0].__hofKey || ""}: ${found.map(item => item.text).join(" / ")}`);
    else if (found.length) amounts.push(found[0]);
    else if (cells.some(item => item.type === "unclear")) unclear.push(cells.find(item => item.type === "unclear").text);
    else if (cells.some(item => item.type === "text")) text.push(cells.find(item => item.type === "text").text);
    else empty += 1;
  }
  if (conflicts.length) return { ok: false, reason: `aynı kaydın satırlarında farklı tutarlar var (ör. ${examples(conflicts)}); kayıt başına mı satır başına mı toplanacağı kesin değil`, examples: exampleList(conflicts) };
  // Etiketsiz toplam satırı: tutarı diğer bütün tutarların toplamına eşit olan satır.
  let sum = amounts.reduce((total, item) => total + item.value, 0);
  if (amounts.length >= 4) {
    const index = amounts.findIndex(item => item.value !== 0 && Math.abs(2 * item.value - sum) <= Math.max(0.01, Math.abs(sum) * 1e-9));
    if (index >= 0) {
      sum -= amounts[index].value;
      amounts.splice(index, 1);
      totals += 1;
    }
  }
  const count = amounts.length;
  const filled = count + totals + text.length + unclear.length;
  if (count < 3) return { ok: false, reason: `yalnızca ${n(count)} kayıtta tutar var; toplam için az` };
  const currencies = new Map();
  for (const item of amounts) if (item.currency) currencies.set(item.currency, (currencies.get(item.currency) || 0) + 1);
  const marked = [...currencies.values()].reduce((total, value) => total + value, 0);
  const cents = amounts.filter(item => item.cents).length;
  const evidence = header.strong || (!header.unit && (header.weak ? Boolean(marked || header.currency || cents >= count * 0.5) : Boolean(marked >= count * 0.3 || header.currency)));
  if (!evidence) {
    return { ok: false, reason: header.unit ? "kolon adı bir birim bildiriyor (gün, adet, sayı, oran…); değerler para olmayabilir" : "kolon adı ve hücreler para bildirmiyor (para birimi ya da tutar, bedel, ücret gibi bir başlık yok)" };
  }
  if (currencies.size > 1) return { ok: false, reason: `birden çok para birimi var (${[...currencies.keys()].map(code => CURRENCY_NAMES[code] || code).join(", ")}); farklı para birimleri toplanamaz` };
  const cellCurrency = currencies.size ? [...currencies.keys()][0] : null;
  if (cellCurrency && header.currency && cellCurrency !== header.currency) {
    return { ok: false, reason: `başlıktaki para birimi (${CURRENCY_NAMES[header.currency]}) ile hücrelerdeki (${CURRENCY_NAMES[cellCurrency]}) farklı` };
  }
  // Para birimi yalnızca bazı hücrelerde yazılıysa yazılı olmayanlar ancak başlık aynı para birimini söylüyorsa ya da
  // yazılı olan TL ise (ofisin kendi para birimi) aynı sayılır.
  const partial = Boolean(cellCurrency) && marked < count;
  if (partial && cellCurrency !== "TRY" && header.currency !== cellCurrency) {
    return { ok: false, reason: `bazı hücrelerde ${CURRENCY_NAMES[cellCurrency]} yazılı, diğerlerinde para birimi yazılı değil; farklı para birimleri karışmış olabilir` };
  }
  if (uncertain(unclear.length, filled)) {
    return { ok: false, reason: `${n(unclear.length)} hücrede tutar başka bilgiyle karışık ya da tutar değil (ör. ${examples(unclear)}); toplam kesin hesaplanamaz`, examples: exampleList(unclear) };
  }
  const currency = cellCurrency || header.currency || null;
  const explain = [`${q(column)} kolonundaki ${n(count)} tutar toplandı.`];
  if (grouped) explain.push(GROUPED_NOTE);
  explain.push(
    cellCurrency && !partial
      ? `Para birimi hücrelerde yazılı: ${CURRENCY_NAMES[cellCurrency]}.`
      : cellCurrency
        ? `Para birimi hücrelerin bir kısmında yazılı (${CURRENCY_NAMES[cellCurrency]}); yazılı olmayanlar da aynı para birimi sayıldı.`
        : header.currency
          ? `Para birimi kolon başlığından: ${CURRENCY_NAMES[header.currency]}.`
          : "Para birimi hücrelerde yazılı değil; toplam birimsiz gösterilir.",
  );
  if (reader.style === "us") explain.push("Sayılar İngilizce yazımla okundu (1,500.00 = bin beş yüz).");
  if (text.length) explain.push(`${n(text.length)} hücrede tutar yerine yazı var (ör. ${examples(text)}); toplama katılmadı.`);
  if (unclear.length) explain.push(`Kesin okunamayan ${n(unclear.length)} hücre (ör. ${examples(unclear)}) toplama katılmadı.`);
  if (totals) explain.push(`${n(totals)} “Toplam” satırı kayıt olmadığı için toplama katılmadı.`);
  if (empty) explain.push(`${n(empty)} kayıtta tutar boş.`);
  explain.push(`Denetim: dolu hücrelerin ${percentOf(filled - unclear.length, filled)} kesin okundu${currencies.size ? "; tek para birimi" : ""}.`);
  return { ok: true, card: { id: "money", column, sum: Math.round(sum * 100) / 100, count, currency, style: reader.style, text: text.length, unclear: unclear.length, totals, empty, explain } };
}

// ---------- Tarih (son tarih ve olay tarihi) ----------
// "03/15/2026" gibi ikinci sayısı 12'den büyük tarih, kolonun ay/gün (ABD) sırasıyla yazıldığını gösterir; o zaman
// "03/04/2026" gibi tarihler de ters okunur. Böyle kolon kesin değildir.
const MONTH_FIRST = /^\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/;
function dateUnit(unit, column) {
  const cells = unit.map(row => ({ row, reading: readCell(cell(row, column)) }));
  const dates = cells.filter(item => item.reading.kind === "date");
  const distinct = new Set(dates.map(item => item.reading.date.getTime()));
  if (distinct.size > 1) return { type: "conflict", text: dates.map(item => item.reading.text).join(" / ") };
  if (dates.length) return { type: "date", date: dates[0].reading.date, text: dates[0].reading.text, row: dates[0].row };
  const odd = cells.find(item => !["empty", "label", "text"].includes(item.reading.kind));
  if (odd) return { type: "unclear", text: odd.reading.text };
  const note = cells.find(item => item.reading.kind === "label" || item.reading.kind === "text");
  return note ? { type: "note", text: note.reading.text } : { type: "empty" };
}

export function verifyDates(units, item, now, mode, { grouped = false } = {}) {
  const column = item.column;
  const today = dayStart(now);
  const counts = { today: 0, next7: 0, next30: 0, passed: 0, thisMonth: 0 };
  let dated = 0;
  let empty = 0;
  let monthFirst = "";
  const notes = [];
  const unclear = [];
  const conflicts = [];
  for (const unit of units) {
    for (const row of unit) {
      const match = MONTH_FIRST.exec(String(cell(row, column) ?? ""));
      if (match && Number(match[1]) <= 12 && Number(match[2]) > 12) monthFirst ||= match[0].trim();
    }
    const value = dateUnit(unit, column);
    if (value.type === "empty") empty += 1;
    else if (value.type === "conflict") conflicts.push(`${unit[0].__hofKey || ""}: ${value.text}`);
    else if (value.type === "date") {
      dated += 1;
      const days = Math.round((value.date.getTime() - today) / DAY);
      if (days === 0) counts.today += 1;
      if (days >= 0 && days <= 7) counts.next7 += 1;
      if (days >= 0 && days <= 30) counts.next30 += 1;
      if (days < 0) counts.passed += 1;
      if (value.date.getUTCFullYear() === now.getFullYear() && value.date.getUTCMonth() === now.getMonth()) counts.thisMonth += 1;
    } else if (value.type === "note") notes.push(value.text);
    else unclear.push(value.text);
  }
  if (monthFirst) return { ok: false, reason: `tarihler ay/gün sırasıyla yazılmış olabilir (ör. ${q(monthFirst)}); gün ve ay karışabileceği için kesin değil`, examples: [monthFirst] };
  if (conflicts.length) return { ok: false, reason: `aynı kaydın satırlarında farklı tarihler var (ör. ${examples(conflicts)})`, examples: exampleList(conflicts) };
  const filled = dated + notes.length + unclear.length;
  if (dated < 3) return { ok: false, reason: `yalnızca ${n(dated)} kayıtta tarih var; özet için az` };
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
  if (grouped) explain.push(GROUPED_NOTE);
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
function labelUnit(unit, column) {
  const values = unit.map(row => cell(row, column)).filter(value => !isEmptyCell(value)).map(value => String(value).trim());
  if (!values.length) return { type: "empty" };
  if (new Set(values.map(labelKey)).size > 1) return { type: "conflict", text: values.join(" / ") };
  return { type: "value", value: values[0] };
}
export function verifyVocabulary(units, column, mode, { grouped = false } = {}) {
  const values = [];
  const conflicts = [];
  let empty = 0;
  for (const unit of units) {
    const value = labelUnit(unit, column);
    if (value.type === "empty") empty += 1;
    else if (value.type === "conflict") conflicts.push(`${unit[0].__hofKey || ""}: ${value.text}`);
    else values.push(value.value);
  }
  if (conflicts.length) return { ok: false, reason: `aynı kaydın satırlarında farklı değerler var (ör. ${examples(conflicts)})`, examples: exampleList(conflicts) };
  const verdict = assessVocabulary(values, VOCABULARY_OPTIONS[mode]);
  if (!verdict.ok) return { ok: false, reason: verdict.reason, examples: verdict.examples || [] };
  const labels = verdict.labels.map(({ value, key, count }) => ({ value, key, count }));
  const explain = [
    mode === "responsible"
      ? `${q(column)} kolonunda ${n(labels.length)} kişi var; her kişinin kayıt sayısı sayıldı.`
      : `${q(column)} kolonu ${n(labels.length)} sabit seçenekten oluşuyor: ${labels.slice(0, 8).map(label => label.value).join(", ")}${labels.length > 8 ? "…" : ""}.`,
    `Denetimler: ${mode === "responsible" ? "adlar birbirini içermiyor ve aralarında yazım farkı yok" : "seçenekler birbirini içermiyor, aynı kökten türememiş, aralarında yazım farkı yok"}; dolu hücrelerin ${percentOf(verdict.filled - verdict.other, verdict.filled)} bu ${mode === "responsible" ? "adlardan" : "seçeneklerden"} biri. Büyük/küçük harf ve Türkçe karakter farkı aynı değer sayıldı.`,
  ];
  if (grouped) explain.push(GROUPED_NOTE);
  if (verdict.other) explain.push(`${n(verdict.other)} hücre ${mode === "responsible" ? "bir kişi adı değil" : "seçeneklerin dışında"} (ör. ${examples(verdict.otherExamples)}); dağılıma katılmadı.`);
  if (empty) explain.push(`${n(empty)} kayıtta boş.`);
  return { ok: true, card: { id: mode, column, labels, people: mode === "responsible" ? labels.length : undefined, other: verdict.other, empty, filled: verdict.filled, explain } };
}

// ---------- Kapsamın kartları ----------
// Öncelik: tutar, son tarih, durum, sorumlu, tür, olay tarihi. Arayüz ilk ikisini gösterir; rapor hepsini.
const PRIORITY = ["money", "deadline", "status", "responsible", "category", "event"];
export function buildCards(rows, analyses, { now = new Date() } = {}) {
  const { units, grouped } = recordUnits(rows);
  const options = { grouped };
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
  attempt("money", pool.money, item => verifyMoney(units, item.column, options));
  attempt("deadline", pool.deadline, item => verifyDates(units, item, now, "deadline", options));
  attempt("event", pool.event, item => verifyDates(units, item, now, "event", options));
  attempt("status", pool.status, item => verifyVocabulary(units, item.column, "status", options));
  attempt("responsible", pool.responsible, item => verifyVocabulary(units, item.column, "responsible", options));
  attempt("category", pool.category, item => verifyVocabulary(units, item.column, "category", options));
  const cards = PRIORITY.filter(id => found.has(id)).map(id => found.get(id));
  // Kenar çubuğundaki "Bu ay": doğrulanmış son tarih, yoksa doğrulanmış olay tarihi.
  const monthCard = found.get("deadline") || found.get("event") || null;
  const month = monthCard ? { column: monthCard.column, count: monthCard.thisMonth, card: monthCard.id } : null;
  return { cards, rejected, month, records: units.length, grouped };
}

// ---------- Kart listeleri ----------
// Kartın sayısıyla aynı okuma ve aynı kural (kayıt başına): listedeki toplam, karttaki sayıdır.
export function cardItems(rows, card, { list, value = "", now = new Date(), title }) {
  const items = [];
  if (!card) return items;
  const column = card.column;
  const today = dayStart(now);
  const { units } = recordUnits(rows);
  const tabOf = row => String(row.__sheet || "");
  const keyOf = row => String(row.__hofKey || "");
  const byTitle = (a, b) => a.title.localeCompare(b.title, "tr");
  if (list === "upcoming" || list === "passed" || list === "month" || list === "eventMonth") {
    for (const unit of units) {
      const found = dateUnit(unit, column);
      if (found.type !== "date") continue;
      const row = found.row;
      const days = Math.round((found.date.getTime() - today) / DAY);
      if (list === "upcoming" && days >= 0 && days <= 30) items.push({ key: keyOf(row), title: title(row), date: found.text, days, tab: tabOf(row) });
      else if (list === "passed" && days < 0) items.push({ key: keyOf(row), title: title(row), date: found.text, days, tab: tabOf(row) });
      else if ((list === "month" || list === "eventMonth") && found.date.getUTCFullYear() === now.getFullYear() && found.date.getUTCMonth() === now.getMonth()) {
        items.push({ key: keyOf(row), title: title(row), date: found.text, day: found.date.getUTCDate(), tab: tabOf(row) });
      }
    }
    if (list === "upcoming") items.sort((a, b) => a.days - b.days || byTitle(a, b));
    else if (list === "passed") items.sort((a, b) => b.days - a.days || byTitle(a, b));
    else items.sort((a, b) => a.day - b.day || byTitle(a, b));
  } else if (list === "topAmount") {
    const reader = moneyReader(units, column);
    for (const unit of units) {
      if (unit.some(row => isTotalRow(row, column))) continue;
      const found = unit.map(row => ({ row, ...reader.read(row) })).find(item => item.type === "amount");
      if (!found || found.value <= 0) continue;
      items.push({ key: keyOf(found.row), title: title(found.row), amount: found.value, tab: tabOf(found.row) });
    }
    // Etiketsiz toplam satırı (diğer bütün tutarların toplamına eşit) listede de gösterilmez.
    const sum = items.reduce((total, item) => total + item.amount, 0);
    const total = items.length >= 4 ? items.findIndex(item => Math.abs(2 * item.amount - sum) <= Math.max(0.01, sum * 1e-9)) : -1;
    if (total >= 0) items.splice(total, 1);
    items.sort((a, b) => b.amount - a.amount || byTitle(a, b));
  } else if (list === "value") {
    const wanted = labelKey(value);
    for (const unit of units) {
      const found = labelUnit(unit, column);
      if (found.type !== "value" || labelKey(found.value) !== wanted) continue;
      items.push({ key: keyOf(unit[0]), title: title(unit[0]), value: found.value, tab: tabOf(unit[0]) });
    }
    items.sort(byTitle);
  }
  return items;
}
