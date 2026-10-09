// Açılış onarımı (v2.1.0; docs/BANKA-MODULU-PLAN.md §10.6, E1.16, E2.08).
//
// Gerçek durum: 2.0.25 ve 2.0.26 v20 veri dosyasını açar ve yazar (bekleyen göç yoksa göç koşucusu döner); yeni kolonları (fin_ref,
// event_id) ve tabloları (fin_events, cheque_collections, pos_*, bank_matches) bilmez. Kullanıcı eski sürüme dönüp çalışır, sonra yeniden
// güncellerse bu adım (mutabakat kapısı kurulmadan önce, store.raw("repair") kapsamında, tek işlemde) eski sürümün izlerini toplar:
//   a. eski sürümün yazdığı olaysız para satırı → "Hesabı Belirsiz Yeni Hareketler (n)" (uyarı; satır değişmez — Banka modülünde hesaba
//      atanır). Eski satır işareti (meta.bank.legacyMarks): v20'den sonraki ilk açılışta her para tablosunun en büyük rowid'i.
//   b. eşleşmiş olayın satırı değişmiş ya da silinmiş → eşleşme geri alınır (undo_reason "eski-surum")
//   c. bekleyen POS satışının kaynak satırı silinmiş → satış ve bekleyen kalemleri iptal (void)
//   d. bankaya geçmiş POS satışının kaynak satırı silinmiş → "Onarım Bekliyor" (status "repair") + uyarı (yalnız o POS)
//   e. satırı olmayan etkin olay → iptal
//   f. yolu nakde çevrilmiş ama fin_ref'i dolu satır → açık dönemde fin_ref temizlenir; kilitli dönemde yalnız uyarı
//   g. olay kopyası satırla uyuşmuyor → açık dönemde ve eşleşmemişse kopya satırdan yenilenir; değilse "Onarım Bekliyor"
//   h. tahsildeki çek eski sürümde ciro edilmiş / silinmiş / tahsil edilmiş → kayıt "withdrawn" ya da "collected" olarak kapanır; kapanış
//      işlem başlığı (cheque_withdraw, origin "repair") yazılır
// Yalnız ilgili kayıtlar değişir; değişen ya da bulunan her şey integrity_log'a ("repair") ve meta.bank.repair'e (zil ve Banka modülünün
// uyarısı için; arayüz Aşama 3/14) yazılır. Onarım tek seferliktir: ikinci açılışta değiştirecek bir şey kalmaz (kilitli dönemdeki kayıtlar
// "Onarım Bekliyor" listesinde kalır ve kapının tabanıdır).
import { randomUUID } from "node:crypto";
import { systemClock } from "../clock.mjs";
import { LEGACY_MARKS_AT_KEY, LEGACY_MARKS_KEY } from "./checks.mjs";
import { copyMismatchSql, eventCopy, eventDigest, eventRows, isModuleEvent, primaryRow, refreshEvent } from "./event-copy.mjs";
import { NON_MONEY_TYPES } from "./event-types.mjs";
import { newEventId, nextEventNo } from "./event-no.mjs";
import { MODULE_TABLES, moneyWhere } from "./money-lines.mjs";

export const REPAIR_KEY = "meta.bank.repair";
export const REPAIR_STAMP_KEY = "meta.bank.repairStamp";
const NON_MONEY_SQL = [...NON_MONEY_TYPES].map(type => `'${type}'`).join(", ");

/** Eski satır işaretini (tablo → en büyük rowid) yazar: v20'den sonraki ilk açılışta ve şirket verisi sıfırlanınca (silinen tablolarda rowid
 * baştan başlar; işaret yenilenmezse eski sürümün sıfırlama sonrası yazdığı olaysız satır görünmezdi). */
export function markLegacyRows(store, { now = systemClock } = {}) {
  const marks = Object.fromEntries(MODULE_TABLES.map(table => [table, Number(store.get(`SELECT COALESCE(MAX(rowid), 0) AS m FROM ${table}`).m) || 0]));
  store.setSetting(LEGACY_MARKS_KEY, JSON.stringify(marks));
  markLegacyTime(store, { now });
  return marks;
}
/**
 * Gözden geçirme D4 (Aşama 2): işaretin ZAMANI — eski satırların en yenisinin oluşturulma anı (ve işaretin konduğu an; büyüğü). Eski sürüm
 * (2.0.25/2.0.26) bir tabloyu boşaltıp ("Tüm Hareketleri Sil") yeniden yazarsa rowid baştan başlar, yazdığı satır işaretin ALTINDA kalırdı:
 * olaysız para satırı, oluşturulma anı işaret zamanından sonraysa da eski sürümün yazdığıdır. Eski satırların hepsi bu andan önce (en geç
 * bu anda) oluşturulduğundan saat kayması ya da sahte saat onları yanlışlıkla "yeni" saydırmaz.
 */
export function markLegacyTime(store, { now = systemClock } = {}) {
  let at = now().toISOString();
  for (const table of MODULE_TABLES) {
    const latest = String(store.get(`SELECT MAX(created_at) AS m FROM ${table}`)?.m || "");
    if (latest > at) at = latest;
  }
  store.setSetting(LEGACY_MARKS_AT_KEY, at);
  return at;
}

export function repairBank({ store, now = systemClock, period = null, log = null, newId = () => `int-${randomUUID()}` }) {
  const tables = new Set(store.all("SELECT name FROM sqlite_master WHERE type = 'table'").map(row => row.name));
  const columns = table => new Set(store.all(`PRAGMA table_info(${table})`).map(row => row.name));
  if (!tables.has("fin_events") || !columns("cash_entries").has("event_id")) return null;
  const at = now().toISOString();
  const lock = period?.lockedUntil?.() || "";
  const open = date => !lock || String(date || "") > lock;
  const stamp = { by: "system", at };
  const previous = (() => {
    try {
      return JSON.parse(store.setting(REPAIR_KEY, "") || "{}") || {};
    } catch {
      return {};
    }
  })();
  const report = { at, unassigned: 0, unassignedSample: [], undoneMatches: [], voidedSales: [], cancelledEvents: [], clearedRefs: [], refreshedEvents: [], closedCollections: [], pending: [] };
  const pending = (kind, id, reason) => report.pending.push({ kind, id, reason });

  store.raw("repair", () =>
    store.tx(() => {
      // Eski satır işareti: v20'den sonraki ilk açılışta (bu adım ilk kez çalışırken) her para tablosunun en büyük rowid'i.
      let marks = null;
      try {
        marks = JSON.parse(store.setting(LEGACY_MARKS_KEY, "") || "null");
      } catch {
        marks = null;
      }
      if (!marks || typeof marks !== "object") marks = markLegacyRows(store, { now });
      // İşaret zamanı yoksa (önceki geliştirme sürümü) bugünkü en yeni satırdan konur.
      const marksAt = store.setting(LEGACY_MARKS_AT_KEY, "") || markLegacyTime(store, { now });

      // a) eski sürümün yazdığı olaysız para satırları (uyarı): işaretin üstündeki rowid ya da işaret zamanından sonra oluşturulmuş.
      for (const table of MODULE_TABLES) {
        for (const row of store.all(`SELECT r.id FROM ${table} r WHERE r.event_id = '' AND (r.rowid > ? OR r.created_at > ?) AND ${moneyWhere(table, "r")}`, Number(marks[table]) || 0, marksAt)) {
          report.unassigned += 1;
          if (report.unassignedSample.length < 20) report.unassignedSample.push(`${table}:${row.id}`);
        }
      }

      // b) eşleşmiş olayın satırı değişmiş ya da silinmiş → eşleşme geri alınır
      const matched = new Set();
      if (tables.has("bank_matches")) {
        for (const match of store.all("SELECT id, event_id AS eventId, digest FROM bank_matches WHERE undone_at IS NULL")) {
          const event = store.get("SELECT * FROM fin_events WHERE id = ?", match.eventId);
          if (!isModuleEvent(event)) {
            matched.add(match.eventId);
            continue;
          }
          const rows = eventRows(store, match.eventId);
          const primary = rows.length ? primaryRow(rows) : null;
          const current = primary ? eventDigest(eventCopy(store, primary.table, primary.row)) : "";
          if (current && current === match.digest) {
            matched.add(match.eventId);
            continue;
          }
          store.run("UPDATE bank_matches SET undone_at = ?, undone_by = 'system', undo_reason = 'eski-surum' WHERE id = ?", at, match.id);
          report.undoneMatches.push(match.id);
        }
      }

      // f) yolu nakde çevrilmiş ama hesaba bağlı satır
      const touched = new Set();
      for (const table of MODULE_TABLES) {
        for (const row of store.all(`SELECT id, date, event_id AS eventId FROM ${table} WHERE fin_ref <> '' AND method = 'cash'`)) {
          if (!open(row.date)) {
            pending("f", `${table}:${row.id}`, "kilitli dönemde nakit satır hesaba bağlı");
            continue;
          }
          store.run(`UPDATE ${table} SET fin_ref = '' WHERE id = ?`, row.id);
          report.clearedRefs.push(`${table}:${row.id}`);
          if (row.eventId) touched.add(row.eventId);
        }
      }

      // e + g) bozuk olaylar: satırı yok (iptal), kopyası satırla uyuşmuyor (yenile), iptal edilmiş ama satırı var (yeniden etkin)
      for (const table of MODULE_TABLES) {
        for (const row of store.all(`SELECT e.id FROM fin_events e LEFT JOIN ${table} r ON r.id = e.src_id AND r.event_id = e.id WHERE e.status = 'active' AND e.src_table = '${table}' AND e.type NOT IN (${NON_MONEY_SQL}) AND ${copyMismatchSql(table)}`)) touched.add(row.id);
        for (const row of store.all(`SELECT DISTINCT r.event_id AS id FROM ${table} r JOIN fin_events e ON e.id = r.event_id WHERE r.event_id <> '' AND e.status = 'cancelled'`)) touched.add(row.id);
      }
      for (const id of touched) {
        const event = store.get("SELECT * FROM fin_events WHERE id = ?", id);
        if (!isModuleEvent(event)) continue;
        const rows = eventRows(store, id);
        if (!rows.length) {
          if (refreshEvent(store, id, { stamp }) === "cancelled") report.cancelledEvents.push(id);
          continue;
        }
        const primary = primaryRow(rows);
        const copy = eventCopy(store, primary.table, primary.row);
        if (matched.has(id)) {
          pending("g", id, "ekstreyle eşleşmiş olayın kopyası satırla uyuşmuyor");
          continue;
        }
        if (!open(copy.date) || !open(event.date)) {
          pending("g", id, "kilitli dönemdeki olayın kopyası satırla uyuşmuyor");
          continue;
        }
        if (refreshEvent(store, id, { stamp }) !== "same") report.refreshedEvents.push(id);
      }

      // c + d) kaynak satırı silinmiş POS satışları
      if (tables.has("pos_sales") && tables.has("pos_items")) {
        for (const sale of store.all("SELECT id, event_id AS eventId, pos_id AS posId FROM pos_sales WHERE kind = 'sale' AND status = 'active'")) {
          if (eventRows(store, sale.eventId).length) continue;
          const items = store.all("SELECT status FROM pos_items WHERE sale_id = ?", sale.id);
          if (items.every(item => item.status === "pending")) {
            store.run("UPDATE pos_sales SET status = 'void', updated_by = 'system', updated_at = ? WHERE id = ?", at, sale.id);
            store.run("UPDATE pos_items SET status = 'void', updated_by = 'system', updated_at = ? WHERE sale_id = ? AND status = 'pending'", at, sale.id);
            report.voidedSales.push(sale.id);
          } else {
            store.run("UPDATE pos_sales SET status = 'repair', updated_by = 'system', updated_at = ? WHERE id = ?", at, sale.id);
            pending("d", sale.id, `bankaya geçmiş POS satışının kaynak satırı eski sürümde silinmiş (POS ${sale.posId}); İptal İadesi kaydıyla çözülür`);
          }
        }
      }

      // h) tahsildeki çek eski sürümde ciro edilmiş, silinmiş ya da tahsil edilmiş
      if (tables.has("cheque_collections")) {
        for (const item of store.all(
          `SELECT k.id, k.cheque_id AS chequeId, k.bank_account_id AS bankAccountId, c.status, c.status_date AS statusDate, c.deleted_at AS deletedAt, c.amount
           FROM cheque_collections k LEFT JOIN cheques c ON c.id = k.cheque_id WHERE k.status = 'pending'`,
        )) {
          if (item.status === "portfolio" && !item.deletedAt) continue;
          const collected = item.status === "collected" && !item.deletedAt;
          const collectedOn = collected ? store.get("SELECT date FROM cheque_events WHERE cheque_id = ? AND kind = 'collect' ORDER BY created_at DESC LIMIT 1", item.chequeId)?.date : "";
          const date = collectedOn || item.statusDate || (item.deletedAt ? String(item.deletedAt).slice(0, 10) : "") || at.slice(0, 10);
          const status = collected ? "collected" : "withdrawn";
          const why = !item.status ? "çek kaydı yok" : item.deletedAt ? "eski sürümde silindi" : collected ? "eski sürümde tahsil edildi" : `eski sürümde durumu değişti (${item.status})`;
          const { year, seq, no } = nextEventNo(store, date, { now });
          const eventId = newEventId();
          store.run(
            "INSERT INTO fin_events (id, year, seq, no, type, date, status, origin, src_table, src_id, bank_ref, cheque_id, amount_minor, try_minor, description, created_by, created_at) VALUES (?, ?, ?, ?, 'cheque_withdraw', ?, 'active', 'repair', 'cheque_collections', ?, ?, ?, ?, ?, ?, 'system', ?)",
            eventId, year, seq, no, date, item.id, item.bankAccountId, item.chequeId, Math.round((Number(item.amount) || 0) * 100), Math.round((Number(item.amount) || 0) * 100), `Tahsildeki çek kapandı: ${why} (eski-surum)`, at,
          );
          store.run("UPDATE cheque_collections SET status = ?, closed_date = ?, close_event_id = ?, updated_by = 'system', updated_at = ? WHERE id = ?", status, date, eventId, at, item.id);
          report.closedCollections.push({ id: item.id, status, why });
        }
      }

      store.setSetting(REPAIR_STAMP_KEY, at);
      const changed = report.undoneMatches.length + report.voidedSales.length + report.cancelledEvents.length + report.clearedRefs.length + report.refreshedEvents.length + report.closedCollections.length;
      const fresh = report.unassigned > (Number(previous.unassigned) || 0) || report.pending.some(item => !(previous.pending || []).some(old => old.kind === item.kind && old.id === item.id));
      store.setSetting(REPAIR_KEY, JSON.stringify(report));
      if ((changed || fresh) && tables.has("integrity_log")) {
        const summary = [
          report.unassigned ? `Hesabı Belirsiz Yeni Hareketler (${report.unassigned})` : "",
          report.undoneMatches.length ? `geri alınan eşleşme ${report.undoneMatches.length}` : "",
          report.cancelledEvents.length ? `iptal edilen işlem başlığı ${report.cancelledEvents.length}` : "",
          report.refreshedEvents.length ? `yenilenen kopya ${report.refreshedEvents.length}` : "",
          report.clearedRefs.length ? `temizlenen hesap bağı ${report.clearedRefs.length}` : "",
          report.voidedSales.length ? `iptal edilen POS satışı ${report.voidedSales.length}` : "",
          report.closedCollections.length ? `kapanan tahsil kaydı ${report.closedCollections.length}` : "",
          report.pending.length ? `Onarım Bekliyor ${report.pending.length}` : "",
        ].filter(Boolean).join("; ");
        store.run("INSERT INTO integrity_log (id, at, action, tables, summary, detail_json) VALUES (?, ?, 'repair', '', ?, ?)", newId(), at, `Açılış onarımı (eski sürümden): ${summary}`.slice(0, 500), JSON.stringify(report).slice(0, 20000));
      }
    }),
  );
  if (report.unassigned || report.pending.length || report.cancelledEvents.length || report.refreshedEvents.length || report.undoneMatches.length || report.closedCollections.length) {
    log?.warn?.(`Açılış onarımı (eski sürümden): ${JSON.stringify({ unassigned: report.unassigned, pending: report.pending.length, cancelled: report.cancelledEvents.length, refreshed: report.refreshedEvents.length, matches: report.undoneMatches.length, collections: report.closedCollections.length })}`);
  }
  return report;
}
