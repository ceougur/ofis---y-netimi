// WhatsApp toplu gönderiminde DÖNEM EŞLİĞİ — TEK YER (2.4.8 T2-1; bağımsız gözden geçirme r5). "Aynı dönem" kararını veren her kural buradan okur:
//   periodKeyOf → makine defterinin dönem anahtarı (lib/whatsapp/defter.mjs claims.period_key): R3 "Daha Önce Gönderildi" (plan §7a revizyonu R3) bunu karşılaştırır.
//   queueKeyOf  → çift başlatma "Zaten Kuyrukta" (plan §7a 9): bekleyen / gönderilmekte iş aynı anahtardaysa yeni toplu işte o cari elenir.
// Ekstre: dönemin iki ucu. Ödeme hatırlatma: R3'te gönderim GÜNÜ (BAŞ MİMAR KARARI GRUP 5 ★5: aynı gün ikinci hatırlatma sorulur, ertesi gün serbest); "Zaten
// Kuyrukta"da gün yok (süren hatırlatma işi varken yenisi elenir).
//
// KURAL BEKLİYOR (ders 43 — "kime kaç kez"; kullanıcıya soruldu): "Bu Ay", "Son 3 Ay" ve "Tüm Hareketler" dönemin sonu BUGÜN olduğundan ertesi gün AYNI seçim farklı
// anahtar üretir → R3 ve "Zaten Kuyrukta" ertesi gün çalışmaz, aynı kişilere ikinci ekstre gider (test/whatsapp-t2-1-248.kural-bekliyor.mjs kırmızı). Kural
// gelince YALNIZ bu dosya değişir; anahtar bu dosyadan başka yerde üretilmez.

/** Ekstre dönemi { from, to, preset } ya da hatırlatma; day: gönderim günü (YYYY-AA-GG). */
export function periodKeyOf(kind, period, day = "") {
  return kind === "statement" ? `${period?.from || ""}|${period?.to || ""}` : `gun|${day}`;
}

/** "Zaten Kuyrukta" anahtarı (aynı cari + aynı şablon + aynı anahtar → elenir). */
export function queueKeyOf(kind, period) {
  return kind === "statement" ? `${period?.from || ""}|${period?.to || ""}` : "hatirlatma";
}
