// 2.5.0 Ç5-A tur 3b (tasarım notu docs/erp/C5-ACILIS-TASARIM.md §18.11; BAŞ MİMAR KARARI 14.11 — §18.9 (4) (i)): carinin SATIRLARINI kuran zincir — yalnız store ile kurulur
// (servis ağacı yok). Gövdeler AYNEN taşındı (girinti aynı; kapanış değişkeni yalnız store): routes/accounts.mjs'ten STOCK_REASON_SQL, entriesOf ve allLedgers'ın satır okuma /
// accountLedger döngüleri (entriesByAccount, ledgerLinesOf); routes/plans.mjs'ten iade kesimleri (returnCuts / scanReturnCuts + bellek), satış kaynağı (saleSources + bellek) ve
// kart haritası (ledgerPlansByAccount). Bellekler ÖRNEKTE (modül düzeyinde değil — iki şirket aynı süreçte): taksit servisi kayıt anında BİR örnek kurar (bellek ömrü aynı);
// lib/obligation-input.mjs kendi örneğini gerekince kurar (kuyruğun kendi kendine kuran yolu). İçe aktarım yalnız lib/accounts.mjs ve lib/money.mjs (lib/bank/doubtful.mjs yok — döngü yok).
import { accountLedger } from "./accounts.mjs";
import { roundMoney } from "./money.mjs";

// 2.4.5 KS7 (a): stoktan gelen cari satırının hareket nedeni (satıştan / alıştan iade bağsız ödemedir; lib/invoice-settle.mjs classifyLine).
const STOCK_REASON_SQL = "CASE WHEN e.source = 'stock' THEN COALESCE((SELECT m.reason FROM stock_moves m WHERE m.id = e.source_id), '') ELSE '' END";

export function createAccountLines({ store }) {
  const entriesOf = accountId =>
    store.all(
      `SELECT e.id, e.kind, e.amount, e.date, e.note, e.method, e.receipt_no AS receiptNo, e.source, e.source_id AS sourceId, e.invoice_id AS invoiceId, e.fin_ref AS finRef, e.created_by AS createdBy, e.created_at AS createdAt, e.updated_at AS updatedAt,
              e.doubtful_skip AS doubtfulSkip, e.due_date AS dueDate, e.expected_date AS expectedDate, e.refund_of AS refundOf, COALESCE(u.display_name, '') AS actorName,
              ${STOCK_REASON_SQL} AS stockReason
       FROM account_entries e LEFT JOIN users u ON u.id = e.created_by WHERE e.account_id = ? ORDER BY e.date, e.created_at, e.rowid`,
      accountId,
    );
  function entriesByAccount(scope, args) {
    const entries = new Map();
    // v2.0.22: yol ve "Kapatılacak Fatura" bağı da (Cari kartındaki defterle aynı satır; fatura kapamada kullanılır).
    for (const entry of store.all(`SELECT e.id, e.account_id AS accountId, e.kind, e.amount, e.date, e.note, e.method, e.receipt_no AS receiptNo, e.source, e.source_id AS sourceId, e.invoice_id AS invoiceId, e.refund_of AS refundOf, e.created_at AS createdAt, ${STOCK_REASON_SQL} AS stockReason FROM account_entries e${scope ? ` WHERE e.account_id IN (${scope})` : ""} ORDER BY e.date, e.created_at, e.rowid`, ...args)) {
      if (!entries.has(entry.accountId)) entries.set(entry.accountId, []);
      entries.get(entry.accountId).push(entry);
    }
    return entries;
  }
  function ledgerLinesOf(rows, entries, planMap) {
    const lines = new Map();
    for (const row of rows) lines.set(row.id, accountLedger(entries.get(row.id) || [], planMap.get(row.id) || []).lines);
    return lines;
  }
  // v2.0.24: iadelerin Mevcut Borç kartlarından düştüğü tutar (iade belgesinde payment_json.coverCuts; iptal/silinen iade
  // sayılmaz). Kartın kapsamı açıldığı andaki tutarla kurulur (lib/accounts.mjs coverTotal): iadenin kapattığı borç kartın
  // payından düşer; küçülen tutar başka (daha eski) bir faturayı kapsamdan çıkarıp aynı borcu iki kez saydırmaz.
  // 2.4.9 R2 (ders 47): forAccount (cari kartı, kartın WhatsApp çekirdeği waFacts) her çağrıda bütün iadeleri tarıyordu — 1.001 iadeli şirkette 2.000 kişilik
  // elle alıcı listesi 10,9 sn, olay döngüsü ~10 sn. Tarama KURALI AYNEN (scanReturnCuts); sonuç veri tabanına bir yazma olana kadar saklanır: total_changes()
  // bu bağlantının her INSERT/UPDATE/DELETE'inde (store dışı db.prepare/exec dahil) artar, data_version başka bir bağlantının kesinleşen yazmasında değişir
  // (fatura listesi settleKey, stok rozeti alerts, banka toplamları money-lines ile aynı kural). Veri tabanı işleminin İÇİNDE saklı değer ne okunur ne yazılır
  // (geri alınan işlemde total_changes azalmaz — GG2): işlem içinde her çağrı eskisi gibi tarar. Saklanan Map salt okunurdur (çağıranlar yalnız get eder).
  // Kart kimliğiyle SQL'de süzmek (instr) denendi, yetmedi: çağrı başına 1,56 ms (tam tarama 2,64 ms) — 1.310 kartlı caride ~2 sn.
  let cutsCache = { stamp: "", cuts: null };
  function returnCuts() {
    if (store.inTransaction || typeof store.changeCounters !== "function") return scanReturnCuts();
    const counters = store.changeCounters();
    const stamp = `${counters.total}|${counters.version}`;
    if (cutsCache.cuts && cutsCache.stamp === stamp) return cutsCache.cuts;
    const cuts = scanReturnCuts();
    cutsCache = { stamp, cuts };
    return cuts;
  }
  function scanReturnCuts() {
    const out = new Map();
    for (const row of store.all("SELECT payment_json AS j FROM invoices WHERE kind = 'sale_return' AND status = 'issued' AND payment_json LIKE '%coverCuts%'")) {
      let cuts = {};
      try {
        cuts = JSON.parse(row.j || "{}").coverCuts || {};
      } catch {
        cuts = {};
      }
      for (const [planId, cut] of Object.entries(cuts)) out.set(planId, roundMoney((out.get(planId) || 0) + (Number(cut) || 0)));
    }
    return out;
  }
  // Ç5-B kapanış düzeltmesi (dar kontrol ORTA-1 — GERİLEME; S110 = A; S133 = C): satışla açılan Mevcut Borç kartının KAYNAĞI (hangi stok satışıyla açıldı) kalıcı bilgiden
  // — kartın açılış izinden (audit_events 'plan.created'; iz silinmez, yedekle / geri yüklemeyle taşınır). Tek Yükümlülük Kuyruğu kartın "kendi satışını" bununla tanır
  // (lib/accounts.mjs coverSale → lib/obligation-queue.mjs ownSaleOf); tutar ya da kayıt anı eşitliğine bakılmaz.
  //   2.5.0'dan itibaren: iz yükündeki `saleMoveId` (createForAccount; alan HER toplu kartta yazılır — boşsa kart satışla açılmamıştır, çıkarım yapılmaz).
  //   Eski veri (v2.0.13 – v2.4.9; yükte alan YOK): stoktan satış aynı işlemde önce 'stock.out' izini, hemen ardından kartın 'plan.created' izini yazar
  //   (routes/stock.mjs; iki satır ardışıktır — aynı işlem, araya yazım giremez). Kartın izinden HEMEN ÖNCEKİ satır aynı kullanıcının, aynı cariye, açık hesaba (veresiye),
  //   kartın AÇILIŞ tutarında (izdeki total — sonradan düzenlenen tutar değil) stok satışıysa kart o satışla açılmıştır. Koşul tutmuyorsa kaynak bilinmez: kart elle açılmış
  //   kart gibi eski tanımada kalır (S133 = C).
  // Kaynak kart açıldıktan sonra DEĞİŞMEZ → kart kimliğiyle bellekte tutulur (şirket örneği başına; yalnız bilinmeyen kartlar için izden okunur — ders 47: kart başına
  // sorgu yok, tek sorgu). Veri tabanı işleminin içinde bellek yazılmaz (geri alınan işlemin kartı bellekte kalmasın).
  const saleSourceCache = new Map();
  const SALE_SOURCE_SQL = `SELECT e.entity_id AS planId, e.actor_id AS actor, e.payload_json AS payload, s.type AS prevType, s.entity_id AS prevId, s.actor_id AS prevActor, s.payload_json AS prevPayload
       FROM audit_events e LEFT JOIN audit_events s ON s.rowid = (SELECT MAX(x.rowid) FROM audit_events x WHERE x.rowid < e.rowid)
       WHERE e.type = 'plan.created' AND e.entity_id IN (SELECT value FROM json_each(?))`;
  const parsePayload = text => {
    try {
      const value = JSON.parse(text || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  };
  function saleSourceOfEvent(row) {
    const created = parsePayload(row.payload);
    if (Object.hasOwn(created, "saleMoveId")) return String(created.saleMoveId || "");
    if (created.bulk !== true || created.coversBalance !== true || created.invoiceId || row.prevType !== "stock.out" || row.prevActor !== row.actor) return "";
    const sale = parsePayload(row.prevPayload);
    // 'stock.out' = satış (tedarikçiye iade 'stock.preturn'); izdeki accountId yalnız açık hesaba (veresiye) satışta doludur (routes/stock.mjs moveInput).
    if (!created.accountId || sale.accountId !== created.accountId) return "";
    return Math.round((Number(sale.amount) || 0) * 100) === Math.round((Number(created.total) || 0) * 100) ? String(row.prevId || "") : "";
  }
  /** Kart kimlikleri → Map(kart → stok hareketi kimliği); satışla açılmamış / kaynağı bilinmeyen kart haritada YOK. */
  function saleSources(planIds) {
    const out = new Map();
    const missing = [];
    for (const id of planIds) {
      if (!saleSourceCache.has(id)) missing.push(id);
      else if (saleSourceCache.get(id)) out.set(id, saleSourceCache.get(id));
    }
    if (missing.length) {
      const found = new Map(missing.map(id => [id, ""]));
      for (const row of store.all(SALE_SOURCE_SQL, JSON.stringify(missing))) {
        const move = saleSourceOfEvent(row);
        if (move) found.set(row.planId, move);
      }
      for (const [id, move] of found) {
        if (!store.inTransaction) saleSourceCache.set(id, move);
        if (move) out.set(id, move);
      }
    }
    return out;
  }
  // Mizan (v2.0.7): tüm carilerin kartları, hareketleriyle; carinin defteri (accountLedger) Cari kartıyla aynı girdiyi alır.
  function ledgerPlansByAccount() {
    const out = new Map();
    // import_id: Excel / Tablodan Aktar kartı (2.5.0 Ç5-B tur 2b-2 — S110 / S120 bu kartlara uygulanmaz; lib/accounts.mjs coverSource).
    const plans = store.all("SELECT id, account_id AS accountId, name, total, status, covers_balance AS coversBalance, registered_on AS registeredOn, created_at AS createdAt, updated_at AS updatedAt, closed_at AS closedAt, import_id AS importId FROM plans WHERE deleted_at IS NULL AND account_id <> ''");
    if (!plans.length) return out;
    const seqs = new Map();
    const counts = new Map();
    const planned = new Map();
    for (const item of store.all("SELECT id, plan_id AS planId, seq, amount FROM plan_items")) {
      seqs.set(item.id, item.seq);
      counts.set(item.planId, (counts.get(item.planId) || 0) + 1);
      planned.set(item.planId, (planned.get(item.planId) || 0) + (Number(item.amount) || 0));
    }
    const entries = new Map();
    for (const entry of store.all("SELECT id, plan_id AS planId, item_id AS itemId, kind, amount, date, note, receipt_no AS receiptNo, opening, cheque_id AS chequeId, created_at AS createdAt FROM plan_entries ORDER BY date, created_at, rowid")) {
      if (!entries.has(entry.planId)) entries.set(entry.planId, []);
      entries.get(entry.planId).push({ ...entry, opening: Boolean(entry.opening), itemSeq: entry.itemId ? seqs.get(entry.itemId) || null : null });
    }
    const cutsOf = returnCuts();
    const sales = saleSources(plans.filter(plan => plan.coversBalance && !plan.importId).map(plan => plan.id));
    for (const plan of plans) {
      const own = entries.get(plan.id) || [];
      const paid = roundMoney(own.reduce((sum, entry) => sum + (entry.kind === "in" ? Number(entry.amount) || 0 : -(Number(entry.amount) || 0)), 0));
      if (!out.has(plan.accountId)) out.set(plan.accountId, []);
      out.get(plan.accountId).push({ ...plan, itemCount: counts.get(plan.id) || 0, planned: roundMoney(planned.get(plan.id) || 0), returnCuts: cutsOf.get(plan.id) || 0, saleMoveId: sales.get(plan.id) || "", totals: { paid }, entries: own });
    }
    return out;
  }
  // 2.5.0 Ç5-A tur 3c (§19.2; ders 47): kart haritası yalnız VERİLEN carilerin kartlarıyla — şüpheli ↔ kuyruk defter kuralı (lib/bank/doubtful.mjs linkedShares) kuyruğu yalnız bağlı alacaklı
  // şüpheli carisi için kurar; ledgerPlansByAccount bütün kartları okur (temiz 100 bin satırda ~250 ms — yazım yolunun kapısına binemez). Kart başına alanlar ledgerPlansByAccount'la AYNI
  // (iade kesimi returnCuts, satış kaynağı saleSources, sıra aynı); eşdeğerlik kalıcı testte (test/supheli-kuyruk-defter-250.test.mjs: her cari için küme haritası = bütün haritanın o carisi).
  function ledgerPlansOf(ids) {
    const out = new Map();
    const list = JSON.stringify([...new Set((ids || []).map(String))]);
    const plans = store.all("SELECT p.id, p.account_id AS accountId, p.name, p.total, p.status, p.covers_balance AS coversBalance, p.registered_on AS registeredOn, p.created_at AS createdAt, p.updated_at AS updatedAt, p.closed_at AS closedAt, p.import_id AS importId FROM json_each(?) j CROSS JOIN plans p ON p.account_id = j.value WHERE p.deleted_at IS NULL AND p.account_id <> '' ORDER BY p.rowid", list);
    if (!plans.length) return out;
    const planIds = JSON.stringify(plans.map(plan => plan.id));
    const seqs = new Map();
    const counts = new Map();
    const planned = new Map();
    for (const item of store.all("SELECT i.id, i.plan_id AS planId, i.seq, i.amount FROM json_each(?) j CROSS JOIN plan_items i ON i.plan_id = j.value", planIds)) {
      seqs.set(item.id, item.seq);
      counts.set(item.planId, (counts.get(item.planId) || 0) + 1);
      planned.set(item.planId, (planned.get(item.planId) || 0) + (Number(item.amount) || 0));
    }
    const entries = new Map();
    for (const entry of store.all("SELECT e.id, e.plan_id AS planId, e.item_id AS itemId, e.kind, e.amount, e.date, e.note, e.receipt_no AS receiptNo, e.opening, e.cheque_id AS chequeId, e.created_at AS createdAt FROM json_each(?) j CROSS JOIN plan_entries e ON e.plan_id = j.value ORDER BY e.date, e.created_at, e.rowid", planIds)) {
      if (!entries.has(entry.planId)) entries.set(entry.planId, []);
      entries.get(entry.planId).push({ ...entry, opening: Boolean(entry.opening), itemSeq: entry.itemId ? seqs.get(entry.itemId) || null : null });
    }
    const cutsOf = returnCuts();
    const sales = saleSources(plans.filter(plan => plan.coversBalance && !plan.importId).map(plan => plan.id));
    for (const plan of plans) {
      const own = entries.get(plan.id) || [];
      const paid = roundMoney(own.reduce((sum, entry) => sum + (entry.kind === "in" ? Number(entry.amount) || 0 : -(Number(entry.amount) || 0)), 0));
      if (!out.has(plan.accountId)) out.set(plan.accountId, []);
      out.get(plan.accountId).push({ ...plan, itemCount: counts.get(plan.id) || 0, planned: roundMoney(planned.get(plan.id) || 0), returnCuts: cutsOf.get(plan.id) || 0, saleMoveId: sales.get(plan.id) || "", totals: { paid }, entries: own });
    }
    return out;
  }
  return { entriesOf, entriesByAccount, ledgerLinesOf, returnCuts, scanReturnCuts, saleSources, ledgerPlansByAccount, ledgerPlansOf };
}
