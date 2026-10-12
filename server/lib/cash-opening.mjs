// Kasa açılışı / devir (2.2.0 İz 1.3; K6, hakem 10.10.2026 "KASA-ACILIS-649"). Plan susuyor → yaygın muhasebe (Tekdüzen açılış fişi):
// Kasa'ya devreden nakit B 100 / A 500 "Açılış ve Devir Bakiyeleri" — banka hesabı açılışı (bank/voucher.mjs openingLines), cari açılışı ve
// taksit açılışıyla aynı karşı hesap (general-ledger.mjs). Önceden Kasa'ya elle giriş olarak 649'a (gelir) yazılıyordu.
//
// Tanım: açılış, Kasa'ya NAKİT elle girişidir (cash_entries, kind 'in', transfer değil) ve açıklaması "Açılış" ile başlar (cari açılışıyla aynı
// kural: general-ledger.mjs isOpeningText). Kasa → Açılış Bakiyesi bu satırı "Açılış Bakiyesi" açıklamasıyla yazar; eski yoldan elle "Açılış …"
// yazılan giriş de açılıştır (aynı kurallarla). Kurallar (routes/cash.mjs, routes/trash.mjs): yalnız yönetici (system.manage) girer, düzeltir,
// siler, geri yükler ya da bir girişi açılışa çevirir; bir kez (ikincisi 409 cash-opening-exists); tarihi Kasa'nın açılış dışındaki ilk nakit
// hareketinden sonra olamaz (409 cash-opening-after-first; banka açılışının kuralı); dönem kilidi ve ileri tarih her Kasa hareketi gibi.
import { isOpeningText } from "./general-ledger.mjs";

/** Kasa → Açılış Bakiyesi'nin yazdığı açıklama. */
export const CASH_OPENING_TEXT = "Açılış Bakiyesi";

/** Satır Kasa açılışı mı (nakit, giriş, transfer değil, açıklaması "Açılış …"). transferId / transfer_id ikisi de okunur. */
export function isCashOpening(row) {
  if (!row || row.kind !== "in") return false;
  if (String(row.transferId ?? row.transfer_id ?? "")) return false;
  if ((row.method || "cash") !== "cash") return false;
  return isOpeningText(row.description);
}

const COLUMNS = "id, kind, amount, date, description, method, transfer_id AS transferId, created_at AS createdAt";
// "Açılış" ASCII "A" ile başlar: aday satırlar SQL'de daraltılır (lower yalnız ASCII), Türkçe büyük/küçük harf kuralı JS'de.
const CANDIDATES = `SELECT ${COLUMNS} FROM cash_entries WHERE kind = 'in' AND COALESCE(transfer_id, '') = '' AND method = 'cash' AND lower(substr(trim(description), 1, 1)) = 'a' ORDER BY date, created_at, id`;

/** Kasa açılışları (tarih sırasıyla; normalde en çok bir). except: bu satır sayılmaz (düzeltilen). */
export function cashOpenings(store, { except = "" } = {}) {
  return store.all(CANDIDATES).filter(row => row.id !== except && isCashOpening(row));
}

/**
 * Kasa'nın açılış DIŞINDAKİ ilk nakit hareketinin tarihi ('' = yok): bütün kaynaklar (kayıt tahsilatı, cari, fatura, taksit, stok, çek, Kasa ↔
 * Banka) tek kaynaktan (money-lines), Kasa elle girişleri ayrıca (açılışlar ve except satırı hariç).
 */
export function firstCashMovement(store, money, { except = "" } = {}) {
  let first = money?.firstDate ? money.firstDate("cash", { skip: [2] }) : "";
  const take = date => {
    if (date && (!first || date < first)) first = String(date);
  };
  take(store.get("SELECT MIN(date) AS d FROM cash_entries WHERE method = 'cash' AND id <> ? AND NOT (kind = 'in' AND COALESCE(transfer_id, '') = '' AND lower(substr(trim(description), 1, 1)) = 'a')", except)?.d);
  // "A" ile başlayan ama açılış olmayan girişler ("Avans", "Ali'den tahsilat"): Türkçe kuralla ayrıca.
  for (const row of store.all(CANDIDATES)) {
    if (first && row.date >= first) break;
    if (row.id !== except && !isCashOpening(row)) take(row.date);
  }
  return first;
}
