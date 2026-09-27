// Türkçe tutar ayrıştırma: "1.250,50", "1.250", "1250.5", "₺ 3.000", "40.000 TL" → sayı.
// Virgül varsa ondalık ayraçtır (noktalar binlik); virgül yoksa yalnızca 3'lü gruplardan oluşan noktalar binliktir
// ("1.250" = 1250, "12.500.000" = 12500000), diğer tek nokta ondalıktır ("1250.5").
export function parseAmount(value) {
  if (typeof value === "number") return value;
  let raw = String(value ?? "").trim().replace(/[₺$€\s]|tl|try/gi, "");
  if (!raw) return Number.NaN;
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, "");
  return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : Number.NaN;
}

export const roundMoney = value => Math.round(value * 100) / 100;
