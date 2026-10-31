// WhatsApp toplu gönderiminde DÖNEM EŞLİĞİ — TEK YER (2.4.8 T2-1; bağımsız gözden geçirme r5). "Aynı dönem" kararını veren her kural buradan okur:
//   periodKeyOf → makine defterinin dönem anahtarı (lib/whatsapp/defter.mjs claims.period_key): R3 "Daha Önce Gönderildi" (plan §7a revizyonu R3) bunu karşılaştırır.
//   sentSinceOf → R3'ün zaman penceresi (anahtar aynı + gönderim bu andan sonra); boş = pencere yok.
//   queueKeyOf  → çift başlatma "Zaten Kuyrukta" (plan §7a 9): bekleyen / gönderilmekte iş aynı anahtardaysa yeni toplu işte o cari elenir.
//
// KURAL (KULLANICI KARARI T2-1 = A, 31.10.2026 ~03:20 UTC "önerilerini yap"): aynı cari + aynı şablon + aynı dönem SEÇİMİ —
//   "Bu Ay" / "Geçen Ay": aynı TAKVİM AYI (dönemin başlangıç ayı aynıysa aynı dönem; bitiş günü — "Bu Ay"da bugün — fark etmez);
//   "Son 3 Ay" / "Tüm Hareketler": aynı seçim SON 7 GÜN içinde gönderilmişse aynı dönem (bitiş hep bugün; 7 günden eskisi yeni dönem sayılır);
//   özel tarih aralığı: başlangıç VE bitiş birebir aynı.
// Uyarı son gönderim tarihini gösterir, varsayılan "Bunları Çıkar" (R3; lib/whatsapp/queue.mjs plan + istemci). Ödeme hatırlatma: R3'te gönderim GÜNÜ (BAŞ MİMAR KARARI
// GRUP 5 ★5: aynı gün ikinci hatırlatma sorulur, ertesi gün serbest — değişmedi); "Zaten Kuyrukta"da gün yok (süren hatırlatma işi varken yenisi elenir).

const ROLLING_MS = 7 * 24 * 3_600_000; // "Son 3 Ay" / "Tüm Hareketler" için aynı-dönem penceresi

/** Ekstre dönemi { from, to, preset } → seçim anahtarı (gün bilgisinden bağımsız). */
function statementKey(period) {
  const preset = String(period?.preset || "");
  if (preset === "thisMonth" || preset === "lastMonth") return `ay|${preset}|${String(period?.from || "").slice(0, 7)}`;
  if (preset === "last3" || preset === "all") return `secim|${preset}`;
  return `aralik|${period?.from || ""}|${period?.to || ""}`;
}

/** Ekstre dönemi { from, to, preset } ya da hatırlatma; day: gönderim günü (YYYY-AA-GG). */
export function periodKeyOf(kind, period, day = "") {
  return kind === "statement" ? statementKey(period) : `gun|${day}`;
}

/** R3 penceresi: "Son 3 Ay" / "Tüm Hareketler" yalnız son 7 günde gönderilmişse aynı dönem. Dönüş: ISO alt sınır ya da "" (pencere yok). */
export function sentSinceOf(kind, period, nowMs) {
  if (kind !== "statement") return "";
  return ["last3", "all"].includes(String(period?.preset || "")) ? new Date(nowMs - ROLLING_MS).toISOString() : "";
}

/** "Zaten Kuyrukta" anahtarı (aynı cari + aynı şablon + aynı anahtar → elenir). */
export function queueKeyOf(kind, period) {
  return kind === "statement" ? statementKey(period) : "hatirlatma";
}
