// Stok birimleri (v2.0.11): tek yazım — ilk harf büyük, kısaltmalar dahil ("Adet", "Kg", "M²"; kullanıcı kararı
// 30.09.2026). Eski kayıtlardaki "adet" ile yeni "Adet" aynı birimdir; listede ve raporlarda tek biçimde görünür.
// Listede olmayan birim (ör. "palet") yazıldığı gibi kalır, yalnız ilk harfi büyütülür.
export const UNITS = Object.freeze(["Adet", "Paket", "Kutu", "Koli", "Çuval", "Şişe", "Bidon", "Teneke", "Kavanoz", "Top", "Rulo", "Düzine", "Çift", "Takım", "Set", "Kg", "Gr", "Ton", "Lt", "Ml", "M³", "Metre", "Cm", "M²", "Saat", "Gün", "Hafta", "Ay", "Seans", "Kişi", "Sefer"]);
export const DEFAULT_UNIT = "Adet";
const key = text => String(text ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
const KNOWN = new Map(UNITS.map(unit => [key(unit), unit]));
// Sık yazılan eş biçimler: "m2" → "M²", "kilo" → "Kg" gibi.
for (const [alias, unit] of [["m2", "M²"], ["m3", "M³"], ["kilo", "Kg"], ["kilogram", "Kg"], ["gram", "Gr"], ["litre", "Lt"], ["mililitre", "Ml"], ["santim", "Cm"], ["santimetre", "Cm"], ["mt", "Metre"], ["kg.", "Kg"], ["lt.", "Lt"], ["gr.", "Gr"]]) KNOWN.set(alias, unit);

export function unitLabel(value, fallback = DEFAULT_UNIT) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 20);
  if (!text) return fallback;
  const known = KNOWN.get(key(text));
  if (known) return known;
  return text.charAt(0).toLocaleUpperCase("tr-TR") + text.slice(1);
}
