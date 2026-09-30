// Ödeme / tahsilat yolu (v2.0.13). Para hareketi nereden geçti: nakit Kasa, banka (havale/EFT) ya da kredi kartı (POS).
// Çek/senet kendi modülünde (portföy), açık hesap (veresiye) carinin defterindedir; bu ikisi para hareketi değildir.
// Kasa ve Banka ekranı bakiyeleri bu yola göre ayrı gösterir; Kasa eksiye düşme denetimi yalnız nakitte yapılır.
export const METHODS = Object.freeze({ cash: "Nakit", bank: "Havale / EFT", card: "Kredi Kartı" });
export const methodOf = (value, fallback = "cash") => (Object.hasOwn(METHODS, String(value || "")) ? String(value) : fallback);
export const methodLabel = value => METHODS[value] || METHODS.cash;
