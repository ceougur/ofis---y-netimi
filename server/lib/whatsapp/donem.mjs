// WhatsApp toplu gönderiminde DÖNEM EŞLİĞİ — TEK YER (2.4.8 T2-1; bağımsız gözden geçirme r5). "Aynı dönem" kararını veren her kural buradan okur:
//   periodKeyOf → makine defterinin dönem anahtarı (lib/whatsapp/defter.mjs claims.period_key): R3 "Daha Önce Gönderildi" (plan §7a revizyonu R3) bunu karşılaştırır.
//   sentSinceOf → R3'ün zaman penceresi (anahtar aynı + gönderim bu andan sonra); boş = pencere yok.
//   queueKeysOf → çift başlatma "Zaten Kuyrukta" (plan §7a 9): bekleyen / gönderilmekte iş aynı anahtardaysa yeni toplu işte o cari elenir.
//
// KURAL (KULLANICI KARARI T2-1 = A, 31.10.2026 ~03:20 UTC "önerilerini yap"): aynı cari + aynı şablon + aynı dönem —
//   "Bu Ay" / "Geçen Ay": aynı TAKVİM AYI (dönemin başlangıç ayı aynıysa aynı dönem; bitiş günü — "Bu Ay"da bugün — fark etmez). SEÇİM ADI ANAHTARA GİRMEZ
//     (KULLANICI KARARI, 31.10.2026 ~05:25 UTC "a"; dar kontrol 3 ORTA-1): 31.10'da "Bu Ay" (01.10–31.10) ile 01.11'de "Geçen Ay" (01.10–31.10) AYNI dönem;
//     yarım ay "Bu Ay" (1–3 Kasım) ile Aralık'taki "Geçen Ay" (Kasım) de aynı dönem sayılır → uyarı çıkar, "Yine de Gönder" ile gider (kararın bilinen sonucu);
//   "Son 3 Ay" / "Tüm Hareketler": aynı seçim SON 7 GÜN içinde gönderilmişse aynı dönem (bitiş hep bugün; 7 günden eskisi yeni dönem sayılır);
//   özel tarih aralığı: başlangıç VE bitiş birebir aynı.
//   KULLANICI KARARI (31.10.2026 ~11:10 UTC "b"; ★ soru 4): özel aralığın tarihleri O GÜN hazır seçimin ("Geçen Ay" = önceki ayın 1'i–son günü; "Bu Ay" = ayın 1'i–bugün)
//     tarihleriyle BİREBİR aynıysa o hazır seçimle aynı dönem (R3 "Daha Önce Gönderildi" + "Zaten Kuyrukta"). "O gün" = özel aralığın kullanıldığı gün (gönderim /
//     toplu iş açılışı). Bunun için bir gönderimin ANAHTAR KÜMESİ vardır: kendi anahtarı + (özel aralık o günün hazır seçimine eşitse) "ay|YYYY-AA"; iki gönderim kümeleri
//     kesişiyorsa aynı dönem. Böylece aynı tarihli iki özel aralık (farklı günlerde de) yine aynı dönem kalır.
// Uyarı son gönderim tarihini gösterir, varsayılan "Bunları Çıkar" (R3; lib/whatsapp/queue.mjs plan + istemci). Ödeme hatırlatma: R3'te gönderim GÜNÜ (BAŞ MİMAR KARARI
// GRUP 5 ★5: aynı gün ikinci hatırlatma sorulur, ertesi gün serbest — değişmedi); "Zaten Kuyrukta"da gün yok (süren hatırlatma işi varken yenisi elenir).

import { waPresetRange } from "./alici.mjs";

const ROLLING_MS = 7 * 24 * 3_600_000; // "Son 3 Ay" / "Tüm Hareketler" için aynı-dönem penceresi

/** Ekstre dönemi { from, to, preset } → dönem anahtarı (gün bilgisinden bağımsız; "Bu Ay"/"Geçen Ay" yalnız takvim ayı YYYY-AA). */
function statementKey(period) {
  const preset = String(period?.preset || "");
  if (preset === "thisMonth" || preset === "lastMonth") return `ay|${String(period?.from || "").slice(0, 7)}`;
  if (preset === "last3" || preset === "all") return `secim|${preset}`;
  return `aralik|${period?.from || ""}|${period?.to || ""}`;
}

/**
 * İş Q1 (dar kontrol 10 DÜŞÜK-1; "KİME KAÇ KEZ" ilkesi 3 "şüphede aynı dönem"): "Tüm Hareketler"in iletideki dönemi KİŞİYE özeldir — "<ilk hareket> – <dönem sonu>"
 * (lib/whatsapp/queue.mjs periodText bu yardımcıdan okur: TEK KAYNAK). Dönüş: cari hareketlerinden dönem sonuna (dahil) kadar olan ilk satırın tarihi; yoksa "" (hareketsiz
 * ya da yalnız ileri tarihli hareket → kişiye özel eşlik yok). lines: cari ekstresinin satırları (cari kartının sırası) ya da yalnız tarihleri (dizgi dizisi).
 */
export function firstLineDateOf(period, lines) {
  const to = period?.to;
  for (const line of lines || []) {
    const date = typeof line === "string" ? line : line?.date;
    if (!to || date <= to) return date ? String(date) : "";
  }
  return "";
}

/**
 * İş R6 (dar kontrol 12; ilke 3; İş Q1 BAŞ MİMAR KARARI 8 GERİ ALINDI): "Tüm Hareketler"in dönem başı — iletideki dönem metni (queue.mjs periodText) ve kişiye özel
 * dönem anahtarı TEK yerden: ilk hareket, yoksa (hareketsiz ya da yalnız ileri tarihli hareketli cari) dönem sonu ("<o gün> – <o gün>").
 */
export function allPeriodStartOf(period, lines) {
  return firstLineDateOf(period, lines) || String(period?.to || "");
}

/**
 * Ekstre dönemi + gün → anahtar kümesi: [kendi anahtarı] ya da özel aralık o günün "Bu Ay" / "Geçen Ay" tarihlerine birebir eşitse [kendi anahtarı, "ay|YYYY-AA"].
 * first (İş Q1): yalnız "Tüm Hareketler"de kişinin ilk hareketi (firstLineDateOf) — kümeye "aralik|<ilk hareket>|<dönem sonu>" girer (iletideki tarihlerle birebir aynı
 * özel aralık aynı dönem; iki yön). Kişiye özel olduğundan çağıran KİŞİ BAŞINA hesaplar.
 */
function statementKeys(period, day, first = "") {
  const own = statementKey(period);
  if (own === "secim|all") return first && period?.to ? [own, `aralik|${first}|${period.to}`] : [own];
  // KULLANICI KARARI (31.10.2026, "KİME KAÇ KEZ" ilkesi, S1a): HAZIR seçimle ("Bu Ay" / "Geçen Ay") yapılan gönderimin o günkü (toplu işin açıldığı gün) TARİHLERİ de
  // kümeye girer → aynı tarihli özel aralıkla (hangi gün kullanılırsa kullanılsın) aynı dönem. S1b (özel aralık o günün hazır seçimine eşitse "ay|…") aşağıda, aynen.
  if (own.startsWith("ay|")) return period?.from && period?.to ? [own, `aralik|${period.from}|${period.to}`] : [own];
  // "KİME KAÇ KEZ" ilkesi (3) ile (İş L5): "Son 3 Ay" / "Tüm Hareketler" gönderiminin o günkü tarihleri de kümeye girer (birebir aynı tarihli özel aralık aynı dönem);
  // bu eşlikte de seçimin 7 gün penceresi geçerli (defter sentBefore / unsettled "rolling"; queue taşınan veri). "Tüm Hareketler"in başlangıcı boş → kişiye özel eşlik yukarıda
  // (İş Q1: ilk hareket – dönem sonu; aynı 7 gün penceresi).
  if (own.startsWith("secim|")) return period?.from && period?.to ? [own, `aralik|${period.from}|${period.to}`] : [own];
  if (!own.startsWith("aralik|") || !day) return [own];
  for (const preset of ["thisMonth", "lastMonth"]) {
    const range = waPresetRange(preset, day);
    if (range.from === period.from && range.to === period.to) return [own, `ay|${String(period.from).slice(0, 7)}`];
  }
  return [own];
}

/** Ekstre dönemi { from, to, preset } ya da hatırlatma; day: gönderim günü (YYYY-AA-GG). Defterde talebin KENDİ anahtarı (claims.period_key). */
export function periodKeyOf(kind, period, day = "") {
  return kind === "statement" ? statementKey(period) : `gun|${day}`;
}

/** R3 anahtar kümesi (ilk öğe periodKeyOf; ek öğeler ★ soru 4 eşliği — defterde claim_keys). day: o günün yerel tarihi (YYYY-AA-GG). */
export function periodKeysOf(kind, period, day = "", { first = "" } = {}) {
  return kind === "statement" ? statementKeys(period, day, first) : [`gun|${day}`];
}

/** R3 penceresi: "Son 3 Ay" / "Tüm Hareketler" yalnız son 7 günde gönderilmişse aynı dönem. Dönüş: ISO alt sınır ya da "" (pencere yok). */
/** İş L5: kendi anahtarı "Son 3 Ay" / "Tüm Hareketler" olan gönderim, istek hangi seçim olursa olsun, yalnız bu andan (son 7 gün) sonra kabul edildiyse eşleşir. */
export const rollingSinceOf = nowMs => new Date(nowMs - ROLLING_MS).toISOString();

export function sentSinceOf(kind, period, nowMs) {
  if (kind !== "statement") return "";
  return ["last3", "all"].includes(String(period?.preset || "")) ? new Date(nowMs - ROLLING_MS).toISOString() : "";
}

/** "Zaten Kuyrukta" anahtar kümesi (aynı cari + aynı şablon + kümeler kesişiyor → elenir). day: toplu işin açıldığı / yeni gönderimin yerel günü. */
export function queueKeysOf(kind, period, day = "", { first = "" } = {}) {
  return kind === "statement" ? statementKeys(period, day, first) : ["hatirlatma"];
}

/** İki anahtar kümesi kesişiyor mu (aynı dönem). */
export const sameKeys = (a, b) => a.some(key => b.includes(key));

/** ISO zaman → yerel gün (YYYY-AA-GG; sunucunun saat dilimi — config.now ile aynı). */
export function localDayOf(isoText) {
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) return "";
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
