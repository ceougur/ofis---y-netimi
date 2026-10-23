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
// 3. Kayıt (debtByRecord): aynı SEKMEDEKİ satırlar ayrı borçtur ve toplanır (T4); aynı anahtar FARKLI sekmelerde ise borç BİR KEZ: öncelik remaining > total >
//    net > amount; aynı öncelikte çalışma kitabındaki ilk sekme. Aynı öncelikte farklı tutar "uyuşmazlık"tır; birleştirme ekranda, PDF ve Excel'de not olur.
//    Dosya no'suz satırlar ayrı kalır.
// 2.4.4 31e T1: Kalan / borç kolonu YOKSA ve tabloda bir ödenen kolonu ("Ödenen", "Tahsil Edilen", "Tahsilat"…) ile bir toplam tutar kolonu ("Tutar",
// "Ödenecek Tutar", "Toplam Borç"…) varsa satırın borcu toplam − ödenen (ödenen boşsa 0; ödenen toplamı aşarsa 0 ve uyarı). Ödenen kolonu borç sayılmaz.
// Kalan kolonu varsa 30a aynen: Kalan; Kalan hücresi boşsa toplam.
// 2.4.4 31e T4: aynı SEKMEDE aynı dosya no'lu birden çok satır (satır başına taksit / kalem) ayrı borçtur, 2.4.3 gibi; tek kayıt kuralı yalnız FARKLI
// sekmeler için (debtByRecord) ve görünür not ister (tableNotes — lib/reports.mjs).
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
 * Kayıt (dosya no) başına borç (T4 / U2 / MM5): aynı SEKMEDEKİ satırlar ayrı borçtur ve toplanır; aynı anahtar FARKLI sekmelerdeyse yalnız bir sekme sayılır —
 * öncelik remaining > total > net > amount, aynı öncelikte çalışma kitabındaki ilk sekme. Aynı öncelikte farklı toplam "uyuşmazlık"tır.
 * @param {Array<{ key: string, tab: string, amount: number|null, tier: string|null }>} entries satır borçları, tablo sırasıyla
 * @returns {{ byKey: Map<string, { tab: string, amount: number, tier: string, tabs: string[] }>, merged: object[], conflicts: object[] }}
 */
export function debtByRecord(entries) {
  const perKey = new Map();
  for (const entry of entries || []) {
    if (!entry?.key || entry.amount === null || entry.amount === undefined) continue;
    if (!perKey.has(entry.key)) perKey.set(entry.key, new Map());
    const tabs = perKey.get(entry.key);
    const current = tabs.get(entry.tab) || { tab: entry.tab, amount: 0, rank: Infinity, rows: 0, meta: entry.meta };
    current.amount = Math.round((current.amount + entry.amount) * 100) / 100;
    current.rank = Math.min(current.rank, Math.max(0, TIERS.indexOf(entry.tier)));
    current.rows += 1;
    tabs.set(entry.tab, current);
  }
  const byKey = new Map();
  const merged = [];
  const conflicts = [];
  for (const [key, tabs] of perKey) {
    const list = [...tabs.values()];
    let kept = list[0];
    for (const candidate of list.slice(1)) if (candidate.rank < kept.rank) kept = candidate;
    // order: sekmeler tercih sırasıyla (sayılan önce) — Sekme süzgeci seçilince seçilen sekmeler içinde ilki sayılır (raporlar).
    const order = [...list].sort((a, b) => a.rank - b.rank || list.indexOf(a) - list.indexOf(b)).map(item => item.tab);
    byKey.set(key, { tab: kept.tab, amount: kept.amount, tier: TIERS[kept.rank] || null, tabs: list.map(item => item.tab), order });
    if (list.length < 2) continue;
    const others = list.filter(item => item !== kept);
    merged.push({ key, meta: kept.meta, kept: { tab: kept.tab, amount: kept.amount }, others: others.map(item => ({ tab: item.tab, amount: item.amount })) });
    for (const other of others) if (other.rank === kept.rank && Math.abs(other.amount - kept.amount) > 0.004) conflicts.push({ key, meta: kept.meta, kept: { tab: kept.tab, amount: kept.amount }, other: { tab: other.tab, amount: other.amount } });
  }
  return { byKey, merged, conflicts };
}
