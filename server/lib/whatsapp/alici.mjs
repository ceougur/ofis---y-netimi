// WhatsApp alıcısı ve dönemi — wa.me yolu (routes/whatsapp.mjs, 2.0.13) ve WhatsApp Business API çekirdeği (lib/whatsapp/queue.mjs, 2.4.8 W2) AYNI kuralla
// okur: numara biçimi ve "Bu Ay / Geçen Ay / Son 3 Ay / Tüm Hareketler" dönemi (metin ile PDF aynı dönem). Kod routes/whatsapp.mjs'ten AYNEN taşındı.
const pad = value => String(value).padStart(2, "0");

// Telefon → wa.me biçimi (ülke kodlu, yalnız rakam). Türkiye cep: 05xx… / 5xx… / +90 5xx… → 905xxxxxxxxx.
export function waNumber(phone) {
  // Hücrede birden çok numara olabilir ("0537… / 0532…"): ilki kullanılır.
  let digits = (String(phone || "").split(/[,;/|\n]/).find(part => /\d/.test(part)) || "").replace(/\D/g, "");
  if (!digits) return { wa: "", valid: false, reason: "Telefon yok" };
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Başında 0 ya da 5 olan numara yurt içidir (hane sayısı yanlış olsa bile: "eksik" diye söylenir).
  else if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  else if (digits.startsWith("5") && digits.length <= 11) digits = `90${digits}`;
  if (digits.startsWith("90")) {
    if (digits.length !== 12) return { wa: digits, valid: false, reason: "Numara eksik ya da fazla haneli" };
    if (digits[2] !== "5") return { wa: digits, valid: false, reason: "Sabit hat (WhatsApp cep numarası değil)" };
    return { wa: digits, valid: true, reason: "" };
  }
  return digits.length >= 11 && digits.length <= 15 ? { wa: digits, valid: true, reason: "" } : { wa: digits, valid: false, reason: "Numara biçimi tanınmadı" };
}

/**
 * WhatsApp Business API alıcısı (2.4.8 W2; plan §7a madde 6 — K1): E.164'e ("+" + ülke kodu + numara) çevrilebilen her numara geçerlidir. SABİT HAT VE
 * YURT DIŞI NUMARA ELENMEZ (Meta karar verir; teslim edilmeyen ileti ücretlendirilmez). Geçersiz = numara yok ya da uzunluk/ülke kodu tutmuyor. Hücrede birden
 * çok numara varsa ilki (madde 7). wa.me yolu (Kendi WhatsApp'ımla) waNumber kuralıyla kalır (sabit hat orada açılamaz).
 */
export function e164Of(phone) {
  const result = waNumber(phone);
  if (result.valid) return { e164: `+${result.wa}`, valid: true, reason: "" };
  if (result.wa && result.wa.startsWith("90") && result.wa.length === 12) return { e164: `+${result.wa}`, valid: true, reason: "" };
  return { e164: "", valid: false, reason: result.reason };
}

// "Tüm Hareketler" bugüne kadar (2.4.8 W3, plan §7a madde 22: ileri tarihli hareket dönem sonundan sonraysa girmez — Cari Ekstre ile aynı; metin ve PDF aynı dönem).
export function waPresetRange(preset, today) {
  const [y, m] = today.split("-").map(Number);
  if (preset === "all") return { from: "", to: today };
  if (preset === "last3") {
    const start = new Date(Date.UTC(y, m - 3, 1));
    return { from: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-01`, to: today };
  }
  if (preset === "lastMonth") {
    const start = new Date(Date.UTC(y, m - 2, 1));
    const end = new Date(Date.UTC(y, m - 1, 0));
    return { from: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-01`, to: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}` };
  }
  return { from: `${y}-${pad(m)}-01`, to: today };
}

