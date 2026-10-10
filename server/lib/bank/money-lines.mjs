// Tek kaynak: moneyLines — "para satırı" tanımı ve okuma yolu tek yerde (v2.1.0; docs/BANKA-MODULU-PLAN.md §3.4 K5, §3.3/b K6).
//
// moneyLines'ın 9 kaynağı: Kasa'yı, bankayı ya da POS'u gerçekten değiştiren satırlar. Aynı tanımdan üretilir:
//   - "para satırı" yüklemi: SQL koşulu (moneyWhere: COMMIT öncesi money:event denetimi, onarım) ve JS yüklemi (isMoneyRow:
//     bank.eventFor, bank.assertNonMoney);
//   - okuma yolu: tek SQL (9 kaynağın UNION ALL'ı) — özet sorgusu (summary, groups: ANLIK DURUM'un Kasa/Banka kutuları, nakit akışı
//     başlangıcı, eksi bakiye denetimi, Ana Defter'in beklenenleri) ve satır sorgusu (rows/lines: Kasa penceresi, Kasa Dökümü PDF'i,
//     Banka ve POS Hareketleri, nakit akışı ve vade takipteki ileri tarihli Kasa hareketleri) aynı ifade + süzgeç + sıralamadır.
// "Yol" (way) hiçbir tabloya yazılmaz, SQL'de türetilir: cash (nakit), bank (havale/EFT; banka hesabına), card (POS; POS'a ya da
// Hesabı Atanmamış), ccard (kurumsal kredi kartı, 309), loan (kredi, 300), unknown (tanınmayan yol — money:method kırar). Hesap kimliği
// (ref) satırın fin_ref'idir ('' = Hesabı Atanmamış Eski Hareketler: 102.00 / 108.00). internal = iç hareket (Kasa ↔ Banka, bankalar
// arası, kredi, döviz al/sat, valör geçişi).
// Para olmayan satırlar bu tanıma girmez: cari Borç Yaz / Alacak Yaz ve açılışı, fatura borcu/alacağı, çekten ve stoktan gelen
// cari satırı (source 'cheque' / 'stock'), taksit açılışı (opening = 1) ve çekle sayılan taksit tahsilatı (cheque_id dolu), açık
// hesaba ya da yalnız miktar olarak yazılan stok hareketi, çekin alındı/verildi/ciro/karşılıksız olayları.
// Görünürlük (2.0.26'daki modül tanımlarıyla aynı): silinen carinin, taksit kartının ve çekin para satırı okunmaz; faturanın peşini
// faturası olan satırdır; stok hareketi ürün kartıyla (silinse de satır kalır) okunur.
import { INSTRUMENTS } from "../cheques.mjs";
import { INVOICE_KINDS } from "../invoice-math.mjs";
import { roundMoney, toCents } from "../money.mjs";
import { INTERNAL_TYPES, typeLabel } from "./event-types.mjs";

const INTERNAL_SQL = [...INTERNAL_TYPES].map(type => `'${type}'`).join(", ");
// Banka görünümlerinin "Bugün / Bu Ay" giriş-çıkışına girmeyen düzeltme fişleri (açılış, Devir Kapanışı, eski bakiye aktarımı ve ters kayıtları;
// Banka ve POS Hareketleri raporundaki "Açılış ve Devir Düzeltmeleri" ile aynı küme).
const ADJUST_SQL = ["opening", "carry_close", "legacy_reclass"].map(type => `'${type}'`).join(", ");

/**
 * Kaynak: tablo + koşullar ([kolon, izinli değerler, boşluk değeri]) + isteğe bağlı "sıfırdan büyük" kolon (para satırı yüklemi) ve okuma
 * tanımı (read): takma ad, görünürlük JOIN'leri, yön (Kasa/banka tarafına giriş-çıkış), cari, iç hareket, görüntü alanları, sıra (rank:
 * 2.0.26'daki Kasa satır listesinin kaynak sırası — aynı gün ve aynı zaman damgalı satırlar bu sırayla gelir).
 */
export const MONEY_SOURCES = Object.freeze([
  {
    id: 1, table: "payments", when: [],
    read: { name: "payment", rank: 1, alias: "p", from: "payments p", kind: "'in'", party: "''", internal: "0", extra: "json_object('description', p.note, 'caseKey', p.case_key, 'caseTitle', p.case_title)" },
  },
  // Kasa elle girişleri ve Kasa ↔ Banka transferinin iki bacağı.
  {
    id: 2, table: "cash_entries", when: [],
    read: { name: "manual", rank: 2, alias: "c", from: "cash_entries c", kind: "c.kind", party: "''", internal: "CASE WHEN COALESCE(c.transfer_id, '') <> '' THEN 1 ELSE 0 END", extra: "json_object('description', c.description, 'transferId', c.transfer_id)" },
  },
  {
    id: 3, table: "account_entries", when: [["source", [""], ""], ["kind", ["in", "out"], ""]],
    read: { name: "account", rank: 4, alias: "e", from: "account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL", kind: "e.kind", party: "e.account_id", internal: "0", fx: true, extra: "json_object('description', e.note, 'accountId', e.account_id, 'accountName', a.name)" },
  },
  {
    id: 4, table: "account_entries", when: [["source", ["invoice"], ""], ["kind", ["in", "out"], ""]],
    read: { name: "invoice", rank: 7, alias: "e", from: "account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL JOIN invoices i ON i.id = e.source_id", kind: "e.kind", party: "e.account_id", internal: "0", extra: "json_object('note', e.note, 'accountId', e.account_id, 'accountName', a.name, 'invoiceId', i.id, 'number', i.number, 'invoiceKind', i.kind)" },
  },
  // POS kesintisi, komisyon tahsili, komisyon iadesi (Aşama 10'da yazılır).
  {
    id: 5, table: "account_entries", when: [["source", ["bank"], ""]],
    read: { name: "bank", rank: 8, alias: "e", from: "account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL", kind: "e.kind", party: "e.account_id", internal: "0", fx: true, extra: "json_object('description', e.note, 'accountId', e.account_id, 'accountName', a.name)" },
  },
  {
    id: 6, table: "plan_entries", when: [["cheque_id", [""], ""], ["opening", [0], 0]],
    read: { name: "plan", rank: 3, alias: "e", from: "plan_entries e JOIN plans p ON p.id = e.plan_id AND p.deleted_at IS NULL", kind: "e.kind", party: "COALESCE(p.account_id, '')", internal: "0", extra: "json_object('description', e.note, 'planId', e.plan_id, 'planName', p.name)" },
  },
  // Stok girişi (alım) Kasa'dan çıkış, stok çıkışı (satış) Kasa'ya giriştir. Ürün silinse de para gerçektir; satır kalır.
  {
    id: 7, table: "stock_moves", when: [["pay", ["cash"], ""]], positive: "amount",
    read: { name: "stock", rank: 5, alias: "m", from: "stock_moves m JOIN stock_items i ON i.id = m.item_id", kind: "CASE m.kind WHEN 'in' THEN 'out' ELSE 'in' END", party: "COALESCE(m.account_id, '')", internal: "0", extra: "json_object('moveKind', m.kind, 'reason', m.reason, 'qty', m.qty, 'note', m.note, 'itemId', m.item_id, 'itemName', i.name, 'unit', i.unit)" },
  },
  // Çek/senet: alınan evrak tahsil edilince giriş, verilen evrak ödenince çıkış (alınca/verilince Kasa değişmez).
  {
    id: 8, table: "cheque_events", when: [["kind", ["collect", "pay"], ""]],
    read: { name: "cheque", rank: 6, alias: "ev", from: "cheque_events ev JOIN cheques c ON c.id = ev.cheque_id AND c.deleted_at IS NULL", rowJoin: "LEFT JOIN accounts ca ON ca.id = c.account_id", kind: "CASE ev.kind WHEN 'collect' THEN 'in' ELSE 'out' END", party: "COALESCE(c.account_id, '')", internal: "0", updated: "ev.created_at", extra: "json_object('eventKind', ev.kind, 'note', ev.note, 'chequeId', c.id, 'instrument', c.instrument, 'serialNo', c.serial_no, 'drawer', c.drawer, 'accountName', COALESCE(ca.name, ''))" },
  },
  // Banka Fişi (Aşama 4+): yalnız para rolündeki satırlar (banka, POS, kurumsal kart, kredi). Gider/vergi/gelir satırları para değildir.
  {
    id: 9, table: "bank_lines", when: [["role", ["bank", "pos", "card", "loan"], ""]],
    read: {
      name: "bankLine", rank: 9, alias: "l", from: "bank_lines l JOIN fin_events fe ON fe.id = l.event_id", kind: "CASE l.side WHEN 'D' THEN 'in' ELSE 'out' END",
      amount: "l.try_minor / 100.0", cents: "l.try_minor", date: "fe.date", method: "CASE l.role WHEN 'bank' THEN 'bank' WHEN 'loan' THEN 'loan' ELSE 'card' END", ref: "l.ref",
      // Aşama 9: iç hareketin (transfer, Kasa ↔ Banka, kredi, kart borcu) ters kaydı da iç harekettir (asıl işlemin türüyle; dış giriş/çıkış sayılmaz).
      party: "COALESCE(fe.party_id, '')", internal: `CASE WHEN fe.type IN (${INTERNAL_SQL}) THEN 1 WHEN fe.type = 'reversal' AND EXISTS (SELECT 1 FROM fin_events io WHERE io.id = fe.reversal_of AND io.type IN (${INTERNAL_SQL})) THEN 1 ELSE 0 END`,
      wayHint: "CASE l.role WHEN 'bank' THEN 'bank' WHEN 'pos' THEN 'card' WHEN 'card' THEN 'ccard' ELSE 'loan' END",
      created: "fe.created_at", updated: "fe.updated_at", actor: "fe.created_by", eventId: "l.event_id", valueDate: "fe.value_date", fxMinor: "l.fx_minor", currency: "l.currency",
      // baseType: ters kaydın asıl işlem türü (raporlarda açılış/Devir Kapanışı zincirinin ters kaydı da düzeltme sayılır).
      extra: "json_object('description', fe.description, 'eventType', fe.type, 'eventNo', fe.no, 'baseType', CASE WHEN fe.type = 'reversal' THEN (SELECT o.type FROM fin_events o WHERE o.id = fe.reversal_of) ELSE fe.type END)",
    },
  },
]);

/** Para satırı taşıyan tablolar (kaynak tabloları). */
export const SOURCE_TABLES = Object.freeze([...new Set(MONEY_SOURCES.map(source => source.table))]);
/** Modül satırı tabloları (event_id kolonu, bugünkü modüllerin yazdığı): bank_lines Banka Fişi'dir. */
export const MODULE_TABLES = Object.freeze(["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"]);
/** K6'nın para tabloları (§3.3/a): yazımı bank.post'tan, store.raw'dan ya da izinli listeden geçer. */
export const LEDGER_TABLES = Object.freeze([...MODULE_TABLES, "bank_lines", "fin_events", "pos_sales", "pos_items", "cheque_collections"]);
/** Yollar (way). */
export const WAYS = Object.freeze(["cash", "bank", "card", "ccard", "loan", "unknown"]);
/** Kasa/rapor yol süzgeci (2.0.26'daki methodFilter'ın karşılığı): cash | bank | card | noncash | "" (hepsi). */
export function waysFor(method) {
  switch (String(method || "")) {
    case "cash":
      return ["cash"];
    case "bank":
      return ["bank"];
    // GG2: kurumsal kart (309) ve kredi (300) BORÇTUR; "POS / Kredi Kartı" ve "Banka ve POS" görünümleri varlıktır (102 + 108). Önceden kart
    // borcu POS altında "çıkış", kredi bacağı banka ve POS toplamında görünüyordu.
    case "card":
      return ["card"];
    case "noncash":
      return ["bank", "card"];
    default:
      return null;
  }
}

// K6 (c) kapsamı dışındaki kolonlar: para satırının PARASINI değiştirmeyen yazımlar (açıklama, makbuz no, taksit/fatura/çek bağı,
// güncelleme damgası). İşlem başlığının kopyası (tutar, yol, yön, hesap, cari, tarih) bunlardan etkilenmez; bu kolonlara UPDATE
// bank.post bağlamı dışında da yapılabilir (fatura numarasının açıklamalara yazılması, taksitlerin yeniden kurulması gibi).
const COMMON_FREE = ["note", "updated_by", "updated_at"];
export const FREE_COLUMNS = Object.freeze({
  payments: new Set([...COMMON_FREE, "case_title"]),
  cash_entries: new Set([...COMMON_FREE, "description"]),
  account_entries: new Set([...COMMON_FREE, "receipt_no", "invoice_id"]),
  plan_entries: new Set([...COMMON_FREE, "receipt_no", "item_id"]),
  stock_moves: new Set([...COMMON_FREE]),
  cheque_events: new Set([...COMMON_FREE, "effects_json"]),
  bank_lines: new Set(["memo"]),
  fin_events: new Set(["description", "reference", "counter_name", "counter_iban", "channel", "updated_by", "updated_at"]),
});

const quote = value => (typeof value === "number" ? String(value) : `'${String(value).replace(/'/g, "''")}'`);
const conditionSql = (source, alias) => {
  const p = alias ? `${alias}.` : "";
  const parts = source.when.map(([column, values, empty]) => `COALESCE(${p}${column}, ${quote(empty)}) IN (${values.map(quote).join(", ")})`);
  if (source.positive) parts.push(`${p}${source.positive} > 0`);
  return parts.length ? `(${parts.join(" AND ")})` : "(1 = 1)";
};

/** Tablonun para satırı koşulu (SQL); tablo kaynak değilse null. alias: tablo takma adı (ör. "e"). */
export function moneyWhere(table, alias = "") {
  const sources = MONEY_SOURCES.filter(source => source.table === table);
  if (!sources.length) return null;
  return sources.length === 1 ? conditionSql(sources[0], alias) : `(${sources.map(source => conditionSql(source, alias)).join(" OR ")})`;
}

const valueOf = (row, column, empty) => {
  const value = row?.[column];
  if (value === undefined || value === null) return empty;
  if (typeof empty === "number") return typeof value === "boolean" ? Number(value) : Number(value);
  return String(value);
};
/** Satır (kolon adlarıyla) para satırı mı? Tanım moneyWhere ile aynı kaynaktan. */
export function isMoneyRow(table, row) {
  return MONEY_SOURCES.some(source => source.table === table && source.when.every(([column, values, empty]) => values.includes(valueOf(row, column, empty))) && (!source.positive || Number(row?.[source.positive]) > 0));
}

// ---------- Okuma: tek SQL ----------
const qtyFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });
const qtyText = value => qtyFormat.format(Number(value) || 0);
const parseExtra = value => {
  try {
    return JSON.parse(value || "{}") || {};
  } catch {
    return {};
  }
};

// Satır sorgusunun çıktısı Kasa'nın 2.0.26'daki satır nesneleridir (alanlar, sıraları ve açıklama metinleri aynı): Kasa penceresi,
// Kasa Dökümü, Banka ve POS Hareketleri ve nakit akışı bu nesneleri okur.
function shape(line) {
  const x = parseExtra(line.extra);
  const head = { id: line.id };
  const tail = { actorId: line.actor_id, actorName: line.actor_name, createdAt: line.created_at, updatedAt: line.updated_at };
  switch (line.src) {
    case 1:
      return { ...head, kind: "in", source: "payment", method: line.method, amount: line.amount, date: line.date, description: x.description, caseKey: x.caseKey, caseTitle: x.caseTitle, ...tail };
    case 2:
      return { ...head, kind: line.kind, source: "manual", method: line.method, amount: line.amount, date: line.date, description: x.description, caseKey: "", caseTitle: "", transferId: x.transferId, ...tail };
    case 3:
      return { ...head, kind: line.kind, source: "account", method: line.method, amount: line.amount, date: line.date, description: x.description, accountId: x.accountId, accountName: x.accountName, ...tail };
    case 4:
      return {
        ...head, kind: line.kind, method: line.method, amount: line.amount, date: line.date, accountId: x.accountId, accountName: x.accountName, invoiceId: x.invoiceId, ...tail,
        source: "invoice", description: `${INVOICE_KINDS[x.invoiceKind]?.short || "Fatura"} ${x.number} · ${line.kind === "in" ? "tahsilat" : "ödeme"} · ${x.accountName}`,
      };
    case 5:
      return { ...head, kind: line.kind, source: "bank", method: line.method, amount: line.amount, date: line.date, description: x.description, accountId: x.accountId, accountName: x.accountName, ...tail };
    case 6:
      return { ...head, kind: line.kind, source: "plan", method: line.method, amount: line.amount, date: line.date, description: x.description, planId: x.planId, planName: x.planName, ...tail };
    case 7:
      return {
        ...head, method: line.method, amount: line.amount, date: line.date, itemId: x.itemId, itemName: x.itemName, ...tail, kind: line.kind, source: "stock",
        // Alım Kasa'dan gider: "Stok ödemesi" (v2.0.8 adı; önceden "Stok alımı").
        description: `${x.reason === "return" ? "Satış iadesi" : x.moveKind === "in" ? "Stok ödemesi (alım)" : "Stok satışı"} · ${x.itemName} ${qtyText(x.qty)} ${x.unit}${x.note ? ` · ${x.note}` : ""}`,
      };
    case 8:
      return {
        ...head, method: line.method, amount: line.amount, date: line.date, chequeId: x.chequeId, ...tail, kind: line.kind, source: "cheque",
        description: `${INSTRUMENTS[x.instrument] || "Çek"} ${x.eventKind === "collect" ? "tahsili" : "ödemesi"}${x.serialNo ? ` · No ${x.serialNo}` : ""} · ${x.accountName || x.drawer || "—"}${x.note ? ` · ${x.note}` : ""}`,
      };
    default:
      // GG2: açıklamasız Banka Fişi satırında işlem türü ve İşlem No (raporda Açıklama boş kalıyordu).
      return { ...head, kind: line.kind, source: "bankLine", method: line.method, amount: line.amount, date: line.date, description: x.description || [typeLabel(x.eventType || ""), x.eventNo].filter(Boolean).join(" · "), eventId: line.event_id, eventNo: x.eventNo || "", eventType: x.eventType || "", baseType: x.baseType || x.eventType || "", ...tail };
  }
}

const signedCents = line => (line.kind === "in" ? 1 : -1) * Number(line.cents || 0);
const tl = cents => roundMoney(Number(cents || 0) / 100);

/**
 * Tek kaynak okuyucusu. Şema bir kez okunur (göçlerden sonra kurulur): eksik tablo kaynaktan, eksik kolon boş değerle düşer.
 */
export function createMoneyLines(store, { verify = false } = {}) {
  let schema = null;
  const load = () => {
    if (schema) return schema;
    const tables = new Set(store.all("SELECT name FROM sqlite_master WHERE type = 'table'").map(row => row.name));
    const columns = new Map();
    const has = (table, column) => {
      if (!tables.has(table)) return false;
      if (!columns.has(table)) columns.set(table, new Set(store.all(`PRAGMA table_info(${table})`).map(row => row.name)));
      return columns.get(table).has(column);
    };
    schema = { tables, has, bankAccounts: tables.has("bank_accounts") };
    return schema;
  };

  // Kaynağın SELECT'i. light: yalnız özet kolonları; filter: kaynağa itilen koşullar (:after, :events, :ids_<tablo>).
  // ids (v2.1.0, §3.11 mutabakat kapısı): yalnız bu satırlar ({ tablo: kimlikler }); Banka Fişi satırları events ile (verilmezse yok).
  function select(source, { light, after, events, ids, ref = null, lean = false, unbound = false, since = "", until = "" }) {
    const { has, tables } = load();
    const r = source.read;
    const a = r.alias;
    const joined = [...r.from.matchAll(/\bJOIN\s+(\w+)/gi)].map(match => match[1]);
    if (![source.table, ...joined].every(table => tables.has(table))) return null;
    const col = (column, fallback) => (has(source.table, column) ? `${a}.${column}` : fallback);
    const eventId = r.eventId || col("event_id", "''");
    const date = r.date || `${a}.date`;
    // lean (v2.1.0 Aşama 4, total): yalnız yön ve kuruş — hesap bakiyesi için okunan kolon en aza iner (Banka Fişi satırında kapsayan indeks
    // idx_bank_lines_ref ile tablo satırı okunmaz; fin_events yalnız varlık için birleşir).
    const parts = lean ? [`${r.kind} AS kind`, `${r.cents || `CAST(ROUND(${a}.amount * 100) AS INTEGER)`} AS cents`] : [
      `${source.id} AS src`, `${r.rank} AS rank`, `${a}.rowid AS rid`, `${a}.id AS id`, `${eventId} AS event_id`, `${r.kind} AS kind`,
      `${r.amount || `${a}.amount`} AS amount`, `${r.cents || `CAST(ROUND(${a}.amount * 100) AS INTEGER)`} AS cents`, `${date} AS date`,
      `${r.method || `${a}.method`} AS method`, `${r.ref || col("fin_ref", "''")} AS ref`, `${r.party} AS party_id`, `${r.internal} AS internal`,
      `${r.wayHint || "NULL"} AS way_hint`, `${r.created || `${a}.created_at`} AS created_at`,
    ];
    if (!light && !lean) {
      parts.push(
        `${r.updated || `${a}.updated_at`} AS updated_at`, `${r.actor || `${a}.created_by`} AS actor_id`, `${r.extra} AS extra`,
        `${r.valueDate || "''"} AS value_date`,
        `${r.fxMinor || (r.fx && has(source.table, "fx_minor") ? `${a}.fx_minor` : "0")} AS fx_minor`,
        `${r.currency || (r.fx && has(source.table, "fx_currency") ? `CASE WHEN ${a}.fx_currency <> '' THEN ${a}.fx_currency ELSE 'TRY' END` : "'TRY'")} AS currency`,
      );
    }
    const where = [conditionSql(source, a)];
    // Süzgeçli okumada (ids/events: kapının dokunulan satırları) satır tablosu dış döngüdür: istatistiksiz planlayıcı görünürlük JOIN'inin
    // indeksini (accounts.deleted_at gibi) seçip bütün tabloyu dolaşıyordu (100.000 satırda ~100 ms/kaynak). CROSS JOIN yalnız sırayı
    // belirler; sonuç aynı iç birleşimdir.
    const byRef = ref !== null && ref !== undefined && String(ref) !== "";
    const from = ids || events || byRef ? r.from.replace(/(^|\s)JOIN\s/g, "$1CROSS JOIN ") : r.from;
    if (after) where.push(`${date} > :after`);
    if (since) where.push(`${date} >= :since`);
    if (until) where.push(`${date} <= :until`);
    // GG2 (Hesabı Atanmamış Eski Hareketler, 1.000.000 hareket ölçümü): yalnız hesabı atanmamış havale/POS satırları. Koşul DÜZ metinle yazılır
    // (kısmi indeks idx_<tablo>_unbound … WHERE fin_ref = '' AND method IN ('bank', 'card') yalnız aynı metinle seçilir); fiş satırında bağsız
    // para satırı (Devir Kapanışı, Eski Bakiye Aktarımı) idx_bank_lines_ref ile. Önceden bütün para satırları okunup dışarıda süzülüyordu.
    if (unbound) {
      if (source.table === "bank_lines") where.push("l.ref = ''");
      else if (has(source.table, "fin_ref")) where.push(`${a}.fin_ref = '' AND ${a}.method IN ('bank', 'card')`);
      else where.push(`${a}.method IN ('bank', 'card')`);
    }
    // Hesap süzgeci kaynağa itilir (v2.1.0 Aşama 4): satır tablosunun (fin_ref, date) / bank_lines (ref, event_id) indeksiyle okunur; önceden
    // bütün para satırları okunup dışarıda süzülüyordu (Hesap Detayı, Hareketler'in bakiyesi).
    // Kısmi indeks (idx_<tablo>_fin_ref … WHERE fin_ref <> '') parametreli eşitlikten çıkarılamaz: "<> ''" ayrıca yazılır.
    // Olay ya da satır kimliği süzgeci de varsa (Hareketler'in sayfası: 50 olayın tutarı) hesap koşulu indeks DIŞINDA (+) kalır: istatistiksiz
    // planlayıcı aksi hâlde hesabın indeksini seçip hesabın bütün satırlarını dolaşıyordu (1.000.000 satırlık hesapta sayfa başına ~650 ms).
    const refColumn = r.ref || col("fin_ref", "''");
    if (ref !== null && ref !== undefined) where.push(ids || events ? `+${refColumn} = :ref` : byRef ? `${refColumn} = :ref AND ${refColumn} <> ''` : `${refColumn} = :ref`);
    if (ids) {
      if (source.table === "bank_lines") where.push(events ? `${eventId} IN (SELECT value FROM json_each(:events))` : "0");
      else where.push(ids[source.table]?.length ? `${a}.id IN (SELECT value FROM json_each(:ids_${source.table}))` : "0");
    } else if (events) where.push(`${eventId} IN (SELECT value FROM json_each(:events)) AND ${eventId} <> ''`);
    return `SELECT ${parts.join(", ")} FROM ${from}${light || lean || !r.rowJoin ? "" : ` ${r.rowJoin}`} WHERE ${where.join(" AND ")}`;
  }
  const WAY_SQL = bank => `CASE
      WHEN u.way_hint IS NOT NULL THEN u.way_hint
      WHEN u.method = 'cash' THEN 'cash'
      WHEN u.method = 'bank' AND ${bank ? "COALESCE(ba.kind, '') NOT IN ('card', 'loan')" : "1 = 1"} THEN 'bank'
      WHEN u.method = 'card' AND ${bank ? "ba.kind = 'card'" : "0 = 1"} THEN 'ccard'
      WHEN u.method = 'card' THEN 'card'
      ELSE 'unknown' END`;
  /** Yol türetilmiş tek SQL (w): src, id, event_id, kind, amount, cents, date, method, ref, party_id, internal, way, created_at (+ satır alanları). */
  function waySql(options) {
    const { bankAccounts } = load();
    // ids kipinde (kapı) satırı verilmeyen kaynak sorguya hiç girmez (koşulu "0" olurdu; plan yine de tabloyu dolaşan bir döngü gösterir).
    // Hiçbir kaynak kalmazsa ilk kaynağın boş sorgusu (koşul "0") kalır: SQL geçerli, satır yok.
    const needed = source => !options.ids || (source.table === "bank_lines" ? Boolean(options.events) : Boolean(options.ids[source.table]?.length));
    const chosen = MONEY_SOURCES.filter(needed);
    const union = (chosen.length ? chosen : MONEY_SOURCES.slice(0, 1)).map(source => select(source, options)).filter(Boolean).join("\n UNION ALL ");
    return `SELECT u.*, ${WAY_SQL(bankAccounts)} AS way FROM (${union}) u${bankAccounts ? " LEFT JOIN bank_accounts ba ON u.ref <> '' AND ba.id = u.ref" : ""}`;
  }
  const params = ({ after, events, ids, ref = null, since = "", until = "" }) => ({
    ...(after ? { after } : {}),
    ...(since ? { since } : {}),
    ...(until ? { until } : {}),
    ...(ref !== null && ref !== undefined ? { ref: String(ref) } : {}),
    ...(events ? { events: JSON.stringify([...events]) } : {}),
    ...(ids ? Object.fromEntries(Object.entries(ids).filter(([, list]) => list?.length).map(([table, list]) => [`ids_${table}`, JSON.stringify([...list])])) : {}),
  });
  const wayFilter = ways => (ways ? `w.way IN (${ways.map(quote).join(", ")})` : "");

  /**
   * Ham satırlar (yol, hesap, iç hareket, İşlem No); tarih ve giriş sırasıyla. ways: yol listesi (null = hepsi); after: tarihten sonra; events:
   * olay kimlikleri; ref: yalnız bu hesabın (ya da POS'un) satırları (v2.1.0 Aşama 3: Hesap Detayı'ndaki son hareketler).
   */
  function lines({ ways = null, after = "", events = null, ids = null, light = false, ref = null, unbound = false, since = "", until = "" } = {}) {
    const filters = [wayFilter(ways)].filter(Boolean);
    const sql = `SELECT w.*${light ? "" : ", COALESCE(usr.display_name, '') AS actor_name"} FROM (${waySql({ light, after, events, ids, ref, unbound, since, until })}) w${light ? "" : " LEFT JOIN users usr ON usr.id = w.actor_id"}${filters.length ? ` WHERE ${filters.join(" AND ")}` : ""} ORDER BY w.date, w.created_at, w.rank, w.rid`;
    return store.all(sql, params({ after, events, ids, ref, since, until }));
  }
  /** Kasa'nın satır nesneleri (2.0.26 ile aynı biçim). */
  const rows = (options = {}) => lines({ ...options, light: false }).map(shape);

  /** Yol ve hesap bazında toplam (kuruş): [{ way, ref, cents, count }]. ids: yalnız bu satırlar ({ tablo: kimlikler }; Banka Fişi events ile). */
  function groups({ events = null, ids = null, ref = null } = {}) {
    return store.all(`SELECT w.way AS way, w.ref AS ref, COALESCE(SUM(CASE WHEN w.kind = 'in' THEN w.cents ELSE -w.cents END), 0) AS cents, COUNT(*) AS count FROM (${waySql({ light: true, events, ids, ref })}) w GROUP BY w.way, w.ref ORDER BY w.way, w.ref`, params({ events, ids, ref }));
  }
  /**
   * Hesabın (ya da POS'un) bakiyesi, tek kaynaktan, en az kolonla (v2.1.0 Aşama 4; Hareketler'in yürüyen bakiyesi, Hesap Detayı): { cents, count }.
   * after: yalnız bu tarihten SONRAKİ satırlar. Aynı veri için sonuç saklanır (bağlantının total_changes'ı ve data_version değişince yeniden):
   * 1.000.000 satırlık hesapta toplam bir kez okunur, sayfalar arasında yeniden okunmaz.
   */
  const totals = new Map();
  // GG2: işlemin İÇİNDE hesaplanan değer saklanmaz. Geri alınan işlemde (409) total_changes geri gitmez; içeride saklanan (yazılmış ama geri
  // alınmış satırları sayan) toplam, geri almadan sonraki ilk okumada aynı damgayla "geçerli" görünüyordu (Banka Fişi'nin eksi bakiye denetimi
  // ikinci denemede eski toplamı okuyup geçiyordu). İşlemin içinde okunan saklı değer yazımdan önceki son kesin durumdur (yazımla damga değişir).
  const stampOf = () => {
    const counters = typeof store.changeCounters === "function" ? store.changeCounters() : null;
    return counters ? `${counters.total}|${counters.version}` : "";
  };
  const keep = () => !store.inTransaction;
  const TOTAL_SQL = union => `SELECT COALESCE(SUM(CASE WHEN u.kind = 'in' THEN u.cents ELSE -u.cents END), 0) AS cents, COUNT(*) AS count, COALESCE(SUM(CASE WHEN u.kind = 'in' THEN u.cents ELSE 0 END), 0) AS debit, COALESCE(SUM(CASE WHEN u.kind = 'in' THEN 0 ELSE u.cents END), 0) AS credit FROM (${union}) u`;
  const totalOf = row => ({ cents: Number(row?.cents) || 0, count: Number(row?.count) || 0, debit: Number(row?.debit) || 0, credit: Number(row?.credit) || 0 });
  /** Hesabın para satırlarının toplamı (saklanmadan; refTotal ve doğrulama). */
  function computeRefTotal(ref, after = "") {
    const union = MONEY_SOURCES.map(source => select(source, { lean: true, after, ref })).filter(Boolean).join("\n UNION ALL ");
    // debit / credit (GG2): giriş ve çıkış toplamları da aynı geçişte (Alt Hesap Mizanı tüm zamanlar bunları saklı değerden okur).
    return totalOf(store.get(TOTAL_SQL(union), params({ after, ref })));
  }
  function refTotal({ ref, after = "" } = {}) {
    const key = `${ref}|${after}`;
    const stamp = stampOf();
    const hit = stamp ? totals.get(key) : null;
    if (hit && hit.stamp === stamp) return { cents: hit.cents, count: hit.count, debit: hit.debit, credit: hit.credit };
    const out = computeRefTotal(ref, after);
    if (stamp && keep()) {
      if (totals.size > 200) totals.clear();
      totals.set(key, { stamp, ...out });
    }
    return out;
  }
  /**
   * Verilen olayların bu hesaptaki para satırlarının toplamı (refTotal'ın alanları; olay dizininden). K7 (GG2 ölçümü): Banka Fişi kaydında
   * hesabın bütün satırlarını ikinci kez toplamak yerine işlemin YENİ olaylarının satırları eklenir (1.000.000 harekette fiş başına ~2,3 sn idi).
   */
  function eventsTotal({ ref, events }) {
    const list = [...(events || [])].filter(Boolean);
    if (!ref || !list.length) return { cents: 0, count: 0, debit: 0, credit: 0 };
    const union = MONEY_SOURCES.map(source => select(source, { lean: true, events: list, ref })).filter(Boolean).join("\n UNION ALL ");
    return totalOf(store.get(TOTAL_SQL(union), params({ events: list, ref })));
  }
  /**
   * Hesabın en geç para satırının tarihi ya da daha geç bir tarih ("" = satır yok): modül satırlarında (fin_ref, date) dizini, fiş satırlarında
   * işlem başlığının (bank_ref | counter_ref, date) dizini. Fiş satırının hesabı her zaman başlığın bank_ref ya da counter_ref'idir (bank.voucher
   * yazar; doğrulama kipinde afterIsEmpty bunu tam sorguyla denetler). K7: işlem tarihinden sonra satır yoksa "o günkü bakiye" ayrıca okunmaz.
   */
  function lastDate(ref) {
    if (!ref) return "";
    const { has, tables } = load();
    let last = "";
    const take = date => {
      if (date && date > last) last = String(date);
    };
    for (const table of new Set(MONEY_SOURCES.map(source => source.table))) {
      if (table === "bank_lines" || !tables.has(table) || !has(table, "fin_ref") || !has(table, "date")) continue;
      take(store.get(`SELECT MAX(date) AS d FROM ${table} WHERE fin_ref = ? AND fin_ref <> ''`, ref)?.d);
    }
    if (tables.has("bank_lines") && tables.has("fin_events")) {
      for (const column of ["bank_ref", "counter_ref"]) {
        take(store.get(`SELECT e.date AS d FROM fin_events e WHERE e.${column} = ?1 AND e.${column} <> '' AND EXISTS (SELECT 1 FROM bank_lines l WHERE l.ref = ?1 AND l.event_id = e.id) ORDER BY e.date DESC LIMIT 1`, ref)?.d);
      }
    }
    return last;
  }
  /** after'dan sonra hesabın para satırı var mı? (lastDate ile; doğrulama kipinde tam sorguyla karşılaştırılır.) */
  function afterIsEmpty(ref, after) {
    const empty = !after || !ref ? false : after >= lastDate(ref);
    if (verify && empty && computeRefTotal(ref, after).count !== 0) throw new Error(`money-lines doğrulama: ${ref} hesabında ${after} sonrasında satır var ama lastDate ${lastDate(ref)}`);
    return empty;
  }
  /**
   * Yazımdan sonra hesabın toplamını saklar (işlem dışında, COMMIT'ten hemen sonra çağrılır; K7'nin yazımda hesapladığı değer). Bir sonraki
   * okuma (Hareketler'in bakiyesi, Genel Bakış, bir sonraki fişin "önceki bakiye"si) hesabın bütün satırlarını yeniden toplamaz. Doğrulama
   * kipinde (testler) değer tam sorguyla karşılaştırılır.
   */
  function prime(ref, values) {
    if (!ref || !values || !keep()) return;
    const stamp = stampOf();
    if (!stamp) return;
    const out = totalOf(values);
    if (verify) {
      const fresh = computeRefTotal(ref);
      if (fresh.cents !== out.cents || fresh.count !== out.count || fresh.debit !== out.debit || fresh.credit !== out.credit) throw new Error(`money-lines doğrulama: ${ref} saklanacak toplam ${JSON.stringify(out)} ≠ tam sorgu ${JSON.stringify(fresh)}`);
    }
    if (totals.size > 200) totals.clear();
    totals.set(`${ref}|`, { stamp, ...out });
  }
  /**
   * Hesabı Atanmamış Eski Hareketler'in bakiyesi (kuruş, işaretli): { bank (102.00), card (108.00) }. Yalnız bağsız havale/POS satırları okunur
   * (kısmi indeks; select'in unbound süzgeci); sonuç refTotal gibi saklanır (veri değişince yeniden). GG2: önceden Genel Bakış, rozet, Hesaplar
   * ve sihirbaz bütün para satırlarını grupluyordu (1.000.000 harekette istek başına ~4 sn, sunucu o sürede başka isteğe yanıt vermiyordu).
   */
  // 2.1.0 temel sürüm (ileri tarihli eski havale; plan A13 / karar 42): until (bugün) verilirse yalnız o güne kadarki satırlar — bugünkü bakiye
  // gösteren her ekran (Banka Genel Bakış, Hesaplar, ANLIK DURUM, Nakit Akış, Birleşik Rapor) bununla okur; after verilirse yalnız o günden
  // SONRAKİ (eski sürümden kalan ileri tarihli) satırlar, ayrı bilgi olarak. İkisi de yoksa tüm zamanlar (Alt Hesap Mizanı, Ana Defter gibi).
  function unassigned({ until = "", after = "" } = {}) {
    const ways = unassignedWays({ until, after });
    return { bank: ways.bank?.cents || 0, card: ways.card?.cents || 0, count: (ways.bank?.count || 0) + (ways.card?.count || 0), first: [ways.bank?.first, ways.card?.first].filter(Boolean).sort()[0] || "" };
  }
  /** Bağsız satırlar yol bazında: { [yol]: { cents, debit, credit, count, first } } (saklanır; Alt Hesap Mizanı'nın 102.00 / 108.00 satırları). */
  function unassignedWays({ until = "", after = "" } = {}) {
    const stamp = stampOf();
    const key = `|unassigned|${until}|${after}`;
    const hit = stamp ? totals.get(key) : null;
    if (hit && hit.stamp === stamp) return hit.ways;
    const ways = {};
    for (const group of store.all(`SELECT w.way AS way, COALESCE(SUM(CASE WHEN w.kind = 'in' THEN w.cents ELSE -w.cents END), 0) AS cents, COALESCE(SUM(CASE WHEN w.kind = 'in' THEN w.cents ELSE 0 END), 0) AS debit, COALESCE(SUM(CASE WHEN w.kind = 'in' THEN 0 ELSE w.cents END), 0) AS credit, COUNT(*) AS count, MIN(w.date) AS first FROM (${waySql({ light: true, unbound: true, until, after })}) w WHERE w.ref = '' GROUP BY w.way`, params({ until, after }))) {
      ways[group.way] = { cents: Number(group.cents) || 0, debit: Number(group.debit) || 0, credit: Number(group.credit) || 0, count: Number(group.count) || 0, first: group.first || "" };
    }
    if (stamp && keep()) {
      if (totals.size > 200) totals.clear();
      totals.set(key, { stamp, ways });
    }
    return ways;
  }
  /**
   * Alt Hesap Mizanı için yol ve hesap bazında dönem toplamları (kuruş): [{ way, ref, opening (from'dan önce, net), debit (giriş), credit (çıkış) }].
   * to'dan sonraki satırlar okunmaz. GG2 (1.000.000 hareket): Alt Hesap Mizanı önceden bütün Ana Defter'i (cari, stok, fatura dahil) kuruyordu
   * (~40 sn); para satırları tek kaynaktan tek geçişte toplanır.
   */
  function periodGroups({ from = "", to = "" } = {}) {
    const sql = `SELECT w.way AS way, w.ref AS ref,
        COALESCE(SUM(CASE WHEN :pfrom <> '' AND w.date < :pfrom THEN (CASE WHEN w.kind = 'in' THEN w.cents ELSE -w.cents END) ELSE 0 END), 0) AS opening,
        COALESCE(SUM(CASE WHEN (:pfrom = '' OR w.date >= :pfrom) AND w.kind = 'in' THEN w.cents ELSE 0 END), 0) AS debit,
        COALESCE(SUM(CASE WHEN (:pfrom = '' OR w.date >= :pfrom) AND w.kind <> 'in' THEN w.cents ELSE 0 END), 0) AS credit
      FROM (${waySql({ light: true, until: to })}) w GROUP BY w.way, w.ref ORDER BY w.way, w.ref`;
    return store.all(sql, { ...params({ until: to }), pfrom: from });
  }
  /** Yol bazında bakiye (kuruş): { cash, bank, card, ccard, loan, unknown, all }. */
  function balances(list = groups()) {
    const out = Object.fromEntries(WAYS.map(way => [way, 0]));
    for (const group of list) out[group.way] = (out[group.way] || 0) + Number(group.cents);
    out.all = WAYS.reduce((sum, way) => sum + out[way], 0);
    return out;
  }

  /**
   * Kasa özeti (2.0.26'daki cash.summary ile aynı alanlar ve değerler): yol bazında bakiyeler, bugün ve bu ay giriş/çıkış, ileri tarihli
   * hareket sayısı; ANLIK DURUM için nakit (cashOnly) ve banka tarafı (noncash). Kasa görünümlerinde Kasa ↔ Banka transferinin nakit bacağı
   * sayılır (fiziki nakit girer/çıkar; §3.4).
   */
  function summary(day, monthStart = `${day.slice(0, 7)}-01`) {
    // GG2: "Kasa ve Banka" toplamları VARLIKTIR (nakit, banka, POS / Hesabı Atanmamış POS); kurumsal kart (ccard, 309) ve kredi (loan, 300)
    // borçtur — ayrı (debt). Önceden kart açılış borcu ANLIK DURUM'un Banka / POS kutusundan ve nakit akış başlangıcından düşüyor, kredi kullanımı
    // nakit akışta görünmüyordu.
    const row = store.get(
      `SELECT COALESCE(SUM(CASE WHEN way IN ('ccard', 'loan') THEN 0 WHEN kind = 'in' THEN cents ELSE -cents END), 0) AS balance,
              COALESCE(SUM(CASE WHEN way IN ('ccard', 'loan') THEN 0 WHEN date <= :day THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS balanceToday,
              COALESCE(SUM(CASE WHEN way NOT IN ('ccard', 'loan') AND date = :day AND kind = 'in' THEN cents END), 0) AS todayIn,
              COALESCE(SUM(CASE WHEN way NOT IN ('ccard', 'loan') AND date = :day AND kind = 'out' THEN cents END), 0) AS todayOut,
              COALESCE(SUM(CASE WHEN way NOT IN ('ccard', 'loan') AND date >= :month AND date <= :day AND kind = 'in' THEN cents END), 0) AS monthIn,
              COALESCE(SUM(CASE WHEN way NOT IN ('ccard', 'loan') AND date >= :month AND date <= :day AND kind = 'out' THEN cents END), 0) AS monthOut,
              COALESCE(SUM(CASE WHEN way = 'ccard' THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS ccardAll,
              COALESCE(SUM(CASE WHEN way = 'loan' THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS loanAll,
              COUNT(CASE WHEN date > :day THEN 1 END) AS future,
              COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN way = 'cash' THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS cashAll,
              COALESCE(SUM(CASE WHEN way = 'bank' THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS bankAll,
              COALESCE(SUM(CASE WHEN way = 'card' THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS cardAll,
              COALESCE(SUM(CASE WHEN way = 'cash' AND date <= :day THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS cashToday,
              COALESCE(SUM(CASE WHEN way = 'bank' AND date <= :day THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS bankToday,
              COALESCE(SUM(CASE WHEN way = 'card' AND date <= :day THEN (CASE WHEN kind = 'in' THEN cents ELSE -cents END) END), 0) AS cardToday,
              COALESCE(SUM(CASE WHEN way = 'cash' AND date = :day AND kind = 'in' THEN cents END), 0) AS cashTodayIn,
              COALESCE(SUM(CASE WHEN way = 'cash' AND date = :day AND kind = 'out' THEN cents END), 0) AS cashTodayOut,
              COALESCE(SUM(CASE WHEN way = 'cash' AND date >= :month AND date <= :day AND kind = 'in' THEN cents END), 0) AS cashMonthIn,
              COALESCE(SUM(CASE WHEN way = 'cash' AND date >= :month AND date <= :day AND kind = 'out' THEN cents END), 0) AS cashMonthOut,
              COUNT(CASE WHEN way = 'cash' AND date > :day THEN 1 END) AS cashFuture,
              COALESCE(SUM(CASE WHEN way IN ('bank', 'card') AND date = :day AND kind = 'in' THEN cents END), 0) AS otherTodayIn,
              COALESCE(SUM(CASE WHEN way IN ('bank', 'card') AND date = :day AND kind = 'out' THEN cents END), 0) AS otherTodayOut
       FROM (${waySql({ light: true })}) w`,
      { day, month: monthStart },
    );
    const cashOnly = { balance: tl(row.cashAll), balanceToday: tl(row.cashToday), today: { in: tl(row.cashTodayIn), out: tl(row.cashTodayOut) }, month: { in: tl(row.cashMonthIn), out: tl(row.cashMonthOut) }, futureEntries: row.cashFuture };
    const noncash = { balance: roundMoney(tl(row.bankAll) + tl(row.cardAll)), balanceToday: roundMoney(tl(row.bankToday) + tl(row.cardToday)), today: { in: tl(row.otherTodayIn), out: tl(row.otherTodayOut) } };
    return { byMethod: { cash: tl(row.cashAll), bank: tl(row.bankAll), card: tl(row.cardAll) }, byMethodAt: { cash: tl(row.cashToday), bank: tl(row.bankToday), card: tl(row.cardToday) }, cashToday: tl(row.cashToday), balance: tl(row.balance), balanceToday: tl(row.balanceToday), today: { in: tl(row.todayIn), out: tl(row.todayOut) }, month: { in: tl(row.monthIn), out: tl(row.monthOut) }, futureEntries: row.future, count: row.count, cashOnly, noncash, debt: { card: tl(-row.ccardAll), loan: tl(-row.loanAll) } };
  }

  /**
   * Banka görünümlerinin Bugün ve Bu Ay giriş-çıkışı (§3.4 "Bugün ve Bu Ay toplamlarında iç hareket", §8.4 K10; Aşama 9), kuruş:
   *   { today | month: { inMinor, outMinor, transferInMinor, transferOutMinor } }.
   * Yalnız Gerçek Banka (hesaba atanmış 102; hesabı atanmamış eski hareketler ve kart/kredi borcu girmez). Giriş/Çıkış dış hareketlerdir
   * (internal = 0); iç hareketler (Kasa ↔ Banka, bankalar arası transfer, kredi kullanımı ve geri ödemesi, kart borcu ödemesi ve ters kayıtları)
   * ayrı "Transfer" satırındadır, iki kez sayılmaz. İç hareketin gider satırları (transfer ücreti ve BSMV'si, kredi faizi) şirketten gerçekten
   * çıkan paradır: Çıkış'a sayılır, Transfer'den düşülür (ters kaydında Giriş'e). Açılış ve Devir düzeltmeleri hiçbirine girmez.
   */
  function flows(day, monthStart = `${day.slice(0, 7)}-01`) {
    const { tables } = load();
    if (!tables.has("bank_accounts")) return null;
    const row = store.get(
      `SELECT
         COALESCE(SUM(CASE WHEN w.date = :day AND w.internal = 0 AND w.kind = 'in' THEN w.cents END), 0) AS todayIn,
         COALESCE(SUM(CASE WHEN w.date = :day AND w.internal = 0 AND w.kind = 'out' THEN w.cents END), 0) AS todayOut,
         COALESCE(SUM(CASE WHEN w.date = :day AND w.internal = 1 AND w.kind = 'in' THEN w.cents END), 0) AS todayTrIn,
         COALESCE(SUM(CASE WHEN w.date = :day AND w.internal = 1 AND w.kind = 'out' THEN w.cents END), 0) AS todayTrOut,
         COALESCE(SUM(CASE WHEN w.internal = 0 AND w.kind = 'in' THEN w.cents END), 0) AS monthIn,
         COALESCE(SUM(CASE WHEN w.internal = 0 AND w.kind = 'out' THEN w.cents END), 0) AS monthOut,
         COALESCE(SUM(CASE WHEN w.internal = 1 AND w.kind = 'in' THEN w.cents END), 0) AS monthTrIn,
         COALESCE(SUM(CASE WHEN w.internal = 1 AND w.kind = 'out' THEN w.cents END), 0) AS monthTrOut
       FROM (${waySql({ light: true, since: monthStart, until: day })}) w
       LEFT JOIN fin_events fe ON w.src = 9 AND fe.id = w.event_id
       LEFT JOIN fin_events fo ON fe.type = 'reversal' AND fo.id = fe.reversal_of
       WHERE w.way = 'bank' AND w.ref <> '' AND COALESCE(fo.type, fe.type, '') NOT IN (${ADJUST_SQL})`,
      { ...params({ since: monthStart, until: day }), day },
    );
    // İç hareketin gider satırları (gönderen hesabı Gerçek Banka'da olan): borç → Çıkış, alacak (ters kayıt) → Giriş.
    const fee = store.get(
      `SELECT COALESCE(SUM(CASE WHEN fe.date = :day AND l.side = 'D' THEN l.try_minor END), 0) AS todayOut, COALESCE(SUM(CASE WHEN fe.date = :day AND l.side = 'C' THEN l.try_minor END), 0) AS todayIn,
              COALESCE(SUM(CASE WHEN l.side = 'D' THEN l.try_minor END), 0) AS monthOut, COALESCE(SUM(CASE WHEN l.side = 'C' THEN l.try_minor END), 0) AS monthIn
       FROM fin_events fe JOIN bank_lines l ON l.event_id = fe.id AND l.role IN ('expense', 'tax')
       JOIN bank_accounts ba ON ba.id = fe.bank_ref AND ba.kind NOT IN ('card', 'loan')
       LEFT JOIN fin_events fo ON fe.type = 'reversal' AND fo.id = fe.reversal_of
       WHERE fe.date >= :month AND fe.date <= :day AND fe.src_table = '' AND COALESCE(fo.type, fe.type) IN (${INTERNAL_SQL})`,
      { day, month: monthStart },
    );
    const n = value => Number(value) || 0;
    const shape = (inMinor, outMinor, trIn, trOut, feeIn, feeOut) => ({ inMinor: n(inMinor) + n(feeIn), outMinor: n(outMinor) + n(feeOut), transferInMinor: n(trIn) - n(feeIn), transferOutMinor: n(trOut) - n(feeOut) });
    return {
      today: shape(row.todayIn, row.todayOut, row.todayTrIn, row.todayTrOut, fee.todayIn, fee.todayOut),
      month: shape(row.monthIn, row.monthOut, row.monthTrIn, row.monthTrOut, fee.monthIn, fee.monthOut),
    };
  }

  /**
   * Banka raporlarının satır sınıflaması (§3.4 "Bugün ve Bu Ay toplamlarında iç hareket", §8.10; 2.1.0 Aşama 14): satır yolunun ham satırları
   * (lines ile aynı ifade, sıra ve görünürlük) + her satırın Giriş/Çıkış (dış), Transfer Giriş/Çıkış (iç) ve Açılış ve Devir Düzeltmesi payı,
   * flows ile AYNI kuralla:
   *   - açılış, Devir Kapanışı, eski bakiye aktarımı ve bunların ters kaydı → adjust (hiçbir giriş-çıkışa girmez; bakiyeye girer);
   *   - iç hareket (Kasa ↔ Banka, bankalar arası transfer, kredi, kart borcu ve ters kayıtları) → transfer; iç hareketin gider satırları (transfer
   *     ücreti ve BSMV'si, kredi faizi) gönderen hesabın (işlem başlığındaki bank_ref; kart/kredi hesabı değil) satırında dış Çıkış'tır (ters
   *     kaydında dış Giriş), Transfer'den düşülür;
   *   - geri kalan her şey dış Giriş/Çıkış.
   * Dönüş: satır nesneleri (lines'ın kolonları) + { event_type, event_no, base_type, ext_in, ext_out, tr_in, tr_out, adjust } (kuruş; adjust işaretli).
   * ways / ref / until: lines ile aynı süzgeçler. Dört pay toplamı her satırda satırın işaretli tutarına eşittir (bakiye değişmez).
   */
  function classified({ ways = null, ref = null, until = "", light = false } = {}) {
    const { bankAccounts, tables } = load();
    const events = tables.has("fin_events");
    const filters = [wayFilter(ways)].filter(Boolean);
    const sql = `SELECT w.*, ${events ? "COALESCE(fe.type, '')" : "''"} AS event_type, ${events ? "COALESCE(fe.no, '')" : "''"} AS event_no,
        ${events ? "COALESCE(fo.type, fe.type, '')" : "''"} AS base_type,
        ${events && bankAccounts ? `CASE WHEN w.src = 9 AND w.internal = 1 AND w.ref <> '' AND w.ref = fe.bank_ref AND COALESCE(bk.kind, '') NOT IN ('card', 'loan')
          THEN COALESCE((SELECT SUM(CASE WHEN x.side = 'D' THEN x.try_minor ELSE -x.try_minor END) FROM bank_lines x WHERE x.event_id = fe.id AND x.role IN ('expense', 'tax')), 0) ELSE 0 END` : "0"} AS fee_cents
      FROM (${waySql({ light, ref, until })}) w
      ${events ? "LEFT JOIN fin_events fe ON w.event_id <> '' AND fe.id = w.event_id LEFT JOIN fin_events fo ON fe.type = 'reversal' AND fo.id = fe.reversal_of" : ""}
      ${events && bankAccounts ? "LEFT JOIN bank_accounts bk ON w.ref <> '' AND bk.id = w.ref" : ""}
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY w.date, w.created_at, w.rank, w.rid`;
    const ADJUST = new Set(["opening", "carry_close", "legacy_reclass"]);
    return store.all(sql, params({ ref, until })).map(line => {
      const cents = Number(line.cents) || 0;
      const into = line.kind === "in";
      const out = { ...line, ext_in: 0, ext_out: 0, tr_in: 0, tr_out: 0, adjust: 0 };
      if (Number(line.src) === 9 && ADJUST.has(line.base_type)) {
        out.adjust = into ? cents : -cents;
        return out;
      }
      if (Number(line.internal) === 1) {
        // Gider payı satırın yönündeyse (gönderende çıkış, ters kaydında giriş) dış harekettir; tutarı aşamaz.
        const fee = Number(line.fee_cents) || 0;
        const ext = (fee > 0 && !into) || (fee < 0 && into) ? Math.min(Math.abs(fee), cents) : 0;
        if (into) Object.assign(out, { ext_in: ext, tr_in: cents - ext });
        else Object.assign(out, { ext_out: ext, tr_out: cents - ext });
        return out;
      }
      if (into) out.ext_in = cents;
      else out.ext_out = cents;
      return out;
    });
  }
  /** Satır sorgusunun kaynak adı (shape'teki source) → src numarası: Kasa/rapor satırını classified satırıyla eşlemek için. */
  const SOURCE_NAMES = Object.freeze({ 1: "payment", 2: "manual", 3: "account", 4: "invoice", 5: "bank", 6: "plan", 7: "stock", 8: "cheque", 9: "bankLine" });

  /**
   * money:report (§3.4): satır yolunun (Kasa penceresi, raporlar) JS toplamı = özet SQL'i (yol ve hesap bazında). events verilirse yalnız o
   * olayların satırları (COMMIT'te dokunulan olaylar). Dönüş: uyuşmayan gruplar [{ key, rows, summary }].
   */
  function verifyReport({ events = null } = {}) {
    const fromRows = new Map();
    const sql = `SELECT w.way, w.ref, w.kind, w.amount FROM (${waySql({ light: true, events })}) w`;
    for (const line of store.db.prepare(sql).iterate(params({ events }))) {
      const key = `${line.way}|${line.ref}`;
      fromRows.set(key, (fromRows.get(key) || 0) + (line.kind === "in" ? 1 : -1) * toCents(line.amount));
    }
    const fromSummary = new Map(groups({ events }).map(group => [`${group.way}|${group.ref}`, Number(group.cents)]));
    const out = [];
    for (const key of new Set([...fromRows.keys(), ...fromSummary.keys()])) {
      if ((fromRows.get(key) || 0) !== (fromSummary.get(key) || 0)) out.push({ key, rows: fromRows.get(key) || 0, summary: fromSummary.get(key) || 0 });
    }
    return out;
  }

  return { lines, rows, shape, classified, sourceName: src => SOURCE_NAMES[Number(src)] || "", groups, periodGroups, refTotal, eventsTotal, lastDate, afterIsEmpty, prime, unassigned, unassignedWays, balances, summary, flows, verifyReport, signedCents, reset: () => {
    schema = null;
    totals.clear();
  } };
}
