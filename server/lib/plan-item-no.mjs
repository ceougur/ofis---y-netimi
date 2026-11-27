// Taksitin GÖRÜNEN numarası — TEK KAYNAK (2.5.1 Mİ).
//
// Kural: kartın taksitleri lib/plans.mjs compareItems sırasıyla (vade, vade eşitse saklanan sıra) 1, 2, 3…, boşluksuz numaralanır. Saklanan sıra (plan_items.seq)
// VERİDE DEĞİŞMEZ (göç yok); silinen taksitten sonra boşluk bırakır ('1.', '3.'), sonradan eklenen / vadesi değişen taksitte sırayı tutmaz — yalnız GÖSTERİLEN numara buradan.
//   Mİ-1 (kullanıcı 27.11): Cari Listesi'nin "… gün gecikti (2. taksit)" eki ve taksit kartı penceresi.
//   S-Mİ1-1 = A (KULLANICI KARARI 27.11 08:06 UTC, AYNEN: "önerini uygula"): müşteriye gidenler de aynı numaraya geçer — tek numara HER YERDE (makbuz, kart / liste PDF'i,
//   cari ekstresi ekran / PDF / Excel, WhatsApp ekstresi, Tablo, zil / takvim / Vade Takip, nakit akışı, Rapor Merkezi, fatura penceresinin "Bu Faturayı Kapatanlar"ı).
// SINIR (BAŞ MİMAR KARARI 27.11 (1)): numara Tek Yükümlülük Kuyruğu'nun GİRDİSİNE girmez — allocate çıktısı, cari kartının kart listesi (forAccount), cari defteri satırları
// (lib/accounts.mjs accountLedger — satır metni saklanan sırayla AYNEN), kart haritası eskisiyle bayt bayt aynı kalır (test/obligation-input-250 hakemi). Numara yalnız
// gösterim / çıktı katmanında bu modülün işlevleriyle eklenir; numarayı başka yerde hesaplamak YASAK.
import { compareItems } from "./plans.mjs";

/**
 * Bir kartın taksitlerinin görünen numaraları.
 * @param {Array<{ id: string, seq: number, dueDate: string, planDueDate?: string }>} items kartın BÜTÜN taksitleri (süzülmemiş). planDueDate: kuyruk görünümünde
 *   (Borçta Kalsın kartı) kalemin günü kayar — numara kartın KENDİ vadesinden (lib/plans.mjs allocate sırası).
 * @returns {Map<string, number>} taksit kimliği → numara
 */
export function itemNumbers(items) {
  const rows = (items || []).map(item => ({ id: item.id, seq: Number(item.seq) || 0, dueDate: String(item.planDueDate || item.dueDate || "") }));
  rows.sort(compareItems);
  return new Map(rows.map((item, index) => [item.id, index + 1]));
}

/**
 * Bütün (ya da verilen) kartların taksit numaraları tek sorguda (ders 47: kart başına okuma yok).
 * @param {{ all: Function }} store
 * @param {Iterable<string>|null} planIds
 * @returns {Map<string, number>} taksit kimliği → numara
 */
export function planItemNumbers(store, planIds = null) {
  const only = planIds ? JSON.stringify([...new Set(planIds)]) : null;
  const rows = only
    ? store.all("SELECT id, plan_id AS planId, seq, due_date AS dueDate FROM plan_items WHERE plan_id IN (SELECT value FROM json_each(?))", only)
    : store.all("SELECT id, plan_id AS planId, seq, due_date AS dueDate FROM plan_items");
  const byPlan = new Map();
  for (const row of rows) {
    if (!byPlan.has(row.planId)) byPlan.set(row.planId, []);
    byPlan.get(row.planId).push(row);
  }
  const out = new Map();
  for (const list of byPlan.values()) for (const [id, no] of itemNumbers(list)) out.set(id, no);
  return out;
}

// Taksit nesnesine (taksit satırı, sıradaki taksit) görünen numara: { ...item, no }.
export const withNo = (item, numbers) => (item ? { ...item, no: numbers.get(item.id) ?? null } : item);

/**
 * Kart görünümüne (kart penceresi, Tablo, makbuz / kart PDF'inin girdisi) görünen numaralar: items[].no, next.no, ownNext.no.
 * @param {{ items: Array, next?: object|null, ownNext?: object|null }} view
 * @param {Map<string, number>} numbers kartın taksitlerinin numaraları (verilmezse view.items'tan)
 */
export function numberedView(view, numbers = itemNumbers(view?.items)) {
  if (!view || !Array.isArray(view.items)) return view;
  const out = { ...view, items: view.items.map(item => withNo(item, numbers)), next: withNo(view.next || null, numbers) };
  if ("ownNext" in view) out.ownNext = withNo(view.ownNext || null, numbers);
  return out;
}

// "N. taksit" (zil / takvim / Vade Takip / nakit akışı etiketi, raporların Taksit sütunu, makbuz açıklaması).
export const itemText = no => (no ? `${no}. taksit` : "");

// Cari defterindeki taksit tahsilatı satırının metni (lib/accounts.mjs accountLedger aynı kalıbı saklanan sırayla kurar — kuyruğun girdisi; gösterim numberedLines ile).
export const planInLabel = (opening, no) => `${opening ? "Açılış (devir)" : "Taksit Tahsilatı"}${no ? ` · ${no}. taksit` : ""}`;

/**
 * Cari defteri satırlarının GÖSTERİLEN metni: "Taksit Tahsilatı · N. taksit" satırlarında N görünen numara. Satırlar değiştirilmez; metni değişen satır kopyalanır.
 * YALNIZ gösterim yollarında (cari kartı ekranı, ekstre PDF / Excel, WhatsApp ekstresi, Tüm Cari Hareketleri); kuyruğun girdisi bu işlevden GEÇMEZ.
 * @param {Array<{ kind: string, itemId?: string, opening?: boolean, label: string }>} lines
 * @param {Map<string, number>} numbers
 */
export function numberedLines(lines, numbers) {
  if (!Array.isArray(lines) || !numbers?.size) return lines;
  return lines.map(line => {
    if (line?.kind !== "plan-in" || !line.itemId || !numbers.has(line.itemId)) return line;
    const label = planInLabel(line.opening, numbers.get(line.itemId));
    return label === line.label ? line : { ...line, label };
  });
}

// Kart listesinden (forAccount öğeleri; her biri items taşır) taksit numaraları — cari kartında ek sorgu yok.
export function numbersOfPlans(plans) {
  const out = new Map();
  for (const plan of plans || []) for (const [id, no] of itemNumbers(plan.items || [])) out.set(id, no);
  return out;
}
