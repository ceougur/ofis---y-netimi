// Kasa açılışı / devir (2.2.0 İz 1.3; K6, hakem 10.10.2026 "KASA-ACILIS-649"). Plan susuyor → yaygın muhasebe (Tekdüzen açılış fişi):
// Kasa'ya devreden nakit B 100 / A 500 "Açılış ve Devir Bakiyeleri" — banka hesabı açılışı (bank/voucher.mjs openingLines), cari açılışı ve
// taksit açılışıyla aynı karşı hesap (general-ledger.mjs). Önceden Kasa'ya elle giriş olarak 649'a (gelir) yazılıyordu.
//
// Tanım (Yargıç 2.2.0 Y2/Y3 düzeltmesi): açılış, Kasa → Açılış Bakiyesi ucunun yazdığı İŞARETLİ satırdır (cash_entries.is_opening = 1, göç 22).
// Açıklama metni açılışı BELİRLEMEZ: önceden "Açılış …" ile başlayan her nakit giriş açılış sayılıyordu — 2.1.0'da 200 dönen "Açılış kampanyası
// hasılatı" 409/403 alıyor, eski verinin birden çok "Açılış …" girişi düzeltilemiyor ve kilitli dönemde bile 649'dan 500'e kayıyordu. Artık
// açıklaması "Açılış" ile başlayan sıradan giriş 2.1.0'daki gibi sıradan Kasa girişidir (649); eski veride hiçbir satır kendiliğinden açılışa
// çevrilmez. Kurallar (routes/cash.mjs, routes/trash.mjs) yalnız işaretli satıra uygulanır: yalnız yönetici (system.manage) girer, düzeltir,
// siler, geri yükler; bir kez (ikincisi 409 cash-opening-exists); tarihi Kasa'nın açılış dışındaki ilk nakit hareketinden sonra olamaz (409
// cash-opening-after-first; banka açılışının kuralı); dönem kilidi ve ileri tarih her Kasa hareketi gibi.

/** Kasa → Açılış Bakiyesi'nin yazdığı açıklama. */
export const CASH_OPENING_TEXT = "Açılış Bakiyesi";

/** Satır Kasa açılışı mı (işaretli; nakit giriş, transfer değil). isOpening / is_opening ikisi de okunur. */
export function isCashOpening(row) {
  if (!row || row.kind !== "in") return false;
  if (String(row.transferId ?? row.transfer_id ?? "")) return false;
  if ((row.method || "cash") !== "cash") return false;
  return Number(row.isOpening ?? row.is_opening ?? 0) === 1;
}

const COLUMNS = "id, kind, amount, date, description, method, transfer_id AS transferId, is_opening AS isOpening, created_at AS createdAt";
const OPENINGS = `SELECT ${COLUMNS} FROM cash_entries WHERE is_opening = 1 ORDER BY date, created_at, id`;

/** Kasa açılışları (tarih sırasıyla; normalde en çok bir). except: bu satır sayılmaz (düzeltilen). */
export function cashOpenings(store, { except = "" } = {}) {
  return store.all(OPENINGS).filter(row => row.id !== except && isCashOpening(row));
}

/** Kayıtlı satır (kimlikle) Kasa açılışı mı. */
export function isCashOpeningId(store, id) {
  return isCashOpening(store.get(`SELECT ${COLUMNS} FROM cash_entries WHERE id = ?`, id));
}

/**
 * Kasa'nın açılış DIŞINDAKİ ilk nakit hareketinin tarihi ('' = yok): bütün kaynaklar (kayıt tahsilatı, cari, fatura, taksit, stok, çek, Kasa ↔
 * Banka) tek kaynaktan (money-lines), Kasa elle girişleri ayrıca (işaretli açılışlar ve except satırı hariç).
 */
export function firstCashMovement(store, money, { except = "" } = {}) {
  let first = money?.firstDate ? money.firstDate("cash", { skip: [2] }) : "";
  const own = store.get("SELECT MIN(date) AS d FROM cash_entries WHERE method = 'cash' AND id <> ? AND is_opening = 0", except)?.d;
  if (own && (!first || own < first)) first = String(own);
  return first;
}
