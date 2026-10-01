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

// Kuruşa yuvarlama (v2.0.13): ticari kural, yarım kuruş sıfırdan uzağa (1,005 → 1,01; −1,005 → −1,01).
// Eski `Math.round(v * 100) / 100` ikili kayan nokta yüzünden 1,005'i 1,00, 2,675'i 2,67 yapıyor, eksi yarımları
// yukarı (−0) yuvarlıyordu. Burada ×100 sonucu 15 anlamlı basamağa indirilir (kayan nokta artığı silinir), sonra
// yuvarlanır; −0 üretilmez.
export function roundMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return 0;
  // ×100 sonrası 15 anlamlı basamak: 1,005 × 100 = 100,49999999999999 → 100,500000000000 (gerçek değer) → 101.
  const cents = Math.round(Number((Math.abs(number) * 100).toPrecision(15)));
  return cents === 0 ? 0 : (Math.sign(number) * cents) / 100;
}
/** Tutar → kuruş (tamsayı). Toplamlar kuruşla yapılır; ara toplamda kayan nokta birikmez. */
export const toCents = value => Math.round(roundMoney(value) * 100);
export const fromCents = cents => roundMoney((Number(cents) || 0) / 100);
/** Tutarları kuruş tamsayısıyla toplar. */
export const sumMoney = values => fromCents([...values].reduce((sum, value) => sum + toCents(value), 0));
