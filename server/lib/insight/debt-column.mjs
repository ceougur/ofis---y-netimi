// Tablodaki BORÇ — TEK yer (2.4.4 madde 30a, 31d E2/E3, 31f U2 / 31b MM5 / 31f U8).
// Kullananlar: Tahsilat Takvimi / ödeme sözü / zil / Vade Takip / Nakit Akışı / "Önce cari açın" Açılış Bakiyesi (insight/dues.mjs) ve Tablodaki Kişiler
// (reports.mjs). Kurallar:
// 1. Kolon (debtPlan): borç kolonu, tablodaki sırasından bağımsız şu öncelikle seçilir —
//      remaining: başlığı "Kalan" / "Bakiye" olan tutar kolonu;
//      total:     başlığı borç / alacak olan tutar kolonu ("Toplam Borç", "Alacak Tutarı");
//      amount:    ikisi de yoksa, sekmenin TEK tutar kolonu — beklenen tahsilat tutarı değilse ("Söz Tutarı", "Taksit Tutarı", "Kira Bedeli", "Aidat",
//                 "Ücret", "Ödenecek" borç değildir: takvimde ve Nakit Akışı Beklenen'de yerini korur, borç toplamına girmez).
//    Başlığı gün / adet / sayı / ay / yıl / oran / yüzde / % olan kolon tutar değildir ("Kalan Gün" 5 TL borç sayılıyordu — E3).
// 2. Satır (rowDebt): sırayla remaining, total, amount hücresinden ilki SAYIYSA o (0 dahil — ödenmiş, sonrakine düşülmez); boş / sayı değilse sonraki (E2).
// 3. Kayıt (chooseDebt): aynı kayıt anahtarı (dosya no) birden çok sekmede ise borç BİR KEZ: öncelik remaining > total > amount; aynı öncelikte çalışma
//    kitabındaki ilk sekme. Aynı öncelikte farklı tutar "uyuşmazlık" olarak bildirilir (rapor ekranı uyarır). Dosya no'suz satırlar ayrı kalır.
import { foldText } from "./validators.mjs";

export const REMAINING_DEBT_HEADER = /\b(kalan|bakiye)\b/;
export const TOTAL_DEBT_HEADER = /\b(borc\w*|alacak\w*)\b/;
// Beklenen tahsilat tutarı (kalem tutarı): borç DEĞİL. insight/dues.mjs kalem tutarını da bu listeden tanır.
export const EXPECTED_AMOUNT_HEADER = /\b(soz tutari|taahhut tutari|taksit tutari|taksit miktari|aylik taksit|aylik odeme|odenecek|odenecek tutar|kira bedeli|kira|aidat|aylik|aylik ucret|servis ucreti|ucret|ucreti|ayligi)\b/;
// Borç tutarı OLMAYAN sayı kolonları (başlık katlanmış hâlde; "Kalan Gün", "Gecikme Günü", "Taksit Sayısı", "Kalan Ay", "Faiz Oranı", "KDV %"). Tam sözcük:
// "Aylık Taksit", "Yıllık Ücret", "Günlük Ücret" para kolonudur, dışlanmaz.
export const NOT_AMOUNT_HEADER = /\b(gun|gunu|gunler|gunleri|adet|adedi|sayi|sayisi|ay|ayi|yil|yili|oran|orani|yuzde|yuzdesi)\b/;
export const isNotAmountHeader = column => NOT_AMOUNT_HEADER.test(foldText(column)) || String(column ?? "").includes("%");
const TIERS = ["remaining", "total", "amount"];

/** Tutar kolonu adayları (kolon analizinden; iki yol aynı kümeyi kullanır): tutar rolü, ya da kalem tutarı başlıklı sayı; gün / adet / oran değil. */
export const amountCandidates = analyses => (analyses || [])
  .filter(item => item.role === "money" || (item.role === "number" && EXPECTED_AMOUNT_HEADER.test(foldText(item.column))))
  .map(item => item.column)
  .filter(column => column && !isNotAmountHeader(column));

/**
 * Sekmenin borç düzeni.
 * @param {string[]} candidates tutar kolonları, tablodaki sırasıyla (amountCandidates)
 * @param {{ sparse?: string|null }} [options] tutar rolü almamış ama borç başlıklı, seyrek yazılmış kolon (yalnız remaining/total yoksa total sayılır)
 */
export function debtPlan(candidates, { sparse = null } = {}) {
  const list = (candidates || []).filter(column => column && !isNotAmountHeader(column));
  const header = column => foldText(column);
  const remaining = list.find(column => REMAINING_DEBT_HEADER.test(header(column))) || null;
  const total = list.find(column => column !== remaining && !REMAINING_DEBT_HEADER.test(header(column)) && TOTAL_DEBT_HEADER.test(header(column))) || (!remaining ? sparse : null) || null;
  const amount = !remaining && !total && list.length === 1 && !EXPECTED_AMOUNT_HEADER.test(header(list[0])) ? list[0] : null;
  return { remaining, total, amount, column: remaining || total || amount };
}

/**
 * Bir satırın borcu: sırayla Kalan, Toplam Borç, sekmenin tek tutarı — ilk SAYI hücre (0 dahil); hiçbiri yoksa null.
 * @param {{ remaining: string|null, total: string|null, amount?: string|null }} plan
 * @param {(column: string) => number|null} read hücrenin tutarı (parseAmount)
 * @returns {{ amount: number|null, column: string|null, tier: string|null }}
 */
export function rowDebt(plan, read) {
  for (const tier of TIERS) {
    const column = plan?.[tier];
    if (!column) continue;
    const value = read(column);
    if (typeof value === "number" && Number.isFinite(value)) return { amount: value, column, tier };
  }
  return { amount: null, column: null, tier: null };
}

/**
 * Aynı kayıt anahtarının iki sekmedeki borcundan geçerli olanı: öncelik remaining > total > amount; aynı öncelikte önce gelen (ilk sekme) kalır.
 * @returns {{ debt: object, conflict: boolean }} conflict: aynı öncelikte farklı tutar
 */
export function chooseDebt(current, next) {
  if (!next || next.amount === null || next.amount === undefined) return { debt: current, conflict: false };
  if (!current || current.amount === null || current.amount === undefined) return { debt: next, conflict: false };
  const a = TIERS.indexOf(current.tier);
  const b = TIERS.indexOf(next.tier);
  if (b < a) return { debt: next, conflict: false };
  return { debt: current, conflict: a === b && Math.abs(current.amount - next.amount) > 0.004 };
}
