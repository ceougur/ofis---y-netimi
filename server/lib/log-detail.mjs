// Kayıt ayrıntısı (Mutabakat Günlüğü integrity_log.detail_json ve benzeri) için SINIRLI ve HER ZAMAN GEÇERLİ JSON (2.5.0 Ç2 tur 3; docs/erp/C2-FIS-DEFTERI-TASARIM.md §11d).
//
// Neden: `JSON.stringify(x).slice(0, 20000)` uzun listede metni ORTASINDAN keser; kalan metin geçersiz JSON'dur ve günlüğü ayrıştıran Mutabakat Testi (routes/ledger.mjs) HTTP 500
// verir — 475+ fiş birlikte kaldırılınca (fiş defteri onarımı) ya da 600 işlem başlığı iptal edilince (banka açılış onarımı) defter / mutabakat sessizce görünmez oluyordu.
// Kural: ayrıntı hiçbir zaman kesilmiş JSON olmaz.
//   - Listeler ilk `maxList` öğeyle sınırlanır: diziler ve kök dışındaki düz nesnelerden ANAHTARI ÇOK olanlar (eşlem, ör. { fiş kimliği: neden }). TAM SAYILARI çağıran yanına
//     yazar (ör. removedCount, keptCount). Kökün alanları ve az anahtarlı kayıt nesneleri (≤ 16 anahtar: { code, name, count, sample } gibi) kısaltılmaz.
//   - Sonuç `maxChars`'ı aşarsa diziler yarıya, dörtte bire… (en az 1 öğe) kısaltılır; o da yetmezse metinler kısaltılır; sonra diziler boşaltılır; en son yalnız kökün sayıları kalır.
// Hız (ders 47): liste JSON.stringify'ın değiştiricisinde bir kez kesilir; kesilen öğeler hiç dolaşılmaz (öğe başına stringify döngüsü yok). Her deneme çıktının boyuyla
// orantılı; deneme sayısı en uzun listenin logaritmasıyla sınırlı.
// Eşdeğerlik: maxList Infinity verilirse ve JSON.stringify(value) zaten maxChars içindeyse çıktı JSON.stringify(value) ile BAYT BAYT aynıdır (değiştirici her değeri olduğu
// gibi döndürür) — integrity.mjs'in günlük yazımı ve "taban değişti mi" karşılaştırması bu yüzden eski kayıtlarla aynı kalır.
const MIN_CHARS = 64;
// Bu kadar ya da daha az anahtarlı nesne liste (eşlem) değil kayıttır: kısaltılmaz.
const RECORD_KEYS = 16;

const isPlainObject = item => {
  if (item === null || typeof item !== "object" || Array.isArray(item)) return false;
  const proto = Object.getPrototypeOf(item);
  return proto === Object.prototype || proto === null;
};

/**
 * @param {unknown} value kayda yazılacak değer
 * @param {{ maxList?: number, maxChars?: number }} [options] maxList: listelerin ilk kaç öğesi (Infinity: sınırsız, yalnız boyut aşılınca kısaltılır); maxChars: en çok karakter
 * @returns {string} geçerli JSON (uzunluğu ≤ max(maxChars, 64))
 */
export function boundedDetail(value, { maxList = 50, maxChars = 20_000 } = {}) {
  const cap = Math.max(MIN_CHARS, Math.floor(Number(maxChars)) || 0);
  let widest = 0;
  const render = (limit, textLimit) => {
    const keyLimit = Math.max(limit, RECORD_KEYS);
    let root = true;
    const text = JSON.stringify(value, (key, item) => {
      const atRoot = root;
      root = false;
      if (Array.isArray(item)) {
        if (item.length > widest) widest = item.length;
        return item.length > limit ? item.slice(0, limit) : item;
      }
      if (!atRoot && isPlainObject(item)) {
        const keys = Object.keys(item);
        if (keys.length <= RECORD_KEYS) return item;
        if (keys.length > widest) widest = keys.length;
        return keys.length > keyLimit ? Object.fromEntries(keys.slice(0, keyLimit).map(name => [name, item[name]])) : item;
      }
      if (typeof item === "string" && item.length > textLimit) return item.slice(0, textLimit);
      return item;
    });
    return text === undefined ? "null" : text;
  };
  let limit = maxList === Infinity ? Infinity : Math.max(0, Math.floor(Number(maxList)) || 0);
  let text = render(limit, Infinity);
  while (text.length > cap && limit > 1) {
    limit = Math.max(1, Math.floor(Math.min(limit, widest) / 2));
    text = render(limit, Infinity);
  }
  for (let textLimit = 1024; text.length > cap && textLimit >= 4; textLimit = Math.floor(textLimit / 4)) text = render(limit, textLimit);
  if (text.length > cap) text = render(0, 4);
  if (text.length <= cap) return text;
  // Son çare: kökün yalnız sayı alanları (ör. removedCount); o da sığmazsa boş kayıt.
  const numbers = isPlainObject(value) ? Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === "number" && Number.isFinite(item))) : null;
  const last = numbers ? JSON.stringify(numbers) : "";
  return last && last.length <= cap ? last : Array.isArray(value) ? "[]" : "{}";
}
