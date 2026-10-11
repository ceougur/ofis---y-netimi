// İş günü servisi (v2.1.0, banka modülü; docs/BANKA-MODULU-PLAN.md §4.5). Saf: veritabanı ve saat kullanmaz, ülke bilmez
// (Türkiye tatilleri server/lib/calendars/tr.mjs'te). POS valörü, taksitli POS ödeme takvimi, planlı işlemler ve banka işlem
// tarihlerinin ötelemesi buradan hesaplanır.
//
//   createCalendar({ weekend: [6, 0], holidays, halfDayIsBusiness, added, removed, coverage })
//     · weekend           : hafta sonu günleri (0 = Pazar … 6 = Cumartesi). Varsayılan Cumartesi–Pazar.
//     · holidays          : yıl → [{ date: "YYYY-AA-GG", name, half }] işlevi ya da liste. half: yarım gün (arife).
//     · halfDayIsBusiness : yarım gün iş günü sayılır mı (varsayılan evet; bankalar arifede öğleden önce açıktır).
//     · added / removed   : şirketin eklediği (ör. idari izin) ya da çıkardığı günler (bank_holidays).
//     · coverage          : { from, to } — tatil tablosunun kapsadığı yıllar (dini bayramlar yıl tablosundan gelir).
//   Tarihler "YYYY-AA-GG" metnidir; geçersiz tarih RangeError (sessizce düzeltilmez). Öteleme kuralları ISDA adlarıyla:
//   following (sonraki iş günü), modified_following (sonraki; ay dışına taşarsa önceki), preceding (önceki), none.
const pad = value => String(value).padStart(2, "0");
const DAY = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
export const WEEKDAY_NAMES = Object.freeze(["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"]);
export const ADJUST_RULES = Object.freeze(["following", "modified_following", "preceding", "none"]);
export const VALUE_RULES = Object.freeze(["business", "calendar", "month"]);
/** Bir aramada en çok bu kadar gün ileri/geri gidilir (hiç iş günü olmayan takvimde sonsuz döngü yerine hata). */
const MAX_SCAN_DAYS = 370;
/** Tek seferde eklenebilecek en çok iş günü / ay. */
const MAX_STEPS = 3660;

function parts(iso) {
  const match = typeof iso === "string" ? ISO.exec(iso) : null;
  if (!match) throw new RangeError(`Geçersiz tarih: ${String(iso).slice(0, 20)} (YYYY-AA-GG bekleniyor).`);
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw new RangeError(`Takvimde olmayan gün: ${iso}.`);
  return { y, m, d, ms: date.getTime() };
}
/** Geçerli "YYYY-AA-GG" mi? */
export const isIsoDay = value => {
  try {
    parts(value);
    return true;
  } catch {
    return false;
  }
};
const fromMs = ms => {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};
export const dayText = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const shortText = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const integer = (value, label) => {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_STEPS) throw new RangeError(`${label} en çok ${MAX_STEPS} olan bir tamsayı olmalı (${value}).`);
  return value;
};
/** Takvim günü ekler (eksi olabilir). */
export function addCalendarDays(iso, days) {
  return fromMs(parts(iso).ms + integer(days, "Gün sayısı") * DAY);
}
/** n ay sonra aynı gün; ay kısaysa ayın son günü (31.01 → 28/29.02, 31.01 + 2 ay → 31.03). Taksit motorundaki addMonths ile aynı. */
export function addMonths(iso, months) {
  const { y, m, d } = parts(iso);
  integer(months, "Ay sayısı");
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(d, lastDay))}`;
}

/**
 * @param {{ weekend?: number[], holidays?: ((year: number) => Array<{date: string, name: string, half?: boolean}>) | Array<{date: string, name: string, half?: boolean}>,
 *   halfDayIsBusiness?: boolean, added?: Array<{date: string, name?: string, half?: boolean}>, removed?: string[], coverage?: {from: number, to: number} | null }} options
 */
export function createCalendar({ weekend = [6, 0], holidays = [], halfDayIsBusiness = true, added = [], removed = [], coverage = null } = {}) {
  if (!Array.isArray(weekend) || weekend.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new RangeError("Hafta sonu günleri 0 (Pazar) – 6 (Cumartesi) olmalı.");
  const weekendSet = new Set(weekend);
  if (weekendSet.size >= 7) throw new RangeError("Haftanın her günü hafta sonu olamaz.");
  const addedMap = new Map();
  for (const item of added || []) {
    parts(item?.date);
    addedMap.set(item.date, { name: String(item.name || "Şirket Tatili"), half: Boolean(item.half) });
  }
  const removedSet = new Set((removed || []).map(date => (parts(date), date)));
  const fixedList = Array.isArray(holidays) ? holidays : null;
  for (const item of fixedList || []) parts(item?.date);
  const yearCache = new Map();
  // Yılın tatilleri: aynı güne düşen iki tatil tek kayıtta birleşir (adlar "; " ile); biri tam günse gün tam tatildir.
  function holidaysOf(year) {
    if (yearCache.has(year)) return yearCache.get(year);
    const raw = fixedList ? fixedList.filter(item => item.date.startsWith(`${year}-`)) : typeof holidays === "function" ? holidays(year) || [] : [];
    const byDate = new Map();
    for (const item of raw) {
      parts(item.date);
      const current = byDate.get(item.date);
      if (!current) byDate.set(item.date, { date: item.date, name: item.name, half: Boolean(item.half) });
      else byDate.set(item.date, { date: item.date, name: `${current.name}; ${item.name}`, half: current.half && Boolean(item.half) });
    }
    const list = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    yearCache.set(year, list);
    return list;
  }
  function holidayOn(iso) {
    if (removedSet.has(iso)) return null;
    if (addedMap.has(iso)) return { date: iso, ...addedMap.get(iso) };
    return holidaysOf(Number(iso.slice(0, 4))).find(item => item.date === iso) || null;
  }
  /** Günün türü: hafta sonu, tatil (tam/yarım), iş günü. */
  function dayInfo(iso) {
    const { ms } = parts(iso);
    const weekday = new Date(ms).getUTCDay();
    const isWeekend = weekendSet.has(weekday);
    const holiday = holidayOn(iso);
    const business = !isWeekend && (!holiday || (holiday.half && halfDayIsBusiness));
    return { date: iso, weekday, weekdayName: WEEKDAY_NAMES[weekday], weekend: isWeekend, holiday, business };
  }
  const isBusinessDay = iso => dayInfo(iso).business;
  function scan(iso, step) {
    let current = iso;
    for (let i = 0; i < MAX_SCAN_DAYS; i += 1) {
      current = fromMs(parts(current).ms + step * DAY);
      if (isBusinessDay(current)) return current;
    }
    throw new RangeError(`${dayText(iso)} tarihinden ${MAX_SCAN_DAYS} gün içinde iş günü bulunamadı; takvimi denetleyin.`);
  }
  /** İş günü değilse kurala göre öteler. */
  function adjust(iso, rule = "following") {
    if (!ADJUST_RULES.includes(rule)) throw new RangeError(`Bilinmeyen öteleme kuralı: ${rule}.`);
    if (rule === "none" || isBusinessDay(iso)) return (parts(iso), iso);
    if (rule === "preceding") return scan(iso, -1);
    const next = scan(iso, 1);
    if (rule === "modified_following" && next.slice(0, 7) !== iso.slice(0, 7)) return scan(iso, -1);
    return next;
  }
  /** n iş günü sonra (eksi: önce). Başlangıç günü sayılmaz; n = 0 ise gün iş günü değilse sonraki iş günü. */
  function addBusinessDays(iso, n) {
    parts(iso);
    integer(n, "İş günü sayısı");
    if (n === 0) return adjust(iso, "following");
    let current = iso;
    const step = n > 0 ? 1 : -1;
    for (let left = Math.abs(n); left > 0; left -= 1) current = scan(current, step);
    return current;
  }
  /**
   * Valör (para geçiş günü). rule: "business" (n iş günü), "calendar" (n takvim günü, sonra öteleme), "month" (n ay sonra aynı
   * gün, sonra öteleme; taksitli POS ödemesi her ay).
   */
  function valueDate(txn, rule = "business", days = 0, { adjust: adjustRule = "following" } = {}) {
    if (!VALUE_RULES.includes(rule)) throw new RangeError(`Bilinmeyen valör kuralı: ${rule}.`);
    if (rule === "business") return addBusinessDays(txn, days);
    if (rule === "calendar") return adjust(addCalendarDays(txn, days), adjustRule);
    return adjust(addMonths(txn, days), adjustRule);
  }
  /** "29.10.2026 Perşembe: Resmî Tatil (Cumhuriyet Bayramı)" */
  function explain(iso) {
    const info = dayInfo(iso);
    const head = `${dayText(iso)} ${info.weekdayName}`;
    if (info.holiday && !info.holiday.half && !info.weekend) return `${head}: Resmî Tatil (${info.holiday.name})`;
    if (info.weekend) return `${head}: Hafta Sonu${info.holiday ? ` (${info.holiday.name})` : ""}`;
    if (info.holiday?.half) return `${head}: Yarım Gün (${info.holiday.name}; ${halfDayIsBusiness ? "iş günü sayılır" : "iş günü sayılmaz"})`;
    return `${head}: İş Günü`;
  }
  /**
   * İşlem Kartı'ndaki valör açıklaması: "12.10.2026 (08.10 Perşembe + 2 iş günü)"; atlanan tatiller ve ötelenen gün nedeniyle.
   */
  function explainValue(txn, rule = "business", days = 0, options = {}) {
    const date = valueDate(txn, rule, days, options);
    const start = `${shortText(txn)} ${dayInfo(txn).weekdayName}`;
    const notes = [];
    if (rule === "business") {
      const from = txn < date ? txn : date;
      const to = txn < date ? date : txn;
      for (let current = addCalendarDays(from, 1); current < to; current = addCalendarDays(current, 1)) {
        const info = dayInfo(current);
        if (!info.weekend && info.holiday && !info.business) notes.push(`${dayText(current)} ${info.holiday.name} atlandı`);
      }
      return `${dayText(date)} (${start} ${days >= 0 ? "+" : "−"} ${Math.abs(days)} iş günü${notes.length ? `; ${notes.join("; ")}` : ""})`;
    }
    const raw = rule === "calendar" ? addCalendarDays(txn, days) : addMonths(txn, days);
    const unit = rule === "calendar" ? "gün" : "ay";
    if (raw !== date) {
      const info = dayInfo(raw);
      const why = info.weekend ? "Hafta Sonu" : info.holiday ? info.holiday.name : "tatil";
      notes.push(`${dayText(raw)} ${info.weekdayName} (${why}) → ${date > raw ? "sonraki" : "önceki"} iş günü`);
    }
    return `${dayText(date)} (${start} ${days >= 0 ? "+" : "−"} ${Math.abs(days)} ${unit}${notes.length ? `; ${notes.join("; ")}` : ""})`;
  }
  const covers = year => !coverage || (year >= coverage.from && year <= coverage.to);
  /** Tatil tablosunun son yılına girildi mi? (zil uyarısı: tabloyu güncelleyin) */
  const needsUpdate = today => Boolean(coverage) && parts(today).y >= coverage.to;
  return { dayInfo, isBusinessDay, adjust, addBusinessDays, addCalendarDays, addMonths, valueDate, explain, explainValue, holidaysOf, covers, needsUpdate, coverage, halfDayIsBusiness, weekend: [...weekendSet] };
}
