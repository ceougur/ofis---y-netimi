// Dönem sonu stok değerlemesi — TEK İŞLEV (2.5.0 Ç6-HESAP tur 1; docs/erp/C6-HESAP-TASARIM.md §3).
// Kaynak: kural kitabı §5.1 / §5.2 (dönemsel ağırlıklı ortalama alış fiyatı, VUK 274; DEVIR-PLANI §11.4), EK-1 M5 (eksi dönem başı miktar ortalamada 0, miktar devri eksi
// dahil), EK-1 M6 / E3 (t itibarıyla tahmini: aralık [1 Ocak, t]), KG-9 A (eksi miktarlı ürün değeri 0 + Kesin Değil), KG-10 A (alışı ve dönem başı stoku olmayan ürün: kartın ALIŞ fiyatı,
// o da yoksa 0 + uyarı), KG-12 A (önceki yıl sonları da aynı kuralla), G-1 (ürün başına kuruşa yarım yukarı; eksi tutarda mutlak değere; toplam = yuvarlanmış satırların toplamı).
//
// Gelir Tablosu / Bilanço `at(t)`, devir (D3 / D4) `yearEnd(K)` çağırır — iki ayrı formül YOK. Hesap yalnız MİKTAR ve BİRİM MALİYET için stok hareketlerini okur (defterde ürün boyutu
// yoktur); satışların maliyetinin defter biçimi lib/financial-statements.mjs estimatedCost'tadır (153 defter hareketi − DSS). Hiçbir şey yazmaz.
//
// Tamsayı aritmetiği: para kuruş, miktar 1/1000 (roundQty üç ondalık), birim fiyat 1/10.000 TL; ürün değeri BigInt ile tek bölmede yuvarlanır (kayan nokta birikmez).
import { localDayOf, stockOpeningValue } from "./general-ledger.mjs";

/** Hareket sınıfı (defterin 153 maddeleriyle AYNI ayrım — general-ledger journal(): stok açılışı, peşin / açık hesap alım ve iade, fatura matrahı). */
export const MOVE_CLASS = Object.freeze({ opening: "opening", purchase: "purchase", purchaseReturn: "purchaseReturn", quantity: "quantity" });

const QTY_SCALE = 1000;
const PRICE_SCALE = 10000;
const toMilli = qty => Math.round((Number(qty) || 0) * QTY_SCALE);
const toMinor = amount => Math.round((Number(amount) || 0) * 100);
const yearOf = day => Number(String(day).slice(0, 4));
const yearEndDay = year => `${String(year).padStart(4, "0")}-12-31`;

/** n / d (BigInt, d > 0), G-1 yarım yukarı — eksi tutarda mutlak değere. */
function roundDiv(n, d) {
  const negative = n < 0n;
  const a = negative ? -n : n;
  const q = (2n * a + d) / (2n * d);
  return negative ? -q : q;
}

/**
 * Hareketin değerleme sınıfı. row: { kind, reason, pay, invoiced, opening }.
 * - AÇILIŞ (M-07): işaretli, giriş, parasız (defter: B 153 / A 519, değer miktar × birim fiyat).
 * - ALIŞ (F-05 / S-02): giriş, iade değil, açılış değil; fatura bağlı ya da Kasa / cariye yazılmış (defter: B 153).
 * - ALIŞ İADESİ (F-12 / S-05): çıkış, tedarikçiye iade; fatura bağlı ya da Kasa / cariye yazılmış (defter: A 153).
 * - YALNIZ MİKTAR: satış, müşteri iadesi (S-04 birim maliyeti değiştirmez), parasız giriş / çıkış (S-06 sayım farkı).
 */
export function classifyMove(row) {
  const kind = String(row.kind || "");
  const reason = String(row.reason || "");
  const paid = row.pay === "cash" || row.pay === "account" || Number(row.invoiced) === 1;
  if (kind === "in" && Number(row.opening) === 1 && row.pay === "none" && Number(row.invoiced) !== 1 && !reason) return MOVE_CLASS.opening;
  if (kind === "in" && !reason && paid) return MOVE_CLASS.purchase;
  if (kind === "out" && reason === "preturn" && paid) return MOVE_CLASS.purchaseReturn;
  return MOVE_CLASS.quantity;
}

const hasColumn = (store, table, column) => store.all(`PRAGMA table_info(${table})`).some(row => row.name === column);
const hasTable = (store, table) => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));

/**
 * Değerleme girdisi: İKİ toplu sorgu (ürün başına sorgu yok — ders 47). Hizmet kalemi girdiye alınmaz (S-07). Eski dosyada is_opening kolonu yoksa açılış yok (defterle aynı).
 * Dönüş: { items: [{ id, code, name, unit, unitPriceE4, deletedDay }], moves: [{ itemId, date, cls, qtyMilli, valueMinor }] } (hareketler tarih + yazım sırasıyla).
 */
export function loadValuationInput(store) {
  if (!hasTable(store, "stock_items") || !hasTable(store, "stock_moves")) return { items: [], moves: [] };
  const itemKind = hasColumn(store, "stock_items", "kind") ? "i.kind" : "'product'";
  const items = store.all(`SELECT i.id, i.code, i.name, i.unit, i.unit_price AS unitPrice, i.deleted_at AS deletedAt FROM stock_items i WHERE ${itemKind} <> 'service'`).map(row => ({
    id: row.id,
    code: row.code || "",
    name: row.name || "",
    unit: row.unit || "",
    unitPriceE4: Math.round((Number(row.unitPrice) || 0) * PRICE_SCALE),
    deletedDay: row.deletedAt ? localDayOf(row.deletedAt) : "",
  }));
  const known = new Set(items.map(item => item.id));
  const opening = hasColumn(store, "stock_moves", "is_opening") ? "m.is_opening" : "0";
  const reason = hasColumn(store, "stock_moves", "reason") ? "m.reason" : "''";
  const invoiced = hasColumn(store, "stock_moves", "invoice_id") ? "CASE WHEN m.invoice_id <> '' THEN 1 ELSE 0 END" : "0";
  const moves = [];
  for (const row of store.all(`SELECT m.item_id AS itemId, m.kind, m.qty, m.unit_price AS unitPrice, m.amount, m.date, m.pay, ${reason} AS reason, ${invoiced} AS invoiced, ${opening} AS opening
                               FROM stock_moves m ORDER BY m.date, m.rowid`)) {
    if (!known.has(row.itemId)) continue;
    const cls = classifyMove(row);
    const sign = row.kind === "out" ? -1 : 1;
    const valueMinor = cls === MOVE_CLASS.opening ? toMinor(stockOpeningValue(row)) : cls === MOVE_CLASS.quantity ? 0 : toMinor(row.amount);
    moves.push({ itemId: row.itemId, date: String(row.date), cls, qtyMilli: sign * toMilli(row.qty), valueMinor });
  }
  return { items, moves };
}

const emptyYear = () => ({ openQ: 0, openV: 0, buyQ: 0, buyV: 0, retQ: 0, retV: 0 });

/**
 * Değerleme. input: loadValuationInput çıktısı (testler elle de verir).
 * at(t, { detail }) → t günü sonu itibarıyla t'nin yılı için (tahmini; t = 31 Aralık'ta kesin değerleme):
 *   { date, year, totals: { dbsMinor, openingMinor, purchaseMinor, returnMinor, dssMinor, smmStockMinor }, negative: [...], warnings: [...], products?: [...] }
 * yearEnd(Y, opts) = at("Y-12-31", opts).
 */
export function createStockValuation({ items = [], moves = [] } = {}) {
  const itemById = new Map(items.map(item => [item.id, item]));
  // Ürün → yıl → hareketler (girdi tarih sırasında).
  const byItem = new Map();
  let firstYear = Infinity;
  for (const move of moves) {
    if (!itemById.has(move.itemId)) continue;
    const year = yearOf(move.date);
    if (!Number.isFinite(year)) continue;
    firstYear = Math.min(firstYear, year);
    let years = byItem.get(move.itemId);
    if (!years) byItem.set(move.itemId, (years = new Map()));
    let list = years.get(year);
    if (!list) years.set(year, (list = []));
    list.push(move);
  }
  // Yıl sonu durumu (ürün başına): { qMilli (gerçek miktar, eksi dahil), vMinor (DSS değeri) }. Yıl → Map. Kesin: yalnız ≤ 31.12 hareketlerine bağlıdır → saklanır.
  const ends = new Map();
  const base = new Map(); // ilk yıldan önce: her ürün 0.

  function valueOf(item, qMilli, acc, prior, day) {
    // M5: eksi dönem başı miktar ortalamada 0; değer KG-9 A gereği zaten 0.
    const q0 = Math.max(0, prior.qMilli);
    const num = BigInt(prior.vMinor + acc.openV + acc.buyV - acc.retV);
    const den = BigInt(q0 + acc.openQ + acc.buyQ - acc.retQ);
    const deleted = Boolean(item.deletedDay) && item.deletedDay <= day;
    let basis = "ortalama";
    let unitCost = den > 0n ? Number(num) / (Number(den) / QTY_SCALE) / 100 : 0;
    if (den <= 0n) {
      basis = item.unitPriceE4 > 0 ? "kart" : "yok";
      unitCost = item.unitPriceE4 / PRICE_SCALE;
    }
    let vMinor = 0;
    if (qMilli > 0 && !deleted) {
      if (den > 0n) vMinor = Number(roundDiv(BigInt(qMilli) * num, den));
      else vMinor = Number(roundDiv(BigInt(qMilli) * BigInt(item.unitPriceE4), BigInt(QTY_SCALE * 100)));
    }
    return { vMinor, unitCost, basis, deleted, negativeUnit: den > 0n && num < 0n };
  }

  function stateAt(year, day, { detail = false } = {}) {
    const prior = year - 1 < firstYear ? base : endOf(year - 1);
    const totals = { dbsMinor: 0, openingMinor: 0, purchaseMinor: 0, returnMinor: 0, dssMinor: 0, smmStockMinor: 0 };
    const negative = [];
    const warnings = [];
    const products = detail ? [] : null;
    const state = new Map();
    for (const item of items) {
      const before = prior.get(item.id) || { qMilli: 0, vMinor: 0 };
      const acc = emptyYear();
      let qMilli = before.qMilli;
      for (const move of byItem.get(item.id)?.get(year) || []) {
        if (move.date > day) break;
        qMilli += move.qtyMilli;
        if (move.cls === MOVE_CLASS.opening) {
          acc.openQ += move.qtyMilli;
          acc.openV += move.valueMinor;
        } else if (move.cls === MOVE_CLASS.purchase) {
          acc.buyQ += move.qtyMilli;
          acc.buyV += move.valueMinor;
        } else if (move.cls === MOVE_CLASS.purchaseReturn) {
          acc.retQ -= move.qtyMilli; // çıkış: qtyMilli eksi
          acc.retV += move.valueMinor;
        }
      }
      const value = valueOf(item, qMilli, acc, before, day);
      state.set(item.id, { qMilli, vMinor: value.vMinor });
      totals.dbsMinor += before.vMinor;
      totals.openingMinor += acc.openV;
      totals.purchaseMinor += acc.buyV;
      totals.returnMinor += acc.retV;
      totals.dssMinor += value.vMinor;
      const qty = qMilli / QTY_SCALE;
      const name = { id: item.id, code: item.code, name: item.name, unit: item.unit, qty };
      const active = qMilli !== 0 || before.qMilli !== 0 || acc.openQ || acc.buyQ || acc.retQ;
      if (qMilli < 0 && !value.deleted) negative.push(name);
      if (active && qMilli > 0 && !value.deleted && value.basis === "kart") warnings.push({ ...name, type: "kart-fiyati" });
      if (active && qMilli > 0 && !value.deleted && value.basis === "yok") warnings.push({ ...name, type: "fiyat-yok" });
      if (active && qMilli > 0 && value.negativeUnit && !value.deleted) warnings.push({ ...name, type: "eksi-birim-maliyet" });
      if (active && qMilli > 0 && value.deleted) warnings.push({ ...name, type: "silinmis-urun", deletedDay: item.deletedDay });
      if (products && active) {
        products.push({ ...name, dbsQty: Math.max(0, before.qMilli) / QTY_SCALE, dbsMinor: before.vMinor, openingQty: acc.openQ / QTY_SCALE, openingMinor: acc.openV, purchaseQty: acc.buyQ / QTY_SCALE,
          purchaseMinor: acc.buyV, returnQty: acc.retQ / QTY_SCALE, returnMinor: acc.retV, unitCost: Math.round(value.unitCost * 10000) / 10000, basis: value.basis, valueMinor: value.vMinor,
          deleted: value.deleted });
      }
    }
    totals.smmStockMinor = totals.dbsMinor + totals.openingMinor + totals.purchaseMinor - totals.returnMinor - totals.dssMinor;
    return { state, out: { date: day, year, totals, negative, warnings, ...(products ? { products } : {}) } };
  }

  function endOf(year) {
    if (year < firstYear) return base;
    if (ends.has(year)) return ends.get(year).state;
    // Önceki yıllar sırayla (özyineleme derinliği yıl sayısı kadar; döngüyle kurulur).
    for (let y = firstYear; y <= year; y += 1) if (!ends.has(y)) ends.set(y, stateAt(y, yearEndDay(y)));
    return ends.get(year).state;
  }

  function at(day, options = {}) {
    const year = yearOf(day);
    if (!Number.isFinite(year)) throw new Error(`Geçersiz tarih: ${day}`);
    if (!options.detail && day === yearEndDay(year) && year >= firstYear) {
      endOf(year);
      return ends.get(year).out;
    }
    return stateAt(year, day, options).out;
  }

  return { at, yearEnd: (year, options = {}) => at(yearEndDay(year), options), firstYear: Number.isFinite(firstYear) ? firstYear : null };
}
