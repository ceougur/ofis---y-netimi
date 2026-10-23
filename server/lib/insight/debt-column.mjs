// Tablodaki BORÇ — TEK yer (2.4.4 madde 30a, 31d E2/E3, 31f U2 / 31b MM5 / 31f U8).
// Kullananlar: Tahsilat Takvimi / ödeme sözü / zil / Vade Takip / Nakit Akışı / "Önce cari açın" Açılış Bakiyesi (insight/dues.mjs) ve Tablodaki Kişiler
// (reports.mjs). Kurallar:
// 1. Kolon (debtPlan): borç kolonu, tablodaki sırasından bağımsız şu öncelikle seçilir —
//      remaining: başlığı "Kalan" / "Bakiye" olan tutar kolonu;
//      total:     başlığı borç / alacak olan tutar kolonu ("Toplam Borç", "Alacak Tutarı");
//      amount:    ikisi de yoksa, sekmenin TEK tutar kolonu ("Tutar", "Aylık Ücret", "Kira Bedeli", "Ödenecek Tutar" — 2.4.3'teki gibi borç). Yalnız ÖDEME
//                 SÖZÜ tutarı ("Söz Tutarı", "Taahhüt Tutarı") borç değildir: takvimde ve Nakit Akışı Beklenen'de yerini korur, borç toplamına girmez.
//                 (Karar 22.10.2026, kullanıcı adına 5 dk yetkisiyle: taksit / kira / ücret / ödenecek tek sütunu borçtur; müşteri tablosu sessizce boş kalmaz.)
//    Başlığı gün / adet / sayı / ay / yıl / oran / yüzde / % olan kolon tutar değildir ("Kalan Gün" 5 TL borç sayılıyordu — E3).
// 2. Satır (rowDebt): sırayla remaining, total, net (toplam − ödenen), amount hücresinden ilki SAYIYSA o (0 dahil — ödenmiş, sonrakine düşülmez); boş / sayı değilse sonraki (E2).
// 3. Kayıt (debtByRecord): aynı SEKMEDEKİ satırlar ayrı borçtur ve toplanır (T4); aynı anahtar FARKLI sekmelerde de AYRI borç ve ayrı vade kalemidir
//    (2.4.3 gibi; 31e kontrol turu 2 A1 kararı, 23.10.2026 — dönem sekmesi tutan tabloda 2026 kalemleri düşüyordu). Borcu birden çok sekmede olan dosya no
//    görünür not olur (ekran, PDF, Excel ve Tahsilat Takvimi): "ayrı sayıldı; aynı borçsa kopya sekmeyi kaldırın ya da Sekme süzgeciyle bakın".
//    Dosya no'suz satırlar ayrı kalır. Tahsilat (5c) dosya no başına bir kez yazılır — bu kural tahsilat tarafındadır, değişmez.
// 2.4.4 31e T1: Kalan / borç kolonu YOKSA ve tabloda bir ödenen kolonu ("Ödenen", "Tahsil Edilen", "Tahsilat"…) ile bir toplam tutar kolonu ("Tutar",
// "Ödenecek Tutar", "Toplam Borç"…) varsa satırın borcu toplam − ödenen (ödenen boşsa 0; ödenen toplamı aşarsa 0 ve uyarı). Ödenen kolonu borç sayılmaz.
// Kalan kolonu varsa 30a aynen: Kalan; Kalan hücresi boşsa toplam.
// 2.4.4 31e T4: aynı SEKMEDE aynı dosya no'lu birden çok satır (satır başına taksit / kalem) ayrı borçtur, 2.4.3 gibi; farklı sekmeler de ayrı (A1) ve
// görünür not ister (tableNotes — lib/reports.mjs).
import { foldText } from "./validators.mjs";

export const REMAINING_DEBT_HEADER = /\b(kalan|bakiye)\b/;
export const TOTAL_DEBT_HEADER = /\b(borc\w*|alacak\w*)\b/;
// Kalem (beklenen tahsilat) tutarı başlıkları: insight/dues.mjs kalem tutarını bu listeden tanır.
export const EXPECTED_AMOUNT_HEADER = /\b(soz tutari|taahhut tutari|taksit tutari|taksit miktari|aylik taksit|aylik odeme|odenecek|odenecek tutar|kira bedeli|kira|aidat|aylik|aylik ucret|servis ucreti|ucret|ucreti|ayligi)\b/;
// Borç tutarı OLMAYAN sayı kolonları (başlık katlanmış hâlde; "Kalan Gün", "Gecikme Günü", "Taksit Sayısı", "Kalan Ay", "Faiz Oranı", "KDV %"). Tam sözcük:
// "Aylık Taksit", "Yıllık Ücret", "Günlük Ücret" para kolonudur, dışlanmaz.
// Ödeme sözü tutarı: borç DEĞİL (31f U2).
export const PROMISE_AMOUNT_HEADER = /\b(soz|sozu|taahhut|taahhudu)\b/;
export const NOT_AMOUNT_HEADER = /\b(gun|gunu|gunler|gunleri|adet|adedi|sayi|sayisi|ay|ayi|yil|yili|oran|orani|yuzde|yuzdesi)\b/;
export const isNotAmountHeader = column => NOT_AMOUNT_HEADER.test(foldText(column)) || String(column ?? "").includes("%");
// Ödenen / tahsil edilen tutar kolonu (borç değil; T1'de toplamdan düşülür). Tarih / gün / no kolonu değil.
export const PAID_AMOUNT_HEADER = /\b(odenen|odenmis|odendi|tahsil edilen|tahsilat|yatan|yatirilan|alinan)\b/;
const isPaidHeader = column => PAID_AMOUNT_HEADER.test(foldText(column)) && !/\b(tarih\w*|gun\w*|no)\b/.test(foldText(column));
const TIERS = ["remaining", "total", "net", "amount"];

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
  const paid = list.find(column => column !== remaining && isPaidHeader(column)) || null;
  // Ödenen kolonları ve Kalan dışındaki tutarlar: borç başlıklı olan ("Toplam Borç", "Alacak Tutarı") ya da söz tutarı olmayan TEK tutar ("Tutar", "Ödenecek Tutar").
  const rest = list.filter(column => column !== remaining && !isPaidHeader(column));
  const headed = rest.find(column => !REMAINING_DEBT_HEADER.test(header(column)) && TOTAL_DEBT_HEADER.test(header(column))) || null;
  const single = rest.length === 1 && !PROMISE_AMOUNT_HEADER.test(header(rest[0])) ? rest[0] : null;
  const gross = headed || single || (!remaining ? sparse : null) || null;
  // Kalan varsa: Kalan; Kalan hücresi boşsa toplam (gross). Kalan yoksa: ödenen varsa toplam − ödenen (net); yoksa borç başlıklı kolon (total) ya da tek tutar (amount).
  const total = remaining ? gross : !paid ? headed || (!headed && !single ? sparse : null) : null;
  const net = !remaining && paid && gross ? gross : null;
  const amount = !remaining && !paid && !total && single ? single : null;
  // Tek sütun bir kalem tutarıysa ("Aylık Ücret", "Kira Bedeli", "Taksit Tutarı", "Ödenecek"): Tablodaki Kişiler'de borçtur (2.4.3 gibi) ama kaydın "Kalan
  // Borç"u değildir — "Önce cari açın" Açılış Bakiyesi ve Tablodan Aktar onu bir aylık ücreti açılış borcu sanmasın (2.4.3'te de boştu).
  return { remaining, total, net, paid: net ? paid : null, amount, amountExpected: Boolean(amount && EXPECTED_AMOUNT_HEADER.test(header(amount))), column: remaining || total || net || amount };
}

/**
 * Bir satırın borcu: sırayla Kalan, Toplam Borç, sekmenin tek tutarı — ilk SAYI hücre (0 dahil); hiçbiri yoksa null.
 * @param {{ remaining: string|null, total: string|null, amount?: string|null }} plan
 * @param {(column: string) => number|null} read hücrenin tutarı (parseAmount)
 * @param {{ expected?: boolean }} [options] expected: false → kalem tutarı olan tek sütun (amountExpected) borç sayılmaz (kaydın Kalan Borç'u için)
 * @returns {{ amount: number|null, column: string|null, tier: string|null }}
 */
export function rowDebt(plan, read, { expected = true } = {}) {
  for (const tier of TIERS) {
    const column = plan?.[tier];
    if (!column) continue;
    if (tier === "amount" && plan.amountExpected && !expected) continue;
    const value = read(column);
    if (!(typeof value === "number" && Number.isFinite(value))) continue;
    if (tier !== "net") return { amount: value, column, tier };
    // T1: toplam − ödenen (ödenen boşsa 0); ödenen toplamı aşarsa 0 ve uyarı (overpaid).
    const paidValue = plan.paid ? read(plan.paid) : null;
    const left = Math.round((value - (typeof paidValue === "number" && Number.isFinite(paidValue) ? paidValue : 0)) * 100) / 100;
    return { amount: Math.max(0, left), column, tier, ...(left < 0 ? { overpaid: true } : {}) };
  }
  return { amount: null, column: null, tier: null };
}

/**
 * Kayıt (dosya no) başına borç (T4 / A1): aynı SEKMEDEKİ satırlar ayrı borçtur ve toplanır; FARKLI sekmeler de ayrı borçtur (birleştirilmez).
 * byKey: anahtar → sekme → { amount, tier, column } (sekmeler tablo sırasıyla); split: borcu (> 0) birden çok sekmede olan anahtarlar (görünür not için).
 * @param {Array<{ key: string, tab: string, amount: number|null, tier: string|null, column?: string, meta?: object }>} entries satır borçları, tablo sırasıyla
 * @returns {{ byKey: Map<string, Map<string, { tab: string, amount: number, tier: string|null, column: string, rows: number }>>, split: Array<{ key: string, meta: object, tabs: Array<{ tab: string, amount: number }> }> }}
 */
export function debtByRecord(entries) {
  const byKey = new Map();
  const metaOf = new Map();
  for (const entry of entries || []) {
    if (!entry?.key || entry.amount === null || entry.amount === undefined) continue;
    if (!byKey.has(entry.key)) byKey.set(entry.key, new Map());
    if (!metaOf.has(entry.key)) metaOf.set(entry.key, entry.meta);
    const tabs = byKey.get(entry.key);
    const current = tabs.get(entry.tab) || { tab: entry.tab, amount: 0, tier: entry.tier || null, column: entry.column || "", rows: 0 };
    current.amount = Math.round((current.amount + entry.amount) * 100) / 100;
    current.rows += 1;
    tabs.set(entry.tab, current);
  }
  const split = [];
  // Not yalnız borcu (> 0) birden çok sekmede olan dosya no için: Kalan 0 (ödenmiş) sekme borç toplamına bir şey katmaz.
  for (const [key, tabs] of byKey) {
    const owing = [...tabs.values()].filter(item => item.amount > 0);
    if (owing.length > 1) split.push({ key, meta: metaOf.get(key), tabs: owing.map(item => ({ tab: item.tab, amount: item.amount })) });
  }
  return { byKey, split };
}
