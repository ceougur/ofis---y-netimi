// Merkezi para yazımı: bank.post (v2.1.0; docs/BANKA-MODULU-PLAN.md §3.3, K6, K11).
//
// Bütün para yazımları (nakit dahil) tek sarmalayıcıdan geçer; modül yalnız kendi satırını yazan geri çağrıyı (write) verir.
//   bank.post({ user, scope, requestId, module, op, body, prev, write, prepare, guard, audit })
//   op: 'create' | 'update' | 'delete' | 'move' (Taksite Aktar ve geri alması) | 'restore' (Silinenler) | 'assign' (yalnız bağ)
// Tek BEGIN IMMEDIATE (store.tx; iç içe çağrı SAVEPOINT) içinde:
//    1  istek kimliği: aynı kimlik + aynı içerik → yazmadan { replayed, refId }; farklı içerik → 409 (request_keys, kalıcı)
//    2  prepare(ctx): modülün hedef kuralları ve yazımdan önceki denetimleri (Kasa eksi bakiye, eksi stok, iade sınırı) — istek kimliği
//       bakışından SONRA çalışır: yinelenen istek bu denetimlere takılmaz (hakem K4, 10.10.2026)
//    3  assertMutable: hesaba bağlı (fin_ref dolu) satırda çapraz yetki (bank.move / bank.cancel), eşleşmiş olayda 409 (iskelet:
//       Aşama 2'de hesaba bağlı satır yazılmaz; Aşama 5'te etkin)
//    4  similar: Benzer İşlem (K8; Aşama 4) — yalnız hesaba bağlı yeni olaylarda; olay kopyası yazımdan sonra kurulduğu için 5'ten SONRA, aynı
//       işlemde çalışır (aynı iş günü, hesap, tür, yön, tutar, cari, hedef — masrafta masraf türü → 409 bank-similar; similarOk geçer)
//    5  olay: write içinde bank.eventFor(tablo, satır) para satırına işlem başlığı açar (İşlem No, §5.4) ya da satırın mevcut
//       olayını verir; yazımdan sonra her olayın salt okuma kopyası satırdan yenilenir — satırı kalmayan olay "cancelled" (kopyası
//       kalır), satırı geri gelen (Silinenler, Taksite Aktar geri alması) olay yeniden "active"
//    6  rows = write(ctx)
//    7  POS kancaları (attach / rebuild / void / cancelRefund) — boş (Aşama 9)
//    8  guard(result): son durum denetimi (K7; Aşama 2'de modüller bugünkü eksi bakiye denetimini kendi yerinde yapar)
//    9  audit: verilirse işlem geçmişi aynı işlemde; düzeltme/silme/taşıma/geri yükleme/atamada "previous" zorunlu (prev'siz çağrı
//       reddedilir)
//   10  istek kimliği aynı işlemde saklanır
//   11  dokunulan olaylar kapıya bildirilir (store.touchEvent)
// Yarıda kesilirse (hata ya da süreç ölümü) ROLLBACK: olay, satır, sayaç, istek kaydı ve işlem geçmişi ya birlikte ya hiç.
//
// K6 denetimi (store'da; lib/db.mjs): (b) bu işlemde yazılan ve "para satırı" (lib/bank/money-lines.mjs) olup olaysız kalan satır →
// money:event; (c) bank.post bağlamı ve store.raw dışında para tablosuna UPDATE/DELETE → money:raw. Test kipinde (config.moneyStrict)
// hata ve ROLLBACK, üretimde iş durmaz: sunucu günlüğü + meta.bank.integrity (son 100 kayıt).
import { randomUUID } from "node:crypto";
import { HttpError } from "../http.mjs";
import { systemClock } from "../clock.mjs";
import { bodyHash } from "../idempotency.mjs";
import { canUser } from "../permissions.mjs";
import { addCalendarDays } from "../business-days.mjs";
import { createTrCalendar } from "../calendars/tr.mjs";
import { newEventId, nextEventNo } from "./event-no.mjs";
import { EVENT_TYPES, NON_MONEY_TYPES, directionOf, typeOf } from "./event-types.mjs";
import { toMinor } from "../minor.mjs";
import { bankPassiveError } from "./module-ref.mjs";
import { voucherCopy } from "./voucher.mjs";
import { FREE_COLUMNS, LEDGER_TABLES, SOURCE_TABLES, isMoneyRow, moneyWhere } from "./money-lines.mjs";
import { eventDigest, eventRows, isTransferPair, refreshEvent } from "./event-copy.mjs";

// Olayın satırının bulunduğu yer (kullanıcının bildiği ad; 409 metni).
const ROW_LABEL = {
  payments: "Kayıt Tahsilatı",
  cash_entries: "Kasa Hareketi",
  account_entries: "Cari Hareketi",
  plan_entries: "Taksit Tahsilatı",
  stock_moves: "Stok Hareketi",
  cheque_events: "Çek/Senet Hareketi",
};

export const OPS = Object.freeze(["create", "update", "delete", "move", "restore", "assign"]);
const OP_SET = new Set(OPS);
export const INTEGRITY_KEY = "meta.bank.integrity";

const VIOLATION_TEXT = {
  "money-event": "işlem başlığı (İşlem No) olmadan para satırı",
  "money-raw": "bank.post dışında para tablosunda düzeltme/silme",
  "money-nonmoney": "para dışı yazıcıdan para satırı",
};
export class MoneyGuardError extends HttpError {
  constructor(violations) {
    const first = violations[0] || {};
    super(500, `Para kaydı merkezi denetimden geçmedi: ${VIOLATION_TEXT[first.code] || first.code} (${first.table || ""}). Hiçbir değişiklik yazılmadı.`, { code: "money-guard", violations });
    this.violations = violations;
  }
}

/** K6 politikası (store.setMoneyPolicy): kaynak tabloları ve koşulları, para tabloları, serbest kolonlar, ihlal işleyicisi. */
export function moneyPolicy({ store, strict = false, log = null, now = systemClock }) {
  const tables = new Set(store.all("SELECT name FROM sqlite_master WHERE type = 'table'").map(row => row.name));
  const hasEvent = table => tables.has(table) && store.all(`PRAGMA table_info(${table})`).some(column => column.name === "event_id");
  const sources = new Map(SOURCE_TABLES.filter(hasEvent).map(table => [table, moneyWhere(table)]));
  const record = violations => {
    log?.warn?.(`Para kaydı denetimi (K6): ${violations.map(item => `${item.code} ${item.table || ""} ${item.id || item.sql || item.reason || ""}`.trim()).join("; ")}`);
    try {
      const current = JSON.parse(store.get("SELECT value FROM settings WHERE key = ?", INTEGRITY_KEY)?.value || "[]");
      const at = now().toISOString();
      const next = [...(Array.isArray(current) ? current : []), ...violations.map(item => ({ at, ...item }))].slice(-100);
      store.run("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", INTEGRITY_KEY, JSON.stringify(next), at);
    } catch {
      // Günlük yazılamasa da iş durmaz (üretim kipi).
    }
  };
  return {
    strict,
    sources,
    ledger: new Set(LEDGER_TABLES.filter(table => tables.has(table))),
    free: FREE_COLUMNS,
    onViolations(violations) {
      if (strict) throw new MoneyGuardError(violations);
      record(violations);
    },
  };
}

/**
 * Banka çekirdeği: bank.post, bank.eventFor, bank.assertNonMoney. Store'a K6 politikasını kurar.
 * @param {{ store, now?, log?, strict?: boolean, requests?, audit? }} options
 */
export function createBank({ store, now = systemClock, log = null, strict = false, requests = null, audit = null }) {
  const policy = moneyPolicy({ store, strict, log, now });
  store.setMoneyPolicy(policy);
  const stack = [];
  const current = () => stack.at(-1) || null;
  const stamp_ = () => now().toISOString();

  function openEvent(ctx, table, row) {
    const date = String(row.date || "");
    const { year, seq, no } = nextEventNo(store, date, { now });
    const id = newEventId();
    store.run(
      "INSERT INTO fin_events (id, year, seq, no, type, date, status, origin, src_table, method, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)",
      id, year, seq, no, typeOf(table, row), date, ctx.origin, table, String(row.method || ""), ctx.user?.id || "system", stamp_(),
    );
    ctx.events.add(id);
    ctx.created.add(id);
    return id;
  }

  /**
   * Yazılacak satırın işlem başlığı: para satırı değilse ""; satırın olayı varsa (row.event_id) o olay (kopyası yazımdan sonra
   * yenilenir); yoksa yeni olay açılır. Yalnız bank.post'un write geri çağrısında; dışında para satırı K6 ihlalidir.
   */
  function eventFor(table, row = {}) {
    if (!isMoneyRow(table, row)) return "";
    const ctx = current();
    if (!ctx) {
      policy.onViolations([{ code: "money-event", table, reason: "bank.post dışında para satırına olay istendi" }]);
      return "";
    }
    const existing = String(row.event_id || "");
    if (existing) {
      ctx.events.add(existing);
      return existing;
    }
    return openEvent(ctx, table, row);
  }

  /** Para dışı yazıcının satırı para satırı mı? Değilse true; öyleyse test kipinde hata, üretimde günlük + false. */
  function assertNonMoney(table, row = {}) {
    if (!isMoneyRow(table, row)) return true;
    policy.onViolations([{ code: "money-nonmoney", table, reason: "para dışı yazıcı para satırı yazmak istedi", id: String(row.id || "") }]);
    return false;
  }
  /**
   * Gözden geçirme D10 (Aşama 2): para dışı yazıcı yazdığı satırı YAZIMDAN SONRA veri tabanından okuyup denetletir (INSERT'e giden gerçek
   * değerler; önceden yazıcıların çoğu denetime INSERT'teki sabitlerin bir kopyasını veriyordu — yazıcı bozulsa denetim görmezdi).
   */
  function assertWrittenNonMoney(table, id) {
    const row = store.get(`SELECT * FROM ${table} WHERE id = ?`, id);
    return row ? assertNonMoney(table, row) : true;
  }

  // ---------- Olay kopyası (salt okuma dizini; para kaynağı satırın kendisidir; tek tanım: lib/bank/event-copy.mjs) ----------
  // Gözden geçirme B2 (Aşama 2; K11 "bir olay = bir para hareketi"): yazımdan sonra dokunulan her olayın EN ÇOK bir etkin satırı olur
  // (Kasa ↔ Banka transferinin iki bacağı tek istisna). Önceden Taksite Aktar → taşınan tahsilatı sil → aktarımı geri al → Silinenler'den
  // geri yükle sırası aynı olaya iki satır (kayıt tahsilatı + taksit tahsilatı) veriyordu: Kasa çift sayılıyordu (2.0.26'dan beri).
  function finalize(ctx) {
    const stamp = { by: ctx.user?.id || "system", at: stamp_() };
    for (const id of ctx.events) {
      const rows = eventRows(store, id);
      if (rows.length > 1 && !isTransferPair(rows)) {
        const event = store.get("SELECT no FROM fin_events WHERE id = ?", id);
        const where = [...new Set(rows.map(item => ROW_LABEL[item.table] || item.table))].join(", ");
        throw new HttpError(409, `Bu para hareketi${event?.no ? ` (İşlem No ${event.no})` : ""} zaten kayıtlı (${where}); aynı hareket ikinci kez yazılamaz. Hiçbir değişiklik yapılmadı.`, { code: "event-in-use", eventId: id, rows: rows.map(item => `${item.table}:${item.row.id}`) });
      }
      // Plan §3.8 / §3.13 (eşleşmiş satır): ekstreyle eşleşmiş olayın özeti (tutar, yön, hesap, tarih, para birimi, yol) ya da durumu bu
      // işlemde değişiyorsa 409 bank-reconciled. Önceden yalnız önceki hâli olay kimliği taşıyan yollar (cari, Kasa, kayıt, taksit, stok)
      // korunuyordu; çek tahsilini/ödemesini geri alma ve fatura Düzenle/İptal/Sil eşleşmiş olayı sessizce iptal ediyordu. Yalnız açıklaması
      // değişen satır (özet aynı) serbesttir (plan §3.8 "Yalnız kalem açıklaması değişen düzenleme serbest").
      const prior = ctx.created.has(id) ? null : store.get("SELECT status, amount_minor, direction, bank_ref, date, currency, method FROM fin_events WHERE id = ?", id);
      refreshEvent(store, id, { stamp: ctx.created.has(id) ? null : stamp });
      if (prior && store.get("SELECT 1 AS found FROM bank_matches WHERE event_id = ? AND undone_at IS NULL", id)) {
        const after = store.get("SELECT status, amount_minor, direction, bank_ref, date, currency, method FROM fin_events WHERE id = ?", id);
        if (!after || after.status !== prior.status || eventDigest(after) !== eventDigest(prior)) {
          throw new HttpError(409, "Bu hareket banka ekstresiyle eşleştirilmiş; önce eşleşmeyi kaldırın.", { code: "bank-reconciled", eventId: id });
        }
      }
    }
  }

  // ---------- GG2: banka hesabına bağlı modül satırları (K4 çapraz yetki, bağın yolla uyumu, geri yüklemede bağ) ----------
  // Bağ bir banka hesabı ya da (POS yolu için) bir POS'tur (108.T; POS kartı 2.2.0'da, şema ve kapı şimdiden tanır).
  const accountRowOf = id =>
    id
      ? store.get("SELECT id, kind, opening_date AS openingDate, deleted_at AS deletedAt, status, bank_name, name FROM bank_accounts WHERE id = ?", id) ||
        store.get("SELECT id, 'pos' AS kind, '' AS openingDate, deleted_at AS deletedAt, 'active' AS status, '' AS bank_name, '' AS name FROM pos_terminals WHERE id = ?", id) ||
        null
      : null;
  // Hesap türünün modül satırındaki yolu: 102 ailesi havale (bank), kurumsal kart POS/kart yolu (card); kredi hesabına modül satırı bağlanmaz.
  const familyOf = kind => (kind === "card" || kind === "pos" ? "card" : kind === "loan" ? "" : kind ? "bank" : "");
  /** Bağlı satır hesabına uyuyor mu: hâlâ para satırı ve yolu hesabın türünün yolu. */
  function refFits(table, row) {
    const account = accountRowOf(row?.fin_ref);
    return Boolean(account && !account.deletedAt && isMoneyRow(table, row) && familyOf(account.kind) === String(row.method || ""));
  }
  /**
   * Geri yüklenen ya da taşınan satırın bağı (plan §3.5 K13/7: "satır kendi bağını taşır"): hesap hâlâ varsa, satırın yolu hesabın türüne
   * uyuyorsa ve satır hesabın açılışından önce değilse aynı bağ; değilse '' (Hesabı Atanmamış) ve nedeni. Dönüş: { ref, dropped }.
   */
  function keepRef(ref, { method = "", date = "" } = {}) {
    const id = String(ref || "");
    if (!id) return { ref: "", dropped: "" };
    const account = accountRowOf(id);
    if (!account || account.deletedAt) return { ref: "", dropped: "deleted" };
    if (familyOf(account.kind) !== String(method || "")) return { ref: "", dropped: "method" };
    if (date && account.openingDate && date < account.openingDate) return { ref: "", dropped: "before-opening" };
    return { ref: id, dropped: "" };
  }
  /** keepRef'in düştüğü bağın kullanıcıya söylenen nedeni ("" = bağ korundu). */
  const droppedText = reason => (reason === "deleted" ? "Bağlı olduğu banka hesabı silindiği için hareket Banka → Hesabı Atanmamış Eski Hareketler'e döndü." : reason === "before-opening" ? "Hareket bağlı olduğu banka hesabının açılışından önce olduğu için Hesabı Atanmamış Eski Hareketler'e döndü." : "");
  // Para alanı sayılmayan kolonlar (K4: yalnız bunlar değiştiyse modül yetkisi yeter): serbest kolonlar + damgalar + olay bağı.
  const IGNORED = new Set(["updated_by", "updated_at", "event_id", "__rowid"]);
  const moneyChanged = (table, before, after) => Object.keys(before).some(key => !IGNORED.has(key) && !FREE_COLUMNS[table]?.has(key) && String(before[key] ?? "") !== String(after[key] ?? ""));
  const BOUND_TEXT = {
    "bank.cancel": "Bu hareket bir banka hesabına bağlı; silmek için \"Banka Hareketi Silme, İptal ve Ters Kayıt\" yetkisi gerekir.",
    "bank.move": "Bu hareket bir banka hesabına bağlı; tutarını, tarihini, yolunu ya da hesabını değiştirmek (ya da geri yüklemek, taşımak) için \"Banka Hareketi Girme ve Bankadan Çıkış\" yetkisi gerekir. Açıklama değiştirilebilir.",
  };
  /**
   * Yazımdan sonra (adım 6'dan sonra, olay kopyasından önce): bağlı satırların yetkisi ve yolu.
   *   - K4: bağlı satır silindiyse (sil işleminde) bank.cancel, parası değiştiyse / taşındıysa bank.move; geri yüklenen ya da taşınan bağlı satır
   *     bank.move ister. Hesap atama işlemi (op 'assign', Banka penceresi) kendi yetkisiyle (bank.accounts) gelir.
   *   - Yolu hesabın türüne uymayan satırın (havale → nakit/POS, peşin → açık hesap) bağı kalkar: tutar hem Kasa'da hem hesapta sayılmasın.
   */
  function boundRules(ctx) {
    if (!ctx.boundRows.size && !ctx.insertedRows.size) return;
    let need = "";
    for (const before of ctx.boundRows.values()) {
      const after = store.get(`SELECT rowid AS __rowid, * FROM ${before.__table} WHERE rowid = ?`, before.__rowid);
      if (!after || after.id !== before.id) {
        need ||= ctx.op === "delete" ? "bank.cancel" : "bank.move";
        continue;
      }
      if (after.fin_ref && !refFits(before.__table, after)) {
        store.run(`UPDATE ${before.__table} SET fin_ref = '' WHERE rowid = ?`, after.__rowid);
        after.fin_ref = "";
      }
      const { __table, __new, ...prior } = before;
      if (moneyChanged(__table, prior, after)) need ||= "bank.move";
    }
    if (["restore", "move", "update"].includes(ctx.op)) {
      for (const [table, rowids] of ctx.insertedRows) {
        if (store.get(`SELECT 1 AS found FROM ${table} WHERE rowid IN (SELECT value FROM json_each(?)) AND fin_ref <> '' LIMIT 1`, JSON.stringify([...rowids]))) need ||= "bank.move";
      }
    }
    if (need && ctx.op !== "assign" && ctx.user && ctx.user.id !== "system" && !permitted(ctx.user, need)) throw new HttpError(403, BOUND_TEXT[need], { code: "bank-permission", permission: need });
  }
  // Yargıç Y1 (plan §3.5 "Pasif hesap → 400"): pasif hesabın bakiyesi bu işlemde değişiyorsa 400 bank-account-passive. Hesap bazında net etki
  // (önceki hâl − sonraki hâl, kuruş) hesaplanır: yalnız açıklaması değişen satır, Düzenle'de aynı tutarla yeniden yazılan peşin satır ya da
  // Taksite Aktar (op 'move': satır tablo değiştirir, para yerinde) serbesttir; silme, tutar/tarih/yol değişikliği, başka hesaba taşıma, nakde
  // çevirme, fatura iptali/silmesi ve geri yükleme durur. Önceden pasif hesaba bağlı satır silinebiliyor, Düzenle'de başka hesaba taşınabiliyordu.
  const signedMinor = (table, row) => (row && isMoneyRow(table, row) ? (directionOf(table, row) === "out" ? -1 : 1) * toMinor(Math.abs(Number(row.amount) || 0)) : 0);
  // İç içe bank.post (ör. fatura Düzenle'nin içinde cari satırı ekleyen yazıcı) kendi satırlarını en dıştaki işleme devreder: pasif hesap kuralı
  // işlemin TAMAMI üzerinden (önce silinen, sonra aynı tutarla yeniden yazılan satır net sıfır) en dış bank.post'ta bir kez çalışır.
  // Devredilen satırlar ayrı tutulur (K4 yetki kararı her bank.post'un kendi satırlarıyla verilmeye devam eder).
  const insertedIn = (ctx, table, rowid) => Boolean(ctx.insertedRows.get(table)?.has(rowid) || ctx.handedInserted.get(table)?.has(rowid));
  function handOver(parent, ctx) {
    for (const source of [ctx.boundRows, ctx.handedBound]) for (const [key, row] of source) if (!parent.boundRows.has(key) && !parent.handedBound.has(key)) parent.handedBound.set(key, row);
    for (const source of [ctx.insertedRows, ctx.handedInserted]) {
      for (const [table, rowids] of source) {
        if (!parent.handedInserted.has(table)) parent.handedInserted.set(table, new Set());
        for (const rowid of rowids) parent.handedInserted.get(table).add(rowid);
      }
    }
  }
  function passiveRules(ctx) {
    if (ctx.op === "assign" || ctx.op === "move") return;
    const delta = new Map();
    const add = (ref, value, date) => {
      if (!ref || !value) return;
      const item = delta.get(ref) || { minor: 0, dates: new Set() };
      item.minor += value;
      item.dates.add(String(date || ""));
      delta.set(ref, item);
    };
    for (const before of [...ctx.boundRows.values(), ...ctx.handedBound.values()]) {
      const { __table, __new, ...prior } = before;
      // Bu işlemde eklenip sonra düzeltilen satır (__new) eklenenlerle sayılır.
      if (__new) continue;
      add(prior.fin_ref, -signedMinor(__table, prior), prior.date);
      const after = store.get(`SELECT * FROM ${__table} WHERE rowid = ?`, before.__rowid);
      if (after && after.id === prior.id && !insertedIn(ctx, __table, before.__rowid)) add(after.fin_ref, signedMinor(__table, after), after.date);
    }
    const inserted = new Map();
    for (const source of [ctx.insertedRows, ctx.handedInserted]) for (const [table, rowids] of source) for (const rowid of rowids) inserted.set(`${table}:${rowid}`, [table, rowid]);
    for (const [table, rowid] of inserted.values()) {
      const row = store.get(`SELECT * FROM ${table} WHERE rowid = ?`, rowid);
      if (row?.fin_ref) add(row.fin_ref, signedMinor(table, row), row.date);
    }
    for (const [ref, item] of delta) {
      // Tutar aynı kalıp tarih değişen satır da para değişikliğidir (pickRef açılış/Devir kuralı); net sıfır + tek tarih serbest.
      if (!item.minor && item.dates.size <= 1) continue;
      const account = accountRowOf(ref);
      if (account && !account.deletedAt && account.status && account.status !== "active" && account.kind !== "pos") throw bankPassiveError(account);
    }
  }

  // Adım 3 (iskelet): hesaba bağlı satır (fin_ref) değişiyorsa çapraz yetki; ekstreyle eşleşmiş olay değişmez.
  // Aşama 3: banka yetkileri katalogda; karar kişinin ETKİN yetkisidir (rol + kişiye eklenen − kaldırılan). Önceden (Aşama 2) anahtarlar
  // katalogda olmadığı için rol matrisine geri düşülüyordu: kişiden bilinçli kaldırılan bank.cancel yine izin veriyordu.
  const permitted = (user, key) => canUser(user, key);
  function assertMutable(user, op, prev) {
    if (op === "create") return;
    for (const item of [prev].flat(Infinity)) {
      if (!item || typeof item !== "object") continue;
      const finRef = String(item.fin_ref ?? item.finRef ?? "");
      const eventId = String(item.event_id ?? item.eventId ?? "");
      // Silmede erken engel; düzeltmede karar yazımdan sonra özetle verilir (finalize: yalnız açıklaması değişen satır serbest).
      if (op === "delete" && eventId && store.get("SELECT 1 AS found FROM bank_matches WHERE event_id = ? AND undone_at IS NULL", eventId)) {
        throw new HttpError(409, "Bu hareket banka ekstresiyle eşleştirilmiş; önce eşleşmeyi kaldırın.", { code: "bank-reconciled", eventId });
      }
      // GG2: K4 çapraz yetki asıl olarak yazımdan sonra GERÇEK satırla (boundRules): önceki hâl nesnelerinin çoğu fin_ref taşımıyordu (modül
      // ekranından silme/düzeltme yetkisiz geçiyordu). Burada yalnız silme (önceki hâl bağlıysa her silme parasaldır); düzeltmede yalnız
      // açıklama değişimi serbest kalsın diye karar boundRules'un satır karşılaştırmasındadır.
      if (finRef && op === "delete" && !permitted(user, "bank.cancel")) throw new HttpError(403, BOUND_TEXT["bank.cancel"], { code: "bank-permission", permission: "bank.cancel" });
    }
  }
  // ---------- Banka Fişi (v2.1.0 Aşama 3; plan §3.6, §3.7, §3.8) ----------
  // Bankanın doğurduğu olay (açılış, Devir Kapanışı, eski bakiye aktarımı; Aşama 4'te masraf, faiz, transfer …): işlem başlığı + satırları
  // (bank_lines; THP kodu, alt hesap ve kuruş yazım anında saklanır). Satır kuralları (beyaz liste, denge) lib/bank/voucher.mjs'te kurulur ve
  // kapıda (bank:voucher) ayrıca denetlenir. Yalnız bank.post'un write geri çağrısında; olay dokunulan olaylara girer (kapı ve K6).
  function needContext(what) {
    const ctx = current();
    if (!ctx) throw new TypeError(`bank.${what} yalnız bank.post'un write geri çağrısında çağrılır`);
    return ctx;
  }
  /**
   * fields: { type, date, bankRef, counterRef, reversalOf, description, reference, partyId, invoiceId, channel, valueDate, origin, originKey }
   * lines: [{ role, gl, sub, ref, side ('D'|'C'), tryMinor, currency, fxMinor, rateE6, rateSource, memo }] — boş olabilir (sıfır açılış).
   * Dönüş: { id, no, year, seq }.
   */
  function openVoucher(fields = {}, lines = []) {
    const ctx = needContext("voucher");
    if (!EVENT_TYPES.has(fields.type)) throw new TypeError(`bank.voucher: bilinmeyen işlem türü "${fields.type}"`);
    const date = String(fields.date || "");
    const { year, seq, no } = nextEventNo(store, date, { now });
    const id = newEventId();
    const copy = voucherCopy(lines, fields.bankRef || "");
    store.run(
      `INSERT INTO fin_events (id, year, seq, no, type, date, value_date, status, reversal_of, origin, origin_key, channel, src_table, src_id, bank_ref, counter_ref, direction, amount_minor, try_minor, currency, method, party_id, invoice_id, description, reference, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, year, seq, no, fields.type, date, String(fields.valueDate || ""), String(fields.reversalOf || ""), fields.origin || ctx.origin, String(fields.originKey || ""), String(fields.channel || ""),
      String(fields.bankRef || ""), String(fields.counterRef || ""), copy.direction, copy.amountMinor, copy.tryMinor, fields.currency || copy.currency, copy.method, String(fields.partyId || ""),
      String(fields.invoiceId || ""), String(fields.description || ""), String(fields.reference || ""), ctx.user?.id || "system", stamp_(),
    );
    lines.forEach((line, index) => {
      store.run(
        "INSERT INTO bank_lines (id, event_id, seq, role, gl, sub, ref, side, try_minor, currency, fx_minor, rate_e6, rate_source, memo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        `bl-${randomUUID()}`, id, index + 1, line.role, String(line.gl), String(line.sub || ""), String(line.ref || ""), line.side, line.tryMinor, line.currency || "TRY",
        line.fxMinor ?? line.tryMinor, line.rateE6 || 1_000_000, String(line.rateSource || ""), String(line.memo || ""),
      );
    });
    ctx.events.add(id);
    ctx.created.add(id);
    return { id, no, year, seq };
  }
  /**
   * Ters Kayıt (§3.8): asıl fişin aynası (satırlar aynı, taraflar ters) "reversal" türüyle yazılır; asıl fiş "reversed" olur. Satırı olmayan
   * fiş (sıfır açılış) ters kaydedilmez, iptal edilir (cancelBareEvent). date: ters fişin tarihi (çağıran kilit kuralını uygular).
   */
  // returnInvoiceId (GG2): kilitli dönemdeki KDV'li masrafın başlığı (satırsız) iptal edilmez, ters kaydedilir: ters kaydın parası bugün tarihli
  // Alıştan İade faturasındadır (iade tahsilatı bu hesaba); ters kayıt satırsızdır ve o iade faturasına bağlıdır.
  function reverseVoucher(eventId, { date = "", description = "", returnInvoiceId = "" } = {}) {
    const ctx = needContext("reverse");
    const event = store.get("SELECT * FROM fin_events WHERE id = ?", eventId);
    if (!event || event.src_table !== "") throw new HttpError(404, "Banka fişi bulunamadı.", { code: "bank-event-missing" });
    if (event.status !== "active") throw new HttpError(409, `Bu işlem (${event.no}) zaten ters kaydedilmiş ya da iptal edilmiş.`, { code: "bank-already-reversed", eventNo: event.no });
    if (event.type === "reversal") throw new HttpError(409, "Ters kayıt ters kaydedilmez; asıl işlemi düzeltin.", { code: "bank-reversal-of-reversal" });
    const lines = store.all("SELECT * FROM bank_lines WHERE event_id = ? ORDER BY seq", eventId);
    if (!lines.length && !returnInvoiceId) return cancelBareEvent(eventId);
    if (returnInvoiceId && (lines.length || event.type !== "fee" || !event.invoice_id)) throw new TypeError("bank.reverse: iade faturalı ters kayıt yalnız KDV'li masraf başlığında");
    const mirror = lines.map(line => ({ role: line.role, gl: line.gl, sub: line.sub, ref: line.ref, side: line.side === "D" ? "C" : "D", tryMinor: line.try_minor, currency: line.currency, fxMinor: line.fx_minor, rateE6: line.rate_e6, rateSource: line.rate_source, memo: line.memo }));
    const reversal = openVoucher({ type: "reversal", date: date || event.date, bankRef: event.bank_ref, counterRef: event.counter_ref, reversalOf: eventId, partyId: event.party_id, invoiceId: returnInvoiceId || event.invoice_id, currency: event.currency, description: description || `Ters Kayıt · ${event.no}` }, mirror);
    store.run("UPDATE fin_events SET status = 'reversed', reversed_by = ?, updated_by = ?, updated_at = ? WHERE id = ?", reversal.id, ctx.user?.id || "system", stamp_(), eventId);
    ctx.events.add(eventId);
    return reversal;
  }
  /** Satırı olmayan işlem başlığını (sıfır açılış, sihirbaz başlığı) iptal eder; kopyası kalır. Satırı olan fiş iptal edilmez (ters kaydedilir). */
  function cancelBareEvent(eventId) {
    const ctx = needContext("cancelBare");
    const event = store.get("SELECT id, no, status, src_table AS srcTable FROM fin_events WHERE id = ?", eventId);
    if (!event || event.srcTable !== "") throw new HttpError(404, "Banka fişi bulunamadı.", { code: "bank-event-missing" });
    if (store.get("SELECT 1 AS found FROM bank_lines WHERE event_id = ? LIMIT 1", eventId)) throw new HttpError(409, `Satırı olan banka fişi (${event.no}) iptal edilmez; ters kaydedilir.`, { code: "bank-event-has-lines" });
    if (event.status !== "active") throw new HttpError(409, `Bu işlem (${event.no}) zaten iptal edilmiş ya da ters kaydedilmiş.`, { code: "bank-already-reversed", eventNo: event.no });
    store.run("UPDATE fin_events SET status = 'cancelled', updated_by = ?, updated_at = ? WHERE id = ?", ctx.user?.id || "system", stamp_(), eventId);
    ctx.events.add(eventId);
    return { id: eventId, no: event.no, cancelled: true };
  }

  // ---------- Adım 4: Benzer İşlem Uyarısı (K8; §3.10/2; Aşama 4) ----------
  // Yalnız hesaba bağlı (bank_ref dolu) ve parası olan yeni olaylarda (create): aynı iş günü, aynı hesap, aynı tür, aynı yön, aynı tutar, aynı
  // cari ve aynı hedef (fatura, taksit kartı, çek; Aşama 9: transferde ve kart/kredi işleminde karşı hesap) etkin bir olay varsa 409 bank-similar (önceki İşlem No, giren, tarih). "Yine de Kaydet"
  // (similarOk) geçer. Nakit ve hesabı atanmamış satır denetlenmez (güvenilir hedef yok; aynı gün aynı tutarda iki nakit hareket olağan).
  // Olay kopyası yazımdan sonra yenilendiği için denetim finalize'dan sonra, aynı işlemde (BEGIN IMMEDIATE) yapılır: aynı anda gelen iki
  // istekten ikincisi birincinin olayını görür. Ayar: Banka Ayarları → Mükerrer → Benzer İşlem Uyarısı (varsayılan Açık).
  const SKIP_SIMILAR = new Set(["opening", "reversal", "carry_close", "legacy_assign", "legacy_reclass", ...NON_MONEY_TYPES]);
  const similarEnabled = () => {
    try {
      return JSON.parse(store.setting("bank.settings", "") || "{}")?.similar?.enabled !== false;
    } catch {
      return true;
    }
  };
  /** İş günü: tatil ve hafta sonu bir sonraki iş gününe (Cumartesi ↔ Pazartesi aynı iş günü). Şirketin tatil ekleri (bank_holidays) dahil. */
  function businessDayOf() {
    let calendar;
    try {
      const raw = JSON.parse(store.setting("bank.settings", "") || "{}");
      const rows = store.all("SELECT date, kind, name FROM bank_holidays");
      calendar = createTrCalendar({
        // GG2 (orta): Banka Ayarları → Gelişmiş → Tatil → Hafta Sonu ("Yalnız Pazar": Cumartesi iş günü); önceden okunmuyordu.
        weekend: raw?.holidayAdvanced?.weekend === "sun" ? [0] : [6, 0],
        halfDayIsBusiness: raw?.holidayAdvanced?.halfDay !== "holiday",
        added: rows.filter(row => row.kind !== "removed").map(row => ({ date: row.date, name: row.name, half: row.kind === "half" })),
        removed: rows.filter(row => row.kind === "removed").map(row => row.date),
      });
    } catch {
      calendar = createTrCalendar();
    }
    return iso => {
      try {
        return calendar.adjust(iso, "following");
      } catch {
        return iso;
      }
    };
  }
  function similar(ctx, similarOk) {
    if (similarOk || ctx.op !== "create" || !ctx.created.size || !similarEnabled()) return;
    let businessDay = null;
    for (const id of ctx.created) {
      const event = store.get("SELECT id, no, type, date, status, bank_ref AS bankRef, counter_ref AS counterRef, direction, try_minor AS tryMinor, party_id AS partyId, invoice_id AS invoiceId, plan_id AS planId, cheque_id AS chequeId FROM fin_events WHERE id = ?", id);
      if (!event || event.status !== "active" || !event.bankRef || !event.direction || !(Number(event.tryMinor) > 0) || SKIP_SIMILAR.has(event.type)) continue;
      businessDay ??= businessDayOf();
      const day = businessDay(event.date);
      // İndeks (bank_ref, date, id) ile; tür/yön/tutar/hedef satırda denetlenir (+ işareti durum ve tür indekslerini kapatır).
      const candidates = store.all(
        `SELECT e.id, e.no, e.date, e.created_by AS createdBy, e.created_at AS createdAt, COALESCE(u.display_name, '') AS createdByName
         FROM fin_events e LEFT JOIN users u ON u.id = e.created_by
         WHERE e.bank_ref = ? AND e.date BETWEEN ? AND ? AND +e.status = 'active' AND +e.type = ? AND +e.direction = ? AND +e.try_minor = ?
           AND +e.party_id = ? AND +e.invoice_id = ? AND +e.plan_id = ? AND +e.cheque_id = ? AND +e.counter_ref = ? AND e.id <> ?
         ORDER BY e.date, e.created_at`,
        event.bankRef, addCalendarDays(event.date, -12), addCalendarDays(event.date, 12), event.type, event.direction, event.tryMinor, event.partyId, event.invoiceId, event.planId, event.chequeId, event.counterRef || "", event.id,
      );
      // Masrafta "hedef" masraf türüdür (gider hesabı + tür adı; Ek A): aynı gün aynı tutarda EFT ücreti ile havale ücreti ayrı masraftır.
      const feeKey = id => store.get("SELECT gl || '|' || memo AS k FROM bank_lines WHERE event_id = ? AND role = 'expense' ORDER BY seq LIMIT 1", id)?.k || "";
      const own = event.type === "fee" ? feeKey(event.id) : "";
      const match = candidates.find(row => !ctx.created.has(row.id) && businessDay(row.date) === day && (event.type !== "fee" || feeKey(row.id) === own));
      if (match) throw similarError(match, event);
    }
  }
  /** 409 bank-similar: önceki işlemin İşlem No'su, tarihi ve gireni (KDV'li masrafın kendi denetimi de bu biçimi kullanır). */
  function similarError(match, event = null) {
    const when = String(match.date || "").split("-").reverse().join(".");
    return new HttpError(409, `Aynı iş gününde aynı hesapta aynı tutarda benzer bir işlem kayıtlı (${match.no}, ${when}${match.createdByName ? `, ${match.createdByName}` : ""}). Gerçekten ikinci bir işlemse "Yine de Kaydet" ile kaydedin.`, {
      code: "bank-similar", eventId: match.id, eventNo: match.no, date: match.date, createdBy: match.createdBy || "", createdByName: match.createdByName || "", createdAt: match.createdAt || "", ...(event ? { newDate: event.date } : {}),
    });
  }
  // Adım 7: POS kancaları — POS satışı bu aşamada yazılmaz (Aşama 9–10).
  const posHooks = () => {};

  function post(options = {}) {
    const { user = null, scope = "", requestId = "", module = "", op, body, prev, write, prepare = null, guard = null, audit: auditEntry = null, origin = "manual", similarOk = false } = options;
    if (!OP_SET.has(op)) throw new TypeError(`bank.post: bilinmeyen işlem türü "${op}" (${OPS.join(", ")})`);
    if (typeof write !== "function") throw new TypeError("bank.post: write geri çağrısı gerekli");
    if (op !== "create" && prev === undefined) throw new TypeError(`bank.post: "${op}" işleminde önceki hâl (prev) zorunlu (işlem geçmişinin "previous" alanı)`);
    return store.tx(() => {
      // 1
      let key = "";
      let hash = "";
      if (requestId) {
        if (!requests) throw new TypeError("bank.post: istek kimliği için depo (requests) kurulmamış");
        key = requests.key(user, scope || `${module}.${op}`, requestId);
        hash = bodyHash(body ?? {});
        const hit = requests.lookup(key, hash);
        if (hit) return { replayed: true, refId: hit.refId };
      }
      const ctx = { user, module, op, origin, events: new Set(), created: new Set(), boundRows: new Map(), insertedRows: new Map(), handedBound: new Map(), handedInserted: new Map() };
      ctx.affected = ids => ids.forEach(id => ctx.events.add(id));
      // GG2: bağlı satırın önceki hâli (ilk dokunuşta) ve eklenen satırlar (lib/db.mjs kancaları).
      ctx.bound = (table, rowids) => {
        for (const rowid of rowids) {
          const key = `${table}:${rowid}`;
          if (ctx.boundRows.has(key)) continue;
          const row = store.get(`SELECT rowid AS __rowid, * FROM ${table} WHERE rowid = ?`, rowid);
          // __new: satır bu işlemde (dıştaki bank.post'lar dahil) eklendi; önceki hâli işlem öncesi değil, pasif hesap kuralında eklenenlerle sayılır.
          if (row) ctx.boundRows.set(key, { ...row, __table: table, __new: stack.some(item => insertedIn(item, table, rowid)) });
        }
      };
      ctx.inserted = (table, rowids) => {
        if (!ctx.insertedRows.has(table)) ctx.insertedRows.set(table, new Set());
        for (const rowid of rowids) ctx.insertedRows.get(table).add(rowid);
      };
      ctx.eventFor = eventFor;
      stack.push(ctx);
      store.enterPost(ctx);
      try {
        prepare?.(ctx); // 2
        assertMutable(user, op, prev); // 3
        const result = write(ctx); // 5–6
        boundRules(ctx); // 3 (GG2): bağlı satırlar — K4 yetkisi ve bağın yolla uyumu (yazımdan sonra, gerçek satırla)
        if (stack.length > 1) handOver(stack[stack.length - 2], ctx);
        else passiveRules(ctx); // 3 (Yargıç Y1): pasif hesabın bakiyesi değişmez
        finalize(ctx); // 5: olay kopyası, iptal, yeniden etkin
        similar(ctx, similarOk); // 4: yeni olayların kopyası üzerinden (aynı işlemde; yukarıdaki not)
        posHooks(ctx); // 7
        guard?.(result, ctx); // 8
        if (auditEntry) {
          // 9
          const payload = { ...(auditEntry.payload || {}) };
          if (op !== "create" && !("previous" in payload)) payload.previous = prev;
          if (!audit) throw new TypeError("bank.post: işlem geçmişi (audit) kurulmamış");
          audit(user, auditEntry.type, auditEntry.entityId ?? "", payload);
        }
        if (key) requests.remember(key, hash, typeof result?.id === "string" ? result.id : [...ctx.events][0] || ""); // 10
        for (const id of ctx.events) store.touchEvent(id); // 11
        return result;
      } finally {
        stack.pop();
        store.leavePost(ctx);
      }
    });
  }

  return { post, eventFor, assertNonMoney, assertWrittenNonMoney, voucher: openVoucher, reverse: reverseVoucher, cancelBare: cancelBareEvent, similarError, businessDayOf, isMoney: isMoneyRow, keepRef, droppedText, refFits, policy, get inPost() {
    return stack.length > 0;
  } };
}
