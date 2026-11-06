// 2.5.0 BİRLEŞİK TUR 1 (YB-1): hareket düzeltmesinde iyimser kilit — programın var olan kalıbı (routes/accounts.mjs "account-stale", routes/staff.mjs
// "staff-stale", routes/cheques.mjs "cheque-stale"). Form, açıldığı andaki sürümü gövdede `updatedAt` ile gönderir; satır o andan sonra değiştiyse 409:
// ikinci kaydeden ilkinin düzeltmesini sessizce ezmez. Gövdede `updatedAt` yoksa (bugünkü istemciler) denetim yok, eskisi gibi yazılır (geriye uyumlu).
// Sürüm satırın updated_at'ıdır; hiç düzeltilmemiş satırda boştur — form "" (ya da null) ya da satırın oluşturma damgasını (createdAt) gönderebilir, ikisi de
// "hiç düzeltilmemiş hâlini açtım" demektir. Çağıran denetimi yazım işleminin İÇİNDE (bank.post prepare) yapar: denetimle yazım arasına başka istek giremez.
// Çağıranlar: routes/accounts.mjs (cari hareketi), routes/stock.mjs (stok hareketi), routes/plans.mjs (taksit kartı hareketi), routes/cash.mjs (Kasa hareketi).
// 2.5.0 BİRLEŞİK TUR 3 (YAN-A, YAN-B, 3a; aynı sözleşme): routes/cash.mjs (Kasa Açılış Bakiyesi — cash_entries), routes/plans.mjs (taksit kartı — plans; tek taksit —
// plan_items), routes/stock.mjs (stok kartı — stock_items). Önceden bu formlar sürüm göndermiyordu: öbür kullanıcının düzeltmesi, formdaki eski değerlerle sessizce
// geri yazılıyordu.
import { HttpError } from "./http.mjs";

const TABLES = new Set(["account_entries", "stock_moves", "plan_entries", "cash_entries", "plans", "plan_items", "stock_items"]);

/** Satırın sürüm alanları ({ updatedAt, createdAt }); satır yoksa null. Tablo adı sabit listeden (SQL'e kullanıcı girdisi girmez). */
export function rowVersion(store, table, id) {
  if (!TABLES.has(table)) throw new TypeError(`rowVersion: bilinmeyen tablo "${table}"`);
  return store.get(`SELECT updated_at AS updatedAt, created_at AS createdAt FROM ${table} WHERE id = ?`, id) || null;
}

/** Gövdedeki sürüm (body.updatedAt) güncel satırınkinden farklıysa 409 { code, updatedAt: güncel sürüm }; gövdede sürüm yoksa hiçbir şey yapmaz. */
export function assertRowVersion(body, version, { message, code }) {
  if (!body || typeof body !== "object" || !Object.hasOwn(body, "updatedAt") || body.updatedAt === undefined) return;
  const sent = body.updatedAt === null ? "" : String(body.updatedAt);
  const updated = version?.updatedAt ? String(version.updatedAt) : "";
  const created = version?.createdAt ? String(version.createdAt) : "";
  if (sent === updated || (!updated && sent === created)) return;
  throw new HttpError(409, message, { code, updatedAt: updated || created });
}
