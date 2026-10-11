import { HttpError } from "./http.mjs";

// Ödeme / tahsilat yolu (v2.0.13). Para hareketi nereden geçti: nakit Kasa, banka (havale/EFT) ya da kredi kartı (POS).
// Çek/senet kendi modülünde (portföy), açık hesap (veresiye) carinin defterindedir; bu ikisi para hareketi değildir.
// Kasa ve Banka ekranı bakiyeleri bu yola göre ayrı gösterir. Eksi bakiye denetimi her yol için ayrı ayarlanır
// (Yönetim → Sistem → Eksi Bakiye Denetimi: Kontrol Yok / Uyar / Engelle; varsayılan üçünde de Uyar).
// v2.0.16 (müşteri): kart yolunun adı yöne göre — tahsilatta (para girişi) "POS", bizim ödememizde "Kredi Kartı";
// yönsüz yerde (Kasa sekmesi, ayar) "POS / Kredi Kartı". Kayıtlı değer `card` değişmez.
export const METHODS = Object.freeze({ cash: "Nakit", bank: "Havale / EFT", card: "POS / Kredi Kartı" });
export const METHODS_IN = Object.freeze({ ...METHODS, card: "POS" });
export const METHODS_OUT = Object.freeze({ ...METHODS, card: "Kredi Kartı" });
export const methodsFor = direction => (direction === "in" ? METHODS_IN : direction === "out" ? METHODS_OUT : METHODS);
export const methodOf = (value, fallback = "cash") => (Object.hasOwn(METHODS, String(value || "")) ? String(value) : fallback);
// v2.0.22 (Excel denetimi bulgusu): kullanıcıdan/API'den gelen yol. Hiç gönderilmezse (undefined, null, "") varsayılan
// (geriye uyum); gönderilip tanımsızsa ("bitcoin", "Nakit" etiketi…) 400 — sessizce nakit sayılmaz. methodOf yalnız
// veri tabanından okunan kayıtlar içindir.
export function methodInput(value, fallback = "cash") {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const key = String(value).trim();
  if (Object.hasOwn(METHODS, key)) return key;
  throw new HttpError(400, `Ödeme yolu tanınmadı (${key.slice(0, 40)}). Nakit, Havale / EFT ya da POS / Kredi Kartı seçin.`, { code: "pay-method-invalid", field: "method" });
}
export const methodLabel = (value, direction = "") => methodsFor(direction)[value] || METHODS.cash;

// Eksi bakiye denetimi (v2.0.13): Logo/Netsis'teki "kasa/banka eksi bakiye kontrolü" parametresinin karşılığı.
//   off   — denetim yok (ör. kredili mevduat hesabı)
//   warn  — sorulur; kullanıcı "Yine de Kaydet" derse yazılır (cashForce)
//   block — yazılmaz; onayla da geçilemez
// v2.0.17 (müşteri): Banka modülü gelene kadar denetim YALNIZ Nakit Kasa için. Banka ve POS "bakiyesi" programa girilen
// havale/POS hareketlerinden türetilen bir sayıdır (açılış bakiyesi, ekstre, mevduat yok) — eksi uyarısı yanıltıyordu.
// Kayıtlı bank/card ayarı okunmaz; her zaman "off" döner. Banka modülü (hesaplar + açılış bakiyesi) gelince açılır.
export const NEGATIVE_KEY = "cash.negativePolicy";
export const NEGATIVE_POLICIES = Object.freeze(["off", "warn", "block"]);
export const NEGATIVE_DEFAULT = Object.freeze({ cash: "warn", bank: "off", card: "off" });
// Denetlenen yollar: yalnız nakit. (Banka modülüyle birlikte ["cash", "bank", "card"] olur.)
export const NEGATIVE_GUARDED = Object.freeze(["cash"]);
export function readNegativePolicy(raw) {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw || "{}");
    } catch {
      value = {};
    }
  }
  const out = { ...NEGATIVE_DEFAULT };
  for (const method of NEGATIVE_GUARDED) if (NEGATIVE_POLICIES.includes(value?.[method])) out[method] = value[method];
  return out;
}

// v2.0.17: Kasa penceresi yalnız nakit akışını gösterir; havale/EFT, POS ve kredi kartı "banka tarafı"dır
// (Raporlar → Banka ve POS Hareketleri). Yol süzgeci: tek yol, "noncash" (banka + kart) ya da "" (hepsi).
export const NONCASH_METHODS = Object.freeze(["bank", "card"]);
export function methodFilter(value) {
  const key = String(value || "");
  if (key === "noncash") return new Set(NONCASH_METHODS);
  if (Object.hasOwn(METHODS, key)) return new Set([key]);
  return null;
}
