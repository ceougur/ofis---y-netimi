// 2.5.1 D3 tur 3 — DEVİR NEDEN DURDU: ileti düzeni (KULLANICI 27.11.2026 11:39 UTC, AYNEN: "devir yapılırken bir sebeple duruyorya, nedenini kullanıcıya açıkça türkçe yazsın
// program, önerilerine ek olarak bunuda uygula."). TEK yardımcı: devri durduran ya da uyaran HER neden — ön denetim (preflight.mjs), planın kendi sorunları, ön izleme uçlarının reddi ve
// beklenmeyen hatası (routes/devir.mjs) — bu dosyadan geçer; devri UYGULAYAN paket (D4: yarıda kesilme, kilitli dosya, yer yok, Devri Geri Al / Devri Yenile redleri) ve sihirbaz (D5)
// da bunu kullanır. Her ileti dört alanlıdır:
//   neOldu     — NE oldu (hangi kayıt / cari / tutar / tarih; gerçek değerlerle — tutar Türk para biçiminde, tarih gün.ay.yıl)
//   neden      — devir NEDEN duruyor (uyarıda: neden önemli)
//   neYapmali  — NE YAPMALI, adım adım (dizi; her adım bir cümle)
//   nereye     — NEREYE gidilecek: { ekran (yazım düzeninde ekran adı), hedef (D5 yönlendirme anahtarı), kayit? ({ tur, kimlik } — kayda götüren bağlantı) }
// İç kod (`kod`) ve ayrıntı (`ayrinti`) makine alanıdır; kullanıcıya giden metinde (`metin`, dört alan, `baslik`) GÖRÜNMEZ. İngilizce sözcük, alan adı, 'undefined' / 'null' / 'NaN' /
// '[object' / yığın izi YOK (iletiDenetimi; kalıcı test test/devir-d3-ileti.test.mjs). `metin` dört alanın birleşik cümlesidir (Devir Raporu'nun PDF / Excel'i ve eski okuyucular).

const MONEY = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const COUNT = new Intl.NumberFormat("tr-TR");
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** Kuruş → "1.234,50 TL" (eksi tutar "-1.234,50 TL"; -0 yok). */
export const tlText = minor => {
  const value = Math.round(Number(minor) || 0);
  return `${MONEY.format(value / 100).replace(/^-0,00$/, "0,00")} TL`;
};
/** Kuruş → yönlü tutar: "borç yönünde 4.000,00 TL" / "alacak yönünde 4.000,00 TL". */
export const sideText = minor => `${Number(minor) >= 0 ? "borç" : "alacak"} yönünde ${tlText(Math.abs(Number(minor) || 0))}`;
/** YYYY-MM-DD → gün.ay.yıl ("" → ""). */
export const dayText = iso => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || "")) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
/** YYYY-MM → "Aralık 2026". */
export const monthText = ym => (/^\d{4}-\d{2}/.test(String(ym || "")) ? `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : "");
/** Sayı → "1.234". */
export const countText = value => COUNT.format(Number(value) || 0);
/** "a, b ve c" */
export const listText = items => {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} ve ${list.at(-1)}`;
};

/** Gidilecek yerler (ekran adları yazım düzeninde; hedef D5 yönlendirme anahtarı). preflight.mjs PREFLIGHT_TARGETS bunun takma adıdır. */
export const DEVIR_TARGETS = Object.freeze({
  gonderilecekler: { ekran: "Faturalar › Gönderilecekler", hedef: "invoices:waiting" },
  faturalar: { ekran: "Faturalar", hedef: "invoices" },
  gelenKutusu: { ekran: "Faturalar › Gelen e-Faturalar", hedef: "invoices:inbox" },
  bankaIsleri: { ekran: "Banka › Bekleyen İşler", hedef: "bank:jobs" },
  defterMutabakati: { ekran: "Raporlar › Ana Defter › Defter Mutabakatı", hedef: "ledger:reconcile" },
  acilisOlabilir: { ekran: "Yönetim › Sistem › Açılış Olabilir Kayıtlar", hedef: "admin:opening-review" },
  kuralFarki: { ekran: "Yönetim › Sistem › Kural Farkı Düzeltme Fişi", hedef: "admin:rule-diff" },
  kdvMahsup: { ekran: "Vergi › KDV Mahsup Fişi", hedef: "tax:vat-offset" },
  donemKilidi: { ekran: "Yönetim › Sistem › Dönem Kilidi", hedef: "admin:period-lock" },
  taksitler: { ekran: "Taksitler", hedef: "plans" },
  stok: { ekran: "Stok", hedef: "stock" },
  kasa: { ekran: "Kasa", hedef: "cash" },
  cari: { ekran: "Cari", hedef: "accounts" },
  supheli: { ekran: "Cari › Şüpheli Alacaklar", hedef: "accounts:doubtful" },
  whatsapp: { ekran: "WhatsApp › Gönderimler", hedef: "whatsapp:batches" },
  mutabakatTesti: { ekran: "Yönetim › Sistem › Mutabakat Testi", hedef: "admin:integrity" },
  devirRaporu: { ekran: "Devir Raporu", hedef: "devir:report" },
  yilSonuDevri: { ekran: "Ayarlar › Yıl Sonu Devri", hedef: "devir:wizard" },
});

const sentence = value => {
  const s = String(value ?? "").trim();
  if (!s) return "";
  return /[.!?…]$/.test(s) ? s : `${s}.`;
};

/** Seviye adları (Devir Raporu başlıkları ve ekran). */
export const DEVIR_LEVELS = Object.freeze({ durdurur: "Devri Durduran Nedenler", uyarir: "Uyarılar" });

/** Dört alanın birleşik cümlesi (metin). Güvence (ör. "Verileriniz değişmedi.") sona eklenir. */
export function iletiMetni({ neOldu, neden, neYapmali = [], nereye = null, guvence = "" }) {
  const steps = (neYapmali || []).map(sentence).filter(Boolean);
  const parts = [sentence(neOldu), sentence(neden)];
  if (steps.length === 1) parts.push(`Yapılacak: ${steps[0]}`);
  else if (steps.length > 1) parts.push(`Yapılacaklar: ${steps.map((step, index) => `(${index + 1}) ${step}`).join(" ")}`);
  if (nereye?.ekran) parts.push(sentence(`Gidilecek yer: ${nereye.ekran}`));
  if (guvence) parts.push(sentence(guvence));
  return parts.filter(Boolean).join(" ");
}

/**
 * Devir iletisi (TEK kurucu). seviye: "durdurur" | "uyarir". kod: makine alanı (kullanıcıya gösterilmez). baslik: yazım düzeninde kısa ad. neOldu / neden: cümle; neYapmali: adımlar;
 * nereye: DEVIR_TARGETS'ten biri (+ isteğe bağlı kayit { tur, kimlik }). extra: adet, ornek, belirgin, ayrinti (makine), guvence (cümle).
 * Dönüş: { kod, seviye, baslik, neOldu, neden, neYapmali, nereye, git (= nereye; eski okuyucular), metin, ...extra }.
 */
export function devirIletisi({ kod, seviye = "durdurur", baslik, neOldu, neden, neYapmali = [], nereye = null, guvence = "", ...extra }) {
  const target = nereye ? { ekran: nereye.ekran, hedef: nereye.hedef, ...(nereye.kayit ? { kayit: nereye.kayit } : {}) } : null;
  const steps = (neYapmali || []).map(sentence).filter(Boolean);
  const out = {
    kod: String(kod || "devir-nedeni"),
    seviye: seviye === "uyarir" ? "uyarir" : "durdurur",
    baslik: String(baslik || "").trim(),
    neOldu: sentence(neOldu),
    neden: sentence(neden),
    neYapmali: steps,
    nereye: target,
    git: target,
    metin: iletiMetni({ neOldu, neden, neYapmali: steps, nereye: target, guvence }),
  };
  if (guvence) out.guvence = sentence(guvence);
  for (const [key, value] of Object.entries(extra)) if (value !== undefined) out[key] = value;
  return out;
}

/** Ön izleme / devir işinin BEKLENMEYEN hatası: Türkçe cümle + güvence; ham hata iletisi yanıt gövdesine girmez (çağıran sunucu günlüğüne yazar). */
export function beklenmeyenHataIletisi({ is = "Devir ön izlemesi", veriDegismedi = true } = {}) {
  return devirIletisi({
    kod: "beklenmeyen-hata",
    seviye: "durdurur",
    baslik: "Hesap Tamamlanamadı",
    neOldu: `${is} hesaplanırken beklenmeyen bir sorun çıktı ve hesap tamamlanamadı`,
    neden: "Hesabın sonucu bilinmeden devir başlatılmaz",
    neYapmali: ["Ön İzleme'yi yeniden başlatın", "Sorun sürerse Mutabakat Testi'ni çalıştırın ve sonucunu destek ekibine iletin"],
    nereye: DEVIR_TARGETS.yilSonuDevri,
    guvence: veriDegismedi ? "Verileriniz değişmedi" : "",
  });
}

/** Ön izleme isteğinin REDDİ (400; kod makine alanında): kesim tarihi yıl sonu değil / geçmiş yıl değil, Cari Bakiye Tipi geçersiz. Bilinmeyen kod → beklenmeyen hata iletisi. */
export function onIzlemeReddiIletisi(code, { cutoff = "", today = "" } = {}) {
  const chosen = dayText(cutoff) || "geçersiz bir tarih";
  switch (code) {
    case "DEVIR_K_31_ARALIK":
      return devirIletisi({ kod: code, baslik: "Son İşlem Tarihi Yıl Sonu Değil", neOldu: `Seçilen son işlem tarihi (${chosen}) bir yılın son günü değil`, neden: "Devir yalnız yıl sonunda (31 Aralık) yapılır", neYapmali: ["Devir İçin Son İşlem Tarihi olarak geçmiş bir yılın 31 Aralık'ını seçin"], nereye: DEVIR_TARGETS.yilSonuDevri, guvence: "Verileriniz değişmedi" });
    case "DEVIR_K_GELECEK":
      return devirIletisi({ kod: code, baslik: "Yıl Henüz Bitmedi", neOldu: `Seçilen son işlem tarihi (${chosen}) bu yılın ya da gelecek bir yılın sonu${dayText(today) ? ` (bugün ${dayText(today)})` : ""}`, neden: "Devir yalnız bitmiş bir yıl için yapılır; yıl bitmeden devredilirse yılın kalan kayıtları yanlış yıla düşer", neYapmali: ["Geçmiş bir yılın 31 Aralık'ını seçin", "Bu yılı devretmek için yıl bittikten sonra yeniden deneyin"], nereye: DEVIR_TARGETS.yilSonuDevri, guvence: "Verileriniz değişmedi" });
    case "DEVIR_SECENEK":
      return devirIletisi({ kod: code, baslik: "Cari Bakiye Tipi Seçilmedi", neOldu: "Cari Bakiye Tipi geçerli bir seçenek değil", neden: "Carilerin açılış satırları bu seçime göre hesaplanır", neYapmali: ["Borç ve Alacakları Aktar ya da Sadece Bakiyeyi Aktar'ı seçin", "Ön İzleme'yi yeniden başlatın"], nereye: DEVIR_TARGETS.yilSonuDevri, guvence: "Verileriniz değişmedi" });
    default:
      return beklenmeyenHataIletisi();
  }
}

// Yasak kalıplar (kullanıcıya giden metinde): değer sızıntısı, iç kod biçimi, yığın izi, İngilizce iletiler, ISO tarih, nokta ondalıklı tutar.
const FORBIDDEN = [
  [/\bundefined\b/i, "undefined"],
  [/\bnull\b/i, "null"],
  [/\bNaN\b/, "NaN"],
  [/\[object/i, "[object"],
  [/\bInfinity\b/, "Infinity"],
  [/\n\s+at\s|\bat\s+\S+\s+\(.*:\d+:\d+\)/, "yığın izi"],
  [/\b(error|failed|cannot|invalid|unexpected|not found|timeout|exception|warning|true|false)\b/i, "İngilizce sözcük"],
  [/\b(plan|devir|kural|e-belge|degismez)-[a-z0-9-]+\b/, "iç kod"],
  [/\b[a-z]+_[a-z_]+\b/, "alan adı"],
  [/\b(account|invoice|plan|cheque|doubtful|voucher|onizleme)-[0-9a-f]{6,}/i, "iç kimlik"],
  [/\b\d{4}-\d{2}-\d{2}\b/, "ISO tarih"],
  [/\d\.\d{2} TL|\d+\.\d{1,2}(?!\d)\s*TL/, "nokta ondalıklı tutar"],
];

/** Kullanıcıya giden alanların denetimi (test). Dönüş: [{ alan, neden, metin }] — boşsa ileti temiz. */
export function iletiDenetimi(ileti) {
  const problems = [];
  const fields = { baslik: ileti?.baslik, neOldu: ileti?.neOldu, neden: ileti?.neden, metin: ileti?.metin, ekran: ileti?.nereye?.ekran };
  (ileti?.neYapmali || []).forEach((step, index) => (fields[`neYapmali.${index + 1}`] = step));
  for (const [alan, value] of Object.entries(fields)) {
    const textValue = String(value ?? "");
    if (["baslik", "neOldu", "neden", "metin", "ekran"].includes(alan) && !textValue.trim()) problems.push({ alan, neden: "boş", metin: textValue });
    for (const [pattern, why] of FORBIDDEN) if (pattern.test(textValue)) problems.push({ alan, neden: why, metin: textValue });
  }
  if (!ileti?.neYapmali?.length) problems.push({ alan: "neYapmali", neden: "adım yok", metin: "" });
  return problems;
}
