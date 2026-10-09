// Merkezi para yazımı: bank.post (v2.1.0; docs/BANKA-MODULU-PLAN.md §3.3, K6, K11).
//
// Bütün para yazımları (nakit dahil) tek sarmalayıcıdan geçer; modül yalnız kendi satırını yazan geri çağrıyı (write) verir.
//   bank.post({ user, scope, requestId, module, op, body, prev, write, prepare, guard, audit })
//   op: 'create' | 'update' | 'delete' | 'move' (Taksite Aktar ve geri alması) | 'restore' (Silinenler) | 'assign' (yalnız bağ)
// Tek BEGIN IMMEDIATE (store.tx; iç içe çağrı SAVEPOINT) içinde:
//    1  istek kimliği: aynı kimlik + aynı içerik → yazmadan { replayed, refId }; farklı içerik → 409 (request_keys, kalıcı)
//    2  prepare(ctx): modülün hedef kuralları (Aşama 2'de modüller bugünkü kurallarını kendi rotalarında uygular; kanca)
//    3  assertMutable: hesaba bağlı (fin_ref dolu) satırda çapraz yetki (bank.move / bank.cancel), eşleşmiş olayda 409 (iskelet:
//       Aşama 2'de hesaba bağlı satır yazılmaz; Aşama 5'te etkin)
//    4  similar: Benzer İşlem (K8) — boş kanca (yalnız hesaba bağlı satırda çalışır; Aşama 5)
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
import { nextEventNo } from "./event-no.mjs";
import { EVENT_TYPES, typeOf } from "./event-types.mjs";
import { voucherCopy } from "./voucher.mjs";
import { FREE_COLUMNS, LEDGER_TABLES, SOURCE_TABLES, isMoneyRow, moneyWhere } from "./money-lines.mjs";
import { eventRows, isTransferPair, refreshEvent } from "./event-copy.mjs";

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
    const id = `ev-${randomUUID()}`;
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
      refreshEvent(store, id, { stamp: ctx.created.has(id) ? null : stamp });
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
      if (eventId && store.get("SELECT 1 AS found FROM bank_matches WHERE event_id = ? AND undone_at IS NULL", eventId)) {
        throw new HttpError(409, "Bu hareket banka ekstresiyle eşleştirilmiş; önce eşleşmeyi kaldırın.", { code: "bank-reconciled", eventId });
      }
      const need = op === "delete" ? "bank.cancel" : op === "update" ? "bank.move" : "";
      if (finRef && need && !permitted(user, need)) throw new HttpError(403, "Banka hesabına bağlı hareketi değiştirme yetkiniz yok.", { code: "bank-permission", permission: need });
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
   * fields: { type, date, bankRef, counterRef, reversalOf, description, reference, partyId, valueDate, origin, originKey }
   * lines: [{ role, gl, sub, ref, side ('D'|'C'), tryMinor, currency, fxMinor, rateE6, rateSource, memo }] — boş olabilir (sıfır açılış).
   * Dönüş: { id, no, year, seq }.
   */
  function openVoucher(fields = {}, lines = []) {
    const ctx = needContext("voucher");
    if (!EVENT_TYPES.has(fields.type)) throw new TypeError(`bank.voucher: bilinmeyen işlem türü "${fields.type}"`);
    const date = String(fields.date || "");
    const { year, seq, no } = nextEventNo(store, date, { now });
    const id = `ev-${randomUUID()}`;
    const copy = voucherCopy(lines, fields.bankRef || "");
    store.run(
      `INSERT INTO fin_events (id, year, seq, no, type, date, value_date, status, reversal_of, origin, origin_key, src_table, src_id, bank_ref, counter_ref, direction, amount_minor, try_minor, currency, method, party_id, description, reference, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, year, seq, no, fields.type, date, String(fields.valueDate || ""), String(fields.reversalOf || ""), fields.origin || ctx.origin, String(fields.originKey || ""),
      String(fields.bankRef || ""), String(fields.counterRef || ""), copy.direction, copy.amountMinor, copy.tryMinor, fields.currency || copy.currency, copy.method, String(fields.partyId || ""),
      String(fields.description || ""), String(fields.reference || ""), ctx.user?.id || "system", stamp_(),
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
  function reverseVoucher(eventId, { date = "", description = "" } = {}) {
    const ctx = needContext("reverse");
    const event = store.get("SELECT * FROM fin_events WHERE id = ?", eventId);
    if (!event || event.src_table !== "") throw new HttpError(404, "Banka fişi bulunamadı.", { code: "bank-event-missing" });
    if (event.status !== "active") throw new HttpError(409, `Bu işlem (${event.no}) zaten ters kaydedilmiş ya da iptal edilmiş.`, { code: "bank-already-reversed", eventNo: event.no });
    if (event.type === "reversal") throw new HttpError(409, "Ters kayıt ters kaydedilmez; asıl işlemi düzeltin.", { code: "bank-reversal-of-reversal" });
    const lines = store.all("SELECT * FROM bank_lines WHERE event_id = ? ORDER BY seq", eventId);
    if (!lines.length) return cancelBareEvent(eventId);
    const mirror = lines.map(line => ({ role: line.role, gl: line.gl, sub: line.sub, ref: line.ref, side: line.side === "D" ? "C" : "D", tryMinor: line.try_minor, currency: line.currency, fxMinor: line.fx_minor, rateE6: line.rate_e6, rateSource: line.rate_source, memo: line.memo }));
    const reversal = openVoucher({ type: "reversal", date: date || event.date, bankRef: event.bank_ref, counterRef: event.counter_ref, reversalOf: eventId, partyId: event.party_id, currency: event.currency, description: description || `Ters Kayıt · ${event.no}` }, mirror);
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

  // Adım 4 ve 7: Benzer İşlem ve POS kancaları — hesaba bağlı satır ve POS satışı bu aşamada yazılmaz.
  const similar = () => {};
  const posHooks = () => {};

  function post(options = {}) {
    const { user = null, scope = "", requestId = "", module = "", op, body, prev, write, prepare = null, guard = null, audit: auditEntry = null, origin = "manual" } = options;
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
      const ctx = { user, module, op, origin, events: new Set(), created: new Set() };
      ctx.affected = ids => ids.forEach(id => ctx.events.add(id));
      ctx.eventFor = eventFor;
      stack.push(ctx);
      store.enterPost(ctx);
      try {
        prepare?.(ctx); // 2
        assertMutable(user, op, prev); // 3
        similar(ctx); // 4
        const result = write(ctx); // 5–6
        finalize(ctx); // 5: olay kopyası, iptal, yeniden etkin
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

  return { post, eventFor, assertNonMoney, assertWrittenNonMoney, voucher: openVoucher, reverse: reverseVoucher, cancelBare: cancelBareEvent, isMoney: isMoneyRow, policy, get inPost() {
    return stack.length > 0;
  } };
}
