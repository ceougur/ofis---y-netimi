// Kalan borç kolonunun seçimi — TEK yer (2.4.4 madde 30a).
// Tabloda birden çok tutar kolonu olabilir ("Toplam Borç", "Ödenen", "Kalan Borç"). Kişinin bugün tahsil edilecek borcu KALAN'dır: başlığı "Kalan" ya da
// "Bakiye" olan tutar kolonu her zaman önce gelir (kolon sırası fark etmez). Böyle kolon yoksa çağıranın kendi geri dönüş başlık kuralı (ilk eşleşen) geçer.
// Kullananlar: Tahsilat Takvimi / ödeme sözü / zil / Vade Takip / Nakit Akışı (insight/dues.mjs) ve Tablodaki Kişiler (reports.mjs). Önceden iki yer ayrı
// kural taşıyordu (5b dues'u Kalan'a aldı, rapor ilk eşleşeni — "Toplam Borç"u — almaya devam etti); aynı kişi iki ekranda farklı tutarla görünüyordu.
import { foldText } from "./validators.mjs";

export const REMAINING_DEBT_HEADER = /\b(kalan|bakiye)\b/;

/**
 * @param {string[]} candidates tutar kolonları, tablodaki sırasıyla
 * @param {RegExp} fallbackHeader Kalan/Bakiye kolonu yoksa aranacak başlık kuralı (katlanmış başlıkta)
 * @returns {string|null}
 */
export function pickRemainingDebtColumn(candidates, fallbackHeader) {
  const list = (candidates || []).filter(Boolean);
  return list.find(column => REMAINING_DEBT_HEADER.test(foldText(column))) || (fallbackHeader ? list.find(column => fallbackHeader.test(foldText(column))) : null) || null;
}
