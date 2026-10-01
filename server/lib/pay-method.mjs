// Ödeme / tahsilat yolu (v2.0.13). Para hareketi nereden geçti: nakit Kasa, banka (havale/EFT) ya da kredi kartı (POS).
// Çek/senet kendi modülünde (portföy), açık hesap (veresiye) carinin defterindedir; bu ikisi para hareketi değildir.
// Kasa ve Banka ekranı bakiyeleri bu yola göre ayrı gösterir. Eksi bakiye denetimi her yol için ayrı ayarlanır
// (Yönetim → Sistem → Eksi Bakiye Denetimi: Kontrol Yok / Uyar / Engelle; varsayılan üçünde de Uyar).
export const METHODS = Object.freeze({ cash: "Nakit", bank: "Havale / EFT", card: "Kredi Kartı" });
export const methodOf = (value, fallback = "cash") => (Object.hasOwn(METHODS, String(value || "")) ? String(value) : fallback);
export const methodLabel = value => METHODS[value] || METHODS.cash;

// Eksi bakiye denetimi (v2.0.13): Logo/Netsis'teki "kasa/banka eksi bakiye kontrolü" parametresinin karşılığı.
//   off   — denetim yok (ör. kredili mevduat hesabı)
//   warn  — sorulur; kullanıcı "Yine de Kaydet" derse yazılır (cashForce)
//   block — yazılmaz; onayla da geçilemez
export const NEGATIVE_KEY = "cash.negativePolicy";
export const NEGATIVE_POLICIES = Object.freeze(["off", "warn", "block"]);
export const NEGATIVE_DEFAULT = Object.freeze({ cash: "warn", bank: "warn", card: "warn" });
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
  for (const method of Object.keys(METHODS)) if (NEGATIVE_POLICIES.includes(value?.[method])) out[method] = value[method];
  return out;
}
