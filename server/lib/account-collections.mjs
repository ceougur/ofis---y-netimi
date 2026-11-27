// 2.5.1 Mİ-2 — carilerin DÖNEMLİK tahsilatı, yol kırılımıyla (Cari ekranının "Tahsilat" kartı / sütunu ve Grup Özeti).
// KULLANICI 27.11 (AYNEN): "kasaya giriş derken tüm tahsilat yollarını kastettim. nakit, pos, havale, çek, senet. önerin yani".
// TANIM 'Cari Bazında Tahsilat' raporuyla AYNI (routes/report-center.mjs cari-tahsilat: carinin defterinde alacak tarafındaki Tahsilat, taksit tahsilatı, alınan
// çek / senet ve Excel'den gelen önceden ödenen); bu yardımcı defteri kurmadan aynı kayıtları TOPLU SQL ile okur (ders 47 — cari başına okuma yok):
//   1. account_entries kind 'in'                       → yol `method`: cash Nakit · card POS · bank Havale / EFT; kaynağı banka olan POS Komisyon İadesi,
//                                                        Kredi Kartına İade (kart yolu + bağı Kredi Kartı hesabı) ve tanınmayan yol → Diğer
//   2. account_entries source 'cheque' kind 'credit'   → evrakın türü: cheque Çek · note Senet (evrak yoksa Diğer)
//   3. plan_entries kind 'in' (kartı silinmemiş, carili) → opening = 1 Önceden Ödenen (AYRI; dönem toplamına KARIŞMAZ); evraklı → Çek / Senet; değilse yol
// Cari silinmişse sayılmaz (rapor da silinmemiş carileri okur). Tutarlar kuruşla toplanır.
import { roundMoney } from "./money.mjs";

export const COLLECTION_WAYS = Object.freeze(["cash", "card", "bank", "cheque", "note", "other"]);
// Görünen adlar (yazım düzeni: her sözcüğün ilk harfi büyük). Kart / sütun / PDF / Excel aynı ad.
export const COLLECTION_LABELS = Object.freeze({ cash: "Nakit", card: "POS", bank: "Havale / EFT", cheque: "Çek", note: "Senet", other: "Diğer", opening: "Önceden Ödenen (Açılış)" });
export const PERIOD_LABELS = Object.freeze({ today: "Bugün", yesterday: "Dün", week: "Bu Hafta", month: "Bu Ay", range: "Tarih Aralığı" });

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const realDay = value => DAY.test(String(value || "")) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const shift = (iso, days) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * Dönemin sınırları (ikisi de DAHİL). key: today | yesterday | week | month | range. Bilinmeyen anahtar → null (dönem yok).
 * Bu Hafta pazartesi–pazar; Bu Ay ayın 1'i – son günü (raporun "Bu Ay"ı ile aynı). Tarih Aralığı geçersizse { error }.
 * @param {string} key
 * @param {string} today  YYYY-MM-DD (sunucunun "bugün"ü)
 * @param {{ from?: string, to?: string }} [range]
 */
export function periodOf(key, today, { from = "", to = "" } = {}) {
  if (key === "today") return { key, from: today, to: today };
  if (key === "yesterday") return { key, from: shift(today, -1), to: shift(today, -1) };
  if (key === "week") {
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // pazartesi 0
    return { key, from: shift(today, -weekday), to: shift(today, 6 - weekday) };
  }
  if (key === "month") {
    const [y, m] = today.split("-").map(Number);
    return { key, from: `${today.slice(0, 7)}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
  }
  if (key === "range") {
    if (!realDay(from) || !realDay(to)) return { key, error: "Tarih aralığının başlangıç ve bitiş günlerini seçin." };
    if (from > to) return { key, error: "Başlangıç tarihi bitiş tarihinden sonra olamaz." };
    return { key, from, to };
  }
  return null;
}

export const emptyCollected = () => ({ total: 0, cash: 0, card: 0, bank: 0, cheque: 0, note: 0, other: 0, opening: 0 });

// Kuruşla toplanmış kırılımı TL'ye çevirir; total = beş yol + Diğer (açılış hariç).
function toMoney(minor) {
  const out = emptyCollected();
  for (const way of COLLECTION_WAYS) out[way] = roundMoney((minor[way] || 0) / 100);
  out.opening = roundMoney((minor.opening || 0) / 100);
  out.total = roundMoney(COLLECTION_WAYS.reduce((sum, way) => sum + (minor[way] || 0), 0) / 100);
  return out;
}
const methodWay = method => (method === "card" ? "card" : method === "bank" ? "bank" : method === "cash" || !method ? "cash" : "other");
const instrumentWay = instrument => (instrument === "cheque" ? "cheque" : instrument === "note" ? "note" : "other");
const MINOR = "CAST(ROUND(SUM(CAST(ROUND(e.amount * 100) AS INTEGER))) AS INTEGER)";

/**
 * Dönemde her cariden alınan para, yol kırılımıyla. Dönüş: Map(accountId → { total, cash, card, bank, cheque, note, other, opening }) — yalnız dönemde kaydı olan cariler.
 * @param {{ all: Function, get: Function }} store
 * @param {{ from: string, to: string }} period
 */
export function collectionsByAccount(store, { from, to }) {
  const minor = new Map();
  const add = (accountId, way, amount) => {
    if (!accountId || !amount) return;
    if (!minor.has(accountId)) minor.set(accountId, {});
    const row = minor.get(accountId);
    row[way] = (row[way] || 0) + Number(amount);
  };
  // Kredi Kartına İade: giriş + kart yolu + bağı Kredi Kartı hesabı (routes/accounts.mjs detail cardRefund ile aynı kural). Banka tabloları yoksa (göç öncesi) yok.
  let cardRefund = "0";
  try {
    store.get("SELECT 1 AS found FROM bank_accounts LIMIT 1");
    cardRefund = "(e.method = 'card' AND e.fin_ref IN (SELECT id FROM bank_accounts WHERE kind = 'card'))";
  } catch {
    cardRefund = "0";
  }
  const live = "JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL";
  for (const row of store.all(
    `SELECT e.account_id AS accountId, e.method, CASE WHEN e.source = 'bank' OR ${cardRefund} THEN 1 ELSE 0 END AS odd, ${MINOR} AS minor
       FROM account_entries e ${live} WHERE e.kind = 'in' AND e.date >= ? AND e.date <= ? GROUP BY e.account_id, e.method, odd`,
    from,
    to,
  ))
    add(row.accountId, Number(row.odd) ? "other" : methodWay(row.method), row.minor);
  for (const row of store.all(
    `SELECT e.account_id AS accountId, COALESCE(c.instrument, '') AS instrument, ${MINOR} AS minor
       FROM account_entries e ${live} LEFT JOIN cheques c ON c.id = e.source_id
      WHERE e.source = 'cheque' AND e.kind = 'credit' AND e.date >= ? AND e.date <= ? GROUP BY e.account_id, instrument`,
    from,
    to,
  ))
    add(row.accountId, instrumentWay(row.instrument), row.minor);
  for (const row of store.all(
    `SELECT p.account_id AS accountId, e.method, CASE WHEN e.opening = 1 THEN 1 ELSE 0 END AS opening, CASE WHEN COALESCE(e.cheque_id, '') <> '' THEN 1 ELSE 0 END AS evrak,
            COALESCE(c.instrument, '') AS instrument, ${MINOR} AS minor
       FROM plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL AND p.account_id <> '' JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL
       LEFT JOIN cheques c ON c.id = e.cheque_id AND COALESCE(e.cheque_id, '') <> ''
      WHERE e.kind = 'in' AND e.date >= ? AND e.date <= ? GROUP BY p.account_id, e.method, opening, evrak, instrument`,
    from,
    to,
  ))
    add(row.accountId, Number(row.opening) ? "opening" : Number(row.evrak) ? instrumentWay(row.instrument) : methodWay(row.method), row.minor);
  const out = new Map();
  for (const [accountId, row] of minor) out.set(accountId, toMoney(row));
  return out;
}

// Toplama (satırlar → grup / TOPLAM): kuruşla, yuvarlama farkı birikmesin.
export function addCollected(target, source) {
  if (!source) return target;
  for (const key of [...COLLECTION_WAYS, "opening", "total"]) target[key] = roundMoney((Math.round((target[key] || 0) * 100) + Math.round((source[key] || 0) * 100)) / 100);
  return target;
}
