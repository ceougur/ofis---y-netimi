// 2.5.0 Ç7b tur 2c — KURAL GEÇİŞ GÜNÜ (docs/erp/C7B-FATURA-TASARIM.md §13; BAŞ MİMAR KARARI 19.11 04:35 B-6 ve 05:07 B-8 = A).
//
// Alt defter hesabına dokunan üç Ç7b kuralının YENİ yönü yalnız geçiş gününden SONRAKİ kayıtlara uygulanır:
//   KG-3  kayıt (dosya) tahsilatı      eski: A 602         yeni: A 336.90
//   KG-8  satıştan iade faturasının KDV'si  eski: B 391    yeni: B 191
//   F-08  alıştan iade faturasının KDV'si   eski: A 191    yeni: A 391
// Geçiş günü = güncellemedeki (göç 51) dönem kilidinin tarihi; kilitsiz dosyada geçiş yok (hepsi yeni kural). Geçiş gününde ve öncesinde (≤) tarihli kayıt eski yönde kalır — kilit
// sonradan açılıp kapansa da (tek tanım). B-6: KG-8 / F-08'de ayrıca güncellemeden ÖNCE yazılmış ve ters kaydedilmemiş KDV mahsubunun ayı eski yönde; mahsup ters kaydedilince o ay
// yeni yöne geçer (yeniden yazılan mahsup yeni yönle hesaplanır). Saklı tutar DEĞİŞMEZ (göç yalnız işaret yazar).
//
// TEK TANIM: türetme (lib/general-ledger.mjs journal, routes/ledger.mjs rows → ruleShift), Defter Mutabakatı'nın beklenen değeri (routes/ledger.mjs expected), süzgeç
// (lib/integrity-scope.mjs fatura bölümü) ve KDV mahsubunun ön izlemesi / Güncel Değil denetimi (routes/tax.mjs — build() üzerinden) bu dosyayı okur.

/** Geçiş gününün ayarı (göç 51 yazar; '' = geçiş yok). */
export const RULE_SHIFT_KEY = "ledger.ruleShiftThrough";
/** Güncellemeden önce yazılmış KDV mahsubunun kural sürümü (vat_offsets.rule_version; '' = güncel kural). */
export const OLD_VAT_RULE = "2.4.9";

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Geçiş yok (girdi verilmeyen çağıran, kilitsiz dosya): üç kural da yeni yönde. */
export const NO_SHIFT = Object.freeze({ through: "", oldVatMonths: Object.freeze(new Set()) });

/** Ham değerlerden geçiş nesnesi (biçim dışı değer yok sayılır). */
export function ruleShift({ through = "", oldVatMonths = [] } = {}) {
  const day = DAY.test(String(through || "")) ? String(through) : "";
  const months = new Set([...(oldVatMonths || [])].map(String).filter(month => MONTH.test(month)));
  if (!day && !months.size) return NO_SHIFT;
  return Object.freeze({ through: day, oldVatMonths: Object.freeze(months) });
}

/** Veri dosyasının geçiş işaretleri (iki küçük sorgu: ayarın birincil anahtarı + mahsup tablosu — ayda bir satır). */
export function ruleShiftOf(store) {
  const table = name => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", name));
  let through = "";
  if (table("settings")) through = String(store.get("SELECT value FROM settings WHERE key = ?", RULE_SHIFT_KEY)?.value || "");
  let months = [];
  if (table("vat_offsets") && store.all("PRAGMA table_info(vat_offsets)").some(column => column.name === "rule_version")) {
    months = store.all("SELECT DISTINCT month FROM vat_offsets WHERE status = 'active' AND rule_version = ?", OLD_VAT_RULE).map(row => row.month);
  }
  return ruleShift({ through, oldVatMonths: months });
}

/** KG-3: kayıt tahsilatı eski yönde mi (A 602)? */
export function oldCollection(shift, date) {
  const through = shift?.through || "";
  return Boolean(through) && String(date || "") <= through;
}

/** KG-8 / F-08: iade faturasının KDV'si eski yönde mi (satıştan iade B 391, alıştan iade A 191)? */
export function oldReturnVat(shift, date) {
  if (oldCollection(shift, date)) return true;
  const months = shift?.oldVatMonths;
  return Boolean(months?.size) && months.has(String(date || "").slice(0, 7));
}

const quote = value => `'${value}'`;
/** SQL karşılığı (beklenen ve süzgeç): `column` tarih sütunu (YYYY-AA-GG metni). Değerler biçimle doğrulanmıştır (ruleShift). */
export function oldCollectionSql(shift, column) {
  const through = DAY.test(shift?.through || "") ? shift.through : "";
  return through ? `(COALESCE(${column}, '') <= ${quote(through)})` : "0";
}
export function oldReturnVatSql(shift, column) {
  const months = [...(shift?.oldVatMonths || [])].filter(month => MONTH.test(month));
  const parts = [];
  const byDay = oldCollectionSql(shift, column);
  if (byDay !== "0") parts.push(byDay);
  if (months.length) parts.push(`(substr(COALESCE(${column}, ''), 1, 7) IN (${months.map(quote).join(", ")}))`);
  return parts.length ? `(${parts.join(" OR ")})` : "0";
}
